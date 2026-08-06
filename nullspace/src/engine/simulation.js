import { Rng, clamp } from "../util/rng.js";
import { PRESENCE } from "../model/agent.js";
import { makeMessage, makeChannel } from "../model/world.js";
import { DOMAIN_BY_ID, DOMAINS } from "../data/topics.js";
import { REACTION_EMOJI } from "../data/voice.js";
import { SERVER_WELCOME, RULES_TEXT, MOVES } from "../data/moves.js";
import { ROLE_NAMES } from "../data/names.js";
import {
    composeMessage, updateConvoState, applySocialEffects, voiceOf, RESPONSIVE_MOVES
} from "./dialogue.js";
import { applyVoice, fillSlots } from "./language.js";
import { createAgent, createServer } from "./genesis.js";

// Drives the world forward. Everything the UI sees — typing indicators,
// messages appearing one at a time, people drifting offline — comes from here.

const SPEEDS = { paused: 0, slow: 0.5, normal: 1, fast: 3, blur: 10 };

// Left unbounded, the network doubles every few simulated days: the server rail
// overflows, member lists become unreadable, and the saved world outgrows the
// localStorage quota. Growth continues past these points by rearranging who is
// where rather than by adding more.
const LIMITS = { agents: 110, servers: 12, channelsPerServer: 10 };

export class Simulation {
    constructor(world, seed) {
        this.world = world;
        this.rng = new Rng(`${seed}:sim`);
        this.speed = "normal";
        // Internal clock in ms that only advances while running, so pausing
        // freezes half-typed messages instead of dumping them all at once.
        this.clock = 0;
        this.spawnAccumulator = 0;
        this.presenceAccumulator = 0;
        this.eventAccumulator = 0;
        this.pending = [];   // typing / delayed actions
        this.focusChannelId = null;
        this.listeners = { message: [], typing: [], event: [], tick: [] };
    }

    on(kind, handler) {
        this.listeners[kind].push(handler);
        return () => {
            this.listeners[kind] = this.listeners[kind].filter((h) => h !== handler);
        };
    }

    emit(kind, payload) {
        for (const handler of this.listeners[kind]) handler(payload);
    }

    setSpeed(speed) {
        this.speed = speed;
    }

    get minutesPerSecond() {
        return SPEEDS[this.speed] ?? 1;
    }

    get typingList() {
        return this.pending.filter((p) => p.type === "message" && p.visible);
    }

    typingIn(channelId) {
        return this.pending
            .filter((p) => p.type === "message" && p.channelId === channelId && p.visible)
            .map((p) => this.world.agents[p.agentId])
            .filter(Boolean);
    }

    step(realDeltaMs) {
        const rate = this.minutesPerSecond;
        if (rate === 0) return;
        const dtMs = Math.min(realDeltaMs, 250); // ignore huge tab-away gaps
        this.clock += dtMs;
        const simMinutes = (dtMs / 1000) * rate;
        this.world.minute += simMinutes;

        this.flushPending();
        this.maybeSpeak(simMinutes);
        this.maybeUpdatePresence(simMinutes);
        this.maybeWorldEvent(simMinutes);
        this.decayRooms(simMinutes);
        this.emit("tick", this.world);
    }

    // Runs the world forward with no typing delays, to build history before
    // the user ever sees the screen.
    prime(turns) {
        const realSpeed = this.speed;
        this.speed = "normal";
        for (let i = 0; i < turns; i += 1) {
            this.world.minute += this.rng.float(0.7, 4.5);
            const plan = this.planUtterance();
            if (plan) this.deliver(plan, { instant: true });
            if (i % 30 === 0) this.updatePresence();
        }
        this.speed = realSpeed;
        this.pending = [];
    }

    flushPending() {
        const ready = this.pending.filter((p) => p.readyAt <= this.clock);
        if (ready.length === 0) return;
        this.pending = this.pending.filter((p) => p.readyAt > this.clock);
        for (const item of ready) {
            if (item.type === "message") this.deliver(item);
            else if (item.type === "reaction") this.applyReaction(item);
        }
    }

