import { BaseAgent } from "./baseAgent.js";
import { Memory } from "../core/memory.js";

export class MemoryAgent extends BaseAgent {
    constructor() {
        super("Memory");
    }

    update(world) {
        const meaningfulEvents = world.events.filter((event) => event.type !== "ObservationStable");
        if (meaningfulEvents.length === 0 && world.cycle > 1) {
            return;
        }

        const memory = new Memory();
        memory.objects = world.objects.slice(0, 18);
        memory.events = world.events.slice(0, 12);
        memory.importance = Number(Math.min(1, (meaningfulEvents.length * 0.18) + (world.objects.length * 0.015)).toFixed(2));
        memory.confidence = Number(Math.min(1, 0.35 + (world.objects.length * 0.02)).toFixed(2));
        memory.summary = this.createSummary(world);
        memory.createdAt = new Date().toISOString();

        world.memories.unshift(memory);
        world.memories = world.memories.slice(0, 60);

        const totalImportance = world.memories.reduce((sum, item) => sum + (item.importance || 0), 0);
        const totalConfidence = world.memories.reduce((sum, item) => sum + (item.confidence || 0), 0);
        world.telemetry.averageImportance = Number((totalImportance / world.memories.length || 0).toFixed(2));
        world.telemetry.averageConfidence = Number((totalConfidence / world.memories.length || 0).toFixed(2));
    }

    createSummary(world) {
        const visible = world.objects
            .slice(0, 5)
            .map((obj) => obj.properties.text || obj.type)
            .filter(Boolean);
        const events = world.events
            .slice(0, 3)
            .map((event) => event.type);

        return {
            headline: visible.length > 0
                ? `Observed ${visible.slice(0, 3).join(", ")}`
                : `Observed ${world.objects.length} interface signals`,
            visible,
            events,
            mode: world.context.mode
        };
    }
}
