import { BaseAgent } from "./baseAgent.js";
import { VISION_CAMERA } from "../core/world.js";

export class CuriosityAgent extends BaseAgent {
    constructor() {
        super("Curiosity");
    }

    update(world) {
        const questions = [];

        if (world.context.mode !== VISION_CAMERA) {
            questions.push("Would camera vision reveal architecture in the room that the app's own interface cannot show?");
        }

        if (world.patterns.length < 3) {
            questions.push("Are there enough repeated structures yet to identify stable subsystems?");
        }

        if ((world.context.scenario || "").trim().length === 0) {
            questions.push("What mission or architecture should Observer AO optimize for next?");
        }

        if (world.context.mode === VISION_CAMERA && world.telemetry.motionScore < 1) {
            questions.push("The frame is almost static — is this a fixed vantage point or has the scene simply stopped changing?");
        }

        if (world.objects.some((obj) => obj.type === "INPUT")) {
            questions.push("Which inputs are operational controls versus passive telemetry fields?");
        }

        world.questions = questions.slice(0, 4);
    }
}
