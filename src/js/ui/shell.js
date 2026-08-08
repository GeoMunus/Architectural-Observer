/**
 * Tab navigation, the segmented stream picker, and the toast — the chrome that makes
 * the dashboard behave like an app rather than a scrolling page.
 */
export class Shell {
    constructor({ onTabChange } = {}) {
        this.onTabChange = onTabChange || (() => {});
        this.tabs = [...document.querySelectorAll("[data-tab]")];
        this.views = [...document.querySelectorAll("[data-view]")];
        this.segments = [...document.querySelectorAll("[data-stream]")];
        this.streamPanels = [...document.querySelectorAll("[data-stream-panel]")];
        this.viewport = document.querySelector(".viewport");
        this.toastNode = document.getElementById("toast");
        this.toastTimer = null;
        this.activeTab = "observe";
        this.scrollMemory = new Map();

        for (const tab of this.tabs) {
            tab.addEventListener("click", () => this.showTab(tab.dataset.tab));
        }

        for (const segment of this.segments) {
            segment.addEventListener("click", () => this.showStream(segment.dataset.stream));
        }
    }

    showTab(name) {
        if (!name || name === this.activeTab) return;

        this.scrollMemory.set(this.activeTab, this.viewport?.scrollTop || 0);
        this.activeTab = name;

        for (const tab of this.tabs) {
            const isActive = tab.dataset.tab === name;
            tab.classList.toggle("is-active", isActive);
            tab.setAttribute("aria-selected", String(isActive));
        }

        for (const view of this.views) {
            view.hidden = view.dataset.view !== name;
        }

        if (this.viewport) {
            this.viewport.scrollTop = this.scrollMemory.get(name) || 0;
        }

        this.onTabChange(name);
    }

    showStream(name) {
        if (!name) return;

        for (const segment of this.segments) {
            const isActive = segment.dataset.stream === name;
            segment.classList.toggle("is-active", isActive);
            segment.setAttribute("aria-selected", String(isActive));
        }

        for (const panel of this.streamPanels) {
            panel.hidden = panel.dataset.streamPanel !== name;
        }
    }

    toast(message, duration = 2600) {
        if (!this.toastNode || !message) return;

        window.clearTimeout(this.toastTimer);
        this.toastNode.textContent = message;
        this.toastNode.hidden = false;

        // A frame between unhide and class flip lets the transition actually run.
        requestAnimationFrame(() => this.toastNode.classList.add("is-visible"));

        this.toastTimer = window.setTimeout(() => {
            this.toastNode.classList.remove("is-visible");
            window.setTimeout(() => {
                this.toastNode.hidden = true;
            }, 220);
        }, duration);
    }
}
