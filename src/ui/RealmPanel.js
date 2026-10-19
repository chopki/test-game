import { BUILDINGS, REALM } from '../sim/config.js';
import { lairMen } from '../sim/realm/lairs.js';
import { seenAt } from '../sim/realm/fog.js';
import { heroesOf, intentOf, recruitCheck } from '../sim/realm/heroes.js';
import { forgeCheck } from '../sim/realm/index.js';
import { frameToDataURL } from '../render/spriteBaker.js';
import { spriteKeys } from '../render/spriteCatalog.js';
import { onPress } from './press.js';

const BARK_TIME = 3.5; // seconds a hero's bark stays over their head
// How many barks at once (a phone's screen fills fast), and which come first: danger, then bounties, then gold, then
// the rest (see BARKS in sim/realm/heroes.js).
const BARK_BUDGET = { compact: 3, wide: 6 };
const BARK_RANK = { flee: 0, fight: 0, defend: 0, bounty: 1, raid: 1, shop: 2, home: 2 };
/** What a hero is up to, at a glance: a sign over its head (see intentOf for the words). */
const GLYPHS = { fight: '⚔️', flee: '💨', bounty: '💰', raid: '🔥', explore: '🧭', roam: '🌲', patrol: '👁️', home: '🏠', rest: '💤', shop: '⚒️', defend: '🛡️' };
/** How to change a hero's mind about a flag it turned down (see bountyValue's reasons). */
const HINTS = {
  'too dangerous': 'raise the bounty, or hire more heroes to go with them',
  'too far': 'too far from them: flag somewhere nearer their guild',
  'not worth it': 'raise the bounty',
};
const PINGS = 4; // edge arrows at most
/** Each guild's colour (REALM.classes): the ends of its heroes' bark scrolls, their pips on a flag's seal. */
const GUILD_COLOURS = Object.fromEntries(Object.entries(REALM.classes).map(([k, c]) => [k, c.colour]));

const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const names = (list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0] ?? '');
const hpBar = (hp, maxHp) => `<div class="codex-stat"><span>Health</span><span class="bar codex-hp"><span style="width:${(hp / maxHp) * 100}%"></span></span><em>${Math.ceil(hp)}/${maxHp}</em></div>`;

/**
 * Realm mode's part of the HUD (see src/sim/realm/): the cards for a picked hero, outlaw, camp or bounty flag, the
 * guild and smithy sections of a building's Codex card, the chronicle's Realm news, and the labels over the
 * battlefield (heroes' barks, each flag's gold). It only reads the world; commands go through World's methods.
 */
export class RealmPanel {
  constructor(game, hud) {
    this.game = game;
    this.hud = hud;
    this.tags = document.createElement('div');
    this.tags.className = 'realm-tags';
    this.tags.setAttribute('aria-hidden', 'true');
    document.getElementById('hud').prepend(this.tags);
    this._tagEls = new Map();
    this._portraits = {};
    // The hero rail: a portrait for each hero (health ring, level), down the left; a tap looks at them and opens
    // their card.
    this.rail = document.createElement('nav');
    this.rail.className = 'hero-rail';
    this.rail.setAttribute('aria-label', 'Your heroes');
    document.getElementById('hud').appendChild(this.rail);
    this._railKey = '';
    // Arrows at the edge of the screen towards trouble out of sight (raiders, a hero in flight); a tap looks there.
    this.pings = document.createElement('div');
    this.pings.className = 'realm-pings';
    document.getElementById('hud').appendChild(this.pings);
  }

