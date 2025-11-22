import { Game } from './game.js';

let selectedHero = null;
const game = new Game();

function init() {
    // Expose functions to window for HTML onclick (or we could attach listeners here)
    window.selectHero = selectHero;
    window.lockIn = lockIn;
}

function selectHero(heroId) {
    selectedHero = heroId;
    
    // Update UI
    document.querySelectorAll('.hero-card').forEach(card => {
        card.classList.remove('selected');
        if (card.dataset.hero === heroId) {
            card.classList.add('selected');
        }
    });
}

function lockIn() {
    if (!selectedHero) {
        alert("Please select a hero!");
        return;
    }
    
    // Hide UI
    document.getElementById('char-select-screen').style.display = 'none';
    
    // Start Game
    game.start(selectedHero);
}

function resumeGame() {
    game.togglePause();
}

// Expose resume
window.resumeGame = resumeGame;

// Start the application
init();