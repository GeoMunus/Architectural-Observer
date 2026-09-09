import { bootstrapWorld, createUserAgent } from "../engine/genesis.js";
import { Simulation } from "../engine/simulation.js";
import { loadWorld, saveWorld, clearWorld } from "../engine/persistence.js";
import { Rng } from "../util/rng.js";
import { PRESENCE, moodLabel, presenceRank } from "../model/agent.js";
import { DOMAIN_BY_ID } from "../data/topics.js";
import { VOICE_PROFILES } from "../data/voice.js";
import { GeminiBrain, settings as modelSettings, DEFAULT_MODEL } from "../engine/brain.js";
import { attachScrollbar } from "./scrollbar.js";
import { pinViewport, preservingScroll } from "./viewport.js";

const VOICE_LABEL = Object.fromEntries(VOICE_PROFILES.map((v) => [v.id, v.label]));

const el = (id) => document.getElementById(id);

const dom = {
    boot: el("boot"),
    bootHandle: el("bootHandle"),
    bootSeed: el("bootSeed"),
    bootEnter: el("bootEnter"),
    bootWatch: el("bootWatch"),
    bootNote: el("bootNote"),
    app: el("app"),
    rail: el("rail"),
    serverName: el("serverName"),
    serverBlurb: el("serverBlurb"),
    channels: el("channels"),
    me: el("me"),
    channelName: el("channelName"),
    channelPurpose: el("channelPurpose"),
    messages: el("messages"),
    scrollbar: el("scrollbar"),
    scrollThumb: el("scrollThumb"),
    typing: el("typing"),
    composer: el("composer"),
    composerInput: el("composerInput"),
    clock: el("clock"),
    speeds: el("speeds"),
    togglePanel: el("togglePanel"),
    toggleChannels: el("toggleChannels"),
    scrim: el("scrim"),
    panel: el("panel"),
    members: el("tab-members"),
    feed: el("feed"),
    stats: el("stats"),
    profile: el("profile"),
    profileCard: el("profileCard"),
    seedInput: el("seedInput"),
    regenerate: el("regenerate"),
    wipe: el("wipe"),
    apiKey: el("apiKey"),
    apiModel: el("apiModel"),
    apiSave: el("apiSave"),
    apiTest: el("apiTest"),
    apiClear: el("apiClear"),
    apiEnabled: el("apiEnabled"),
    apiStatus: el("apiStatus"),
    apiStats: el("apiStats")
};

// Shared across worlds — regenerating the network should not lose the key.
const brain = new GeminiBrain();

const state = {
    world: null,
    sim: null,
    serverId: null,
    channelId: null,
    tab: "members",
    renderedIds: new Set(),
    lastRendered: null,
    dirty: { sidebar: true, members: true, feed: true, stats: true, model: true },
    lastSave: 0,
    lastFrame: 0
};

// ---------------------------------------------------------------- utilities

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
}

function linkifyMentions(text) {
    return escapeHtml(text).replace(/@([a-z0-9_]+)/gi, '<span class="mention">@$1</span>');
}

function avatarStyle(agent) {
    const hue = agent.hue;
    return `background: linear-gradient(150deg, hsl(${hue} 70% 62%), hsl(${(hue + 42) % 360} 65% 46%));`;
}

function avatarHtml(agent, { size = "", withStatus = false, clickable = true } = {}) {
    const cls = `avatar${size === "sm" ? " avatar--sm" : ""}`;
    const inner = `<button class="${cls}" style="${avatarStyle(agent)}" data-agent="${agent.id}" ${clickable ? "" : "disabled"}>${escapeHtml(agent.glyph)}</button>`;
    if (!withStatus) return inner;
    return `<span class="avatar-wrap">${inner}<span class="status-dot status-${agent.presence}"></span></span>`;
}

function roleOf(world, serverId, agentId) {
    return world.servers[serverId]?.roles[agentId] || "";
}

// ------------------------------------------------------------------- render

