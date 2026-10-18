import { BUILDINGS, ENEMIES, HEROES } from '../sim/config.js';
import { frameToDataURL } from '../render/spriteBaker.js';
import { spriteKeys } from '../render/spriteCatalog.js';
import { onPress } from './press.js';

const $ = (id) => document.getElementById(id);

/**
 * The main menu (after docs/reference/ui-menu.jpg): a parchment page with the crest and title, the live battlefield
 * showing through it as the picture, and plaque buttons. Shown at start (unless `?menu=0`) and from Settings → Main
 * menu. The game is held while it's open. Also the Royal Codex (every tower and foe) and the credits.
 */
export class MainMenu {
  constructor(game) {
    this.game = game;
    this.el = $('menu');
    this.codex = $('codex');
    this.credits = $('credits');
    this.started = false; // whether a battle has been begun (then Continue goes back to it)
    this._confirmUntil = 0;

    const atlas = game.renderer.atlas;
    const portrait = (key) => frameToDataURL(atlas, key);
    $('menu-foe-left').src = portrait(spriteKeys.enemy('knight', Math.PI / 2));
    $('menu-foe-right').src = portrait(spriteKeys.enemy('swordsman', 0));

    onPress($('menu-continue'), () => this.close());
    onPress($('menu-endless'), () => this._start('survival'));
    onPress($('menu-conquest'), () => this._start('conquest'));
    onPress($('hero-pick-close'), () => ($('hero-pick').hidden = true));
    this._buildHeroCards(portrait);
    onPress($('menu-codex'), () => this.openCodex());
    onPress($('menu-options'), () => game.settingsMenu.open());
    onPress($('menu-help'), () => game.hud.toggleHelp(true));
    onPress($('menu-credits'), () => (this.credits.hidden = false));
    onPress($('credits-close'), () => (this.credits.hidden = true));
    onPress($('codex-close'), () => (this.codex.hidden = true));
    for (const el of [this.codex, this.credits]) el.addEventListener('click', (e) => e.target === el && (el.hidden = true));
    this._buildCodex(portrait);
  }

  get isOpen() {
    return !this.el.hidden;
  }

  open() {
    this.el.hidden = false;
    document.body.classList.add('menu-open');
    this.game.setHeld(true);
    this.refresh();
  }

  close() {
    this.el.hidden = true;
    this.codex.hidden = this.credits.hidden = true;
    $('hero-pick').hidden = true;
    document.body.classList.remove('menu-open');
    this.game.setHeld(false);
    this.started = true;
  }

  refresh() {
    const now = performance.now();
    $('menu-continue').disabled = !this.started;
    const mode = this.game.world.mode;
    for (const m of ['survival', 'conquest']) {
      const id = m === 'survival' ? 'endless' : 'conquest';
      const confirming = this._confirming === m && now < this._confirmUntil;
      const name = m === 'survival' ? 'Endless Mode' : 'Conquest';
      $(`menu-${id}-label`).textContent = confirming ? 'Tap again: this battle ends' : this.started && mode === m ? `New ${name}` : name;
      $(`menu-${id}`).classList.toggle('warn', confirming);
    }
  }

  /**
   * Endless Mode or Conquest: at the start, the battle on the map already laid out behind the menu if it's that
   * mode, else a new map of the mode; once a battle is under way, a new map (after a second tap within a few
   * seconds, if the battle has got going).
   */
  async _start(mode) {
    const world = this.game.world;
    if (!this.started && world.mode === mode && mode !== 'conquest') {
      this.close();
      return;
    }
    const underWay = this.started && (world.waves.wave > 0 || world.buildings.size > (world.mode === 'conquest' ? 20 : 1));
    if (underWay && (this._confirming !== mode || performance.now() > this._confirmUntil)) {
      this._confirming = mode;
      this._confirmUntil = performance.now() + 4000;
      this.refresh();
      setTimeout(() => this.refresh(), 4100);
      return;
    }
    this._confirmUntil = 0;
    if (mode === 'conquest') {
      $('hero-pick').hidden = false; // the battle begins once a hero is chosen (_pickHero)
      return;
    }
    await this.game.newMap(mode);
    this.close();
  }