    // ---- speaking ---------------------------------------------------------

    maybeSpeak(simMinutes) {
        const online = this.world.agentList.filter((a) => a.presence === PRESENCE.ONLINE && !a.isHuman);
        const baseRate = 0.09 + Math.min(0.7, online.length * 0.032); // utterances per sim minute
        this.spawnAccumulator += simMinutes * baseRate;
        let guard = 0;
        while (this.spawnAccumulator >= 1 && guard < 6) {
            this.spawnAccumulator -= 1;
            guard += 1;
            const plan = this.planUtterance();
            if (plan) this.beginTyping(plan);
        }
    }

    pickChannel() {
        const candidates = [];
        for (const channel of Object.values(this.world.channels)) {
            if (channel.readOnly) continue;
            const members = this.world.membersOf(channel.serverId)
                .filter((a) => a.presence === PRESENCE.ONLINE && !a.isHuman);
            if (members.length === 0) continue;
            const quietFor = this.world.minute - (channel.lastActivity || 0);
            const focusBoost = channel.id === this.focusChannelId ? 3.2 : 1;
            const heat = channel.convo.heat || 0.2;
            const weight = (members.length * 0.35 + heat * 3 + Math.min(3, quietFor / 90)) * focusBoost;
            candidates.push({ channel, weight, members });
        }
        if (candidates.length === 0) return null;
        return this.rng.weighted(candidates);
    }

    planUtterance() {
        const picked = this.pickChannel();
        if (!picked) return null;
        const { channel, members } = picked;
        const convo = channel.convo;
        const last = this.world.lastMessage(channel.id);

        const speakerOptions = members.map((agent) => {
            let weight = 0.2 + agent.personality.talkativeness * 2.2;
            weight *= 0.4 + agent.interestIn(channel.domainId) * 1.6;
            // Don't let one voice monopolise the room.
            const recentCount = convo.recentSpeakers.filter((id) => id === agent.id).length;
            weight /= 1 + recentCount * 1.9;
            if (last && last.authorId === agent.id) weight *= 0.12;
            if (last && last.mentions.includes(agent.id)) weight *= 6;
            if (convo.openQuestion && convo.openQuestion.authorId !== agent.id) {
                weight *= 1 + agent.interestIn(channel.domainId);
            }
            weight *= 0.6 + agent.mood.energy * 0.8;
            return { agent, weight };
        });
        if (speakerOptions.length === 0) return null;
        const agent = this.rng.weighted(speakerOptions).agent;
        const composed = composeMessage(this.world, this.rng, agent, channel);
        return { channel, agent, composed };
    }

    beginTyping(plan) {
        const { channel, agent, composed } = plan;
        const delay = agent.typingMillisFor(composed.text) / Math.max(0.35, this.minutesPerSecond * 0.6);
        const item = {
            type: "message",
            readyAt: this.clock + delay,
            channelId: channel.id,
            agentId: agent.id,
            plan,
            visible: composed.text.length > 18 // very short messages appear without a visible "typing"
        };
        this.pending.push(item);
        if (item.visible) this.emit("typing", { channelId: channel.id });
    }

