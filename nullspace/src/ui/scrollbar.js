// A real scrollbar for a scrolling element.
//
// Mobile browsers draw overlay scrollbars that fade out and cannot be grabbed,
// so in a channel holding hundreds of messages there is nothing to tell you
// where you are or to drag you back through it. This renders a thumb we own:
// always visible, proportional, and draggable on both touch and mouse.

const MIN_THUMB = 30;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function attachScrollbar(viewport, bar, thumb) {
    let dragging = false;
    let grabOffset = 0;
    let frame = 0;

    function measure() {
        const overflow = viewport.scrollHeight - viewport.clientHeight;
        // Nothing to scroll: hide rather than show a full-height thumb that
        // looks interactive but cannot move.
        if (overflow <= 4) {
            bar.hidden = true;
            return null;
        }
        bar.hidden = false;
        const track = bar.clientHeight;
        const height = Math.max(MIN_THUMB, Math.round((track * viewport.clientHeight) / viewport.scrollHeight));
        return { overflow, track, height, travel: Math.max(0, track - height) };
    }

    function update() {
        const m = measure();
        if (!m) return;
        const progress = m.overflow > 0 ? viewport.scrollTop / m.overflow : 0;
        thumb.style.height = `${m.height}px`;
        thumb.style.transform = `translateY(${Math.round(m.travel * clamp(progress, 0, 1))}px)`;
    }

    // Scroll and DOM changes both fire in bursts while the room is busy, so
    // coalesce them into one measurement per frame.
    function schedule() {
        if (frame) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            update();
        });
    }

    // Maps a pointer position on the track to a scroll offset.
    function scrollToPointer(clientY, offsetWithinThumb) {
        const m = measure();
        if (!m || m.travel <= 0) return;
        const top = bar.getBoundingClientRect().top;
        const y = clamp(clientY - top - offsetWithinThumb, 0, m.travel);
        viewport.scrollTop = (y / m.travel) * m.overflow;
    }

    thumb.addEventListener("pointerdown", (event) => {
        dragging = true;
        grabOffset = event.clientY - thumb.getBoundingClientRect().top;
        bar.classList.add("is-dragging");
        // Smooth scrolling would animate behind the finger and lag it.
        viewport.classList.add("is-scrubbing");
        thumb.setPointerCapture(event.pointerId);
        event.preventDefault();
        event.stopPropagation();
    });

    thumb.addEventListener("pointermove", (event) => {
        if (!dragging) return;
        scrollToPointer(event.clientY, grabOffset);
        event.preventDefault();
    });

    function endDrag(event) {
        if (!dragging) return;
        dragging = false;
        bar.classList.remove("is-dragging");
        viewport.classList.remove("is-scrubbing");
        if (event.pointerId !== undefined && thumb.hasPointerCapture?.(event.pointerId)) {
            thumb.releasePointerCapture(event.pointerId);
        }
    }

    thumb.addEventListener("pointerup", endDrag);
    thumb.addEventListener("pointercancel", endDrag);

    // Tapping the track jumps to that point, which is the useful behaviour on
    // a phone where the track is the only scrubbing surface.
    bar.addEventListener("pointerdown", (event) => {
        if (event.target === thumb) return;
        const m = measure();
        if (!m) return;
        viewport.classList.add("is-scrubbing");
        scrollToPointer(event.clientY, m.height / 2);
        viewport.classList.remove("is-scrubbing");
    });

    viewport.addEventListener("scroll", schedule, { passive: true });

    // Height changes from resizing, and content changes from new messages,
    // reactions and channel switches.
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(viewport);
    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(viewport, { childList: true, subtree: true, characterData: true });

    update();

    return {
        update: schedule,
        isDragging: () => dragging,
        destroy() {
            resizeObserver.disconnect();
            mutationObserver.disconnect();
            viewport.removeEventListener("scroll", schedule);
        }
    };
}
