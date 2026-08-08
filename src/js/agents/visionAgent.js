import { BaseAgent } from "./baseAgent.js";
import { Thing } from "../core/thing.js";
import { Event } from "../core/event.js";
import { VISION_CAMERA, VISION_INTERFACE } from "../core/world.js";

/**
 * On Android there is no getDisplayMedia, so the observer's outward-facing eye is
 * the device camera. Frames are downsampled to a small grid; only the derived
 * brightness numbers ever leave this class, never the pixels themselves.
 */
export class VisionAgent extends BaseAgent {
    constructor(root = document.body, options = {}) {
        super("Vision");
        this.root = root;
        this.preview = options.preview || null;
        this.bound = false;
        this.interactionQueue = [];
        this.systemQueue = [];
        this.cameraMode = false;
        this.stream = null;
        this.facingMode = "environment";
        this.video = document.createElement("video");
        this.video.muted = true;
        this.video.playsInline = true;
        this.video.setAttribute("playsinline", "");
        this.video.autoplay = true;
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
        this.previousSample = null;
        this.lastPointCount = 0;
        this.lastMotionScore = 0;
    }

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    get supportsCamera() {
        return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    async startCamera(facingMode = this.facingMode) {
        if (!this.supportsCamera) {
            throw new Error("This device does not expose a camera to the app.");
        }

        this.stopCamera({ silent: true });
        this.facingMode = facingMode;

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: facingMode },
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 15, max: 24 }
            },
            audio: false
        });

        this.stream = stream;
        this.video.srcObject = stream;
        await this.video.play();

        if (this.preview) {
            this.preview.srcObject = stream;
            this.preview.play().catch(() => {
                // Autoplay rejection only affects the on-screen preview, not the analysis.
            });
        }

        this.cameraMode = true;
        this.previousSample = null;

        const [track] = stream.getVideoTracks();
        if (track) {
            track.addEventListener("ended", () => {
                this.stopCamera();
                this.systemQueue.push({ type: "CameraVisionStopped", data: { reason: "track-ended" } });
            });
        }

        this.systemQueue.push({ type: "CameraVisionStarted", data: { facingMode } });
    }

    stopCamera({ silent = false } = {}) {
        if (this.stream) {
            for (const track of this.stream.getTracks()) {
                track.stop();
            }
        }

        if (this.preview) {
            this.preview.srcObject = null;
        }

        this.stream = null;
        this.video.srcObject = null;
        this.cameraMode = false;
        this.previousSample = null;
        this.lastPointCount = 0;
        this.lastMotionScore = 0;

        if (!silent) {
            this.systemQueue.push({ type: "CameraVisionStopped", data: { reason: "stopped" } });
        }
    }

    async flipCamera() {
        const next = this.facingMode === "environment" ? "user" : "environment";
        await this.startCamera(next);
        return next;
    }

    getVisionInfo() {
        const track = this.stream?.getVideoTracks?.()[0];
        const settings = track?.getSettings ? track.getSettings() : {};

        return {
            cameraMode: this.cameraMode,
            facingMode: settings.facingMode || this.facingMode,
            width: settings.width || this.video.videoWidth || 0,
            height: settings.height || this.video.videoHeight || 0,
            frameRate: Math.round(settings.frameRate || 0),
            pointCount: this.lastPointCount,
            motionScore: this.lastMotionScore
        };
    }

    analyzeFrame(world) {
        if (!this.ctx) return;
        if (this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

        const sourceWidth = this.video.videoWidth || 0;
        const sourceHeight = this.video.videoHeight || 0;
        if (sourceWidth === 0 || sourceHeight === 0) return;

        const sampleWidth = 160;
        const sampleHeight = Math.max(90, Math.round((sourceHeight / sourceWidth) * sampleWidth));
        this.canvas.width = sampleWidth;
        this.canvas.height = sampleHeight;

        this.ctx.drawImage(this.video, 0, 0, sampleWidth, sampleHeight);
        const { data } = this.ctx.getImageData(0, 0, sampleWidth, sampleHeight);
        const pixels = sampleWidth * sampleHeight;
        const luma = new Float32Array(pixels);

        let totalLuma = 0;
        let diff = 0;

        for (let index = 0; index < pixels; index += 1) {
            const offset = index * 4;
            const value = (0.299 * data[offset]) + (0.587 * data[offset + 1]) + (0.114 * data[offset + 2]);
            luma[index] = value;
            totalLuma += value;
            if (this.previousSample) {
                diff += Math.abs(value - this.previousSample[index]);
            }
        }

        const averageLuma = totalLuma / pixels;
        const averageDiff = this.previousSample ? diff / pixels : 0;

        let variance = 0;
        for (let index = 0; index < pixels; index += 1) {
            variance += (luma[index] - averageLuma) ** 2;
        }
        const contrast = Math.sqrt(variance / pixels);

        this.lastMotionScore = Number(averageDiff.toFixed(2));
        this.previousSample = luma;

        world.objects.push(new Thing("Frame", {
            text: `Camera frame · ${this.facingMode === "user" ? "front" : "rear"}`,
            width: sourceWidth,
            height: sourceHeight,
            averageLuma: Number(averageLuma.toFixed(2)),
            contrast: Number(contrast.toFixed(2)),
            motionScore: this.lastMotionScore
        }));

        const gridCols = 6;
        const gridRows = 8;
        const cellWidth = sampleWidth / gridCols;
        const cellHeight = sampleHeight / gridRows;
        let brightestZone = null;

        for (let row = 0; row < gridRows; row += 1) {
            for (let col = 0; col < gridCols; col += 1) {
                let cellTotal = 0;
                let cellCount = 0;

                const startX = Math.floor(col * cellWidth);
                const endX = Math.min(sampleWidth, Math.floor((col + 1) * cellWidth));
                const startY = Math.floor(row * cellHeight);
                const endY = Math.min(sampleHeight, Math.floor((row + 1) * cellHeight));

                for (let y = startY; y < endY; y += 1) {
                    for (let x = startX; x < endX; x += 1) {
                        cellTotal += luma[(y * sampleWidth) + x];
                        cellCount += 1;
                    }
                }

                const brightness = cellCount > 0 ? cellTotal / cellCount : 0;
                if (!brightestZone || brightness > brightestZone.brightness) {
                    brightestZone = { row: row + 1, col: col + 1, brightness };
                }

                world.objects.push(new Thing("Zone", {
                    text: `Zone ${row + 1}-${col + 1}`,
                    row: row + 1,
                    col: col + 1,
                    brightness: Number(brightness.toFixed(2)),
                    tone: brightness > 170 ? "bright" : brightness > 85 ? "mid" : "dark"
                }));
            }
        }

        this.lastPointCount = gridCols * gridRows;
        world.telemetry.motionScore = this.lastMotionScore;

        if (averageDiff > 6) {
            world.events.push(new Event("SceneChanged", { motionScore: this.lastMotionScore }));
        }

        if (averageLuma < 35) {
            world.events.push(new Event("LowLight", { averageLuma: Number(averageLuma.toFixed(2)) }));
        }

        world.events.push(new Event("FrameSampled", {
            zones: this.lastPointCount,
            width: sourceWidth,
            height: sourceHeight,
            contrast: Number(contrast.toFixed(2)),
            brightestZone: brightestZone ? `${brightestZone.row}-${brightestZone.col}` : "none"
        }));
    }

    bindEvents() {
        if (this.bound) return;

        this.root.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            const control = target.closest("button, a, [data-tab], input, textarea");
            if (!control) return;
            this.interactionQueue.push({
                type: "Tap",
                data: {
                    tag: control.tagName,
                    id: control.id || "",
                    label: (control.textContent || control.getAttribute("aria-label") || "").trim().slice(0, 48)
                }
            });
        });

        this.root.addEventListener("input", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
            this.interactionQueue.push({
                type: "Input",
                data: {
                    tag: target.tagName,
                    id: target.id || "",
                    valueLength: target.value.length
                }
            });
        });

        window.addEventListener("scroll", () => {
            this.interactionQueue.push({ type: "Scroll", data: { y: Math.round(window.scrollY) } });
        }, { passive: true, capture: true });

        this.bound = true;
    }

    collectDomObjects(world) {
        const selectors = [
            "button",
            "input",
            "textarea",
            "select",
            "a",
            "section",
            "article",
            "h1",
            "h2",
            "[data-agent-card]",
            "[data-list-panel]"
        ];

        const candidates = this.root.querySelectorAll(selectors.join(","));
        const textSignals = [];

        for (const element of candidates) {
            if (element.closest("[hidden]") || element.hasAttribute("hidden")) continue;

            const text = (element.textContent || element.getAttribute("aria-label") || "")
                .trim()
                .replace(/\s+/g, " ")
                .slice(0, 80);

            if (text.length > 0) {
                textSignals.push(text);
            }

            world.objects.push(new Thing(element.tagName, {
                text,
                id: element.id || "",
                className: typeof element.className === "string" ? element.className : "",
                role: element.getAttribute("role") || "",
                disabled: "disabled" in element ? Boolean(element.disabled) : false
            }));
        }

        world.text = textSignals.slice(0, 40);
    }

    update(world) {
        this.bindEvents();
        world.objects = [];
        world.text = [];
        world.context.mode = this.cameraMode ? VISION_CAMERA : VISION_INTERFACE;

        if (this.cameraMode) {
            this.analyzeFrame(world);
        } else {
            this.collectDomObjects(world);
            world.telemetry.motionScore = 0;
        }

        while (this.systemQueue.length > 0) {
            const item = this.systemQueue.shift();
            world.events.push(new Event(item.type, item.data));
        }

        while (this.interactionQueue.length > 0) {
            const item = this.interactionQueue.shift();
            world.events.push(new Event(item.type, item.data));
        }
    }
}
