import './style.css';
import { Game } from './game/Game.js';

// Show failures on screen rather than leaving a blank page.
function showFatal(title, err) {
  console.error(err);
  document.getElementById('error-title').textContent = title;
  document.getElementById('error-message').textContent = String(err?.message ?? err);
  document.getElementById('error').hidden = false;
}

window.addEventListener('error', (e) => showFatal('The game hit an error', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => showFatal('The game hit an error', e.reason));

try {
  // Handy for poking at the simulation from the browser console.
  window.game = new Game(document.getElementById('app'));
} catch (err) {
  showFatal('Could not start the game (WebGL 2 is required)', err);
}
