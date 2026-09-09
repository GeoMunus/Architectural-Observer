// Vocabulary the generator draws on. Structure is shared across genres; the
// word banks are what make a cyberpunk timeline read differently from a mythic
// one while running through exactly the same narrative machinery.

export const PALETTES = {
    liquid: {
        onsets: ["l", "m", "n", "v", "s", "th", "r", "el", "ae", "il", "sy", "ly"],
        nuclei: ["a", "e", "i", "ae", "ia", "eo", "ei", "au", "io"],
        codas: ["l", "n", "r", "s", "th", "ne", "ra", "lis", "van", "mir"]
    },
    harsh: {
        onsets: ["k", "gr", "dr", "th", "br", "kr", "v", "z", "tr", "sk", "vr"],
        nuclei: ["a", "o", "u", "au", "ar", "or", "ur"],
        codas: ["k", "g", "th", "rn", "sk", "dt", "kar", "gorn", "vosk", "rax"]
    },
    sibilant: {
        onsets: ["s", "sh", "z", "ts", "x", "sk", "ch", "st", "sp"],
        nuclei: ["i", "e", "y", "ia", "ei", "ie", "a", "o"],
        codas: ["s", "sh", "x", "th", "ith", "ess", "isk", "ar", "en"]
    },
    guttural: {
        onsets: ["g", "kh", "h", "ng", "b", "d", "gh", "q", "r"],
        nuclei: ["a", "o", "u", "aa", "oo", "ua", "ou"],
        codas: ["g", "kh", "n", "m", "gh", "dun", "bar", "qan", "hul"]
    },
    clipped: {
        onsets: ["k", "t", "p", "b", "d", "j", "m", "n", "r", "v"],
        nuclei: ["a", "e", "i", "o", "u"],
        codas: ["n", "k", "t", "x", "l", "sk", "tt", "nn", "rr"]
    },
    airy: {
        onsets: ["y", "w", "h", "f", "th", "ph", "l", "n", "s", "v", "m"],
        nuclei: ["ia", "ea", "oa", "ai", "ei", "ou", "a", "e", "i"],
        codas: ["l", "n", "r", "th", "wn", "ren", "lyn", "eth", "ar"]
    }
};

const SHARED_ADJECTIVES = [
    "Broken", "Silent", "Hollow", "Gilded", "Drowned", "Burning", "Iron", "Glass",
    "Quiet", "Long", "Second", "Final", "Wandering", "Sleepless", "Patient", "Bitter",
    "Nameless", "Splendid", "Ruined", "Ascendant", "Forgotten", "Waking", "Severed", "Crowned"
];

/**
 * Every genre supplies the same slot names. The generator never hardcodes a
 * genre; it just asks for `words.conflict`, `words.artifact`, and so on.
 */