  attach(world) {
    this.world = world;
    this.tags.replaceChildren();
    this._tagEls.clear();
    this.tags.hidden = this.rail.hidden = this.pings.hidden = !world.realm;
    this.rail.replaceChildren();
    this.pings.replaceChildren();
    this._railKey = '';
    if (!world.realm) return;
    const ev = world.events;
    // Realm news for the chronicle, with where it happened (a tap on the entry looks there).
    const toast = (text, kind, at = null) => this.hud.toast(text, kind, at && { x: at.x, z: at.z });
    const camp = (lair) => ({ x: lair.cx, z: lair.cz });
    const spot = (b) => ({ x: b.cx, z: b.cz });
    ev.on('heroRecruited', ({ hero }) => toast(`${hero.name} the ${REALM.classes[hero.cls].name} joins the realm (${REALM.traits.list[hero.traits[0]].name})`, 'good', hero));
    ev.on('realmHeroFell', ({ hero }) => toast(`${hero.name}, a level ${hero.level} ${REALM.classes[hero.cls].name}, has fallen`, 'warn', hero));
    ev.on('lairFound', ({ lair }) => toast('An outlaw camp has been found! Tap it to put a bounty on it', 'info', camp(lair)));
    ev.on('lairRose', ({ lair }) => toast(lair.discovered ? 'A new outlaw camp has sprung up!' : 'Word is the outlaws have a new camp out in the wilds', 'warn', lair.discovered ? camp(lair) : null));
    ev.on('lairRazed', ({ lair, payouts, loot }) => toast(`Outlaw camp burnt down! ${payouts.length ? `${names(payouts.map((p) => p.hero.name))} share ${loot} gold of loot` : 'Its loot is lost'}`, 'good', camp(lair)));
    ev.on('raidSent', ({ target }) => toast(`Outlaws are out raiding, making for the ${target.def.name}!`, 'danger', spot(target)));
    ev.on('bountyRemoved', ({ flag, claimed, payouts }) => {
      const at = flag.lair !== undefined ? camp(world.realm.lairs[flag.lair]) : (flag.unit ?? flag);
      if (claimed) toast(`Bounty claimed: ${names(payouts.map((p) => `${p.hero.name} (${p.gold})`))}`, 'good', at);
      else if (flag.kind !== 'explore' && payouts) toast(`No hero earned the ${flag.gold} gold bounty: it's back in the treasury`, 'info', at);
    });
    ev.on('gearForged', ({ gear }) => toast(`The smithy can now make ${gear.name.toLowerCase()} gear: heroes will come to buy it`, 'good'));
    ev.on('heroBought', ({ hero, gear, tax }) => toast(`${hero.name} buys ${gear.name.toLowerCase()} gear (+${tax} gold to the treasury)`, 'good', hero));
    // The barks that matter are written down too, as the hero said them.
    ev.on('heroBark', ({ hero, text }) => {
      const kind = hero.bark?.kind;
      if (kind === 'bounty' || kind === 'flee') this.hud.chronicle(`${hero.name}: “${text}”`, kind === 'flee' ? 'warn' : 'info', { x: hero.x, z: hero.z });
    });
  }

  // ---------------------------------------------------------------- the battlefield's labels

