// Deterministic pseudo-random utilities. Every generated timeline carries the
// seed that produced it, so re-running a generation reproduces it exactly.

export function hashString(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

export function makeRng(seed) {
    let state = typeof seed === "number" ? seed >>> 0 : hashString(String(seed));
    if (state === 0) state = 0x9e3779b9;

    const next = () => {
        // mulberry32
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    next.int = (min, max) => min + Math.floor(next() * (max - min + 1));
    next.chance = (p) => next() < p;
    next.pick = (list) => list[Math.floor(next() * list.length)];

    next.pickWeighted = (list, weightOf) => {
        let total = 0;
        for (const item of list) total += Math.max(0, weightOf(item));
        if (total <= 0) return next.pick(list);
        let roll = next() * total;
        for (const item of list) {
            roll -= Math.max(0, weightOf(item));
            if (roll <= 0) return item;
        }
        return list[list.length - 1];
    };

    next.shuffle = (list) => {
        const out = list.slice();
        for (let i = out.length - 1; i > 0; i -= 1) {
            const j = Math.floor(next() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    };

    next.sample = (list, count) => next.shuffle(list).slice(0, count);

    // Bell-ish distribution, useful for gaps between events.
    next.spread = (min, max) => {
        const t = (next() + next() + next()) / 3;
        return Math.round(min + t * (max - min));
    };

    return next;
}

export function randomSeedWord() {
    const parts = ["ash", "vault", "ember", "helix", "tide", "quill", "gloam", "spire", "wren", "lattice", "cinder", "verge"];
    const n = Math.floor(Math.random() * 9000) + 1000;
    return `${parts[Math.floor(Math.random() * parts.length)]}-${n}`;
}

export function uid(prefix = "id") {
    return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}