function renderRail() {
    const { world } = state;
    const items = world.serverList.map((server) => {
        const unread = world.channelsOf(server.id).reduce((sum, c) => sum + (c.unread || 0), 0);
        const active = server.id === state.serverId ? " is-active" : "";
        return `<button class="rail__item${active}" data-server="${server.id}"
            data-unread="${unread > 0}"
            style="background: linear-gradient(150deg, hsl(${server.hue} 60% 40%), hsl(${(server.hue + 40) % 360} 55% 26%));"
            title="${escapeHtml(server.name)}">${server.glyph}</button>`;
    }).join("");
    dom.rail.innerHTML = `${items}<div class="rail__divider"></div>`;
}

function renderSidebar() {
    const { world } = state;
    const server = world.servers[state.serverId];
    if (!server) return;
    dom.serverName.textContent = server.name;
    dom.serverBlurb.textContent = `${server.memberIds.length} members · ${server.description}`;

    const channels = world.channelsOf(server.id);
    const groups = new Map();
    for (const channel of channels) {
        if (!groups.has(channel.category)) groups.set(channel.category, []);
        groups.get(channel.category).push(channel);
    }

    let html = "";
    for (const [category, list] of groups) {
        html += `<div class="channels__category">${escapeHtml(category)}</div>`;
        for (const channel of list) {
            const active = channel.id === state.channelId ? " is-active" : "";
            const live = state.sim.typingIn(channel.id).length > 0;
            const badge = channel.unread > 0
                ? `<span class="channel__badge">${channel.unread > 99 ? "99+" : channel.unread}</span>`
                : (live ? '<span class="channel__live"></span>' : "");
            html += `<button class="channel${active}" data-channel="${channel.id}">
                <span class="hash">#</span><span>${escapeHtml(channel.name)}</span>${badge}
            </button>`;
        }
    }
    preservingScroll(dom.channels, () => { dom.channels.innerHTML = html; });
}

function renderMe() {
    const { world } = state;
    const user = world.agents[world.userId];
    if (!user) {
        dom.me.innerHTML = `<div class="me__meta"><div class="me__name">observer</div>
            <div class="me__sub">watching, not posting</div></div>`;
        return;
    }
    dom.me.innerHTML = `${avatarHtml(user, { size: "sm", withStatus: true })}
        <div class="me__meta">
            <div class="me__name">${escapeHtml(user.displayName)}</div>
            <div class="me__sub">@${escapeHtml(user.handle)} · you</div>
        </div>`;
}

function messageHtml(world, message, previous) {
    const author = world.agents[message.authorId];
    if (!author) return "";
    const stamp = world.stampFor(message.minute);
    const grouped = previous
        && previous.authorId === message.authorId
        && Math.abs(message.minute - previous.minute) < 12
        && !message.replyTo;

    const isMine = message.authorId === world.userId;
    const mentionsMe = world.userId && message.mentions.includes(world.userId);
    const classes = ["msg"];
    if (grouped) classes.push("msg--grouped");
    if (isMine) classes.push("msg--mine");
    if (mentionsMe) classes.push("msg--mention");

    let replyHtml = "";
    if (message.replyTo) {
        const channel = world.channels[message.channelId];
        const target = channel.messages.find((m) => m.id === message.replyTo);
        const targetAuthor = target ? world.agents[target.authorId] : null;
        if (target && targetAuthor) {
            const snippet = target.text.length > 70 ? `${target.text.slice(0, 70)}…` : target.text;
            replyHtml = `<div class="msg__reply">${avatarHtml(targetAuthor, { size: "sm", clickable: false })}
                <span>@${escapeHtml(targetAuthor.handle)}</span> <em>${escapeHtml(snippet)}</em></div>`;
        }
    }

    const reactions = Object.entries(message.reactions || {});
    const reactionHtml = reactions.length
        ? `<div class="reactions">${reactions.map(([emoji, ids]) => {
            const mine = world.userId && ids.includes(world.userId) ? " is-mine" : "";
            const who = ids.map((id) => world.agents[id]?.handle).filter(Boolean).join(", ");
            return `<span class="reaction${mine}" title="${escapeHtml(who)}">${emoji} ${ids.length}</span>`;
        }).join("")}</div>`
        : "";

    const body = message.kind === "system"
        ? `<div class="system-note">${escapeHtml(message.text)}</div>`
        : `<div class="msg__body">${linkifyMentions(message.text)}</div>`;

    const role = roleOf(world, world.channels[message.channelId]?.serverId, message.authorId);
    const roleTag = role && !grouped ? `<span class="msg__role">${escapeHtml(role)}</span>` : "";

    const head = grouped
        ? `<div class="msg__gutter">${stamp.text}</div>`
        : `${avatarHtml(author, { withStatus: false })}`;

    const meta = grouped ? "" : `<div class="msg__head">
            <span class="msg__author" data-agent="${author.id}" style="color: hsl(${author.hue} 65% 72%)">${escapeHtml(author.displayName)}</span>
            ${roleTag}
            <span class="msg__time"><span class="msg__day">day ${stamp.day} · </span>${stamp.text}</span>
        </div>`;

    return `<div class="${classes.join(" ")}" data-message="${message.id}">
        ${grouped ? head : `<div>${head}</div>`}
        <div>${replyHtml}${meta}${body}${reactionHtml}</div>
    </div>`;
}

