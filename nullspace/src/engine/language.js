import {
    ABBREVIATIONS, FILLERS_LEAD, FILLERS_TAIL, HEDGES, INTENSIFIERS,
    REACTION_EMOJI, TYPO_SWAPS
} from "../data/voice.js";

// Surface realisation. The dialogue engine produces a plain, lowercase,
// unpunctuated sentence; this turns it into something a specific person typed.
// Every transform is probabilistic so the same template never lands twice.

const EXTRA_CLAUSES = [
    "which is fine",
    "not that it helps",
    "and i say that with love",
    "for whatever thats worth",
    "at least thats my read",
    "im open to being wrong",
    "but ive been wrong before",
    "and it took me years to see it"
];

// Second messages people actually send: an afterthought, not a stray phrase.
const FOLLOW_UPS = [
    "anyway", "sorry that was long", "ignore me", "just thinking out loud",
    "no idea if that helps", "or maybe im wrong", "been thinking about it all week",
    "anyway thats my whole thing about it", "sorry, went off there",
    "wait no i take it back", "ok done", "im normal about this i promise"
];

const PARENTHETICALS = [
    "(sorry, long)", "(this is the tangent)", "(i have thought about this too much)",
    "(unrelated)", "(you know the one)", "(again)", "(as usual)", "(no notes)"
];

export function fillSlots(template, ctx, rng) {
    const filled = template.replace(/\{(\w+)\}/g, (match, key) => {
        const value = ctx[key];
        if (Array.isArray(value)) return rng.pick(value);
        if (typeof value === "function") return value();
        if (value === undefined || value === null) return match;
        return String(value);
    });
    // Lexicon entries carry their own determiner ("the drum bus", "my pothos"),
    // so a template that also supplies one would produce "the my pothos".
    return filled.replace(/\b(the|a|an|my|your)\s+(the|a|an|my|your|that|this|those|these)\s+/gi, "$2 ");
}

function capitalizeSentences(text) {
    return text
        .replace(/(^|[.!?]\s+)([a-z])/g, (m, lead, ch) => lead + ch.toUpperCase())
        .replace(/\bi\b/g, "I")
        .replace(/\bim\b/g, "I'm")
        .replace(/\bdont\b/g, "don't")
        .replace(/\bcant\b/g, "can't")
        .replace(/\bisnt\b/g, "isn't")
        .replace(/\bdoesnt\b/g, "doesn't")
        .replace(/\bthats\b/g, "that's")
        .replace(/\bits\b(?=\s+(a|the|not|just|been|going|still))/g, "it's")
        .replace(/\byoure\b/g, "you're")
        .replace(/\bive\b/g, "I've")
        .replace(/\bid\b/g, "I'd");
}

function applyAbbreviations(text, rate, rng) {
    let out = text;
    for (const [long, short] of ABBREVIATIONS) {
        if (!rng.chance(rate)) continue;
        out = out.replace(new RegExp(`\\b${long}\\b`, "gi"), short);
    }
    return out;
}

function applyTypos(text, rate, rng) {
    if (!rng.chance(rate)) return { text, typo: null };
    const candidates = TYPO_SWAPS.filter(([word]) => new RegExp(`\\b${word}\\b`).test(text));
    if (candidates.length === 0) return { text, typo: null };
    const [word, broken] = rng.pick(candidates);
    return {
        text: text.replace(new RegExp(`\\b${word}\\b`), broken),
        typo: word
    };
}

// Short-spoken people cut themselves off, but a fragment like "sorry, tangent"
// is noise rather than character — only keep a trim that still stands alone.
function trimToFirstClause(text) {
    const parts = text.split(/,\s+|\s+—\s+|\s+but\s+/);
    if (parts.length < 2) return text;
    const head = parts[0].trim();
    if (head.split(/\s+/).length < 4) return text;
    if (/\b(and|but|so|because|that|which|the|a|my)$/i.test(head)) return text;
    return head;
}

