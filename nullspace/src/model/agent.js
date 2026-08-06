import { clamp } from "../util/rng.js";

// An inhabitant of the network. Everything here is cheap state that the
// dialogue engine reads to decide whether this agent speaks, what they say and
// how warmly they say it.

export const PRESENCE = {
    ONLINE: "online",
    IDLE: "idle",
    DND: "dnd",
    OFFLINE: "offline"
};

export class Agent {
    constructor(init) {
        Object.assign(this, {
            id: init.id,
            handle: init.handle,
            displayName: init.displayName,
            glyph: init.glyph,
            hue: init.hue,
            voiceId: init.voiceId,
            bio: init.bio,
            traits: init.traits || [],
            timezone: init.timezone,
            // Hour of the simulated day this agent is most likely to be around.
            peakHour: init.peakHour,
            interests: init.interests || {}, // domainId -> 0..1
            personality: init.personality,
            mood: init.mood || { valence: 0.15, energy: 0.6 },
            presence: init.presence || PRESENCE.OFFLINE,
            servers: init.servers || [],
            relationships: init.relationships || {}, // agentId -> -1..1
            joinedAt: init.joinedAt || 0,
            messageCount: init.messageCount || 0,
            lastSpokeAt: init.lastSpokeAt || 0,
            isHuman: Boolean(init.isHuman)
        });
    }

    interestIn(domainId) {
        return this.interests[domainId] || 0;
    }

    affinityTo(agentId) {
        if (agentId === this.id) return 1;
        return this.relationships[agentId] || 0;
    }

    nudgeAffinity(agentId, delta) {
        if (agentId === this.id) return;
        const next = clamp(this.affinityTo(agentId) + delta, -1, 1);
        this.relationships[agentId] = Math.round(next * 1000) / 1000;
    }

    nudgeMood(valenceDelta, energyDelta = 0) {
        this.mood.valence = clamp(this.mood.valence + valenceDelta, -1, 1);
        this.mood.energy = clamp(this.mood.energy + energyDelta, 0, 1);
    }

    // Bell curve around the agent's peak hour, wrapping across midnight.
    wakefulnessAt(hour) {
        let distance = Math.abs(hour - this.peakHour);
        if (distance > 12) distance = 24 - distance;
        const width = 5 + this.personality.talkativeness * 3;
        return Math.exp(-(distance * distance) / (2 * width * width / 4));
    }

    friends(limit = 5) {
        return Object.entries(this.relationships)
            .filter(([, value]) => value > 0.25)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit);
    }

    // Long messages take longer to appear, which is most of what sells the
    // typing indicator.
    typingMillisFor(text) {
        const words = Math.max(1, text.split(/\s+/).length);
        const perWord = 60000 / this.personality.wpm;
        return clamp(words * perWord * 0.75, 600, 9000);
    }

    toJSON() {
        return { ...this };
    }
}

export function moodLabel(agent) {
    const { valence, energy } = agent.mood;
    if (valence > 0.45 && energy > 0.6) return "buzzing";
    if (valence > 0.35) return "cheerful";
    if (valence < -0.4) return "prickly";
    if (valence < -0.15) return "flat";
    if (energy < 0.3) return "tired";
    if (energy > 0.75) return "restless";
    return "level";
}

export function presenceRank(presence) {
    return { online: 0, idle: 1, dnd: 2, offline: 3 }[presence] ?? 4;
}