export const GENRES = {
    mythic: {
        id: "mythic",
        label: "Age of Myth",
        blurb: "Gods, oaths, and heroes whose mistakes become geography.",
        palettes: ["liquid", "airy", "guttural"],
        time: { unit: "Year", era: "of the Long Count", start: [1, 240], step: [8, 90] },
        words: {
            adjective: SHARED_ADJECTIVES.concat(["Golden", "Thunderous", "Star-Marked", "Sundered"]),
            group: ["Covenant", "Host", "Bloodline", "Choir", "Circle", "Pantheon", "Tribe", "Order"],
            role: ["Oathkeeper", "Godspeaker", "Shieldbearer", "Loomwright", "Stormcaller", "Riverborn", "Ash-Priest"],
            placeKind: ["Vale", "Reach", "Deep", "Wastes", "Mount", "Fen", "Isles", "Gate", "Hollow"],
            artifactKind: ["Crown", "Spear", "Loom", "Chalice", "Horn", "Mask", "Chain", "Seed"],
            conflict: ["a blood-feud", "an open war", "a war of oaths", "a siege", "a hunt", "a reckoning"],
            discovery: ["uncovers", "is shown", "dreams of", "stumbles into", "is led to"],
            collapse: ["falls", "is unmade", "drowns", "is scattered", "burns", "goes silent"],
            ruin: ["is abandoned", "burns", "is swallowed by the sea", "falls silent", "is left to the fen"],
            force: ["the Tide Beneath", "the Long Winter", "the Hunger", "the Weaving", "the Deep Song"],
            omen: ["twin moons rose full", "the rivers ran backward", "no bird sang for nine days", "the sea withdrew a league", "stars fell in the shape of a hand"]
        }
    },
    fantasy: {
        id: "fantasy",
        label: "High Fantasy",
        blurb: "Kingdoms, succession, and magic that costs more than it gives.",
        palettes: ["liquid", "harsh", "airy"],
        time: { unit: "Year", era: "of the Third Accord", start: [200, 1400], step: [3, 45] },
        words: {
            adjective: SHARED_ADJECTIVES.concat(["Thorned", "Amber", "Winterbound", "Bright"]),
            group: ["House", "Kingdom", "Conclave", "League", "Guild", "Dominion", "Free Cities", "Coven"],
            role: ["Archivist", "Warden", "Regent", "Hedge-Mage", "Marshal", "Cartographer", "Court Alchemist"],
            placeKind: ["Keep", "March", "Hold", "Ford", "Wood", "Barrows", "Straits", "Spire", "Quarter"],
            artifactKind: ["Sigil", "Codex", "Blade", "Key", "Orrery", "Reliquary", "Signet", "Bell"],
            conflict: ["open war", "a war of succession", "a border war", "a trade war", "a purge", "a rebellion"],
            discovery: ["recovers", "decodes", "purchases", "excavates", "is willed"],
            collapse: ["is sacked", "is dissolved", "abdicates", "is put to the torch", "loses the field"],
            ruin: ["is sacked", "is put to the torch", "is abandoned", "is emptied by fever", "falls"],
            force: ["the Blight", "the Waning", "the Grey Fever", "the Unmaking", "the Long Debt"],
            omen: ["the harvest failed twice running", "a comet stood over the capital", "every mirror in the palace cracked", "the wells turned brackish"]
        }
    },
    space: {
        id: "space",
        label: "Space Opera",
        blurb: "Interstellar polities, slower-than-light grudges, and inherited debt.",
        palettes: ["clipped", "sibilant", "liquid"],
        time: { unit: "Standard Year", era: "of the Common Reckoning", start: [2180, 4600], step: [2, 60] },
        words: {
            adjective: SHARED_ADJECTIVES.concat(["Outer", "Sublight", "Coreward", "Derelict"]),
            group: ["Combine", "Directorate", "Fleet", "Consortium", "Compact", "Hegemony", "Collective", "Syndicate"],
            role: ["Fleet Marshal", "Chief Navigator", "Xenologist", "Quartermaster", "Envoy", "Station Warden", "Drive Theorist"],
            placeKind: ["Station", "Belt", "Reach", "Gate", "Yards", "Expanse", "Drift", "Rim", "Anchorage"],
            artifactKind: ["Array", "Drive", "Codex", "Beacon", "Cradle", "Lattice", "Registry", "Key"],
            conflict: ["open war", "a blockade", "a succession crisis", "a proxy war", "an embargo", "a boarding campaign"],
            discovery: ["decrypts", "salvages", "surveys", "back-engineers", "intercepts"],
            collapse: ["is scuttled", "goes dark", "secedes", "loses pressure", "is stripped for hulls"],
            ruin: ["is scuttled", "goes dark", "loses pressure", "is stripped for hulls", "is evacuated"],
            force: ["the Quiet", "the Drift", "the Cascade", "the Long Delay", "the Signal"],
            omen: ["three relay stations answered with the same message", "the jump lanes lost eleven minutes", "a derelict arrived on its own", "every clock in the system disagreed"]
        }
    },
    cyber: {
        id: "cyber",
        label: "Near-Future Cyberpunk",
        blurb: "Corporate polities, leaked infrastructure, and cities that outlive their owners.",
        palettes: ["clipped", "sibilant"],
        time: { unit: "", era: "", start: [2029, 2094], step: [1, 9] },
        words: {
            adjective: SHARED_ADJECTIVES.concat(["Offshore", "Grey-Market", "Redacted", "Unlicensed"]),
            group: ["Group", "Holdings", "Collective", "Bureau", "Cartel", "Trust", "Cooperative", "Authority"],
            role: ["fixer", "systems architect", "compliance officer", "courier", "ripperdoc", "union steward", "forensic analyst"],
            placeKind: ["Sprawl", "District", "Arcology", "Terminal", "Freeport", "Underlevels", "Corridor", "Zone"],
            artifactKind: ["Ledger", "Exploit", "Prosthesis", "Archive", "Protocol", "Key", "Model", "Dataset"],
            conflict: ["a hostile takeover", "open street war", "a lawsuit that lasts a decade", "a strike", "an information war", "a shell-company siege"],
            discovery: ["leaks", "reverse-engineers", "buys outright", "recovers from a dead drop", "subpoenas"],
            collapse: ["is liquidated", "loses its charter", "is bought and gutted", "declares insolvency", "is raided"],
            ruin: ["is condemned", "is written off", "goes dark", "is cordoned and left", "burns"],
            force: ["the Blackout", "the Churn", "the Dependency", "the Audit", "the Quiet Layoff"],
            omen: ["the transit network refused three hundred valid passes", "an outage lasted exactly nine minutes citywide", "insurance premiums doubled overnight", "the same face appeared in unrelated footage"]
        }
    },
    apocalypse: {
        id: "apocalypse",
        label: "After the Collapse",
        blurb: "What people rebuild, and what they agree never to mention again.",
        palettes: ["clipped", "harsh", "guttural"],
        time: { unit: "Year", era: "After", start: [1, 90], step: [1, 14] },
        words: {
            adjective: SHARED_ADJECTIVES.concat(["Downwind", "Scavenged", "Walled", "Rationed"]),
            group: ["Convoy", "Settlement", "Salvage Crew", "Council", "Column", "Holdfast", "Union", "Watch"],
            role: ["water-warden", "seed-keeper", "scout", "medic", "radio operator", "quartermaster", "wall-boss"],
            placeKind: ["Yard", "Reservoir", "Overpass", "Silo", "Green", "Crossing", "Dead Zone", "Terminus"],
            artifactKind: ["Cache", "Generator", "Ledger", "Seed Vault", "Map", "Still", "Antenna"],
            conflict: ["a water war", "a raid", "a siege of the walls", "a feud", "a slow starvation", "a road war"],
            discovery: ["digs out", "trades for", "wires up", "finds intact", "restores"],
            collapse: ["is abandoned", "burns", "runs dry", "is overrun", "empties in a season"],
            ruin: ["is abandoned", "burns", "runs dry", "is overrun", "empties in a season"],
            force: ["the Dry", "the Rot", "the Cold Years", "the Fever", "the Drift"],
            omen: ["the rain came black for a week", "the herd animals moved south early", "the old sirens sounded once", "nothing came over the radio for forty days"]
        }
    },
    althistory: {
        id: "althistory",
        label: "Alternate History",
        blurb: "One decision goes the other way, and two centuries reorganize around it.",
        palettes: ["clipped", "liquid"],
        time: { unit: "", era: "", start: [1490, 1930], step: [2, 22] },
        words: {
            adjective: SHARED_ADJECTIVES.concat(["Provisional", "Northern", "Constitutional", "Reformed"]),
            group: ["Republic", "Commission", "Assembly", "Company", "League", "Federation", "Ministry", "Society"],
            role: ["minister", "engineer", "pamphleteer", "admiral", "delegate", "banker", "surveyor"],
            placeKind: ["Territory", "Basin", "Corridor", "Port", "Junction", "Province", "Line", "Works"],
            artifactKind: ["Treaty", "Patent", "Charter", "Engine", "Ledger", "Doctrine", "Survey"],
            conflict: ["open war", "a tariff war", "a constitutional crisis", "a general strike", "a naval standoff", "a border dispute"],
            discovery: ["publishes", "patents", "demonstrates", "smuggles out", "translates"],
            collapse: ["is dissolved", "loses the vote", "defaults", "is partitioned", "resigns in full"],
            ruin: ["is burned", "is partitioned", "is depopulated", "is abandoned to the water", "falls"],
            force: ["the Panic", "the Long Depression", "the Reaction", "the Settlement", "the Question"],
            omen: ["the exchange closed early three days running", "the harvest reports were falsified", "an ambassador left without ceremony", "the newspapers agreed for once"]
        }
    },
    arcaneIndustrial: {
        id: "arcaneIndustrial",
        label: "Arcane Industrial",
        blurb: "Magic gets standardized, regulated, and then priced out of reach.",
        palettes: ["harsh", "liquid", "clipped"],
        time: { unit: "Year", era: "of the Meter", start: [40, 320], step: [1, 18] },
        words: {
            adjective: SHARED_ADJECTIVES.concat(["Regulated", "Boilerbound", "Charter", "Leaded"]),
            group: ["Works", "Guild", "Board", "Concern", "Union", "Institute", "Directorate", "Chapterhouse"],
            role: ["thaumic engineer", "inspector", "line-witch", "actuary", "foreman", "licensing clerk", "safety adept"],
            placeKind: ["Works", "Yards", "Quarter", "Line", "Foundry", "Reservoir", "Terminus", "Row"],
            artifactKind: ["Regulator", "Engine", "Ledger", "Standard", "Conduit", "Seal", "Register"],
            conflict: ["a strike", "a patent war", "a guild war", "an inquiry that becomes a purge", "a shutdown", "a sabotage campaign"],
            discovery: ["standardizes", "patents", "measures for the first time", "audits", "publishes"],
            collapse: ["is condemned", "loses its charter", "explodes", "is shuttered", "is nationalized"],
            ruin: ["is condemned", "burns", "is shuttered", "is flooded", "is written off"],
            force: ["the Backwash", "the Rate", "the Grey Lung", "the Overdraw", "the Standard"],
            omen: ["every regulator in the district read the same false value", "the river ran warm in winter", "three foremen resigned the same morning", "the lamps burned green for an hour"]
        }
    },
    deeptime: {
        id: "deeptime",
        label: "Deep Time / Precursors",
        blurb: "A civilization reconstructed from what it left behind, mostly wrongly.",
        palettes: ["airy", "sibilant", "guttural"],
        time: { unit: "Cycle", era: "before present", start: [40000, 900000], step: [200, 9000] },
        words: {
            adjective: SHARED_ADJECTIVES.concat(["Stratified", "Pre-Collapse", "Unattested", "Terminal"]),
            group: ["Polity", "Continuum", "Assembly", "Lineage", "Culture", "Horizon", "Complex"],
            role: ["archivist-caste", "terraform authority", "memory-bearer", "wayfinder", "steward-line"],
            placeKind: ["Basin", "Array", "Necropolis", "Shelf", "Vault", "Ring", "Substrate", "Terrace"],
            artifactKind: ["Substrate", "Monument", "Registry", "Seedbank", "Lattice", "Inscription", "Core"],
            conflict: ["a divergence", "a resource collapse", "a schism", "a containment failure", "a long attrition"],
            discovery: ["records", "encodes", "constructs", "buries deliberately", "abandons in place"],
            collapse: ["is depopulated", "is sealed", "falls below quorum", "ceases transmission", "is deliberately erased"],
            ruin: ["is depopulated", "is sealed", "is buried deliberately", "ceases transmission", "is abandoned in place"],
            force: ["the Attenuation", "the Silence", "the Substrate Failure", "the Cold Equation", "the Drawdown"],
            omen: ["the orbital rings shed material for a century", "burial density triples in a single stratum", "inscription quality drops off sharply", "the last records are duplicates of the first"]
        }
    }
};

