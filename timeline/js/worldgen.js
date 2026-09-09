// World construction: turns a premise plus a seed into a cast of entities that
// events can then be written about.

import { PALETTES, ENTITY_KINDS } from "./lexicon.js";
import { uid } from "./rng.js";

const STOPWORDS = new Set([
    "the", "a", "an", "and", "or", "but", "of", "in", "on", "at", "to", "for", "with", "from",
    "that", "this", "these", "those", "it", "its", "is", "are", "was", "were", "be", "been",
    "as", "by", "into", "about", "over", "after", "before", "their", "they", "them", "his",
    "her", "he", "she", "we", "you", "i", "my", "our", "who", "which", "where", "when", "how",
    "story", "timeline", "world", "about", "make", "create", "generate", "please", "some", "very"
]);

// Words that are capitalised only because a sentence started, or because they
// are numerals. Neither makes a good name for a faction.
const NOT_A_NAME = new Set([
    "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "first", "second", "third", "last", "next", "every", "each", "both", "another",
    "after", "before", "during", "when", "while", "since", "there", "here", "then",
    "what", "why", "how", "where", "who", "all", "many", "most", "much", "more",
    "new", "old", "also", "but", "and", "for", "the", "this", "that", "these", "those",
    "it", "its", "they", "them", "their", "he", "she", "his", "her", "we", "our", "you",
    "a", "an", "in", "on", "at", "to", "of", "if", "so", "no", "not", "some", "any"
]);

/**
 * Pulls usable material out of whatever the user typed. Capitalised words
 * become candidate proper names; everything else becomes motif vocabulary the
 * event writer can weave back in, so the premise visibly shapes the output.
 */
