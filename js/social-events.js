// SOCIAL EVENTS — eligibility, visible warnings, choices, departures and reunions.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    function friendsInWorld(world) {
        return world.population.filter(
            (d) =>
                d.relationship === 'FRIEND' &&
                d.lifeStatus === 'present' &&
                !d.permanentlyGone &&
                d.active &&
                world.views.get(d.id)?.state === 'present'
        );
    }
    function leaveFriend(
        world,
        data,
        reason,
        choice,
        delay = 0,
        irreversible = false,
        farewell = 'unfinished',
        silent = false
    ) {
        if (
            world.endingTriggered ||
            world.sixSevenProgress.pending ||
            data.lifeStatus !== 'present' ||
            data.permanentlyGone
        )
            return false;
        if (NL.isBloodRelative(data))
            return leaveFamilyForDistance(
                world,
                data,
                reason,
                choice,
                delay,
                farewell,
                silent
            );
        NL.alignOpportunities(world, data);
        const departure = {
            reason,
            choice,
            lost: data.encountersLeft,
            at: world.socialClock.time,
            farewell,
            irreversible
        };
        data.departures.push(departure);
        data.lifeStatus = irreversible ? 'closed' : 'departed';
        data.active = false;
        NL.stopFollowing(data);
        if (world.television.current?.title === data.name)
            world.television.current = null;
        world.television.queue = world.television.queue.filter(
            (item) => item.title !== data.name
        );
        data.location = 'away';
        data.relationshipState = 'absent';
        data.absenceUntil = world.socialClock.time + world.c.SOCIAL.MIN_ABSENCE;
        data.opportunities = []; // Lost opportunities are not credited or transferred to the player.
        NL.recordInteraction(world, data, 'departure', departure);
        const view = world.views.get(data.id);
        if (view) {
            view.state = 'farewell';
            view.moving = false;
            view.farewellTime = -delay;
            view.pauseLeft = Infinity;
        }
        if (world.selected?.data.id === data.id) world.selected = null;
        NL.updateSixSevenDiscovery(world, 0);
        world.revision++;
        if (!silent)
            NL.showNarrative(
                world,
                data.name + ' has left',
                NL.departureStory(world, data, departure)
            );
        return true;
    }
    function leaveFamilyForDistance(
        world,
        data,
        reason,
        choice,
        delay,
        farewell,
        silent
    ) {
        // Only a named major life event can change family accessibility. Conflict/quiet drift cannot do so.
        if (
            !['move', 'relocation', 'study_abroad', 'work_abroad'].includes(
                reason
            ) ||
            typeof choice !== 'string' ||
            !choice.trim() ||
            world.endingTriggered ||
            world.sixSevenProgress.pending ||
            (!data.active && data.familyDistance)
        )
            return false;
        const departure = {
            reason,
            choice,
            lost: 0,
            retained: data.encountersLeft,
            at: world.socialClock.time,
            farewell,
            irreversible: false,
            familyDistance: true
        };
        data.departures.push(departure);
        data.familyDistance = departure;
        data.availability = 'long_distance';
        data.active = false;
        data.location = 'another place';
        data.absenceUntil =
            world.socialClock.time +
            NL.range(
                world.rng,
                world.c.FAMILY_AVAILABILITY.LONG_DISTANCE_DELAY
            );
        NL.stopFollowing(data);
        NL.recordInteraction(world, data, 'family-relocation', departure);
        NL.recordInteraction(world, data, 'departure', departure);
        if (world.television.current?.title === data.name)
            world.television.current = null;
        world.television.queue = world.television.queue.filter(
            (item) => item.title !== data.name
        );
        const view = world.views.get(data.id);
        if (view)
            Object.assign(view, {
                state: 'farewell',
                waitingTarget: null,
                moving: false,
                farewellTime: -delay,
                pauseLeft: Infinity
            });
        if (world.selected?.data.id === data.id) world.selected = null;
        NL.updateSixSevenDiscovery(world, 0);
        world.revision++;
        if (!silent)
            NL.showNarrative(
                world,
                data.name + ' will be farther away',
                NL.departureStory(world, data, departure)
            );
        return true;
    }

    function updateDepartures(world, dt, includeFinal = false) {
        for (const view of world.views.values()) {
            if (includeFinal && view.state === 'final') {
                view.finalElapsed += dt;
                view.opacity =
                    1 -
                    NL.clamp(
                        (view.finalElapsed - world.c.FINAL_HOLD) /
                            world.c.FINAL_FADE,
                        0,
                        1
                    );
                if (view.opacity <= 0) {
                    view.data.active = false;
                    world.views.delete(view.data.id);
                }
            }
            if (view.state === 'farewell') {
                view.farewellTime += dt;
                view.opacity =
                    1 -
                    NL.smooth(
                        view.farewellTime / world.c.SOCIAL.FAREWELL_SECONDS
                    );
                if (view.opacity <= 0) world.views.delete(view.data.id);
            }
        }
    }
    function returnFriend(world, data) {
        if (NL.isBloodRelative(data)) {
            if (
                world.endingTriggered ||
                world.sixSevenProgress.pending ||
                NL.narrativeBlocking(world) ||
                !NL.familyReunionEligible(world, data)
            )
                return false;
            const capacity = world.c.RETURN.CAPACITY;
            if (
                [...world.views.values()].filter(
                    (v) => v.data.kind === 'person'
                ).length >= capacity
            )
                return false;
            if (!world.recurrence.arrive(data, true)) return false;
            const view = world.views.get(data.id);
            view.pauseLeft = 5;
            NL.stopFollowing(data);
            data.reunions++;
            NL.recordInteraction(world, data, 'reunion', {
                reason: data.familyDistance.reason,
                state: 'long_distance',
                retained: data.encountersLeft
            });
            NL.showNarrative(
                world,
                data.name + ' is visiting',
                NL.reunionStory(world, data, data.familyDistance)
            );
            world.revision++;
            return true;
        }
        if (
            world.endingTriggered ||
            data.lifeStatus !== 'departed' ||
            data.permanentlyGone ||
            world.socialClock.time < data.absenceUntil ||
            world.views.get(data.id)?.state === 'farewell'
        )
            return false;
        const departure = data.departures.at(-1);
        if (!departure) return false;
        const position = NL.openWorldPosition(
            world,
            world.c.PERSONAL_SPACE + 4
        );
        if (!position) return false;
        const warm =
            (data.traits.includes('Loyal') || data.strength >= 50) &&
            !['conflict', 'circle_split'].includes(departure.reason);
        data.lifeStatus = 'present';
        data.location = world.places.city;
        NL.stopFollowing(data);
        data.relationshipState = warm ? 'warm' : 'hesitant';
        data.encountersLeft = warm ? 3 : 2;
        data.opportunities = [];
        NL.alignOpportunities(world, data);
        data.nextReturnAt = world.time;
        data.presenceFactor = warm ? 1 : 0.75;
        data.active = false;
        if (!world.recurrence.arrive(data, true)) {
            data.lifeStatus = 'departed';
            return false;
        }
        const view = world.views.get(data.id);
        Object.assign(view, position, {
            tx: position.x,
            ty: position.y,
            pauseLeft: 5
        });
        data.reunions++;
        NL.changeStrength(data, warm ? 6 : -4);
        NL.recordInteraction(world, data, 'reunion', {
            reason: departure.reason,
            state: data.relationshipState
        });
        NL.showNarrative(
            world,
            data.name + ' returns',
            NL.reunionStory(world, data, departure)
        );
        world.revision++;
        return true;
    }
    function eligibleEventTypes(world, friends = friendsInWorld(world)) {
        const types = [];
        const ordinary = friends.filter((d) => !NL.isBloodRelative(d));
        if (ordinary.length) types.push('romance');
        if (friends.length) types.push('move');
        if (ordinary.length) types.push('drift', 'growth');
        if (
            ordinary.some((a) =>
                ordinary.some((b) => a !== b && a.connections.includes(b.id))
            )
        )
            types.push('conflict');
        return types;
    }
    function startFriendshipEvent(world, type, friendId = null) {
        if (
            world.endingTriggered ||
            world.sixSevenProgress.pending ||
            NL.narrativeBlocking(world) ||
            world.narrative.queue.length
        )
            return false;
        const friends = friendsInWorld(world).filter(
            (d) => type === 'move' || !NL.isBloodRelative(d)
        );
        const candidates = friends.filter((data) =>
            friendId
                ? data.id === friendId
                : data.id !== world.socialClock.lastCharacter ||
                  world.socialClock.time - world.socialClock.lastCharacterAt >=
                      world.c.SOCIAL.EVENT_INTERVAL * 2
        );
        const a =
            type === 'conflict'
                ? candidates.find((data) =>
                      friends.some(
                          (other) =>
                              other !== data &&
                              data.connections.includes(other.id)
                      )
                  )
                : candidates[0];
        if (!a || !eligibleEventTypes(world, friends).includes(type))
            return false;
        const b =
            type === 'conflict'
                ? friends.find((d) => d !== a && a.connections.includes(d.id))
                : null;
        if (type === 'conflict' && !b) return false;
        const circle =
            type === 'conflict'
                ? NL.connectedGroup(world, a).filter(
                      (d) =>
                          d.lifeStatus === 'present' &&
                          !NL.isBloodRelative(d) &&
                          d.active &&
                          (d.relationship === 'FRIEND' ||
                              d.follow.remaining > 0)
                  )
                : [];
        const vulnerable =
            type === 'conflict' &&
            circle.length >= 3 &&
            circle.every((d) => d.strength < 55) &&
            circle.some(
                (d) =>
                    d.traits.includes('Sensitive') ||
                    d.traits.includes('Impulsive')
            );
        const messages = {
            romance: {
                title: 'A different kind of closeness',
                text: `${a.name} has started a romantic relationship and is here less often. They still value your friendship, but their attention is changing. ${a.traits.includes('Independent') ? 'They want room to make their own choices.' : 'They are unsure how to divide their attention.'}`,
                choices: [
                    [
                        'space',
                        'Make room for their new life',
                        'make room for their new relationship'
                    ],
                    ['time', 'Ask for time together', 'ask for time together']
                ]
            },
            move: {
                title: 'Another place',
                text: NL.isBloodRelative(a)
                    ? `${a.name} is considering a move to another city. Your remaining meetings will be kept, but visiting each other may become less frequent. Their family connection does not depend on staying in this place.`
                    : `${a.name} is considering a move. ${a.traits.includes('Independent') ? 'They sound certain that they need to go.' : 'They sound torn between a new start and the people here.'} Asking them to stay may not change the decision.`,
                choices: [
                    [
                        'goodbye',
                        'Spend an afternoon together',
                        'spend a last afternoon together'
                    ],
                    ['stay', 'Ask them to stay', 'ask them to stay']
                ]
            },
            drift: {
                title: 'A little distance',
                text: `${a.name} has become quieter with you. ${a.relationshipState === 'hesitant' ? 'The last departure is still unresolved.' : 'The friendship may need a different kind of attention.'} ${a.traits.includes('Reserved') ? 'They rarely ask directly for space.' : 'They have noticed the distance too.'}`,
                choices: [
                    ['reach', 'Reach out', 'reach out despite the distance'],
                    ['space', 'Give them space', 'give them space']
                ]
            },
            growth: {
                title: 'Room for someone else',
                text: `${a.name} would like you to meet someone new. ${a.traits.includes('Outgoing') ? 'They enjoy bringing people together.' : 'Sharing this part of their life takes some effort.'} Making room for another person may change the shape of your friendship.`,
                choices: [
                    [
                        'welcome',
                        'Welcome the introduction',
                        'welcome a new connection'
                    ],
                    [
                        'keep',
                        'Keep things between you',
                        'keep the friendship between the two of you'
                    ]
                ]
            },
            conflict: {
                title: 'Between friends',
                text: b
                    ? `${a.name} and ${b.name} disagree about how the circle treats them. ${b.traits.includes('Sensitive') ? b.name + ' is sensitive to feeling dismissed.' : b.name + ' wants their concerns to be heard.'} ${vulnerable ? 'The group is already strained. They have warned that taking sides could make the whole circle leave.' : 'Taking a side may distance you from the other person; neutrality may feel like silence.'}`
                    : '',
                choices: [
                    [
                        'a',
                        a.name
                            ? `Support ${a.name.split(' ')[0]}`
                            : 'Support one friend',
                        `support ${a.name}`
                    ],
                    [
                        'b',
                        b
                            ? `Support ${b.name.split(' ')[0]}`
                            : 'Support the other friend',
                        b ? `support ${b.name}` : 'remain neutral'
                    ],
                    [
                        'neutral',
                        'Stay neutral',
                        'remain neutral in the disagreement'
                    ]
                ]
            }
        };
        const spec = messages[type];
        if (!spec) return false;
        world.narrative.current = {
            kind: 'decision',
            title: spec.title,
            text: spec.text,
            choices: spec.choices.map(([id, label, storyAction]) => ({
                id,
                label,
                storyAction
            })),
            type,
            ids: [a.id, b?.id].filter(Boolean),
            circle: circle.map((d) => d.id),
            vulnerable,
            elapsed: 0
        };
        world.player.moveTarget = null;
        world.player.vx = 0;
        world.player.vy = 0;
        NL.recordInteraction(world, a, 'event', { event: type });
        if (b) NL.recordInteraction(world, b, 'event', { event: type });
        if (vulnerable)
            for (const data of circle)
                NL.recordInteraction(world, data, 'warning', {
                    event: 'circle_split'
                });
        world.socialClock.lastType = type;
        world.socialClock.lastCharacter = a.id;
        world.socialClock.lastCharacterAt = world.socialClock.time;
        return true;
    }
    function resolveFriendshipChoice(world, choiceId) {
        const event = world.narrative.current;
        if (event?.kind !== 'decision' || world.endingTriggered) return false;
        const choice = event.choices.find((c) => c.id === choiceId);
        if (!choice) return false;
        const a = world.population.find((d) => d.id === event.ids[0]),
            b = world.population.find((d) => d.id === event.ids[1]);
        if (!a || a.lifeStatus !== 'present') {
            world.narrative.current = null;
            return false;
        }
        const originalStrength = a.strength;
        world.narrative.current = null; // Clear first: a second click cannot execute this decision again.
        for (const data of [a, b].filter(Boolean))
            NL.recordInteraction(world, data, 'choice', {
                event: event.type,
                choice: choice.id,
                storyAction: choice.storyAction
            });
        let text = '';
        if (event.type === 'romance') {
            a.presenceFactor = 0.65;
            if (choiceId === 'space') {
                NL.changeStrength(a, a.traits.includes('Independent') ? 10 : 5);
                a.relationshipState = 'distant';
                text = `${a.name} appreciates the room to choose. They will be less present, but the friendship is still here.`;
            } else {
                NL.changeStrength(a, a.traits.includes('Loyal') ? 8 : -8);
                a.relationshipState = a.strength >= 35 ? 'warm' : 'distant';
                if (a.strength < 25)
                    leaveFriend(
                        world,
                        a,
                        'romance',
                        choice.storyAction,
                        0,
                        false,
                        'unfinished'
                    );
                else
                    text = `${a.name} agrees that your time together matters. Finding that time may still be difficult.`;
            }
        } else if (event.type === 'move') {
            if (
                choiceId === 'stay' &&
                !a.traits.includes('Independent') &&
                a.strength >= 60
            ) {
                if (!NL.isBloodRelative(a)) NL.changeStrength(a, -5);
                text = `${a.name} postpones the move. They stay for now, without promising that this will always be enough.`;
            } else {
                if (!NL.isBloodRelative(a))
                    NL.changeStrength(a, choiceId === 'goodbye' ? 8 : -10);
                leaveFriend(
                    world,
                    a,
                    'move',
                    choice.storyAction,
                    0,
                    false,
                    choiceId === 'goodbye' ? 'afternoon' : 'unfinished'
                );
            }
        } else if (event.type === 'drift') {
            const change =
                choiceId === 'reach'
                    ? a.traits.includes('Independent')
                        ? -5
                        : 10
                    : a.traits.includes('Reserved')
                      ? 5
                      : -8;
            NL.changeStrength(a, change);
            if (a.strength < 25)
                leaveFriend(
                    world,
                    a,
                    'drift',
                    choice.storyAction,
                    0,
                    false,
                    'quiet'
                );
            else {
                a.relationshipState = change > 0 ? 'warm' : 'distant';
                text =
                    change > 0
                        ? `${a.name} responds in their own way. The friendship has room to recover.`
                        : `${a.name} keeps some distance. The decision has not ended the friendship, but it has changed its shape.`;
            }
        } else if (event.type === 'growth') {
            if (choiceId === 'welcome') {
                const data = NL.introducePerson(world, a);
                if (data) {
                    NL.changeStrength(a, 8);
                    text = `${a.name} introduces ${data.name}. A connection from their life has become part of yours; becoming friends still takes care.`;
                } else
                    text =
                        'There is no room for an arrival right now. The introduction can wait.';
            } else {
                NL.changeStrength(a, a.traits.includes('Outgoing') ? -6 : 5);
                text = `You keep the circle as it is. ${a.name} accepts the choice, though they may not feel the same way about it.`;
            }
        } else if (event.type === 'conflict' && b) {
            NL.changeTie(world, a, b, -4, 15);
            if (choiceId === 'neutral') {
                const leaving = [];
                for (const data of [a, b]) {
                    NL.changeStrength(
                        data,
                        data.traits.includes('Sensitive') ? -12 : -6
                    );
                    data.relationshipState = 'strained';
                    if (data.strength < 25)
                        leaving.push(
                            ...(event.vulnerable
                                ? NL.cascadeCandidates(world, data)
                                : [data])
                        );
                }
                if (leaving.length)
                    NL.departConnectedGroup(
                        world,
                        leaving,
                        'conflict',
                        choice.storyAction
                    );
                else
                    text =
                        'Neither friend hears an answer from you. They both stay for now, but silence has left the disagreement unresolved.';
            } else {
                const supported = choiceId === 'a' ? a : b,
                    other = choiceId === 'a' ? b : a;
                NL.changeStrength(supported, 8);
                NL.changeStrength(
                    other,
                    other.traits.includes('Loyal')
                        ? -10
                        : other.traits.includes('Sensitive')
                          ? -30
                          : -18
                );
                other.relationshipState = 'strained';
                const repeated =
                    other.history.filter(
                        (h) =>
                            h.type === 'choice' &&
                            h.event === 'conflict' &&
                            h.storyAction !== `support ${other.name}`
                    ).length >= 2;
                if (other.strength < 25) {
                    const group = event.vulnerable
                        ? NL.cascadeCandidates(world, other, supported.id)
                        : [other];
                    NL.departConnectedGroup(
                        world,
                        group,
                        'conflict',
                        choice.storyAction,
                        repeated && other.traits.includes('Sensitive')
                            ? [other.id]
                            : []
                    );
                } else {
                    text = `${other.name} stays, but the disagreement remains. ${supported.name} knows where you stood; keeping both friendships will need more than that.`;
                    NL.renewFollowing(
                        world,
                        supported,
                        'support during conflict'
                    );
                }
            }
        }
        if (a.lifeStatus === 'present' && a.strength > originalStrength)
            NL.renewFollowing(world, a, 'relationship choice');
        if (text) NL.showNarrative(world, 'What remains', text);
        if (!world.narrative.current)
            world.narrative.current = world.narrative.queue.shift() || null;
        world.socialClock.nextAllowedAt =
            world.socialClock.time + world.c.SOCIAL.EVENT_GAP;
        world.revision++;
        return true;
    }
    Object.assign(NL, {
        friendsInWorld,
        leaveFriend,
        updateDepartures,
        returnFriend,
        eligibleEventTypes,
        startFriendshipEvent,
        resolveFriendshipChoice
    });
})();
