// The generator. Walks a dramatic arc, picks beats whose preconditions the
// current world state satisfies, binds a cast to them, and records both the
// resulting event and the state change it caused.

import { GENRES, ACTS, ERA_NAME_PATTERNS, ERA_NOUNS } from "./lexicon.js";
import { makeRng, hashString, uid } from "./rng.js";
import { BEATS, BEATS_BY_ACT } from "./beats.js";
import { buildWorld, makeNamer, createEntity } from "./worldgen.js";

const ACT_TEMPO = {
    genesis: 1.5,
    expansion: 1.25,
    tension: 0.9,
    crisis: 0.6,
    cataclysm: 0.45,
    aftermath: 0.9,
    legacy: 1.6
};

export function getGenre(genreId) {
    return GENRES[genreId] || GENRES.fantasy;
}

export function formatTime(genre, value) {
    const n = Math.round(value);
    const pretty = Math.abs(n) >= 10000 ? n.toLocaleString("en-US") : String(n);
    return genre.time.unit ? `${genre.time.unit} ${pretty}` : pretty;
}

// ---------------------------------------------------------------------------
// World state, rebuilt by replaying an existing timeline's events.
// ---------------------------------------------------------------------------

function relationKey(a, b) {
    return [a, b].sort().join("|");
}

function makeState(timeline) {
    const state = {
        entities: timeline.entities,
        byId: new Map(timeline.entities.map((e) => [e.id, e])),
        relations: new Map(),
        owners: new Map(),
        leaders: new Map(),
        flags: new Map(),
        lastEventByEntity: new Map(),
        spotlight: [],
        recentBeats: [],
        beatUses: new Map(),
        availableIds: null
    };

    state.get = (id) => state.byId.get(id);
    state.relation = (a, b) => state.relations.get(relationKey(a.id, b.id)) || "neutral";
    state.touch = (entity, eventId) => {
        state.lastEventByEntity.set(entity.id, eventId);
        state.spotlight = [entity.id, ...state.spotlight.filter((id) => id !== entity.id)].slice(0, 6);
    };
    return state;
}

/**
 * Applies one event's declared effects to the state. Called both while
 * generating and while replaying a saved timeline.
 */
function applyEffects(state, beatDef, cast, created, eventId) {
    const api = {
        ...cast,
        created,
        setStatus: (entity, status) => {
            if (entity) entity.status = status;
        },
        setRelation: (a, b, value) => {
            if (a && b) state.relations.set(relationKey(a.id, b.id), value);
        },
        claim: (thing, owner) => {
            if (thing && owner) state.owners.set(thing.id, owner.id);
        },
        claimById: (thing, ownerId) => {
            if (thing && ownerId) state.owners.set(thing.id, ownerId);
        },
        setLeader: (faction, person) => {
            if (faction && person) state.leaders.set(faction.id, person.id);
        },
        flag: (key) => state.flags.set(key, eventId)
    };
    try {
        beatDef.effects(api);
    } catch (err) {
        // A malformed hand-edited event should never take the whole app down.
        console.warn("beat effects failed", beatDef.id, err);
    }
}

export function replayState(timeline) {
    const state = makeState(timeline);
    for (const event of timeline.events) {
        if (!event.beatId || !event.cast) continue;
        const beatDef = BEATS.find((b) => b.id === event.beatId);
        if (!beatDef) continue;
        const cast = {};
        for (const [slot, entityId] of Object.entries(event.cast)) {
            cast[slot] = state.get(entityId);
        }
        const created = event.createdEntityId ? state.get(event.createdEntityId) : null;
        applyEffects(state, beatDef, cast, created, event.id);
        Object.values(cast).forEach((entity) => entity && state.touch(entity, event.id));
    }
    return state;
}

// ---------------------------------------------------------------------------
// Cast binding
// ---------------------------------------------------------------------------

