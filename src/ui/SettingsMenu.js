import { GRID } from '../sim/config.js';
import { carrySettingsThroughReload, OPTIONS, PRESET_ORDER, RELOAD_REQUIRED, withPreset, withSetting } from '../render/graphicsSettings.js';
import { onPress } from './press.js';

const $ = (id) => document.getElementById(id);

const ROWS = [
  ['resolution', 'Render scale', 'Pixels drawn per screen pixel. Auto adjusts it to hold the frame rate; Native draws every pixel of the screen (sharpest, heaviest). Lower is blurrier but much lighter on the GPU.'],
  ['fpsCap', 'Frame rate cap', 'Fewer frames per second means less heat and battery use, and fewer crashes.'],
  ['antialias', 'Anti-aliasing', 'Smooths jagged edges. Costly on phones. Takes effect after a reload.'],
  ['scenery', 'Scenery', 'Trees and rocks around the map.'],
  ['effects', 'Effects', 'Smoke, dust and debris in battle, scorch marks, drifting cloud shadows and trees swaying in the wind.'],
  ['glow', 'Glow and colour', 'A warm colour grade over the battlefield and a soft glow round crystals, torches and fires.'],
  ['weather', 'Weather', 'Seasons (autumn leaves, winter snow) and rain or snowfall that can change between waves. Looks only: it never changes the battle.'],
  ['arrows', 'Arrows', 'How arrows in flight look: a dark ink streak with a short fading trail, a volley of three streaks per shot, or the original small 3D arrow.'],
  ['healthBars', 'Health bars', 'On hit shows a slim bar for a moment after something is hit; While hurt keeps it until it dies; Off hides them (buildings still show their damage, and the Town Hall has its ring).'],
  ['zoomOut', 'Zoom out', 'How far out the camera can pull back (pinch or mouse wheel). Further shows more of the battle at once.'],
  ['lod', 'Detail when far', 'Zoomed far out, soldiers get a ring in their side\'s colour so you can tell them apart, and wildlife, cloud shadows and soldiers\' health bars are left out. Always full keeps everything.'],
  ['sprites', 'Sprite detail', 'How sharp buildings, walls and trees look close up. HD is twice the detail but needs much more graphics memory: on a phone it may slow down or crash. Auto: HD on computers, Standard on phones and tablets. Takes effect after a reload.'],
  ['buildGrid', 'Build grid', 'Lines between the tiles while you place a building (the footprint and ghost show either way).'],
  ['showFps', 'Show FPS', 'Frames per second and current render scale, in the top bar.'],
];

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);

