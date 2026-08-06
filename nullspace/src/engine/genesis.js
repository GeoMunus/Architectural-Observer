import { Rng } from "../util/rng.js";
import { Agent, PRESENCE } from "../model/agent.js";
import { World, makeServer, makeChannel } from "../model/world.js";
import { DOMAINS, DOMAIN_BY_ID, COMMON_CHANNELS } from "../data/topics.js";
import {
    HANDLE_STEMS, HANDLE_SUFFIXES, HANDLE_PREFIXES, DISPLAY_MODIFIERS,
    SERVER_PREFIXES, SERVER_SUFFIXES, ROLE_NAMES, AVATAR_GLYPHS
} from "../data/names.js";
import {
    VOICE_PROFILES, BIO_TEMPLATES, TRAITS, STATUS_LINES, TIMEZONES
} from "../data/voice.js";
import { fillSlots } from "./language.js";

const usedHandles = new Set();

function makeHandle(rng) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        const prefix = rng.pick(HANDLE_PREFIXES);
        const stem = rng.pick(HANDLE_STEMS);
        const suffix = rng.pick(HANDLE_SUFFIXES);
        const joiner = prefix && rng.chance(0.4) ? "_" : "";
        const handle = `${prefix}${joiner}${stem}${suffix}`.toLowerCase();
        if (!usedHandles.has(handle) && handle.length > 3) {
            usedHandles.add(handle);
            return handle;
        }
    }
    const fallback = `${rng.pick(HANDLE_STEMS)}${rng.int(100, 999)}`;
    usedHandles.add(fallback);
    return fallback;
}

function makeDisplayName(handle, rng) {
    const base = handle.replace(/[_\d]+/g, " ").trim();
    const pretty = rng.chance(0.5)
        ? base.replace(/\b\w/g, (c) => c.toUpperCase())
        : base;
    return rng.chance(0.35) ? `${pretty} ${rng.pick(DISPLAY_MODIFIERS)}` : pretty;
}

export function createAgent(rng, options = {}) {
    const voice = options.voice || rng.pick(VOICE_PROFILES);
    const handle = options.handle || makeHandle(rng);
    const interestDomains = options.domains
        || rng.sample(DOMAINS, rng.weighted([
            { weight: 5, value: 1 }, { weight: 4, value: 2 }, { weight: 2, value: 3 }
        ]).value);

    const interests = {};
    interestDomains.forEach((domain, index) => {
        interests[domain.id] = Math.round(rng.float(index === 0 ? 0.6 : 0.25, 1) * 100) / 100;
    });

    const traits = rng.sample(TRAITS, rng.int(2, 3));
    const primary = interestDomains[0];
    const bio = fillSlots(rng.pick(BIO_TEMPLATES), {
        domainLabel: primary.label.toLowerCase(),
        niche: rng.pick(primary.lexicon.niche),
        thing: rng.pick(primary.lexicon.thing),
        things: rng.pick(primary.lexicon.thing),
        trait: traits[0],
        trait2: traits[1] || "tired",
        status: rng.pick(STATUS_LINES),
        timezone: rng.pick(TIMEZONES)
    }, rng);

    return new Agent({
        id: rng.id("a"),
        handle,
        displayName: options.displayName || makeDisplayName(handle, rng),
        glyph: rng.pick(AVATAR_GLYPHS),
        hue: rng.int(0, 359),
        voiceId: voice.id,
        bio,
        traits,
        timezone: rng.pick(TIMEZONES),
        peakHour: rng.int(0, 23),
        interests,
        personality: {
            talkativeness: Math.round(rng.gauss(0.5, 0.32, 0.08, 1) * 100) / 100,
            agreeableness: Math.round(rng.gauss(0.55, 0.3, 0.05, 1) * 100) / 100,
            curiosity: Math.round(rng.gauss(0.55, 0.3, 0.05, 1) * 100) / 100,
            humor: Math.round(rng.gauss(0.5, 0.33, 0, 1) * 100) / 100,
            warmth: Math.round(rng.gauss(0.55, 0.3, 0.05, 1) * 100) / 100,
            contrarian: Math.round(rng.gauss(0.3, 0.28, 0, 1) * 100) / 100,
            wpm: Math.round(voice.wpm * rng.float(0.85, 1.2))
        },
        mood: {
            valence: Math.round(rng.gauss(0.2, 0.35, -0.6, 0.9) * 100) / 100,
            energy: Math.round(rng.gauss(0.6, 0.3, 0.1, 1) * 100) / 100
        },
        presence: PRESENCE.OFFLINE
    });
}

function serverNameFor(domain, rng) {
    const style = rng.int(0, 3);
    const noun = rng.pick(domain.serverNouns);
    const suffix = rng.pick(SERVER_SUFFIXES);
    const prefix = rng.pick(SERVER_PREFIXES);
    if (style === 0) return `${noun} ${suffix}`.trim();
    if (style === 1) return `${prefix} ${noun} ${suffix}`.trim().replace(/\s+/g, " ");
    if (style === 2) return `${noun.toLowerCase()}-${suffix.toLowerCase()}`;
    return `${prefix} ${suffix}`.trim().replace(/\s+/g, " ");
}

