// FOLLOWING — one optional behaviour in the ordinary character update, using active time.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    function stopFollowing(data) {
        if (data.follow) {
            data.follow.remaining = 0;
            data.follow.vx = 0;
            data.follow.vy = 0;
        }
        data.behaviour = 'normal';
    }
    function renewFollowing(world, data, reason = 'gift') {
        if (
            data.kind !== 'person' ||
            NL.isBloodRelative(data) ||
            data.briefEncounter ||
            data.lifeStatus !== 'present' ||
            data.permanentlyGone
        )
            return false;
        data.follow.remaining = Math.min(
            world.c.FOLLOW.MAX_SECONDS,
            Math.max(data.follow.remaining + 10, world.c.FOLLOW.SECONDS)
        );
        data.behaviour = 'following';
        NL.recordInteraction(world, data, 'following', { reason });
        const view = world.views.get(data.id);
        if (view && ['present', 'leaving'].includes(view.state)) {
            view.state = 'present';
            view.visitLeft = Math.max(
                view.visitLeft,
                data.follow.remaining + 5
            );
        }
        NL.televisionHint(
            world,
            'following-' + data.id + '-' + data.giftedEncounters,
            'Some company',
            'They fall into step with you. For a while, neither of you has to walk alone.',
            40
        );
        return true;
    }
    function startFamilyWaiting(world, data) {
        const view = world.views.get(data.id);
        if (
            !NL.isBloodRelative(data) ||
            data.giftedEncounters < world.c.FRIEND_GIFT_THRESHOLD ||
            !data.active || data.lifeStatus !== 'present' ||
            !view || view.state !== 'present'
        ) return;
        if (view.waitingTarget) return;
        stopFollowing(data);
        world.randomTarget(view);
        view.waitingTarget = { x: view.tx, y: view.ty };
        data.behaviour = 'waiting';
        // Leave time to reach the place before the ordinary visit timer can end this visit.
        view.visitLeft = Math.max(
            view.visitLeft,
            NL.distance(view, view.waitingTarget) / view.speed + 12
        );
    }
    function followingGift(world, data) {
        if (NL.isBloodRelative(data)) {
            startFamilyWaiting(world, data);
            return;
        }
        if (
            data.kind === 'person' &&
            data.giftedEncounters > 0 &&
            data.giftedEncounters % 4 === 0
        )
            renewFollowing(world, data, 'four more gifts');
    }
    function currentFollowers(world) {
        return world.population.filter(
            (d) =>
                d.lifeStatus === 'present' &&
                d.active &&
                !d.permanentlyGone &&
                d.follow.remaining > 0 &&
                world.views.get(d.id)?.state === 'present'
        );
    }
    function updateFollower(world, view, dt) {
        const data = view.data,
            follow = data.follow;
        if (
            NL.isBloodRelative(data) || !follow ||
            follow.remaining <= 0 || data.lifeStatus !== 'present'
        )
            return false;
        follow.remaining = Math.max(0, follow.remaining - dt);
        if (!follow.remaining) {
            stopFollowing(data);
            world.randomTarget(view);
            view.pauseLeft = 1;
            return false;
        }
        data.behaviour = 'following';
        const followers = currentFollowers(world),
            index = followers.indexOf(data);
        const angle = index * 2.399 + follow.offset;
        const radius = 48 + Math.floor(index / 5) * 36 + follow.offset * 7;
        const target = NL.keepInEnvironment(world, {
            x: world.player.x + Math.cos(angle) * radius,
            y: world.player.y + Math.sin(angle) * radius
        });
        const dx = target.x - view.x,
            dy = target.y - view.y,
            length = Math.hypot(dx, dy);
        const close = NL.distance(view, world.player) < 37 || length < 9;
        const speed =
            close || view.pauseLeft > 0 ? 0 : Math.min(185, 70 + length * 1.4);
        const ease = 1 - Math.exp(-dt * 6);
        follow.vx = NL.lerp(
            follow.vx,
            length ? (dx / length) * speed : 0,
            ease
        );
        follow.vy = NL.lerp(
            follow.vy,
            length ? (dy / length) * speed : 0,
            ease
        );
        const travel = Math.min(
            1,
            length / Math.max(0.001, Math.hypot(follow.vx, follow.vy) * dt)
        );
        view.x += follow.vx * dt * travel;
        view.y += follow.vy * dt * travel;
        NL.keepInEnvironment(world, view);
        view.moving = Math.hypot(follow.vx, follow.vy) > 2;
        if (view.moving) view.step += dt * 9;
        view.visitLeft = Math.max(view.visitLeft, follow.remaining + 5);
        return true;
    }
    Object.assign(NL, {
        stopFollowing,
        startFamilyWaiting,
        renewFollowing,
        followingGift,
        currentFollowers,
        updateFollower
    });
})();
