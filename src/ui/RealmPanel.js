import { BUILDINGS, REALM } from '../sim/config.js';
import { lairMen } from '../sim/realm/lairs.js';
import { heroesOf, intentOf, recruitCheck } from '../sim/realm/heroes.js';
import { forgeCheck } from '../sim/realm/index.js';
import { frameToDataURL } from '../render/spriteBaker.js';
import { spriteKeys } from '../render/spriteCatalog.js';
import { onPress } from './press.js';

const BARK_TIME = 3.5; // seconds a hero's bark stays over their head

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
  }

  attach(world) {
    this.world = world;
    this.tags.replaceChildren();
    this._tagEls.clear();
    this.tags.hidden = !world.realm;
    if (!world.realm) return;
    const ev = world.events;
    const toast = (text, kind) => this.hud.toast(text, kind);
    ev.on('heroRecruited', ({ hero }) => toast(`${hero.name} the ${REALM.classes[hero.cls].name} joins the realm (${REALM.traits.list[hero.traits[0]].name})`, 'good'));
    ev.on('realmHeroFell', ({ hero }) => toast(`${hero.name}, a level ${hero.level} ${REALM.classes[hero.cls].name}, has fallen`, 'warn'));
    ev.on('lairFound', () => toast('An outlaw camp has been found! Tap it to put a bounty on it', 'info'));
    ev.on('lairRose', ({ lair }) => toast(lair.discovered ? 'A new outlaw camp has sprung up!' : 'Word is the outlaws have a new camp out in the wilds', 'warn'));
    ev.on('lairRazed', ({ payouts, loot }) => toast(`Outlaw camp burnt down! ${payouts.length ? `${names(payouts.map((p) => p.hero.name))} share ${loot} gold of loot` : 'Its loot is lost'}`, 'good'));
    ev.on('raidSent', ({ target }) => toast(`Outlaws are out raiding, making for the ${target.def.name}!`, 'danger'));
    ev.on('bountyRemoved', ({ flag, claimed, payouts }) => {
      if (claimed) toast(`Bounty claimed: ${names(payouts.map((p) => `${p.hero.name} (${p.gold})`))}`, 'good');
      else if (flag.kind !== 'explore' && payouts) toast(`No hero earned the ${flag.gold} gold bounty: it's back in the treasury`, 'info');
    });
    ev.on('gearForged', ({ gear }) => toast(`The smithy can now make ${gear.name.toLowerCase()} gear: heroes will come to buy it`, 'good'));
    ev.on('heroBought', ({ hero, gear, tax }) => toast(`${hero.name} buys ${gear.name.toLowerCase()} gear (+${tax} gold to the treasury)`, 'good'));
  }

  // ---------------------------------------------------------------- the battlefield's labels

  /** Each frame: barks over heroes' heads and each flag's gold, placed over the battlefield. */
  update() {
    const w = this.world;
    if (!w?.realm) return;
    const r = this.game.renderer;
    const live = new Set();
    const show = (key, text, cls, x, y, z) => {
      const at = r.toScreen(x, y, z);
      if (!at) return;
      let el = this._tagEls.get(key);
      if (!el) {
        el = document.createElement('span');
        el.className = `realm-tag ${cls}`;
        this.tags.appendChild(el);
        this._tagEls.set(key, el);
      }
      if (el.textContent !== text) el.textContent = text;
      el.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px) translate(-50%, -100%)`;
      live.add(key);
    };
    for (const tag of r.realm.flagTags()) show(`f${tag.flag.id}`, `${tag.flag.gold}`, tag.flag.kind === 'explore' ? 'flag explore' : 'flag', tag.x, tag.y, tag.z);
    for (const h of w.realm.heroes) {
      if (!h.alive || h.inside > 0 || !h.bark || w.time - h.bark.at > BARK_TIME) continue;
      show(`h${h.id}`, `${h.name}: ${h.bark.text}`, 'bark', h.x, h.def.height * 1.3 + 0.55, h.z);
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
    const off = [...(f.refusals ?? new Map()).entries()].filter(([id]) => !f.takers.has(id) && named(id)).map(([id, why]) => `${named(id)} (${why})`);
    return `<p class="realm-takers">${on.length ? `On it: <b>${esc(names(on))}</b>` : 'No hero has taken it on yet.'}${off.length ? `<br>Turned it down: ${esc(off.join(', '))}` : ''}</p>`;
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
      const rows = heroes.map((h) => `<li><b>${esc(h.name)}</b> · level ${h.level} · ${esc(intentOf(w, h))}</li>`).join('');
      const key = ['guild', check.ok, check.reason, ...heroes.map((h) => `${h.id}:${h.level}:${intentOf(w, h)}`)].join('|');
      const html = `
        <p class="garrison">${cls.name}s: ${heroes.length}/${REALM.guildCap}</p>
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
