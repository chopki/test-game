import { carrySettingsThroughReload, OPTIONS, PRESET_ORDER, RELOAD_REQUIRED, withPreset, withSetting } from '../render/graphicsSettings.js';
import { onPress } from './press.js';

const $ = (id) => document.getElementById(id);

const ROWS = [
  ['resolution', 'Render scale', 'Pixels drawn per screen pixel. Auto adjusts it to hold the frame rate; lower is blurrier but much lighter on the GPU.'],
  ['shadows', 'Shadows', 'Shadow quality. Off saves the most GPU work.'],
  ['lighting', 'Lighting', 'Simple uses much cheaper materials, with a painted look. Detailed adds physically based shine.'],
  ['fpsCap', 'Frame rate cap', 'Fewer frames per second means less heat and battery use, and fewer crashes.'],
  ['antialias', 'Anti-aliasing', 'Smooths jagged edges. Costly on phones. Takes effect after a reload.'],
  ['scenery', 'Scenery', 'Trees and rocks around the map.'],
  ['effects', 'Effects', 'Explosion and dust bursts.'],
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

    this.presetButtons = PRESET_ORDER.map((preset) =>
      this._button(capitalize(preset), () => this.game.setGraphics(withPreset(this.game.graphics, preset))),
    );
    this.customTag = document.createElement('span');
    this.customTag.className = 'custom-tag';
    this.customTag.textContent = 'Custom';
    this.body.appendChild(
      this._row('Preset', 'The game always starts on Low. High looks best on desktops; changes last until you close the game.', [
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

  refresh() {
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