    deliver(item, options = {}) {
        const { channel, agent, composed } = item.plan || item;
        const message = makeMessage({
            id: this.rng.id("m"),
            channelId: channel.id,
            authorId: agent.id,
            text: composed.text,
            minute: this.world.minute,
            replyTo: composed.replyTo,
            mentions: composed.mentions,
            kind: composed.kind
        });
        this.world.postMessage(message);
        updateConvoState(channel, message, composed, this.world, this.rng);
        applySocialEffects(this.world, this.rng, agent, channel, composed);
        agent.nudgeMood(this.rng.float(-0.02, 0.05), -0.01);

        this.world.note("speech", `${agent.handle} → #${channel.name}`, {
            rationale: composed.rationale,
            move: composed.move,
            agentId: agent.id,
            channelId: channel.id
        });
        this.emit("message", { message, channel, agent, composed });

        for (const follow of composed.followUps) {
            const followMessage = makeMessage({
                id: this.rng.id("m"),
                channelId: channel.id,
                authorId: agent.id,
                text: follow,
                minute: this.world.minute,
                kind: "chat"
            });
            if (options.instant) {
                this.world.postMessage(followMessage);
                this.emit("message", { message: followMessage, channel, agent, composed });
            } else {
                this.pending.push({
                    type: "message",
                    readyAt: this.clock + this.rng.int(700, 2200),
                    channelId: channel.id,
                    agentId: agent.id,
                    visible: false,
                    plan: {
                        channel,
                        agent,
                        composed: { ...composed, text: follow, followUps: [], replyTo: null, mentions: [], opensTopic: false, asks: false }
                    }
                });
            }
        }

        this.scheduleReactions(message, channel, options.instant);
        return message;
    }

    scheduleReactions(message, channel, instant) {
        const members = this.world.membersOf(channel.serverId)
            .filter((a) => a.id !== message.authorId && (instant || a.presence === PRESENCE.ONLINE));
        if (members.length === 0) return;

        let appetite = 0.25;
        if (message.kind === "win") appetite = 0.85;
        if (message.kind === "gripe") appetite = 0.5;
        if (message.kind === "take") appetite = 0.45;
        if (message.text.length < 15) appetite = 0.12;

        const pool = this.rng.sample(members, this.rng.int(0, 3));
        for (const reactor of pool) {
            const chance = appetite * (0.4 + reactor.affinityTo(message.authorId) + reactor.personality.warmth * 0.5);
            if (!this.rng.chance(clamp(chance, 0, 0.9))) continue;
            const emoji = this.emojiFor(message);
            const item = { type: "reaction", messageId: message.id, channelId: channel.id, agentId: reactor.id, emoji };
            if (instant) this.applyReaction(item);
            else this.pending.push({ ...item, readyAt: this.clock + this.rng.int(900, 6000) });
        }
    }

    emojiFor(message) {
        if (message.kind === "win") return this.rng.pick(["🎉", "🔥", "👏", "❤️", "✨"]);
        if (message.kind === "gripe") return this.rng.pick(["🫂", "😭", "💀", "🥲", "🙏"]);
        if (message.kind === "question") return this.rng.pick(["👀", "🤔", "📌"]);
        return this.rng.pick(REACTION_EMOJI);
    }

    applyReaction(item) {
        const channel = this.world.channels[item.channelId];
        if (!channel) return;
        const message = channel.messages.find((m) => m.id === item.messageId);
        if (!message) return;
        const list = message.reactions[item.emoji] || (message.reactions[item.emoji] = []);
        if (!list.includes(item.agentId)) list.push(item.agentId);
        const author = this.world.agents[message.authorId];
        const reactor = this.world.agents[item.agentId];
        if (author && reactor) {
            author.nudgeMood(0.02);
            reactor.nudgeAffinity(author.id, 0.01);
        }
        this.emit("message", { message, channel, agent: author, reactionOnly: true });
    }

    // ---- the human --------------------------------------------------------

    postUserMessage(channelId, text) {
        const channel = this.world.channels[channelId];
        const user = this.world.agents[this.world.userId];
        if (!channel || !user || !text.trim()) return null;

        const mentions = [];
        for (const raw of text.match(/@([a-z0-9_]+)/gi) || []) {
            const found = this.world.agentList.find((a) => a.handle === raw.slice(1).toLowerCase());
            if (found) mentions.push(found.id);
        }

        const message = makeMessage({
            id: this.rng.id("m"),
            channelId,
            authorId: user.id,
            text: text.trim(),
            minute: this.world.minute,
            mentions,
            kind: /\?\s*$/.test(text) ? "question" : "chat"
        });
        this.world.postMessage(message);
        updateConvoState(channel, message, {
            asks: message.kind === "question",
            opensTopic: text.length > 40,
            kind: message.kind
        }, this.world, this.rng);
        this.emit("message", { message, channel, agent: user });

        this.scheduleUserReplies(channel, message);
        return message;
    }

