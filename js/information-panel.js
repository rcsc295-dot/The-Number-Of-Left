// TELEVISION — one priority stack: completed pair, major narrative, discovery, ordinary company.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    function initializeTelevision(world) {
        world.television = {
            collectionUnlocked: false,
            protectedTakeUntil: 0,
            current: null,
            queue: [],
            seen: new Set()
        };
    }
    function televisionHint(
        world,
        id,
        title,
        text,
        priority = 50,
        scoreboard = null
    ) {
        const tv = world.television;
        if (tv.seen.has(id)) return;
        tv.seen.add(id);
        if (scoreboard) {
            if (tv.current?.scoreboard) tv.current = null;
            tv.queue = tv.queue.filter((item) => !item.scoreboard);
        }
        const item = {
            id,
            title,
            text,
            priority,
            scoreboard,
            elapsed: 0,
            duration: scoreboard ? Infinity : 7
        };
        if (!tv.current) tv.current = item;
        else if (priority > tv.current.priority) {
            tv.queue.unshift(tv.current);
            tv.current = item;
        } else tv.queue.push(item);
        tv.queue = tv.queue.slice(0, 6);
    }
    function dismissTelevision(world) {
        world.television.current = world.television.queue.shift() || null;
    }
    function updateTelevision(world, dt) {
        const item = world.television.current;
        if (item) {
            item.elapsed += dt;
            if (item.elapsed >= item.duration) dismissTelevision(world);
        }
    }
    function protectedTakeHint(world, data) {
        const tv = world.television;
        if (world.time < tv.protectedTakeUntil) return;
        tv.protectedTakeUntil =
            world.time + world.c.FAMILY_AVAILABILITY.TAKE_HINT_COOLDOWN;
        televisionHint(
            world,
            'protected-take-' + world.time,
            'Time to give',
            NL.isBloodRelative(data)
                ? 'You cannot take time from those who gave you so much. Perhaps you should give some of yours.'
                : 'This time cannot be taken. Try giving a meeting instead.',
            70
        );
        if (data.kind === 'letter') NL.showFamilyWarning(world);
    }
    function familyDiscovery(world, data, activated = false) {
        if (data.kind !== 'letter') return;
        if (data.id === 'letter-F' && !activated)
            televisionHint(
                world,
                'family-first',
                'F…',
                'A single letter. It seems to be waiting for something.',
                65
            );
        if (!activated) return;
        const index = world.family.letters.indexOf(data),
            clues = [
                ['F · A', 'Another letter may find its way here.'],
                ['F · A · M', 'There seems to be a connection between them.'],
                [
                    'Father and Mother…',
                    'The first letters begin to sound like a sentence.'
                ],
                ['…I…', 'Something remains to be said.'],
                ['…Love…', 'The sentence is almost here.'],
                ['Father and Mother, I love you.', '']
            ];
        if (index >= 0)
            televisionHint(
                world,
                'family-' + index,
                clues[index][0],
                clues[index][1],
                65
            );
    }
    function routineMessage(world) {
        if (world.television.collectionUnlocked)
            return {
                title: 'Collected opportunities',
                text: '',
                scoreboard: [
                    String(world.collectedIds.size),
                    String(world.c.COLLECTION_THRESHOLD)
                ]
            };
        return {
            title: 'The people who remain',
            text: 'Move closer to someone. A meeting can be taken, or given back.'
        };
    }
    function renderInformationPanel(game) {
        const w = game.world,
            panel = game.ui['information-panel'];
        panel.hidden = game.scene !== 'world' || !w;
        if (panel.hidden) return;
        const major = w.narrative.current,
            pending = w.sixSevenProgress.pending;
        const relative = w.selected?.data;
        const family = NL.isBloodRelative(relative)
            ? {
                  title: relative.familyRole || 'Relative',
                  text: relative.selfProfile
              }
            : null;
        // Family identity is contextual, not a timed or gift-unlocked notification.
        const hint = family ? null : w.television.current;
        const hintText = family
            ? family.title + ': ' + family.text
            : hint?.text || '';
        const pair = w.sixSevenProgress;
        const candidate = w.views.get(pair.sevenId);
        const content =
            major ||
            (pair.sixId
                ? {
                      title: 'Two people. Two numbers.',
                      // Short hints share the screen below the live numbers, without hiding their changes.
                      text: pending ? '' : hintText,
                      scoreboard: [
                          '6',
                          pending
                              ? '7'
                              : candidate
                                ? String(candidate.data.encountersLeft)
                                : '?'
                      ]
                  }
                : family || hint || routineMessage(w));
        // Keep unestablished identities anonymous even in a connected group's consequence.
        // Only presentation text changes; saved identities and history remain intact.
        const anonymousNames = w.population
            .filter(
                (person) =>
                    person.relationship !== 'FRIEND' &&
                    !NL.isBloodRelative(person)
            )
            .map((person) => person.name);
        const message = { ...content };
        for (const name of anonymousNames) {
            message.title = message.title.replaceAll(name, 'Someone');
            message.text = message.text.replaceAll(name, 'someone');
        }
        const mode =
            major?.kind ||
            (message.scoreboard
                ? 'scoreboard'
                : hint
                  ? 'discovery'
                  : 'ordinary');
        panel.dataset.mode = mode;
        game.ui['collection-tracker'].hidden = true;
        game.ui['collection-number'].textContent = w.collectedIds.size;
        game.ui['collection-goal'].textContent = w.c.COLLECTION_THRESHOLD;
        if (
            game.ui['information-title'].textContent !== message.title ||
            game.ui['information-text'].textContent !== message.text
        ) {
            game.ui['information-title'].textContent = message.title;
            game.ui['information-text'].textContent = message.text;
            game.ui['tv-screen'].scrollTop = 0;
        }
        const board = game.ui['six-seven-scoreboard'];
        board.hidden = !message.scoreboard;
        panel.querySelector('.information-meta').hidden = !!message.scoreboard;
        game.ui['information-title'].hidden = !!message.scoreboard;
        game.ui['information-text'].hidden =
            !!message.scoreboard && !message.text;
        game.ui['information-actions'].hidden = !!message.scoreboard;
        if (message.scoreboard) {
            game.ui['score-six'].textContent = message.scoreboard[0];
            game.ui['score-seven'].textContent = message.scoreboard[1];
            board.setAttribute('aria-label', message.scoreboard.join(' / '));
        }
        const signature =
            mode +
            '|' +
            (major?.type || (family && relative.id) || hint?.id || '') +
            '|' +
            (major?.ids?.join(',') || '') +
            '|' +
            (major?.choices?.map((c) => c.id).join(',') || '');
        if (game.informationSignature !== signature) {
            const actions = game.ui['information-actions'];
            actions.replaceChildren();
            if (major?.kind === 'decision')
                for (const choice of major.choices) {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.dataset.choice = choice.id;
                    let label = choice.label;
                    for (const name of anonymousNames)
                        label = label.replaceAll(name, 'someone');
                    b.textContent = label;
                    actions.append(b);
                }
            else if (!message.scoreboard && (major || hint)) {
                const b = document.createElement('button');
                b.type = 'button';
                if (major) b.dataset.dismissNarrative = 'true';
                else b.dataset.dismissTelevision = 'true';
                b.textContent = 'Continue';
                actions.append(b);
            }
            game.informationSignature = signature;
        }
        const places = w.places.markers;
        game.ui['environment-actions'].hidden =
            !places.length ||
            !!major ||
            !!pair.sixId ||
            !!hint ||
            (!!game.panel && game.panel !== 'control');
        for (const button of game.ui['environment-actions'].querySelectorAll(
            '[data-place]'
        ))
            button.hidden = !places.some(
                (place) => place.id === button.dataset.place
            );
    }
    function bindInformationPanel(game) {
        game.ui['information-actions'].addEventListener('click', (event) => {
            const b = event.target.closest('button');
            if (
                !b ||
                !game.world ||
                game.paused ||
                (game.panel &&
                    !['control', 'relationships'].includes(game.panel))
            )
                return;
            if (b.dataset.choice) {
                if (game.world.narrative.current?.type?.startsWith('place-'))
                    NL.resolvePlaceChoice(game.world, b.dataset.choice);
                else NL.resolveFriendshipChoice(game.world, b.dataset.choice);
            } else if (b.dataset.dismissNarrative)
                NL.dismissNarrative(game.world);
            else if (b.dataset.dismissTelevision) dismissTelevision(game.world);
            game.input.releaseAll();
            renderInformationPanel(game);
            game.canvas.focus();
        });
    }
    Object.assign(NL, {
        initializeTelevision,
        televisionHint,
        dismissTelevision,
        updateTelevision,
        protectedTakeHint,
        familyDiscovery,
        renderInformationPanel,
        bindInformationPanel
    });
})();
