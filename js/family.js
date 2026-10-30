// FAMILY — one responsibility; shared systems live on NumberLeft.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    class LetterData {
        constructor(letter, c) {
            this.kind = 'letter';
            this.canTake = false;
            this.letter = letter;
            this.id = `letter-${letter}`;
            this.initialEncounters =
                c.FAMILY_INITIAL_ENCOUNTERS === 7
                    ? 6
                    : c.FAMILY_INITIAL_ENCOUNTERS;
            this.encountersLeft = this.initialEncounters;
            this.giftedEncounters = 0;
            this.takenEncounters = 0;
            this.timesMet = 0;
            this.recognitionPoints = 0;
            this.recognitionLevel = 0;
            this.visualStage = 0;
            this.returnWeight = 0;
            this.relationship = null;
            this.storyState = 'letter';
            this.specialType = 'FAMILY';
            this.active = true;
            this.permanentlyGone = false;
            this.state = 'WANDERING';
            this.activated = false;
        }
    }

    const FAMILY_LETTERS = 'FAMILY';

    function letterBounds(world) {
        const e = NL.environment(world.c);
        const safe = {
            left: e.x - e.rx + 35,
            right: e.x + e.rx - 35,
            top: e.y - e.ry + 60,
            bottom: e.y + e.ry - 24
        };
        if (safe.right <= safe.left || safe.bottom <= safe.top) {
            throw Error('World too small for the configured letter margin.');
        }
        return safe;
    }

    function getSafeSpawnPosition(world, ignore = null, avoidPlayer = true) {
        const b = letterBounds(world);
        const c = world.c;
        const neighbours = [...world.views.values()].filter(
            (v) => v !== ignore && (avoidPlayer || v.data.kind === 'letter')
        );
        function clearance(p) {
            return neighbours.reduce(
                (n, v) => Math.min(n, NL.distance(p, v)),
                Infinity
            );
        }

        function clearOfUI(p) {
            const projected = NL.keepInEnvironment(world, { ...p });
            if (NL.distance(p, projected) > 0.01) return false;
            return world.spawnAvoidAreas.every(
                (r) =>
                    p.x + 25 < r.left ||
                    p.x - 25 > r.right ||
                    p.y + 12 < r.top ||
                    p.y - 60 > r.bottom
            );
        }

        for (let i = 0; i < 80; i++) {
            const p = {
                x: NL.range(world.rng, [b.left, b.right]),
                y: NL.range(world.rng, [b.top, b.bottom])
            };
            if (
                clearOfUI(p) &&
                clearance(p) >= c.LETTER_SEPARATION &&
                (!avoidPlayer ||
                    NL.distance(p, world.player) >= c.LETTER_PLAYER_DISTANCE)
            ) {
                return p;
            }
        }
        // Bounded deterministic fallback handles even a constant random generator.
        let best = null;
        let score = -Infinity;
        for (let y = b.top; y <= b.bottom; y += (b.bottom - b.top) / 12) {
            for (let x = b.left; x <= b.right; x += (b.right - b.left) / 24) {
                const p = { x, y };
                const gap = clearance(p);
                if (
                    !clearOfUI(p) ||
                    gap < c.LETTER_SEPARATION ||
                    (avoidPlayer &&
                        NL.distance(p, world.player) < c.LETTER_PLAYER_DISTANCE)
                ) {
                    continue;
                }
                const value =
                    Math.min(gap, 200) +
                    (avoidPlayer
                        ? Math.min(
                              NL.distance(p, world.player),
                              c.LETTER_PLAYER_DISTANCE
                          )
                        : 0);
                if (value > score) {
                    best = p;
                    score = value;
                }
            }
        }
        return best; // A covering UI panel can defer a spawn until there is room.
    }

    function updateLetterMovement(world, v, dt) {
        const b = letterBounds(world);
        function outside(p) {
            return (
                p.x < b.left || p.x > b.right || p.y < b.top || p.y > b.bottom
            );
        }

        if (outside(v)) {
            v.x = NL.clamp(v.x, b.left, b.right);
            v.y = NL.clamp(v.y, b.top, b.bottom);
            v.tx = v.x;
            v.ty = v.y;
        }
        v.pauseLeft = Math.max(0, v.pauseLeft - dt);
        if (v.pauseLeft > 0) {
            return;
        }
        if (
            outside({ x: v.tx, y: v.ty }) ||
            Math.hypot(v.tx - v.x, v.ty - v.y) < 2
        ) {
            let target = getSafeSpawnPosition(world, v, false);
            if (!target) {
                return;
            }
            // A degenerate random source must not repeatedly select this same position.
            if (NL.distance(target, v) < 20) {
                target = {
                    x: v.x < (b.left + b.right) / 2 ? b.right : b.left,
                    y: (b.top + b.bottom) / 2
                };
            }
            v.tx = target.x;
            v.ty = target.y;
        }
        const dx = v.tx - v.x;
        const dy = v.ty - v.y;
        const length = Math.hypot(dx, dy);
        if (length > 0) {
            const travel = Math.min(v.speed * dt, length);
            v.x += (dx / length) * travel;
            v.y += (dy / length) * travel;
            v.moving = travel > 0;
        }
        v.data.lastPosition = { x: v.x, y: v.y };
    }

    class FamilySystem {
        constructor(world) {
            this.world = world;
            this.letters = [];
            this.event = 'idle';
            this.time = 0;
            this.origins = [];
            this.nextSpawnAt =
                world.time + world.c.FIRST_FAMILY_LETTER_DELAY / 1000;
        }

        randomDelay() {
            const c = this.world.c;
            return NL.range(this.world.rng, [
                c.FAMILY_RANDOM_SPAWN_MIN_DELAY,
                c.FAMILY_RANDOM_SPAWN_MAX_DELAY
            ]);
        }

        updateSpawns() {
            if (
                !this.world.endingTriggered &&
                this.event === 'idle' &&
                this.world.time >= this.nextSpawnAt
            ) {
                this.spawnNext();
            }
        }

        spawnNext() {
            if (
                this.world.endingTriggered ||
                this.letters.length >= FAMILY_LETTERS.length
            ) {
                return null;
            }
            const position = getSafeSpawnPosition(this.world);
            if (!position) {
                this.nextSpawnAt = this.world.time + this.randomDelay();
                return null;
            }
            const d = new LetterData(
                FAMILY_LETTERS[this.letters.length],
                this.world.c
            );
            const { x, y } = position;
            d.lastPosition = { x, y };
            const v = {
                data: d,
                x,
                y,
                tx: x,
                ty: y,
                speed: NL.range(this.world.rng, this.world.c.LETTER_SPEED),
                moving: false,
                state: 'present',
                opacity: 1,
                feedback: 0,
                previousNumber: d.encountersLeft,
                finalElapsed: 0,
                pauseLeft: 0
            };
            this.letters.push(d);
            this.world.views.set(d.id, v);
            this.nextSpawnAt = Infinity;
            this.world.revision++;
            return d;
        }

        checkUnlocks() {
            if (this.world.endingTriggered || this.event !== 'idle') {
                return;
            }
            const latest = this.letters.at(-1);
            if (
                !latest ||
                latest.activated ||
                latest.permanentlyGone ||
                latest.encountersLeft < this.world.c.FAMILY_THRESHOLD
            ) {
                return;
            }
            latest.activated = true;
            NL.familyDiscovery(this.world, latest, true);
            latest.state = 'FOLLOWING';
            if (latest.letter === 'F') {
                NL.queueContextHint(this.world, 'following');
            }
            if (this.letters.length < 6) {
                this.nextSpawnAt = this.world.time + this.randomDelay();
            } else {
                this.trigger();
            }
        }

        // FAMILY FOLLOW SYSTEM — each letter trails the previous one, like a short string.
        updateFollowers(dt) {
            if (this.world.endingTriggered) {
                return;
            }
            const w = this.world;
            const c = w.c;
            const b = letterBounds(w);
            const followers = this.letters
                .filter((d) => d.activated && !d.permanentlyGone)
                .map((d) => w.views.get(d.id))
                .filter(Boolean);
            let leader = w.player;
            for (const v of followers) {
                const dx = leader.x - v.x;
                const dy = leader.y - v.y;
                const length = Math.hypot(dx, dy);
                if (length > c.FAMILY_FOLLOW_DISTANCE) {
                    const travel = Math.min(
                        c.FAMILY_FOLLOW_SPEED * dt,
                        (length - c.FAMILY_FOLLOW_DISTANCE) *
                            (1 - Math.exp(-c.FAMILY_FOLLOW_RESPONSE * dt))
                    );
                    v.x += (dx / length) * travel;
                    v.y += (dy / length) * travel;
                }
                v.x = NL.clamp(v.x, b.left, b.right);
                v.y = NL.clamp(v.y, b.top, b.bottom);
                NL.keepInEnvironment(w, v);
                leader = v;
            }
            // Gently separate the string when it folds back on itself or meets a boundary.
            const bodies = [w.player, ...followers];
            for (let pass = 0; pass < 4; pass++) {
                for (let i = 1; i < bodies.length; i++) {
                    for (let j = 0; j < i; j++) {
                        const a = bodies[i];
                        const other = bodies[j];
                        const dx = a.x - other.x;
                        const dy = a.y - other.y;
                        const length = Math.hypot(dx, dy);
                        const gap =
                            j === 0
                                ? c.INTERACTION_RADIUS * 0.7
                                : c.FAMILY_FOLLOW_DISTANCE;
                        if (length >= gap) {
                            continue;
                        }
                        const nx =
                            length > 0.01 ? dx / length : Math.cos(i * 2.4);
                        const ny =
                            length > 0.01 ? dy / length : Math.sin(i * 2.4);
                        const push = (gap - length) * (1 - Math.exp(-dt * 10));
                        a.x = NL.clamp(a.x + nx * push, b.left, b.right);
                        a.y = NL.clamp(a.y + ny * push, b.top, b.bottom);
                        NL.keepInEnvironment(w, a);
                        if (j > 0) {
                            other.x = NL.clamp(
                                other.x - nx * push,
                                b.left,
                                b.right
                            );
                            other.y = NL.clamp(
                                other.y - ny * push,
                                b.top,
                                b.bottom
                            );
                            NL.keepInEnvironment(w, other);
                        }
                    }
                }
            }
            for (const v of followers) {
                v.data.lastPosition = { x: v.x, y: v.y };
            }
        }

        trigger() {
            if (!NL.claimEnding(this.world, 'family')) {
                return false;
            }
            this.event = 'assembling';
            this.time = 0;
            this.origins = Array.from(FAMILY_LETTERS, (letter, i) => {
                const v = this.world.views.get(`letter-${letter}`);
                return v
                    ? { x: v.x, y: v.y }
                    : this.letters[i]?.lastPosition || {
                          x: this.world.c.WIDTH / 2,
                          y: this.world.c.HEIGHT / 2
                      };
            });
            return true;
        }

        // FAMILY ENDING — the word becomes six words, then the final two-line phrase.
        update(dt) {
            if (this.event === 'idle' || this.event === 'complete') {
                return;
            }
            this.time += dt;
            const c = this.world.c;
            if (
                this.time >=
                c.FAMILY_ASSEMBLE_SECONDS +
                    c.FAMILY_HOLD_SECONDS +
                    c.FAMILY_REVEAL_SECONDS
            ) {
                this.event = 'complete';
            }
        }

        reset() {
            for (const d of this.letters) {
                this.world.views.delete(d.id);
            }
            this.letters = [];
            this.event = 'idle';
            this.time = 0;
            this.origins = [];
            this.nextSpawnAt =
                this.world.time + this.world.c.FIRST_FAMILY_LETTER_DELAY / 1000;
        }

        render(ctx, reducedMotion) {
            const c = this.world.c;
            const arrival = NL.smooth(this.time / c.FAMILY_ASSEMBLE_SECONDS);
            const reveal = NL.smooth(
                (this.time -
                    c.FAMILY_ASSEMBLE_SECONDS -
                    c.FAMILY_HOLD_SECONDS) /
                    c.FAMILY_REVEAL_SECONDS
            );
            ctx.save();
            ctx.globalAlpha = arrival;
            ctx.fillStyle = c.PALETTE.paper;
            ctx.fillRect(0, 0, c.WIDTH, c.HEIGHT);
            ctx.restore();
            ctx.save();
            ctx.textAlign = 'center';
            ctx.fillStyle = c.PALETTE.ink;
            const words = ['Father', 'and', 'Mother,', 'I', 'love', 'you.'];
            const positions = [
                [-141, -15],
                [-18, -15],
                [124, -15],
                [-97, 46],
                [-18, 46],
                [81, 46]
            ];
            for (let i = 0; i < 6; i++) {
                const t = NL.smooth(
                    (this.time / c.FAMILY_ASSEMBLE_SECONDS -
                        i * c.FAMILY_STAGGER) /
                        (1 - 5 * c.FAMILY_STAGGER)
                );
                const x = c.WIDTH / 2 + (i - 2.5) * 61;
                const y = c.HEIGHT / 2;
                ctx.font = `${NL.lerp(36, 66, t)}px Georgia, serif`;
                ctx.globalAlpha = (reducedMotion ? t : 1) * (1 - reveal);
                ctx.fillText(
                    FAMILY_LETTERS[i],
                    reducedMotion ? x : NL.lerp(this.origins[i].x, x, t),
                    reducedMotion ? y : NL.lerp(this.origins[i].y, y, t)
                );
                ctx.font = '42px Georgia, serif';
                ctx.globalAlpha = reveal;
                ctx.fillText(
                    words[i],
                    NL.lerp(x, c.WIDTH / 2 + positions[i][0], reveal),
                    NL.lerp(y, c.HEIGHT / 2 + positions[i][1], reveal)
                );
            }
            ctx.restore();
        }
    }

    function drawLetter(ctx, v, c) {
        ctx.save();
        ctx.globalAlpha = v.opacity;
        ctx.textAlign = 'center';
        ctx.fillStyle = c.PALETTE.ink;
        ctx.font = '36px Georgia, serif';
        ctx.fillText(v.data.letter, v.x, v.y);
        ctx.font = '12px Arial, sans-serif';
        const showOld = v.feedback > c.FEEDBACK_SECONDS * 0.72;
        ctx.fillText(
            String(showOld ? v.previousNumber : v.data.encountersLeft).padStart(
                2,
                '0'
            ),
            v.x,
            v.y - 48
        );
        ctx.restore();
    }
    Object.assign(NL, {
        LetterData,
        FAMILY_LETTERS,
        letterBounds,
        getSafeSpawnPosition,
        updateLetterMovement,
        FamilySystem,
        drawLetter
    });
})();
