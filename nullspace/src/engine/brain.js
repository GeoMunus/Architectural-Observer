import { VOICE_PROFILES } from "../data/voice.js";
import { DOMAIN_BY_ID } from "../data/topics.js";

// Optional live-model backend. With no key configured the network runs entirely
// on the local generator; with a key, the agent whose room you are actually
// reading gets its lines written by Gemini instead, in character.
//
// The key lives in localStorage on this machine and nowhere else. It is never
// written into the saved world, never logged, and never sent anywhere except
// Google's endpoint.

const KEY_STORE = "nullspace.gemini.key";
const MODEL_STORE = "nullspace.gemini.model";
const ENABLED_STORE = "nullspace.gemini.enabled";
// Test hook: lets the harness point the client at a local mock instead of
// Google. Not set in normal use.
const ENDPOINT_STORE = "nullspace.gemini.endpoint";

export const DEFAULT_MODEL = "gemini-2.5-flash";

const VOICE_BY_ID = Object.fromEntries(VOICE_PROFILES.map((v) => [v.id, v]));

function read(store, fallback = "") {
    try {
        return localStorage.getItem(store) || fallback;
    } catch {
        return fallback;
    }
}

function write(store, value) {
    try {
        if (value) localStorage.setItem(store, value);
        else localStorage.removeItem(store);
        return true;
    } catch {
        return false;
    }
}

export const settings = {
    getKey: () => read(KEY_STORE),
    setKey: (value) => write(KEY_STORE, value.trim()),
    clearKey: () => write(KEY_STORE, ""),
    getModel: () => read(MODEL_STORE, DEFAULT_MODEL),
    setModel: (value) => write(MODEL_STORE, value.trim()),
    isEnabled: () => read(ENABLED_STORE, "1") === "1",
    setEnabled: (value) => write(ENABLED_STORE, value ? "1" : "0"),
    getEndpoint: () => read(ENDPOINT_STORE),
    // Shown in the UI so the key is never fully rendered anywhere.
    maskedKey() {
        const key = this.getKey();
        if (!key) return "";
        return `${key.slice(0, 4)}…${key.slice(-4)} (${key.length} chars)`;
    }
};

