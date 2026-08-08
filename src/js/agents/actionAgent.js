import { BaseAgent } from "./baseAgent.js";
import { VISION_CAMERA } from "../core/world.js";

export class ActionAgent extends BaseAgent {
    constructor() {
        super("Action");
    }

    update(world) {
        const actions = [];

        if (world.goals[0]) {
            actions.push(`Prioritize: ${world.goals[0].title}`);
        }

        if (world.context.mode !== VISION_CAMERA) {
            actions.push("Enable camera vision to observe the space around the device.");
        }

        if (world.events.some((event) => event.type === "LowLight")) {
            actions.push("Improve lighting or move closer before trusting the current frame.");
        }

        if (world.patterns[0]) {
            actions.push(`Inspect strongest pattern: ${world.patterns[0].name}.`);
        }

        if (world.questions[0]) {
            actions.push(`Resolve open question: ${world.questions[0]}`);
        }

        world.actions = actions.slice(0, 4);
    }
}
