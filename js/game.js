// GAME — one responsibility; shared systems live on NumberLeft.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    class Game {
        constructor(c = NL.CONFIG) {
            this.c = c;
            this.canvas = document.getElementById('stage');
            this.ctx = this.canvas.getContext('2d');
            if (!this.ctx) {
                document.getElementById('hint').textContent =
                    'Canvas 2D is unavailable.';
                return;
            }
            this.input = new NL.Input();
            this.dev = new NL.DeveloperControls(this);
            this.discoveredEndings = new Set();
            this.achievementStorageMessage = '';
            try {
                const saved = JSON.parse(
                    localStorage.getItem('number-left.endings.v1') || '[]'
                );
                if (Array.isArray(saved)) {
                    this.discoveredEndings = new Set(
                        saved.filter((id) =>
                            NL.ENDING_DEFINITIONS.some((e) => e.id === id)
                        )
                    );
                    if (saved.length !== this.discoveredEndings.size)
                        localStorage.setItem(
                            'number-left.endings.v1',
                            JSON.stringify([...this.discoveredEndings])
                        );
                }
            } catch (error) {
                if (
                    !(error instanceof SyntaxError) &&
                    !(error instanceof DOMException)
                )
                    throw error;
                this.achievementStorageMessage =
                    'Saved discoveries could not be read or updated in this browser.';
            }
            this.scene = 'title';
            this.demo = null;
            this.endingReturnElapsed = 0;
            this.quote = null;
            this.world = null;
            this.ending = null;
            this.endKind = null;
            this.paused = false;
            this.panel = null;
            this.last = null;
            this.frameCount = 0;
            this.reducedMotion = matchMedia(
                '(prefers-reduced-motion: reduce)'
            ).matches;
            // DOM ELEMENTS — cached once; controls are bound once below.
            this.ui = {};
            for (const el of document.querySelectorAll('[id]')) {
                this.ui[el.id] = el;
            }
            this.ui['friend-rule'].textContent = c.FRIEND_ENCOUNTER_THRESHOLD;
            this.ui['quote-text'].textContent = c.OPENING_QUOTE;
            this.ui['quote-author'].textContent = c.OPENING_QUOTE_AUTHOR;
            this.ui['quote-source'].textContent = c.OPENING_QUOTE_SOURCE;
            this.ui['held-segments'].innerHTML = '<i></i>'.repeat(
                c.HELD_METER_SEGMENTS
            );
            this.buildControlPanel();
            this.bind();
            this.fit();
            this.syncUI();
            this.frame = this.frame.bind(this);
            requestAnimationFrame(this.frame);
        }

        get frozen() {
            return (
                this.paused ||
                this.panel === 'instructions' ||
                this.panel === 'credits'
            );
        }

        get playing() {
            return (
                this.scene === 'world' &&
                !this.frozen &&
                (!this.panel || this.panel === 'control') &&
                !this.world.endingTriggered &&
                !this.world.sixSevenProgress.pending &&
                !NL.narrativeBlocking(this.world)
            );
        }

        startQuote() {
            this.input.clear();
            this.paused = false;
            this.panel = null;
            this.quote = new NL.QuoteScene(this.c);
            this.scene = 'quote';
            this.syncUI();
            this.canvas.focus();
        }

        start() {
            if (this.scene === 'title') {
                this.startQuote();
            }
        }

        returnToTitle() {
            this.input.releaseAll();
            this.demo = null;
            this.endingReturnElapsed = 0;
            this.world = null;
            this.ending = null;
            this.quote = null;
            this.scene = 'title';
            this.endKind = null;
            this.paused = false;
            this.panel = null;
            this.dev.selectedId = null;
            this.dev.message =
                'Developer actions bypass the encounter economy.';
            this.selectSignature = null;
            this.ui.announcement.textContent = '';
            this.ui['dev-held'].value = '0';
            this.ui['dev-total'].value = '0';
            this.last = null;
            this.syncUI();
            this.ui.start.focus();
        }

        playGameplayDemo() {
            this.quote = null;
            this.demo = { time: 0 };
            this.scene = 'demo';
            this.input.clear();
            this.syncUI();
            this.canvas.focus();
        }

        skipGameplayDemo() {
            if (this.scene === 'demo' && !this.frozen && !this.panel) {
                this.beginWorld();
            }
        }

        resetGameplayState(preserveTutorial = true) {
            const history =
                preserveTutorial && this.world
                    ? new Set(this.world.hints.seen)
                    : null;
            const tutorial =
                preserveTutorial && this.world
                    ? { ...this.world.tutorial }
                    : null;
            this.input.releaseAll();
            this.world = new NL.World(this.c);
            this.informationSignature = null;
            if (history) {
                this.world.hints.seen = history;
                this.world.hints.queue = [];
                this.world.tutorial = tutorial;
            }
            this.ending = null;
            this.endKind = null;
            this.endingReturnElapsed = 0;
            this.quote = null;
            this.demo = null;
            this.paused = false;
            this.panel = null;
            this.last = null;
            this.dev.selectedId = null;
            this.dev.message =
                'Developer actions bypass the encounter economy.';
            this.selectSignature = null;
            this.ui['dev-held'].value = '0';
            this.ui['dev-total'].value = '0';
            this.ui.announcement.textContent = '';
        }

        returnDirectlyToGameplay() {
            this.resetGameplayState(true);
            this.beginWorld(true);
            return true;
        }

        beginWorld(force = false) {
            if (!force && this.scene !== 'demo') {
                return;
            }
            this.quote = null;
            this.paused = false;
            if (!this.world) {
                this.resetGameplayState(false);
            }
            this.demo = null;
            this.scene = 'world';
            this.input.clear();
            this.syncUI();
            if (!this.panel) {
                this.canvas.focus();
            }
        }

        ensureWorld() {
            if (!this.world) {
                this.beginWorld(true);
            }
            return this.world;
        }

        checkEndings() {
            const w = this.world;
            if (!w) {
                return;
            }
            NL.checkTakenEnding(w);
            NL.checkSixSevenEnding(w);
            if (
                !w.endingTriggered ||
                this.scene === 'ending' ||
                this.scene === 'end'
            ) {
                return;
            }
            this.endKind = w.endingTriggered;
            this.ending = this.endKind === 'time' ? new NL.TimeEnding(w) : null;
            this.scene = 'ending';
            this.paused = false;
            if (this.panel !== 'control') this.panel = null;
            this.input.clear();
            this.syncUI();
        }

        resetEnding(kind) {
            if (this.scene === 'ending') {
                throw new RangeError(
                    'This ending is still playing. Use Restart to begin a new playthrough.'
                );
            }
            const w = this.ensureWorld();
            if (w.endingTriggered && w.endingTriggered !== kind) {
                throw new RangeError(
                    'Reset the active ending first, or Restart.'
                );
            }
            if (kind === 'time') {
                w.player.totalTaken = 0;
                w.collectedIds.clear();
            }
            if (kind === 'family' || w.endingTriggered === 'time') {
                w.family.reset();
            }
            w.endingTriggered = null;
            w.spawningEnabled = true;
            w.player.visual.scale = 1;
            w.player.x = this.c.WIDTH / 2;
            w.player.y = NL.environment(this.c).y + 12;
            w.player.vx = w.player.vy = 0;
            w.player.moveTarget = null;
            w.sixSeven = null;
            for (const v of w.views.values()) {
                if (!v.data.permanentlyGone) {
                    v.opacity = 1;
                }
            }
            for (const d of w.population
                .filter(
                    (d) =>
                        !d.active &&
                        !d.permanentlyGone &&
                        d.lifeStatus === 'present'
                )
                .slice(
                    0,
                    Math.max(
                        0,
                        this.c.INITIAL_VISIBLE -
                            [...w.views.values()].filter(
                                (v) => v.data.kind === 'person'
                            ).length
                    )
                )) {
                w.recurrence.arrive(d, true);
            }
            this.ending = null;
            this.endKind = null;
            this.endingReturnElapsed = 0;
            this.ui['dev-held'].value = String(w.player.heldEncounters);
            this.ui['dev-total'].value = String(w.player.totalTaken);
            this.scene = 'world';
            this.quote = null;
            this.paused = false;
            this.input.clear();
            this.syncUI();
        }

        finishEnding(kind) {
            if (
                !this.world.developmentUsed &&
                !this.discoveredEndings.has(kind) &&
                NL.ENDING_DEFINITIONS.some((ending) => ending.id === kind)
            ) {
                this.discoveredEndings.add(kind);
                try {
                    localStorage.setItem(
                        'number-left.endings.v1',
                        JSON.stringify([...this.discoveredEndings])
                    );
                    this.achievementStorageMessage = '';
                } catch (error) {
                    if (!(error instanceof DOMException)) throw error;
                    this.achievementStorageMessage =
                        'Discoveries remain for this session, but could not be saved in this browser.';
                }
            }
            this.scene = 'end';
            this.endKind = kind;
            this.endingReturnElapsed = 0;
            this.input.clear();
            this.syncUI();
        }

        endingFade() {
            return NL.smooth(
                (this.endingReturnElapsed - this.c.ENDING_RETURN.HOLD_SECONDS) /
                    this.c.ENDING_RETURN.FADE_SECONDS
            );
        }

        setPaused(value) {
            if (
                !['world', 'quote', 'demo', 'ending', 'end'].includes(
                    this.scene
                )
            ) {
                return;
            }
            this.paused = value;
            if (value) {
                this.stopClickMovement();
            }
            this.input.clear();
            this.syncUI();
            if (!this.panel) {
                (value ? this.ui.resume : this.canvas).focus();
            }
        }

        showPanel(name) {
            const liveToggle =
                name === 'control' && (!this.panel || this.panel === 'control');
            if (!liveToggle) {
                this.stopClickMovement();
                this.input.releaseAll();
            }
            this.panel = this.panel === name ? null : name;
            this.syncUI();
            if (this.panel) {
                this.ui[`${this.panel}-panel`].querySelector('button').focus();
            } else {
                this.canvas.focus();
            }
        }

        update(dt) {
            if (this.frozen) {
                this.input.endFrame();
                return;
            }
            if (this.scene === 'quote') {
                this.quote.update(dt);
                if (this.quote.time >= this.quote.duration) {
                    this.playGameplayDemo();
                }
            } else if (this.scene === 'demo') {
                this.input.clear();
                this.demo.time += dt;
                if (this.demo.time >= this.c.DEMO_SECONDS) {
                    this.beginWorld();
                }
            } else if (this.scene === 'world') {
                if (!this.playing) {
                    this.input.clear();
                }
                this.updateSpawnAreas();
                this.world.update(
                    dt,
                    this.input,
                    0,
                    !this.panel || this.panel === 'control'
                );
                const signal = this.world.actionSignal;
                if (signal) {
                    this.ui.announcement.textContent = `${signal.action}. ${signal.data.encountersLeft} left. ${this.world.player.heldEncounters} held.`;
                }
                if (!this.panel || this.panel === 'control') {
                    NL.updateContextHints(this.world, dt);
                    NL.updateFamilyWarning(this.world, dt);
                }
                NL.updateNarrativePresentation(this.world, dt);
                this.checkEndings();
            } else if (this.scene === 'ending') {
                this.input.clear();
                if (this.endKind === 'family') {
                    this.world.family.update(dt);
                    if (this.world.family.event === 'complete') {
                        this.finishEnding('family');
                    }
                } else if (this.endKind === 'six-seven') {
                    if (NL.updateSixSevenEnding(this.world, dt)) {
                        this.finishEnding('six-seven');
                    }
                } else if (this.endKind === 'time') {
                    this.ending.update(dt);
                    if (this.ending.complete) {
                        this.finishEnding('time');
                    }
                }
            } else if (this.scene === 'end') {
                this.input.clear();
                const timing = this.c.ENDING_RETURN;
                // Finish the visual fade, then retain this World until an explicit Restart / New Game.
                this.endingReturnElapsed = Math.min(
                    this.endingReturnElapsed + dt,
                    timing.HOLD_SECONDS + timing.FADE_SECONDS
                );
            }
            this.input.endFrame();
        }

        frame(timestamp) {
            const dt =
                this.last === null
                    ? 0
                    : Math.min(
                          this.c.MAX_DELTA,
                          Math.max(0, (timestamp - this.last) / 1000)
                      );
            this.last = timestamp;
            this.frameCount++;
            this.update(dt);
            this.render();
            requestAnimationFrame(this.frame);
        }
    }
    Object.assign(NL, { Game });
})();
