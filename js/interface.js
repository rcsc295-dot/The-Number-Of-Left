// INTERFACE — one responsibility; shared systems live on NumberLeft.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    function relationshipRows(world) {
        return world.population
            .filter((data) => data.relationship === 'FRIEND')
            .map(
                (data) =>
                    `<tr><td>${data.name}<small>${data.traits.join(' · ')}</small><details><summary>SELF PROFILE</summary><p>${data.selfProfile}</p></details></td><td>${NL.isBloodRelative(data) ? 'BLOOD RELATIVE' : data.relationship}<small>${data.lifeStatus === 'present' ? data.relationshipState : data.lifeStatus === 'closed' ? 'Permanently absent' : 'Departed · reunion possible'} · ${Math.round(data.strength)}/100</small>${NL.isBloodRelative(data) ? '<small>' + NL.familyAvailabilityLabel(data) + '</small>' : ''}</td><td>${data.encountersLeft.toLocaleString('en-US')}</td><td>${data.giftedEncounters}</td><td>${data.timesMet}</td></tr>`
            )
            .join('');
    }

    Object.assign(NL.Game.prototype, {
        fit() {
            this.dpr = Math.min(devicePixelRatio || 1, this.c.MAX_DPR);
            this.canvas.width = Math.round(innerWidth * this.dpr);
            // Short windows scroll the composed scene instead of crushing the TV's choice buttons.
            this.viewportHeight = Math.max(innerHeight, 700);
            this.canvas.height = Math.round(this.viewportHeight * this.dpr);
            this.scale = Math.min(
                innerWidth / this.c.WIDTH,
                this.viewportHeight / this.c.HEIGHT
            );
            this.offsetX = (innerWidth - this.c.WIDTH * this.scale) / 2;
            this.offsetY =
                (this.viewportHeight - this.c.HEIGHT * this.scale) / 2;
            const landscape = NL.environment(this.c);
            document.documentElement.style.setProperty(
                '--world-top',
                `${this.offsetY + (landscape.y - landscape.ry) * this.scale}px`
            );
            document.documentElement.style.setProperty(
                '--world-scale',
                this.scale
            );
        },

        updateSpawnAreas() {
            if (!this.world) {
                return;
            }
            const canvasRect = this.canvas.getBoundingClientRect();
            this.world.spawnAvoidAreas = [
                ...document.querySelectorAll(
                    '.panel:not([hidden]), #game-header:not([hidden]), #held-meter:not([hidden]), #context-hint:not([hidden]), #nearby-controls:not([hidden]), #family-warning:not([hidden]), #information-panel:not([hidden])'
                )
            ].map((el) => {
                const r = el.getBoundingClientRect();
                return {
                    left:
                        (r.left - canvasRect.left - this.offsetX) / this.scale,
                    right:
                        (r.right - canvasRect.left - this.offsetX) / this.scale,
                    top: (r.top - canvasRect.top - this.offsetY) / this.scale,
                    bottom:
                        (r.bottom - canvasRect.top - this.offsetY) / this.scale
                };
            });
        },

        buildControlPanel() {
            this.ui['developer-controls'].hidden = false;
            this.ui['control-sections'].innerHTML = NL.CONTROL_SECTIONS.map(
                ([title, actions]) =>
                    title === 'ENDINGS'
                        ? `<section class="control-endings"><h3>ENDINGS</h3><div class="control-grid">${actions.map(([action, label]) => `<button data-dev="${action}">${label}</button>`).join('')}</div></section>`
                        : `<details name="control-section" data-section="${title}"><summary>${title}</summary>${title === 'Player & world' ? '<div class="control-inputs"><label>Held<input id="dev-held" type="number" min="0" step="1" value="0"></label><label>Total taken<input id="dev-total" type="number" min="0" step="1" value="0"></label></div>' : ''}<div class="control-grid">${actions.map(([action, label]) => `<button data-dev="${action}">${label}</button>`).join('')}</div></details>`
            ).join('');
            this.ui['control-sections']
                .querySelector('[data-section="People"] summary')
                .after(this.ui['character-selection']);
            this.ui['dev-held'] = document.getElementById('dev-held');
            this.ui['dev-total'] = document.getElementById('dev-total');
        },

        syncUI() {
            const endings = NL.ENDING_DEFINITIONS;
            this.ui['achievement-count'].textContent =
                `ENDINGS DISCOVERED: ${this.discoveredEndings.size} / ${endings.length}`;
            this.ui['achievement-locked'].textContent =
                `UNDISCOVERED: ${endings.length - this.discoveredEndings.size}`;
            this.ui['achievement-list'].replaceChildren(
                ...endings.map((ending) => {
                    const item = document.createElement('li');
                    const unlocked = this.discoveredEndings.has(ending.id);
                    item.dataset.unlocked = String(unlocked);
                    item.innerHTML = `<span class="achievement-icon ${ending.icon}" aria-hidden="true"></span><div><h3>${unlocked ? ending.name : '???'}</h3><p>${ending.hint}</p></div><span class="achievement-status">${unlocked ? 'UNLOCKED' : 'LOCKED'}</span>`;
                    return item;
                })
            );
            this.ui['achievement-storage'].textContent =
                this.achievementStorageMessage;
            this.ui['achievement-storage'].hidden =
                !this.achievementStorageMessage;
            this.ui['achievements-screen'].hidden =
                this.scene !== 'achievements';
            this.ui['title-screen'].hidden =
                this.scene !== 'title' &&
                !(
                    this.scene === 'quote' &&
                    this.quote.time < this.c.QUOTE.LANDING_FADE
                );
            this.ui['title-screen'].style.opacity =
                this.scene === 'quote'
                    ? 1 - NL.smooth(this.quote.time / this.c.QUOTE.LANDING_FADE)
                    : 1;
            this.ui['quote-screen'].hidden = this.scene !== 'quote';
            this.ui['demo-controls'].hidden =
                this.scene !== 'demo' || this.frozen || !!this.panel;
            this.ui['family-warning'].hidden = true;
            this.ui['game-header'].hidden = !this.world;
            this.ui['game-footer'].hidden = !this.world;
            this.ui.control.hidden = !this.world;
            this.ui['end-screen'].hidden = this.scene !== 'end';
            this.ui['pause-screen'].hidden = !this.paused || !!this.panel;
            for (const name of [
                'control',
                'instructions',
                'relationships',
                'credits'
            ]) {
                this.ui[`${name}-panel`].hidden = this.panel !== name;
            }
            this.ui.wordmark.hidden = ['title', 'achievements', 'end'].includes(
                this.scene
            );
            this.ui.pause.hidden = ![
                'world',
                'quote',
                'demo',
                'ending',
                'end'
            ].includes(this.scene);
            this.ui.relationships.hidden = !this.world;
            this.ui.pause.textContent = this.paused ? '▶' : '⏸';
            this.ui.pause.setAttribute(
                'aria-label',
                this.paused ? 'Resume' : 'Pause'
            );
            this.ui.pause.setAttribute('aria-pressed', String(this.paused));
            this.ui.pause.title = this.paused ? 'Resume (Esc)' : 'Pause (Esc)';
            this.ui.control.setAttribute(
                'aria-expanded',
                String(this.panel === 'control')
            );
            this.ui['held-meter'].hidden = this.scene !== 'world';
            this.ui['footer-note'].textContent =
                this.scene === 'world'
                    ? 'J take · K give'
                    : 'Version 2.3 · playable test build';
            this.ui['end-screen'].className =
                `overlay ending-${this.endKind || ''}`;
            this.ui['end-title'].innerHTML =
                this.endKind === 'family'
                    ? 'Father and Mother,<br>I love you.'
                    : this.endKind === 'time'
                      ? 'I Am the Universe'
                      : 'The Number Left';
            if (this.endKind === 'six-seven') {
                this.ui['end-title'].textContent = '6 7';
            }
            this.ui['end-caption'].textContent = ['time', 'six-seven'].includes(
                this.endKind
            )
                ? ''
                : 'The Number Left';
            this.ui['context-hint'].hidden =
                !this.playing || !this.world?.hints.current;
            this.ui['nearby-controls'].hidden = true;
            this.ui['information-panel'].hidden = this.scene !== 'world';
            this.ui['title-screen'].inert =
                !!this.panel || this.scene !== 'title';
            this.ui['quote-screen'].inert = !!this.panel || this.paused;
            this.ui['end-screen'].inert = !!this.panel;
            this.refreshPanels();
        },

        refreshPanels() {
            const w = this.world;
            if (this.panel === 'relationships') {
                const rows = w ? relationshipRows(w) : '';
                // No graph traversal, and preserve the table DOM while its displayed facts are unchanged.
                if (this.relationshipMarkup !== rows) {
                    this.ui['relationship-rows'].innerHTML = rows;
                    this.ui['relationship-empty'].hidden = !!rows;
                    this.relationshipMarkup = rows;
                }
            }
            if (this.panel !== 'control') {
                return;
            }
            const records = w ? [...w.population, ...w.family.letters] : [];
            const signature = records.map((d) => d.id).join('|');
            if (this.selectSignature !== signature) {
                this.ui['selected-person'].innerHTML =
                    '<option value="">Select a person or letter</option>' +
                    records
                        .map(
                            (d) =>
                                `<option value="${d.id}">${d.kind === 'letter' ? d.letter + ' · letter' : d.name}</option>`
                        )
                        .join('');
                this.selectSignature = signature;
            }
            this.ui['selected-person'].value = this.dev.selectedId || '';
            const d = w && this.dev.selected(w);
            this.ui['selected-info'].textContent = d
                ? `${d.name || d.letter} · ${d.encountersLeft} left · ${d.giftedEncounters} gifted\n${NL.isBloodRelative(d) ? 'BLOOD RELATIVE' : d.relationship || d.state} · ${d.permanentlyGone ? 'permanently absent' : NL.isBloodRelative(d) ? NL.familyAvailabilityLabel(d) : d.active ? 'here' : 'away'}`
                : 'No selected character.';
            this.ui['control-status'].textContent = this.dev.message;
            this.ui['control-world'].textContent = w
                ? `${w.time.toFixed(1)}s · ${[...w.views.values()].filter((v) => v.data.kind === 'person').length} here · ${w.player.heldEncounters} held · ${this.paused ? 'paused' : 'live'}`
                : 'No world yet. A world action starts one.';
        },

        updateHUD() {
            NL.renderInformationPanel(this);
            const w = this.world;
            const nearby = this.playing && w.selected;
            this.ui['nearby-controls'].hidden = !nearby;
            if (nearby) {
                const x = this.offsetX + w.selected.x * this.scale;
                const y = this.offsetY + (w.selected.y + 20) * this.scale;
                this.ui['nearby-controls'].style.left =
                    `${NL.clamp(x, 90, innerWidth - 90)}px`;
                this.ui['nearby-controls'].style.top =
                    `${NL.clamp(y, 70, innerHeight - 100)}px`;
                const canTake = NL.canTakeFrom(w.selected.data);
                this.ui['nearby-take'].textContent = canTake
                    ? 'J · Take'
                    : 'J · Protected';
                this.ui['nearby-take'].classList.toggle(
                    'unavailable',
                    !canTake
                );
                this.ui['nearby-give'].classList.toggle(
                    'unavailable',
                    w.player.heldEncounters === 0
                );
            }
            this.ui.hint.textContent = '';
            if (w) {
                const value = w.player.heldEncounters;
                const meter = NL.heldMeterValues(value, this.c);
                this.ui['held-number'].textContent = value;
                this.ui['held-meter'].setAttribute(
                    'aria-label',
                    `${value} encounters held`
                );
                this.ui['held-unit'].textContent =
                    meter.unit === 1 ? '' : `each mark = ${meter.unit}`;
                [...this.ui['held-segments'].children].forEach((el, i) =>
                    el.style.setProperty('--fill', `${meter.fills[i] * 100}%`)
                );
                const pulse = Math.sin(
                    (Math.PI * w.meterPulse.time) / this.c.METER_PULSE_SECONDS
                );
                const direction = w.meterPulse.direction === 'take' ? -1 : 1;
                this.ui['held-meter'].dataset.direction =
                    w.meterPulse.time > 0 ? w.meterPulse.direction : '';
                this.ui['held-segments'].style.transform = this.reducedMotion
                    ? ''
                    : `translateY(${direction * pulse * 3}px)`;
            }
            const warning = w?.familyWarning;
            const showWarning = this.playing && warning?.active;
            this.ui['family-warning'].hidden = !showWarning;
            if (showWarning) {
                this.ui['family-warning'].style.opacity =
                    NL.familyWarningOpacity(w);
            }
            const h = w?.hints;
            const showHint = this.playing && h?.current;
            this.ui['context-hint'].hidden = !showHint;
            if (showHint) {
                const message = NL.CONTEXT_HINTS[h.current];
                if (this.ui['context-text'].textContent !== message) {
                    this.ui['context-text'].textContent = message;
                }
                this.ui['context-hint'].style.opacity = Math.min(
                    NL.smooth(h.time / 0.3),
                    NL.smooth((this.c.CONTEXT_HINT_DURATION - h.time) / 0.5)
                );
            }
            this.ui.debug.hidden = !this.c.DEBUG || !w;
            if (this.c.DEBUG && w && this.frameCount % 15 === 0) {
                this.ui.debug.textContent = w.population
                    .map(
                        (d) =>
                            `${d.id} ${d.encountersLeft} left / ${d.giftedEncounters} gifts / ${d.relationship}`
                    )
                    .join('\n');
            }
            if (this.panel && this.frameCount % 12 === 0) {
                this.refreshPanels();
            }
        }
    });
    Object.assign(NL, { relationshipRows });
})();
