import { BaseAgent } from "./baseAgent.js";

function tokenize(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length >= 4);
}

export class ConceptAgent extends BaseAgent {
    constructor() {
        super("Concept");
    }

    update(world) {
        const scores = new Map();

        for (const obj of world.objects) {
            scores.set(obj.type, (scores.get(obj.type) || 0) + 3);
            for (const token of tokenize(obj.properties.text)) {
                scores.set(token, (scores.get(token) || 0) + 1);
            }
        }

        for (const pattern of world.patterns) {
            scores.set(pattern.name, (scores.get(pattern.name) || 0) + Math.max(2, pattern.score));
        }

        if (world.context.scenario) {
            for (const token of tokenize(world.context.scenario)) {
                scores.set(token, (scores.get(token) || 0) + 2);
            }
        }

        world.concepts = [...scores.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 16)
            .map(([name, score], index) => ({
                id: `concept-${index}-${name.toLowerCase().replace(/\s+/g, "-")}`,
                name,
                score,
                description: `Concept confidence ${score}`
            }));
    }
}