  /**
   * Each frame: barks over heroes' heads (a few at a time, the most urgent first, as scrolls beside the speaker so
   * they never hide it) and each flag's wax seal with its gold and a pip for each hero on it.
   */
  update() {
    const w = this.world;
    if (!w?.realm) return;
    const r = this.game.renderer;
    const live = new Set();
    const show = (key, cls, x, y, z, fill, beside = false) => {
      const at = r.toScreen(x, y, z);
      if (!at) return;
      let el = this._tagEls.get(key);
      if (!el) {
        el = document.createElement('span');
        el.className = `realm-tag ${cls}`;
        this.tags.appendChild(el);
        this._tagEls.set(key, el);
      }
      fill(el);
      el.style.transform = beside ? `translate(${Math.round(at.x + 10)}px, ${Math.round(at.y)}px) translate(0, -100%)` : `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px) translate(-50%, -100%)`;
      live.add(key);
    };
    for (const tag of r.realm.flagTags()) {
      const f = tag.flag;
      const pips = [...f.takers].map((id) => w.realm.heroes.find((h) => h.id === id)).filter(Boolean);
      const key = `${f.gold}|${pips.map((h) => h.cls).join(',')}`;
      show(`f${f.id}`, f.kind === 'explore' ? 'flag explore' : 'flag', tag.x, tag.y, tag.z, (el) => {
        if (el.dataset.key === key) return;
        el.dataset.key = key;
        el.innerHTML = `${f.gold}<span class="pips">${pips.map((h) => `<i style="background:${GUILD_COLOURS[h.cls]}"></i>`).join('')}</span>`;
      });
    }
    const speaking = w.realm.heroes
      .filter((h) => h.alive && !(h.inside > 0) && h.bark && w.time - h.bark.at <= BARK_TIME)
      .sort((a, b) => (BARK_RANK[a.bark.kind] ?? 3) - (BARK_RANK[b.bark.kind] ?? 3) || b.bark.at - a.bark.at)
      .slice(0, this.hud._compact() ? BARK_BUDGET.compact : BARK_BUDGET.wide);
    // Heroes standing together would talk over each other: each scroll that would overlap one already up goes above
    // it (the most urgent were placed first, so they stay by their speakers).
    const placed = [];
    for (const h of speaking) {
      show(`h${h.id}`, 'bark', h.x, h.def.height * 1.3 + 0.4, h.z, (el) => {
        if (el.textContent === h.bark.text) return;
        el.textContent = h.bark.text;
        el.title = h.name;
        el.style.setProperty('--guild', GUILD_COLOURS[h.cls]);
        el.classList.toggle('danger', BARK_RANK[h.bark.kind] === 0);
      }, true);
      const el = this._tagEls.get(`h${h.id}`);
      const at = el && r.toScreen(h.x, h.def.height * 1.3 + 0.4, h.z);
      if (!at) continue;
      const box = { x: at.x + 10, y: at.y - el.offsetHeight, w: el.offsetWidth, h: el.offsetHeight };
      for (let i = 0; i < placed.length; i++) {
        const o = placed[i];
        if (box.x < o.x + o.w && o.x < box.x + box.w && box.y < o.y + o.h && o.y < box.y + box.h) {
          box.y = o.y - box.h - 3;
          i = -1; // (and check again against them all)
        }
      }
      placed.push(box);
      el.style.transform = `translate(${Math.round(box.x)}px, ${Math.round(box.y)}px)`;
    }
    // What each hero is up to, over its head (close enough in to make them out).
    if (r.farness < 0.5) {
      for (const h of w.realm.heroes) {
        const kind = h.inside > 0 ? null : h.goal?.kind;
        if (!kind || !GLYPHS[kind]) continue;
        show(`g${h.id}`, 'glyph', h.x, h.def.height * 1.3 + 0.35, h.z, (el) => {
          if (el.dataset.kind === kind) return;
          el.dataset.kind = kind;
          el.textContent = GLYPHS[kind];
          el.style.setProperty('--guild', GUILD_COLOURS[h.cls]);
        });
      }
    }
    for (const [key, el] of this._tagEls) {
      if (live.has(key)) continue;
      el.remove();
      this._tagEls.delete(key);
    }
  }

  // ---------------------------------------------------------------- cards

  _portrait(type) {
    return (this._portraits[type] ??= frameToDataURL(this.game.renderer.atlas, spriteKeys.enemy(type, Math.PI / 4, true, 'walk', 0, 'red')));
  }

  /** The card for a picked hero, foe, camp or flag: { key, html, bind(el) }. */
  card(pick) {
    if (pick.kind === 'hero') return this._heroCard(pick.unit);
    if (pick.kind === 'lair') return this._lairCard(pick.lair);
    if (pick.kind === 'flag') return this._flagCard(pick.flag);
    return this._foeCard(pick.unit);
  }