  /** Conquest: the hero chosen; a new Conquest with them (or the one laid out behind the menu, if it's theirs). */
  async _pickHero(kind) {
    $('hero-pick').hidden = true;
    this.game.mapOptions.hero = kind;
    const world = this.game.world;
    if (!this.started && world.mode === 'conquest' && world.heroKinds.red === kind) {
      this.close();
      return;
    }
    await this.game.newMap('conquest');
    this.close();
  }

  /** A card per hero in HEROES.roster: portrait, stats and abilities. */
  _buildHeroCards(portrait) {
    const el = $('hero-cards');
    el.replaceChildren();
    for (const [kind, h] of Object.entries(HEROES.roster)) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'codex-card hero-card';
      card.dataset.hero = kind;
      const s = h.stats;
      const abilities = h.abilities.map((a, i) => `<b>${i ? 'E' : 'Q'}</b> ${HEROES.abilities[a].name}`).join(' · ');
      card.innerHTML = `
        <img src="${portrait(spriteKeys.enemy(h.type, Math.PI / 4, true, 'walk', 0, 'red'))}" alt="" draggable="false" />
        <div>
          <h4>${h.names.red}, the ${h.title}</h4>
          <dl><dt>Health</dt><dd>${s.maxHp}</dd><dt>Damage</dt><dd>${s.damage}</dd><dt>Reach</dt><dd>${s.ranged ? s.ranged.range : 'melee'}</dd><dt>Speed</dt><dd>${s.speed}</dd></dl>
          <p>${h.blurb}</p>
          <p class="hero-abilities">${abilities}</p>
        </div>`;
      onPress(card, () => this._pickHero(kind));
      el.append(card);
    }
  }

  openCodex() {
    this.codex.hidden = false;
  }

  // The Royal Codex: a card per tower and per foe, from config.js.
  _buildCodex(portrait) {
    const card = (img, name, lines, note) => `
      <div class="codex-card">
        <img src="${img}" alt="" draggable="false" />
        <div>
          <h4>${name}</h4>
          <dl>${lines.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
          ${note ? `<p>${note}</p>` : ''}
        </div>
      </div>`;
    const towers = Object.entries(BUILDINGS)
      .filter(([, d]) => d.buildable)
      .map(([type, d]) => {
        const a = d.attack;
        const lines = [['Cost', `${d.cost}g`], ['Health', d.maxHp]];
        if (a) lines.push(['Damage', a.kind === 'pulse' ? `${a.damage}, all in reach` : a.splash ? `${a.damage}, area` : a.damage], ['Range', a.range], ['Shots', `${(1 / a.cooldown).toFixed(1)}/s`]);
        if (d.trains) lines.push(['Garrison', `${d.trains.garrison} men`], ['Trains', `1 every ${d.trains.every}s`]);
        return card(portrait(spriteKeys.icon(type)), d.name, lines, d.description);
      });
    const foes = Object.entries(ENEMIES).map(([type, d]) => {
      const lines = [['Health', d.maxHp], ['Damage', d.damage], ['Speed', d.speed]];
      if (d.ranged) lines.push(['Range', d.ranged.range]);
      const notes = [d.siege ? 'Siege engine: smashes walls and towers.' : '', d.ranged ? `Shoots from ${d.ranged.range} tiles.` : '', `From wave ${d.minWave}.`];
      return card(portrait(spriteKeys.enemy(type, Math.PI / 4)), d.name, lines, notes.filter(Boolean).join(' '));
    });
    $('codex-towers').innerHTML = towers.join('');
    $('codex-foes').innerHTML = foes.join('');
  }
}
