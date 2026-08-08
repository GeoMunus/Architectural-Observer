import { compactText, describeEventData, formatTime } from "./format.js";
import { VISION_CAMERA } from "../core/world.js";

/**
 * All rendering builds nodes with textContent rather than innerHTML: observed text
 * comes from the DOM, the camera, and imported files, so it is never trusted markup.
 */

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function renderList(target, entries, fallbackText, formatter) {
    if (!target) return;
    const fragment = document.createDocumentFragment();

    if (!entries || entries.length === 0) {
        const li = element("li");
        li.appendChild(element("span", "item-title", fallbackText));
        fragment.appendChild(li);
        target.replaceChildren(fragment);
        return;
    }

    for (const entry of entries) {
        const { title, subtle } = formatter(entry);
        const li = element("li");
        li.appendChild(element("span", "item-title", title));
        if (subtle) li.appendChild(element("span", "item-subtle", subtle));
        fragment.appendChild(li);
    }

    target.replaceChildren(fragment);
}

export class Renderer {
    constructor(elements) {
        this.elements = elements;
        this.laneDefinitions = [
            {
                key: "vision",
                label: "Vision",
                description: "Senses the camera feed or the app's own interface.",
                value: (world) => `${world.objects.length} objects · ${world.context.mode}`
            },
            {
                key: "memory",
                label: "Memory",
                description: "Stores snapshots with confidence and importance.",
                value: (world) => `${world.memories.length} memories · confidence ${world.telemetry.averageConfidence}`
            },
            {
                key: "pattern",
                label: "Pattern",
                description: "Extracts recurring structures and rhythms.",
                value: (world) => `${world.patterns.length} active patterns`
            },
            {
                key: "reasoning",
                label: "Reasoning",
                description: "Converts signals into architectural interpretation.",
                value: (world) => `${world.thoughts.length} thoughts · ${world.cautions.length} cautions`
            },
            {
                key: "planning",
                label: "Planning",
                description: "Ranks the next best actions for the operator.",
                value: (world) => `${world.goals.length} goals · ${world.actions.length} actions`
            }
        ];
        this.cameraCells = [];
        this.buildCameraGrid();
    }

    buildCameraGrid() {
        const grid = this.elements.cameraGrid;
        if (!grid) return;
        const fragment = document.createDocumentFragment();
        for (let index = 0; index < 48; index += 1) {
            const cell = document.createElement("i");
            fragment.appendChild(cell);
            this.cameraCells.push(cell);
        }
        grid.replaceChildren(fragment);
    }

    /** Paints the 6x8 zone brightness the vision agent just measured over the preview. */
    renderCameraZones(world) {
        if (this.cameraCells.length === 0) return;

        const zones = world.objects.filter((item) => item.type === "Zone");
        if (zones.length === 0) {
            for (const cell of this.cameraCells) {
                cell.style.backgroundColor = "transparent";
            }
            return;
        }

        for (const zone of zones) {
            const { row, col, brightness } = zone.properties;
            const index = ((row - 1) * 6) + (col - 1);
            const cell = this.cameraCells[index];
            if (!cell) continue;
            const intensity = Math.min(0.32, (brightness / 255) * 0.32);
            cell.style.backgroundColor = `rgba(141, 246, 166, ${intensity.toFixed(3)})`;
        }
    }

    renderMetrics(world) {
        const set = (node, value) => {
            if (node) node.textContent = String(value);
        };

        set(this.elements.objectsCount, world.objects.length);
        set(this.elements.eventsCount, world.events.length);
        set(this.elements.memoriesCount, world.memories.length);
        set(this.elements.conceptsCount, world.concepts.length);
        set(this.elements.thoughtsCount, world.thoughts.length);
        set(this.elements.goalsCount, world.goals.length);

        const isCamera = world.context.mode === VISION_CAMERA;
        set(this.elements.modeBadge, isCamera ? "Camera" : "Interface");
        set(this.elements.cycleBadge, world.cycle);
        set(this.elements.signalBadge, world.telemetry.signalStrength || 0);
        set(this.elements.motionBadge, world.telemetry.motionScore || 0);
        set(this.elements.visionChip, isCamera ? "Camera" : "Interface");
    }