  _heroCard(h) {
    const w = this.world;
    const cls = REALM.classes[h.cls];
    const intent = intentOf(w, h);
    const next = REALM.levels[h.level];
    const traits = h.traits.map((t) => REALM.traits.list[t]);
    const key = ['hero', h.id, Math.ceil(h.hp), h.level, h.gold, h.gear, h.kills, intent].join(':');
    const html = `
      <div class="codex-body">
        <img class="codex-art" src="${this._portrait(h.type)}" alt="" />
        <div>
          <h3>${esc(h.name)}</h3>
          <p class="realm-sub">Level ${h.level} ${cls.name} · ${traits.map((t) => `<b title="${esc(t.text)}">${t.name}</b>`).join(', ')}</p>
          <p class="desc realm-intent">${esc(intent)}</p>
        </div>
      </div>
      ${hpBar(h.hp, h.maxHp)}
      <dl class="realm-facts">
        <dt>Purse</dt><dd><i class="coin"></i>${h.gold}</dd>
        <dt>Gear</dt><dd>${REALM.gear[h.gear].name}</dd>
        <dt>Foes felled</dt><dd>${h.kills}</dd>
        <dt>Tax paid</dt><dd><i class="coin"></i>${h.taxPaid}</dd>
        <dt>Next level</dt><dd>${next === undefined ? 'Highest' : `${Math.floor(h.xp)} / ${next} XP`}</dd>
      </dl>
      <div class="codex-actions"><button id="realm-follow">Look</button></div>`;
    return { key, html, bind: () => onPress(document.getElementById('realm-follow'), () => this.game.renderer.focusOn(h.x, h.z)) };
  }

  _lairCard(lair) {
    const w = this.world;
    const guards = lairMen(w, lair).length;
    const flag = w.realm.bounties.find((f) => f.lair === lair.index);
    const refill = lair.refillAt === null ? null : Math.max(0, Math.ceil(lair.refillAt - w.time));
    const raid = Math.max(0, Math.ceil(lair.nextRaid));
    const key = ['lair', lair.index, Math.ceil(lair.hp), lair.level, guards, refill, raid, flag?.gold, w.economy.canAfford(REALM.bounty.base)].join(':');
    const html = `
      <div class="codex-body">
        <img class="codex-art" src="${this.hud.icons.outlawCamp}" alt="" />
        <div>
          <h3>${BUILDINGS.outlawCamp.name}</h3>
          <p class="realm-sub">Level ${lair.level} of ${REALM.lairs.maxLevel}</p>
          <p class="desc">${BUILDINGS.outlawCamp.description}</p>
        </div>
      </div>
      ${hpBar(lair.hp, lair.maxHp)}
      <dl class="realm-facts">
        <dt>Guards</dt><dd>${guards ? guards : refill !== null ? `None: back in ${refill}s` : 'None'}</dd>
        <dt>Next raid</dt><dd>in about ${raid}s</dd>
        <dt>Loot</dt><dd><i class="coin"></i>${REALM.lairs.loot + REALM.lairs.lootPerLevel * (lair.level - 1)}</dd>
        <dt>Bounty</dt><dd>${flag ? `<i class="coin"></i>${flag.gold}` : 'None'}</dd>
      </dl>
      <div class="codex-actions">${this._bountyButtons(flag, `Bounty <i class="coin"></i>${REALM.bounty.base}`)}</div>
      ${flag ? this._takers(flag) : '<p class="codex-why">Put a bounty on it to send heroes to burn it down.</p>'}`;
    return { key: key + (flag ? this._takersKey(flag) : ''), html, bind: () => this._bindBounty(flag, () => w.placeBounty({ kind: 'attack', lair: lair.index })) };
  }

