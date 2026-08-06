import { DOMAIN_BY_ID } from "../data/topics.js";
import { MOVES, TANGENT_SEEDS, LINK_TITLES } from "../data/moves.js";
import { VOICE_PROFILES } from "../data/voice.js";
import { AGREEMENT_TOKENS, DISAGREEMENT_TOKENS } from "../data/voice.js";
import { applyVoice, fillSlots, shortUtterance, fragmentOf } from "./language.js";

const VOICE_BY_ID = Object.fromEntries(VOICE_PROFILES.map((v) => [v.id, v]));

export function voiceOf(agent) {
    return VOICE_BY_ID[agent.voiceId] || VOICE_PROFILES[0];
}

// Slot values are drawn once per message so a template that mentions
// {problem} twice is talking about the same problem both times.
function slotContext(domain, rng, extra = {}) {
    const lex = domain.lexicon;
    return {
        thing: rng.pick(lex.thing),
        tool: rng.pick(lex.tool),
        action: rng.pick(lex.action),
        adj: rng.pick(lex.adj),
        problem: rng.pick(lex.problem),
        place: rng.pick(lex.place),
        niche: rng.pick(lex.niche),
        tangentSeed: rng.pick(TANGENT_SEEDS),
        linkTitle: rng.pick(LINK_TITLES),
        years: rng.int(2, 14),
        ...extra
    };
}

function recentMessages(channel, count) {
    return channel.messages.slice(-count);
}

// A room that reuses the same sentence twice in ten minutes stops reading as
// people, so each channel remembers what it has recently said.
function pickFresh(pool, channel, rng) {
    const recent = channel.convo.recentTemplates || (channel.convo.recentTemplates = []);
    let choice = rng.pick(pool);
    for (let attempt = 0; attempt < 4 && recent.includes(choice); attempt += 1) {
        choice = rng.pick(pool);
    }
    recent.push(choice);
    if (recent.length > 18) recent.shift();
    return choice;
}

function pickReplyTarget(channel, agent, rng) {
    const recent = recentMessages(channel, 6).filter((m) => m.authorId !== agent.id);
    if (recent.length === 0) return null;
    // Strong recency bias — people reply to what is on screen.
    const weighted = recent.map((message, index) => ({
        message,
        weight: (index + 1) ** 2 + agent.affinityTo(message.authorId) * 4
    }));
    return rng.weighted(weighted).message;
}

// Decides what this agent does next in this room, given what just happened.
function chooseMove(world, rng, agent, channel, constrainTo) {
    const p = agent.personality;
    const convo = channel.convo;
    const last = world.lastMessage(channel.id);
    const lastAuthor = last ? world.agents[last.authorId] : null;
    const mentionedMe = last && last.mentions.includes(agent.id);
    const openQuestion = convo.openQuestion;
    const affinityToLast = last ? agent.affinityTo(last.authorId) : 0;
    const stale = convo.turnsOnTopic > rng.int(5, 11) || !convo.topic;

    const options = [];
    const add = (move, weight, why) => {
        if (weight > 0) options.push({ move, weight, why, value: move });
    };

    if (openQuestion && openQuestion.authorId !== agent.id) {
        const canHelp = agent.interestIn(channel.domainId) + p.warmth;
        add("answer", 5 * canHelp, `${world.agents[openQuestion.authorId]?.handle ?? "someone"} left a question open`);
    }
    if (mentionedMe) {
        add("answer", 6, "was pinged directly");
        add("joke", 2 * p.humor, "was pinged and would rather be funny");
    }
    if (last && last.kind === "win" && last.authorId !== agent.id) {
        add("hype", 5 * (p.warmth + affinityToLast + 0.2), "someone posted a win");
    }
    if (last && last.kind === "gripe" && last.authorId !== agent.id) {
        add("support", 4 * (p.warmth + 0.3), "someone is having a bad time");
        add("anecdote", 2 * p.talkativeness, "has a war story about it");
    }

    if (stale) {
        add("take", 3 * (p.talkativeness + p.contrarian), "room went quiet, opening a topic");
        add("question", 3 * p.curiosity, "room went quiet, asking something");
        add("gripe", 2.2, "room went quiet, venting");
        add("win", 1.6, "room went quiet, sharing good news");
        add("linkDrop", 1.2 * p.curiosity, "found something to share");
        add("meta", 0.8, "talking about the server itself");
    } else {
        add("agree", 3 * (p.agreeableness + affinityToLast * 0.8), "agrees with the room");
        add("softAgree", 1.8 * p.agreeableness, "half agrees");
        add("disagree", 3 * (p.contrarian + Math.max(0, -affinityToLast)), "wants to push back");
        add("joke", 3 * p.humor, "sees a joke");
        add("question", 2.4 * p.curiosity, "wants detail");
        add("anecdote", 1.8 * p.talkativeness, "relates a story");
        add("tangent", 1.1 * (p.humor + p.talkativeness) * 0.5, "derails slightly");
        if (convo.turnsOnTopic > 3) add("callback", 1.2, "callbacks to earlier");
    }

    if (channel.name === "introductions" && rng.chance(0.3)) {
        add("welcome", 3, "greeting a newcomer");
    }
    if (channel.name === "general" && agent.lastSpokeAt < world.minute - 400) {
        add("greet", 2.5, "just showed up");
    }
    if (world.servers[channel.serverId]?.roles[agent.id] === "moderator" && rng.chance(0.08)) {
        add("modNote", 2, "doing mod things");
    }

    if (options.length === 0) add("agree", 1, "nothing else to do");

    // Replies to a human are held to a narrower set of moves — wandering off
    // on a tangent when someone just spoke to you reads as broken, not quirky.
    if (constrainTo) {
        const kept = options.filter((option) => constrainTo.includes(option.move));
        if (kept.length > 0) return rng.weighted(kept);
        return { move: rng.pick(constrainTo), why: "replying to you" };
    }
    return rng.weighted(options);
}

