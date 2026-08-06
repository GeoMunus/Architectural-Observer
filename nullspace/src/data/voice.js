// Voice profiles decide *how* an agent types, independent of what they are
// talking about. Two agents can make the same argument and still be instantly
// recognisable, which is most of what makes a channel feel populated.

export const VOICE_PROFILES = [
    {
        id: "lowercase",
        label: "types fast, punctuates never",
        casing: "lower",
        endPunctuation: 0.05,
        commaRate: 0.2,
        emojiRate: 0.18,
        typoRate: 0.05,
        abbrevRate: 0.55,
        fillerRate: 0.45,
        lengthBias: -0.25,
        doubleMessageRate: 0.35,
        laughs: ["lol", "lmao", "lmaooo", "hah", "😭"],
        signatures: ["ngl", "tbh", "fr", "honestly", "idk"],
        wpm: 95
    },
    {
        id: "proper",
        label: "complete sentences, always",
        casing: "sentence",
        endPunctuation: 0.95,
        commaRate: 0.8,
        emojiRate: 0.03,
        typoRate: 0.01,
        abbrevRate: 0.05,
        fillerRate: 0.15,
        lengthBias: 0.35,
        doubleMessageRate: 0.08,
        laughs: ["ha", "heh", "that's very funny"],
        signatures: ["in fairness", "to be precise", "for what it's worth", "granted"],
        wpm: 62
    },
    {
        id: "excitable",
        label: "volume as punctuation",
        casing: "sentence",
        endPunctuation: 0.7,
        exclaimRate: 0.6,
        capsBurstRate: 0.22,
        commaRate: 0.4,
        emojiRate: 0.55,
        typoRate: 0.07,
        abbrevRate: 0.3,
        fillerRate: 0.4,
        lengthBias: -0.1,
        doubleMessageRate: 0.42,
        laughs: ["AHAHA", "lmaooo", "im crying", "😭😭"],
        signatures: ["okay but", "WAIT", "genuinely", "no because"],
        wpm: 88
    },
    {
        id: "dry",
        label: "deadpan, four words max",
        casing: "lower",
        endPunctuation: 0.15,
        commaRate: 0.15,
        emojiRate: 0.04,
        typoRate: 0.01,
        abbrevRate: 0.2,
        fillerRate: 0.08,
        lengthBias: -0.55,
        doubleMessageRate: 0.05,
        laughs: ["heh", "ha", "sure"],
        signatures: ["sure", "allegedly", "as one does", "bold"],
        wpm: 70
    },
    {
        id: "rambler",
        label: "one thought, seven clauses",
        casing: "sentence",
        endPunctuation: 0.5,
        commaRate: 0.9,
        parentheticalRate: 0.45,
        emojiRate: 0.1,
        typoRate: 0.04,
        abbrevRate: 0.2,
        fillerRate: 0.5,
        lengthBias: 0.7,
        doubleMessageRate: 0.3,
        laughs: ["haha", "lol", "hah"],
        signatures: ["anyway", "which, sure", "and this is the part that gets me", "sorry, tangent"],
        wpm: 74
    },
    {
        id: "gentle",
        label: "kind, slightly soft-spoken",
        casing: "sentence",
        endPunctuation: 0.6,
        commaRate: 0.6,
        emojiRate: 0.35,
        typoRate: 0.02,
        abbrevRate: 0.12,
        fillerRate: 0.3,
        lengthBias: 0.05,
        doubleMessageRate: 0.18,
        laughs: ["hehe", "haha", "☺"],
        signatures: ["no pressure", "if that helps", "gently", "take your time"],
        wpm: 58
    },
    {
        id: "terse",
        label: "answers only",
        casing: "lower",
        endPunctuation: 0.1,
        commaRate: 0.1,
        emojiRate: 0.06,
        typoRate: 0.02,
        abbrevRate: 0.35,
        fillerRate: 0.03,
        lengthBias: -0.7,
        doubleMessageRate: 0.12,
        laughs: ["lol", "ha"],
        signatures: ["yep", "nope", "same", "correct"],
        wpm: 80
    },
    {
        id: "academic",
        label: "hedges everything twice",
        casing: "sentence",
        endPunctuation: 0.9,
        commaRate: 0.85,
        parentheticalRate: 0.3,
        emojiRate: 0.02,
        typoRate: 0.01,
        abbrevRate: 0.04,
        fillerRate: 0.2,
        lengthBias: 0.6,
        doubleMessageRate: 0.1,
        laughs: ["ha", "amusing", "heh"],
        signatures: ["arguably", "broadly speaking", "with caveats", "my prior is"],
        wpm: 55
    },
    {
        id: "poster",
        label: "extremely online",
        casing: "lower",
        endPunctuation: 0.02,
        commaRate: 0.1,
        emojiRate: 0.4,
        typoRate: 0.06,
        abbrevRate: 0.75,
        fillerRate: 0.5,
        lengthBias: -0.4,
        doubleMessageRate: 0.4,
        laughs: ["lmao", "im dead", "😭", "crying", "sending me"],
        signatures: ["fr fr", "no shot", "this is the one", "unwell about this", "certified"],
        wpm: 105
    },
    {
        id: "steward",
        label: "keeps the place tidy",
        casing: "sentence",
        endPunctuation: 0.8,
        commaRate: 0.7,
        emojiRate: 0.2,
        typoRate: 0.01,
        abbrevRate: 0.1,
        fillerRate: 0.18,
        lengthBias: 0.25,
        doubleMessageRate: 0.14,
        laughs: ["haha", "ha", "🙂"],
        signatures: ["quick note", "for the record", "pinning this", "keeping it here for later"],
        wpm: 66
    }
];

