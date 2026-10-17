# Hold the Hall: notes for Claude

3D browser tower-defence / survival game (Three.js + Vite, plain JS ES modules).

- `npm test` runs the Vitest simulation tests. Browser tests (Playwright, desktop + Pixel 7 phone, against the
  production build) come in two sizes: `npm run test:e2e` runs the vital `@smoke` set (~3 min: loading, placing,
  walls, waves, crash recovery, frame-rate cap and draw-call budget, phone touch flow), and `npm run test:e2e:full`
  is the full regression suite. **Don't run browser tests by default**: many tweaks are small. Run `npm test` and
  `npm run build`, then ask the user whether to run the smoke set (or the full suite) before pushing. Run them
  without asking only when the user requests it. `npm run build` must stay green. CI only runs the unit tests on push.
- `World` defaults to an open map (`terrain: 'open'`); the game passes `terrain: 'generate'`. In e2e,
  `openGame(page)` loads `?map=open`; pass `{ map: 'terrain' }` for the generated map (fixed `TERRAIN_SEED`).
  The game starts with a partly built fort (`fort: true`); `openGame` leaves it out (`?fort=0`) unless `{ fort: true }`.
  Some maps have a coast (`?sea=0|1`); `openGame` turns it off (`sea=0`) unless the test passes `query: 'sea=1'`;
  likewise hills (`?hills=0|1`, plateaus with cliffs and ramps) are off unless `query: 'hills=1'`, and the main menu
  (`?menu=0`) unless `query: 'menu=1'`.
  The game's default map is Medium (52 tiles); `World` and `openGame` use the small 40-tile map (`size=small`) unless
  told otherwise (`World({ size })`, `query: 'size=large'`).
- Tag a new browser test `{ tag: '@smoke' }` only if it guards something vital; otherwise it's full-suite only. `npm run dev` starts
  the dev server.
- **Save browser checks as tests.** Don't verify UI or input changes with one-off scripts: add or extend a spec in
  `e2e/` (helpers in `e2e/helpers.js`) so it becomes part of the regression set. Gameplay rules go in `test/`.
- **`src/sim/` must never import three.js or touch the DOM.** All gameplay logic goes there, with tests in `test/`.
- All balance numbers live in `src/sim/config.js`. Don't hard-code stats elsewhere.
- The renderer reads world state each frame and must not mutate it. Input changes the world only via `World` methods
  (`place`, `sell`, `startWave`).
- Keep `docs/GAME_DESIGN.md` (stats tables) and `docs/ROADMAP.md` (checkboxes) in sync with gameplay changes.
- See `docs/ARCHITECTURE.md` for extension points (troops, heroes, economy).
- The battlefield is pre-baked sprites. **After changing any file in `SPRITE_SOURCES` (scripts/sprite-hash.mjs: models, textures, ink style, the catalogue, wall decor, animals…), run
  `npm run bake`** (~30 min: bakes the standard and HD sets) and commit `public/sprites/` and `public/sprites-hd/` (the unit tests fail on a stale atlas). See ARCHITECTURE.md.
- Art style target: `docs/reference/art-style.jpg`; UI style targets: `docs/reference/ui-style.jpg`, `ui-menu.jpg`
  (menu, loading screen) and `ui-hud-phone.jpg` (see the "Art direction" section in `docs/GAME_DESIGN.md`).
