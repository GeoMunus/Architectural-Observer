import { VISION_CAMERA, VISION_INTERFACE, World } from "./core/world.js";
import { VisionAgent } from "./agents/visionAgent.js";
import { SensorAgent } from "./agents/sensorAgent.js";
import { EventAgent } from "./agents/eventAgent.js";
import { MemoryAgent } from "./agents/memoryAgent.js";
import { PatternAgent } from "./agents/patternAgent.js";
import { ConceptAgent } from "./agents/conceptAgent.js";
import { ReasoningAgent } from "./agents/reasoningAgent.js";
import { PlanningAgent } from "./agents/planningAgent.js";
import { CuriosityAgent } from "./agents/curiosityAgent.js";
import { SkepticAgent } from "./agents/skepticAgent.js";
import { ActionAgent } from "./agents/actionAgent.js";
import { GraphView } from "./ui/graph.js";
import { Renderer } from "./ui/render.js";
import { Shell } from "./ui/shell.js";
import {
    configureShell,
    ensureCameraPermission,
    exitApp,
    hideSplash,
    isNative,
    onAppStateChange,
    onBackButton,
    platform,
    readDeviceInfo,
    saveAndShareSnapshot,
    storage,
    tap
} from "./native/bridge.js";

const STORAGE_KEY = "observer.ao.snapshot.v3";
const MAX_TIMELINE = 40;
const AUTO_CYCLE_MS = 2500;
const SAMPLE_MISSION = "Observe this space as an architectural observer. Identify its main structural surfaces, recurring forms, the rhythm of openings and supports, and what a human should measure or photograph next.";

const elements = Object.fromEntries([
    "objectsList", "eventsList", "memoriesList", "conceptsList", "patternsList", "goalsList",
    "actionsList", "timelineList", "graphSvg", "agentLanes", "selectedNodeLabel", "selectedNodeType",
    "selectedNodeDetail", "visionStatus", "deviceStatus", "scenarioInput", "modeBadge", "cycleBadge",
    "signalBadge", "motionBadge", "visionChip", "graphChip", "objectsCount", "eventsCount",
    "memoriesCount", "conceptsCount", "thoughtsCount", "goalsCount", "toggleCameraBtn",
    "flipCameraBtn", "cameraStage", "cameraPreview", "cameraGrid", "exportMemoriesBtn",
    "importMemoriesBtn", "importMemoriesInput", "runCycleBtn", "autoCycleBtn", "loadSampleBtn",
    "clearBtn", "resetGraphBtn", "chatMessages", "chatInput", "sendChatBtn", "pulseBtn",
    "pulseDot", "pulseLabel", "chatSuggestions"
].map((id) => [id, document.getElementById(id)]));

const world = new World();
const visionAgent = new VisionAgent(document.body, { preview: elements.cameraPreview });
const sensorAgent = new SensorAgent();

const agents = [
    visionAgent,
    sensorAgent,
    new EventAgent(),
    new MemoryAgent(),
    new PatternAgent(),
    new ConceptAgent(),
    new ReasoningAgent(),
    new PlanningAgent(),
    new CuriosityAgent(),
    new SkepticAgent(),
    new ActionAgent()
];

const renderer = new Renderer(elements);
const shell = new Shell({
    onTabChange: (name) => {
        if (name === "graph") graphView.draw(world, graphView.selectedId);
    }
});
const graphView = new GraphView(elements.graphSvg, {
    onSelect: (node) => {
        renderer.updateInspector(node);
        persist();
    }
});

const uiState = {
    autoTimer: null,
    busy: false,
    resumeAutoOnForeground: false
};

/* ============================== PERSISTENCE ============================== */

function snapshotForStorage() {
    return {
        version: 3,
        exportedAt: new Date().toISOString(),
        context: world.context,
        memories: world.memories,
        timeline: world.timeline,
        cycle: world.cycle,
        telemetry: world.telemetry,
        selectedNodeId: graphView.selectedId,
        chat: renderer.readChatHistory()
    };
}

let persistTimer = null;

