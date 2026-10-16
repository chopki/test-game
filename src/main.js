import './style.css';
import { Game } from './game/Game.js';
import { loadSprites } from './render/spriteAssets.js';

// Show failures on screen rather than leaving a blank page.
function showFatal(title, err) {
  console.error(err);
  document.getElementById('error-title').textContent = title;
  document.getElementById('error-message').textContent = typeof err === 'string' ? err : String(err?.message ?? err);
  document.getElementById('error').hidden = false;
}

window.addEventListener('error', (e) => showFatal('The game hit an error', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => showFatal('The game hit an error', e.reason));

try {
  const atlas = await loadSprites();
  // Handy for poking at the simulation from the browser console.
  window.game = new Game(document.getElementById('app'), atlas);
  document.getElementById('loading').hidden = true;
} catch (err) {
  document.getElementById('loading').hidden = true;
  showFatal(
    'Could not start 3D graphics',
    'Your browser refused to start WebGL. This often happens right after a graphics reset: close this tab ' +
      '(or the browser app) completely, then open the game again. Otherwise check that hardware acceleration/WebGL ' +
      `is enabled. (${err?.message ?? err})`,
  );
}
