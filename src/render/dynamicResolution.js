// Automatic render-scale controller (no three.js, unit-tested in test/dynamicResolution.test.js).
//
// Every `windowMs` it compares the average time between rendered frames with the target frame time
// (from the FPS cap). Too slow → step the resolution down at once. Comfortably on target for a few
// windows in a row → try one step up. If a step up makes it slow, that level becomes a ceiling so it
// doesn't keep oscillating.

export class DynamicResolution {
  constructor({ min = 0.5, max = 1.5, start = 1, step = 0.1, windowMs = 1000, upAfter = 3 } = {}) {
    this.min = min;
    this.max = max;
    this.step = step;
    this.windowMs = windowMs;
    this.upAfter = upAfter;
    this.scale = clamp(start, min, max);
    this.ceiling = max;
    this._sum = 0;
    this._frames = 0;
    this._goodWindows = 0;
    this._justStepped = false;
  }

  /**
   * Record one rendered frame. `intervalMs` is the time since the previous rendered frame;
   * `targetMs` the frame time we're aiming for. Returns the new scale when it changes, else null.
   */
  sample(intervalMs, targetMs) {
    if (!(intervalMs > 0) || intervalMs > 250) return null; // tab switch, breakpoint or first frame
    this._sum += intervalMs;
    this._frames++;
    if (this._sum < this.windowMs) return null;

    const avg = this._sum / this._frames;
    this._sum = 0;
    this._frames = 0;
    const steppedUp = this._justStepped;
    this._justStepped = false;

    if (avg > targetMs * 1.2) {
      this._goodWindows = 0;
      // The last step up was too much: don't go that high again.
      if (steppedUp) this.ceiling = round(this.scale - this.step);
      return this._set(this.scale - this.step);
    }
    if (avg <= targetMs * 1.08) {
      this._goodWindows++;
      if (this._goodWindows >= this.upAfter && this.scale + this.step <= this.ceiling + 1e-9) {
        this._goodWindows = 0;
        this._justStepped = true;
        return this._set(this.scale + this.step);
      }
      return null;
    }
    this._goodWindows = 0;
    return null;
  }

  _set(value) {
    const next = round(clamp(value, this.min, Math.min(this.max, this.ceiling)));
    if (next === this.scale) return null;
    this.scale = next;
    return next;
  }
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round = (v) => Math.round(v * 100) / 100;