let scrollbar = null;

function nearBottom() {
    // Dragging the thumb is an explicit request to be somewhere else, so never
    // treat it as "close enough to the bottom" and snap away from the finger.
    if (scrollbar && scrollbar.isDragging()) return false;
    const box = dom.messages;
    return box.scrollHeight - box.scrollTop - box.clientHeight < 140;
}

function scrollToBottom() {
    dom.messages.scrollTop = dom.messages.scrollHeight;
}

function renderChannelFull() {
    const { world } = state;
    const channel = world.channels[state.channelId];
    if (!channel) return;

    dom.channelName.textContent = channel.name;
    dom.channelPurpose.textContent = channel.purpose;
    dom.composerInput.placeholder = channel.readOnly
        ? "this channel is read-only"
        : `message #${channel.name} — they will answer`;
    dom.composerInput.disabled = channel.readOnly || !world.userId;

    state.renderedIds = new Set();
    state.lastRendered = null;

    const parts = [];
    let previous = null;
    let previousDay = null;
    for (const message of channel.messages) {
        const day = world.stampFor(message.minute).day;
        if (day !== previousDay) {
            parts.push(`<div class="day-break">day ${day}</div>`);
            previous = null;
            previousDay = day;
        }
        parts.push(messageHtml(world, message, previous));
        state.renderedIds.add(message.id);
        previous = message;
    }
    if (parts.length === 0) {
        parts.push('<p class="panel__hint">nothing here yet. someone will say something eventually — they usually do.</p>');
    }
    state.lastRendered = previous;
    dom.messages.innerHTML = parts.join("");
    scrollToBottom();
    if (scrollbar) scrollbar.update();
}

function appendMessage(message) {
    const { world } = state;
    const stick = nearBottom();
    const day = world.stampFor(message.minute).day;
    const lastDay = state.lastRendered ? world.stampFor(state.lastRendered.minute).day : null;
    if (lastDay !== null && day !== lastDay) {
        dom.messages.insertAdjacentHTML("beforeend", `<div class="day-break">day ${day}</div>`);
        state.lastRendered = null;
    }
    dom.messages.insertAdjacentHTML("beforeend", messageHtml(world, message, state.lastRendered));
    state.renderedIds.add(message.id);
    state.lastRendered = message;
    if (stick) scrollToBottom();
    if (scrollbar) scrollbar.update();
}

function refreshMessage(message) {
    const node = dom.messages.querySelector(`[data-message="${message.id}"]`);
    if (!node) return;
    const reactions = Object.entries(message.reactions || {});
    let holder = node.querySelector(".reactions");
    if (reactions.length === 0) {
        if (holder) holder.remove();
        return;
    }
    const html = reactions.map(([emoji, ids]) => {
        const mine = state.world.userId && ids.includes(state.world.userId) ? " is-mine" : "";
        const who = ids.map((id) => state.world.agents[id]?.handle).filter(Boolean).join(", ");
        return `<span class="reaction${mine}" title="${escapeHtml(who)}">${emoji} ${ids.length}</span>`;
    }).join("");
    if (!holder) {
        holder = document.createElement("div");
        holder.className = "reactions";
        node.lastElementChild.appendChild(holder);
    }
    holder.innerHTML = html;
}