    renderLanes(world) {
        const target = this.elements.agentLanes;
        if (!target) return;

        const fragment = document.createDocumentFragment();
        for (const lane of this.laneDefinitions) {
            const card = element("div", "agent-lane");
            card.dataset.agentCard = lane.key;
            card.appendChild(element("span", "lane-chip", lane.label));
            card.appendChild(element("strong", null, lane.value(world)));
            card.appendChild(element("div", "lane-meta", lane.description));
            fragment.appendChild(card);
        }
        target.replaceChildren(fragment);
    }

    renderTimeline(world) {
        const target = this.elements.timelineList;
        if (!target) return;

        if (world.timeline.length === 0) {
            target.replaceChildren(element("div", "timeline-item", "No observations recorded yet."));
            return;
        }

        const fragment = document.createDocumentFragment();
        for (const item of world.timeline) {
            const row = element("div", "timeline-item");
            row.appendChild(element("div", "timeline-title", item.title));
            row.appendChild(element("div", "timeline-body", item.detail));
            row.appendChild(element("div", "timeline-meta", `${formatTime(item.time)} · ${item.type}`));
            fragment.appendChild(row);
        }
        target.replaceChildren(fragment);
    }

    renderPanels(world) {
        renderList(this.elements.objectsList, world.objects.slice(0, 24), "No objects visible yet", (item) => ({
            title: item.properties.text || item.type,
            subtle: [
                item.type,
                item.properties.id ? `#${item.properties.id}` : "",
                item.properties.tone || "",
                item.properties.className ? compactText(item.properties.className, 26) : ""
            ].filter(Boolean).join(" · ")
        }));

        renderList(this.elements.eventsList, world.events.slice(0, 16), "No events captured this cycle", (item) => ({
            title: item.type,
            subtle: describeEventData(item.data) || "Event data unavailable"
        }));

        renderList(this.elements.memoriesList, world.memories.slice(0, 14), "No memories stored yet", (item) => ({
            title: item.summary?.headline || "Memory snapshot",
            subtle: `importance ${item.importance} · confidence ${item.confidence} · ${(item.summary?.events || []).join(", ") || "no notable events"}`
        }));

        renderList(this.elements.conceptsList, world.concepts.slice(0, 16), "No concepts formed yet", (item) => ({
            title: item.name,
            subtle: `score ${item.score} · ${item.description}`
        }));

        renderList(this.elements.patternsList, world.patterns.slice(0, 12), "No patterns found yet", (item) => ({
            title: item.name,
            subtle: `score ${item.score} · ${item.description}`
        }));

        renderList(this.elements.goalsList, world.goals.slice(0, 8), "No goals synthesized yet", (item) => ({
            title: item.title,
            subtle: `${item.status} · priority ${item.priority} · ${item.rationale}`
        }));

        renderList(this.elements.actionsList, world.actions, "No actions recommended yet", (item) => ({
            title: item,
            subtle: "Derived from the current reasoning state"
        }));
    }

    updateInspector(node) {
        const { selectedNodeLabel, selectedNodeType, selectedNodeDetail } = this.elements;

        if (!node) {
            if (selectedNodeLabel) selectedNodeLabel.textContent = "None";
            if (selectedNodeType) selectedNodeType.textContent = "—";
            if (selectedNodeDetail) selectedNodeDetail.textContent = "Tap a node to inspect the current architectural story.";
            return;
        }

        if (selectedNodeLabel) selectedNodeLabel.textContent = node.label;
        if (selectedNodeType) selectedNodeType.textContent = node.kind;
        if (selectedNodeDetail) selectedNodeDetail.textContent = node.detail;
    }

    appendChatMessage(role, text) {
        const target = this.elements.chatMessages;
        if (!target) return;

        const item = element("div", `chat-msg ${role === "user" ? "chat-msg-user" : "chat-msg-observer"}`);
        item.dataset.role = role;
        item.dataset.text = text;
        item.appendChild(element("div", "chat-msg-role", role === "user" ? "Operator" : "Observer AO"));
        item.appendChild(element("div", "chat-msg-body", text));
        target.appendChild(item);

        const viewport = document.querySelector(".viewport");
        requestAnimationFrame(() => {
            if (viewport && !document.getElementById("view-chat")?.hidden) {
                viewport.scrollTop = viewport.scrollHeight;
            }
        });
    }

    clearChat() {
        this.elements.chatMessages?.replaceChildren();
    }

    readChatHistory(limit = 12) {
        const target = this.elements.chatMessages;
        if (!target) return [];
        return [...target.querySelectorAll(".chat-msg")].slice(-limit).map((node) => ({
            role: node.dataset.role || "observer",
            text: node.dataset.text || node.textContent || ""
        }));
    }
}