function matchesFilter(entity, kind, filter, state, bound) {
    if (!entity || entity.kind !== kind) return false;
    if (!filter) return true;

    const [name, ref] = filter.split(":");
    const other = ref ? bound[ref] : null;

    switch (name) {
        case "alive":
            return entity.status !== "fallen" && entity.status !== "dead";
        case "dead":
            return entity.status === "dead";
        case "fallen":
            return entity.status === "fallen";
        case "atWar":
            return Array.from(state.relations.entries()).some(
                ([key, value]) => value === "war" && key.split("|").includes(entity.id)
            );
        case "atWarWith":
            return Boolean(other) && state.relation(entity, other) === "war";
        case "hostileTo":
            return Boolean(other) && ["hostile", "war"].includes(state.relation(entity, other));
        case "unfounded":
            return entity.status === "unknown";
        case "unclaimed":
            return !state.owners.has(entity.id);
        case "settled":
            return ["settled", "besieged", "stricken"].includes(entity.status);
        case "ruined":
            return entity.status === "ruined";
        case "uncreated":
            return entity.status === "unknown";
        case "hidden":
            return entity.status === "hidden";
        case "held":
            return entity.status === "held";
        case "known":
            return entity.status !== "unknown";
        default:
            return true;
    }
}

function bindCast(rng, beatDef, state) {
    const bound = {};
    const taken = new Set();

    for (const [slot, spec] of Object.entries(beatDef.cast || {})) {
        const [kind, ...rest] = spec.split(":");
        const filter = rest.join(":");
        const candidates = state.entities.filter(
            (e) =>
                !taken.has(e.id) &&
                (!state.availableIds || state.availableIds.has(e.id)) &&
                matchesFilter(e, kind, filter, state, bound)
        );
        if (!candidates.length) return null;

        // Bias toward entities already in play so a history keeps its through-lines,
        // but not so hard that the rest of the cast never appears.
        const chosen = rng.pickWeighted(candidates, (e) => {
            const spotlightIndex = state.spotlight.indexOf(e.id);
            const recency = spotlightIndex === -1 ? 1 : 2.4 - spotlightIndex * 0.3;
            const freshness = state.lastEventByEntity.has(e.id) ? 1 : 1.5;
            return recency * freshness;
        });
        bound[slot] = chosen;
        taken.add(chosen.id);
    }
    return bound;
}

// ---------------------------------------------------------------------------
// Prose context
// ---------------------------------------------------------------------------

const CONSEQUENCES = [
    "The consequences take a generation to become obvious.",
    "It is recorded as routine and is not.",
    "Two other parties immediately adjust their plans.",
    "The cost is paid by people who are not named in the record.",
    "Nobody objects loudly enough to be remembered for objecting.",
    "It sets a precedent that is cited for two centuries, usually wrongly.",
    "The decision is reversed later, at much greater expense.",
    "Everyone involved considers it a minor administrative matter."
];

function makeContext(rng, genre, cast, created, motifs) {
    const ctx = {
        ...cast,
        created,
        pick: (list) => rng.pick(list),
        w: (bank) => rng.pick(genre.words[bank] || genre.words.adjective),
        capitalize: (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1),
        pFirst: (person) => (person ? String(person.name).split(" ")[0] : "They"),
        consequence: () => {
            if (motifs.length && rng.chance(0.18)) {
                const motif = rng.pick(motifs);
                return rng.pick([
                    `Later accounts trace this back to a question of ${motif}.`,
                    `It is the first entry anyone files under "${motif}".`,
                    `Arguments about ${motif} date from here.`
                ]);
            }
            return rng.pick(CONSEQUENCES);
        }
    };
    return ctx;
}

// ---------------------------------------------------------------------------
// Era naming
// ---------------------------------------------------------------------------

function eraName(rng, genre, act, timeline) {
    const places = (timeline.entities || []).filter((e) => e.kind === "place");
    const place = places.length ? rng.pick(places).name : rng.pick(genre.words.placeKind);
    return rng.pick(ERA_NAME_PATTERNS)
        .replace("{adjective}", rng.pick(genre.words.adjective))
        .replace("{noun}", rng.pick(ERA_NOUNS[act] || ERA_NOUNS.legacy))
        .replace("{place}", place);
}

