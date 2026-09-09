// Application state: the open timeline, the saved library, and undo history.

const LIBRARY_KEY = "timeline.creator.library.v1";
const SETTINGS_KEY = "timeline.creator.settings.v1";
const MAX_HISTORY = 50;

function readJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
        console.warn("could not read", key, err);
        return fallback;
    }
}

function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (err) {
        console.warn("could not write", key, err);
        return false;
    }
}

export function loadSettings() {
    return {
        aiMode: "engine",
        apiKey: "",
        model: "claude-sonnet-5",
        ...readJson(SETTINGS_KEY, {})
    };
}

export function saveSettings(settings) {
    writeJson(SETTINGS_KEY, settings);
}

export function createStore() {
    const listeners = new Set();
    const state = {
        timeline: null,
        library: readJson(LIBRARY_KEY, []),
        settings: loadSettings(),
        selectedEventId: null,
        filter: { text: "", tag: "", entityId: "", minImportance: 1 },
        busy: null
    };

    let past = [];
    let future = [];

    function snapshot() {
        return state.timeline ? JSON.stringify(state.timeline) : null;
    }

    function notify() {
        listeners.forEach((fn) => fn(state));
    }

    const store = {
        state,
        subscribe(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        notify,

        /** Wraps a mutation so it becomes a single undoable step. */
        commit(label, mutate) {
            const before = snapshot();
            const result = mutate(state.timeline);
            if (before !== null) {
                past.push({ label, json: before });
                if (past.length > MAX_HISTORY) past.shift();
            }
            future = [];
            if (state.timeline) state.timeline.updatedAt = Date.now();
            store.persist();
            notify();
            return result;
        },

        /** Replaces the open timeline wholesale (new generation, import, branch). */
        open(timeline, { undoable = true } = {}) {
            const before = snapshot();
            if (undoable && before !== null) {
                past.push({ label: "open timeline", json: before });
            }
            future = [];
            state.timeline = timeline;
            state.selectedEventId = null;
            store.persist();
            notify();
        },

        canUndo: () => past.length > 0,
        canRedo: () => future.length > 0,
        undoLabel: () => (past.length ? past[past.length - 1].label : ""),

        undo() {
            if (!past.length) return;
            const entry = past.pop();
            future.push({ label: entry.label, json: snapshot() });
            state.timeline = JSON.parse(entry.json);
            store.persist();
            notify();
        },

        redo() {
            if (!future.length) return;
            const entry = future.pop();
            past.push({ label: entry.label, json: snapshot() });
            state.timeline = JSON.parse(entry.json);
            store.persist();
            notify();
        },

        setBusy(message) {
            state.busy = message;
            notify();
        },

        select(eventId) {
            state.selectedEventId = eventId;
            notify();
        },

        setFilter(patch) {
            Object.assign(state.filter, patch);
            notify();
        },

        updateSettings(patch) {
            Object.assign(state.settings, patch);
            saveSettings(state.settings);
            notify();
        },

        /** Saves the open timeline into the library, replacing any earlier copy. */
        persist() {
            if (!state.timeline) return;
            const entry = {
                id: state.timeline.id,
                title: state.timeline.title,
                genreId: state.timeline.genreId,
                updatedAt: state.timeline.updatedAt || Date.now(),
                eventCount: state.timeline.events.length,
                data: state.timeline
            };
            const index = state.library.findIndex((t) => t.id === entry.id);
            if (index === -1) state.library.unshift(entry);
            else state.library[index] = entry;
            state.library = state.library.slice(0, 40);
            writeJson(LIBRARY_KEY, state.library);
        },

        loadFromLibrary(id) {
            const entry = state.library.find((t) => t.id === id);
            if (!entry) return false;
            store.open(JSON.parse(JSON.stringify(entry.data)));
            return true;
        },

        removeFromLibrary(id) {
            state.library = state.library.filter((t) => t.id !== id);
            writeJson(LIBRARY_KEY, state.library);
            notify();
        }
    };

    return store;
}