function endpointFor(model) {
    const override = settings.getEndpoint();
    if (override) return override;
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

// Turns a voice profile into instructions a model can actually follow.
function voiceRules(voice) {
    const rules = [];
    rules.push(voice.casing === "lower"
        ? "Type in all lowercase. Never capitalise, including the word i."
        : "Use normal sentence capitalisation.");
    rules.push(voice.endPunctuation > 0.6
        ? "End sentences with proper punctuation."
        : "Usually leave off the final full stop.");
    if (voice.exclaimRate > 0.3) rules.push("Use exclamation marks freely.");
    if (voice.capsBurstRate > 0.1) rules.push("Occasionally put one word in ALL CAPS for emphasis.");
    if (voice.emojiRate > 0.3) rules.push("Emoji are welcome, at most one or two.");
    else if (voice.emojiRate < 0.06) rules.push("No emoji.");
    if (voice.abbrevRate > 0.4) rules.push("Use chat shorthand: u, ur, idk, ngl, tbh, rn, prob.");
    if (voice.typoRate > 0.04) rules.push("A small typo is fine; do not correct it.");
    if (voice.lengthBias < -0.4) rules.push("Be extremely short — often under six words.");
    else if (voice.lengthBias < -0.1) rules.push("Keep it to one short sentence.");
    else if (voice.lengthBias > 0.5) rules.push("Ramble a little: two or three clauses, a tangent or aside.");
    else rules.push("One or two sentences.");
    if (voice.parentheticalRate > 0.25) rules.push("An aside in parentheses suits you.");
    if (voice.signatures?.length) {
        rules.push(`Phrases you actually use: ${voice.signatures.join(", ")}.`);
    }
    if (voice.laughs?.length) rules.push(`When amused you write: ${voice.laughs.join(" / ")}.`);
    return rules;
}

// What the chosen conversational move is asking this character to do.
const MOVE_BRIEF = {
    take: "Share an opinion about the subject that you actually hold. Be specific, not generic.",
    question: "Ask the room a genuine question you want answered.",
    gripe: "Complain about something that just went wrong for you.",
    win: "Share something that went well. Be pleased but not boastful.",
    answer: "Answer the open question directly and practically, from experience.",
    agree: "Agree with the message you are replying to, and add one concrete detail.",
    softAgree: "Partly agree, with a caveat.",
    disagree: "Push back on the message you are replying to. Be civil but real.",
    joke: "Make a short joke about what was just said. Do not explain it.",
    anecdote: "Tell a very short story from your own experience that relates.",
    support: "Offer sympathy to someone having a bad time. Short and warm.",
    hype: "Be enthusiastic about someone else's good news.",
    callback: "Refer back to something said earlier in the channel.",
    tangent: "Go off on a mild tangent, acknowledging that you are doing it.",
    welcome: "Welcome a newcomer and ask them something.",
    meta: "Comment on the server or channel itself.",
    modNote: "Post a brief moderator housekeeping note.",
    greet: "Say hello, you have just arrived.",
    linkDrop: "Mention something you found and why it is worth a look.",
    selfIntro: "Introduce yourself briefly to a new server."
};

export function buildPrompt(world, agent, channel, composed) {
    const voice = VOICE_BY_ID[agent.voiceId] || VOICE_PROFILES[0];
    const domain = DOMAIN_BY_ID[channel.domainId];
    const server = world.servers[channel.serverId];
    const history = channel.messages.slice(-12).map((message) => {
        const author = world.agents[message.authorId];
        return `${author ? author.handle : "someone"}: ${message.text}`;
    }).join("\n");

    const target = composed.targetId
        ? channel.messages.find((m) => m.id === composed.targetId)
        : null;
    const targetAuthor = target ? world.agents[target.authorId] : null;

    const persona = [
        `You are @${agent.handle}${agent.displayName !== agent.handle ? ` (display name "${agent.displayName}")` : ""}.`,
        `Bio: ${agent.bio}`,
        `Personality: ${agent.traits.join(", ")}. Right now you feel ${moodWord(agent)}.`,
        `You care about ${domain ? domain.label.toLowerCase() : "this topic"} — ${domain ? domain.blurb : ""}.`,
        `Your typing style: ${voice.label}.`,
        ...voiceRules(voice).map((rule) => `- ${rule}`)
    ].join("\n");

    const situation = [
        `You are in the server "${server ? server.name : "a server"}", channel #${channel.name} (${channel.purpose}).`,
        history ? `Recent messages:\n${history}` : "The channel is quiet.",
        target && targetAuthor
            ? `You are replying to @${targetAuthor.handle}: "${target.text}"`
            : "",
        `What you are doing: ${MOVE_BRIEF[composed.move] || "Say something that fits the conversation."}`
    ].filter(Boolean).join("\n\n");

    return [
        "You are writing one message in a group chat. Everyone here is a regular person with hobbies, not a professional and not an assistant.",
        persona,
        situation,
        [
            "Write only the message text.",
            "Do not prefix it with your name. Do not wrap it in quotes. No markdown formatting.",
            "Do not be helpful, polished, or comprehensive — be a person typing quickly.",
            "Never mention being an AI, a model, or a simulation.",
            "One message only, and keep it under 240 characters."
        ].join(" ")
    ].join("\n\n---\n\n");
}

function moodWord(agent) {
    const { valence, energy } = agent.mood;
    if (valence > 0.4 && energy > 0.6) return "upbeat and chatty";
    if (valence > 0.3) return "cheerful";
    if (valence < -0.35) return "irritable";
    if (valence < -0.1) return "a bit flat";
    if (energy < 0.3) return "tired";
    return "fairly level";
}

// Models like to add a speaker prefix, quotes, or markdown no matter how
// firmly you ask them not to.
export function cleanReply(raw, agent) {
    let text = String(raw || "").trim();
    text = text.replace(/^```[\w]*\n?|```$/g, "").trim();
    text = text.replace(new RegExp(`^@?${agent.handle}\\s*[:>-]\\s*`, "i"), "");
    text = text.replace(/^["'“”](.*)["'“”]$/s, "$1");
    text = text.replace(/^\*+|\*+$/g, "");
    text = text.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 2).join("\n");
    if (text.length > 400) text = `${text.slice(0, 397)}...`;
    return text.trim();
}

function generationConfigFor(model) {
    const config = {
        temperature: 1.1,
        topP: 0.95,
        // Generous, because thinking models spend from this budget before
        // emitting any text — too low and the response comes back empty.
        maxOutputTokens: 2000,
        stopSequences: ["\n\n"]
    };
    // A one-line chat message needs no deliberation, and turning thinking off
    // makes replies land in about a second. Only the 2.5 Flash family accepts a
    // zero budget, so this stays opt-in by model name.
    if (/2\.5-flash/i.test(model)) {
        config.thinkingConfig = { thinkingBudget: 0 };
    }
    return config;
}

export class GeminiBrain {
    constructor(options = {}) {
        // Quota guards. The local generator covers everything these refuse.
        this.maxPerMinute = options.maxPerMinute || 15;
        this.maxConcurrent = options.maxConcurrent || 2;
        this.timeoutMs = options.timeoutMs || 12000;
        this.recentCalls = [];
        this.inFlight = 0;
        this.stats = { calls: 0, ok: 0, failed: 0, skipped: 0, lastError: "" };
    }

    get available() {
        return Boolean(settings.getKey()) && settings.isEnabled();
    }

    canSpend() {
        if (!this.available) return false;
        const cutoff = Date.now() - 60000;
        this.recentCalls = this.recentCalls.filter((t) => t > cutoff);
        if (this.recentCalls.length >= this.maxPerMinute) {
            this.stats.skipped += 1;
            return false;
        }
        if (this.inFlight >= this.maxConcurrent) {
            this.stats.skipped += 1;
            return false;
        }
        return true;
    }

    async write(world, agent, channel, composed) {
        const key = settings.getKey();
        if (!key) throw new Error("no api key configured");
        const model = settings.getModel() || DEFAULT_MODEL;
        const prompt = buildPrompt(world, agent, channel, composed);

        this.recentCalls.push(Date.now());
        this.inFlight += 1;
        this.stats.calls += 1;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const response = await fetch(endpointFor(model), {
                method: "POST",
                signal: controller.signal,
                headers: {
                    "Content-Type": "application/json",
                    // Header rather than query string, so the key stays out of
                    // URLs, referrers and any request log along the way.
                    "x-goog-api-key": key
                },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: generationConfigFor(model)
                })
            });

            if (!response.ok) {
                const detail = await response.text().catch(() => "");
                throw new Error(`${response.status} ${response.statusText}${detail ? ` — ${detail.slice(0, 200)}` : ""}`);
            }
            const data = await response.json();
            const candidate = data?.candidates?.[0];
            const text = candidate?.content?.parts?.map((p) => p.text).filter(Boolean).join("") || "";
            const cleaned = cleanReply(text, agent);
            if (!cleaned) {
                throw new Error(`empty response${candidate?.finishReason ? ` (${candidate.finishReason})` : ""}`);
            }
            this.stats.ok += 1;
            return cleaned;
        } catch (error) {
            this.stats.failed += 1;
            // Never let a key fragment reach a log line or the UI.
            this.stats.lastError = scrub(String(error.message || error));
            throw error;
        } finally {
            clearTimeout(timer);
            this.inFlight -= 1;
        }
    }

    // Round trip used by the "test connection" button.
    async test() {
        const key = settings.getKey();
        if (!key) return { ok: false, message: "no key saved yet" };
        const model = settings.getModel() || DEFAULT_MODEL;
        try {
            const response = await fetch(endpointFor(model), {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": key },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: "Reply with the single word: ok" }] }],
                    generationConfig: { maxOutputTokens: 2000 }
                })
            });
            if (!response.ok) {
                const detail = await response.text().catch(() => "");
                return { ok: false, message: scrub(`${response.status} ${response.statusText} ${detail.slice(0, 160)}`) };
            }
            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
            return { ok: true, message: `${model} responded: ${text.trim().slice(0, 60) || "(empty)"}` };
        } catch (error) {
            return { ok: false, message: scrub(String(error.message || error)) };
        }
    }
}

// Defence in depth: strip anything key-shaped out of text headed for the UI.
function scrub(text) {
    return text.replace(/AIza[0-9A-Za-z_-]{10,}/g, "[redacted]");
}
