import { BUILDINGS } from '../sim/config.js';
import { World } from '../sim/World.js';
import { Renderer } from '../render/Renderer.js';
import { HUD } from '../ui/HUD.js';
import { BuildController } from './BuildController.js';

const SPEEDS = [1, 2, 3];
const PAN_SPEED = 22; // scene units per second
const BEST_KEY = 'hold-the-hall:best-wave';

/** Wires the simulation, renderer, input and HUD together and runs the main loop. */
export class Game {
  constructor(container) {
    this.renderer = new Renderer(container);
    this.contextLost = false;
    // If the GPU resets, the canvas goes blank. Pause the game and tell the player instead of
    // silently showing a white screen; three.js re-creates its GPU resources on restore.
    this.renderer.canvas.addEventListener('webglcontextlost', () => {
      this.contextLost = true;
      this.hud.showError(
        'Graphics were reset by your browser',
        'The game is paused and will resume automatically when graphics are restored. If it stays like this, reload the page.',
      );
    });
    this.renderer.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.hud.hideError();
    });
    this.build = new BuildController(this);
    this.hud = new HUD(this);
    this.speed = 1;
    this.paused = false;
    this.keys = new Set();

    window.addEventListener('keydown', (e) => this._onKeyDown(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());

    this.newGame();
    this._last = performance.now();
    requestAnimationFrame((t) => this._frame(t));
  }

  newGame() {
    this.world = new World();
    this.renderer.attach(this.world);
    this.hud.attach(this.world);
    this.build.reset();
    this.paused = false;
    this.hud.setPaused(false);
    this.hud.toast('Protect the Town Hall! Build walls and towers, then start the wave.', 'info');
  }

  cycleSpeed() {
    this.speed = SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length];
    this.hud.setSpeed(this.speed);
  }

  togglePause() {
    this.paused = !this.paused;
    this.hud.setPaused(this.paused);
  }

  recordBest(waves) {
    let best = waves;
    try {
      best = Math.max(waves, Number(localStorage.getItem(BEST_KEY)) || 0);
      localStorage.setItem(BEST_KEY, String(best));
    } catch {
      // Storage unavailable (private mode etc.) — best score just isn't remembered.
    }
    return best;
  }

  _onKeyDown(e) {
    if (e.target instanceof HTMLInputElement) return;
    const key = e.key.toLowerCase();
    this.keys.add(key);

    const hotkeyType = Object.keys(BUILDINGS).find((t) => BUILDINGS[t].hotkey === key);
    if (hotkeyType) {
      this.build.setMode(this.build.mode === hotkeyType ? null : hotkeyType);
      return;
    }
    switch (key) {
      case ' ':
        e.preventDefault();
        this.world.startWave();
        break;
      case 'x':
        this.build.setMode(this.build.mode === 'sell' ? null : 'sell');
        break;
      case 'escape':
        this.build.setMode(null);
        this.build.select(null);
        this.hud.toggleHelp(false);
        break;
      case 'p':
        this.togglePause();
        break;
      case 'f':
        this.cycleSpeed();
        break;
      case 'h':
      case '?':
        this.hud.toggleHelp();
        break;
      case 'r':
        if (this.world.phase === 'gameover') this.newGame();
        break;
      default:
        break;
    }
  }

  _frame(now) {
    const dt = Math.min(0.1, (now - this._last) / 1000);
    this._last = now;

    if (this.contextLost) {
      requestAnimationFrame((t) => this._frame(t));
      return;
    }

    if (!this.paused) {
      // Run extra fixed-size steps rather than one big one so fast-forward stays stable.
      for (let i = 0; i < this.speed; i++) this.world.update(dt);
    }

    const k = this.keys;
    const forward = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    const right = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    if (forward || right) this.renderer.pan(forward * PAN_SPEED * dt, right * PAN_SPEED * dt);

    this.build.update();
    this.renderer.update(dt);
    this.hud.update();
    this.renderer.render();
    requestAnimationFrame((t) => this._frame(t));
  }
}
