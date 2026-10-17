import { BUILDINGS, GRID } from '../sim/config.js';
import { World } from '../sim/World.js';
import { Renderer } from '../render/Renderer.js';
import { HUD } from '../ui/HUD.js';
import { SettingsMenu } from '../ui/SettingsMenu.js';
import { MainMenu } from '../ui/MainMenu.js';
import { LoadingScreen, painted } from '../ui/LoadingScreen.js';
import { AUTO_RESOLUTION, startupSettings, stepDown } from '../render/graphicsSettings.js';
import { DynamicResolution } from '../render/dynamicResolution.js';
import { BuildController } from './BuildController.js';

const SPEEDS = [1, 2, 3];
const PAN_SPEED = 22; // scene units per second
const BEST_KEY = 'hold-the-hall:best-wave';

/** Wires the simulation, renderer, input and HUD together and runs the main loop. */
export class Game {
  /**
   * `atlas` is the battlefield sprite atlas (see render/spriteAssets.js). `world`: the first map, if it's already
   * been made (createWorld); `loading`: the loading screen; `menu`: whether to open the main menu at the start.
   */
  constructor(container, atlas, { world = null, loading = new LoadingScreen(), menu = false } = {}) {
    this.graphics = startupSettings(); // always Low on a fresh start (see graphicsSettings.js)
    // Settings fixed when the WebGL context was created (anti-aliasing); used to flag "reload to apply".
    this.startupGraphics = { ...this.graphics };
    this.renderer = new Renderer(container, this.graphics, atlas);
    this._syncDynamicResolution();
    this.contextLost = false;
    // If the GPU resets, the canvas goes blank. Pause the game and tell the player instead of
    // silently showing a white screen; three.js re-creates its GPU resources on restore.
    // Also drop one graphics preset so it's less likely to happen again.
    this.renderer.canvas.addEventListener('webglcontextlost', () => {
      this.contextLost = true;
      const lower = stepDown(this.graphics);
      if (lower) this.setGraphics(lower);
      const switched = lower ? ` Graphics have been lowered to ${lower.preset[0].toUpperCase()}${lower.preset.slice(1)} to make this less likely (change it in ⚙ Settings).` : '';
      this.hud.showError(
        'Graphics were reset by your browser',
        `The game is paused and will carry on when graphics come back.${switched} If it stays stuck, close this tab completely and open the game again (reloading may not be enough).`,
      );
    });
    this.renderer.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.hud.hideError();
    });
    this.build = new BuildController(this);
    this.hud = new HUD(this);
    this.settingsMenu = new SettingsMenu(this);
    this.hud.setFpsVisible(this.graphics.showFps);
    this.speed = 1;
    this.paused = false;
    this.keys = new Set();
    this.mapOptions = readMapOptions();
    this.held = false; // while the main menu or the loading screen is up: the battle waits
    this.loading = loading;

    window.addEventListener('keydown', (e) => this._onKeyDown(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());

    this.newGame({ world });
    this.loading.icons = this.hud.icons;
    this.menu = new MainMenu(this);
    if (menu) this.menu.open();
    this._last = performance.now();
    this._fpsFrames = 0;
    this._fpsSince = this._last;
    this.fps = 0;
    requestAnimationFrame((t) => this._frame(t));
  }

  /** Start a game on `world` (default: a new one, see createWorld: `seed` or the URL's, else a random map). */
  newGame({ seed, world } = {}) {
    this.world = world ?? createWorld(this.mapOptions, { seed });
    const fort = this.world.buildings.size > 1;
    this.renderer.attach(this.world);
    this.hud.attach(this.world);
    this.build.reset();
    this.paused = false;
    this.hud.setPaused(false);
    const tip = fort ? 'Close the gaps in the fort wall before the first wave.' : "Use the woods, rocks and water: enemies can't pass them.";
    this.hud.toast(`Protect the Town Hall! ${tip} (Map ${this.world.seed})`, 'info');
  }

  /**
   * A new game on a new random map, behind the loading screen (with a sketch of the map while the battlefield is
   * painted). Resolves once the new map is in place.
   */
  async newMap() {
    const world = createWorld(this.mapOptions, { seed: Math.floor(Math.random() * 1e6) });
    this.setHeld(true);
    this.loading.show(world, 0.2);
    this.loading.setProgress(0.7, { trickle: true });
    await painted();
    this.newGame({ world });
    await this.loading.finish();
    this.setHeld(this.menu.isOpen);
  }

  /** Hold the battle (main menu, loading screen) or let it go on. */
  setHeld(held) {
    this.held = held;
  }

  cycleSpeed() {
    this.speed = SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length];
    this.hud.setSpeed(this.speed);
  }

  /** Apply new graphics settings for this session (they aren't remembered; see graphicsSettings.js). */
  setGraphics(settings) {
    this.graphics = settings;
    this.renderer.applySettings(settings);
    this._syncDynamicResolution();
    this.hud.setFpsVisible(settings.showFps);
  }

  // 'auto' resolution: a controller that nudges the render scale to hold the target frame rate.
  _syncDynamicResolution() {
    if (this.graphics.resolution !== 'auto') {
      this.dynamicResolution = null;
    } else if (!this.dynamicResolution) {
      this.dynamicResolution = new DynamicResolution({
        min: AUTO_RESOLUTION.min,
        max: Math.min(AUTO_RESOLUTION.max, window.devicePixelRatio || 1),
        start: this.renderer.renderScale,
      });
    }
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
    if (this.menu.isOpen || this.loading.isOpen) return;
    if (this.settingsMenu.isOpen && key !== 'escape') return;
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
        this.settingsMenu.close();
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
        if (this.world.phase === 'gameover') this.newMap();
        break;
      default:
        break;
    }
  }

  _frame(now) {
    // Frame-rate cap: skip this animation frame if it's too soon (less GPU work and heat on phones).
    const cap = this.graphics.fpsCap;
    if (cap > 0 && now - this._last < 1000 / cap - 2) {
      requestAnimationFrame((t) => this._frame(t));
      return;
    }
    const interval = now - this._last;
    const dt = Math.min(0.1, interval / 1000);
    this._last = now;

    this._fpsFrames++;
    if (now - this._fpsSince >= 500) {
      this.fps = Math.round((this._fpsFrames * 1000) / (now - this._fpsSince));
      this._fpsFrames = 0;
      this._fpsSince = now;
    }

    if (this.contextLost) {
      requestAnimationFrame((t) => this._frame(t));
      return;
    }

    if (this.dynamicResolution) {
      const scale = this.dynamicResolution.sample(interval, 1000 / (cap > 0 ? cap : 60));
      if (scale !== null) this.renderer.setRenderScale(scale);
    }

    if (this.held) {
      // Behind the main menu, the camera drifts slowly to and fro over the battlefield.
      if (this.menu?.isOpen) this.renderer.pan(0, Math.cos(now / 9000) * 0.5 * dt);
    } else if (!this.paused) {
      // Run extra fixed-size steps rather than one big one so fast-forward stays stable.
      for (let i = 0; i < this.speed; i++) this.world.update(dt);
    }

    const k = this.keys;
    const forward = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    const right = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    if (forward || right) this.renderer.pan(forward * PAN_SPEED * dt, right * PAN_SPEED * dt);

    this.build.update(dt);
    this.renderer.update(dt);
    this.hud.update();
    this.renderer.render();
    requestAnimationFrame((t) => this._frame(t));
  }
}

