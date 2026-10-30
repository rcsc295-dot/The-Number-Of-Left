// MATH — one responsibility; shared systems live on NumberLeft.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    function clamp(value, minimum, maximum) {
        return Math.max(minimum, Math.min(maximum, value));
    }

    function lerp(start, end, progress) {
        return start + (end - start) * progress;
    }

    function smooth(progress) {
        progress = clamp(progress, 0, 1);
        return progress * progress * (3 - 2 * progress);
    }

    function distance(first, second) {
        return Math.hypot(first.x - second.x, first.y - second.y);
    }

    function range(random, limits) {
        return lerp(limits[0], limits[1], random());
    }

    function integer(random, limits) {
        return Math.floor(range(random, [limits[0], limits[1] + 1]));
    }
    Object.assign(NL, { clamp, lerp, smooth, distance, range, integer });
})();
