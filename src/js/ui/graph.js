import { compactText } from "./format.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const BASE_WIDTH = 480;
const BASE_HEIGHT = 640;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3.5;
const TAP_SLOP = 10;

/**
 * A portrait-first map of the observer's model. The graph is laid out top-down in
 * bands (mission → concepts → patterns → memories → goals) so it reads naturally on
 * a tall screen, and the whole surface pans and pinch-zooms via the SVG viewBox.
 */
export class GraphView {
    constructor(svg, { onSelect } = {}) {
        this.svg = svg;
        this.onSelect = onSelect || (() => {});
        this.view = { x: 0, y: 0, scale: 1 };
        this.nodes = [];
        this.selectedId = "";
        this.pointers = new Map();
        this.gesture = null;
        this.bindGestures();
        this.applyView();
    }

    applyView() {
        const width = BASE_WIDTH / this.view.scale;
        const height = BASE_HEIGHT / this.view.scale;
        this.svg.setAttribute("viewBox", `${this.view.x} ${this.view.y} ${width} ${height}`);
    }

    reset() {
        this.view = { x: 0, y: 0, scale: 1 };
        this.applyView();
    }

    /** Converts a client point into the SVG user-space the viewBox currently shows. */
    toUserSpace(clientX, clientY) {
        const rect = this.svg.getBoundingClientRect();
        const width = BASE_WIDTH / this.view.scale;
        const height = BASE_HEIGHT / this.view.scale;
        return {
            x: this.view.x + ((clientX - rect.left) / rect.width) * width,
            y: this.view.y + ((clientY - rect.top) / rect.height) * height
        };
    }

