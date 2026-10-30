// RECURRENCE — one responsibility; shared systems live on NumberLeft.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    class RecurrenceSystem {
        constructor(world) {
            this.world = world;
            this.nextSpawn = NL.range(world.rng, world.c.RETURN.SPAWN_INTERVAL);
            this.candidates = [];
            this.nextBloodRelativeAt =
                world.c.FIRST_BLOOD_RELATIVE_DELAY / 1000;
        }

        introductionDue(d) {
            if (d.visits > 0) return true;
            return (
                (!d.template && !NL.isBloodRelative(d)) ||
                this.world.time >=
                    (NL.isBloodRelative(d)
                        ? this.nextBloodRelativeAt
                        : this.world.c.INITIAL_ORDINARY_ONLY_DURATION / 1000)
            );
        }

        eligible(d) {
            return (
                !d.active &&
                this.introductionDue(d) &&
                d.lifeStatus === 'present' &&
                !(
                    NL.isBloodRelative(d) && d.availability === 'long_distance'
                ) &&
                !d.permanentlyGone &&
                d.encountersLeft > 0 &&
                this.world.time >= d.nextReturnAt
            );
        }

        arrive(d, initial = false, developerOverride = false) {
            const w = this.world;
            const c = w.c;
            if (
                !w.spawningEnabled ||
                (!developerOverride && !this.introductionDue(d)) ||
                d.active ||
                w.views.has(d.id) ||
                (NL.isBloodRelative(d) &&
                    d.availability === 'long_distance' &&
                    !familyReunionEligible(w, d)) ||
                d.lifeStatus !== 'present' ||
                d.permanentlyGone ||
                d.encountersLeft <= 0
            ) {
                return false;
            }
            const interior = initial || !!d.template;
            const position = d.template
                ? NL.getSafeSpawnPosition(w)
                : NL.openWorldPosition(w, c.PERSONAL_SPACE + 4);
            if (!position) return false;
            const x = interior
                ? position.x
                : w.rng() < 0.5
                  ? w.bounds.left - 15
                  : w.bounds.right + 15;
            const v = new NL.CharacterView(d, x, position.y, w.rng, c);
            v.visitLeft *= d.presenceFactor || 1;
            if (!interior) {
                v.state = 'entering';
            }
            d.active = true;
            if (NL.isBloodRelative(d))
                d.availability = d.familyDistance ? 'long_distance' : 'present';
            if (NL.isBloodRelative(d) && d.visits === 0 && !developerOverride)
                this.nextBloodRelativeAt =
                    w.time + c.BLOOD_RELATIVE_SPAWN_INTERVAL / 1000;
            d.visits++;
            if (d.visits > 1) {
                w.returns++;
            }
            w.views.set(d.id, v);
            w.randomTarget(v);
            onStoryArrival(w, v);
            return true;
        }

        depart(v) {
            v.state = 'leaving';
            v.tx =
                v.x < this.world.c.WIDTH / 2
                    ? this.world.bounds.left - this.world.c.RETURN.MARGIN
                    : this.world.bounds.right + this.world.c.RETURN.MARGIN;
            v.ty = NL.clamp(
                v.y,
                this.world.bounds.top,
                this.world.bounds.bottom
            );
        }

        finishDeparture(v) {
            const w = this.world;
            const d = v.data;
            d.active = false;
            NL.stopFollowing(d);
            w.views.delete(d.id);
            if (NL.isBloodRelative(d)) {
                const distant = !!d.familyDistance;
                const delay = NL.range(
                    w.rng,
                    distant
                        ? w.c.FAMILY_AVAILABILITY.LONG_DISTANCE_DELAY
                        : w.c.FAMILY_AVAILABILITY.RETURN_DELAY
                );
                d.availability = distant
                    ? 'long_distance'
                    : 'temporarily_absent';
                d.nextReturnAt = w.time + delay;
                if (distant) d.absenceUntil = w.socialClock.time + delay;
                // Routine absence never spends opportunities, clears history, or ends a family relationship.
                return;
            }
            const multiplier =
                d.template?.movement === 'rest' ? w.c.SPECIAL.LONG_ABSENCE : 1;
            d.nextReturnAt =
                w.time +
                (NL.range(w.rng, [w.c.RETURN_MIN_DELAY, w.c.RETURN_MAX_DELAY]) *
                    multiplier) /
                    Math.sqrt(d.returnWeight) /
                    (d.presenceFactor || 1);
        }

        update(dt, quiet) {
            const w = this.world;
            const c = w.c;
            if (!w.spawningEnabled) {
                return;
            }
            const capacity = c.RETURN.CAPACITY;
            const people = [...w.views.values()].filter(
                (v) => v.data.kind === 'person'
            );
            const newcomer = w.population.find(
                (d) =>
                    NL.isBloodRelative(d) &&
                    d.visits === 0 &&
                    !d.active &&
                    d.lifeStatus === 'present' &&
                    !d.permanentlyGone &&
                    d.encountersLeft > 0
            );
            // Make one place through an ordinary routine exit, keeping the existing population cap.
            // Followers keep their company; if everyone is staying, the introduction waits for room.
            const exitLead =
                (c.WIDTH / 2 + c.RETURN.MARGIN) / c.RETURN.EDGE_SPEED + 1;
            const reserve =
                newcomer && w.time >= this.nextBloodRelativeAt - exitLead;
            if (
                reserve &&
                people.length >= capacity &&
                !people.some((v) => v.state === 'leaving')
            ) {
                const visitor = people
                    .filter(
                        (v) =>
                            v.state === 'present' &&
                            !v.data.template &&
                            v.data.follow.remaining <= 0 &&
                            v.pauseLeft <= 0
                    )
                    .sort((a, b) => a.visitLeft - b.visitLeft)[0];
                if (visitor) this.depart(visitor);
            }
            if (
                newcomer &&
                this.eligible(newcomer) &&
                people.length < capacity
            ) {
                if (this.arrive(newcomer)) return;
            }
            this.nextSpawn -= dt;
            if (this.nextSpawn > 0) return;
            this.nextSpawn = NL.range(w.rng, c.RETURN.SPAWN_INTERVAL);
            if (people.length >= capacity - (reserve ? 1 : 0)) return;
            this.candidates.length = 0;
            let total = 0;
            for (const d of w.population) {
                if (this.eligible(d)) {
                    this.candidates.push(d);
                    total += d.returnWeight;
                }
            }
            // Give due local relatives the next free slot; random weighting cannot strand them off-screen.
            const family = this.candidates
                .filter((d) => NL.isBloodRelative(d))
                .sort((a, b) => a.nextReturnAt - b.nextReturnAt)[0];
            if (family) {
                this.arrive(family);
                return;
            }
            let ticket = w.rng() * total;
            for (const d of this.candidates) {
                ticket -= d.returnWeight;
                if (ticket <= 0) {
                    this.arrive(d);
                    break;
                }
            }
        }
    }

    function familyReunionEligible(world, data) {
        return (
            NL.isBloodRelative(data) &&
            data.availability === 'long_distance' &&
            !!data.familyDistance &&
            data.lifeStatus === 'present' &&
            !data.active &&
            !data.permanentlyGone &&
            data.encountersLeft > 0 &&
            !world.views.has(data.id) &&
            world.socialClock.time >= data.absenceUntil
        );
    }

    function familyAvailabilityLabel(data) {
        if (!NL.isBloodRelative(data)) return '';
        if (data.availability === 'long_distance')
            return data.active
                ? 'Long distance · visiting'
                : 'Long distance · reunion possible';
        return data.active ? 'Here' : 'Temporarily absent · can return';
    }

    function onStoryArrival(world, v) {
        const d = v.data;
        const visits = world.c.STORY.VISITS;
        if (!d.template) {
            return;
        }
        d.storyState =
            d.visits < visits[1]
                ? 'alone'
                : d.visits < visits[2]
                  ? 'alongside'
                  : d.visits < visits[3]
                    ? 'waiting'
                    : 'returning-alone';
        v.storyHold = world.c.STORY.HOLD_SECONDS;
        v.storyAnchor = d.template.key === 'blue';
    }

    function updateStoryMotion(world, v, dt) {
        if (!v.storyAnchor || v.storyHold <= 0) {
            return;
        }
        const c = world.c.STORY;
        const d = v.data;
        v.tx = c.ANCHOR_X;
        v.ty = c.ANCHOR_Y;
        if (Math.hypot(v.x - v.tx, v.y - v.ty) < 12) {
            v.storyHold -= dt;
            if (d.storyState === 'waiting') {
                v.sitting = true;
            }
        }
        if (d.storyState === 'alongside') {
            const companion = world.views.get(d.companionId);
            if (companion && companion.state === 'present') {
                companion.tx = c.ANCHOR_X + 30;
                companion.ty = c.ANCHOR_Y;
                companion.turnIn = 2;
            }
        }
        // If the companion is away or permanently absent, the place stays empty.
        // No resurrection or mandatory pair spawn to make a story beat happen.
    }
    Object.assign(NL, {
        familyReunionEligible,
        familyAvailabilityLabel,
        RecurrenceSystem,
        onStoryArrival,
        updateStoryMotion
    });
})();