export const RESPONSIVE_MOVES = [
    "answer", "agree", "softAgree", "disagree", "question", "hype",
    "support", "welcome", "anecdote"
];

function textForMove(move, { domain, rng, agent, channel, world, target, ctx, voice }) {
    switch (move) {
        case "take":
            return { base: pickFresh(domain.takes, channel, rng), kind: "take", opensTopic: true };
        case "question":
            return { base: fillSlots(pickFresh(domain.questions, channel, rng), ctx, rng), kind: "question", opensTopic: true, asks: true };
        case "gripe":
            return { base: fillSlots(pickFresh(domain.gripes, channel, rng), ctx, rng), kind: "gripe", opensTopic: true };
        case "win":
            return { base: fillSlots(pickFresh(domain.wins, channel, rng), ctx, rng), kind: "win", opensTopic: true };
        default: {
            const pool = MOVES[move] || MOVES.agree;
            const asks = move === "question";
            return {
                base: fillSlots(pickFresh(pool, channel, rng), ctx, rng),
                kind: move === "answer" ? "answer" : "chat",
                asks
            };
        }
    }
}

export function composeMessage(world, rng, agent, channel, options = {}) {
    const domain = DOMAIN_BY_ID[channel.domainId] || DOMAIN_BY_ID.gamedev;
    const voice = voiceOf(agent);
    const decision = chooseMove(world, rng, agent, channel, options.constrainTo);
    const move = decision.move;

    const reactiveMoves = new Set([
        "agree", "softAgree", "disagree", "joke", "question", "answer",
        "anecdote", "support", "hype", "callback", "tangent", "welcome"
    ]);

    let target = null;
    if (reactiveMoves.has(move)) {
        const openQ = channel.convo.openQuestion;
        if (move === "answer" && openQ) {
            target = channel.messages.find((m) => m.id === openQ.messageId) || pickReplyTarget(channel, agent, rng);
        } else {
            target = pickReplyTarget(channel, agent, rng);
        }
    }

    const targetAuthor = target ? world.agents[target.authorId] : null;
    const roommates = world.membersOf(channel.serverId).filter((a) => a.id !== agent.id);
    const mentions = [];
    const ctx = slotContext(domain, rng, {
        name: targetAuthor ? targetAuthor.handle
            : (roommates.length ? rng.pick(roommates).handle : agent.handle),
        quote: target ? `"${fragmentOf(target.text, rng)}"` : `"${fragmentOf(rng.pick(domain.takes), rng)}"`,
        serverName: world.servers[channel.serverId]?.name || "here",
        blurb: domain.blurb
    });

    // Low-effort reactions: a real channel is full of one-word messages.
    const wantsShort = (voice.lengthBias < -0.4 && rng.chance(0.45))
        || (move === "agree" && rng.chance(0.3))
        || (move === "disagree" && rng.chance(0.12));

    let base = null;
    let shortText = null;
    let kind = "chat";
    let asks = false;
    let opensTopic = false;

    if (wantsShort && (move === "agree" || move === "disagree" || move === "hype")) {
        const token = move === "disagree"
            ? pickFresh(DISAGREEMENT_TOKENS, channel, rng)
            : pickFresh(AGREEMENT_TOKENS, channel, rng);
        shortText = shortUtterance(token, voice, rng);
    } else {
        const built = textForMove(move, { domain, rng, agent, channel, world, target, ctx, voice });
        base = built.base;
        kind = built.kind;
        asks = Boolean(built.asks);
        opensTopic = Boolean(built.opensTopic);
    }

    let text;
    let followUps = [];
    if (base === null) {
        text = shortText;
    } else {
        const rendered = applyVoice(base, voice, rng, {
            allowFollowUp: base.length > 40
        });
        text = rendered.text;
        followUps = rendered.followUps;
    }

    // Resolve @mentions that survived into the final text.
    const mentionMatch = text.match(/@([a-z0-9_]+)/gi) || [];
    for (const raw of mentionMatch) {
        const handle = raw.slice(1).toLowerCase();
        const found = world.agentList.find((a) => a.handle === handle);
        if (found) mentions.push(found.id);
    }
    // Occasionally address the person being replied to by name even when the
    // template did not ask for it.
    if (targetAuthor && mentions.length === 0 && rng.chance(0.12)) {
        text = `@${targetAuthor.handle} ${text}`;
        mentions.push(targetAuthor.id);
    }

    return {
        text,
        followUps,
        kind,
        move,
        asks,
        opensTopic,
        replyTo: target && rng.chance(0.55) ? target.id : null,
        targetId: target ? target.id : null,
        mentions,
        rationale: decision.why
    };
}

