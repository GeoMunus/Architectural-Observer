// Wiring: renders the timeline, and routes every edit and generation request
// through the store so undo always works.

import { GENRE_LIST, ENTITY_KINDS } from "./lexicon.js";
import { randomSeedWord, uid } from "./rng.js";
import {
    createTimeline,
    extendForward,
    extendBackward,
    expandAfter,
    branchFrom,
    rerollEvent,
    blankEvent,
    getGenre,
    formatTime
} from "./generator.js";
import { createStore } from "./store.js";
import { detectBackends, generateWithModel, reconcile } from "./ai.js";
import { entityIcon } from "./worldgen.js";

const store = createStore();
let editingId = null;

const $ = (id) => document.getElementById(id);
const els = {
    title: $("timelineTitle"),
    meta: $("timelineMeta"),
    undo: $("undoBtn"),
    redo: $("redoBtn"),
    exportBtn: $("exportBtn"),
    importBtn: $("importBtn"),
    importInput: $("importInput"),
    premise: $("premiseInput"),
    genre: $("genreSelect"),
    genreBlurb: $("genreBlurb"),
    length: $("lengthInput"),
    scale: $("scaleSelect"),
    seed: $("seedInput"),
    generate: $("generateBtn"),
    surprise: $("surpriseBtn"),
    aiMode: $("aiModeSelect"),
    apiFields: $("apiFields"),
    apiKey: $("apiKeyInput"),
    model: $("modelSelect"),
    steer: $("steerInput"),
    aiStatus: $("aiStatus"),
    search: $("searchInput"),
    tagFilter: $("tagFilter"),
    importanceFilter: $("importanceFilter"),
    clearFilter: $("clearFilterBtn"),
    codex: $("codexList"),
    codexCount: $("codexCount"),
    library: $("libraryList"),
    libraryCount: $("libraryCount"),
    extendBack: $("extendBackBtn"),
    extendFwd: $("extendFwdBtn"),
    extendCount: $("extendCount"),
    addEvent: $("addEventBtn"),
    branchNotice: $("branchNotice"),
    busy: $("busyBar"),
    view: $("timelineView"),
    empty: $("emptyState"),
    toast: $("toast")
};

// ---------------------------------------------------------------- utilities

function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = value;
        else if (key === "html") node.innerHTML = value;
        else if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
        else if (value !== null && value !== false && value !== undefined) node.setAttribute(key, value);
    });
    (Array.isArray(children) ? children : [children]).filter(Boolean).forEach((child) => node.appendChild(child));
    return node;
}

let toastTimer = null;
function toast(message, isError = false) {
    els.toast.textContent = message;
    els.toast.classList.toggle("error", Boolean(isError));
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        els.toast.hidden = true;
    }, isError ? 7000 : 3200);
}

function eraColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 360;
    return `hsl(${hash}, 48%, 66%)`;
}

/** Pulls a number out of a hand-edited time label so ordering still means something. */
function parseTimeLabel(label, fallback) {
    const match = String(label).replace(/,/g, "").match(/-?\d+/);
    return match ? Number(match[0]) : fallback;
}

function download(filename, content, type = "application/json") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = el("a", { href: url, download: filename });
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toMarkdown(timeline) {
    const genre = getGenre(timeline.genreId);
    const lines = [`# ${timeline.title || "Untitled chronicle"}`, ""];
    if (timeline.premise) lines.push(`*${timeline.premise}*`, "");
    lines.push(`**Genre:** ${genre.label}  |  **Seed:** \`${timeline.seed}\`  |  **Events:** ${timeline.events.length}`, "");

    let era = null;
    timeline.events.forEach((event) => {
        if (event.era && event.era !== era) {
            era = event.era;
            lines.push("", `## ${era}`, "");
        }
        lines.push(`### ${event.timeLabel} — ${event.title}`);
        if (event.body) lines.push("", event.body);
        if (event.tags.length) lines.push("", `\`${event.tags.join("` `")}\``);
        lines.push("");
    });

    lines.push("", "## Codex", "");
    Object.keys(ENTITY_KINDS).forEach((kind) => {
        const group = timeline.entities.filter((e) => e.kind === kind);
        if (!group.length) return;
        lines.push(`**${ENTITY_KINDS[kind].label}**`, "");
        group.forEach((e) => lines.push(`- **${e.name}**${e.epithet ? ` — ${e.epithet}` : ""} *(${e.status})*`));
        lines.push("");
    });
    return lines.join("\n");
}

