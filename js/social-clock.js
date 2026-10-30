// SOCIAL CLOCK — independent active-time checks, one current narrative, no interval timers.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    function initializeSocialClock(world) {
        world.socialClock = {
            time: 0,
            nextEvent: world.c.SOCIAL.EVENT_INTERVAL,
            nextReunion: world.c.SOCIAL.REUNION_INTERVAL,
            nextAllowedAt: 0,
            lastType: null,
            lastCharacter: null,
            lastCharacterAt: -Infinity,
            evaluations: 0,
            reunionChecks: 0
        };
        world.narrative = { current: null, queue: [] };
        world.informationNotice = '';
    }
    function weightedType(world, types) {
        const weights = types.map((type) =>
            type === 'conflict' ? 0.3 : type === 'romance' ? 1.2 : 1
        );
        let ticket = world.rng() * weights.reduce((sum, n) => sum + n, 0);
        for (let index = 0; index < types.length; index++) {
            ticket -= weights[index];
            if (ticket <= 0) return types[index];
        }
        return types.at(-1);
    }
    function updateSocialClock(world, dt) {
        const clock = world.socialClock;
        if (world.endingTriggered) return;
        clock.time += dt;
        if (
            world.sixSevenProgress.pending ||
            NL.narrativeBlocking(world) ||
            world.narrative.queue.length
        )
            return;
        if (clock.time < clock.nextAllowedAt) return;
        if (clock.time >= clock.nextReunion) {
            clock.nextReunion = clock.time + world.c.SOCIAL.REUNION_INTERVAL;
            clock.reunionChecks++;
            const eligible = world.population.filter(
                (d) =>
                    (NL.isBloodRelative(d)
                        ? NL.familyReunionEligible(world, d)
                        : d.lifeStatus === 'departed') &&
                    !d.permanentlyGone &&
                    clock.time >= d.absenceUntil &&
                    (d.id !== clock.lastCharacter ||
                        clock.time - clock.lastCharacterAt >=
                            world.c.SOCIAL.MIN_ABSENCE)
            );
            if (
                eligible.length &&
                world.rng() < world.c.SOCIAL.REUNION_CHANCE
            ) {
                const friend = NL.pick(world, eligible);
                if (NL.returnFriend(world, friend)) {
                    clock.lastCharacter = friend.id;
                    clock.lastCharacterAt = clock.time;
                    return;
                }
            }
        }
        if (clock.time >= clock.nextEvent) {
            clock.nextEvent = clock.time + world.c.SOCIAL.EVENT_INTERVAL;
            clock.evaluations++;
            const types = NL.eligibleEventTypes(world).filter(
                (type) => type !== clock.lastType
            );
            if (types.length && world.rng() < world.c.SOCIAL.EVENT_CHANCE)
                NL.startFriendshipEvent(world, weightedType(world, types));
        }
    }
    Object.assign(NL, { initializeSocialClock, updateSocialClock });
})();
