# Hold the Hall: notes for Claude

3D browser tower-defence / survival game (Three.js + Vite, plain JS ES modules).

- `npm test` runs the Vitest simulation tests; `npm run test:e2e` runs the Playwright browser tests (desktop and
  Pixel 7 phone) against the production build. Both must stay green, as must `npm run build`. `npm run dev` starts
  the dev server.
- **Save browser checks as tests.** Don't verify UI or input changes with one-off scripts: add or extend a spec in
  `e2e/` (helpers in `e2e/helpers.js`) so it becomes part of the regression set. Gameplay rules go in `test/`.
- **`src/sim/` must never import three.js or touch the DOM.** All gameplay logic goes there, with tests in `test/`.
- All balance numbers live in `src/sim/config.js`. Don't hard-code stats elsewhere.
- The renderer reads world state each frame and must not mutate it. Input changes the world only via `World` methods
  (`place`, `sell`, `startWave`).
- Keep `docs/GAME_DESIGN.md` (stats tables) and `docs/ROADMAP.md` (checkboxes) in sync with gameplay changes.
- See `docs/ARCHITECTURE.md` for extension points (troops, heroes, economy).
