/**
 * crypto.randomUUID only exists in Chrome 92+, but minSdk 23 allows far older System
 * WebViews on devices that never updated it. Every Thing, Event, and Memory needs an
 * id, so a missing API here would break the app on launch rather than degrade it.
 */
export function uuid() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    // Ids are only ever used to tell local records apart, never as a security token.
    return `id-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}