/**
 * Entities that only exist because a later event invented them. Generating
 * prehistory, or re-rolling an early event, must not reach forward for them.
 */
function idsBornAtOrAfter(timeline, index) {
    const born = new Set();
    timeline.events.slice(index).forEach((event) => {
        if (event.createdEntityId) born.add(event.createdEntityId);
    });
    return born;
}

function restrictToKnownAt(state, timeline, index) {
    const born = idsBornAtOrAfter(timeline, index);
    state.availableIds = new Set(state.entities.filter((e) => !born.has(e.id)).map((e) => e.id));
}

// ---------------------------------------------------------------------------
// Event generation
// ---------------------------------------------------------------------------

function generateEvent(rng, genre, state, timeline, act, time, era, options = {}) {
    let shuffled = rng.shuffle((BEATS_BY_ACT[act] || []).slice());
    if (options.preferTag) {
        // Used to make a history open on a founding rather than a portent.
        shuffled = shuffled
            .filter((b) => b.tags.includes(options.preferTag))
            .concat(shuffled.filter((b) => !b.tags.includes(options.preferTag)));
    }

    for (const beatDef of shuffled) {
        // A beat that has already carried an event is a weaker candidate for the
        // next one, and a much weaker one for the fifth.
        const uses = state.beatUses.get(beatDef.id) || 0;
        const recentPenalty = state.recentBeats.includes(beatDef.id) ? 0.1 : 1;
        const usePenalty = 1 / (1 + uses * 1.1);
        const odds = beatDef.weight * recentPenalty * usePenalty * (options.preferTag ? 1.6 : 0.62);
        if (!rng.chance(Math.min(1, odds))) continue;

        const cast = bindCast(rng, beatDef, state);
        if (!cast) continue;
        if (!beatDef.requires({ ...cast, state })) continue;

        let created = null;
        if (beatDef.creates) {
            created = createEntity(rng, genre, state.namer, beatDef.creates);
            state.entities.push(created);
            state.byId.set(created.id, created);
        }

        const ctx = makeContext(rng, genre, cast, created, timeline.motifs || []);
        let title;
        let body;
        try {
            title = beatDef.title(ctx);
            body = beatDef.body(ctx);
        } catch (err) {
            console.warn("beat text failed", beatDef.id, err);
            continue;
        }

        const castIds = {};
        Object.entries(cast).forEach(([slot, entity]) => {
            castIds[slot] = entity.id;
        });

        const entityIds = Object.values(cast).map((e) => e.id);
        if (created) entityIds.push(created.id);

        const causes = Array.from(
            new Set(entityIds.map((id) => state.lastEventByEntity.get(id)).filter(Boolean))
        ).slice(0, 2);

        const event = {
            id: uid("evt"),
            time,
            timeLabel: formatTime(genre, time),
            title,
            body,
            act,
            era,
            tags: beatDef.tags.slice(),
            importance: rng.int(beatDef.importance[0], beatDef.importance[1]),
            entityIds,
            causes,
            beatId: beatDef.id,
            cast: castIds,
            createdEntityId: created ? created.id : null,
            source: "engine",
            pinned: false
        };

        applyEffects(state, beatDef, cast, created, event.id);
        Object.values(cast).forEach((entity) => state.touch(entity, event.id));
        if (created) {
            state.touch(created, event.id);
            created.firstEventId = event.id;
        }
        entityIds.forEach((id) => {
            const entity = state.get(id);
            if (entity && !entity.firstEventId) entity.firstEventId = event.id;
        });

        state.beatUses.set(beatDef.id, (state.beatUses.get(beatDef.id) || 0) + 1);
        state.recentBeats = [beatDef.id, ...state.recentBeats].slice(0, 5);
        return event;
    }
    return null;
}

/**
 * Distributes `count` events across the dramatic arc, starting from `startAct`.
 * Later acts get proportionally more room, because that is where the
 * consequences of everything earlier come due.
 */
