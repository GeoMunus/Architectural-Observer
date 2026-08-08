import { BaseAgent } from "./baseAgent.js";
import { Thing } from "../core/thing.js";
import { Event } from "../core/event.js";

const STILL_THRESHOLD = 0.6;
const MOVEMENT_THRESHOLD = 2.4;

/**
 * Turns the handset itself into a sense organ: accelerometer, compass heading,
 * and orientation become observable signals alongside vision.
 */
export class SensorAgent extends BaseAgent {
    constructor() {
        super("Sensor");
        this.bound = false;
        this.available = false;
        this.acceleration = { x: 0, y: 0, z: 0 };
        this.magnitude = 0;
        this.peakMagnitude = 0;
        this.heading = null;
        this.tilt = { beta: 0, gamma: 0 };
        this.lastPosture = "";
    }

    bind() {
        if (this.bound) return;
        this.bound = true;

        // iOS gates these behind a user gesture; Android grants them outright.
        if (typeof DeviceMotionEvent !== "undefined") {
            window.addEventListener("devicemotion", (event) => {
                const source = event.accelerationIncludingGravity || event.acceleration;
                if (!source) return;
                this.available = true;
                this.acceleration = {
                    x: Number(source.x || 0),
                    y: Number(source.y || 0),
                    z: Number(source.z || 0)
                };
                const gravityCompensated = Math.abs(
                    Math.hypot(this.acceleration.x, this.acceleration.y, this.acceleration.z) - 9.81
                );
                this.magnitude = gravityCompensated;
                this.peakMagnitude = Math.max(this.peakMagnitude, gravityCompensated);
            }, { passive: true });
        }

        if (typeof DeviceOrientationEvent !== "undefined") {
            window.addEventListener("deviceorientation", (event) => {
                this.available = true;
                this.tilt = { beta: Number(event.beta || 0), gamma: Number(event.gamma || 0) };
                const heading = event.webkitCompassHeading ?? (event.alpha === null ? null : 360 - Number(event.alpha));
                this.heading = heading === null ? null : Number(heading.toFixed(0));
            }, { passive: true });
        }
    }

    async requestPermission() {
        // Only iOS implements this; on Android the call simply does not exist.
        if (typeof DeviceMotionEvent?.requestPermission === "function") {
            const state = await DeviceMotionEvent.requestPermission();
            return state === "granted";
        }
        return true;
    }

    describePosture() {
        const { beta } = this.tilt;
        if (Math.abs(beta) < 25) return "flat";
        if (beta > 65) return "upright";
        return "angled";
    }

    update(world) {
        this.bind();

        const orientation = window.screen?.orientation?.type
            || (window.innerHeight >= window.innerWidth ? "portrait-primary" : "landscape-primary");
        world.device.orientation = orientation.startsWith("portrait") ? "portrait" : "landscape";

        if (!this.available) {
            return;
        }

        const posture = this.describePosture();
        const peak = Number(this.peakMagnitude.toFixed(2));
        this.peakMagnitude = 0;

        world.objects.push(new Thing("Motion", {
            text: `Device ${peak > MOVEMENT_THRESHOLD ? "in motion" : peak > STILL_THRESHOLD ? "drifting" : "at rest"}`,
            peakAcceleration: peak,
            posture,
            heading: this.heading ?? "unknown",
            orientation: world.device.orientation
        }));

        if (peak > MOVEMENT_THRESHOLD) {
            world.events.push(new Event("DeviceMoved", { peakAcceleration: peak, posture }));
        } else if (peak < STILL_THRESHOLD) {
            world.events.push(new Event("DeviceStill", { posture }));
        }

        if (posture !== this.lastPosture) {
            if (this.lastPosture) {
                world.events.push(new Event("PostureChanged", { from: this.lastPosture, to: posture }));
            }
            this.lastPosture = posture;
        }
    }
}
