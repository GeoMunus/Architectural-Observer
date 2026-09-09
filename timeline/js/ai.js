// Optional model-backed generation.
//
// Two backends, same output contract as the built-in engine:
//   * `runtime`  — the page is running somewhere that exposes window.claude
//   * `apiKey`   — the user supplied an Anthropic API key, called direct from
//                  the browser
// When neither is available the app falls back to the local engine, which is
// why the whole thing still works offline.

import { uid } from "./rng.js";
import { getGenre, formatTime } from "./generator.js";

export function detectBackends() {
    const runtime =
        typeof window !== "undefined" &&
        window.claude &&
        typeof window.claude.complete === "function";
    return { runtime: Boolean(runtime) };
}

const SYSTEM_PROMPT = `You write fictional historical records. You are given a world (its factions, figures, places, artifacts and forces) and the events recorded so far.

Rules:
- Invent nothing outside the fiction. This is a made-up history; never present it as real.
- Reuse the existing cast wherever possible. Introduce a new name only when the event genuinely needs one.
- Every event must be a consequence of something already in the record, or set up something later.
- Write like a historian, not a blurb: concrete, specific, understated. Two or three sentences of body text.
- Vary scale. Not every event is a war; treaties, ledgers, bad harvests and quiet retirements carry a history too.
- Times must increase monotonically and stay in the same calendar as the existing events.

Reply with JSON only, no prose around it, in exactly this shape:
{"events":[{"time":812,"timeLabel":"Year 812","title":"...","body":"...","era":"...","tags":["war"],"importance":4,"cast":[{"name":"...","kind":"faction"}]}]}

"kind" is one of: faction, person, place, artifact, force. "importance" is 1-5.`;

function describeWorld(timeline) {
    const genre = getGenre(timeline.genreId);
    const byKind = {};
    timeline.entities.forEach((e) => {
        (byKind[e.kind] = byKind[e.kind] || []).push(
            `${e.name}${e.epithet ? ` (${e.epithet})` : ""}${e.status && e.status !== "active" ? ` [${e.status}]` : ""}`
        );
    });
    const cast = Object.entries(byKind)
        .map(([kind, names]) => `${kind}: ${names.join("; ")}`)
        .join("\n");

    return `Genre: ${genre.label} — ${genre.blurb}
Premise: ${timeline.premise || "(none given)"}
Calendar: events are labelled like "${formatTime(genre, 500)}".

Cast:
${cast}`;
}

function describeEvents(events, limit = 18) {
    const slice = events.slice(-limit);
    if (!slice.length) return "(the record is empty)";
    return slice
        .map((e) => `${e.timeLabel} — ${e.title}\n    ${e.body}`)
        .join("\n");
}

function buildPrompt({ timeline, mode, count, instruction, anchor, nextEvent }) {
    const world = describeWorld(timeline);
    const record = describeEvents(timeline.events);
    const steer = instruction ? `\n\nThe user asks specifically for: ${instruction}` : "";

    if (mode === "create") {
        return `${world}

Write the opening ${count} events of this history, beginning with a founding or first contact and building toward a first source of tension.${steer}`;
    }
    if (mode === "expand") {
        return `${world}

The record so far:
${record}

Write ${count} smaller connecting events that happen strictly between these two:
  A: ${anchor.timeLabel} — ${anchor.title}
  B: ${nextEvent ? `${nextEvent.timeLabel} — ${nextEvent.title}` : "(the end of the record)"}
They must fall between those times, be lower in importance than A, and explain how A led to B.${steer}`;
    }
    if (mode === "backward") {
        const first = timeline.events[0];
        return `${world}

The record currently opens with:
${first ? `${first.timeLabel} — ${first.title}\n    ${first.body}` : "(nothing)"}

Write ${count} earlier events that lead up to that opening. They must be dated before ${
            first ? first.timeLabel : "the record"
        } and must make that opening feel inevitable.${steer}`;
    }
    return `${world}

The record so far:
${record}

Continue the history with ${count} further events, picking up every unresolved thread — wars still running, artifacts still missing, grudges still owed.${steer}`;
}

function extractJson(text) {
    const trimmed = String(text || "").trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1] : trimmed;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("The model did not return JSON.");
    return JSON.parse(candidate.slice(start, end + 1));
}

async function callRuntime(prompt) {
    const reply = await window.claude.complete(`${SYSTEM_PROMPT}\n\n${prompt}`);
    return extractJson(reply);
}

async function callApi(prompt, { apiKey, model }) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
            model: model || "claude-sonnet-5",
            max_tokens: 4000,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: prompt }]
        })
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Anthropic API ${response.status}: ${detail.slice(0, 240)}`);
    }
    const payload = await response.json();
    const text = (payload.content || []).map((block) => block.text || "").join("");
    return extractJson(text);
}

/**
 * Turns the model's loose output into events the editor understands, creating
 * any entity it named that the world does not already have.
 */
export function reconcile(timeline, rawEvents, { era = "", act = "expansion" } = {}) {
    const genre = getGenre(timeline.genreId);
    const byName = new Map(timeline.entities.map((e) => [e.name.toLowerCase(), e]));
    const events = [];

    (rawEvents || []).forEach((raw) => {
        if (!raw || !raw.title) return;

        const entityIds = [];
        (raw.cast || []).forEach((member) => {
            const name = String(member && member.name ? member.name : member || "").trim();
            if (!name) return;
            let entity = byName.get(name.toLowerCase());
            if (!entity) {
                const kind = ["faction", "person", "place", "artifact", "force"].includes(member.kind)
                    ? member.kind
                    : "person";
                entity = {
                    id: uid("ent"),
                    kind,
                    name,
                    epithet: "",
                    status: "active",
                    note: "Introduced by the model.",
                    firstEventId: null
                };
                timeline.entities.push(entity);
                byName.set(name.toLowerCase(), entity);
            }
            entityIds.push(entity.id);
        });

        const time = Number.isFinite(Number(raw.time)) ? Number(raw.time) : null;
        events.push({
            id: uid("evt"),
            time,
            timeLabel: raw.timeLabel || (time === null ? "" : formatTime(genre, time)),
            title: String(raw.title).trim(),
            body: String(raw.body || "").trim(),
            act: raw.act || act,
            era: raw.era || era,
            tags: Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 5) : [],
            importance: Math.min(5, Math.max(1, Number(raw.importance) || 3)),
            entityIds,
            causes: [],
            beatId: null,
            cast: null,
            createdEntityId: null,
            source: "model",
            pinned: false
        });
    });

    return events;
}

/**
 * Runs a generation through whichever backend the user selected. Throws with a
 * readable message so the UI can offer to fall back to the local engine.
 */
export async function generateWithModel(options) {
    const { settings } = options;
    const prompt = buildPrompt(options);
    const backends = detectBackends();

    if (settings.aiMode === "runtime") {
        if (!backends.runtime) throw new Error("This page has no Claude runtime available.");
        return callRuntime(prompt);
    }
    if (settings.aiMode === "api") {
        if (!settings.apiKey) throw new Error("Add an Anthropic API key in Settings first.");
        return callApi(prompt, settings);
    }
    throw new Error("Model generation is switched off.");
}