function persist() {
    // Cycles can fire every 2.5s; coalesce writes so storage is not the bottleneck.
    window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => {
        storage.set(STORAGE_KEY, JSON.stringify(snapshotForStorage()));
    }, 400);
}

function applySnapshot(data) {
    if (Array.isArray(data)) {
        world.memories = data.slice(0, 60);
        world.timeline.unshift(timelineItem("import", "Imported legacy memory array", `${data.length} memories restored from an older export format.`));
        return;
    }

    const source = data?.world || data;
    if (!source || typeof source !== "object") return;

    const mode = source.context?.mode === VISION_CAMERA ? VISION_CAMERA : VISION_INTERFACE;
    world.context = {
        scenario: source.context?.scenario || source.scenario || world.context.scenario || "",
        // Camera capture cannot resume itself across launches; always restore idle.
        mode: visionAgent.cameraMode ? mode : VISION_INTERFACE
    };
    world.memories = Array.isArray(source.memories) ? source.memories.slice(0, 60) : [];
    world.timeline = Array.isArray(source.timeline) ? source.timeline.slice(0, MAX_TIMELINE) : [];
    world.cycle = Number.isFinite(source.cycle) ? source.cycle : 0;
    world.telemetry = {
        averageConfidence: Number(source.telemetry?.averageConfidence || 0),
        averageImportance: Number(source.telemetry?.averageImportance || 0),
        signalStrength: Number(source.telemetry?.signalStrength || 0),
        motionScore: Number(source.telemetry?.motionScore || 0)
    };
    graphView.selectedId = source.selectedNodeId || "";

    if (elements.scenarioInput) {
        elements.scenarioInput.value = world.context.scenario;
    }

    const chat = Array.isArray(source.chat) ? source.chat : Array.isArray(source.chatSeed) ? source.chatSeed : null;
    if (chat) {
        renderer.clearChat();
        for (const item of chat.slice(-12)) {
            renderer.appendChatMessage(item.role, item.text);
        }
    }
}

/* ================================ CYCLES ================================ */

function timelineItem(type, title, detail) {
    return {
        id: `${type}-${crypto.randomUUID()}`,
        type,
        title,
        detail,
        time: new Date().toISOString()
    };
}

function pushTimelineFromWorld() {
    const items = [];

    for (const event of world.events.slice(0, 5)) {
        const detail = Object.entries(event.data || {})
            .slice(0, 3)
            .map(([key, value]) => `${key}: ${value}`)
            .join(" · ");
        items.push(timelineItem("event", event.type, detail || "Architectural signal observed."));
    }

    if (world.memories[0]?.summary?.headline) {
        items.push(timelineItem("memory", "Memory snapshot stored", world.memories[0].summary.headline));
    }

    if (world.goals[0]) {
        items.push(timelineItem("goal", world.goals[0].title, world.goals[0].rationale));
    }

    world.timeline = [...items, ...world.timeline].slice(0, MAX_TIMELINE);
}

function setPulse(state, label) {
    if (elements.pulseBtn) elements.pulseBtn.dataset.state = state;
    if (elements.pulseLabel) elements.pulseLabel.textContent = label;
}

function render() {
    renderer.renderMetrics(world);
    renderer.renderPanels(world);
    renderer.renderTimeline(world);
    renderer.renderLanes(world);
    renderer.renderCameraZones(world);

    const selected = graphView.draw(world, graphView.selectedId);
    renderer.updateInspector(selected);
    if (elements.graphChip) {
        elements.graphChip.textContent = `${graphView.nodes.length} nodes`;
    }
}

function runCycle() {
    if (uiState.busy) return;
    uiState.busy = true;

    try {
        world.context.scenario = elements.scenarioInput?.value?.trim() || world.context.scenario || "";
        world.events = [];
        world.lastUpdated = Date.now();
        world.cycle += 1;

        for (const agent of agents) {
            agent.update(world);
        }

        pushTimelineFromWorld();
        render();
        persist();

        if (!uiState.autoTimer) {
            setPulse("running", `Cycle ${world.cycle}`);
            window.setTimeout(() => {
                if (!uiState.autoTimer) setPulse("idle", "Idle");
            }, 700);
        } else {
            setPulse("auto", `Cycle ${world.cycle}`);
        }
    } finally {
        uiState.busy = false;
    }
}