    scheduleUserReplies(channel, message) {
        let members = this.world.membersOf(channel.serverId)
            .filter((a) => !a.isHuman && a.presence === PRESENCE.ONLINE);

        // Talking into an empty room and getting nothing back is realistic and
        // miserable. If the server is asleep, one person checks their phone.
        if (members.length === 0) {
            const asleep = this.world.membersOf(channel.serverId).filter((a) => !a.isHuman);
            if (asleep.length === 0) return;
            const woken = this.rng.weighted(asleep.map((agent) => ({
                agent,
                weight: agent.personality.talkativeness + agent.personality.warmth
                    + Math.max(0, agent.affinityTo(message.authorId)) * 2
            }))).agent;
            woken.presence = PRESENCE.ONLINE;
            this.world.note("presence", `${woken.handle} came online after you posted in #${channel.name}`, {
                agentId: woken.id, rationale: "the room was asleep"
            });
            members = [woken];
        }

        // People who were mentioned answer; otherwise one or two of the more
        // sociable members pick it up.
        const responders = [];
        for (const id of message.mentions) {
            const mentioned = members.find((a) => a.id === id);
            if (mentioned) responders.push(mentioned);
        }
        const previousSpeakerId = channel.messages.length > 1
            ? channel.messages[channel.messages.length - 2].authorId
            : null;
        const extra = this.rng.weighted(members.map((agent) => ({
            agent,
            weight: (agent.personality.talkativeness + agent.personality.warmth
                + agent.affinityTo(message.authorId) * 2)
                // Spread the welcome around rather than letting whoever just
                // spoke answer the newcomer too.
                * (agent.id === previousSpeakerId ? 0.3 : 1)
        }))).agent;
        // Somebody always answers a human. Being ignored is the one outcome
        // that would make the whole thing feel like a screensaver.
        if (!responders.includes(extra)) responders.push(extra);
        if (members.length > 1 && this.rng.chance(0.35)) {
            const second = this.rng.pick(members);
            if (!responders.includes(second)) responders.push(second);
        }

        responders.forEach((agent, index) => {
            const composed = composeMessage(this.world, this.rng, agent, channel, {
                constrainTo: RESPONSIVE_MOVES
            });
            composed.replyTo = this.rng.chance(0.5) ? message.id : null;
            composed.targetId = message.id;
            composed.rationale = `responding to you in #${channel.name}`;
            const delay = 1200 + index * this.rng.int(800, 2600) + agent.typingMillisFor(composed.text);
            this.pending.push({
                type: "message",
                readyAt: this.clock + delay,
                channelId: channel.id,
                agentId: agent.id,
                visible: true,
                plan: { channel, agent, composed }
            });
            agent.nudgeAffinity(message.authorId, 0.03);
        });
        this.emit("typing", { channelId: channel.id });
    }

    // ---- ambient world ----------------------------------------------------

    maybeUpdatePresence(simMinutes) {
        this.presenceAccumulator += simMinutes;
        if (this.presenceAccumulator < 12) return;
        this.presenceAccumulator = 0;
        this.updatePresence();
    }

    updatePresence() {
        const hour = Math.floor(this.world.minute / 60) % 24;
        for (const agent of this.world.agentList) {
            if (agent.isHuman) continue;
            const wake = agent.wakefulnessAt(hour);
            const roll = this.rng.next();
            let next;
            if (roll < wake * 0.75) next = PRESENCE.ONLINE;
            else if (roll < wake * 0.9) next = PRESENCE.IDLE;
            else if (roll < wake * 0.95) next = PRESENCE.DND;
            else next = PRESENCE.OFFLINE;
            // Hysteresis: staying put is more likely than flipping.
            if (agent.presence !== next && this.rng.chance(0.35)) continue;
            agent.presence = next;
            // Moods drift back toward each agent's baseline over time.
            agent.nudgeMood((0.15 - agent.mood.valence) * 0.08, (0.6 - agent.mood.energy) * 0.1);
        }
    }

