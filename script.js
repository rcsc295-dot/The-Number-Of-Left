// Local-file and GitHub Pages entry point. No module loader or build step.
(function () {
    'use strict';
    if (typeof module !== 'undefined' && module.exports) {
        require('./js/npc-svg.js');
        require('./js/config.js');
        require('./js/math.js');
        require('./js/characters.js');
        require('./js/input.js');
        require('./js/player.js');
        require('./js/world.js');
        require('./js/encounters.js');
        require('./js/hints.js');
        require('./js/family.js');
        require('./js/recurrence.js');
        require('./js/endings.js');
        require('./js/six-seven.js');
        require('./js/rendering.js');
        require('./js/opening.js');
        require('./js/developer.js');
        require('./js/game.js');
        require('./js/interface.js');
        require('./js/controls.js');
        require('./js/game-view.js');
        require('./js/environment.js');
        require('./js/identity.js');
        require('./js/economy.js');
        require('./js/narrative.js');
        require('./js/social-events.js');
        require('./js/social-clock.js');
        require('./js/information-panel.js');
        require('./js/following.js');
        require('./js/social-graph.js');
        require('./js/world-events.js');
        module.exports = globalThis.NumberLeft;
        return;
    }
    const NL = globalThis.NumberLeft;
    NL.validateConfig(NL.CONFIG);
    const start = document.getElementById('start');
    const startLabel = start.textContent;
    start.disabled = true;
    start.textContent = 'Loading characters…';
    NL.prepareNpcArt().then(
        () => {
            start.disabled = false;
            start.textContent = startLabel;
            const game = new NL.Game();
            if (NL.CONFIG.DEBUG)
                window.numberLeftDebug = { game, CONFIG: NL.CONFIG };
        },
        (error) => {
            // Asset decoding is asynchronous: show a visible failure instead of starting with missing people.
            console.error('Character artwork could not load.', error);
            start.disabled = true;
            start.textContent = 'Artwork could not load. Please reload.';
        }
    );
})();