let typingKey = "";

function renderTyping() {
    const typers = state.sim.typingIn(state.channelId);
    // This runs every frame, so only touch the DOM when the set changes.
    const key = typers.map((a) => a.id).join(",");
    if (key === typingKey) return;
    typingKey = key;

    if (typers.length === 0) {
        dom.typing.innerHTML = "";
        return;
    }
    const names = typers.slice(0, 3).map((a) => escapeHtml(a.handle)).join(", ");
    const extra = typers.length > 3 ? ` and ${typers.length - 3} others` : "";
    const verb = typers.length === 1 ? "is" : "are";
    dom.typing.innerHTML = `<span class="typing__dots"><i></i><i></i><i></i></span>
        <span><strong>${names}</strong>${extra} ${verb} typing…</span>`;
}

function renderMembers() {
    const { world } = state;
    const server = world.servers[state.serverId];
    if (!server) return;
    const members = world.membersOf(server.id).sort((a, b) => {
        const rank = presenceRank(a.presence) - presenceRank(b.presence);
        if (rank !== 0) return rank;
        return a.displayName.localeCompare(b.displayName);
    });

    const online = members.filter((m) => m.presence !== PRESENCE.OFFLINE);
    const offline = members.filter((m) => m.presence === PRESENCE.OFFLINE);

    const row = (agent) => {
        const role = roleOf(world, server.id, agent.id) || "member";
        const sub = agent.isHuman
            ? "you"
            : (agent.presence === PRESENCE.OFFLINE ? role : `${role} · ${moodLabel(agent)}`);
        return `<button class="member${agent.presence === PRESENCE.OFFLINE ? " is-offline" : ""}" data-agent="${agent.id}">
            ${avatarHtml(agent, { size: "sm", withStatus: true })}
            <span class="member__meta">
                <span class="member__name" style="color: hsl(${agent.hue} 60% 74%)">${escapeHtml(agent.displayName)}</span>
                <span class="member__sub">${escapeHtml(sub)}</span>
            </span>
        </button>`;
    };

    preservingScroll(dom.members, () => {
        dom.members.innerHTML = `
            <div class="member-group">around — ${online.length}</div>
            ${online.map(row).join("")}
            <div class="member-group">offline — ${offline.length}</div>
            ${offline.map(row).join("")}`;
    });
}

function renderFeed() {
    const { world } = state;
    const entries = world.log.slice(-45).reverse();
    const feedHtml = entries.map((entry) => {
        const stamp = world.stampFor(entry.minute);
        const why = entry.rationale ? `<span>${escapeHtml(entry.rationale)}</span>` : "";
        const src = entry.source === "gemini" ? ' <span class="src">· gemini</span>' : "";
        return `<li data-kind="${entry.kind}"><b>${escapeHtml(entry.text)}${src}</b>${why}
            <span>day ${stamp.day} · ${stamp.text}${entry.move ? ` · move: ${escapeHtml(entry.move)}` : ""}</span></li>`;
    }).join("");
    preservingScroll(dom.feed.parentElement, () => { dom.feed.innerHTML = feedHtml; });
}