/**
 * Options for new maps (Settings → Map size, Rivers, Coast, Hills), from the URL: `size` is a key of GRID.sizes
 * (`?size=` takes a size name or its tiles across); `river` makes every new map have a stream; `sea` and `hills` are
 * false (never), 'sometimes' (the default) or true (always a coast / plateaus). They last for the session.
 */
export function readMapOptions() {
  const params = new URLSearchParams(location.search);
  const sea = { 0: false, 1: true }[params.get('sea')] ?? 'sometimes';
  const hills = { 0: false, 1: true }[params.get('hills')] ?? 'sometimes';
  const asked = params.get('size');
  const size = Object.keys(GRID.sizes).find((k) => k === asked || String(GRID.sizes[k]) === asked) ?? GRID.defaultSize;
  return { size, river: params.get('river') === '1', sea, hills };
}

/**
 * A new map (with `mapOptions`, see readMapOptions). `seed` picks the map (and its waves); without it, the URL's
 * `?seed=N` is used if given (to replay a map), else a random one. `?map=open` starts without terrain (the browser
 * tests use it to place buildings anywhere), and `?fort=0` without the starting fort.
 */
export function createWorld(mapOptions, { seed } = {}) {
  const params = new URLSearchParams(location.search);
  seed ??= params.has('seed') ? Number(params.get('seed')) : Math.floor(Math.random() * 1e6);
  const fort = params.get('fort') !== '0';
  const { river, sea, hills, size } = mapOptions;
  return new World({ seed, terrain: params.get('map') === 'open' ? 'open' : 'generate', fort, river, sea, hills, size: GRID.sizes[size] });
}