  _foeCard(u) {
    const w = this.world;
    const flag = w.realm.bounties.find((f) => f.unit === u);
    const outlaw = u.team === 'neutral';
    const name = outlaw ? (u.realm === 'raider' ? 'Outlaw raider' : 'Outlaw') : u.def.name;
    const key = ['foe', u.id, Math.ceil(u.hp), flag?.gold, w.economy.canAfford(REALM.bounty.base)].join(':');
    const html = `
      <div class="codex-body">
        <div>
          <h3>${esc(name)}</h3>
          <p class="desc">${outlaw ? (u.realm === 'raider' ? 'Out to burn your buildings.' : 'Guards an outlaw camp.') : 'One of the blue army.'} Worth <i class="coin"></i>${Math.round(u.def.reward * REALM.killGold)} to the hero who fells it.</p>
        </div>
      </div>
      ${hpBar(u.hp, u.maxHp)}
      <div class="codex-actions">${this._bountyButtons(flag, `Bounty <i class="coin"></i>${REALM.bounty.base}`)}</div>
      ${flag ? this._takers(flag) : ''}`;
    return { key: key + (flag ? this._takersKey(flag) : ''), html, bind: () => this._bindBounty(flag, () => w.placeBounty({ kind: 'attack', unit: u })) };
  }

  _flagCard(f) {
    const what = f.kind === 'explore' ? 'Explore flag' : f.lair !== undefined ? 'Bounty on an outlaw camp' : 'Bounty on a foe';
    const why = f.kind === 'explore' ? 'The first hero to reach it takes the gold.' : 'Shared, when it falls, by the heroes who fought it.';
    const key = ['flag', f.id, f.gold, this._takersKey(f), this.world.economy.canAfford(REALM.bounty.step)].join(':');
    const html = `
      <div class="codex-body">
        <div>
          <h3>${what}</h3>
          <p class="desc"><i class="coin"></i>${f.gold} · ${why} The gold isn't given back if you take it down.</p>
        </div>
      </div>
      <div class="codex-actions">${this._bountyButtons(f)}<button id="realm-flag-down">Take down</button></div>
      ${this._takers(f)}`;
    return {
      key,
      html,
      bind: () => {
        this._bindBounty(f);
        onPress(document.getElementById('realm-flag-down'), () => {
          this.world.cancelBounty(f.id);
          this.game.build.pick(null);
        });
      },
    };
  }

  _bountyButtons(flag, label) {
    const afford = (g) => (this.world.economy.canAfford(g) ? '' : 'disabled title="Not enough gold"');
    if (!flag) return `<button id="realm-bounty" class="primary" ${afford(REALM.bounty.base)}>${label}</button>`;
    return `<button id="realm-fund" class="primary" ${afford(REALM.bounty.step)}>+<i class="coin"></i>${REALM.bounty.step}</button><button id="realm-fund-more" ${afford(100)}>+<i class="coin"></i>100</button>`;
  }

  _bindBounty(flag, place) {
    const w = this.world;
    const said = (r) => !r.ok && this.hud.toast(r.reason, 'warn');
    if (!flag) {
      onPress(document.getElementById('realm-bounty'), () => {
        const r = place();
        said(r);
        if (r.ok) this.hud.onSelectionChanged();
      });
      return;
    }
    onPress(document.getElementById('realm-fund'), () => said(w.fundBounty(flag.id, REALM.bounty.step)));
    onPress(document.getElementById('realm-fund-more'), () => said(w.fundBounty(flag.id, 100)));
  }

  _takersKey(f) {
    return `${[...f.takers].join(',')}|${[...(f.refusals ?? new Map()).entries()].join(',')}`;
  }

