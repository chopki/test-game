# Hold the Hall: notes for Claude

3D browser tower-defence / survival game (Three.js + Vite, plain JS ES modules).

- `npm test` runs the Vitest simulation tests. `npm run build` must stay green. `npm run dev` starts the dev server.
- **`src/sim/` must never import three.js or touch the DOM.** All gameplay logic goes there, with tests in `test/`.
- All balance numbers live in `src/sim/config.js`. Don't hard-code stats elsewhere.
- The renderer reads world state each frame and must not mutate it. Input changes the world only via `World` methods
  (`place`, `sell`, `startWave`).
- Keep `docs/GAME_DESIGN.md` (stats tables) and `docs/ROADMAP.md` (checkboxes) in sync with gameplay changes.
- See `docs/ARCHITECTURE.md` for extension points (troops, heroes, economy).
