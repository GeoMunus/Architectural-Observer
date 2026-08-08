import { BaseAgent } from "./baseAgent.js";
import { VISION_CAMERA } from "../core/world.js";

export class SkepticAgent extends BaseAgent {
    constructor() {
        super("Skeptic");
    }

    update(world) {
        const cautions = [];

        if (world.context.mode !== VISION_CAMERA) {
            cautions.push("Visibility is limited to this app's own interface, so nothing about the surrounding environment is part of the model.");
        }

        if (world.events.some((event) => event.type === "LowLight")) {
            cautions.push("Low light is flattening the frame; brightness zones may describe the sensor's noise floor rather than the scene.");
        }

        if (world.events.some((event) => event.type === "DeviceMoved")) {
            cautions.push("The device moved during capture, so frame-to-frame differences conflate camera motion with real change.");
        }

        if (world.telemetry.averageConfidence < 0.55 && world.memories.length > 0) {
            cautions.push("Memory confidence is still moderate; avoid overfitting conclusions from a small number of snapshots.");
        }

        if (world.events.some((event) => event.type === "InterfaceChanged")) {
            cautions.push("Recent interface change detected; prior inferences may already be stale.");
        }

        if (world.patterns.length === 0) {
            cautions.push("No durable patterns are visible yet, so architecture narratives remain provisional.");
        }

        world.cautions = cautions.slice(0, 4);
    }
}
