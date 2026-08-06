// Conversational moves. The dialogue engine picks a move based on what just
// happened in the channel, then fills the slots from the channel's domain
// lexicon. Slots: {thing} {tool} {action} {adj} {problem} {place} {niche}
// {name} (a mention) {quote} (fragment of the message being replied to).

export const MOVES = {
    agree: [
        "yes exactly this. {thing} is where it always falls apart for me too",
        "hard agree. i learned this the expensive way",
        "this is the correct opinion and i will be quoting it later",
        "yeah the {thing} thing is real. took me way too long to accept it",
        "{name} is right and its annoying how right",
        "same honestly. every single time",
        "ok yeah when you put it like that",
        "co-signed. {action} solved this for me and i felt stupid about how simple it was"
    ],
    softAgree: [
        "kind of? i think its true for {niche} at least",
        "yeah with caveats. {thing} complicates it a bit",
        "mostly agree. the exception is when {problem} is involved",
        "true for me but i also have {tool} so my situation is weird",
        "i want to agree. i think i mostly do"
    ],
    disagree: [
        "eh i dont think thats it. {thing} matters way more than people give it credit for",
        "counterpoint: ive done the opposite for years and its been fine",
        "respectfully no lol. thats survivorship bias",
        "hmm. thats true right up until {problem} shows up and then its not",
        "i think thats half right. the other half is just {thing}",
        "gonna push back gently. that advice works if you already know why it works",
        "not in my experience but my setup is cursed so"
    ],
    question: [
        "wait how do you handle {problem} then",
        "ok but does that hold if youre doing {niche}",
        "genuine question, do you {action} first or after",
        "whats your {tool} situation. i feel like thats doing a lot of work here",
        "sorry can you say more about the {thing} part",
        "is that a {niche} thing or does it apply generally",
        "@{name} how long did that take you"
    ],
    answer: [
        "for me its {action}. not glamorous but it works",
        "i just {action} and stop thinking about it. life got better",
        "depends on {thing} honestly. if its {adj} then no, otherwise yes",
        "the thing that finally fixed it was {tool}. everything before that was guessing",
        "you probably want to {action} first, then look at {thing}",
        "ive had {problem} twice and both times it was something stupid and upstream",
        "no idea sorry, but @{name} does this a lot i think"
    ],
    joke: [
        "the {thing} has become a character in this server at this point",
        "we should put {quote} in the channel topic",
        "not me reading this at 2am nodding like it applies to me",
        "every server needs someone to say this out loud once a month, thank you for your service",
        "and yet i will do the exact opposite tomorrow",
        "{thing} my beloved. {thing} my enemy",
        "this is the most personally attacked ive felt all week",
        "sir this is a {niche} channel"
    ],
    tangent: [
        "slightly off topic but this reminded me — {tangentSeed}",
        "sorry tangent: does anyone else {tangentSeed}",
        "unrelated but {tangentSeed}, anyway carry on",
        "ok this is a derail. {tangentSeed}"
    ],
    anecdote: [
        "had this exact thing happen at {place} last month. ended up having to {action}",
        "one time i ignored {problem} for three weeks and it got expensive",
        "my first attempt at this was so {adj} that i still think about it",
        "i did this backwards for years and nobody told me. thats on them honestly",
        "spent an entire weekend on {thing} once. would do it again. shouldnt have done it once"
    ],
    support: [
        "ugh im sorry. {problem} is the worst one",
        "that sucks. genuinely. take the night off",
        "been there. it does get better once {thing} settles down",
        "youre not doing anything wrong, this happens to everyone at some point 🫂",
        "for what its worth it sounds like you caught it early",
        "no advice just solidarity"
    ],
    hype: [
        "OH thats {adj}. congrats!!",
        "lets goooo 🎉",
        "this rules. genuinely happy for you",
        "ok that is extremely good. how long did it take",
        "see this is why i stay in this channel",
        "thats the payoff right there. enjoy it before you start seeing flaws lol"
    ],
    callback: [
        "still thinking about {quote} btw",
        "coming back to this — {name} you were right and i owe you one",
        "for the record {quote} has been rattling around my head all day",
        "update on the thing from earlier: it was {problem}. it is always {problem}"
    ],
    greet: [
        "morning all ☕",
        "hi hi. what did i miss",
        "back. what happened in here",
        "hello, reporting for duty",
        "gm. scrolling up now",
        "oh its busy in here today"
    ],
    depart: [
        "ok im out, night everyone",
        "afk for a bit, ping me if {thing} explodes",
        "gotta go be a person. later",
        "logging off before i start {action} at midnight again"
    ],
    lurkConfession: [
        "ive been lurking here for months and this is the thread that got me to type",
        "first message here. hi. ive read everything and contributed nothing until now",
        "delurking to say this is the only channel i have unmuted"
    ],
    meta: [
        "this server has genuinely improved my {niche} more than any tutorial",
        "we are so normal about {thing} in here",
        "love that this channel is 40% advice and 60% moral support",
        "someone should pin the last five messages",
        "the ratio of good info to nonsense here is unusually high, well done us"
    ],
    modNote: [
        "quick note: keeping {niche} chat in the right channel please, easier to search later 🙏",
        "pinned the answer above, it comes up constantly",
        "adding a channel for this, it has clearly outgrown general",
        "reminder that nobody here has to justify being a beginner",
        "cleaned up the duplicate threads, nothing personal"
    ],
    linkDrop: [
        "found this and thought of this channel: {linkTitle}",
        "{linkTitle} — worth ten minutes",
        "posting this here instead of doing my actual work: {linkTitle}",
        "the {linkTitle} write up is the best explanation of {thing} ive seen"
    ],
    welcome: [
        "welcome!! {place} is the good channel, start there",
        "hi @{name}, what got you into {niche}",
        "welcome aboard 🎉 ask anything, we are all making it up",
        "hey welcome. fair warning we talk about {thing} constantly"
    ],
    selfIntro: [
        "hi all. into {niche} for about {years} years, mostly {adj} results so far",
        "hey, new here. found this via a friend. i mostly do {niche}",
        "hello! long time {niche} person, first time in a server about it",
        "joining because my group chat is tired of hearing about {thing}"
    ]
};