    decayRooms(simMinutes) {
        for (const channel of Object.values(this.world.channels)) {
            channel.convo.heat = Math.max(0.05, channel.convo.heat - simMinutes * 0.004);
            const q = channel.convo.openQuestion;
            if (q && this.world.minute - q.minute > 90) channel.convo.openQuestion = null;
        }
    }

    maybeWorldEvent(simMinutes) {
        this.eventAccumulator += simMinutes;
        if (this.eventAccumulator < 110) return;
        this.eventAccumulator = 0;

        const roll = this.rng.next();
        if (roll < 0.36) this.eventNewMember();
        else if (roll < 0.62) this.eventCrossJoin();
        else if (roll < 0.78) this.eventNewChannel();
        else if (roll < 0.9) this.eventPin();
        else this.eventFoundServer();
    }

    eventNewMember() {
        // A full network still gets newcomers to a given server — they just
        // come from elsewhere in the network instead of from nowhere.
        if (this.world.agentList.length >= LIMITS.agents) {
            this.eventCrossJoin();
            return;
        }
        const server = this.rng.pick(this.world.serverList);
        if (!server) return;
        const domain = DOMAIN_BY_ID[server.domainId];
        const newcomer = createAgent(this.rng, { domains: [domain, this.rng.pick(DOMAINS)] });
        newcomer.presence = PRESENCE.ONLINE;
        newcomer.joinedAt = this.world.minute;
        this.world.addAgent(newcomer);
        this.world.joinServer(newcomer.id, server.id);
        server.roles[newcomer.id] = "newcomer";
        this.world.note("join", `${newcomer.handle} joined ${server.name}`, { agentId: newcomer.id });

        const intro = this.world.channelsOf(server.id).find((c) => c.name === "introductions")
            || this.world.channelsOf(server.id).find((c) => c.name === "general");
        if (!intro) return;

        const voice = voiceOf(newcomer);
        const rendered = applyVoice(fillSlots(this.rng.pick(MOVES.selfIntro), {
            niche: this.rng.pick(domain.lexicon.niche),
            thing: this.rng.pick(domain.lexicon.thing),
            adj: this.rng.pick(domain.lexicon.adj),
            years: this.rng.int(1, 12)
        }, this.rng), voice, this.rng);

        this.pending.push({
            type: "message",
            readyAt: this.clock + this.rng.int(600, 3000),
            channelId: intro.id,
            agentId: newcomer.id,
            visible: true,
            plan: {
                channel: intro,
                agent: newcomer,
                composed: {
                    text: rendered.text, followUps: rendered.followUps, kind: "chat",
                    move: "selfIntro", asks: false, opensTopic: true, replyTo: null,
                    targetId: null, mentions: [], rationale: "introducing themselves"
                }
            }
        });
    }

    eventCrossJoin() {
        const agent = this.rng.pick(this.world.agentList.filter((a) => !a.isHuman));
        if (!agent) return;
        const options = this.world.serverList.filter((s) => !s.memberIds.includes(agent.id));
        if (options.length === 0) return;
        const server = this.rng.weighted(options.map((s) => ({
            server: s,
            weight: 0.2 + agent.interestIn(s.domainId) * 3
                + this.world.membersOf(s.id).reduce((sum, m) => sum + Math.max(0, agent.affinityTo(m.id)), 0) * 0.4
        }))).server;
        if (!server) return;
        this.world.joinServer(agent.id, server.id);
        server.roles[agent.id] = this.rng.pick(ROLE_NAMES);
        this.world.note("join", `${agent.handle} followed friends into ${server.name}`, { agentId: agent.id });
    }

