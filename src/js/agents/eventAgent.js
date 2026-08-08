import { BaseAgent } from "./baseAgent.js";
import { Event } from "../core/event.js";

export class EventAgent extends BaseAgent {
    constructor() {
        super("Event");
        this.previousSignature = "";
    }

    update(world) {
        if (world.objects.length === 0) {
            return;
        }

        const signature = world.objects
            .slice(0, 30)
            .map((obj) => `${obj.type}:${obj.properties.id || ""}:${obj.properties.text || ""}`)
            .join("|");

        if (this.previousSignature === "") {
            this.previousSignature = signature;
            world.events.push(new Event("InitialObservation", {
                objectCount: world.objects.length,
                mode: world.context.mode
            }));
            return;
        }

        if (signature !== this.previousSignature) {
            const delta = Math.abs(signature.length - this.previousSignature.length);
            this.previousSignature = signature;
            world.events.push(new Event("InterfaceChanged", {
                objectCount: world.objects.length,
                delta
            }));
        } else {
            world.events.push(new Event("ObservationStable", {
                objectCount: world.objects.length
            }));
        }
    }
}
