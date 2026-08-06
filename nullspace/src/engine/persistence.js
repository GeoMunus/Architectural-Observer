import { World } from "../model/world.js";

const KEY = "nullspace.world.v1";

// A long-lived world holds far more scrollback than a resumed session needs,
// and the full transcript will outgrow the storage quota after a week or so of
// simulated time. Persist a shallow copy with the tail of each channel.
function pruned(world, keepPerChannel) {
    const raw = world.toJSON();
    const channels = {};
    for (const [id, channel] of Object.entries(raw.channels)) {
        channels[id] = { ...channel, messages: channel.messages.slice(-keepPerChannel) };
    }
    return { ...raw, channels };
}

export function saveWorld(world) {
    for (const keep of [70, 25, 8]) {
        try {
            localStorage.setItem(KEY, JSON.stringify(pruned(world, keep)));
            return true;
        } catch (error) {
            if (keep === 8) {
                // A network that can't save is still a network that runs.
                console.warn("nullspace: could not save world", error);
                return false;
            }
        }
    }
    return false;
}

export function loadWorld() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.agents) return null;
        return new World(parsed);
    } catch (error) {
        console.warn("nullspace: saved world was unreadable, starting fresh", error);
        return null;
    }
}

export function clearWorld() {
    try {
        localStorage.removeItem(KEY);
    } catch (error) {
        console.warn("nullspace: could not clear saved world", error);
    }
}