export const TANGENT_SEEDS = [
    "get weirdly nostalgic about old forums",
    "have a folder of screenshots you will never open again",
    "keep a note of ideas you never act on",
    "reorganize your whole setup instead of using it",
    "read the manual only after breaking it",
    "keep buying the thing that fixes the problem you already fixed",
    "have one friend who does this professionally and refuses to help",
    "have a playlist specifically for this and it's four songs"
];

export const LINK_TITLES = [
    "a very long blog post from 2009",
    "this 40 minute video with 300 views",
    "someone's forum thread from 2014 that solved it",
    "a wiki page that shouldn't be this good",
    "an out of print pdf someone scanned",
    "this thread with one reply and the reply is the answer",
    "a spreadsheet a stranger maintains for free",
    "the original documentation, which nobody reads"
];

export const SERVER_WELCOME = [
    "welcome to {serverName}. this is a small place. be normal, be curious, post the thing you think is too boring to post.",
    "{serverName} exists because a group chat got too big. rules: don't be cruel, don't be a brand, use the channels loosely.",
    "hi. {serverName} is for {blurb}. no experience level required, no self promo without a conversation attached.",
    "{serverName}: an experiment in whether a small server can stay small. read #rules once, then ignore it like everyone else."
];

export const RULES_TEXT = [
    "1. be kind, especially to beginners\n2. no self promo without a real conversation attached\n3. put photos in the right channel so search works\n4. arguing is fine, being a jerk about it is not\n5. if you're going to be gone, no need to announce it. we'll be here",
    "1. don't be cruel\n2. don't be a brand\n3. spoilers get tagged\n4. ask the dumb question, someone else has it too\n5. mods are volunteers and are also mostly asleep"
];
