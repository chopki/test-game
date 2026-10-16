import './style.css';
import { Game } from './game/Game.js';

const game = new Game(document.getElementById('app'));
// Handy for poking at the simulation from the browser console.
window.game = game;
