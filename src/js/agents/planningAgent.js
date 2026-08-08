import { BaseAgent } from "./baseAgent.js";

export class PlanningAgent extends BaseAgent {
    constructor() {
        super("Planning");
    }

    update(world) {
        const goals = [];

        for (const thought of world.thoughts.slice(0, 4)) {
            let nextStep = "Continue observation";

            if (thought.type === "change-detection") {
                nextStep = "Capture differential snapshot";
            } else if (thought.type === "interaction-surface") {
                nextStep = "Map control hierarchy";
            } else if (thought.type === "mission-focus") {
                nextStep = "Align outputs to mission brief";
            } else if (thought.type === "situational-awareness") {
                nextStep = "Audit camera telemetry";
            } else if (thought.type === "embodiment") {
                nextStep = "Hold the device steady";
            } else if (thought.type === "sensing-quality") {
                nextStep = "Improve capture conditions";
            }

            goals.push({
                id: `goal-${thought.id}`,
                title: nextStep,
                rationale: thought.message,
                priority: thought.priority,
                status: thought.priority >= 80 ? "urgent" : "queued"
            });
        }

        if (goals.length === 0) {
            goals.push({
                id: "goal-baseline",
                title: "Collect baseline snapshot",
                rationale: "No urgent reasoning signals are present yet.",
                priority: 40,
                status: "queued"
            });
        }

        world.goals = goals.sort((a, b) => b.priority - a.priority).slice(0, 5);
    }
}
