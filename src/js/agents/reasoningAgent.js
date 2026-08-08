import { BaseAgent } from "./baseAgent.js";
import { VISION_CAMERA } from "../core/world.js";

export class ReasoningAgent extends BaseAgent {
    constructor() {
        super("Reasoning");
    }

    update(world) {
        const thoughts = [];
        const objectCount = world.objects.length;
        const recentEvents = world.events.map((event) => event.type);
        const hasInteractiveDensity = world.patterns.some((pattern) => /button|input|textarea/i.test(pattern.name));

        if (world.context.mode === VISION_CAMERA) {
            thoughts.push({
                id: "thought-camera-mode",
                type: "situational-awareness",
                message: "Camera vision is live, so the observer can reason about the physical space around the device instead of only its own interface.",
                priority: 86
            });
        }

        if (recentEvents.includes("LowLight")) {
            thoughts.push({
                id: "thought-low-light",
                type: "sensing-quality",
                message: "The scene is poorly lit, which suppresses contrast and makes zone-level conclusions less reliable.",
                priority: 74
            });
        }

        if (recentEvents.includes("DeviceMoved")) {
            thoughts.push({
                id: "thought-device-motion",
                type: "embodiment",
                message: "The handset is being carried or panned, so consecutive frames describe different vantage points rather than a changing scene.",
                priority: 80
            });
        }

        if (objectCount >= 12) {
            thoughts.push({
                id: "thought-dense-ui",
                type: "interface-density",
                message: `The scene carries ${objectCount} recognizable signals, enough to infer architectural hotspots.`,
                priority: 78
            });
        }

        if (hasInteractiveDensity) {
            thoughts.push({
                id: "thought-control-cluster",
                type: "interaction-surface",
                message: "Controls cluster around a few dominant interaction surfaces, suggesting a central orchestration panel.",
                priority: 72
            });
        }

        if (recentEvents.includes("InterfaceChanged") || recentEvents.includes("SceneChanged")) {
            thoughts.push({
                id: "thought-layout-change",
                type: "change-detection",
                message: "The observed structure changed between cycles, so the system should capture a fresh architectural snapshot.",
                priority: 84
            });
        }

        if (world.context.scenario) {
            thoughts.push({
                id: "thought-scenario-focus",
                type: "mission-focus",
                message: `Current mission focus: ${world.context.scenario.slice(0, 140)}`,
                priority: 68
            });
        }

        if (thoughts.length === 0) {
            thoughts.push({
                id: "thought-baseline",
                type: "baseline",
                message: "Signals are stable. Observer AO can keep collecting evidence before escalating any architectural interpretation.",
                priority: 50
            });
        }

        world.thoughts = thoughts.sort((a, b) => b.priority - a.priority).slice(0, 6);
    }
}