// ------------------------------------------------------------------ filtering

function visibleEvents(timeline) {
    const { text, tag, entityId, minImportance } = store.state.filter;
    const needle = text.trim().toLowerCase();
    return timeline.events.filter((event) => {
        if (minImportance > 1 && event.importance < minImportance) return false;
        if (tag && !event.tags.includes(tag)) return false;
        if (entityId && !(event.entityIds || []).includes(entityId)) return false;
        if (needle) {
            const haystack = `${event.title} ${event.body} ${event.tags.join(" ")}`.toLowerCase();
            if (!haystack.includes(needle)) return false;
        }
        return true;
    });
}

// ------------------------------------------------------------------ rendering

function renderMeta() {
    const timeline = store.state.timeline;
    els.undo.disabled = !store.canUndo();
    els.redo.disabled = !store.canRedo();
    els.undo.title = store.canUndo() ? `Undo: ${store.undoLabel()}` : "Nothing to undo";

    const hasTimeline = Boolean(timeline);
    [els.extendBack, els.extendFwd, els.addEvent, els.exportBtn].forEach((b) => {
        b.disabled = !hasTimeline;
    });
    els.empty.hidden = hasTimeline;

    if (!hasTimeline) {
        els.title.value = "";
        els.meta.textContent = "No timeline yet — generate one to begin.";
        els.branchNotice.hidden = true;
        return;
    }

    if (document.activeElement !== els.title) els.title.value = timeline.title || "";
    const genre = getGenre(timeline.genreId);
    const span = timeline.events.length
        ? `${timeline.events[0].timeLabel} → ${timeline.events[timeline.events.length - 1].timeLabel}`
        : "empty";
    els.meta.textContent = `${genre.label} · ${timeline.events.length} events · ${span} · seed ${timeline.seed}`;

    if (timeline.branchOf) {
        els.branchNotice.hidden = false;
        els.branchNotice.textContent = `Alternate history — diverges from "${timeline.branchOf.title}" at the marked event.`;
    } else {
        els.branchNotice.hidden = true;
    }
}