function setAutoCycle(enabled) {
    if (enabled && !uiState.autoTimer) {
        uiState.autoTimer = window.setInterval(runCycle, AUTO_CYCLE_MS);
        elements.autoCycleBtn?.classList.add("is-active");
        if (elements.autoCycleBtn) elements.autoCycleBtn.textContent = "Stop Auto";
        setPulse("auto", "Auto");
        shell.toast("Auto cycle running every 2.5 seconds.");
        return;
    }

    if (!enabled && uiState.autoTimer) {
        window.clearInterval(uiState.autoTimer);
        uiState.autoTimer = null;
        elements.autoCycleBtn?.classList.remove("is-active");
        if (elements.autoCycleBtn) elements.autoCycleBtn.textContent = "Start Auto";
        setPulse("idle", "Idle");
    }
}

/* ================================ VISION ================================ */

function setVisionStatus(message) {
    if (elements.visionStatus) elements.visionStatus.textContent = message;
}

async function enableCamera() {
    setVisionStatus("Requesting camera access…");

    const granted = await ensureCameraPermission();
    if (!granted) {
        setVisionStatus("Camera permission denied. Grant camera access in Android settings to use camera vision.");
        shell.toast("Camera permission denied.");
        return;
    }

    try {
        await visionAgent.startCamera();
        world.context.mode = VISION_CAMERA;
        elements.cameraStage?.setAttribute("data-active", "true");
        if (elements.toggleCameraBtn) elements.toggleCameraBtn.textContent = "Stop Camera Vision";
        if (elements.flipCameraBtn) elements.flipCameraBtn.disabled = false;

        const info = visionAgent.getVisionInfo();
        setVisionStatus(`Camera vision live at ${info.width}×${info.height}. Frames are sampled on device; no image ever leaves the phone.`);
        await tap("medium");
        runCycle();
    } catch (error) {
        setVisionStatus(`Camera could not start: ${error.message}`);
        shell.toast("Camera unavailable.");
    }
}

function disableCamera() {
    visionAgent.stopCamera();
    world.context.mode = VISION_INTERFACE;
    elements.cameraStage?.setAttribute("data-active", "false");
    if (elements.toggleCameraBtn) elements.toggleCameraBtn.textContent = "Enable Camera Vision";
    if (elements.flipCameraBtn) elements.flipCameraBtn.disabled = true;
    setVisionStatus("Vision source: this app's interface. Enable the camera to observe the space around the device.");
    runCycle();
}

/* ============================== SNAPSHOTS =============================== */

async function exportSnapshot() {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `observer-ao-snapshot-${stamp}.json`;

    try {
        const result = await saveAndShareSnapshot(fileName, JSON.stringify(snapshotForStorage(), null, 2));
        shell.toast(result.shared ? "Snapshot shared." : `Snapshot saved to ${fileName}`);
    } catch (error) {
        shell.toast(`Export failed: ${error.message}`);
    }
}

async function importSnapshot(file) {
    const text = await file.text();
    applySnapshot(JSON.parse(text));
    world.timeline.unshift(timelineItem("import", "Snapshot imported", "State, memories, and timeline were restored from a file."));
    world.timeline = world.timeline.slice(0, MAX_TIMELINE);
    render();
    persist();
    shell.toast("Snapshot imported.");
}

function resetPrototype() {
    Object.assign(world, {
        objects: [], events: [], memories: [], concepts: [], patterns: [], thoughts: [],
        goals: [], questions: [], cautions: [], actions: [], timeline: [], text: [],
        cycle: 0, lastUpdated: 0
    });
    world.telemetry = { averageConfidence: 0, averageImportance: 0, signalStrength: 0, motionScore: 0 };
    world.context = {
        scenario: elements.scenarioInput?.value?.trim() || "",
        mode: visionAgent.cameraMode ? VISION_CAMERA : VISION_INTERFACE
    };
    graphView.selectedId = "";
    graphView.reset();

    renderer.clearChat();
    renderer.appendChatMessage("observer", "Observer AO reset. Set a mission, run a cycle, or enable camera vision to start rebuilding the model.");
    render();
    persist();
    shell.toast("Prototype reset.");
}

