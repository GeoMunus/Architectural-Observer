// Interest domains. Each one supplies both a lexicon (slot filler for the
// generic conversational moves) and pools of whole sentences. The whole
// sentences are what make a channel read like people who actually care about
// the subject; the lexicon keeps the generic moves from sounding generic.

export const DOMAINS = [
    {
        id: "gamedev",
        label: "Game Dev",
        glyph: "🕹",
        blurb: "solo devs, jam survivors, shader goblins",
        serverNouns: ["Jam", "Playtest", "Devlog", "Build", "Prototype", "Crunch"],
        channels: [
            { name: "devlog", purpose: "post what you shipped today" },
            { name: "screenshot-saturday", purpose: "show, don't tell" },
            { name: "help-me-debug", purpose: "paste the stack trace" },
            { name: "asset-swap", purpose: "free tiles, sfx, fonts" },
            { name: "jam-planning", purpose: "48 hours, no sleep" }
        ],
        lexicon: {
            thing: ["the movement code", "my tilemap", "the save system", "the shader", "collision", "the dialogue tree", "the build pipeline", "input remapping", "the pause menu", "particle spawning"],
            tool: ["Godot", "Aseprite", "Blender", "Tiled", "FMOD", "the profiler", "a state machine", "an object pool"],
            action: ["rewrite it from scratch", "just ship it", "cut the feature", "refactor into components", "hardcode it for now", "profile it first"],
            adj: ["janky", "buttery", "unreadable", "cursed", "surprisingly clean", "held together with tape"],
            problem: ["a null ref on scene load", "frame drops on the boss room", "input lag", "a physics tunneling bug", "the web export dying silently"],
            place: ["the jam page", "my devlog", "the playtest build", "itch"],
            niche: ["metroidvanias", "roguelites", "puzzle platformers", "immersive sims", "visual novels"]
        },
        takes: [
            "hot take: the prototype should be ugly on purpose. pretty prototypes make you defend bad ideas",
            "every time i write my own tweening library i lose a week and gain nothing",
            "scope creep isnt a discipline problem its a design problem. if the scope creeps the design was vague",
            "playtesting with 3 strangers beats 40 hours of me staring at it",
            "the movement has to feel good before literally anything else. everything else is negotiable",
            "i genuinely think devlogs are more valuable than the games for most of us",
            "unpopular but tutorials should be a level not a text box",
            "you dont need an engine you need a deadline"
        ],
        questions: [
            "does anyone else's game get worse the second you add a menu",
            "whats your actual workflow for sfx. i keep just grabbing whatever and it sounds like a garage sale",
            "how do you decide when a prototype is dead vs just early",
            "is there a sane way to do save files without serializing the entire world",
            "anyone got a jam team? i can do code and bad pixel art"
        ],
        gripes: [
            "spent four hours on {problem} and it was a typo in a variable name",
            "{thing} works perfectly on desktop and detonates on the web build",
            "i have 31 prototypes and 0 games",
            "wrote 600 lines then remembered {tool} already does this",
            "the boss fight is fun for me and only me, which is the worst possible result"
        ],
        wins: [
            "{thing} finally feels {adj}. took 3 rewrites but its there",
            "shipped the demo. 11 downloads and one of them isnt my mom",
            "got the frame time under budget on the {niche} level 🎉",
            "someone played my game on stream and laughed at the right part. im never recovering from this"
        ]
    },
    {
        id: "synths",
        label: "Synths",
        glyph: "🎛",
        blurb: "modular, tape hiss, unfinished loops",
        serverNouns: ["Patch", "Rack", "Signal", "Tape", "Drone", "Studio"],
        channels: [
            { name: "patch-notes", purpose: "what did you plug into what" },
            { name: "gear-acquisition", purpose: "enabling each other" },
            { name: "wip-loops", purpose: "8 bars, no mercy" },
            { name: "mixing-help", purpose: "why is it muddy" },
            { name: "sample-swap", purpose: "field recordings welcome" }
        ],
        lexicon: {
            thing: ["the drum bus", "my reverb send", "the sub", "that pad", "the sidechain", "the low mids", "the master chain", "a tape loop"],
            tool: ["a Plaits", "the SP-404", "an OP-1", "my Juno", "Ableton", "a spring reverb", "a passive mult", "the 4ms"],
            action: ["resample everything", "print it to tape", "cut the low end", "sidechain it", "just record one take", "commit to the sound"],
            adj: ["muddy", "brittle", "gorgeous", "boxy", "wide", "way too wet"],
            problem: ["phase cancellation", "a clock drift", "clipping on the master", "a ground loop hum"],
            place: ["the bandcamp page", "my soundcloud", "the shared folder"],
            niche: ["ambient", "drone", "lo-fi house", "jungle", "generative stuff"]
        },
        takes: [
            "you dont need more modules you need to finish one patch",
            "reverb is not a personality. i say this as someone with a reverb personality",
            "recording a bad take is more useful than planning a good one",
            "honestly 90% of my best sounds are accidents i failed to document",
            "the loudness thing is a trap. leave headroom and let it breathe",
            "hardware is just software that guilt trips you into using it",
            "every track i finish is one i stopped touching, not one i completed"
        ],
        questions: [
            "how do you know when a loop is a song and not just a loop",
            "whats everyone using for a clock source rn",
            "does anyone actually mix on headphones and get results",
            "is it insane to sell the {tool} to fund a smaller setup",
            "wip in the folder, does the low end sound {adj} to you or is my room lying"
        ],
        gripes: [
            "{thing} sounded incredible last night and today its {adj}. classic",
            "{problem} again. i have checked every cable twice",
            "i have 400 unfinished loops and the discipline of a moth",
            "patched something beautiful and forgot to hit record. thats it thats the message"
        ],
        wins: [
            "finished a track. actually finished. its up on {place}",
            "{thing} finally sits right. turns out the answer was less of everything",
            "did a live set with zero laptop and only one panic moment"
        ]
    },
    {
        id: "plants",
        label: "Plants",
        glyph: "🪴",
        blurb: "leaf identification and gentle enabling",
        serverNouns: ["Greenhouse", "Windowsill", "Propagation", "Canopy", "Potting"],
        channels: [
            { name: "show-your-shelf", purpose: "the whole jungle" },
            { name: "plant-triage", purpose: "yellow leaf emergency room" },
            { name: "propagation-swap", purpose: "cuttings by mail" },
            { name: "soil-talk", purpose: "yes we talk about dirt" }
        ],
        lexicon: {
            thing: ["the monstera", "my pothos", "that fiddle leaf", "the calathea", "a hoya cutting", "the aloe"],
            tool: ["a moisture meter", "pumice", "grow lights", "a chopstick", "worm castings"],
            action: ["repot it", "leave it alone", "cut the water back", "move it away from the vent", "chop and prop"],
            adj: ["leggy", "crispy", "thriving", "sulking", "root bound"],
            problem: ["root rot", "spider mites", "fungus gnats", "sunburn on the top leaves"],
            place: ["the north window", "the bathroom", "the balcony"],
            niche: ["aroids", "succulents", "carnivorous plants", "bonsai"]
        },
        takes: [
            "the single biggest upgrade is drainage. not light, not fertilizer, drainage",
            "a plant that survives you is worth more than one that impresses you",
            "i will die on this hill: most 'watering problems' are airflow problems",
            "buying a rare plant to prove youre good at plants is how you kill a rare plant",
            "leaves are supposed to die sometimes. thats a normal plant doing normal plant things"
        ],
        questions: [
            "is {thing} {adj} or am i catastrophizing again",
            "whats everyone's soil mix these days, mine holds water like a sponge",
            "anyone in a dry apartment have luck with {niche}",
            "how long do you quarantine a new plant before it joins the shelf"
        ],
        gripes: [
            "{problem} again. i thought we were past this",
            "{thing} dropped four leaves overnight and i have done nothing different i swear",
            "watered on schedule instead of by feel and immediately regretted it",
            "bought one plant. came home with three. the system works"
        ],
        wins: [
            "new leaf on {thing}!! unfurling right now, ive been watching it for an hour",
            "the cutting rooted 🌱 first try",
            "{thing} has officially outgrown {place} and i could not be prouder"
        ]
    },
    {
        id: "retrotech",
        label: "Retro Tech",
        glyph: "🖥",
        blurb: "recapping boards, hoarding manuals",
        serverNouns: ["Bench", "Salvage", "Repair", "Archive", "Museum"],
        channels: [
            { name: "the-bench", purpose: "what's open on your desk" },
            { name: "recap-help", purpose: "capacitor archaeology" },
            { name: "found-in-the-wild", purpose: "curb finds and estate sales" },
            { name: "software-archive", purpose: "disk images and manuals" }
        ],
        lexicon: {
            thing: ["the PSU", "a 486 board", "the floppy drive", "the CRT", "an SCSI chain", "the RAM sticks"],
            tool: ["a hot air station", "flux", "a logic probe", "isopropyl", "the multimeter"],
            action: ["recap the whole board", "reflow it", "dump the ROM", "swap the battery before it leaks", "just image the drive first"],
            adj: ["pristine", "yellowed", "toast", "mint", "beyond saving"],
            problem: ["a leaking varta battery", "dead caps", "a shorted trace", "no video on boot"],
            place: ["a thrift store", "the curb", "an estate sale", "an office clearout"],
            niche: ["Amigas", "beige PCs", "Macs", "thinkpads", "calculators"]
        },
        takes: [
            "image the drive before you power it on. i will keep saying this until it stops being necessary",
            "the machine isnt valuable, the software on it is. nobody archives the software",
            "recapping is not a personality trait but it is my personality",
            "a working machine you use beats a mint machine in a closet, sorry collectors",
            "every single one of these things is a battery leak on a long enough timeline"
        ],
        questions: [
            "anyone have a service manual for this, the usual sites have nothing",
            "is {problem} worth chasing or do i part it out",
            "whats a fair price for one of these in {adj} condition these days",
            "best {tool} that isnt three hundred dollars"
        ],
        gripes: [
            "{problem}. of course. found it after i cleaned the whole board",
            "seller said 'untested' which as we all know means 'i know exactly what is wrong with it'",
            "shipped in a box with no padding. the {thing} arrived in two pieces",
            "spent the evening chasing a fault that turned out to be the power strip"
        ],
        wins: [
            "IT BOOTS. after two weeks of {problem}, it boots",
            "found a {niche} at {place} for eleven dollars and it powers on",
            "dumped the ROMs and put them in the archive folder. thats another one saved"
        ]
    },
    {
        id: "ttrpg",
        label: "Tabletop",
        glyph: "🎲",
        blurb: "dice, session prep, and dm anxiety",
        serverNouns: ["Table", "Session", "Campaign", "Dungeon", "Party"],
        channels: [
            { name: "session-zero", purpose: "set the table" },
            { name: "dm-help", purpose: "the players did what" },
            { name: "homebrew", purpose: "playtest it here first" },
            { name: "looking-for-group", purpose: "timezones permitting" },
            { name: "dice-goblin", purpose: "post the dice" }
        ],
        lexicon: {
            thing: ["the big bad", "my session prep", "the initiative order", "a homebrew subclass", "the campaign map"],
            tool: ["index cards", "a random table", "Owlbear", "a session recap doc", "the fear/hope dice"],
            action: ["fail forward", "cut to the interesting part", "let them have it", "roll it in the open", "say yes and"],
            adj: ["railroady", "cinematic", "a slog", "wide open", "chaotic"],
            problem: ["a party split", "one player dominating the table", "a four hour combat", "scheduling"],
            place: ["the table", "roll20", "the group chat"],
            niche: ["osr", "pbta", "5e", "call of cthulhu", "blades in the dark"]
        },
        takes: [
            "prep situations not plots. the plot is what happens after they ruin the situation",
            "the best sessions are the ones where i improvised because i under-prepped",
            "combat that takes four hours is a design problem, not a player problem",
            "session zero isnt optional and every campaign i ran without one proved it",
            "letting the dice kill a character you love is the whole point, gently"
        ],
        questions: [
            "how much do you prep? i do way too much and use maybe a fifth",
            "whats your move when {problem} happens mid session",
            "anyone run {niche} lately? thinking of switching systems",
            "is it bad form to retcon a ruling between sessions"
        ],
        gripes: [
            "wrote three pages of lore and they went the other direction in eight minutes",
            "{problem} killed the whole session tonight",
            "my players remember one npc and it is the bartender i named in a panic",
            "the campaign died to {problem} again. thats the third one this year"
        ],
        wins: [
            "the finale landed. a player actually got quiet. i live for this",
            "ran a whole session off two index cards and it was the best one yet",
            "someone drew fan art of my npc, im normal about it"
        ]
    },
    {
        id: "cooking",
        label: "Cooking",
        glyph: "🍞",
        blurb: "bread failures and pan opinions",
        serverNouns: ["Kitchen", "Bakery", "Pantry", "Table", "Larder"],
        channels: [
            { name: "what-you-made", purpose: "photo required, sorry" },
            { name: "bread", purpose: "starters, crumb, despair" },
            { name: "gear-talk", purpose: "pans, knives, opinions" },
            { name: "recipe-rescue", purpose: "how do i fix this" }
        ],
        lexicon: {
            thing: ["the starter", "my crumb", "the braise", "the sauce", "the crust", "a pan sauce"],
            tool: ["a carbon steel pan", "the dutch oven", "a bench scraper", "a scale", "a thermometer"],
            action: ["salt it earlier", "let it rest", "go hotter", "reduce it more", "just use a scale"],
            adj: ["gummy", "perfect", "underproofed", "flat", "obscene"],
            problem: ["a dead starter", "a soggy bottom", "the sauce splitting", "overproofing overnight"],
            place: ["the oven", "the fridge", "the counter"],
            niche: ["sourdough", "braises", "pasta", "fermentation", "cast iron"]
        },
        takes: [
            "weigh your flour. thats the whole tip. thats the tweet",
            "most recipes are undersalted and underbrowned and thats why yours tastes flat",
            "a sharp cheap knife beats a dull expensive one every day",
            "if you can only own one pan make it carbon steel and i will not be taking questions",
            "cooking from a recipe once teaches you the recipe. cooking it wrong teaches you cooking"
        ],
        questions: [
            "why is my crumb {adj}. photo attached, be honest",
            "does anyone actually use their {tool} or does it live in a cabinet",
            "how long do you let {thing} rest, im impatient and it shows",
            "best thing you made this week? im in a rut"
        ],
        gripes: [
            "{problem} for the third bake in a row. im taking it personally now",
            "followed the recipe exactly and got something {adj}",
            "left {thing} in {place} overnight. rip",
            "the recipe said 'until golden'. golden according to WHO"
        ],
        wins: [
            "best crumb ive ever gotten. open, chewy, slightly {adj} in the good way",
            "the {niche} thing finally clicked. i get it now",
            "fed six people out of one pot and nobody asked what was in it. perfect crime"
        ]
    },
    {
        id: "birding",
        label: "Birding",
        glyph: "🐦",
        blurb: "binoculars, patience, quiet excitement",
        serverNouns: ["Marsh", "Hedgerow", "Migration", "Flyway", "Field"],
        channels: [
            { name: "sightings", purpose: "what did you see today" },
            { name: "id-help", purpose: "blurry photo, brave guess" },
            { name: "gear", purpose: "optics and arguments about optics" },
            { name: "patch-reports", purpose: "your local patch, daily" }
        ],
        lexicon: {
            thing: ["a juvenile gull", "the heron", "a warbler", "that raptor", "the flock"],
            tool: ["8x42s", "a scope", "Merlin", "the field guide", "a thermos"],
            action: ["wait it out", "check the flight pattern", "listen for the call", "get there before sunrise"],
            adj: ["cooperative", "distant", "backlit", "unbothered", "gone in two seconds"],
            problem: ["fog", "a dog off leash", "the light being all wrong", "gull identification"],
            place: ["the marsh", "the reservoir", "my patch", "the hedgerow"],
            niche: ["shorebirds", "raptors", "warblers", "gulls", "owls"]
        },
        takes: [
            "gull id is a lifestyle and i regret choosing it",
            "the bird you see every day is worth more attention than the rarity you drove two hours for",
            "learn the calls. you will double your list without walking further",
            "a cheap pair of binoculars you carry beats good glass in a drawer",
            "birding is just standing still until something happens, which is a skill"
        ],
        questions: [
            "id help? {adj} bird at {place} this morning, photo is bad sorry",
            "anyone else's patch dead this week or is it just {problem}",
            "worth upgrading from {tool}? im on the fence",
            "whats the earliest anyone has seen {niche} come through this year"
        ],
        gripes: [
            "{problem} the entire morning. saw four sparrows and my own breath",
            "the {thing} was RIGHT there and my lens cap was on",
            "drove ninety minutes for a bird that left twenty minutes before i arrived",
            "someone flushed the whole flock trying to get a closer photo. please dont do that"
        ],
        wins: [
            "lifer!! {thing} at {place}, sat there for six full minutes being {adj}",
            "finally got a clean shot of the {thing}. after three weeks",
            "the {niche} are back. right on schedule, right where they were last year 🥲"
        ]
    },
    {
        id: "film",
        label: "Film Club",
        glyph: "🎞",
        blurb: "watchlists nobody will finish",
        serverNouns: ["Screening", "Reel", "Marquee", "Projection", "Cinema"],
        channels: [
            { name: "what-you-watched", purpose: "one line reviews" },
            { name: "recommend-me", purpose: "specific requests only" },
            { name: "watch-along", purpose: "press play at the same time" },
            { name: "letterboxd-crimes", purpose: "defend your ratings" }
        ],
        lexicon: {
            thing: ["the third act", "the sound design", "that long take", "the ending", "the score"],
            tool: ["letterboxd", "a physical copy", "the criterion app", "subtitles"],
            action: ["rewatch it", "go in blind", "read nothing first", "watch it late at night"],
            adj: ["stunning", "hollow", "overlong", "perfect", "unbearable in a good way"],
            problem: ["a terrible transfer", "spoilers in the thumbnail", "a bad theater crowd"],
            place: ["the rep theater", "my couch", "the watchlist"],
            niche: ["70s paranoia thrillers", "slow cinema", "giallo", "documentaries", "musicals"]
        },
        takes: [
            "a movie you can describe perfectly afterwards probably didnt do much to you",
            "the watchlist is not a to do list. it is a mood board. let it be long",
            "rewatching is underrated. the second time is when you actually watch it",
            "sound design does more emotional work than the score and gets a tenth of the credit",
            "you are allowed to dislike a masterpiece. you just have to say why"
        ],
        questions: [
            "recommend me something {adj} but under 100 minutes, im tired",
            "does {thing} hold up for anyone else or was i just in the right mood",
            "whats the best thing anyone saw at {place} this month",
            "anyone up for a watch along this weekend? im thinking {niche}"
        ],
        gripes: [
            "{problem}. ruined the whole first act",
            "everyone told me the ending was {adj} and now i cant unsee the setup",
            "my watchlist is at 340 and i rewatched the same movie instead. again",
            "the only print available is {adj} and it hurts to look at"
        ],
        wins: [
            "watched a {niche} thing on a whim and it wrecked me. new favorite",
            "got four people to sit through a three hour movie and nobody checked their phone",
            "finally saw it on 35 at {place}. completely different film"
        ]
    },
    {
        id: "running",
        label: "Running",
        glyph: "👟",
        blurb: "splits, shin splints, 6am",
        serverNouns: ["Mile", "Trail", "Pace", "Loop", "Track"],
        channels: [
            { name: "todays-run", purpose: "log it here" },
            { name: "injury-corner", purpose: "not medical advice" },
            { name: "shoe-talk", purpose: "yes another pair" },
            { name: "race-plans", purpose: "goals and dread" }
        ],
        lexicon: {
            thing: ["my long run", "the tempo", "easy pace", "the last mile", "my cadence"],
            tool: ["a heart rate strap", "the treadmill", "carbon plates", "a foam roller"],
            action: ["slow down the easy days", "take the rest day", "add strength work", "negative split it"],
            adj: ["brutal", "effortless", "grim", "smooth", "humbling"],
            problem: ["shin splints", "a tight IT band", "heat", "a side stitch at mile 3"],
            place: ["the river path", "the track", "the hill route"],
            niche: ["trail", "marathon training", "5k", "ultras"]
        },
        takes: [
            "80% of your running should feel embarrassingly easy and nobody does it",
            "the rest day is the training. thats where the adaptation happens",
            "shoes matter way less than sleep and everybody wants it to be the shoes",
            "consistency beats intensity for like four straight years before intensity matters",
            "running with a watch you never look at is the best of both worlds"
        ],
        questions: [
            "anyone else's easy pace get slower before it got faster",
            "how do you handle {problem} without just stopping entirely",
            "worth it to actually train for a {niche} or should i keep vibing",
            "whats everyone running in right now, mine are at 500 miles and squishy"
        ],
        gripes: [
            "{problem} is back. two weeks off, again",
            "the {thing} felt {adj} today and the pace was 40 seconds slower. make it make sense",
            "got rained on for nine miles and my phone died at mile 2 so it doesnt even count",
            "someone passed me on the hill and i raced them and now i cant walk"
        ],
        wins: [
            "negative split the long run for the first time ever",
            "PR!! and i didnt even feel {adj} at the end",
            "ran the {place} loop without walking. six months ago i couldnt do half of it"
        ]
    },
    {
        id: "keebs",
        label: "Keyboards",
        glyph: "⌨",
        blurb: "switches, foam, and a lot of lube",
        serverNouns: ["Switch", "Layout", "Keycap", "Board", "Bench"],
        channels: [
            { name: "show-your-board", purpose: "photos of the same rectangle" },
            { name: "group-buys", purpose: "money, waiting, regret" },
            { name: "switch-talk", purpose: "the sound and the feel" },
            { name: "layout-lab", purpose: "40% enthusiasts, please" }
        ],
        lexicon: {
            thing: ["the plate", "my switches", "the case foam", "stabilizers", "the layout"],
            tool: ["a switch puller", "dielectric grease", "band aid mod", "a hot swap socket"],
            action: ["lube the stabs", "tape mod it", "go plateless", "just type on it for a week"],
            adj: ["thocky", "pingy", "mushy", "crisp", "way too loud for an office"],
            problem: ["stab rattle", "a ping in the case", "chattering keys", "a group buy going dark"],
            place: ["the desk", "the group buy thread", "the vendor page"],
            niche: ["40%", "split ergo", "ortholinear", "vintage IBM"]
        },
        takes: [
            "lubing stabs is 80% of the sound and everybody spends their money on the other 20%",
            "the endgame board doesnt exist. the endgame is getting bored, which is different",
            "you will not get faster on a 40%. you will get more annoying, which is its own reward",
            "sound tests are useless without the same mic and everyone knows it and posts them anyway",
            "the best board is the one you stopped modding six months ago"
        ],
        questions: [
            "is {problem} fixable or do i order new ones",
            "whats everyone typing on today",
            "does {tool} actually help or is it placebo, be honest",
            "thinking about going {niche}. talk me out of it or into it"
        ],
        gripes: [
            "{problem} on a board i just finished building. back apart it goes",
            "group buy is 14 months late and the updates have stopped",
            "spent an entire evening on {thing} and it sounds exactly the same",
            "typed on it for one day and now every other board feels {adj}"
        ],
        wins: [
            "finished the build. it sounds {adj} and i am insufferable about it",
            "the {tool} mod actually worked. no more {problem}",
            "group buy shipped. only nine months late 🎉"
        ]
    }
];

export const DOMAIN_BY_ID = Object.fromEntries(DOMAINS.map((d) => [d.id, d]));

// A handful of general-purpose rooms exist in almost every server, and they
// are where off-topic life chatter happens.
export const COMMON_CHANNELS = [
    { name: "general", purpose: "everything and nothing" },
    { name: "introductions", purpose: "say hi, we're nice" },
    { name: "off-topic", purpose: "no rules except the rules" },
    { name: "rules", purpose: "read once, ignore forever", readOnly: true }
];