export const GENRE_LIST = Object.values(GENRES);

export const ENTITY_KINDS = {
    faction: { label: "Faction", icon: "◈" },
    person: { label: "Figure", icon: "☗" },
    place: { label: "Place", icon: "⌖" },
    artifact: { label: "Artifact", icon: "❖" },
    force: { label: "Force", icon: "≋" }
};

// Dramatic arc. The generator walks these in order and loops the middle acts
// when a timeline is extended past its original length.
export const ACTS = [
    { id: "genesis", label: "Origins", weightHint: 1 },
    { id: "expansion", label: "Expansion", weightHint: 1 },
    { id: "tension", label: "Fracture", weightHint: 1.2 },
    { id: "crisis", label: "Crisis", weightHint: 1.4 },
    { id: "cataclysm", label: "Cataclysm", weightHint: 1 },
    { id: "aftermath", label: "Aftermath", weightHint: 1 },
    { id: "legacy", label: "Legacy", weightHint: 1 }
];

export const ERA_NAME_PATTERNS = [
    "The {adjective} {noun}",
    "The {noun} of {place}",
    "The {adjective} Years",
    "The {noun} Era",
    "The Age of {noun}"
];

export const ERA_NOUNS = {
    genesis: ["Founding", "First Light", "Settling", "Compact", "Opening"],
    expansion: ["Reach", "Flowering", "Long Trade", "Charter", "Widening"],
    tension: ["Fracture", "Cold Years", "Souring", "Division", "Suspicion"],
    crisis: ["Reckoning", "Emergency", "Breaking", "Crisis", "Turning"],
    cataclysm: ["Burning", "Undoing", "Great Loss", "Cataclysm", "Silence"],
    aftermath: ["Salvage", "Reconstruction", "Quiet", "Accounting", "Return"],
    legacy: ["Inheritance", "Long Memory", "Afterward", "Settlement", "Second Light"]
};
