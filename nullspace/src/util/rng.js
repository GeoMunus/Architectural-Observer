// Deterministic pseudo-random source. Same seed => same world, which makes
// simulation bugs reproducible and lets people share a world by sharing a seed.

export function hashSeed(input) {
    const text = String(input);
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

export class Rng {
    constructor(seed) {
        this.seedValue = typeof seed === "number" ? seed >>> 0 : hashSeed(seed);
        this.state = this.seedValue || 1;
    }

    // mulberry32
    next() {
        this.state = (this.state + 0x6d2b79f5) >>> 0;
        let t = this.state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    float(min, max) {
        return min + this.next() * (max - min);
    }

    int(min, max) {
        return Math.floor(this.float(min, max + 1));
    }

    chance(probability) {
        return this.next() < probability;
    }

    pick(list) {
        return list[Math.floor(this.next() * list.length)];
    }

    // Draws `count` distinct entries, or the whole list if it is too short.
    sample(list, count) {
        const pool = list.slice();
        const out = [];
        const take = Math.min(count, pool.length);
        for (let i = 0; i < take; i += 1) {
            out.push(pool.splice(Math.floor(this.next() * pool.length), 1)[0]);
        }
        return out;
    }

    shuffle(list) {
        const out = list.slice();
        for (let i = out.length - 1; i > 0; i -= 1) {
            const j = Math.floor(this.next() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    }

    // entries: [{ weight, ...}] — returns the entry, not the index.
    weighted(entries) {
        let total = 0;
        for (const entry of entries) total += Math.max(0, entry.weight || 0);
        if (total <= 0) return entries[entries.length - 1];
        let roll = this.next() * total;
        for (const entry of entries) {
            roll -= Math.max(0, entry.weight || 0);
            if (roll <= 0) return entry;
        }
        return entries[entries.length - 1];
    }

    // Roughly normal via the sum of three uniforms, clamped to [min, max].
    gauss(mean, spread, min = -Infinity, max = Infinity) {
        const raw = (this.next() + this.next() + this.next()) / 3;
        const value = mean + (raw - 0.5) * 2 * spread;
        return Math.min(max, Math.max(min, value));
    }

    id(prefix) {
        return `${prefix}_${Math.floor(this.next() * 0xffffff).toString(36)}${Math.floor(this.next() * 0xffffff).toString(36)}`;
    }
}

export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
