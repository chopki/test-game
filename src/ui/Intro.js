import { CONQUEST, HEROES, REALM } from '../sim/config.js';
import { onPress } from './press.js';

const $ = (id) => document.getElementById(id);

/**
 * The briefing for each kind of battle (Endless Mode's Survival, Conquest and Realm): what you're fighting for, how to
 * play, and a few hints. Shown when a battle of that kind is begun from the main menu (until "Don't show this
 * again"), and from Help at any time. The battle is held while it's open.
 */
const INTROS = {
  survival: {
    title: 'Endless Mode: Hold the Hall',
    objective: 'Wave after wave of the blue army marches on your Town Hall from the edges of the map. Hold out as long as you can: if the Town Hall falls, the battle is lost.',
    how: [
      'Build from the wheel bottom right (or keys 1–6): walls, Archer Towers, Cannons, Magic Spires, Catapults and Barracks.',
      'Drag to lay a line of wall. Tap a building to see it, upgrade it, repair it or sell it.',
      'Between waves the dial top right counts down to the next. Tap it twice to send the wave early (Space on a keyboard).',
      'Gold comes from every foe that falls, and a bonus for each wave you survive.',
    ],
    hints: [
      'Enemies walk round a short wall but smash through when the way round is long, so close the gaps in your fort.',
      "Woods, rocks and water can't be crossed: build where the land funnels them.",
      'Towers on high ground reach further; arrows shot up at it reload slower.',
      "Upgrade the Town Hall: nothing can stand more than one stage above it.",
      'A Barracks trains men in red who hold the enemy up while your towers work.',
    ],
  },
  conquest: {
    title: 'Conquest: Castle against Castle',
    objective: 'Your red castle holds the south end of the map, the blue castle the north. Bring down the blue Town Hall before they bring down yours.',
    how: [
      'Every wave (the dial top right) each Barracks sends a squad down its lane. Tap the dial twice to send them early.',
      `You can only build in your territory: round your Town Hall (it grows as the hall goes up stages) and round your Flag Forts.`,
      `Three flags stand in the middle of the map. Men or your hero by one take it; then build a Flag Fort on it (key 7) for territory, gold and another Barracks (you start with ${CONQUEST.barracksCap.base}).`,
      'Your hero: tap their portrait (or G), then tap the map to send them, or tap an enemy to attack it. Their two abilities are on the buttons beside them (Q and E).',
      'The minimap top left shows the whole field: tap it to look there.',
    ],
    hints: [
      "The squads march on their own; your job is to win the middle. Take the flags and fortify them.",
      'Upgrade your Barracks (Drill Yard, then Garrison Hall) for bigger, tougher squads: that is how a deadlock in the middle is broken.',
      `Your hero levels up from foes that fall near them. If they fall, they're back at the hall after a while.`,
      'Bandit camps in the woods are worth gold and hero XP, and fill again after a while.',
      "Siege engines come with later waves and go for your buildings: catch them before they reach your towers.",
      'Repair your buildings any time they are not under attack.',
    ],
  },
  realm: {
    title: 'Realm: Heroes of the Hall',
    objective: 'Raise a town in the wilds and hire heroes to keep it. They go where they please, but they love gold. By day they explore and hunt; each night the blue army comes for your Town Hall.',
    how: [
      `Build guilds from the wheel (keys 7–9): a Warriors' Hall, Rangers' Lodge or Rogues' Den. Tap one to hire its heroes (up to ${REALM.guildCap} each).`,
      'Heroes act on their own: exploring, hunting, raiding outlaw camps, coming home to rest. Tap one to see what they are up to.',
      'To steer them, place bounty flags (B): on an outlaw camp or foe to have it attacked, or on open ground to have it explored. More gold draws more heroes; tap a flag to add to it.',
      'Heroes keep the gold they earn and pay tax on it when they come home: that tax is how the treasury grows.',
      "You can only build where someone has been: the blank parchment of the map is land no one has seen yet. There are no walls or towers to raise here: at night your heroes and the old fort hold the Hall.",
    ],
    hints: [
      'Rangers love to explore; Men-at-arms stand and fight; Rogues go wherever the gold is (and run when it gets hot).',
      'A lone hero won\'t take on a whole camp: hire a few, or put a fat bounty on it to stiffen their nerve.',
      'Outlaw camps grow stronger and send raiders at your buildings. When one burns another rises somewhere, stronger, after a while.',
      'A hero that falls is gone for good, with their gold. Keep the healers busy: they rest at their guild.',
    ],
  },
};

const seenKey = (mode) => `hold-the-hall:intro-seen:${mode}`;

export class Intro {
  constructor(game) {
    this.game = game;
    this.el = $('intro');
    this.mode = null;
    onPress($('intro-start'), () => this.close());
  }

  get isOpen() {
    return !this.el.hidden;
  }

  /** Whether the player asked not to be shown `mode`'s briefing again (remembered in this browser only). */
  seen(mode) {
    try {
      return localStorage.getItem(seenKey(mode)) === '1';
    } catch {
      return false;
    }
  }

  /** Show `mode`'s briefing when a battle of that kind begins, unless the player has said not to. */
  begin(mode) {
    if (!this.seen(mode)) this.show(mode);
  }

  show(mode) {
    const intro = INTROS[mode] ?? INTROS.survival;
    this.mode = mode;
    $('intro-title').textContent = intro.title;
    $('intro-objective').textContent = intro.objective;
    const list = (el, items) => el.replaceChildren(...items.map((t) => Object.assign(document.createElement('li'), { textContent: t })));
    list($('intro-how'), intro.how);
    list($('intro-hints'), intro.hints);
    const heroes = $('intro-heroes');
    heroes.hidden = mode !== 'conquest';
    if (mode === 'conquest') {
      const kind = this.game.world?.heroKinds?.red ?? HEROES.default;
      const h = HEROES.roster[kind];
      heroes.textContent = `Your champion: ${h.names.red}, the ${h.title}. ${h.blurb} Q: ${HEROES.abilities[h.abilities[0]].name}. E: ${HEROES.abilities[h.abilities[1]].name}.`;
    }
    $('intro-again').checked = this.seen(mode);
    this.el.hidden = false;
    this.game.setHeld(true);
  }

  close() {
    try {
      if ($('intro-again').checked) localStorage.setItem(seenKey(this.mode), '1');
      else localStorage.removeItem(seenKey(this.mode));
    } catch {
      // Storage unavailable: it'll be shown again next time.
    }
    this.el.hidden = true;
    this.game.setHeld(Boolean(this.game.menu?.isOpen || this.game.loading?.isOpen));
  }
}
