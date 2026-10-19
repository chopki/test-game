/**
 * When the last touch or pen press was handled (shared by every button). The browser's synthesized click comes a
 * moment after the release, at the same spot; if the press re-rendered a card, that click lands on whatever button
 * now sits there (a fresh Hire or Upgrade button), so it's ignored wherever it lands.
 */
let touchPressAt = -Infinity;

/**
 * Call `fn` when `el` is pressed. Touch and pen presses fire on release (pointerup) instead of
 * waiting for the browser's synthesized click, which Chrome sometimes drops when a tap comes
 * straight after a drag on the canvas. Mouse and keyboard still use the normal click event.
 */
export function onPress(el, fn) {
  el.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') return;
    // Touch pointers stay captured by the element they started on, so check the finger
    // was actually released over it.
    const r = el.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    touchPressAt = performance.now();
    fn(e);
  });
  el.addEventListener('click', (e) => {
    if (performance.now() - touchPressAt < 800) return; // the touch release already handled it
    fn(e);
  });
}
