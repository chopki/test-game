import './style.css';
import { createWorld, Game, readMapOptions } from './game/Game.js';
import { LoadingScreen, painted } from './ui/LoadingScreen.js';
import { loadSprites, pickSpriteSet } from './render/spriteAssets.js';
import { startupSettings } from './render/graphicsSettings.js';

// Show failures on screen rather than leaving a blank page.
function showFatal(title, err) {
  console.error(err);
  document.getElementById('error-title').textContent = title;
  document.getElementById('error-message').textContent = typeof err === 'string' ? err : String(err?.message ?? err);
  document.getElementById('error').hidden = false;
}

window.addEventListener('error', (e) => showFatal('The game hit an error', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => showFatal('The game hit an error', e.reason));

// Boot: the loading screen while the sprites load, then the first map (sketched on the loading screen while the
// battlefield is painted), then the main menu (`?menu=0` goes straight into the battle, as the browser tests do).
const params = new URLSearchParams(location.search);
const loading = new LoadingScreen();
try {
  loading.show(null, 0.05);
  loading.setProgress(0.6, { trickle: true });
  const graphics = startupSettings(); // (read once: it uses up the settings carried through a "Reload now")
  const atlas = await loadSprites({ set: pickSpriteSet(graphics.sprites) });
  const world = createWorld(readMapOptions());
  loading.setWorld(world);
  loading.setProgress(0.85, { trickle: true });
  await painted();
  // Handy for poking at the simulation from the browser console.
  window.game = new Game(document.getElementById('app'), atlas, { world, loading, graphics, menu: params.get('menu') !== '0' });
  await loading.finish(params.get('menu') === '0' ? 0 : 450);
} catch (err) {
  document.getElementById('loading').hidden = true;
  showFatal(
    'Could not start 3D graphics',
    'Your browser refused to start WebGL. This often happens right after a graphics reset: close this tab ' +
      '(or the browser app) completely, then open the game again. Otherwise check that hardware acceleration/WebGL ' +
      `is enabled. (${err?.message ?? err})`,
  );
}