/** Graphics settings dialog: presets plus per-setting overrides. Pauses the game while open. */
export class SettingsMenu {
  constructor(game) {
    this.game = game;
    this.el = $('settings');
    this.body = $('settings-body');
    this._wasPaused = false;
    this._openedAt = 0;

    // Map: start again on a newly generated map (asks for a second tap if a game is under way).
    this.mapButton = this._button('New map', () => this._newMap());
    this.mapRow = this._row('Map', '', [this.mapButton]);
    this.body.appendChild(this.mapRow);
    this._confirmUntil = 0;
    // Map size: how big new maps are (applies from the next new map).
    this.sizeButtons = Object.keys(GRID.sizes).map((size) =>
      this._button(capitalize(size), () => {
        this.game.mapOptions.size = size;
        this.refresh();
      }),
    );
    this.body.appendChild(
      this._row('Map size', `For new maps: Small is ${GRID.sizes.small} tiles across, Medium ${GRID.sizes.medium}, Large ${GRID.sizes.large}. Bigger maps have more room to build and longer marches for the enemy. Takes effect from the next new map.`, this.sizeButtons),
    );
    // Rivers: whether new maps always get a stream (applies from the next new map).
    this.riverButtons = [
      [false, 'Sometimes'],
      [true, 'Always'],
    ].map(([river, text]) =>
      this._button(text, () => {
        this.game.mapOptions.river = river;
        this.refresh();
      }),
    );
    this.body.appendChild(this._row('Rivers', 'For new maps: Always gives every map a stream to defend across (crossed at fords). Takes effect from the next new map.', this.riverButtons));
    // Coast: whether new maps have the sea along one edge (no attacks come from it).
    this.seaChoices = [false, 'sometimes', true];
    this.seaButtons = ['Never', 'Sometimes', 'Always'].map((text, i) =>
      this._button(text, () => {
        this.game.mapOptions.sea = this.seaChoices[i];
        this.refresh();
      }),
    );
    this.body.appendChild(this._row('Coast', 'For new maps: the sea along one edge, behind a sandy beach. No enemies come from the sea, so there is one side less to defend. Takes effect from the next new map.', this.seaButtons));
    // Hills: raised plateaus with cliff edges, climbed by ramps.
    this.hillsButtons = ['Never', 'Sometimes', 'Always'].map((text, i) =>
      this._button(text, () => {
        this.game.mapOptions.hills = this.seaChoices[i];
        this.refresh();
      }),
    );
    this.body.appendChild(this._row('Hills', 'For new maps: raised ground behind cliffs, climbed by ramps. Towers on high ground reach further; nothing can be built on a ramp or cliff. Takes effect from the next new map.', this.hillsButtons));

    this.presetButtons = PRESET_ORDER.map((preset) =>
      this._button(capitalize(preset), () => this.game.setGraphics(withPreset(this.game.graphics, preset))),
    );
    this.customTag = document.createElement('span');
    this.customTag.className = 'custom-tag';
    this.customTag.textContent = 'Custom';
    this.body.appendChild(
      this._row('Preset', 'The game always starts on High. If your device struggles, try Medium or Low; changes last until you close the game.', [
        ...this.presetButtons,
        this.customTag,
      ]),
    );

    this.optionButtons = {};
    for (const [key, label, help] of ROWS) {
      this.optionButtons[key] = OPTIONS[key].map(([value, text]) =>
        this._button(text, () => this.game.setGraphics(withSetting(this.game.graphics, key, value))),
      );
      this.body.appendChild(this._row(label, help, this.optionButtons[key]));
    }

    onPress($('settings-btn'), () => this.open());
    onPress($('settings-close'), () => this.close());
    onPress($('settings-menu'), () => {
      this.close();
      this.game.menu.open();
    });
    onPress($('settings-reload'), () => {
      carrySettingsThroughReload(this.game.graphics);
      location.reload();
    });
    // Tapping the dark backdrop closes the menu. The grace period ignores the click a touch on ⚙
    // can still generate after the menu has already opened under the finger.
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el && performance.now() - this._openedAt > 500) this.close();
    });
  }

  get isOpen() {
    return !this.el.hidden;
  }

  open() {
    this._wasPaused = this.game.paused;
    if (!this.game.paused) this.game.togglePause();
    this.el.hidden = false;
    this._openedAt = performance.now();
    this.refresh();
  }

  close() {
    if (!this.isOpen) return;
    this.el.hidden = true;
    if (!this._wasPaused && this.game.paused) this.game.togglePause();
  }

  /** New map: straight away on a fresh game, otherwise after a second tap within a few seconds. */
  async _newMap() {
    const world = this.game.world;
    const underWay = world.waves.wave > 0 || world.buildings.size > 1;
    if (underWay && performance.now() > this._confirmUntil) {
      this._confirmUntil = performance.now() + 4000;
      return;
    }
    this._confirmUntil = 0;
    await this.game.newMap();
    this.close();
  }

  refresh() {
    const confirming = performance.now() < this._confirmUntil;
    this.mapButton.textContent = confirming ? 'Tap again: this game ends' : 'New map';
    this.mapButton.classList.toggle('warn', confirming);
    this.mapRow.querySelector('small').textContent = `Map ${this.game.world.seed}. A new map starts a new game (woods, rocks and water are different every time).`;
    Object.keys(GRID.sizes).forEach((size, i) => this.sizeButtons[i].classList.toggle('active', this.game.mapOptions.size === size));
    this.riverButtons.forEach((b, i) => b.classList.toggle('active', this.game.mapOptions.river === (i === 1)));
    this.seaButtons.forEach((b, i) => b.classList.toggle('active', this.game.mapOptions.sea === this.seaChoices[i]));
    this.hillsButtons.forEach((b, i) => b.classList.toggle('active', this.game.mapOptions.hills === this.seaChoices[i]));
    const g = this.game.graphics;
    PRESET_ORDER.forEach((preset, i) => this.presetButtons[i].classList.toggle('active', g.preset === preset));
    this.customTag.hidden = g.preset !== 'custom';
    for (const [key] of ROWS) {
      OPTIONS[key].forEach(([value], i) => this.optionButtons[key][i].classList.toggle('active', g[key] === value));
    }
    const max = window.devicePixelRatio || 1;
    OPTIONS.resolution.forEach(([value], i) => {
      this.optionButtons.resolution[i].title = value > max ? `Capped at ${Math.round(max * 100)}% on this screen` : '';
    });
    const needsReload = RELOAD_REQUIRED.some((k) => g[k] !== this.game.startupGraphics[k]);
    $('settings-reload-note').hidden = !needsReload;
  }

  _button(text, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    onPress(b, () => {
      onClick();
      this.refresh();
    });
    return b;
  }

  _row(label, help, buttons) {
    const row = document.createElement('div');
    row.className = 'setting';
    row.innerHTML = `<div class="setting-label">${label}<small>${help}</small></div>`;
    const group = document.createElement('div');
    group.className = 'segmented';
    group.append(...buttons);
    row.appendChild(group);
    return row;
  }
}
