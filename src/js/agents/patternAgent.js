import { BaseAgent } from "./baseAgent.js";

export class PatternAgent extends BaseAgent {
    constructor() {
        super("Pattern");
    }

    update(world) {
        const objectCounts = new Map();
        const eventCounts = new Map();

        for (const obj of world.objects) {
            const key = obj.type;
            objectCounts.set(key, (objectCounts.get(key) || 0) + 1);
        }

        for (const memory of world.memories.slice(0, 8)) {
            for (const event of memory.events || []) {
                eventCounts.set(event.type, (eventCounts.get(event.type) || 0) + 1);
            }
        }

        const patterns = [];

        for (const [type, count] of [...objectCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
            patterns.push({
                id: `pattern-object-${type.toLowerCase()}`,
                name: `${type} cluster`,
                score: count,
                description: `${count} ${type.toLowerCase()} signals are visible in the current scene.`
            });
        }

        for (const [type, count] of [...eventCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)) {
            patterns.push({
                id: `pattern-event-${type.toLowerCase()}`,
                name: `${type} rhythm`,
                score: count,
                description: `${type} has appeared ${count} times in recent memory snapshots.`
            });
        }

        world.patterns = patterns.slice(0, 8);
        world.telemetry.signalStrength = patterns.reduce((sum, pattern) => sum + pattern.score, 0);
    }
}