function renderEventCard(event, index, timeline) {
    const isSelected = store.state.selectedEventId === event.id;
    const isEditing = editingId === event.id;

    const timeInput = el("input", {
        type: "text",
        value: event.timeLabel,
        "aria-label": "Event date"
    });
    timeInput.addEventListener("change", () => {
        const label = timeInput.value.trim();
        store.commit("edit date", () => {
            event.timeLabel = label;
            event.time = parseTimeLabel(label, event.time);
        });
    });

    const actions = el("div", { class: "event-actions" }, [
        el("span", { class: "drag-handle", title: "Drag to reorder", text: "⠿" }),
        el("button", { class: "btn tiny ghost", "data-action": "edit", "data-id": event.id, text: isEditing ? "Done" : "Edit" }),
        el("button", { class: "btn tiny ghost", "data-action": "expand", "data-id": event.id, title: "Generate connecting events after this one", text: "Expand" }),
        el("button", { class: "btn tiny ghost", "data-action": "reroll", "data-id": event.id, title: "Rewrite this event with the engine", text: "Re-roll" }),
        el("button", { class: "btn tiny ghost", "data-action": "branch", "data-id": event.id, title: "Fork an alternate history from here", text: "Branch" }),
        el("button", { class: "btn tiny ghost danger", "data-action": "delete", "data-id": event.id, text: "✕" })
    ]);

    const meta = el("div", { class: "event-meta" });
    meta.appendChild(
        el("button", {
            class: `chip ${event.pinned ? "pinned" : ""}`,
            "data-action": "pin",
            "data-id": event.id,
            title: "Pin so re-rolls and regenerations leave it alone",
            text: event.pinned ? "★ pinned" : "☆ pin"
        })
    );
    meta.appendChild(el("span", { class: "chip source", text: `weight ${event.importance}` }));
    event.tags.forEach((tag) =>
        meta.appendChild(el("button", { class: "chip", "data-action": "filter-tag", "data-tag": tag, text: tag }))
    );
    (event.entityIds || []).forEach((id) => {
        const entity = timeline.entities.find((e) => e.id === id);
        if (!entity) return;
        meta.appendChild(
            el("button", {
                class: "chip entity",
                "data-action": "filter-entity",
                "data-entity": id,
                text: `${entityIcon(entity.kind)} ${entity.name}`
            })
        );
    });
    (event.causes || []).forEach((causeId) => {
        const cause = timeline.events.find((e) => e.id === causeId);
        if (!cause) return;
        meta.appendChild(
            el("button", {
                class: "chip cause",
                "data-action": "goto",
                "data-id": causeId,
                title: cause.title,
                text: `⤴ ${cause.timeLabel}`
            })
        );
    });
    if (event.source === "model") meta.appendChild(el("span", { class: "chip source", text: "claude" }));
    if (event.source === "manual") meta.appendChild(el("span", { class: "chip source", text: "yours" }));

    const card = el("div", { class: "event-card" }, [
        el("div", { class: "event-head" }, [
            el("h3", { class: "event-title", text: event.title }),
            actions
        ]),
        event.body ? el("p", { class: "event-body", text: event.body }) : null,
        meta
    ]);

    if (isEditing) card.appendChild(renderEditor(event, timeline));

    const row = el("article", {
        class: `event ${isSelected ? "selected" : ""}`,
        "data-weight": String(event.importance),
        "data-id": event.id,
        "data-index": String(index),
        draggable: "true"
    }, [
        el("div", { class: "event-time" }, [timeInput]),
        card
    ]);

    return row;
}

function renderEditor(event, timeline) {
    const titleInput = el("input", { type: "text", value: event.title });
    const bodyInput = el("textarea", { rows: "4" });
    bodyInput.value = event.body;
    const eraInput = el("input", { type: "text", value: event.era || "", placeholder: "era name" });
    const tagsInput = el("input", { type: "text", class: "tag-input", value: event.tags.join(", "), placeholder: "war, treaty" });
    const importanceInput = el("select");
    [1, 2, 3, 4, 5].forEach((n) => {
        const option = el("option", { value: String(n), text: `${n}${n === 5 ? " — turning point" : n === 1 ? " — footnote" : ""}` });
        if (n === event.importance) option.setAttribute("selected", "selected");
        importanceInput.appendChild(option);
    });
    importanceInput.value = String(event.importance);

    const picker = el("div", { class: "entity-picker" });
    const chosen = new Set(event.entityIds || []);
    timeline.entities.forEach((entity) => {
        const toggle = el("button", {
            type: "button",
            class: `entity-toggle ${chosen.has(entity.id) ? "on" : ""}`,
            text: `${entityIcon(entity.kind)} ${entity.name}`
        });
        toggle.addEventListener("click", () => {
            if (chosen.has(entity.id)) chosen.delete(entity.id);
            else chosen.add(entity.id);
            toggle.classList.toggle("on", chosen.has(entity.id));
        });
        picker.appendChild(toggle);
    });

    const save = el("button", { class: "btn primary tiny", text: "Save changes" });
    save.addEventListener("click", () => {
        store.commit("edit event", () => {
            event.title = titleInput.value.trim() || "Untitled event";
            event.body = bodyInput.value.trim();
            event.era = eraInput.value.trim();
            event.tags = tagsInput.value.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 6);
            event.importance = Number(importanceInput.value);
            event.entityIds = Array.from(chosen);
            if (event.source === "engine") event.source = "edited";
        });
        editingId = null;
        store.notify();
    });

    const cancel = el("button", { class: "btn ghost tiny", text: "Cancel" });
    cancel.addEventListener("click", () => {
        editingId = null;
        store.notify();
    });

    return el("div", { class: "event-editor" }, [
        el("label", { class: "field" }, [el("span", { text: "Title" }), titleInput]),
        el("label", { class: "field" }, [el("span", { text: "Account" }), bodyInput]),
        el("div", { class: "field-row" }, [
            el("label", { class: "field" }, [el("span", { text: "Era" }), eraInput]),
            el("label", { class: "field" }, [el("span", { text: "Tags" }), tagsInput]),
            el("label", { class: "field narrow" }, [el("span", { text: "Weight" }), importanceInput])
        ]),
        el("div", { class: "field" }, [el("span", { text: "Involves" }), picker]),
        el("div", { class: "editor-actions" }, [cancel, save])
    ]);
}

