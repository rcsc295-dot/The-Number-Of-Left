// DEVELOPER — one responsibility; shared systems live on NumberLeft.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    function developmentMode() {
        return (
            NL.CONFIG.DEBUG ||
            (typeof location !== 'undefined' &&
                new URLSearchParams(location.search).get('dev') === '1')
        );
    }
    const CONTROL_SECTIONS = [
        [
            'ENDINGS',
            NL.ENDING_DEFINITIONS.map((ending) => [ending.action, ending.label])
        ],
        [
            'Player & world',
            [
                ['held0', 'Held: 0'],
                ['held1', 'Held: +1'],
                ['held5', 'Held: +5'],
                ['held10', 'Held: +10'],
                ['held-set', 'Set held'],
                ['total-set', 'Set total taken'],
                ['collection49', 'Collected: 49'],
                ['time-reset', 'Reset collection'],
                ['world-pause', 'Pause'],
                ['world-resume', 'Resume'],
                ['main', 'Main game'],
                ['title', 'Title'],
                ['restart', 'Restart']
            ]
        ],
        [
            'People',
            [
                ['spawn', 'Spawn stranger'],
                ['nearest', 'Select nearest'],
                ['char1', '+1 encounter'],
                ['char-1', '−1 encounter'],
                ['zero', 'Set to 0'],
                ['return', 'Return'],
                ['remove', 'Remove'],
                ['relationships', 'Friendship list']
            ]
        ],
        [
            'Friendship Union',
            [
                ['gift5', '+5 gifts'],
                ['friend', 'Make friend'],
                ['relationship-reset', 'Reset relationship'],
                ['follow-selected', 'Follow: 30s'],
                ['followers-group', 'Six followers'],
                ['social-circle', 'Friendship circle'],
                ['event-growth', 'Introduction'],
                ['reunion-test', 'Reunion']
            ]
        ],
        [
            'Different Way',
            [
                ['event-romance', 'Romance'],
                ['event-move', 'Moving away'],
                ['event-drift', 'Distance'],
                ['event-conflict', 'Conflict']
            ]
        ],
        [
            'Special characters',
            [
                ['spawn-six', 'Spawn 6 · discovery'],
                ['spawn-seven', 'Spawn 7'],
                ['family-person-Father', 'Father'],
                ['family-person-Mother', 'Mother'],
                ['family-person-Grandpa', 'Grandpa'],
                ['family-person-Grandma', 'Grandma'],
                ['family-person-Biker Grandma', 'Biker Grandma'],
                ['affection-person', 'Colour-changing person'],
                ['affection-0', 'Affection: 0'],
                ['affection-25', 'Affection: 25'],
                ['affection-50', 'Affection: 50'],
                ['affection-75', 'Affection: 75'],
                ['affection-100', 'Affection: 100'],
                ['family-spawn-0', 'Letter F'],
                ['family-spawn-1', 'Letter A'],
                ['family-spawn-2', 'Letter M'],
                ['family-spawn-3', 'Letter I'],
                ['family-spawn-4', 'Letter L'],
                ['family-spawn-5', 'Letter Y'],
                ['family-advance', 'Advance letter to 5'],
                ['family-reset', 'Reset letters']
            ]
        ],
        [
            'Environment',
            [
                ['place-car', 'Show Car'],
                ['place-remove-car', 'Remove Car'],
                ['place-house', 'Show Home'],
                ['place-remove-house', 'Remove Home'],
                ['place-city', 'Show Different City'],
                ['place-remove-city', 'Remove Different City'],
                ['place-random', 'Random prototype'],
                ['place-clear', 'Clear prototypes']
            ]
        ]
    ];

    class DeveloperControls {
        constructor(game) {
            this.game = game;
            this.selectedId = null;
            this.message = 'Developer actions bypass the encounter economy.';
        }

        get world() {
            return this.game.ensureWorld();
        }

        selected(world) {
            return [...world.population, ...world.family.letters].find(
                (d) => d.id === this.selectedId
            );
        }

        requireSelected(world) {
            const d = this.selected(world);
            if (!d) {
                throw new RangeError('Select a person or letter first.');
            }
            return d;
        }

        setEncounters(world, d, count) {
            if (d.permanentlyGone) {
                throw new RangeError(
                    'Permanently absent. Force Return cannot restore this identity.'
                );
            }
            if (d.kind === 'person' && d.lifeStatus !== 'present')
                throw new RangeError(
                    'This person has left. Use reunion testing to bring back an eligible friend.'
                );
            d.encountersLeft = NL.clamp(
                Math.trunc(count),
                0,
                world.c.DEV_MAX_ENCOUNTERS
            );
            const v = world.views.get(d.id);
            if (d.encountersLeft === 0) {
                if (v) {
                    NL.retireCharacter(world, v);
                } else {
                    d.permanentlyGone = true;
                    d.active = false;
                }
            }
            world.revision++;
            world.family.checkUnlocks();
        }

        makeFriend(world, d) {
            if (d.kind !== 'person') {
                throw new RangeError(
                    'Letters do not have human relationships.'
                );
            }
            d.giftedEncounters = Math.max(
                d.giftedEncounters,
                world.c.FRIEND_GIFT_THRESHOLD
            );
            d.relationship = 'FRIEND';
            d.strength = Math.max(d.strength, 40);
            d.relationshipState = 'warm';
            NL.recordInteraction(world, d, 'friend', {
                source: 'presentation'
            });
            world.revision++;
        }

        spawnStranger(world, template = null) {
            if (world.population.length >= world.c.DEV_MAX_POPULATION) {
                throw new RangeError('Developer population limit reached.');
            }
            const d = new NL.CharacterData(
                `person-${String(world.population.length + 1).padStart(2, '0')}`,
                template,
                world.rng,
                world.c
            );
            NL.initializeIdentity(world, d);
            NL.alignOpportunities(world, d);
            if (!world.recurrence.arrive(d, true, true)) {
                world.usedNames.delete(d.name);
                throw new RangeError(
                    'There is no open place for another visible person yet.'
                );
            }
            world.population.push(d);
            const v = world.views.get(d.id);
            NL.keepInEnvironment(world, v);
            v.pauseLeft = 0;
            world.randomTarget(v);
            this.selectedId = d.id;
            world.revision++;
            return d;
        }

        showSpecial(world, role = null) {
            let data = world.population.find((d) =>
                role ? d.familyRole === role : d.template?.progressiveColour
            );
            if (!data) {
                const template = role
                    ? NL.familyTemplate(
                          role,
                          world.rng,
                          world.c,
                          world.population
                              .filter((d) => d.familyRole)
                              .map((d) => d.initialEncounters)
                      )
                    : {
                          ...NL.AFFECTION_CHARACTER,
                          colour: world.c.AFFECTION_PERSON.COLOUR
                      };
                data = this.spawnStranger(world, template);
            } else {
                if (
                    data.permanentlyGone ||
                    data.lifeStatus !== 'present' ||
                    (NL.isBloodRelative(data) &&
                        data.availability === 'long_distance' &&
                        !data.active)
                )
                    throw new RangeError(
                        'This identity has left. Use an eligible reunion or Restart; this tool does not erase history.'
                    );
                if (!data.active && !world.recurrence.arrive(data, true, true))
                    throw new RangeError('No room for this person yet.');
                this.selectedId = data.id;
            }
            const view = world.views.get(data.id);
            view.state = 'present';
            NL.keepInEnvironment(world, view);
            view.pauseLeft = 0;
            world.randomTarget(view);
            view.visitLeft = Math.max(view.visitLeft, 30);
            NL.updateAppearance(view, world.c);
            world.revision++;
            return data;
        }

        spawnNumberedPerson(world, number) {
            world.developmentUsed = true;
            const position = NL.getSafeSpawnPosition(world);
            if (!position) {
                throw new RangeError(
                    'No visible space. Close the panel or enlarge the window, then retry.'
                );
            }
            const data = this.spawnStranger(world);
            data.encountersLeft = number;
            const character = world.views.get(data.id);
            character.x = position.x;
            character.y = position.y;
            world.randomTarget(character);
            character.previousNumber = number;
            character.pauseLeft = 0;
            character.visitLeft = Math.max(character.visitLeft, 30);
            return character;
        }

        triggerSixSeven(world) {
            // A direct presentation uses existing figures, even at the spawn limit.
            const people = [...world.views.values()].filter(
                (v) => v.data.kind === 'person' && v.state === 'present'
            );
            NL.prepareSixSevenForTesting(world, people[0], people[1]);
        }

        unlock(world, index) {
            while (world.family.letters.length <= index) {
                const previous = world.family.letters.at(-1);
                if (previous && !previous.activated) {
                    this.setEncounters(
                        world,
                        previous,
                        world.c.FAMILY_THRESHOLD
                    );
                }
                if (!world.family.spawnNext()) {
                    throw new RangeError(
                        'No safe space is visible. Close the panel or enlarge the window, then retry.'
                    );
                }
            }
            return world.family.letters[index];
        }

        triggerFamily(world) {
            world.family.trigger();
            this.game.checkEndings();
        }

        numericInput(id) {
            const raw = this.game.ui[id].value;
            const value = Number(raw);
            if (
                raw.trim() === '' ||
                !Number.isInteger(value) ||
                value < 0 ||
                value > this.game.c.DEV_MAX_ENCOUNTERS
            ) {
                throw new RangeError(
                    'Enter a whole number from 0 to ' +
                        this.game.c.DEV_MAX_ENCOUNTERS +
                        '.'
                );
            }
            return value;
        }

        run(action) {
            try {
                const g = this.game;
                if (action === 'title') {
                    g.returnToTitle();
                    this.message =
                        'Returned to title. PLAY starts the introduction.';
                    return;
                }
                if (action === 'restart') {
                    g.returnDirectlyToGameplay();
                    this.message = 'Fresh world; tutorial history retained.';
                    return;
                }
                if (action === 'world-pause' || action === 'world-resume') {
                    g.setPaused(action === 'world-pause');
                    this.message =
                        action === 'world-pause' ? 'Paused.' : 'Resumed.';
                    return;
                }
                if (action === 'family-reset' || action === 'time-reset') {
                    g.resetEnding(
                        action === 'family-reset' ? 'family' : 'time'
                    );
                    g.world.developmentUsed = true;
                    this.message = 'Presentation state reset.';
                    return;
                }
                if (action === 'relationships') {
                    g.showPanel('relationships');
                    return;
                }
                const w = this.world;
                g.updateSpawnAreas();
                const directEnding = [
                    'family-end',
                    'family-trigger',
                    'six-seven-end',
                    'six-seven-trigger',
                    'time-end'
                ].includes(action);
                if (
                    w.endingTriggered ||
                    (w.sixSevenProgress.pending && !directEnding)
                ) {
                    throw new RangeError(
                        'An ending has begun. Use its reset button or Restart before another demonstration.'
                    );
                }
                if (!['nearest', 'main'].includes(action))
                    w.developmentUsed = true;
                if (directEnding) NL.resetSixSevenProgress(w);
                if (
                    action.startsWith('family-person-') ||
                    action.startsWith('affection-')
                ) {
                    if (action.startsWith('family-person-'))
                        this.showSpecial(w, action.slice(14));
                    else {
                        const data = this.showSpecial(w);
                        if (action !== 'affection-person') {
                            const value = Number(action.slice(10));
                            if (![0, 25, 50, 75, 100].includes(value))
                                throw new RangeError(
                                    'Unknown relationship preview.'
                                );
                            data.strength = value;
                        }
                    }
                    this.message =
                        'Special character selected. Close CONTROL to see them; relationship previews do not change encounter numbers.';
                    g.syncUI();
                    return;
                }
                if (
                    [
                        'followers-group',
                        'follow-selected',
                        'place-car',
                        'place-house',
                        'place-city',
                        'place-random',
                        'place-remove-car',
                        'place-remove-house',
                        'place-remove-city',
                        'place-clear',
                        'place-reset'
                    ].includes(action)
                ) {
                    if (action === 'followers-group') {
                        const group = [...w.views.values()]
                            .filter(
                                (v) =>
                                    v.data.kind === 'person' &&
                                    !NL.isBloodRelative(v.data) &&
                                    !v.data.briefEncounter &&
                                    v.state === 'present'
                            )
                            .slice(0, 6)
                            .map((v) => v.data);
                        for (const d of w.population) {
                            d.connections = [];
                            d.socialTies = {};
                        }
                        for (const d of group) {
                            d.giftedEncounters = 5;
                            d.relationship = 'FRIEND';
                            d.strength = 40;
                            d.traits = ['Sensitive'];
                            d.connections = [];
                            d.socialTies = {};
                            NL.renewFollowing(w, d, 'presentation');
                        }
                        for (let i = 0; i < group.length; i++)
                            NL.connectPeople(
                                w,
                                group[i],
                                group[(i + 1) % group.length],
                                85
                            );
                        this.selectedId = group[0]?.id;
                    } else if (action === 'follow-selected')
                        NL.renewFollowing(
                            w,
                            this.requireSelected(w),
                            'presentation'
                        );
                    else if (
                        action === 'place-clear' ||
                        action === 'place-reset'
                    ) {
                        NL.clearPlaces(w);
                    } else if (action.startsWith('place-remove-')) {
                        NL.removePlace(w, action.slice(13));
                    } else if (action === 'place-random') {
                        const missing = ['car', 'house', 'city'].filter(
                            (id) => !w.places.markers.some((p) => p.id === id)
                        );
                        if (missing.length)
                            NL.spawnPlace(
                                w,
                                missing[Math.floor(w.rng() * missing.length)]
                            );
                    } else NL.spawnPlace(w, action.slice(6));
                    g.syncUI();
                    this.message = 'Test ready.';
                    return;
                }
                if (action === 'main') {
                    g.beginWorld(true);
                    this.message = 'Main world ready.';
                    return;
                }
                if (
                    action.startsWith('event-') ||
                    [
                        'social-circle',
                        'reunion-test',
                        'collection49',
                        'collection50'
                    ].includes(action)
                ) {
                    if (action === 'social-circle') {
                        const circle = [...w.views.values()]
                            .filter(
                                (v) =>
                                    v.data.kind === 'person' &&
                                    !NL.isBloodRelative(v.data) &&
                                    !v.data.briefEncounter &&
                                    v.state === 'present'
                            )
                            .slice(0, 3)
                            .map((v) => v.data);
                        circle.forEach((data, index) => {
                            data.giftedEncounters = 5;
                            data.relationship = 'FRIEND';
                            data.strength = 40;
                            data.traits =
                                index === 0
                                    ? ['Sensitive', 'Independent']
                                    : index === 1
                                      ? ['Sensitive']
                                      : ['Reserved'];
                            NL.recordInteraction(w, data, 'friend', {
                                source: 'presentation'
                            });
                        });
                        for (const a of circle)
                            for (const b of circle)
                                if (a !== b) NL.connectPeople(w, a, b, 80);
                        this.selectedId = circle[0]?.id;
                    } else if (action.startsWith('event-')) {
                        if (
                            !NL.startFriendshipEvent(
                                w,
                                action.slice(6),
                                this.selectedId
                            )
                        )
                            throw new RangeError(
                                'No eligible friendship, or another narrative is open.'
                            );
                    } else if (action === 'reunion-test') {
                        const canTest = (d) =>
                            d &&
                            !d.permanentlyGone &&
                            !d.active &&
                            (d.lifeStatus === 'departed' ||
                                (NL.isBloodRelative(d) && !!d.familyDistance));
                        const selected = this.selected(w);
                        const data = canTest(selected)
                            ? selected
                            : w.population.find(canTest);
                        if (!data)
                            throw new RangeError(
                                'No departed friend is eligible for a reunion.'
                            );
                        data.absenceUntil = w.socialClock.time;
                        if (!NL.returnFriend(w, data))
                            throw new RangeError(
                                'Close the current story or make room for the returning friend.'
                            );
                    } else
                        NL.setCollectedForTesting(
                            w,
                            action === 'collection49' ? 49 : 50
                        );
                    g.checkEndings();
                    g.input.clear();
                    g.syncUI();
                    this.message = 'Presentation change applied.';
                    return;
                }
                if (/^held(0|1|5|10)$/.test(action)) {
                    const n = Number(action.slice(4));
                    w.player.heldEncounters =
                        n === 0
                            ? 0
                            : Math.min(
                                  w.c.DEV_MAX_ENCOUNTERS,
                                  w.player.heldEncounters + n
                              );
                } else if (action === 'held-reset') {
                    w.player.heldEncounters = 0;
                } else if (action === 'held-set') {
                    w.player.heldEncounters = this.numericInput('dev-held');
                } else if (action === 'total-set') {
                    w.player.totalTaken = this.numericInput('dev-total');
                } else if (action === 'total49' || action === 'total50') {
                    w.player.totalTaken = action === 'total49' ? 49 : 50;
                } else if (action === 'total1' || action === 'total10') {
                    w.player.totalTaken = Math.min(
                        w.c.DEV_MAX_ENCOUNTERS,
                        w.player.totalTaken + (action === 'total1' ? 1 : 10)
                    );
                } else if (action === 'time-end') {
                    NL.setCollectedForTesting(w, w.c.COLLECTION_THRESHOLD);
                    NL.checkTakenEnding(w);
                } else if (action === 'spawn-six' || action === 'spawn-seven') {
                    // Explicit development-only pairing; ordinary gifts still own normal eligibility.
                    NL.updateSixSevenDiscovery(w, 0);
                    const progress = w.sixSevenProgress;
                    const number = action === 'spawn-six' ? 6 : 7;
                    if (number === 7 && !w.views.has(progress.sixId))
                        throw new RangeError(
                            'Spawn 6 first; its candidate must be here.'
                        );
                    const id = number === 6 ? progress.sixId : progress.sevenId;
                    let view = w.views.get(id);
                    if (id && !view)
                        throw new RangeError(
                            'The candidate is away. Bring them back or Restart.'
                        );
                    if (!view) view = this.spawnNumberedPerson(w, number);
                    this.setEncounters(w, view.data, number);
                    view.previousNumber = number;
                    view.pauseLeft = 0;
                    w.randomTarget(view);
                    this.selectedId = view.data.id;
                    NL.noteSixSevenTransfer(w, view, 'developer');
                } else if (
                    action === 'six-seven-end' ||
                    action === 'six-seven-trigger'
                ) {
                    this.triggerSixSeven(w);
                } else if (action === 'spawn' || action === 'population+') {
                    this.spawnStranger(w);
                } else if (action === 'nearest') {
                    let nearest = null;
                    let best = Infinity;
                    for (const v of w.views.values()) {
                        if (
                            !v.data.permanentlyGone &&
                            NL.distance(v, w.player) < best
                        ) {
                            nearest = v;
                            best = NL.distance(v, w.player);
                        }
                    }
                    if (!nearest) {
                        throw new RangeError(
                            'No visible interactive object. Spawn a stranger first.'
                        );
                    }
                    this.selectedId = nearest.data.id;
                } else if (['char1', 'char-1', 'zero'].includes(action)) {
                    const d = this.requireSelected(w);
                    this.setEncounters(
                        w,
                        d,
                        action === 'zero'
                            ? 0
                            : d.encountersLeft + (action === 'char1' ? 1 : -1)
                    );
                } else if (action === 'gift5') {
                    const d = this.requireSelected(w);
                    if (d.permanentlyGone) {
                        throw new RangeError(
                            'Cannot gift to a permanently absent identity.'
                        );
                    }
                    if (d.kind !== 'person') {
                        throw new RangeError(
                            'Letters do not have human gift history. Use +1 encounter or a threshold tool.'
                        );
                    }
                    d.giftedEncounters += 5;
                    this.setEncounters(w, d, d.encountersLeft + 5);
                    NL.addRecognition(d, 5 * w.c.GIFT_RECOGNITION, w.c);
                    NL.updateRelationship(d, w.c);
                } else if (
                    action === 'friend' ||
                    action === 'relationship-friend'
                ) {
                    this.makeFriend(w, this.requireSelected(w));
                } else if (action === 'relationship-reset') {
                    const d = this.requireSelected(w);
                    if (d.kind !== 'person') {
                        throw new RangeError(
                            'Letters do not have human relationships.'
                        );
                    }
                    d.giftedEncounters = 0;
                    d.relationship = 'STRANGER';
                    d.strength = 0;
                    d.relationshipState = 'new';
                    NL.stopFollowing(d);
                    d.timesMet = 0;
                    d.recognitionPoints = 0;
                    d.recognitionLevel = 0;
                    d.visualStage = 0;
                    NL.updateRelationship(d, w.c); // Does not rewind the numeric economy.
                } else if (action === 'return') {
                    const d = this.requireSelected(w);
                    if (d.permanentlyGone || d.encountersLeft <= 0) {
                        throw new RangeError(
                            'Permanently absent identities never return.'
                        );
                    }
                    if (d.kind === 'letter') {
                        throw new RangeError(
                            'Letters drift in the world; they do not recur.'
                        );
                    }
                    if (
                        d.lifeStatus !== 'present' ||
                        (NL.isBloodRelative(d) &&
                            d.availability === 'long_distance' &&
                            !d.active)
                    )
                        throw new RangeError(
                            'This friend has departed. Use an eligible reunion; Force return only restores routine visits.'
                        );
                    if (!d.active && !w.recurrence.arrive(d, true, true))
                        throw new RangeError(
                            'There is no open space for this person yet.'
                        );
                    const v = w.views.get(d.id);
                    v.state = 'present';
                    v.x = NL.clamp(
                        w.player.x + 32,
                        w.bounds.left,
                        w.bounds.right
                    );
                    v.y = w.player.y;
                    v.pauseLeft = 0;
                    w.randomTarget(v);
                    v.visitLeft = NL.range(w.rng, w.c.RETURN.VISIT);
                } else if (action === 'remove' || action === 'population-') {
                    const d =
                        action === 'remove'
                            ? this.requireSelected(w)
                            : [...w.population]
                                  .reverse()
                                  .find((d) => !d.permanentlyGone);
                    if (!d) {
                        throw new RangeError('No remaining person to remove.');
                    }
                    this.setEncounters(w, d, 0);
                    w.views.delete(d.id);
                    d.active = false;
                } else if (action.startsWith('family-spawn-')) {
                    this.unlock(w, Number(action.at(-1)));
                } else if (action.startsWith('family-set-')) {
                    const d = this.unlock(w, Number(action.at(-1)));
                    this.setEncounters(w, d, w.c.FAMILY_THRESHOLD);
                } else if (action === 'family-advance') {
                    let d = w.family.letters.at(-1);
                    if (!d || d.activated) {
                        d = w.family.spawnNext();
                    }
                    if (d) {
                        this.setEncounters(w, d, w.c.FAMILY_THRESHOLD);
                    }
                } else if (
                    action === 'family-trigger' ||
                    action === 'family-end'
                ) {
                    this.triggerFamily(w);
                } else {
                    throw new RangeError(
                        `Unrecognized developer action: ${action}`
                    );
                }
                w.revision++;
                this.message = `${action.replaceAll('-', ' ')} — applied.`;
                g.checkEndings();
                g.input.clear();
                g.syncUI();
            } catch (error) {
                if (!(error instanceof RangeError)) throw error;
                this.message = error.message;
            }
        }
    }
    Object.assign(NL, { CONTROL_SECTIONS, DeveloperControls, developmentMode });
})();
