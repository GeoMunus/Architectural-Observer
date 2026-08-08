export const VISION_INTERFACE = "interface";
export const VISION_CAMERA = "camera";

export class World {
    constructor() {
        this.objects = [];
        this.events = [];
        this.memories = [];
        this.concepts = [];
        this.patterns = [];
        this.thoughts = [];
        this.goals = [];
        this.questions = [];
        this.cautions = [];
        this.actions = [];
        this.timeline = [];
        this.text = [];
        this.cycle = 0;
        this.lastUpdated = 0;
        this.telemetry = {
            averageConfidence: 0,
            averageImportance: 0,
            signalStrength: 0,
            motionScore: 0
        };
        this.device = {
            platform: "web",
            model: "",
            osVersion: "",
            orientation: "portrait",
            batteryLevel: null,
            charging: null
        };
        this.context = {
            scenario: "",
            mode: VISION_INTERFACE
        };
    }
}