function renderTimeline() {
    const timeline = store.state.timeline;
    els.view.replaceChildren();
    if (!timeline) return;

    const shown = visibleEvents(timeline);
    if (!shown.length) {
        els.view.appendChild(
            el("div", { class: "empty" }, [
                el("h2", { text: timeline.events.length ? "No events match the filter" : "This chronicle is empty" }),
                el("p", {
                    text: timeline.events.length
                        ? "Clear the filters on the left to see the rest of the record."
                        : "Use “Continue forward” to have the engine write the first events."
                })
            ])
        );
        return;
    }

    let currentEra = null;
    let eraEvents = [];
    const flushEra = () => {
        if (!currentEra || !eraEvents.length) return;
        const band = el("div", { class: "era-band" }, [
            el("span", { class: "era-name", text: currentEra }),
            el("span", { class: "era-rule" }),
            el("span", {
                class: "era-span",
                text: `${eraEvents[0].timeLabel} – ${eraEvents[eraEvents.length - 1].timeLabel}`
            })
        ]);
        band.style.setProperty("--era-color", eraColor(currentEra));
        els.view.insertBefore(band, els.view.querySelector(`[data-id="${eraEvents[0].id}"]`));
    };

    shown.forEach((event) => {
        if ((event.era || "") !== currentEra) {
            flushEra();
            currentEra = event.era || "";
            eraEvents = [];
        }
        eraEvents.push(event);
        els.view.appendChild(renderEventCard(event, timeline.events.indexOf(event), timeline));
    });
    flushEra();
}

function renderCodex() {
    const timeline = store.state.timeline;
    els.codex.replaceChildren();
    if (!timeline) {
        els.codexCount.textContent = "";
        return;
    }
    els.codexCount.textContent = `${timeline.entities.length}`;

    Object.entries(ENTITY_KINDS).forEach(([kind, config]) => {
        const group = timeline.entities.filter((e) => e.kind === kind);
        if (!group.length) return;
        els.codex.appendChild(el("p", { class: "codex-group", text: config.label }));
        group.forEach((entity) => {
            const active = store.state.filter.entityId === entity.id;
            const gone = ["fallen", "dead", "ruined", "spent"].includes(entity.status);
            const item = el("div", { class: `codex-item ${active ? "active" : ""}`, title: entity.epithet || entity.note || "" }, [
                el("span", { class: "glyph", text: config.icon }),
                el("span", { class: "name", text: entity.name }),
                el("span", { class: `status ${gone ? "gone" : ""}`, text: entity.status })
            ]);
            item.addEventListener("click", () => {
                store.setFilter({ entityId: active ? "" : entity.id });
            });
            els.codex.appendChild(item);
        });
    });
}

