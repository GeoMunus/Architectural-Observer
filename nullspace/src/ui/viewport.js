// Pins the app shell to the part of the screen that is actually visible.
//
// Three things move a mobile layout that CSS alone cannot hold still:
//
//  1. `100dvh` is *dynamic* — it grows and shrinks as the browser's address
//     bar hides and reappears, so the whole shell resizes while you scroll.
//  2. Opening the keyboard shrinks the visual viewport. iOS does not resize the
//     layout viewport to match; it scrolls it instead, which slides a
//     position:fixed shell up under the notch and hides the composer.
//  3. Rubber-band overscroll at the ends of the message list drags the page
//     itself around behind the app.
//
// visualViewport reports the truth for the first two, so the shell is sized and
// offset from it rather than from any viewport unit.

export function pinViewport() {
    const root = document.documentElement;
    const vv = window.visualViewport;

    function sync() {
        const height = vv ? vv.height : window.innerHeight;
        // offsetTop is how far the visible area has been scrolled down inside
        // the layout viewport — exactly what iOS does when the keyboard opens.
        const offsetTop = vv ? vv.offsetTop : 0;
        root.style.setProperty("--app-h", `${Math.round(height)}px`);
        root.style.setProperty("--app-top", `${Math.round(offsetTop)}px`);
    }

    if (vv) {
        vv.addEventListener("resize", sync);
        vv.addEventListener("scroll", sync);
    }
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", () => setTimeout(sync, 250));

    // Some browsers settle the viewport a beat after focus; re-check then.
    document.addEventListener("focusin", () => setTimeout(sync, 300));
    document.addEventListener("focusout", () => setTimeout(sync, 300));

    // Belt and braces: if anything ever does scroll the document, undo it.
    window.addEventListener("scroll", () => {
        if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
    }, { passive: true });

    sync();
    return sync;
}

// innerHTML re-renders reset a pane's scroll position, so a list that is
// rebuilt on a timer silently jumps back to the top while you are reading it.
export function preservingScroll(element, render) {
    const top = element.scrollTop;
    const left = element.scrollLeft;
    render();
    element.scrollTop = top;
    element.scrollLeft = left;
}