function planActs(rng, count, startIndex = 0) {
    const plan = [];
    const acts = ACTS.slice(Math.max(0, Math.min(startIndex, ACTS.length - 1)));
    const usable = acts.length ? acts : ACTS;
    const weights = usable.map((a) => a.weightHint);
    const total = weights.reduce((a, b) => a + b, 0);

    usable.forEach((act, index) => {
        const share = Math.max(1, Math.round((weights[index] / total) * count));
        for (let i = 0; i < share; i += 1) plan.push(act.id);
    });

    // Trim or pad to exactly `count`, padding from the late acts.
    while (plan.length > count) plan.pop();
    while (plan.length < count) plan.push(usable[usable.length - 1].id);
    return plan;
}

function attachNamer(state, rng, genre, timeline) {
    const namer = makeNamer(rng, genre, { properNouns: [] });
    timeline.entities.forEach((e) => namer.used.add(e.name.toLowerCase()));
    state.namer = namer;
    return state;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createTimeline({ premise = "", genreId = "fantasy", seed, length = 14, scale = "medium" } = {}) {
    const genre = getGenre(genreId);
    const resolvedSeed = seed || `${genreId}-${Date.now().toString(36)}`;
    const rng = makeRng(hashString(`${resolvedSeed}|${premise}`));

    const world = buildWorld(rng, genre, premise, { scale });

    const timeline = {
        id: uid("tl"),
        title: "",
        premise,
        genreId: genre.id,
        seed: resolvedSeed,
        scale,
        motifs: world.seeds.motifs.slice(0, 8),
        entities: world.entities,
        events: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        branchOf: null
    };

    const state = makeState(timeline);
    state.namer = world.namer;

    let time = rng.int(genre.time.start[0], genre.time.start[1]);
    const plan = planActs(rng, length);
    let currentAct = null;
    let currentEra = "";

    for (const act of plan) {
        if (act !== currentAct) {
            currentAct = act;
            currentEra = eraName(rng, genre, act, timeline);
        }
        const event = generateEvent(rng, genre, state, timeline, act, time, currentEra, {
            preferTag: timeline.events.length === 0 ? "founding" : null
        });
        if (event) {
            timeline.events.push(event);
            time += Math.max(1, Math.round(rng.spread(genre.time.step[0], genre.time.step[1]) * ACT_TEMPO[act]));
        } else {
            time += rng.int(genre.time.step[0], genre.time.step[1]);
        }
    }

    timeline.title = deriveTitle(rng, genre, timeline);
    return timeline;
}

function deriveTitle(rng, genre, timeline) {
    const factions = timeline.entities.filter((e) => e.kind === "faction");
    const places = timeline.entities.filter((e) => e.kind === "place");
    const anchor = rng.pick(factions.length ? factions : places);
    const patterns = [
        `A History of ${anchor ? anchor.name : "the Record"}`,
        `The ${rng.pick(genre.words.adjective)} Record`,
        `${anchor ? anchor.name : "The Record"}: A Chronicle`,
        `Annals of the ${rng.pick(genre.words.adjective)} Age`
    ];
    return rng.pick(patterns);
}

/**
 * Continues an existing timeline forward. Picks up the world exactly where the
 * last event left it, so extensions inherit every war, death and grudge.
 */
export function extendForward(timeline, count = 5) {
    const genre = getGenre(timeline.genreId);
    const rng = makeRng(hashString(`${timeline.seed}|forward|${timeline.events.length}|${Date.now()}`));
    const state = replayState(timeline);
    attachNamer(state, rng, genre, timeline);

    const last = timeline.events[timeline.events.length - 1];
    let time = last ? last.time : rng.int(genre.time.start[0], genre.time.start[1]);
    const startActIndex = last ? Math.max(0, ACTS.findIndex((a) => a.id === last.act)) : 0;

    // Continuing past the end of the arc loops back through the middle acts:
    // fracture, crisis and aftermath repeat, which is what histories do.
    const cycle = startActIndex >= ACTS.length - 1 ? ACTS.slice(2) : ACTS.slice(startActIndex);
    const plan = planActs(rng, count, ACTS.indexOf(cycle[0]));

    const added = [];
    let currentAct = last ? last.act : null;
    let currentEra = last ? last.era : "";

    for (const act of plan) {
        time += Math.max(1, Math.round(rng.spread(genre.time.step[0], genre.time.step[1]) * ACT_TEMPO[act]));
        if (act !== currentAct) {
            currentAct = act;
            currentEra = eraName(rng, genre, act, timeline);
        }
        const event = generateEvent(rng, genre, state, timeline, act, time, currentEra);
        if (event) {
            timeline.events.push(event);
            added.push(event);
        }
    }

    timeline.entities = state.entities;
    timeline.updatedAt = Date.now();
    return added;
}

/**
 * Generates deeper history *before* the current opening — the backstory that
 * the existing first event implies.
 */
export function extendBackward(timeline, count = 4) {
    const genre = getGenre(timeline.genreId);
    const rng = makeRng(hashString(`${timeline.seed}|back|${timeline.events.length}|${Date.now()}`));

    // Prehistory is generated against a fresh world state: the point is what
    // came before the record, so later flags must not constrain it.
    const scratch = { ...timeline, events: [] };
    const state = makeState(scratch);
    state.entities = timeline.entities;
    state.byId = new Map(timeline.entities.map((e) => [e.id, e]));
    attachNamer(state, rng, genre, timeline);

    const first = timeline.events[0];
    const endTime = first ? first.time : rng.int(genre.time.start[0], genre.time.start[1]);
    const rawSteps = [];
    for (let i = 0; i < count; i += 1) {
        rawSteps.push(Math.max(1, Math.round(rng.spread(genre.time.step[0], genre.time.step[1]) * 1.4)));
    }
    // Keep prehistory above zero: if the arc would run off the start of the
    // calendar, compress the gaps rather than emitting negative years.
    const totalBack = rawSteps.reduce((a, b) => a + b, 0);
    const headroom = endTime - 1;
    const squeeze = totalBack > headroom && headroom > count ? headroom / totalBack : 1;

    const gaps = [];
    let cursor = endTime;
    for (let i = 0; i < count; i += 1) {
        cursor -= Math.max(1, Math.round(rawSteps[i] * squeeze));
        gaps.unshift(cursor);
    }

    restrictToKnownAt(state, timeline, 0);
    const era = eraName(rng, genre, "genesis", timeline);
    const added = [];
    gaps.forEach((time, index) => {
        const act = index < gaps.length - 1 ? "genesis" : "expansion";
        const event = generateEvent(rng, genre, state, timeline, act, time, era, {
            preferTag: index === 0 ? "founding" : null
        });
        if (event) added.push(event);
    });

    timeline.events = added.concat(timeline.events);
    timeline.entities = state.entities;
    timeline.updatedAt = Date.now();
    return added;
}

/**
 * Fills in the gap after a chosen event with smaller connecting events, for
 * when a single line of the record deserves to be a chapter.
 */
export function expandAfter(timeline, eventId, count = 3) {
    const genre = getGenre(timeline.genreId);
    const index = timeline.events.findIndex((e) => e.id === eventId);
    if (index === -1) return [];

    const rng = makeRng(hashString(`${timeline.seed}|expand|${eventId}|${Date.now()}`));
    const anchor = timeline.events[index];
    const next = timeline.events[index + 1];

    // Replay only up to the anchor so inserted events see the world as it was.
    const prefix = { ...timeline, events: timeline.events.slice(0, index + 1) };
    const state = replayState(prefix);
    state.entities = timeline.entities;
    state.byId = new Map(timeline.entities.map((e) => [e.id, e]));
    attachNamer(state, rng, genre, timeline);

    restrictToKnownAt(state, timeline, index + 1);

    const span = next ? next.time - anchor.time : genre.time.step[1] * count;
    const step = Math.max(1, Math.floor(span / (count + 1)));

    const added = [];
    for (let i = 1; i <= count; i += 1) {
        const time = anchor.time + step * i;
        const event = generateEvent(rng, genre, state, timeline, anchor.act, time, anchor.era);
        if (!event) continue;
        event.importance = Math.max(1, anchor.importance - 1);
        if (!event.causes.includes(anchor.id)) event.causes.unshift(anchor.id);
        added.push(event);
    }

    timeline.events.splice(index + 1, 0, ...added);
    timeline.entities = state.entities;
    timeline.updatedAt = Date.now();
    return added;
}

/**
 * Forks an alternate history: keeps everything up to and including the chosen
 * event, then re-rolls the future from a different seed.
 */
export function branchFrom(timeline, eventId, count = 8) {
    const index = timeline.events.findIndex((e) => e.id === eventId);
    if (index === -1) return null;

    const clone = JSON.parse(JSON.stringify(timeline));
    clone.id = uid("tl");
    clone.seed = `${timeline.seed}~${Math.random().toString(36).slice(2, 7)}`;
    clone.events = clone.events.slice(0, index + 1);
    clone.title = `${timeline.title} — Divergence`;
    clone.branchOf = { timelineId: timeline.id, eventId, title: timeline.title };
    clone.createdAt = Date.now();
    clone.updatedAt = Date.now();

    // Re-key ids so the branch and its parent can coexist in storage.
    const idMap = new Map();
    clone.entities.forEach((e) => {
        const fresh = uid("ent");
        idMap.set(e.id, fresh);
        e.id = fresh;
    });
    clone.events.forEach((e) => {
        const fresh = uid("evt");
        idMap.set(e.id, fresh);
        e.id = fresh;
    });
    clone.entities.forEach((e) => {
        if (e.affiliation) e.affiliation = idMap.get(e.affiliation) || null;
        if (e.firstEventId) e.firstEventId = idMap.get(e.firstEventId) || null;
    });
    clone.events.forEach((e) => {
        e.entityIds = (e.entityIds || []).map((id) => idMap.get(id)).filter(Boolean);
        e.causes = (e.causes || []).map((id) => idMap.get(id)).filter(Boolean);
        if (e.cast) {
            Object.keys(e.cast).forEach((slot) => {
                e.cast[slot] = idMap.get(e.cast[slot]) || e.cast[slot];
            });
        }
        if (e.createdEntityId) e.createdEntityId = idMap.get(e.createdEntityId) || null;
    });
    clone.branchOf.eventId = idMap.get(eventId) || null;

    extendForward(clone, count);
    return clone;
}

/** Re-rolls a single event in place, keeping its position in the record. */
export function rerollEvent(timeline, eventId) {
    const genre = getGenre(timeline.genreId);
    const index = timeline.events.findIndex((e) => e.id === eventId);
    if (index === -1) return null;

    const original = timeline.events[index];
    const rng = makeRng(hashString(`${timeline.seed}|reroll|${eventId}|${Date.now()}`));
    const prefix = { ...timeline, events: timeline.events.slice(0, index) };
    const state = replayState(prefix);
    state.entities = timeline.entities;
    state.byId = new Map(timeline.entities.map((e) => [e.id, e]));
    attachNamer(state, rng, genre, timeline);

    restrictToKnownAt(state, timeline, index + 1);

    const replacement = generateEvent(rng, genre, state, timeline, original.act, original.time, original.era);
    if (!replacement) return null;

    replacement.id = original.id;
    replacement.timeLabel = original.timeLabel;
    timeline.events[index] = replacement;
    timeline.entities = state.entities;
    timeline.updatedAt = Date.now();
    return replacement;
}

export function blankEvent(genre, time) {
    return {
        id: uid("evt"),
        time,
        timeLabel: formatTime(genre, time),
        title: "New event",
        body: "",
        act: "expansion",
        era: "",
        tags: [],
        importance: 3,
        entityIds: [],
        causes: [],
        beatId: null,
        cast: null,
        createdEntityId: null,
        source: "manual",
        pinned: false
    };
}
