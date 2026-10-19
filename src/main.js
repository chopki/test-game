import './style.css';
import { createWorld, Game, readMapOptions } from './game/Game.js';
import { LoadingScreen, painted } from './ui/LoadingScreen.js';
import { showEarlyMenu } from './ui/MainMenu.js';
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

// Boot: the main menu at once (index.html shows it at first paint), with the sprites, the first map and the painted
// battlefield loading behind it; a battle picked meanwhile begins once they're ready (see showEarlyMenu). With
// `?menu=0` (as the browser tests do) it goes straight into the battle instead, behind the loading screen (with a
// sketch of the map while the battlefield is painted).
const params = new URLSearchParams(location.search);
const loading = new LoadingScreen();
const menu = params.get('menu') !== '0';
try {
  const early = menu ? showEarlyMenu() : null;
  if (!menu) {
    loading.show(null, 0.05);
    loading.setProgress(0.6, { trickle: true });
  }
  early?.setProgress(0);
  const graphics = startupSettings(); // (read once: it uses up the settings carried through a "Reload now")
  const atlas = await loadSprites({ set: pickSpriteSet(graphics.sprites), onProgress: (done, total) => early?.setProgress((0.8 * done) / total) });
  const world = createWorld(readMapOptions());
  if (!menu) {
    loading.setWorld(world);
    loading.setProgress(0.85, { trickle: true });
  }
  early?.setProgress(0.85);
  await painted();
  // Handy for poking at the simulation from the browser console.
  window.game = new Game(document.getElementById('app'), atlas, { world, loading, graphics, menu });
  early?.handOver(window.game);
  if (!menu) await loading.finish(0);
} catch (err) {
  document.getElementById('loading').hidden = true;
  showFatal(
    'Could not start 3D graphics',
    'Your browser refused to start WebGL. This often happens right after a graphics reset: close this tab ' +
      '(or the browser app) completely, then open the game again. Otherwise check that hardware acceleration/WebGL ' +
      `is enabled. (${err?.message ?? err})`,
  );
}
