// ENDINGS — one responsibility; shared systems live on NumberLeft.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    const ENDING_DEFINITIONS = [
        {
            id: 'family',
            name: 'FAMILY',
            action: 'family-end',
            label: 'FAMILY',
            hint: 'Some bonds are written in letters rather than numbers.',
            icon: 'letters'
        },
        {
            id: 'six-seven',
            name: 'SIX SEVEN',
            action: 'six-seven-end',
            label: 'SIX SEVEN',
            hint: 'Sometimes, one number is waiting for another.',
            icon: 'pair'
        },
        {
            id: 'time',
            name: 'I Am the Universe',
            action: 'time-end',
            label: 'I AM THE UNIVERSE',
            hint: 'What remains when every borrowed moment belongs to you?',
            icon: 'universe'
        }
    ];
    function claimEnding(world, kind) {
        if (
            world.endingTriggered ||
            !ENDING_DEFINITIONS.some((ending) => ending.id === kind)
        ) {
            return false;
        }
        world.endingTriggered = kind;
        world.narrative.current = null;
        world.narrative.queue.length = 0;
        world.familyWarning.active = false;
        world.spawningEnabled = false;
        world.player.moveTarget = null;
        world.player.vx = 0;
        world.player.vy = 0;
        world.player.moving = false;
        for (const character of world.views.values()) {
            character.moving = false;
        }
        world.family.nextSpawnAt = Infinity;
        world.hints.current = null;
        world.hints.queue.length = 0;
        return true;
    }

    function checkTakenEnding(world) {
        if (world.collectedIds.size >= world.c.COLLECTION_THRESHOLD) {
            claimEnding(world, 'time');
        }
    }

    class TimeEnding {
        constructor(world) {
            this.world = world;
            this.time = 0;
            this.origin = { x: world.player.x, y: world.player.y };
            this.opacities = new Map(
                [...world.views.values()].map((v) => [v.data.id, v.opacity])
            );
        }

        update(dt) {
            const w = this.world;
            const c = w.c;
            this.time += dt;
            const empty = NL.smooth(this.time / c.TIME_EMPTY_SECONDS);
            for (const v of w.views.values()) {
                v.opacity = (this.opacities.get(v.data.id) ?? 1) * (1 - empty);
                if (empty === 1) {
                    v.data.active = false;
                    w.views.delete(v.data.id);
                }
            }
            w.player.x = NL.lerp(this.origin.x, c.WIDTH / 2, empty);
            w.player.y = NL.lerp(this.origin.y, c.HEIGHT * 0.8, empty);
            w.player.moving = false;
            w.player.visual.scale = NL.lerp(
                1,
                c.PLAYER_GROWTH_SCALE,
                NL.smooth(
                    (this.time - c.TIME_EMPTY_SECONDS) /
                        c.PLAYER_GROWTH_DURATION
                )
            );
        }

        get complete() {
            const c = this.world.c;
            return this.time >= c.TIME_EMPTY_SECONDS + c.PLAYER_GROWTH_DURATION;
        }
    }

    Object.assign(NL, {
        ENDING_DEFINITIONS,
        claimEnding,
        checkTakenEnding,
        TimeEnding
    });
})();