export function applyVoice(baseText, voice, rng, options = {}) {
    let text = String(baseText).trim();
    const followUps = [];

    // Length shaping first, so fillers attach to the final shape.
    if (voice.lengthBias < -0.3 && rng.chance(Math.abs(voice.lengthBias))) {
        text = trimToFirstClause(text);
    } else if (voice.lengthBias > 0.3 && rng.chance(voice.lengthBias * 0.6)) {
        text = `${text}, ${rng.pick(EXTRA_CLAUSES)}`;
    }

    if (rng.chance((voice.fillerRate || 0) * 0.6)) {
        text = `${rng.pick([...FILLERS_LEAD, ...(voice.signatures || [])])} ${text}`;
    }
    if (rng.chance((voice.fillerRate || 0) * 0.35)) {
        text = `${text} ${rng.pick(FILLERS_TAIL)}`;
    }
    if (rng.chance((voice.fillerRate || 0) * 0.25)) {
        text = text.replace(/\bis\b/, `is ${rng.pick(HEDGES)}`);
    }
    if (rng.chance((voice.fillerRate || 0) * 0.2)) {
        text = text.replace(/\b(good|bad|hard|easy|fine)\b/, (m) => `${rng.pick(INTENSIFIERS)} ${m}`);
    }
    if (voice.parentheticalRate && rng.chance(voice.parentheticalRate * 0.5)) {
        text = `${text} ${rng.pick(PARENTHETICALS)}`;
    }

    text = applyAbbreviations(text, voice.abbrevRate || 0, rng);

    const typoResult = applyTypos(text, voice.typoRate || 0, rng);
    text = typoResult.text;

    if (voice.casing === "sentence") {
        text = capitalizeSentences(text);
    } else {
        text = text.toLowerCase();
    }

    if (voice.capsBurstRate && rng.chance(voice.capsBurstRate)) {
        const words = text.split(" ");
        if (words.length > 2) {
            const index = rng.int(0, words.length - 1);
            words[index] = words[index].toUpperCase();
            text = words.join(" ");
        }
    }

    // Terminal punctuation.
    if (!/[.!?…]$/.test(text)) {
        if (voice.exclaimRate && rng.chance(voice.exclaimRate)) {
            text += rng.chance(0.4) ? "!!" : "!";
        } else if (rng.chance(voice.endPunctuation || 0)) {
            text += ".";
        } else if (rng.chance(0.08)) {
            text += "...";
        }
    }

    if (rng.chance(voice.emojiRate || 0)) {
        text += ` ${rng.pick(options.emojiPool || REACTION_EMOJI)}`;
    }

    // A typo the author noticed becomes a second message, the way it does in
    // a real chat.
    if (typoResult.typo && rng.chance(0.4)) {
        followUps.push(`${typoResult.typo}*`);
    } else if (rng.chance(voice.doubleMessageRate || 0) && options.allowFollowUp !== false) {
        const tail = rng.chance(0.25)
            ? rng.pick(voice.laughs)
            : rng.pick(options.followUpPool && options.followUpPool.length ? options.followUpPool : FOLLOW_UPS);
        followUps.push(voice.casing === "sentence" ? capitalizeSentences(tail) : tail.toLowerCase());
    }

    return { text: text.trim(), followUps };
}

// Short reactive one-liners ("same", "lol") skip most of the pipeline.
export function shortUtterance(token, voice, rng) {
    let text = token;
    if (rng.chance(0.3)) text = `${text} ${rng.pick(voice.laughs)}`;
    if (voice.casing === "sentence") text = capitalizeSentences(text);
    else text = text.toLowerCase();
    if (rng.chance((voice.emojiRate || 0) * 0.6)) text += ` ${rng.pick(REACTION_EMOJI)}`;
    return text;
}

// Pull a quotable fragment out of a message so callbacks feel like callbacks.
// Quoting from a clause boundary rather than mid-phrase is the difference
// between "the bit about drainage" and gibberish.
export function fragmentOf(text, rng) {
    const cleaned = text.replace(/[.!?]+$/, "").replace(/\s+[😭🔥💀🫡✨🙏😂🥲👏🤔❤️🎉😅🧠🌱☕📌🙃💡👀]+/gu, "");
    const clauses = cleaned.split(/[,.!?]\s+|\s+—\s+/).map((c) => c.trim()).filter(Boolean);
    const usable = clauses.filter((c) => c.split(/\s+/).length >= 4);
    const source = usable.length ? rng.pick(usable) : cleaned;
    const words = source.split(/\s+/);
    if (words.length <= 8) return source;
    return `${words.slice(0, rng.int(5, 8)).join(" ")}…`;
}