function renderLibrary() {
    els.library.replaceChildren();
    const { library, timeline } = store.state;
    els.libraryCount.textContent = library.length ? String(library.length) : "";

    if (!library.length) {
        els.library.appendChild(el("p", { class: "hint", text: "Timelines you generate are saved here automatically." }));
        return;
    }

    library.forEach((entry) => {
        const open = el("button", { class: "open" }, [
            el("strong", { text: entry.title || "Untitled chronicle" }),
            el("small", { text: `${entry.eventCount} events · ${new Date(entry.updatedAt).toLocaleDateString()}` })
        ]);
        open.addEventListener("click", () => {
            store.loadFromLibrary(entry.id);
            toast(`Opened “${entry.title || "Untitled"}”.`);
        });

        const remove = el("button", { class: "remove", title: "Delete", text: "✕" });
        remove.addEventListener("click", () => {
            store.removeFromLibrary(entry.id);
            toast("Removed from the library.");
        });

        els.library.appendChild(
            el("div", { class: `library-item ${timeline && timeline.id === entry.id ? "current" : ""}` }, [open, remove])
        );
    });
}

function renderFilters() {
    const timeline = store.state.timeline;
    const tags = new Set();
    if (timeline) timeline.events.forEach((e) => e.tags.forEach((t) => tags.add(t)));

    const current = store.state.filter.tag;
    els.tagFilter.replaceChildren(el("option", { value: "", text: "any" }));
    Array.from(tags).sort().forEach((tag) => {
        const option = el("option", { value: tag, text: tag });
        if (tag === current) option.setAttribute("selected", "selected");
        els.tagFilter.appendChild(option);
    });
    els.tagFilter.value = current;
    els.importanceFilter.value = String(store.state.filter.minImportance);
    if (document.activeElement !== els.search) els.search.value = store.state.filter.text;
}

function render() {
    els.busy.hidden = !store.state.busy;
    if (store.state.busy) els.busy.textContent = store.state.busy;
    renderMeta();
    renderFilters();
    renderTimeline();
    renderCodex();
    renderLibrary();
}

// ----------------------------------------------------------------- generation

function usingModel() {
    return store.state.settings.aiMode !== "engine";
}

/** Gives model-written events sane numeric times when the model omits them. */
function normalizeTimes(timeline) {
    const genre = getGenre(timeline.genreId);
    timeline.events.forEach((event, index) => {
        if (Number.isFinite(event.time)) return;
        const prev = timeline.events[index - 1];
        const next = timeline.events.slice(index + 1).find((e) => Number.isFinite(e.time));
        if (prev && next) event.time = Math.round((prev.time + next.time) / 2);
        else if (prev) event.time = prev.time + genre.time.step[0];
        else if (next) event.time = next.time - genre.time.step[0];
        else event.time = genre.time.start[0];
        if (!event.timeLabel) event.timeLabel = formatTime(genre, event.time);
    });
}

async function modelEvents(timeline, mode, count, extra = {}) {
    const payload = await generateWithModel({
        timeline,
        mode,
        count,
        instruction: els.steer.value.trim(),
        settings: store.state.settings,
        ...extra
    });
    const events = reconcile(timeline, payload.events, extra);
    if (!events.length) throw new Error("The model returned no usable events.");
    return events;
}

async function withBusy(message, task) {
    store.setBusy(message);
    try {
        await task();
    } catch (err) {
        console.error(err);
        toast(err.message || String(err), true);
    } finally {
        store.setBusy(null);
    }
}

async function doGenerate() {
    const premise = els.premise.value.trim();
    const genreId = els.genre.value;
    const length = Math.max(4, Math.min(40, Number(els.length.value) || 14));
    const seed = els.seed.value.trim() || randomSeedWord();
    els.seed.value = seed;

    await withBusy(usingModel() ? "Asking Claude for a history…" : "Composing a history…", async () => {
        if (!usingModel()) {
            store.open(createTimeline({ premise, genreId, seed, length, scale: els.scale.value }));
            toast(`Generated ${store.state.timeline.events.length} events.`);
            return;
        }

        // The engine still builds the world; the model writes the record.
        const shell = createTimeline({ premise, genreId, seed, length: 0, scale: els.scale.value });
        try {
            const events = await modelEvents(shell, "create", length, { era: "" });
            shell.events = events;
            normalizeTimes(shell);
            store.open(shell);
            toast(`Claude wrote ${events.length} events.`);
        } catch (err) {
            store.open(createTimeline({ premise, genreId, seed, length, scale: els.scale.value }));
            toast(`${err.message} Fell back to the built-in engine.`, true);
        }
    });
}

