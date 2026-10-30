// SIX-SEVEN — one responsibility; shared systems live on NumberLeft.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    function displayedEncounters(character, config) {
        const progress = character.feedback
            ? 1 - character.feedback / config.FEEDBACK_SECONDS
            : 1;
        return progress < 0.28
            ? character.previousNumber
            : character.data.encountersLeft;
    }

    function eligibleOrdinaryPerson(character) {
        if (!character) return false;
        const data = character.data;
        return (
            data.kind === 'person' &&
            !NL.isBloodRelative(data) &&
            data.canTake !== false &&
            data.lifeStatus === 'present' &&
            data.active &&
            !data.permanentlyGone &&
            ['present', 'entering', 'leaving'].includes(character.state) &&
            data.encountersLeft > 0
        );
    }
    function visibleOrdinaryPerson(world, character) {
        if (!eligibleOrdinaryPerson(character) || character.opacity <= 0)
            return false;
        // Keep both the small figure and its number inside the visible world.
        if (
            character.x < 12 ||
            character.x > world.c.WIDTH - 12 ||
            character.y < 48 ||
            character.y > world.c.HEIGHT - 8
        ) {
            return false;
        }
        return !world.spawnAvoidAreas.some(
            (area) =>
                area.right > character.x - 12 &&
                area.left < character.x + 12 &&
                area.bottom > character.y - 48 &&
                area.top < character.y + 8
        );
    }

    function resetSixSevenProgress(world) {
        if (world.television) {
            world.television.queue = world.television.queue.filter(
                (item) => !item.scoreboard
            );
            if (world.television.current?.scoreboard)
                world.television.current =
                    world.television.queue.shift() || null;
        }
        world.sixSevenProgress = {
            sixId: null,
            sevenId: null,
            sevenGifted: false,
            pending: 0,
            figures: null
        };
    }
    function noteSixSevenTransfer(world, view, action) {
        if (world.endingTriggered || world.sixSevenProgress.figures) return;
        const wasSix = world.sixSevenProgress.sixId === view.data.id;
        updateSixSevenDiscovery(world, 0);
        const p = world.sixSevenProgress;
        const data = view.data;
        // Only a completed player gift (or explicit CONTROL demonstration) can finish Seven.
        if (
            wasSix ||
            !['give', 'developer'].includes(action) ||
            !p.sixId ||
            data.id === p.sixId ||
            !eligibleOrdinaryPerson(view) ||
            data.encountersLeft > 7
        )
            return;
        p.sevenId = data.id;
        if (data.encountersLeft !== 7) return;
        if (action === 'developer') world.developmentUsed = true;
        p.sevenGifted = true;
        const six = world.views.get(p.sixId);
        p.figures = [six, view].map((v) => ({
            id: v.data.id,
            number: v.data.encountersLeft,
            x: v.x,
            y: v.y - 37
        }));
        p.pending = world.c.SIX_SEVEN.PREVIEW_SECONDS;
        world.player.moveTarget = null;
        world.player.vx = world.player.vy = 0;
        NL.recordInteraction(world, data, 'pair-complete', { with: p.sixId });
    }
    function checkSixSevenEnding(world) {
        const p = world.sixSevenProgress;
        if (world.endingTriggered || !p.figures || p.pending > 0) return false;
        if (!NL.claimEnding(world, 'six-seven')) return false;
        world.sixSeven = {
            time: 0,
            figures: p.figures.map((figure) => {
                const view = world.views.get(figure.id);
                return view ? { ...figure, x: view.x, y: view.y - 37 } : figure;
            })
        };
        p.figures = null;
        return true;
    }
    function updateSixSevenDiscovery(world, dt) {
        if (world.endingTriggered) return;
        let p = world.sixSevenProgress;
        // Completion is a committed transition: walking/ordinary exits cannot undo a successful gift.
        if (p.figures) {
            p.pending = Math.max(0, p.pending - dt);
            if (p.pending === 0) checkSixSevenEnding(world);
            return;
        }
        const six = world.views.get(p.sixId);
        if (
            p.sixId &&
            (!eligibleOrdinaryPerson(six) || six.data.encountersLeft !== 6)
        ) {
            resetSixSevenProgress(world);
            p = world.sixSevenProgress;
        }
        if (!p.sixId) {
            const naturalSix = [...world.views.values()].find(
                (v) =>
                    v.data.encountersLeft === 6 &&
                    visibleOrdinaryPerson(world, v)
            );
            if (!naturalSix) return;
            p.sixId = naturalSix.data.id;
            NL.recordInteraction(world, naturalSix.data, 'six-role');
        }
        const candidate = world.views.get(p.sevenId);
        if (
            p.sevenId &&
            (!eligibleOrdinaryPerson(candidate) ||
                candidate.data.encountersLeft > 6)
        )
            p.sevenId = null;
        const selected = world.selected;
        if (selected && selected.data.id !== p.sixId)
            p.sevenId =
                eligibleOrdinaryPerson(selected) &&
                selected.data.encountersLeft <= 6
                    ? selected.data.id
                    : null;
    }
    function prepareSixSevenForTesting(world, six, seven) {
        world.developmentUsed = true;
        // Explicit developer presentation: bypass eligibility, then use the real ending/cleanup.
        // Snapshot existing figures rather than spawning or changing anyone's number.
        if (!NL.claimEnding(world, 'six-seven')) return false;
        resetSixSevenProgress(world);
        world.sixSeven = {
            time: 0,
            figures: [six, seven].map((view, i) => ({
                id: view?.data.id || null,
                number: i === 0 ? 6 : 7,
                x: view?.x ?? world.c.WIDTH * (i === 0 ? 0.3 : 0.7),
                y: view ? view.y - 37 : world.c.HEIGHT / 2
            }))
        };
        return true;
    }

    function updateSixSevenEnding(world, dt) {
        const timing = world.c.SIX_SEVEN;
        world.sixSeven.time += dt;
        return world.sixSeven.time >= timing.FADE_SECONDS + timing.GROW_SECONDS;
    }

    function drawSixSevenEnding(ctx, world, reducedMotion) {
        const config = world.c;
        const ending = world.sixSeven;
        const fade = NL.smooth(ending.time / config.SIX_SEVEN.FADE_SECONDS);
        const growth = NL.smooth(
            (ending.time - config.SIX_SEVEN.FADE_SECONDS) /
                config.SIX_SEVEN.GROW_SECONDS
        );
        // Everyone stays still. The figures disappear; only the two numerals remain.
        if (fade < 1) {
            for (const character of [world.player, ...world.views.values()]) {
                const opacity = character.opacity;
                character.opacity *= 1 - fade;
                if (character.data?.kind === 'letter') {
                    NL.drawLetter(ctx, character, config);
                } else {
                    const triggered = ending.figures.some(
                        (figure) => figure.id === character.data?.id
                    );
                    NL.drawCharacter(
                        ctx,
                        character,
                        config,
                        reducedMotion,
                        triggered ? null : undefined
                    );
                }
                character.opacity = opacity;
            }
        }
        ctx.save();
        ctx.fillStyle = config.PALETTE.ink;
        ctx.textAlign = 'center';
        ctx.font = `${NL.lerp(12, config.HEIGHT * 1.08, growth)}px Georgia, serif`;
        ending.figures.forEach((figure, index) => {
            // Separate the small numerals while the figures fade, before enlargement.
            const x = NL.lerp(
                figure.x,
                config.WIDTH * (index === 0 ? 0.3 : 0.7),
                fade
            );
            const y = NL.lerp(figure.y, config.HEIGHT * 0.8, growth);
            ctx.fillText(String(figure.number), x, y);
        });
        ctx.restore();
    }
    Object.assign(NL, {
        resetSixSevenProgress,
        noteSixSevenTransfer,
        updateSixSevenDiscovery,
        prepareSixSevenForTesting,
        displayedEncounters,
        visibleOrdinaryPerson,
        checkSixSevenEnding,
        updateSixSevenEnding,
        drawSixSevenEnding
    });
})();