export function extractSeeds(premise) {
    const text = String(premise || "").trim();
    if (!text) return { properNouns: [], motifs: [] };

    const properNouns = [];
    const sentences = text.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
        const words = sentence.split(/\s+/);
        let run = [];
        words.forEach((word, index) => {
            const clean = word.replace(/[^A-Za-z0-9'-]/g, "");
            const isCapped = /^[A-Z][a-z'-]+$/.test(clean) || /^[A-Z]{2,}$/.test(clean);
            if (isCapped && !NOT_A_NAME.has(clean.toLowerCase())) {
                run.push(clean);
            } else {
                if (run.length) properNouns.push(run.join(" "));
                run = [];
            }
        });
        if (run.length) properNouns.push(run.join(" "));
    }

    const rawMotifs = Array.from(
        new Set(
            text
                .toLowerCase()
                .split(/[^a-z-]+/)
                .filter((w) => w.length > 4 && !STOPWORDS.has(w))
        )
    );
    const motifs = rawMotifs;

    return {
        properNouns: Array.from(new Set(properNouns)).filter((n) => !STOPWORDS.has(n.toLowerCase())),
        motifs: motifs.filter((w) => !NOT_A_NAME.has(w))
    };
}

function syllable(rng, palette, allowCoda) {
    const onset = rng.pick(palette.onsets);
    const nucleus = rng.pick(palette.nuclei);
    const coda = allowCoda && rng.chance(0.55) ? rng.pick(palette.codas) : "";
    return onset + nucleus + coda;
}

function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Rejects the vowel soup and consonant pile-ups that random syllable stitching
 * produces every so often. A name a reader cannot say is a name they skip.
 */
function isPronounceable(name) {
    const lower = name.toLowerCase();
    if (/[aeiouy]{4,}/.test(lower)) return false;
    if (/[^aeiouy]{4,}/.test(lower)) return false;
    if (!/[aeiou]/.test(lower)) return false;
    if (!/[^aeiouy]/.test(lower)) return false;
    if (/(.)\1/.test(lower.slice(0, 2))) return false;
    return true;
}

/**
 * A namer keeps a per-world phonetic palette so that invented names sound like
 * they come from the same language, and refuses to hand out the same name twice.
 */
export function makeNamer(rng, genre, seeds = { properNouns: [] }) {
    const paletteIds = rng.sample(genre.palettes, Math.min(2, genre.palettes.length));
    const palettes = paletteIds.map((id) => PALETTES[id]);
    const used = new Set();
    const reserve = rng.shuffle(seeds.properNouns.slice(0, 12));

    function invent(minSyllables = 2, maxSyllables = 3) {
        const palette = rng.pick(palettes);
        for (let attempt = 0; attempt < 40; attempt += 1) {
            const count = rng.int(minSyllables, maxSyllables);
            let name = "";
            for (let i = 0; i < count; i += 1) {
                name += syllable(rng, palette, i === count - 1);
            }
            name = capitalize(name.replace(/(.)\1{2,}/g, "$1$1"));
            if (name.length >= 4 && name.length <= 12 && isPronounceable(name) && !used.has(name.toLowerCase())) {
                used.add(name.toLowerCase());
                return name;
            }
        }
        const fallback = capitalize(syllable(rng, rng.pick(palettes), true) + rng.int(2, 99));
        used.add(fallback.toLowerCase());
        return fallback;
    }

    // Prefer names the user actually supplied, then fall back to invention.
    function claim(minSyllables, maxSyllables) {
        while (reserve.length) {
            const candidate = reserve.shift();
            if (!used.has(candidate.toLowerCase())) {
                used.add(candidate.toLowerCase());
                return candidate;
            }
        }
        return invent(minSyllables, maxSyllables);
    }

    return { invent, claim, used, paletteIds };
}

function factionName(rng, genre, namer) {
    const { adjective, group } = genre.words;
    const roll = rng();
    if (roll < 0.34) return `The ${rng.pick(adjective)} ${rng.pick(group)}`;
    if (roll < 0.68) return `${namer.claim(2, 3)} ${rng.pick(group)}`;
    return `The ${rng.pick(group)} of ${namer.claim(2, 3)}`;
}

function placeName(rng, genre, namer) {
    const { adjective, placeKind } = genre.words;
    const roll = rng();
    if (roll < 0.45) return `${namer.claim(2, 3)} ${rng.pick(placeKind)}`;
    if (roll < 0.75) return `The ${rng.pick(adjective)} ${rng.pick(placeKind)}`;
    return namer.claim(2, 4);
}

function personName(rng, genre, namer) {
    const given = namer.claim(2, 3);
    if (rng.chance(0.45)) return `${given} ${namer.invent(1, 2)}`;
    if (rng.chance(0.5)) return `${given} the ${rng.pick(genre.words.adjective)}`;
    return given;
}

function artifactName(rng, genre, namer) {
    const { adjective, artifactKind } = genre.words;
    const roll = rng();
    if (roll < 0.45) return `The ${rng.pick(adjective)} ${rng.pick(artifactKind)}`;
    if (roll < 0.75) return `The ${rng.pick(artifactKind)} of ${namer.claim(2, 3)}`;
    return `${namer.claim(2, 3)}'s ${rng.pick(artifactKind)}`;
}

function makeEntity(kind, name, extra = {}) {
    return {
        id: uid("ent"),
        kind,
        name,
        epithet: extra.epithet || "",
        status: extra.status || "active",
        note: extra.note || "",
        firstEventId: null
    };
}

/**
 * Builds the cast. Sizes are deliberately small — a timeline with six factions
 * and thirty events reads as noise, while four factions read as a history.
 */
export function buildWorld(rng, genre, premise, options = {}) {
    const seeds = extractSeeds(premise);
    const namer = makeNamer(rng, genre, seeds);
    const scale = options.scale || "medium";
    const sizes = {
        small: { faction: 2, person: 3, place: 3, artifact: 2, force: 1 },
        medium: { faction: 3, person: 5, place: 4, artifact: 3, force: 2 },
        large: { faction: 4, person: 7, place: 6, artifact: 4, force: 2 }
    }[scale] || { faction: 3, person: 5, place: 4, artifact: 3, force: 2 };

    const entities = [];

    for (let i = 0; i < sizes.faction; i += 1) {
        entities.push(
            makeEntity("faction", factionName(rng, genre, namer), {
                note: `${rng.pick(["Ascendant", "Established", "Diminished", "Insular", "Expansionist"])} at the opening of the record.`
            })
        );
    }
    for (let i = 0; i < sizes.place; i += 1) {
        // Places start unfounded so the record can show them being settled.
        entities.push(makeEntity("place", placeName(rng, genre, namer), { status: "unknown" }));
    }
    for (let i = 0; i < sizes.person; i += 1) {
        entities.push(
            makeEntity("person", personName(rng, genre, namer), {
                epithet: rng.pick(genre.words.role)
            })
        );
    }
    for (let i = 0; i < sizes.artifact; i += 1) {
        // Half already exist and are waiting to be found; half have yet to be made.
        entities.push(
            makeEntity("artifact", artifactName(rng, genre, namer), {
                status: i % 2 === 0 ? "hidden" : "unknown"
            })
        );
    }
    for (let i = 0; i < sizes.force; i += 1) {
        entities.push(makeEntity("force", rng.pick(genre.words.force), { status: "latent" }));
    }

    // Bind figures to factions so allegiance shifts can matter later.
    const factions = entities.filter((e) => e.kind === "faction");
    entities
        .filter((e) => e.kind === "person")
        .forEach((person) => {
            const home = rng.pick(factions);
            person.affiliation = home ? home.id : null;
        });

    return { entities, namer, seeds, paletteIds: namer.paletteIds };
}

/**
 * Mints one new entity mid-history — used when a faction splits, refugees found
 * a settlement, or a successor state appears.
 */
export function createEntity(rng, genre, namer, kind) {
    switch (kind) {
        case "faction":
            return makeEntity("faction", factionName(rng, genre, namer));
        case "place":
            return makeEntity("place", placeName(rng, genre, namer), { status: "unknown" });
        case "person":
            return makeEntity("person", personName(rng, genre, namer), { epithet: rng.pick(genre.words.role) });
        case "artifact":
            return makeEntity("artifact", artifactName(rng, genre, namer), { status: "unknown" });
        default:
            return makeEntity("force", rng.pick(genre.words.force), { status: "latent" });
    }
}

export function blankEntity(kind, name) {
    return makeEntity(kind, name || "Unnamed");
}

export function entityIcon(kind) {
    return (ENTITY_KINDS[kind] || {}).icon || "•";
}

export function entityLabel(kind) {
    return (ENTITY_KINDS[kind] || {}).label || kind;
}