async function doExtend(direction) {
    const timeline = store.state.timeline;
    if (!timeline) return;
    const count = Math.max(1, Math.min(12, Number(els.extendCount.value) || 4));
    const forward = direction === "forward";

    await withBusy(forward ? "Continuing the record…" : "Reaching further back…", async () => {
        if (!usingModel()) {
            store.commit(forward ? "continue forward" : "extend backward", (tl) => {
                const added = forward ? extendForward(tl, count) : extendBackward(tl, count);
                toast(added.length ? `Added ${added.length} events.` : "The engine had nothing left to add here.");
            });
            return;
        }
        const events = await modelEvents(timeline, forward ? "continue" : "backward", count, {
            era: forward
                ? (timeline.events[timeline.events.length - 1] || {}).era || ""
                : (timeline.events[0] || {}).era || ""
        });
        store.commit(forward ? "continue forward" : "extend backward", (tl) => {
            if (forward) tl.events.push(...events);
            else tl.events.unshift(...events);
            normalizeTimes(tl);
        });
        toast(`Claude added ${events.length} events.`);
    });
}

async function doExpand(eventId) {
    const timeline = store.state.timeline;
    const index = timeline.events.findIndex((e) => e.id === eventId);
    if (index === -1) return;
    const anchor = timeline.events[index];

    await withBusy("Filling in the gap…", async () => {
        if (!usingModel()) {
            store.commit("expand event", (tl) => {
                const added = expandAfter(tl, eventId, 3);
                toast(added.length ? `Added ${added.length} connecting events.` : "No room to expand here.");
            });
            return;
        }
        const events = await modelEvents(timeline, "expand", 3, {
            anchor,
            nextEvent: timeline.events[index + 1],
            era: anchor.era,
            act: anchor.act
        });
        store.commit("expand event", (tl) => {
            const at = tl.events.findIndex((e) => e.id === eventId);
            events.forEach((e) => e.causes.push(eventId));
            tl.events.splice(at + 1, 0, ...events);
            normalizeTimes(tl);
        });
        toast(`Claude added ${events.length} connecting events.`);
    });
}

// -------------------------------------------------------------- interactions