function renderStats() {
    const { world } = state;
    const online = world.agentList.filter((a) => a.presence === PRESENCE.ONLINE).length;
    const channels = Object.keys(world.channels).length;
    const bonds = world.agentList.reduce(
        (sum, a) => sum + Object.values(a.relationships).filter((v) => v > 0.4).length, 0
    );
    const rows = {
        seed: world.seed,
        people: world.agentList.length,
        "online now": online,
        servers: world.serverList.length,
        channels,
        "messages sent": world.stats.messages,
        "founded by agents": Math.max(0, world.stats.serversFounded - (world.stats.initialServers || 0)),
        "close friendships": Math.round(bonds / 2)
    };
    dom.stats.innerHTML = Object.entries(rows)
        .map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`)
        .join("");
}

let clockKey = "";

function setApiStatus(message, statusState) {
    dom.apiStatus.textContent = message;
    if (statusState) dom.apiStatus.dataset.state = statusState;
    else delete dom.apiStatus.dataset.state;
}

// `resetInputs` is only true right after a save or clear. This runs on a timer
// as well, and must never blank a field somebody is typing into.
function renderModelPanel({ resetInputs = false } = {}) {
    const hasKey = Boolean(modelSettings.getKey());
    if (resetInputs) {
        // The field never shows the key back — only that one is saved.
        dom.apiKey.value = "";
    }
    if (document.activeElement !== dom.apiModel) {
        dom.apiModel.value = modelSettings.getModel() || DEFAULT_MODEL;
    }
    dom.apiEnabled.checked = modelSettings.isEnabled();
    dom.apiKey.placeholder = hasKey
        ? `saved: ${modelSettings.maskedKey()}`
        : "paste here, stays on this machine";

    const s = brain.stats;
    const rows = {
        status: hasKey ? (modelSettings.isEnabled() ? "active" : "key saved, disabled") : "local generator only",
        "calls made": s.calls,
        succeeded: s.ok,
        failed: s.failed,
        "skipped (rate limit)": s.skipped
    };
    dom.apiStats.innerHTML = Object.entries(rows)
        .map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`)
        .join("");
    if (s.lastError) {
        dom.apiStats.insertAdjacentHTML("beforeend",
            `<dt>last error</dt><dd>${escapeHtml(String(s.lastError).slice(0, 80))}</dd>`);
    }
}

function wireModelPanel() {
    dom.apiSave.addEventListener("click", () => {
        const value = dom.apiKey.value.trim();
        if (!value) {
            setApiStatus("nothing to save — paste a key first", "bad");
            return;
        }
        modelSettings.setKey(value);
        modelSettings.setModel(dom.apiModel.value.trim() || DEFAULT_MODEL);
        // Clear it out of the DOM immediately so it is not sitting in a field.
        applyBrain();
        renderModelPanel({ resetInputs: true });
        setApiStatus("key saved to this browser. try 'test connection'.", "ok");
    });

    dom.apiClear.addEventListener("click", () => {
        modelSettings.clearKey();
        applyBrain();
        renderModelPanel({ resetInputs: true });
        setApiStatus("key forgotten. back to the local generator.", "ok");
    });

    dom.apiTest.addEventListener("click", async () => {
        if (dom.apiKey.value.trim()) {
            modelSettings.setKey(dom.apiKey.value.trim());
            dom.apiKey.value = "";
        }
        modelSettings.setModel(dom.apiModel.value.trim() || DEFAULT_MODEL);
        applyBrain();
        setApiStatus("testing…", "busy");
        const result = await brain.test();
        setApiStatus(result.message, result.ok ? "ok" : "bad");
        renderModelPanel({ resetInputs: true });
    });

    dom.apiEnabled.addEventListener("change", () => {
        modelSettings.setEnabled(dom.apiEnabled.checked);
        applyBrain();
        renderModelPanel();
    });

    dom.apiModel.addEventListener("change", () => {
        modelSettings.setModel(dom.apiModel.value.trim() || DEFAULT_MODEL);
        renderModelPanel();
    });
}

// The simulation only holds a brain when there is actually a usable key.
function applyBrain() {
    if (state.sim) state.sim.brain = brain.available ? brain : null;
}

function renderClock() {
    const clock = state.world.clockLabel();
    const label = `day ${clock.day} · ${clock.text}`;
    if (label === clockKey) return;
    clockKey = label;
    dom.clock.textContent = label;
}

