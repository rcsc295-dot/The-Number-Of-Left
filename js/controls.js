// CONTROLS — one responsibility; shared systems live on NumberLeft.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});

    Object.assign(NL.Game.prototype, {
        moveToClick(event) {
            if (!this.playing || event.button !== 0) {
                return;
            }
            const rectangle = this.canvas.getBoundingClientRect();
            const x =
                (event.clientX - rectangle.left - this.offsetX) / this.scale;
            const y =
                (event.clientY - rectangle.top - this.offsetY) / this.scale;
            const place = this.world.places.markers.find(
                (p) => Math.hypot(p.x - x, p.y - y) < 30
            );
            if (place) {
                NL.openPlace(this.world, place.id);
                this.input.clear();
                return;
            }
            const bounds = this.world.bounds;
            if (
                x < bounds.left ||
                x > bounds.right ||
                y < bounds.top ||
                y > bounds.bottom
            ) {
                return;
            }
            this.world.player.moveTarget = NL.keepInEnvironment(this.world, {
                x,
                y
            });
            this.canvas.focus();
        },

        stopClickMovement() {
            if (this.world) {
                this.world.player.moveTarget = null;
                this.world.player.vx = 0;
                this.world.player.vy = 0;
            }
        },

        bind() {
            NL.bindInformationPanel(this);
            this.ui['environment-actions'].onclick = (event) => {
                const button = event.target.closest('[data-place]');
                if (button && this.playing)
                    NL.openPlace(this.world, button.dataset.place);
            };
            this.ui.start.onclick = () => this.start();
            this.ui['open-achievements'].onclick = () => {
                this.scene = 'achievements';
                this.syncUI();
                this.ui['achievements-title'].focus();
            };
            this.ui['achievements-home'].onclick = () => {
                this.returnToTitle();
                this.ui['open-achievements'].focus();
            };
            this.ui['context-close'].onclick = () => {
                if (this.world) {
                    this.world.hints.current = null;
                    this.world.hints.time = 0;
                }
                this.canvas.focus();
            };
            this.ui['quote-screen'].onclick = () => {
                if (this.scene === 'quote' && !this.frozen && !this.panel) {
                    this.quote.skip();
                }
            };
            this.ui['restart-pause'].onclick = () =>
                this.returnDirectlyToGameplay();
            this.ui['demo-skip'].onclick = () => this.skipGameplayDemo();
            this.ui['home-pause'].onclick = () => this.returnToTitle();
            this.ui['restart-end'].onclick = () =>
                this.returnDirectlyToGameplay();
            this.ui['home-end'].onclick = () => this.returnToTitle();
            this.ui.resume.onclick = () => this.setPaused(false);
            this.ui.pause.onclick = () => this.setPaused(!this.paused);
            for (const button of document.querySelectorAll('[data-panel]')) {
                button.onclick = () => this.showPanel(button.dataset.panel);
            }
            for (const button of document.querySelectorAll(
                '[data-close-panel]'
            )) {
                button.onclick = () => {
                    if (this.panel !== 'control') this.input.releaseAll();
                    this.panel = null;
                    this.syncUI();
                    (this.paused ? this.ui.resume : this.canvas).focus();
                };
            }
            this.ui['control-sections'].addEventListener('click', (e) => {
                const button = e.target.closest('[data-dev]');
                if (button) {
                    this.dev.run(button.dataset.dev);
                    this.refreshPanels();
                }
            });
            this.ui['selected-person'].onchange = (e) => {
                this.dev.selectedId = e.target.value || null;
                this.refreshPanels();
            };
            this.canvas.addEventListener('pointerdown', (event) =>
                this.moveToClick(event)
            );
            addEventListener('resize', () => this.fit());
            addEventListener('keydown', (e) => this.keyDown(e));
            addEventListener('keyup', (e) => this.input.up(e.code));
            addEventListener('blur', () => {
                this.input.releaseAll();
                this.setPaused(true);
            });
            document.addEventListener('visibilitychange', () => {
                this.last = null;
                if (document.hidden) {
                    this.input.releaseAll();
                    this.setPaused(true);
                }
            });
        },

        keyDown(e) {
            if (e.code === 'Space') {
                e.preventDefault();
                return;
            }
            if (e.code === 'Tab' && (this.panel || this.paused)) {
                this.trapFocus(e);
                return;
            }
            const native = e.target.closest?.('button,a,input,select,summary');
            const gameplayKeys =
                !native ||
                (this.panel === 'control' &&
                    !e.target.closest?.('input,select,textarea'));
            if (
                this.playing &&
                gameplayKeys &&
                [
                    'KeyW',
                    'KeyA',
                    'KeyS',
                    'KeyD',
                    'ArrowUp',
                    'ArrowLeft',
                    'ArrowDown',
                    'ArrowRight'
                ].includes(e.code)
            ) {
                this.world.player.moveTarget = null;
            }
            if (gameplayKeys && e.code.startsWith('Arrow')) {
                e.preventDefault();
            }
            if (
                !this.input.down(e.code, e.repeat, this.playing && gameplayKeys)
            ) {
                return;
            }
            if (
                this.scene === 'quote' &&
                !this.frozen &&
                !this.panel &&
                !native &&
                e.code === 'Enter'
            ) {
                this.quote.skip();
            }
            if (this.scene === 'demo' && !native && e.code === 'Enter') {
                this.skipGameplayDemo();
            }
            if (e.code === 'Escape') {
                if (this.panel) {
                    if (this.panel !== 'control') this.input.releaseAll();
                    this.panel = null;
                    this.syncUI();
                    (this.paused ? this.ui.resume : this.canvas).focus();
                } else {
                    this.setPaused(!this.paused);
                }
            }
        },

        trapFocus(e) {
            const panel = this.panel
                ? this.ui[`${this.panel}-panel`]
                : this.ui['pause-screen'];
            const items = [
                ...panel.querySelectorAll('button,a,input,select,summary')
            ].filter((el) => el.getClientRects().length && !el.disabled);
            if (!this.ui.control.hidden) {
                items.push(this.ui.control);
            }
            if (!this.ui.pause.hidden && !this.ui['game-header'].hidden) {
                items.push(this.ui.pause);
            }
            const index = items.indexOf(document.activeElement);
            e.preventDefault();
            items[
                (index + (e.shiftKey ? -1 : 1) + items.length) % items.length
            ].focus();
        }
    });
})();