/* ================================= CHAT ================================= */

function summarizeWorld() {
    const topConcepts = world.concepts.slice(0, 4).map((item) => item.name).join(", ") || "no stable concepts yet";
    const topPattern = world.patterns[0]?.name || "no dominant pattern";
    const topGoal = world.goals[0]?.title || "continue observation";
    const source = world.context.mode === VISION_CAMERA ? "the camera" : "my own interface";
    return `Through ${source} I currently see ${world.objects.length} objects, ${world.events.length} events this cycle, and ${world.memories.length} persisted memories. Top concepts: ${topConcepts}. Strongest pattern: ${topPattern}. Recommended next focus: ${topGoal}.`;
}

function generateObserverReply(input) {
    const text = input.toLowerCase();

    if (text.includes("what") && (text.includes("see") || text.includes("observe"))) {
        return summarizeWorld();
    }

    if (text.includes("architecture") || text.includes("system") || text.includes("structure")) {
        const thought = world.thoughts[0]?.message || "The architectural picture is still emerging.";
        const pattern = world.patterns[0]?.description || "No repeated structure dominates yet.";
        return `${thought} ${pattern}`;
    }

    if (text.includes("next") || text.includes("action") || text.includes("do")) {
        return world.actions.length > 0
            ? `Recommended actions: ${world.actions.join(" ")}`
            : "I need another analysis cycle before recommending concrete actions.";
    }

    if (text.includes("risk") || text.includes("skeptic") || text.includes("uncertain")) {
        return world.cautions.length > 0
            ? `Current cautions: ${world.cautions.join(" ")}`
            : "No major cautions at the moment, though conclusions stay provisional until more evidence arrives.";
    }

    if (text.includes("camera") || text.includes("vision") || text.includes("light")) {
        const info = visionAgent.getVisionInfo();
        return info.cameraMode
            ? `Camera vision is live at ${info.width}×${info.height} using the ${info.facingMode === "user" ? "front" : "rear"} lens, sampling ${info.pointCount} zones with a motion score of ${info.motionScore}.`
            : "Camera vision is off, so I only see my own interface. Enable it on the Observe tab to read the room.";
    }

    if (text.includes("goal") || text.includes("priority")) {
        return world.goals.length > 0
            ? `Top goal: ${world.goals[0].title}. Reason: ${world.goals[0].rationale}`
            : "No active goal has been synthesized yet.";
    }

    if (text.includes("mission") || text.includes("scenario")) {
        return world.context.scenario
            ? `Current mission brief: ${world.context.scenario}`
            : "No mission brief is set yet. Use the Mission Brief panel on the Observe tab to guide me.";
    }

    return `${summarizeWorld()} Ask about architecture, goals, risks, the camera, or next actions for a more targeted answer.`;
}

function handleChatSend(preset) {
    const value = (preset ?? elements.chatInput?.value ?? "").trim();
    if (!value) return;

    renderer.appendChatMessage("user", value);
    renderer.appendChatMessage("observer", generateObserverReply(value));
    if (!preset && elements.chatInput) elements.chatInput.value = "";
    persist();
    tap("light");
}

/* ================================ WIRING ================================ */

elements.runCycleBtn?.addEventListener("click", () => {
    runCycle();
    tap("light");
});

elements.pulseBtn?.addEventListener("click", () => {
    runCycle();
    tap("light");
});

elements.autoCycleBtn?.addEventListener("click", () => setAutoCycle(!uiState.autoTimer));

elements.loadSampleBtn?.addEventListener("click", () => {
    if (elements.scenarioInput) elements.scenarioInput.value = SAMPLE_MISSION;
    world.context.scenario = SAMPLE_MISSION;
    renderer.appendChatMessage("observer", "Sample mission loaded. Run a cycle to generate a fresh architectural interpretation.");
    persist();
    shell.toast("Sample mission loaded.");
});

