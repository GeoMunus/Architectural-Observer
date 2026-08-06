// Raw material for handles, display names and server names. Kept deliberately
// mundane — handles that read like real internet handles do more for the
// illusion than clever ones do.

export const HANDLE_STEMS = [
    "kestrel", "moth", "juniper", "vetch", "pike", "onyx", "sable", "wren",
    "tallow", "harbor", "clementine", "birch", "quill", "marrow", "salt",
    "opal", "fennel", "gravel", "lantern", "mint", "nimbus", "orchard",
    "pigeon", "rust", "sorrel", "thistle", "umber", "velvet", "willow",
    "zinc", "cinder", "drift", "ember", "fathom", "glass", "hollow", "ivy",
    "jetty", "kelp", "loam", "marble", "north", "otter", "plum", "quarry",
    "ridge", "static", "tundra", "vellum", "walnut", "yarrow", "amber",
    "basil", "coral", "dusk", "eel", "flint", "gable", "heron", "inkwell"
];

export const HANDLE_SUFFIXES = [
    "", "", "", "", "_", "x", "42", "99", "7", "_dev", "core", "wave",
    "byte", "bot", "ish", "esque", "ly", "os", "io", "_txt", "2", "_hrs",
    "zone", "club", "gang", "hq", "official", "real", "prime", "eth"
];

// Weighted by repetition: most handles are a bare stem, a few carry a prefix.
export const HANDLE_PREFIXES = [
    "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
    "the", "not", "just", "lil", "big", "dr", "prof", "old", "mr", "ms",
    "captain", "sir", "your"
];

export const DISPLAY_MODIFIERS = [
    "(on hiatus)", "(afk)", "(commissions open)", "(she/her)", "(he/him)",
    "(they/them)", "(zzz)", "(new pfp)", "(back)", "(busy)", "🌱", "☕", "🛠",
    "✧", "— brb", "[mod]", "🎧", "📚", "🪴"
];

export const SERVER_PREFIXES = [
    "The", "", "", "", "", "Late Night", "Early", "Small", "Quiet", "Loud",
    "Very Normal", "Slightly Cursed", "Extremely Casual", "Unofficial",
    "Second", "Backup", "Local", "Municipal", "Amateur", "Semi-Pro"
];

export const SERVER_SUFFIXES = [
    "Club", "Guild", "Collective", "Lounge", "Hall", "Depot", "Society",
    "Cooperative", "Union", "Circle", "Workshop", "Basement", "Garage",
    "Annex", "Commons", "Assembly", "Shed", "Cabinet", "Fellowship", "Bureau"
];

export const ROLE_NAMES = [
    "founder", "moderator", "regular", "regular", "regular", "regular",
    "lurker", "newcomer", "archivist", "night shift", "resident expert",
    "the vibes", "bot wrangler", "event planner"
];

export const CATEGORY_NAMES = [
    "welcome", "general", "the work", "off topic", "voice", "archive"
];

export const AVATAR_GLYPHS = [
    "◆", "●", "▲", "✦", "◐", "❖", "✱", "◈", "▣", "⬢", "✶", "◇", "▰", "⌘",
    "☾", "♦", "✧", "▮", "◍", "❍"
];