// Called after a message lands so the room's state reflects it.
export function updateConvoState(channel, message, composed, world, rng) {
    const convo = channel.convo;
    if (composed.opensTopic || !convo.topic) {
        convo.topic = message.text.slice(0, 90);
        convo.turnsOnTopic = 0;
        convo.heat = 0.55;
        convo.starterId = message.authorId;
    } else {
        convo.turnsOnTopic += 1;
        convo.heat = Math.min(1, convo.heat + 0.08);
    }

    if (composed.asks) {
        convo.openQuestion = { authorId: message.authorId, messageId: message.id, minute: world.minute };
    } else if (composed.kind === "answer" && convo.openQuestion && convo.openQuestion.authorId !== message.authorId) {
        if (rng.chance(0.75)) convo.openQuestion = null;
    }

    convo.recentSpeakers.push(message.authorId);
    if (convo.recentSpeakers.length > 6) convo.recentSpeakers.shift();
}

// Social consequences of a message: who warms to whom.
export function applySocialEffects(world, rng, agent, channel, composed) {
    if (!composed.targetId) return;
    const target = channel.messages.find((m) => m.id === composed.targetId);
    const otherId = target ? target.authorId : null;
    if (!otherId || otherId === agent.id) return;
    const other = world.agents[otherId];
    if (!other) return;

    const positive = ["agree", "softAgree", "hype", "support", "welcome", "answer", "callback"];
    const negative = ["disagree"];
    if (positive.includes(composed.move)) {
        agent.nudgeAffinity(otherId, rng.float(0.02, 0.08));
        other.nudgeAffinity(agent.id, rng.float(0.03, 0.1));
        other.nudgeMood(0.04, 0.02);
    } else if (negative.includes(composed.move)) {
        const sting = rng.float(0.01, 0.06);
        other.nudgeAffinity(agent.id, -sting * (1 - other.personality.agreeableness));
        other.nudgeMood(-0.05, 0.03);
        // Disagreement between people who like each other tends to bond them.
        if (agent.affinityTo(otherId) > 0.4) agent.nudgeAffinity(otherId, 0.01);
    }
}
