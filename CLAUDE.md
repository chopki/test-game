# Hold the Hall: notes for Claude

3D browser tower-defence / survival game (Three.js + Vite, plain JS ES modules).

- `npm test` runs the Vitest simulation tests. Browser tests (Playwright, desktop + Pixel 7 phone, against the
  production build) come in two sizes: `npm run test:e2e` runs the vital `@smoke` set (~1.5 min: loading, placing,
  walls, waves, crash recovery, frame-rate cap and draw-call budget, phone touch flow). Run it before pushing
  UI/input/rendering changes. `npm run test:e2e:full` is the full regression suite: run it only when asked for a
  full test. `npm run build` must stay green. CI only runs the unit tests on push.
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
- Art style target: `docs/reference/art-style.jpg`; UI style target: `docs/reference/ui-style.jpg` (see the
  "Art direction" section in `docs/GAME_DESIGN.md`).
