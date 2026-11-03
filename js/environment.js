// ENVIRONMENT — logical positions and spacing; character scale is unchanged.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    function environment(config) {
        return {
            x: config.WIDTH / 2,
            y: config.HEIGHT * config.ENVIRONMENT.CENTER_Y,
            rx: config.ENVIRONMENT.RADIUS_X,
            ry: config.ENVIRONMENT.RADIUS_Y
        };
    }
    function worldBounds(config) {
        const e = environment(config);
        return {
            left: e.x - e.rx + 16,
            right: e.x + e.rx - 16,
            top: e.y - e.ry + 42,
            bottom: e.y + e.ry - 18
        };
    }
    function keepInEnvironment(world, point) {
        const e = environment(world.c);
        const centerY = e.y + 12,
            rx = e.rx - 18,
            ry = e.ry - 30;
        const dx = (point.x - e.x) / rx,
            dy = (point.y - centerY) / ry;
        const length = Math.hypot(dx, dy);
        if (length > 1) {
            point.x = e.x + (dx / length) * rx;
            point.y = centerY + (dy / length) * ry;
        }
        return point;
    }
    // Labels need more vertical room than the narrow drawn bodies.
    function characterClearance(a, b) {
        const labelWidth = (view) => {
            const number = Math.max(
                view.data?.encountersLeft || 0,
                view.previousNumber || 0
            );
            return number >= 1000 ? String(number).length * 7 + 8 : 14;
        };
        // Only wide number labels request extra horizontal room; ordinary spacing is unchanged.
        const horizontalGap = Math.max(
            30,
            (labelWidth(a) + labelWidth(b)) / 2 + 12
        );
        return Math.hypot(
            ((a.x - b.x) * 30) / horizontalGap,
            (a.y - b.y) * 0.7
        );
    }
    function openWorldPosition(world, gap = 30, ignore = null) {
        const e = environment(world.c);
        let best = null,
            bestGap = -1;
        for (let i = 0; i < 100; i++) {
            const angle = world.rng() * Math.PI * 2,
                radius = Math.sqrt(world.rng());
            const point = keepInEnvironment(world, {
                x: e.x + Math.cos(angle) * radius * (e.rx - 20),
                y: e.y + 12 + Math.sin(angle) * radius * (e.ry - 32)
            });
            let clearance = characterClearance(point, world.player);
            for (const other of world.views.values())
                if (other !== ignore && other.state !== 'farewell')
                    clearance = Math.min(
                        clearance,
                        characterClearance(point, other)
                    );
            if (clearance > bestGap) {
                best = point;
                bestGap = clearance;
            }
            if (clearance >= gap) return point;
        }
        return bestGap >= gap * 0.8 ? best : null;
    }
    function separateWorld(world) {
        const people = [...world.views.values()].filter(
            (v) =>
                v.state === 'present' &&
                v.data.kind === 'person' &&
                !v.data.briefEncounter
        );
        const letters = [...world.views.values()].filter(
            (v) => v.state === 'present' && v.data.kind === 'letter'
        );
        for (let pass = 0; pass < 8; pass++) {
            for (let i = 0; i < people.length; i++) {
                const a = people[i];
                for (const b of [...letters, ...people.slice(0, i)]) {
                    const distance = characterClearance(a, b),
                        gap = world.c.PERSONAL_SPACE;
                    if (distance >= gap) continue;
                    const nx =
                            distance > 0.01
                                ? (a.x - b.x) / distance
                                : Math.cos(i + pass),
                        ny =
                            distance > 0.01
                                ? (a.y - b.y) / distance
                                : Math.sin(i + pass);
                    const push = (gap - distance) * 0.6;
                    a.x += nx * push;
                    a.y += ny * push;
                    if (b.data?.kind === 'person') {
                        b.x -= nx * push;
                        b.y -= ny * push;
                        keepInEnvironment(world, b);
                    }
                    keepInEnvironment(world, a);
                }
            }
        }
    }
    Object.assign(NL, {
        environment,
        worldBounds,
        keepInEnvironment,
        openWorldPosition,
        separateWorld
    });
})();