elements.clearBtn?.addEventListener("click", resetPrototype);

elements.toggleCameraBtn?.addEventListener("click", () => {
    if (visionAgent.cameraMode) {
        disableCamera();
    } else {
        enableCamera();
    }
});

elements.flipCameraBtn?.addEventListener("click", async () => {
    try {
        const facing = await visionAgent.flipCamera();
        shell.toast(`Switched to the ${facing === "user" ? "front" : "rear"} camera.`);
        runCycle();
    } catch (error) {
        shell.toast(`Could not switch camera: ${error.message}`);
    }
});

elements.resetGraphBtn?.addEventListener("click", () => {
    graphView.reset();
    shell.toast("Graph recentered.");
});

elements.exportMemoriesBtn?.addEventListener("click", exportSnapshot);

elements.importMemoriesBtn?.addEventListener("click", () => elements.importMemoriesInput?.click());

elements.importMemoriesInput?.addEventListener("change", async () => {
    const [file] = elements.importMemoriesInput.files || [];
    if (!file) return;
    try {
        await importSnapshot(file);
    } catch {
        shell.toast("Import failed. Choose a valid Observer AO snapshot file.");
    } finally {
        elements.importMemoriesInput.value = "";
    }
});

elements.sendChatBtn?.addEventListener("click", () => handleChatSend());

elements.chatInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        handleChatSend();
    }
});

elements.chatSuggestions?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-prompt]");
    if (button) handleChatSend(button.dataset.prompt);
});

// Android's back button walks back to Observe before it is allowed to leave the app.
let backPressedAt = 0;
onBackButton(() => {
    if (shell.activeTab !== "observe") {
        shell.showTab("observe");
        return;
    }

    const now = Date.now();
    if (now - backPressedAt < 2000) {
        exitApp();
        return;
    }

    backPressedAt = now;
    shell.toast("Press back again to exit.");
});

// Camera and timers must not keep running while the app sits in the background.
onAppStateChange(({ isActive }) => {
    if (!isActive) {
        uiState.resumeAutoOnForeground = Boolean(uiState.autoTimer);
        setAutoCycle(false);
        if (visionAgent.cameraMode) {
            disableCamera();
            shell.toast("Camera released while the app was in the background.");
        }
        return;
    }

    if (uiState.resumeAutoOnForeground) {
        uiState.resumeAutoOnForeground = false;
        setAutoCycle(true);
    }
});

/* ================================ BOOT ================================== */

async function boot() {
    await configureShell();

    const restored = await storage.get(STORAGE_KEY);
    if (restored) {
        try {
            applySnapshot(JSON.parse(restored));
        } catch {
            // A corrupt snapshot should never stop the app from starting.
        }
    }

    if (elements.scenarioInput && !elements.scenarioInput.value) {
        elements.scenarioInput.value = world.context.scenario || SAMPLE_MISSION;
        world.context.scenario = elements.scenarioInput.value;
    }

    const info = await readDeviceInfo();
    world.device = { ...world.device, ...info };
    if (elements.deviceStatus) {
        elements.deviceStatus.textContent = isNative
            ? `Running natively on ${info.model || platform} · ${info.osVersion}${info.batteryLevel === null ? "" : ` · battery ${info.batteryLevel}%`}. Snapshots export to Documents.`
            : "Running in a browser. Install the APK for camera vision, sensors, and native sharing.";
    }

    if (renderer.readChatHistory().length === 0) {
        renderer.appendChatMessage("observer", isNative
            ? "Observer AO online. Enable camera vision to read the space around you, or run a cycle to observe this interface."
            : "Observer AO online. Run a cycle to observe this interface.");
    }

    if (!visionAgent.supportsCamera && elements.toggleCameraBtn) {
        elements.toggleCameraBtn.disabled = true;
        setVisionStatus("No camera is available to this app; the observer will read its own interface instead.");
    }

    setPulse("idle", "Idle");
    runCycle();
    await hideSplash();
}

window.observerWorld = world;
boot();