export const FILLERS_LEAD = [
    "honestly", "ok so", "wait", "i mean", "see", "hm", "yeah so", "look",
    "genuinely", "listen", "right so", "ngl", "tbh", "fwiw", "idk maybe"
];

export const FILLERS_TAIL = [
    "i guess", "or whatever", "if that makes sense", "anyway", "lol",
    "but what do i know", "idk", "just me?", "you know?", "hm"
];

export const HEDGES = [
    "kind of", "sort of", "basically", "more or less", "roughly", "mostly",
    "in theory", "usually", "at least for me"
];

export const INTENSIFIERS = [
    "genuinely", "actually", "completely", "absolutely", "so", "really",
    "unbelievably", "quietly", "extremely"
];

export const AGREEMENT_TOKENS = [
    "same", "this", "yeah exactly", "hard agree", "you're right", "100%",
    "correct", "yep", "so true", "agreed", "exactly this", "big same"
];

export const DISAGREEMENT_TOKENS = [
    "eh", "i dunno about that", "hmm", "counterpoint", "respectfully no",
    "i think that's half true", "not in my experience", "sort of?"
];

export const REACTION_EMOJI = [
    "👀", "😭", "🔥", "💀", "🫡", "✨", "🙏", "😂", "🥲", "👏", "🤔", "❤️",
    "🎉", "😅", "🧠", "🌱", "☕", "📌", "🙃", "💡"
];

// Deliberately common finger-slips rather than random character noise —
// random noise reads as corruption, these read as speed.
export const TYPO_SWAPS = [
    ["the", "teh"], ["and", "adn"], ["that", "taht"], ["just", "jsut"],
    ["with", "wiht"], ["you", "yuo"], ["what", "waht"], ["really", "realy"],
    ["think", "thikn"], ["about", "abuot"], ["because", "becuase"],
    ["something", "somethign"], ["there", "thre"], ["would", "woudl"]
];

export const ABBREVIATIONS = [
    ["you", "u"], ["your", "ur"], ["are", "r"], ["to be honest", "tbh"],
    ["not gonna lie", "ngl"], ["i don't know", "idk"], ["by the way", "btw"],
    ["for real", "fr"], ["right now", "rn"], ["going to", "gonna"],
    ["want to", "wanna"], ["kind of", "kinda"], ["about", "abt"],
    ["probably", "prob"], ["definitely", "def"], ["obviously", "obv"]
];

export const BIO_TEMPLATES = [
    "{domainLabel} mostly. bad at replying, sorry in advance",
    "here for {niche}. ask me about {thing}",
    "{trait} · {trait2} · currently {status}",
    "i post {niche} and disappear for weeks",
    "professionally normal, personally {trait}",
    "{timezone}. awake at the wrong hours",
    "just here to lurk (lying)",
    "collecting {niche} gear i do not need",
    "will talk about {thing} unprompted",
    "{trait}. that's it that's the bio"
];

export const TRAITS = [
    "impatient", "meticulous", "nocturnal", "distractible", "stubborn",
    "encouraging", "sarcastic", "earnest", "anxious about it", "unbothered",
    "over-prepared", "chaotic", "quietly competitive", "sentimental",
    "allergic to hype", "easily nerd-sniped", "loyal", "blunt", "warm"
];

export const STATUS_LINES = [
    "avoiding a deadline", "on the third coffee", "supposed to be asleep",
    "in a meeting (not listening)", "pretending to work", "outside for once",
    "rewatching something", "reorganizing instead of doing it", "recovering"
];

export const TIMEZONES = [
    "GMT", "CET", "EST", "PST", "JST", "AEST", "IST", "BRT", "GMT+2", "GMT-6"
];