  /** Who's on a flag, and who turned it down and why (heroes weigh flags as they think; see bountyValue). */
  _takers(f) {
    const heroes = this.world.realm.heroes;
    const named = (id) => heroes.find((h) => h.id === id)?.name;
    const on = [...f.takers].map(named).filter(Boolean);
    const off = [...(f.refusals ?? new Map()).entries()].filter(([id]) => !f.takers.has(id) && named(id));
    // Who turned it down, why, and what would change their minds.
    const byWhy = new Map();
    for (const [id, why] of off) byWhy.set(why, [...(byWhy.get(why) ?? []), named(id)]);
    const refusals = [...byWhy].map(([why, who]) => `<li><b>${esc(names(who))}</b>: ${esc(why)}${HINTS[why] ? ` <i class="realm-hint">→ ${esc(HINTS[why])}</i>` : ''}</li>`).join('');
    return `<p class="realm-takers">${on.length ? `On it: <b>${esc(names(on))}</b>` : 'No hero has taken it on yet.'}</p>${refusals ? `<ul class="realm-refusals">${refusals}</ul>` : ''}`;
  }

  // ---------------------------------------------------------------- the hero rail and edge pings

  /** Each frame (from HUD.update): the hero rail and the edge arrows. */
  updateRail() {
    const w = this.world;
    if (!w?.realm) return;
    const heroes = w.realm.heroes.filter((h) => h.alive);
    const key = heroes.map((h) => `${h.id}:${h.level}`).join(',');
    if (key !== this._railKey) {
      this._railKey = key;
      this.rail.replaceChildren(
        ...heroes.map((h) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'rail-hero';
          b.dataset.id = h.id;
          b.style.setProperty('--guild', GUILD_COLOURS[h.cls]);
          b.setAttribute('aria-label', `${h.name}, level ${h.level} ${REALM.classes[h.cls].name}`);
          b.innerHTML = `<img src="${this._portrait(h.type)}" alt="" draggable="false" /><span class="rail-level">${h.level}</span>`;
          onPress(b, () => {
            this.game.renderer.focusOn(h.x, h.z);
            this.game.build.pick({ kind: 'hero', unit: h });
          });
          return b;
        }),
      );
    }
    const picked = this.game.build.picked?.unit;
    for (const b of this.rail.children) {
      const h = heroes.find((x) => x.id === Number(b.dataset.id));
      if (!h) continue;
      b.style.setProperty('--hp', (h.hp / h.maxHp).toFixed(2));
      b.classList.toggle('inside', h.inside > 0);
      b.classList.toggle('fleeing', h.goal?.kind === 'flee');
      b.classList.toggle('active', picked === h);
    }
    this._updatePings(w);
  }

  _updatePings(w) {
    const r = this.game.renderer;
    const rect = r.canvas.getBoundingClientRect();
    const margin = 30;
    const trouble = [];
    for (const t of w.troops) {
      if (!t.alive) continue;
      if (t.realm === 'raider' && seenAt(w, t.x, t.z)) trouble.push({ x: t.x, z: t.z, kind: 'danger', label: 'Raiders' });
      else if (t.realm === 'hero' && !(t.inside > 0) && t.goal?.kind === 'flee') trouble.push({ x: t.x, z: t.z, kind: 'warn', label: `${t.name} is fleeing` });
    }
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const shown = [];
    for (const p of trouble) {
      const s = r.toScreen(p.x, 0, p.z);
      if (!s || (s.x > rect.left + margin && s.x < rect.right - margin && s.y > rect.top + margin && s.y < rect.bottom - margin)) continue;
      // Where the line from the middle of the screen to it leaves the screen (inset by the margin).
      const dx = s.x - cx;
      const dy = s.y - cy;
      const k = Math.min((rect.width / 2 - margin) / Math.abs(dx || 1e-6), (rect.height / 2 - margin) / Math.abs(dy || 1e-6));
      shown.push({ ...p, sx: cx + dx * k, sy: cy + dy * k, angle: Math.atan2(dy, dx), d: Math.hypot(dx, dy) });
    }
    shown.sort((a, b) => (a.kind === 'danger' ? 0 : 1) - (b.kind === 'danger' ? 0 : 1) || a.d - b.d);
    // Close arrows merge into one.
    const kept = [];
    for (const p of shown) if (kept.length < PINGS && !kept.some((q) => Math.hypot(q.sx - p.sx, q.sy - p.sy) < 56)) kept.push(p);
    while (this.pings.children.length < kept.length) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'realm-ping';
      b.innerHTML = '<span class="ping-arrow"></span>';
      onPress(b, () => this.game.renderer.focusOn(Number(b.dataset.x), Number(b.dataset.z)));
      this.pings.appendChild(b);
    }
    [...this.pings.children].forEach((b, i) => {
      const p = kept[i];
      b.hidden = !p;
      if (!p) return;
      b.className = `realm-ping ${p.kind}`;
      Object.assign(b.dataset, { x: p.x, z: p.z });
      b.title = b.ariaLabel = `${p.label}: look there`;
      b.style.transform = `translate(${Math.round(p.sx)}px, ${Math.round(p.sy)}px) translate(-50%, -50%)`;
      b.firstChild.style.transform = `rotate(${p.angle}rad)`;
    });
  }

  // ---------------------------------------------------------------- buildings

  /** A guild's heroes and its Recruit button, or the smithy's Forge button: { key, html, bind } or null. */
  buildingSection(b) {
    const w = this.world;
    if (!w.realm || b.team !== 'red') return null;
    if (b.def.guild) {
      const cls = REALM.classes[b.def.guild];
      const check = recruitCheck(w, b);
      const heroes = heroesOf(w, b.id);
      // Only where each hero is (not what they're up to, which changes all the time): the card, and its Hire button,
      // are rebuilt only when something on it changes, not under the player's finger (tap a hero for their card).
      const where = (h) => (h.inside > 0 ? 'resting here' : 'out in the realm');
      const rows = heroes.map((h) => `<li><b>${esc(h.name)}</b> · level ${h.level} · ${where(h)}</li>`).join('');
      const key = ['guild', check.ok, check.reason, ...heroes.map((h) => `${h.id}:${h.level}:${where(h)}`)].join('|');
      const html = `
        <p class="garrison">${cls.plural}: ${heroes.length}/${REALM.guildCap}</p>
        ${rows ? `<ul class="realm-heroes">${rows}</ul>` : '<p class="codex-why">No heroes yet: hire one!</p>'}
        <div class="codex-actions"><button id="realm-recruit" class="primary" ${check.ok ? '' : `disabled title="${esc(check.reason)}"`}>Hire a ${cls.name} <i class="coin"></i>${cls.cost}</button></div>
        ${check.ok ? '' : `<p class="codex-why">${esc(check.reason)}</p>`}`;
      return {
        key,
        html,
        bind: () =>
          onPress(document.getElementById('realm-recruit'), () => {
            const r = w.recruit(b.id);
            if (!r.ok) this.hud.toast(r.reason, 'warn');
          }),
      };
    }
    if (b.def.shop) {
      const check = forgeCheck(w);
      const now = REALM.gear[w.realm.gearTier];
      const key = ['smithy', w.realm.gearTier, check.ok, check.reason].join('|');
      const html = `
        <p class="garrison">Gear on sale: ${now.name}${w.realm.gearTier ? ` (heroes pay <i class="coin"></i>${now.price}; the treasury takes ${Math.round(REALM.salesTax * 100)}%)` : ' (forge better to sell)'}</p>
        <div class="codex-actions">${check.gear ? `<button id="realm-forge" class="primary" ${check.ok ? '' : `disabled title="${esc(check.reason)}"`}>Forge ${check.gear.name.toLowerCase()} gear <i class="coin"></i>${check.cost}</button>` : '<span class="maxed">The best gear is forged</span>'}</div>`;
      return {
        key,
        html,
        bind: () => {
          if (!check.gear) return;
          onPress(document.getElementById('realm-forge'), () => {
            const r = w.forge();
            if (!r.ok) this.hud.toast(r.reason, 'warn');
          });
        },
      };
    }
    return null;
  }

}
