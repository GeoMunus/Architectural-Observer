import { Agent } from "./agent.js";

export const MAX_MESSAGES_PER_CHANNEL = 160;
export const MAX_LOG_ENTRIES = 160;

// The whole network in one serialisable object: who exists, where they talk,
// and what has been said. The simulation mutates this; the UI only reads it.

export class World {
    constructor(init = {}) {
        this.seed = init.seed || "nullspace";
        this.createdAt = init.createdAt || Date.now();
        // Simulated clock in minutes since world creation. One tick advances it,
        // which is what drives sleep schedules and timestamps.
        this.minute = init.minute || 8 * 60;
        this.agents = {};
        this.servers = init.servers || {};
        this.channels = init.channels || {};
        this.log = init.log || [];
        this.userId = init.userId || null;
        this.stats = init.stats || { messages: 0, joins: 0, serversFounded: 0 };

        for (const [id, raw] of Object.entries(init.agents || {})) {
            this.agents[id] = raw instanceof Agent ? raw : new Agent(raw);
        }
    }

    get agentList() {
        return Object.values(this.agents);
    }

    get serverList() {
        return Object.values(this.servers).sort((a, b) => a.createdAt - b.createdAt);
    }

    addAgent(agent) {
        this.agents[agent.id] = agent;
        return agent;
    }

    addServer(server) {
        this.servers[server.id] = server;
        return server;
    }

    addChannel(channel) {
        this.channels[channel.id] = channel;
        const server = this.servers[channel.serverId];
        if (server && !server.channelIds.includes(channel.id)) {
            server.channelIds.push(channel.id);
        }
        return channel;
    }

    channelsOf(serverId) {
        const server = this.servers[serverId];
        if (!server) return [];
        return server.channelIds.map((id) => this.channels[id]).filter(Boolean);
    }

    membersOf(serverId) {
        const server = this.servers[serverId];
        if (!server) return [];
        return server.memberIds.map((id) => this.agents[id]).filter(Boolean);
    }

    joinServer(agentId, serverId) {
        const server = this.servers[serverId];
        const agent = this.agents[agentId];
        if (!server || !agent) return false;
        if (server.memberIds.includes(agentId)) return false;
        server.memberIds.push(agentId);
        if (!agent.servers.includes(serverId)) agent.servers.push(serverId);
        this.stats.joins += 1;
        return true;
    }

    postMessage(message) {
        const channel = this.channels[message.channelId];
        if (!channel) return null;
        channel.messages.push(message);
        if (channel.messages.length > MAX_MESSAGES_PER_CHANNEL) {
            channel.messages.splice(0, channel.messages.length - MAX_MESSAGES_PER_CHANNEL);
        }
        channel.lastActivity = this.minute;
        this.stats.messages += 1;
        const author = this.agents[message.authorId];
        if (author) {
            author.messageCount += 1;
            author.lastSpokeAt = this.minute;
        }
        return message;
    }

    lastMessage(channelId) {
        const channel = this.channels[channelId];
        if (!channel || channel.messages.length === 0) return null;
        return channel.messages[channel.messages.length - 1];
    }

    note(kind, text, meta = {}) {
        this.log.push({ kind, text, minute: this.minute, at: Date.now(), ...meta });
        if (this.log.length > MAX_LOG_ENTRIES) {
            this.log.splice(0, this.log.length - MAX_LOG_ENTRIES);
        }
    }

    clockLabel() {
        const totalMinutes = Math.floor(this.minute);
        const hour = Math.floor(totalMinutes / 60) % 24;
        const minute = totalMinutes % 60;
        const day = Math.floor(totalMinutes / 1440) + 1;
        return {
            hour,
            day,
            text: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
        };
    }

    // Renders a simulated timestamp for a message, e.g. "day 2 · 14:07".
    stampFor(minute) {
        const total = Math.floor(minute);
        const hour = Math.floor(total / 60) % 24;
        const min = total % 60;
        const day = Math.floor(total / 1440) + 1;
        return { day, text: `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}` };
    }

    toJSON() {
        return {
            seed: this.seed,
            createdAt: this.createdAt,
            minute: this.minute,
            agents: this.agents,
            servers: this.servers,
            channels: this.channels,
            log: this.log,
            userId: this.userId,
            stats: this.stats
        };
    }
}

export function makeServer({ id, name, glyph, hue, domainId, description, ownerId, createdAt }) {
    return {
        id,
        name,
        glyph,
        hue,
        domainId,
        description,
        ownerId,
        createdAt,
        channelIds: [],
        memberIds: [],
        roles: {}, // agentId -> role label
        pinned: []
    };
}

export function makeChannel({ id, serverId, name, purpose, domainId, category, readOnly }) {
    return {
        id,
        serverId,
        name,
        purpose,
        domainId,
        category: category || "general",
        readOnly: Boolean(readOnly),
        messages: [],
        lastActivity: 0,
        unread: 0,
        // Live conversational state — what the room is currently "about".
        convo: {
            topic: null,
            heat: 0.2,
            turnsOnTopic: 0,
            openQuestion: null,
            recentSpeakers: []
        }
    };
}

export function makeMessage({ id, channelId, authorId, text, minute, replyTo, mentions, kind }) {
    return {
        id,
        channelId,
        authorId,
        text,
        minute,
        replyTo: replyTo || null,
        mentions: mentions || [],
        kind: kind || "chat",
        reactions: {}
    };
}