function showProfile(agentId) {
    const { world } = state;
    const agent = world.agents[agentId];
    if (!agent) return;
    const domains = Object.entries(agent.interests)
        .sort((a, b) => b[1] - a[1])
        .map(([id, weight]) => `<span class="chip">${escapeHtml(DOMAIN_BY_ID[id]?.label || id)} ${Math.round(weight * 100)}%</span>`)
        .join("");
    const traits = agent.traits.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("");
    const bars = Object.entries(agent.personality)
        .filter(([key]) => key !== "wpm")
        .map(([key, value]) => `<div class="bar"><span>${escapeHtml(key)}</span>
            <span class="bar__track"><span class="bar__fill" style="width:${Math.round(value * 100)}%"></span></span></div>`)
        .join("");
    const friends = agent.friends(4)
        .map(([id, value]) => {
            const friend = world.agents[id];
            return friend ? `<span class="chip">@${escapeHtml(friend.handle)} ${value > 0.6 ? "★" : "·"} ${value.toFixed(2)}</span>` : "";
        }).join("");
    const servers = agent.servers
        .map((id) => world.servers[id])
        .filter(Boolean)
        .map((s) => `<span class="chip">${s.glyph} ${escapeHtml(s.name)}</span>`)
        .join("");

    dom.profileCard.innerHTML = `
        <div class="profile__banner" style="background: linear-gradient(120deg, hsl(${agent.hue} 55% 34%), hsl(${(agent.hue + 60) % 360} 45% 20%));"></div>
        <div class="profile__inner">
            <div class="profile__avatar" style="${avatarStyle(agent)}">${escapeHtml(agent.glyph)}</div>
            <div class="profile__name">${escapeHtml(agent.displayName)}</div>
            <div class="profile__handle">@${escapeHtml(agent.handle)} · ${escapeHtml(agent.presence)} · ${escapeHtml(agent.timezone)}</div>
            <p class="profile__bio">${escapeHtml(agent.bio)}</p>
            <h4>voice</h4>
            <div class="chips"><span class="chip">${escapeHtml(VOICE_LABEL[agent.voiceId] || agent.voiceId)}</span>
                <span class="chip">${agent.personality.wpm} wpm</span>
                <span class="chip">mood: ${escapeHtml(moodLabel(agent))}</span>
                <span class="chip">peak hour ${String(agent.peakHour).padStart(2, "0")}:00</span></div>
            <h4>traits</h4>
            <div class="chips">${traits}</div>
            <h4>interests</h4>
            <div class="chips">${domains}</div>
            <h4>disposition</h4>
            <div class="bars">${bars}</div>
            ${friends ? `<h4>closest here</h4><div class="chips">${friends}</div>` : ""}
            <h4>member of</h4>
            <div class="chips">${servers}</div>
            <div class="chips"><span class="chip">${agent.messageCount} messages sent</span></div>
            <button class="btn profile__close" id="profileClose">close</button>
        </div>`;
    dom.profile.hidden = false;
}

// ------------------------------------------------------------- interactions

// Below 1180px the panel is a drawer; below 900px the channel sidebar is too.
const panelIsDrawer = () => window.matchMedia("(max-width: 1180px)").matches;
const channelsAreDrawer = () => window.matchMedia("(max-width: 900px)").matches;

function setDrawer(which) {
    if (which) dom.app.dataset.drawer = which;
    else delete dom.app.dataset.drawer;
    dom.scrim.hidden = !which;
}

function toggleDrawer(which) {
    setDrawer(dom.app.dataset.drawer === which ? null : which);
}

function selectServer(serverId, { fromUser = false } = {}) {
    state.serverId = serverId;
    const channels = state.world.channelsOf(serverId);
    const first = channels.find((c) => c.name === "general") || channels[0];
    const wantChannelList = fromUser && channelsAreDrawer();
    selectChannel(first ? first.id : null);
    // selectChannel closes the drawer; deliberately switching servers on a
    // phone is the one moment you do want the channel list. On first load you
    // want the conversation, not a menu over it.
    if (wantChannelList) setDrawer("channels");
    renderRail();
    state.dirty.members = true;
}