els.view.addEventListener("click", (domEvent) => {
    const button = domEvent.target.closest("[data-action]");
    if (!button) {
        const row = domEvent.target.closest(".event");
        if (row) store.select(row.dataset.id);
        return;
    }
    const { action } = button.dataset;
    const id = button.dataset.id;
    const timeline = store.state.timeline;

    if (action === "edit") {
        editingId = editingId === id ? null : id;
        store.select(id);
        store.notify();
        return;
    }
    if (action === "delete") {
        const event = timeline.events.find((e) => e.id === id);
        if (!event) return;
        if (!confirm(`Delete “${event.title}”?`)) return;
        store.commit("delete event", (tl) => {
            tl.events = tl.events.filter((e) => e.id !== id);
            tl.events.forEach((e) => {
                e.causes = (e.causes || []).filter((c) => c !== id);
            });
        });
        toast("Event deleted.");
        return;
    }
    if (action === "pin") {
        store.commit("pin event", () => {
            const event = timeline.events.find((e) => e.id === id);
            if (event) event.pinned = !event.pinned;
        });
        return;
    }
    if (action === "reroll") {
        const event = timeline.events.find((e) => e.id === id);
        if (event && event.pinned) {
            toast("That event is pinned. Unpin it first.", true);
            return;
        }
        store.commit("re-roll event", (tl) => {
            const replacement = rerollEvent(tl, id);
            toast(replacement ? "Event rewritten." : "The engine could not rewrite that one.");
        });
        return;
    }
    if (action === "expand") {
        doExpand(id);
        return;
    }
    if (action === "branch") {
        const branch = branchFrom(timeline, id, Math.max(4, Number(els.extendCount.value) || 4) + 4);
        if (!branch) {
            toast("Could not branch from that event.", true);
            return;
        }
        store.open(branch);
        toast("Forked an alternate history. The original is still in your library.");
        return;
    }
    if (action === "filter-tag") {
        store.setFilter({ tag: store.state.filter.tag === button.dataset.tag ? "" : button.dataset.tag });
        return;
    }
    if (action === "filter-entity") {
        const entityId = button.dataset.entity;
        store.setFilter({ entityId: store.state.filter.entityId === entityId ? "" : entityId });
        return;
    }
    if (action === "goto") {
        store.select(id);
        const target = els.view.querySelector(`[data-id="${id}"]`);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
});

// Drag to reorder.
let dragId = null;
els.view.addEventListener("dragstart", (domEvent) => {
    const row = domEvent.target.closest(".event");
    if (!row) return;
    dragId = row.dataset.id;
    row.classList.add("dragging");
    domEvent.dataTransfer.effectAllowed = "move";
});
els.view.addEventListener("dragend", () => {
    dragId = null;
    els.view.querySelectorAll(".event").forEach((row) => row.classList.remove("dragging", "drop-target"));
});
els.view.addEventListener("dragover", (domEvent) => {
    if (!dragId) return;
    domEvent.preventDefault();
    const row = domEvent.target.closest(".event");
    els.view.querySelectorAll(".event").forEach((r) => r.classList.remove("drop-target"));
    if (row && row.dataset.id !== dragId) row.classList.add("drop-target");
});
els.view.addEventListener("drop", (domEvent) => {
    if (!dragId) return;
    domEvent.preventDefault();
    const row = domEvent.target.closest(".event");
    if (!row || row.dataset.id === dragId) return;
    const targetId = row.dataset.id;
    store.commit("reorder events", (tl) => {
        const from = tl.events.findIndex((e) => e.id === dragId);
        const to = tl.events.findIndex((e) => e.id === targetId);
        if (from === -1 || to === -1) return;
        const [moved] = tl.events.splice(from, 1);
        tl.events.splice(to, 0, moved);
    });
    dragId = null;
});

els.title.addEventListener("change", () => {
    if (!store.state.timeline) return;
    store.commit("rename timeline", (tl) => {
        tl.title = els.title.value.trim();
    });
});

els.generate.addEventListener("click", doGenerate);
els.extendFwd.addEventListener("click", () => doExtend("forward"));
els.extendBack.addEventListener("click", () => doExtend("backward"));

els.addEvent.addEventListener("click", () => {
    const timeline = store.state.timeline;
    if (!timeline) return;
    const genre = getGenre(timeline.genreId);
    const last = timeline.events[timeline.events.length - 1];
    const event = blankEvent(genre, last ? last.time + genre.time.step[0] : genre.time.start[0]);
    event.era = last ? last.era : "";
    store.commit("add event", (tl) => tl.events.push(event));
    editingId = event.id;
    store.select(event.id);
    store.notify();
});

els.surprise.addEventListener("click", () => {
    const premises = [
        "A drowned archive city where cartographers hold political power",
        "Three generation ships that arrive four centuries apart",
        "A guild that discovers its founding charter was forged",
        "The last river in a continent, and everyone who wants it",
        "A machine that keeps working long after nobody understands it",
        "Two siblings who each inherit half of a border",
        "A plague of forgetting that only affects written records",
        "A colony that votes, unanimously, to stop reporting home"
    ];
    els.premise.value = premises[Math.floor(Math.random() * premises.length)];
    els.genre.selectedIndex = Math.floor(Math.random() * els.genre.options.length);
    els.genre.dispatchEvent(new Event("change"));
    els.seed.value = randomSeedWord();
    doGenerate();
});

els.genre.addEventListener("change", () => {
    const genre = getGenre(els.genre.value);
    els.genreBlurb.textContent = genre.blurb;
});

els.aiMode.addEventListener("change", () => {
    store.updateSettings({ aiMode: els.aiMode.value });
    refreshAiPanel();
});
els.apiKey.addEventListener("change", () => store.updateSettings({ apiKey: els.apiKey.value.trim() }));
els.model.addEventListener("change", () => store.updateSettings({ model: els.model.value }));

els.search.addEventListener("input", () => store.setFilter({ text: els.search.value }));
els.tagFilter.addEventListener("change", () => store.setFilter({ tag: els.tagFilter.value }));
els.importanceFilter.addEventListener("change", () =>
    store.setFilter({ minImportance: Number(els.importanceFilter.value) })
);
els.clearFilter.addEventListener("click", () =>
    store.setFilter({ text: "", tag: "", entityId: "", minImportance: 1 })
);

els.undo.addEventListener("click", () => store.undo());
els.redo.addEventListener("click", () => store.redo());

els.exportBtn.addEventListener("click", () => {
    const timeline = store.state.timeline;
    if (!timeline) return;
    const name = (timeline.title || "chronicle").replace(/[^\w -]/g, "").trim() || "chronicle";
    const asMarkdown = confirm("OK for Markdown, Cancel for JSON.\n\nJSON can be re-imported here; Markdown is for reading and sharing.");
    if (asMarkdown) download(`${name}.md`, toMarkdown(timeline), "text/markdown");
    else download(`${name}.json`, JSON.stringify(timeline, null, 2));
});

els.importBtn.addEventListener("click", () => els.importInput.click());
els.importInput.addEventListener("change", async () => {
    const file = els.importInput.files && els.importInput.files[0];
    if (!file) return;
    try {
        const data = JSON.parse(await file.text());
        if (!Array.isArray(data.events) || !Array.isArray(data.entities)) {
            throw new Error("That file is not a Chronicler timeline.");
        }
        data.id = data.id || uid("tl");
        store.open(data);
        toast(`Imported ${data.events.length} events.`);
    } catch (err) {
        toast(err.message || "Could not read that file.", true);
    } finally {
        els.importInput.value = "";
    }
});

document.addEventListener("keydown", (domEvent) => {
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(domEvent.target.tagName);
    if ((domEvent.metaKey || domEvent.ctrlKey) && domEvent.key.toLowerCase() === "z") {
        domEvent.preventDefault();
        if (domEvent.shiftKey) store.redo();
        else store.undo();
        return;
    }
    if (typing) return;
    if (domEvent.key === "g") doGenerate();
    if (domEvent.key === "e") doExtend("forward");
});

// ------------------------------------------------------------------- start-up

function refreshAiPanel() {
    const { settings } = store.state;
    els.aiMode.value = settings.aiMode;
    els.apiKey.value = settings.apiKey || "";
    els.model.value = settings.model;
    els.apiFields.hidden = settings.aiMode !== "api";

    const backends = detectBackends();
    const runtimeOption = Array.from(els.aiMode.options).find((o) => o.value === "runtime");
    runtimeOption.disabled = !backends.runtime;
    runtimeOption.textContent = backends.runtime
        ? "Claude (this page)"
        : "Claude (this page — not available here)";

    if (settings.aiMode === "runtime" && !backends.runtime) {
        store.updateSettings({ aiMode: "engine" });
        els.aiMode.value = "engine";
    }

    if (els.aiMode.value === "engine") {
        els.aiStatus.textContent = "The built-in engine writes everything locally — no network, no key, and the same seed always gives the same history.";
    } else if (els.aiMode.value === "api") {
        els.aiStatus.textContent = "Claude writes the events; the engine still builds the world and keeps the record editable.";
    } else {
        els.aiStatus.textContent = "Claude is answering from inside this page.";
    }
}

function init() {
    GENRE_LIST.forEach((genre) => {
        els.genre.appendChild(el("option", { value: genre.id, text: genre.label }));
    });
    els.genre.value = "fantasy";
    els.genreBlurb.textContent = getGenre("fantasy").blurb;
    els.seed.value = randomSeedWord();

    refreshAiPanel();
    store.subscribe(render);

    // Reopen whatever was last worked on.
    if (store.state.library.length) {
        store.open(JSON.parse(JSON.stringify(store.state.library[0].data)), { undoable: false });
    } else {
        render();
    }
}

init();
