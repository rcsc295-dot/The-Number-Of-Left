// HINTS — one responsibility; shared systems live on NumberLeft.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    function showFamilyWarning(world) {
        if (!world.familyWarning.active) {
            world.familyWarning.active = true;
            world.familyWarning.time = 0;
        }
    }

    function updateFamilyWarning(world, dt) {
        const warning = world.familyWarning;
        if (!warning.active) {
            return;
        }
        warning.time += dt;
        const timing = world.c.FAMILY_WARNING;
        if (warning.time >= timing.FADE_IN + timing.HOLD + timing.FADE_OUT) {
            warning.active = false;
        }
    }

    function familyWarningOpacity(world) {
        const timing = world.c.FAMILY_WARNING;
        const time = world.familyWarning.time;
        return Math.min(
            NL.smooth(time / timing.FADE_IN),
            1 -
                NL.smooth(
                    (time - timing.FADE_IN - timing.HOLD) / timing.FADE_OUT
                )
        );
    }

    const CONTEXT_HINTS = {
        move: 'Click anywhere or use WASD to move.',
        approach: 'Every number is a meeting you still have left.',
        take: 'You took one encounter.',
        give: 'Give encounters to the people you want to keep longer.',
        transfer:
            'If you want someone to stay, you may need to take time from someone else.',
        friend: 'A stranger has become a friend.',
        unusual: 'This one seems different.',
        following: 'It seems to want to stay with you.'
    };

    function queueContextHint(world, name) {
        if (world.hints.seen.has(name)) {
            return;
        }
        world.hints.seen.add(name);
        world.hints.queue.push(name);
    }

    function updateContextHints(world, dt) {
        const hints = world.hints;
        if (hints.current) {
            hints.time += dt;
            if (hints.time >= world.c.CONTEXT_HINT_DURATION) {
                hints.current = null;
                hints.time = 0;
            }
        }
        if (!hints.current && hints.queue.length) {
            hints.current = hints.queue.shift();
            hints.time = 0;
        }
    }
    Object.assign(NL, {
        showFamilyWarning,
        updateFamilyWarning,
        familyWarningOpacity,
        CONTEXT_HINTS,
        queueContextHint,
        updateContextHints
    });
})();