function selectChannel(channelId) {
    state.channelId = channelId;
    state.sim.focusChannelId = channelId;
    const channel = state.world.channels[channelId];
    if (channel) channel.unread = 0;
    typingKey = "";
    if (channelsAreDrawer()) setDrawer(null);
    renderChannelFull();
    renderTyping();
    state.dirty.sidebar = true;
}

function wireEvents() {
    dom.rail.addEventListener("click", (event) => {
        const button = event.target.closest("[data-server]");
        if (button) selectServer(button.dataset.server, { fromUser: true });
    });

    dom.channels.addEventListener("click", (event) => {
        const button = event.target.closest("[data-channel]");
        if (button) selectChannel(button.dataset.channel);
    });

    document.body.addEventListener("click", (event) => {
        const agentButton = event.target.closest("[data-agent]");
        if (agentButton && !agentButton.disabled) {
            showProfile(agentButton.dataset.agent);
            return;
        }
        if (event.target.id === "profileClose" || event.target === dom.profile) {
            dom.profile.hidden = true;
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        if (!dom.profile.hidden) dom.profile.hidden = true;
        else setDrawer(null);
    });

    dom.composer.addEventListener("submit", (event) => {
        event.preventDefault();
        const text = dom.composerInput.value.trim();
        if (!text) return;
        state.sim.postUserMessage(state.channelId, text);
        dom.composerInput.value = "";
    });

    dom.speeds.addEventListener("click", (event) => {
        const button = event.target.closest("[data-speed]");
        if (!button) return;
        state.sim.setSpeed(button.dataset.speed);
        [...dom.speeds.children].forEach((child) => child.classList.toggle("is-active", child === button));
    });

    dom.togglePanel.addEventListener("click", () => {
        if (panelIsDrawer()) {
            toggleDrawer("panel");
            return;
        }
        const hidden = dom.app.dataset.panel === "hidden";
        dom.app.dataset.panel = hidden ? "shown" : "hidden";
    });

    dom.toggleChannels.addEventListener("click", () => toggleDrawer("channels"));
    dom.scrim.addEventListener("click", () => setDrawer(null));

    // A drawer left open across a resize would be stranded off-screen.
    window.addEventListener("resize", () => {
        const open = dom.app.dataset.drawer;
        if (open === "channels" && !channelsAreDrawer()) setDrawer(null);
        if (open === "panel" && !panelIsDrawer()) setDrawer(null);
    });

    dom.panel.querySelector(".panel__tabs").addEventListener("click", (event) => {
        const button = event.target.closest("[data-tab]");
        if (!button) return;
        state.tab = button.dataset.tab;
        [...button.parentElement.children].forEach((child) => child.classList.toggle("is-active", child === button));
        for (const name of ["members", "observer", "world", "model"]) {
            el(`tab-${name}`).hidden = name !== state.tab;
        }
        state.dirty.members = true;
        state.dirty.feed = true;
        state.dirty.stats = true;
        if (state.tab === "model") renderModelPanel();
    });

    dom.regenerate.addEventListener("click", () => {
        const seed = dom.seedInput.value.trim() || String(Math.floor(Math.random() * 1e9));
        const user = state.world.agents[state.world.userId];
        startWorld(seed, user ? user.displayName : null);
    });

    dom.wipe.addEventListener("click", () => {
        clearWorld();
        location.reload();
    });
}

// -------------------------------------------------------------------- boot

function attachSimulation() {
    const { sim } = state;
    sim.on("message", ({ message, channel, reactionOnly }) => {
        if (channel.id === state.channelId) {
            if (reactionOnly || state.renderedIds.has(message.id)) refreshMessage(message);
            else appendMessage(message);
        } else {
            channel.unread = (channel.unread || 0) + (reactionOnly ? 0 : 1);
            state.dirty.sidebar = true;
        }
        state.dirty.feed = true;
        state.dirty.stats = true;
    });

    sim.on("typing", () => {
        state.dirty.sidebar = true;
        renderTyping();
    });

    sim.on("event", () => {
        state.dirty.sidebar = true;
        state.dirty.members = true;
        renderRail();
    });
}

function frame(now) {
    const delta = state.lastFrame ? now - state.lastFrame : 16;
    state.lastFrame = now;
    state.sim.step(delta);

    renderClock();
    renderTyping();

    if (state.dirty.sidebar) {
        renderSidebar();
        state.dirty.sidebar = false;
    }
    if (state.tab === "members" && state.dirty.members) {
        renderMembers();
        state.dirty.members = false;
    }
    if (state.tab === "observer" && state.dirty.feed) {
        renderFeed();
        state.dirty.feed = false;
    }
    if (state.tab === "world" && state.dirty.stats) {
        renderStats();
        state.dirty.stats = false;
    }
    if (state.tab === "model" && state.dirty.model) {
        renderModelPanel();
        state.dirty.model = false;
    }

    if (now - state.lastSave > 20000) {
        state.lastSave = now;
        saveWorld(state.world);
    }
    requestAnimationFrame(frame);
}

let loopStarted = false;

function startLoop() {
    if (loopStarted) return;
    loopStarted = true;
    // Members and moods drift constantly; a slow tick keeps the roster honest
    // without re-rendering it every animation frame.
    setInterval(() => {
        state.dirty.members = true;
        state.dirty.sidebar = true;
        state.dirty.model = true;
    }, 2500);
    requestAnimationFrame(frame);
}

function startWorld(seed, handle) {
    const { world } = bootstrapWorld(seed, { agentCount: 48, serverCount: 5 });
    const rng = new Rng(`${seed}:user`);
    if (handle) createUserAgent(world, rng, handle);

    state.world = world;
    state.sim = new Simulation(world, seed);
    attachSimulation();
    applyBrain();
    // Build a backlog so the network looks like it was already running.
    state.sim.prime(320);
    world.note("genesis", "history primed — the network has been running without you");

    state.serverId = world.serverList[0].id;
    renderRail();
    selectServer(state.serverId);
    renderMe();
    renderMembers();
    renderFeed();
    renderStats();
    saveWorld(world);
    dom.boot.hidden = true;
    dom.app.hidden = false;
    startLoop();
}

function resumeWorld(world) {
    state.world = world;
    state.sim = new Simulation(world, world.seed);
    attachSimulation();
    applyBrain();
    state.serverId = world.serverList[0].id;
    renderRail();
    selectServer(state.serverId);
    renderMe();
    renderMembers();
    renderFeed();
    renderStats();
    dom.boot.hidden = true;
    dom.app.hidden = false;
    startLoop();
}

function init() {
    pinViewport();
    wireEvents();
    scrollbar = attachScrollbar(dom.messages, dom.scrollbar, dom.scrollThumb);
    wireModelPanel();
    renderModelPanel();
    // Handy from the console: inspect the live world, agents and pending queue.
    window.nullspace = state;
    const saved = loadWorld();
    if (saved && saved.serverList.length > 0) {
        dom.bootNote.textContent = `a saved network exists (seed "${saved.seed}", ${saved.agentList.length} people). entering resumes it; a new seed replaces it.`;
        dom.bootEnter.textContent = "resume network";
        dom.bootEnter.dataset.resume = "true";
    }

    dom.bootEnter.addEventListener("click", () => {
        const handle = dom.bootHandle.value.trim();
        const seed = dom.bootSeed.value.trim();
        const savedWorld = loadWorld();
        if (dom.bootEnter.dataset.resume === "true" && !seed && savedWorld) {
            if (handle && !savedWorld.userId) {
                createUserAgent(savedWorld, new Rng(`${savedWorld.seed}:user`), handle);
            }
            resumeWorld(savedWorld);
            return;
        }
        startWorld(seed || String(Math.floor(Math.random() * 1e9)), handle || "you");
    });

    dom.bootWatch.addEventListener("click", () => {
        const seed = dom.bootSeed.value.trim() || String(Math.floor(Math.random() * 1e9));
        startWorld(seed, null);
    });

    dom.bootHandle.addEventListener("keydown", (event) => {
        if (event.key === "Enter") dom.bootEnter.click();
    });
}

init();