    bindGestures() {
        const svg = this.svg;

        svg.addEventListener("pointerdown", (event) => {
            svg.setPointerCapture(event.pointerId);
            this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

            if (this.pointers.size === 1) {
                this.gesture = {
                    type: "pan",
                    startX: event.clientX,
                    startY: event.clientY,
                    originX: this.view.x,
                    originY: this.view.y,
                    moved: 0
                };
            } else if (this.pointers.size === 2) {
                const [a, b] = [...this.pointers.values()];
                this.gesture = {
                    type: "pinch",
                    startDistance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
                    startScale: this.view.scale,
                    centerClient: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
                    centerUser: this.toUserSpace((a.x + b.x) / 2, (a.y + b.y) / 2),
                    moved: TAP_SLOP + 1
                };
            }
        });

        svg.addEventListener("pointermove", (event) => {
            if (!this.pointers.has(event.pointerId)) return;
            this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (!this.gesture) return;

            const rect = svg.getBoundingClientRect();

            if (this.gesture.type === "pan" && this.pointers.size === 1) {
                const dx = event.clientX - this.gesture.startX;
                const dy = event.clientY - this.gesture.startY;
                this.gesture.moved = Math.max(this.gesture.moved, Math.hypot(dx, dy));
                const width = BASE_WIDTH / this.view.scale;
                const height = BASE_HEIGHT / this.view.scale;
                this.view.x = this.gesture.originX - (dx / rect.width) * width;
                this.view.y = this.gesture.originY - (dy / rect.height) * height;
                this.applyView();
                return;
            }

            if (this.gesture.type === "pinch" && this.pointers.size >= 2) {
                const [a, b] = [...this.pointers.values()];
                const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
                const scale = Math.min(
                    MAX_SCALE,
                    Math.max(MIN_SCALE, this.gesture.startScale * (distance / this.gesture.startDistance))
                );
                this.view.scale = scale;

                // Keep the point between the fingers anchored while zooming.
                const width = BASE_WIDTH / scale;
                const height = BASE_HEIGHT / scale;
                const ratioX = (this.gesture.centerClient.x - rect.left) / rect.width;
                const ratioY = (this.gesture.centerClient.y - rect.top) / rect.height;
                this.view.x = this.gesture.centerUser.x - (ratioX * width);
                this.view.y = this.gesture.centerUser.y - (ratioY * height);
                this.applyView();
            }
        });

        const release = (event) => {
            const gesture = this.gesture;
            this.pointers.delete(event.pointerId);

            if (this.pointers.size === 0) {
                this.gesture = null;
                if (gesture && gesture.type === "pan" && gesture.moved <= TAP_SLOP) {
                    this.handleTap(event.clientX, event.clientY);
                }
            } else if (this.pointers.size === 1) {
                const [remaining] = [...this.pointers.values()];
                this.gesture = {
                    type: "pan",
                    startX: remaining.x,
                    startY: remaining.y,
                    originX: this.view.x,
                    originY: this.view.y,
                    moved: TAP_SLOP + 1
                };
            }
        };

        svg.addEventListener("pointerup", release);
        svg.addEventListener("pointercancel", release);

        svg.addEventListener("wheel", (event) => {
            event.preventDefault();
            const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
            const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.view.scale * factor));
            const anchor = this.toUserSpace(event.clientX, event.clientY);
            const rect = svg.getBoundingClientRect();
            const width = BASE_WIDTH / scale;
            const height = BASE_HEIGHT / scale;
            this.view.scale = scale;
            this.view.x = anchor.x - (((event.clientX - rect.left) / rect.width) * width);
            this.view.y = anchor.y - (((event.clientY - rect.top) / rect.height) * height);
            this.applyView();
        }, { passive: false });
    }

    handleTap(clientX, clientY) {
        const point = this.toUserSpace(clientX, clientY);
        let hit = null;

        for (const node of this.nodes) {
            const distance = Math.hypot(node.x - point.x, node.y - point.y);
            if (distance <= node.radius + 6 && (!hit || distance < hit.distance)) {
                hit = { node, distance };
            }
        }

        if (hit) {
            this.selectedId = hit.node.id;
            this.draw(this.lastModel, this.selectedId);
            this.onSelect(hit.node);
        }
    }

    buildNodes(world) {
        const nodes = [];
        const links = [];

        const scenarioLabel = world.context.scenario ? compactText(world.context.scenario, 60) : "No mission brief";
        nodes.push({
            id: "scenario",
            label: "Mission",
            kind: "mission",
            detail: scenarioLabel,
            x: BASE_WIDTH / 2,
            y: 62,
            radius: 38,
            color: "#59dfd4"
        });

        const spread = (items, y, radius, mapper) => {
            const count = items.length;
            return items.map((item, index) => {
                const step = BASE_WIDTH / (count + 1);
                return { ...mapper(item, index), x: step * (index + 1), y, radius };
            });
        };

        const conceptNodes = spread(world.concepts.slice(0, 4), 200, 32, (item) => ({
            id: item.id,
            label: compactText(item.name, 9),
            kind: "concept",
            detail: `${item.description}. Score ${item.score}.`,
            color: "#8df6a6"
        }));

        const patternNodes = spread(world.patterns.slice(0, 3), 348, 32, (item) => ({
            id: item.id,
            label: compactText(item.name, 9),
            kind: "pattern",
            detail: `${item.description} Score ${item.score}.`,
            color: "#ffd66d"
        }));

        const memoryNodes = spread(world.memories.slice(0, 3), 480, 26, (item, index) => ({
            id: item.id,
            label: `M${index + 1}`,
            kind: "memory",
            detail: item.summary?.headline || "Memory snapshot",
            color: "#9fd0ff"
        }));

        const goalNodes = spread(world.goals.slice(0, 2), 592, 34, (item) => ({
            id: item.id,
            label: compactText(item.title, 10),
            kind: "goal",
            detail: item.rationale,
            color: "#ff7e6f"
        }));

        nodes.push(...conceptNodes, ...patternNodes, ...memoryNodes, ...goalNodes);

        for (const node of conceptNodes) {
            links.push(["scenario", node.id]);
        }
        for (let index = 0; index < Math.max(conceptNodes.length, patternNodes.length); index += 1) {
            const from = conceptNodes[index % Math.max(conceptNodes.length, 1)];
            const to = patternNodes[index % Math.max(patternNodes.length, 1)];
            if (from && to) links.push([from.id, to.id]);
        }
        for (const patternNode of patternNodes) {
            if (memoryNodes[0]) links.push([patternNode.id, memoryNodes[0].id]);
        }
        for (const memoryNode of memoryNodes) {
            if (goalNodes[0]) links.push([memoryNode.id, goalNodes[0].id]);
        }
        if (goalNodes[1] && patternNodes[1]) {
            links.push([patternNodes[1].id, goalNodes[1].id]);
        }

        return { nodes, links };
    }

    draw(world, preferredId = this.selectedId) {
        if (!world) return null;
        this.lastModel = world;

        const { nodes, links } = this.buildNodes(world);
        this.nodes = nodes;

        const selected = nodes.find((node) => node.id === preferredId) || nodes[0] || null;
        this.selectedId = selected?.id || "";

        const nodeMap = new Map(nodes.map((node) => [node.id, node]));
        const fragment = document.createDocumentFragment();

        for (const [fromId, toId] of links) {
            const from = nodeMap.get(fromId);
            const to = nodeMap.get(toId);
            if (!from || !to) continue;
            const line = document.createElementNS(SVG_NS, "line");
            line.setAttribute("x1", String(from.x));
            line.setAttribute("y1", String(from.y));
            line.setAttribute("x2", String(to.x));
            line.setAttribute("y2", String(to.y));
            line.setAttribute("class", "edge-line");
            fragment.appendChild(line);
        }

        for (const node of nodes) {
            const isSelected = node.id === this.selectedId;
            const circle = document.createElementNS(SVG_NS, "circle");
            circle.setAttribute("cx", String(node.x));
            circle.setAttribute("cy", String(node.y));
            circle.setAttribute("r", String(node.radius));
            circle.setAttribute("fill", node.color);
            circle.setAttribute("fill-opacity", isSelected ? "0.95" : "0.8");
            circle.setAttribute("stroke", isSelected ? "#ffffff" : "rgba(255,255,255,0.08)");
            circle.setAttribute("class", `node-shape${isSelected ? " selected" : ""}`);
            fragment.appendChild(circle);

            const text = document.createElementNS(SVG_NS, "text");
            text.setAttribute("x", String(node.x));
            text.setAttribute("y", String(node.y + 4));
            text.setAttribute("class", "node-label");
            text.textContent = node.label;
            fragment.appendChild(text);
        }

        this.svg.replaceChildren(fragment);
        return selected;
    }
}