export function createServer(world, rng, domain, founder, options = {}) {
    const server = makeServer({
        id: rng.id("s"),
        name: options.name || serverNameFor(domain, rng),
        glyph: domain.glyph,
        hue: rng.int(0, 359),
        domainId: domain.id,
        description: options.description || domain.blurb,
        ownerId: founder.id,
        createdAt: world.minute
    });
    world.addServer(server);

    const chosen = rng.sample(domain.channels, rng.int(3, Math.min(4, domain.channels.length)));
    const channelPlan = [
        { ...COMMON_CHANNELS[3], category: "welcome" },        // rules
        { ...COMMON_CHANNELS[1], category: "welcome" },        // introductions
        { ...COMMON_CHANNELS[0], category: "general" },        // general
        ...chosen.map((c) => ({ ...c, category: domain.label.toLowerCase() })),
        { ...COMMON_CHANNELS[2], category: "general" }         // off-topic
    ];

    for (const plan of channelPlan) {
        world.addChannel(makeChannel({
            id: rng.id("c"),
            serverId: server.id,
            name: plan.name,
            purpose: plan.purpose,
            domainId: domain.id,
            category: plan.category,
            readOnly: plan.readOnly
        }));
    }

    world.joinServer(founder.id, server.id);
    server.roles[founder.id] = "founder";
    world.stats.serversFounded += 1;
    return server;
}

function populateServer(world, rng, server, candidates, count) {
    const domain = DOMAIN_BY_ID[server.domainId];
    const ranked = candidates
        .filter((agent) => agent.id !== server.ownerId)
        .map((agent) => ({
            agent,
            weight: 0.05 + agent.interestIn(domain.id) * 3 + rng.float(0, 0.6)
        }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, count);

    for (const entry of ranked) {
        if (world.joinServer(entry.agent.id, server.id)) {
            server.roles[entry.agent.id] = rng.chance(0.12) ? "moderator" : rng.pick(ROLE_NAMES);
        }
    }
}

// Seeds mutual regard between people who share servers, so the very first
// conversations already have history behind them.
function seedRelationships(world, rng) {
    for (const server of world.serverList) {
        const members = world.membersOf(server.id);
        for (const a of members) {
            for (const b of members) {
                if (a.id === b.id) continue;
                if (!rng.chance(0.35)) continue;
                a.nudgeAffinity(b.id, rng.gauss(0.18, 0.35, -0.3, 0.7));
            }
        }
    }
}

export function bootstrapWorld(seed, options = {}) {
    usedHandles.clear();
    const rng = new Rng(seed);
    const world = new World({ seed: String(seed) });
    const agentCount = options.agentCount || 46;
    const serverCount = options.serverCount || 5;

    for (let i = 0; i < agentCount; i += 1) {
        world.addAgent(createAgent(rng));
    }

    const domainPool = rng.shuffle(DOMAINS).slice(0, serverCount);
    for (const domain of domainPool) {
        const founder = rng.weighted(
            world.agentList.map((agent) => ({
                weight: 0.1 + agent.interestIn(domain.id) * 4 + agent.personality.talkativeness,
                agent
            }))
        ).agent;
        const server = createServer(world, rng, domain, founder);
        populateServer(world, rng, server, world.agentList, rng.int(9, 18));
    }

    // Anyone who ended up in nothing gets pulled into the server closest to
    // their interests — a network with orphans reads as broken.
    for (const agent of world.agentList) {
        if (agent.servers.length > 0) continue;
        const best = world.serverList
            .map((server) => ({ server, score: agent.interestIn(server.domainId) + rng.float(0, 0.3) }))
            .sort((a, b) => b.score - a.score)[0];
        if (best) {
            world.joinServer(agent.id, best.server.id);
            best.server.roles[agent.id] = rng.pick(ROLE_NAMES);
        }
    }

    // Baseline so the UI can report servers the agents founded themselves,
    // separately from the ones the world started with.
    world.stats.initialServers = world.serverList.length;
    seedRelationships(world, rng);
    world.note("genesis", `network seeded — ${world.agentList.length} people, ${world.serverList.length} servers`);
    return { world, rng };
}

export function createUserAgent(world, rng, handle) {
    const agent = createAgent(rng, { handle: handle.toLowerCase().replace(/\s+/g, "_"), displayName: handle });
    agent.isHuman = true;
    agent.bio = "you";
    agent.presence = PRESENCE.ONLINE;
    world.addAgent(agent);
    world.userId = agent.id;
    for (const server of world.serverList) {
        world.joinServer(agent.id, server.id);
        server.roles[agent.id] = "newcomer";
    }
    return agent;
}
