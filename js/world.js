// WORLD — one responsibility; shared systems live on NumberLeft.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    class World {
        constructor(c = NL.CONFIG, rng = Math.random) {
            this.c = c;
            this.rng = rng;
            this.time = 0;
            this.bounds = NL.worldBounds(c);
            this.population = NL.createPopulation(rng, c);
            const initialPeople = this.population
                .filter((d) => !d.template && !d.briefEncounter)
                .slice(0, Math.min(c.INITIAL_VISIBLE, c.NPC_COUNT));
            // Set starting values before the economy creates their opportunity tokens.
            for (const d of initialPeople)
                d.initialEncounters = d.encountersLeft = 1;
            this.views = new Map();
            this.drawList = [];
            this.player = new NL.Player(c);
            NL.initializeEconomy(this);
            NL.initializeSocialClock(this);
            NL.initializeSocialIdentities(this);
            NL.initializeSocialGraph(this);
            NL.initializeTelevision(this);
            NL.initializePlaces(this);
            NL.resetSixSevenProgress(this);
            this.meetings = 0;
            this.returns = 0;
            this.endingTriggered = null;
            this.spawningEnabled = true;
            this.sixSeven = null;
            this.familyWarning = { active: false, time: 0 };
            this.spawnAvoidAreas = [];
            this.hints = { seen: new Set(), queue: [], current: null, time: 0 };
            this.meterPulse = { direction: null, time: 0 };
            this.cooldowns = { take: 0, give: 0 };
            this.lastActivity = 0;
            this.selected = null;
            this.actionSignal = null;
            this.actionCount = 0;
            this.tutorial = { moved: false, met: false };
            this.revision = 0;
            this.recurrence = new NL.RecurrenceSystem(this);
            for (const d of this.population) {
                d.nextReturnAt = NL.isBloodRelative(d)
                    ? c.FIRST_BLOOD_RELATIVE_DELAY / 1000
                    : Math.max(
                          c.INITIAL_ORDINARY_ONLY_DURATION / 1000,
                          NL.range(rng, [
                              c.RETURN_MIN_DELAY,
                              c.RETURN_MAX_DELAY
                          ])
                      );
            }
            for (const d of initialPeople) {
                this.recurrence.arrive(d, true);
            }
            const first = this.views.values().next().value;
            if (first) first.pauseLeft = 5;
            this.family = new NL.FamilySystem(this);
            NL.queueContextHint(this, 'move');
        }

        randomTarget(v) {
            const target = NL.openWorldPosition(
                this,
                this.c.PERSONAL_SPACE,
                v
            ) || {
                x: v.x,
                y: v.y
            };
            v.tx = target.x;
            v.ty = target.y;
            v.turnIn = NL.range(this.rng, this.c.WALK_TURN);
        }

        nearest() {
            let best = null;
            let radius = this.c.INTERACTION_RADIUS;
            for (const v of this.views.values()) {
                if (
                    v.state !== 'present' ||
                    v.data.permanentlyGone ||
                    v.data.encountersLeft <= 0
                ) {
                    continue;
                }
                const d = NL.distance(v, this.player);
                if (d <= radius) {
                    best = v;
                    radius = d;
                }
            }
            return best;
        }

        get goneCount() {
            let n = 0;
            for (const d of this.population) {
                if (d.permanentlyGone) {
                    n++;
                }
            }
            return n;
        }

        update(dt, input, quiet = 0, runEvents = true) {
            this.actionSignal = null;
            if (this.endingTriggered) {
                return;
            }
            this.time += dt;
            NL.updateTelevision(this, dt);
            this.meterPulse.time = Math.max(0, this.meterPulse.time - dt);
            for (const key of ['take', 'give']) {
                this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);
            }
            this.player.update(dt, input, false, this);
            this.selected = this.nearest();
            if (this.selected?.data.kind === 'person') {
                NL.queueContextHint(this, 'approach');
            }
            NL.updateSixSevenDiscovery(this, 0);
            // Resolve every queued edge against one target. A final action cannot spill to a neighbour.
            for (const action of input.actions) {
                ({ take: NL.takeEncounter, give: NL.giveEncounter })[action](
                    this,
                    this.selected
                );
            }
            if (this.endingTriggered) {
                return;
            }
            this.recurrence.update(dt, quiet);
            this.family.updateSpawns();
            for (const v of this.views.values()) {
                this.updateCharacter(v, dt);
                if (v.walk) NL.updateWalkAnimation(v, dt);
            }
            this.separateCharacters(dt);
            this.family.updateFollowers(dt);
            NL.separateWorld(this);
            NL.updateDepartures(this, dt);
            NL.updateMeetings(this, dt);
            this.family.checkUnlocks();
            this.selected = this.nearest();
            NL.updateSixSevenDiscovery(this, dt);
            NL.checkSixSevenEnding(this);
            if (runEvents && !this.endingTriggered)
                NL.updateSocialClock(this, dt);
        }

        // NPC MOVEMENT
        updateCharacter(v, dt) {
            const d = v.data;
            const c = this.c;
            if (v.state === 'farewell') return;
            v.feedback = Math.max(0, v.feedback - dt);
            v.moving = false;
            if (v.state === 'final') {
                v.finalElapsed += dt;
                v.opacity =
                    1 -
                    NL.clamp(
                        (v.finalElapsed - (d.briefEncounter
                            ? c.BRIEF_ENCOUNTERS.FINAL_HOLD
                            : c.FINAL_HOLD)) / c.FINAL_FADE,
                        0,
                        1
                    );
                if (v.opacity <= 0) {
                    d.active = false;
                    this.views.delete(d.id);
                }
                return;
            }
            if (d.kind === 'letter') {
                if (d.state === 'WANDERING') {
                    NL.updateLetterMovement(this, v, dt);
                }
                return;
            }
            NL.updateAppearance(v, c, dt);
            v.pauseLeft = Math.max(0, v.pauseLeft - dt);
            if (v.state === 'present' && NL.updateFollower(this, v, dt)) return;
            if (v.state === 'present') {
                if (!d.briefEncounter) v.visitLeft -= dt;
                if (v.visitLeft <= 0 && v.pauseLeft <= 0) {
                    this.recurrence.depart(v);
                }
            }
            if (v.pauseLeft > 0) {
                return;
            }
            v.sitting = false;
            if (v.state === 'present') {
                if (v.waitingTarget) {
                    v.tx = v.waitingTarget.x;
                    v.ty = v.waitingTarget.y;
                    if (Math.hypot(v.tx - v.x, v.ty - v.y) <= 1) return;
                } else {
                    v.turnIn -= dt;
                    if (v.turnIn <= 0 || Math.hypot(v.tx - v.x, v.ty - v.y) < 7) {
                        this.randomTarget(v);
                        if (
                            v.visual.movementStyle === 'rest' &&
                            this.rng() < c.SPECIAL.IDLE_CHANCE
                        ) {
                            v.pauseLeft = NL.range(
                                this.rng,
                                c.SPECIAL.IDLE_SECONDS
                            );
                            v.sitting = true;
                            return;
                        }
                    }
                    applyCharacterBehaviour(this, v);
                    NL.updateStoryMotion(this, v, dt);
                }
            }
            let speed = v.speed;
            if (v.visual.movementStyle === 'slow') {
                speed *= c.SPECIAL.SLOW;
            }
            if (v.visual.movementStyle === 'quick') {
                speed *= c.SPECIAL.QUICK;
            }
            if (v.state !== 'present') {
                speed = c.RETURN.EDGE_SPEED;
            }
            const dx = v.tx - v.x;
            const dy = v.ty - v.y;
            const length = Math.hypot(dx, dy);
            if (length > 1) {
                const travel = Math.min(speed * dt, length);
                v.x += (dx / length) * travel;
                v.y += (dy / length) * travel;
                v.step += travel * 0.2;
                v.moving = travel > 0.01;
            }
            if (v.state === 'present') NL.keepInEnvironment(this, v);
            if (
                v.state === 'entering' &&
                v.x >= this.bounds.left &&
                v.x <= this.bounds.right
            ) {
                v.state = 'present';
            }
            if (
                v.state === 'leaving' &&
                (v.x <= this.bounds.left - c.RETURN.MARGIN + 1 ||
                    v.x >= this.bounds.right + c.RETURN.MARGIN - 1)
            ) {
                this.recurrence.finishDeparture(v);
            }
        }

        separateCharacters(dt) {
            // Soft personal space is visual only. No collision event changes history.
            this.drawList.length = 0;
            for (const v of this.views.values()) {
                if (v.state === 'present' && v.data.kind === 'person') {
                    this.drawList.push(v);
                }
            }
            for (let i = 0; i < this.drawList.length; i++) {
                for (let j = i + 1; j < this.drawList.length; j++) {
                    const a = this.drawList[i];
                    const b = this.drawList[j];
                    const d = NL.distance(a, b);
                    if (d >= this.c.PERSONAL_SPACE) {
                        continue;
                    }
                    const nx = d > 0.01 ? (a.x - b.x) / d : 1;
                    const ny = d > 0.01 ? (a.y - b.y) / d : 0;
                    const push =
                        (this.c.PERSONAL_SPACE - d) * Math.min(dt * 3, 0.5);
                    {
                        a.x = NL.clamp(
                            a.x + nx * push,
                            this.bounds.left,
                            this.bounds.right
                        );
                        a.y = NL.clamp(
                            a.y + ny * push,
                            this.bounds.top,
                            this.bounds.bottom
                        );
                    }
                    {
                        b.x = NL.clamp(
                            b.x - nx * push,
                            this.bounds.left,
                            this.bounds.right
                        );
                        b.y = NL.clamp(
                            b.y - ny * push,
                            this.bounds.top,
                            this.bounds.bottom
                        );
                    }
                }
            }
        }
    }

    function applyCharacterBehaviour(world, v) {
        const style = v.visual.movementStyle;
        const p = world.player;
        const c = world.c;
        if (
            style === 'slow' &&
            NL.distance(p, v) < 75 &&
            v.data.recognitionLevel >= 5
        ) {
            v.tx = v.x;
            v.ty = v.y;
        }
        if (style === 'quick') {
            for (const other of world.views.values()) {
                if (
                    other !== v &&
                    other.state === 'present' &&
                    NL.distance(v, other) < 95 &&
                    NL.distance(v, other) > c.SPECIAL.FOLLOW_GAP
                ) {
                    v.tx = other.x;
                    v.ty = other.y;
                    break;
                }
            }
        }
        // Deliberate avoidance requires a recorded story state; ordinary approach is never an escape signal.
        if (
            v.data.behaviour === 'story-avoid' &&
            NL.distance(p, v) < c.SPECIAL.AVOID_RADIUS
        ) {
            v.tx = NL.clamp(
                v.x + (v.x - p.x),
                world.bounds.left,
                world.bounds.right
            );
            v.ty = NL.clamp(
                v.y + (v.y - p.y),
                world.bounds.top,
                world.bounds.bottom
            );
        }
    }
    Object.assign(NL, { World, applyCharacterBehaviour });
})();