    eventNewChannel() {
        const server = this.rng.pick(this.world.serverList);
        if (!server) return;
        const domain = DOMAIN_BY_ID[server.domainId];
        if (this.world.channelsOf(server.id).length >= LIMITS.channelsPerServer) return;
        const existing = new Set(this.world.channelsOf(server.id).map((c) => c.name));
        const candidate = domain.channels.find((c) => !existing.has(c.name));
        if (!candidate) return;
        const mods = Object.entries(server.roles).filter(([, role]) => role === "moderator" || role === "founder");
        const modId = mods.length ? this.rng.pick(mods)[0] : server.ownerId;
        const channel = makeChannel({
            id: this.rng.id("c"),
            serverId: server.id,
            name: candidate.name,
            purpose: candidate.purpose,
            domainId: domain.id,
            category: domain.label.toLowerCase()
        });
        this.world.addChannel(channel);
        this.world.note("structure", `#${channel.name} opened in ${server.name}`, { channelId: channel.id });

        const general = this.world.channelsOf(server.id).find((c) => c.name === "general");
        const mod = this.world.agents[modId];
        if (general && mod) {
            const rendered = applyVoice(
                `made #${channel.name} — ${candidate.purpose}. move the relevant chat over there when you remember`,
                voiceOf(mod), this.rng
            );
            this.pending.push({
                type: "message",
                readyAt: this.clock + this.rng.int(400, 2000),
                channelId: general.id,
                agentId: mod.id,
                visible: true,
                plan: {
                    channel: general, agent: mod,
                    composed: {
                        text: rendered.text, followUps: [], kind: "chat", move: "modNote",
                        asks: false, opensTopic: true, replyTo: null, targetId: null,
                        mentions: [], rationale: "opened a new channel"
                    }
                }
            });
        }
    }

    eventPin() {
        const server = this.rng.pick(this.world.serverList);
        if (!server) return;
        const channels = this.world.channelsOf(server.id).filter((c) => c.messages.length > 4);
        if (channels.length === 0) return;
        const channel = this.rng.pick(channels);
        const message = this.rng.pick(channel.messages.slice(-12));
        if (server.pinned.some((p) => p.messageId === message.id)) return;
        server.pinned.push({ messageId: message.id, channelId: channel.id, minute: this.world.minute });
        if (server.pinned.length > 8) server.pinned.shift();
        this.world.note("structure", `a message in #${channel.name} got pinned`, { channelId: channel.id });
    }

    // Two people who like each other and share an interest start their own
    // place, and bring their friends. This is how the network grows sideways.
    eventFoundServer() {
        if (this.world.serverList.length >= LIMITS.servers) {
            this.eventCrossJoin();
            return;
        }
        const candidates = this.world.agentList.filter((a) => !a.isHuman && a.personality.talkativeness > 0.5);
        if (candidates.length < 2) return;
        const founder = this.rng.pick(candidates);
        const friendIds = founder.friends(6).map(([id]) => id);
        if (friendIds.length < 2) return;

        const domainId = Object.entries(founder.interests).sort((a, b) => b[1] - a[1])[0]?.[0];
        const domain = DOMAIN_BY_ID[domainId] || this.rng.pick(DOMAINS);
        const server = createServer(this.world, this.rng, domain, founder);
        for (const id of friendIds) {
            if (this.world.joinServer(id, server.id)) {
                server.roles[id] = this.rng.chance(0.3) ? "moderator" : "regular";
            }
        }
        this.world.note("founding", `${founder.handle} founded ${server.name}`, { agentId: founder.id });

        const channels = this.world.channelsOf(server.id);
        const rules = channels.find((c) => c.name === "rules");
        const general = channels.find((c) => c.name === "general");
        if (rules) {
            this.world.postMessage(makeMessage({
                id: this.rng.id("m"), channelId: rules.id, authorId: founder.id,
                text: this.rng.pick(RULES_TEXT), minute: this.world.minute, kind: "system"
            }));
        }
        if (general) {
            const welcome = fillSlots(this.rng.pick(SERVER_WELCOME), {
                serverName: server.name, blurb: domain.blurb
            }, this.rng);
            this.world.postMessage(makeMessage({
                id: this.rng.id("m"), channelId: general.id, authorId: founder.id,
                text: welcome, minute: this.world.minute, kind: "take"
            }));
        }
        this.emit("event", { kind: "founding", server });
    }
}
