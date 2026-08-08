export function compactText(value, max = 120) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function describeEventData(data, limit = 3) {
    return Object.entries(data || {})
        .slice(0, limit)
        .map(([key, value]) => `${key}: ${value}`)
        .join(" · ");
}
