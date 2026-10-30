// NARRATIVE — short offline stories assembled only from recorded event facts.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    function pick(world, items) {
        return items[Math.floor(world.rng() * items.length)];
    }
    const TRAIT_LINES = {
        Loyal: 'The friendship mattered to them, even when their plans changed.',
        Independent: 'They needed the choice to feel like their own.',
        Sensitive: 'Small gestures carried considerable weight for them.',
        Outgoing: 'They found it natural to seek out other people.',
        Reserved: 'They tended to leave some things unsaid.',
        Impulsive: 'They found it difficult to leave a decision unfinished.'
    };
    function departureStory(world, data, departure) {
        if (NL.isBloodRelative(data) && departure.familyDistance) {
            const cause = {
                move: `${data.name} is moving to another city.`,
                relocation: `Your move puts a different city between you and ${data.name}.`,
                study_abroad: `Studying abroad puts greater distance between you and ${data.name}.`,
                work_abroad: `Working abroad puts greater distance between you and ${data.name}.`
            }[departure.reason];
            return `${cause} You chose to ${departure.choice}. Your ${data.encountersLeft.toLocaleString('en-US')} remaining meetings are kept, and distance has not ended the relationship. Visits may be rarer, but there can still be reunions.`;
        }
        const name = data.name;
        const openings = {
            relocation: [
                `${name} stayed in another city.`,
                `The move left ${name} somewhere else.`,
                `${name} could not make the move with you.`
            ],
            exhausted: [
                `${name}'s number reached zero.`,
                `There are no encounters left with ${name}.`,
                `${name} will not return after this last meeting.`
            ],
            romance: [
                `${name} began making less room for these meetings.`,
                `${name}'s new relationship changed how often they could be here.`,
                `${name} left with their attention pulled in another direction.`
            ],
            move: [
                `${name} was moving away.`,
                `${name}'s move had become a real departure.`,
                `${name} could no longer stay in this familiar place.`
            ],
            drift: [
                `${name} chose some distance.`,
                `${name} stopped returning to the same places.`,
                `${name} let the friendship become quieter.`
            ],
            conflict: [
                `${name} left after the disagreement.`,
                `${name} could not set the argument aside.`,
                `${name} withdrew from the circle after your decision.`
            ],
            circle_split: [
                `${name} left as the friendship circle came apart.`,
                `${name} followed someone else out of the circle.`,
                `${name} could not keep meeting as though nothing had changed.`
            ]
        };
        const first = pick(world, openings[departure.reason] || openings.drift);
        const choice = departure.choice
            ? `You chose to ${departure.choice}.`
            : TRAIT_LINES[data.traits[0]];
        const farewells = {
            afternoon: 'You spent one last ordinary afternoon together.',
            promise: 'You agreed to try to stay in touch.',
            unfinished: 'The conversation remained unfinished.',
            quiet: 'There was no final conversation.'
        };
        const farewell = farewells[departure.farewell] || farewells.quiet;
        const lost =
            departure.lost === 0
                ? 'No encounters remained unused.'
                : departure.lost === 1
                  ? 'One remaining encounter went unused.'
                  : `${departure.lost} remaining encounters went unused.`;
        const personality = TRAIT_LINES[data.traits[0]];
        const variants = [
            [first, choice, personality, lost],
            [first, farewell, choice, lost],
            [
                `${data.relationship === 'FRIEND' ? 'Your friend ' : ''}${name} is no longer here.`,
                personality,
                choice,
                `${first.slice(0, -1)}; ${departure.lost === 1 ? 'one encounter remained unused' : departure.lost + ' encounters remained unused'}.`
            ]
        ];
        return pick(world, variants).join(' ');
    }
    function reunionStory(world, data, departure) {
        if (NL.isBloodRelative(data) && departure.familyDistance)
            return `${data.name} is here for a visit. The separation began when you chose to ${departure.choice}. Your ${data.encountersLeft.toLocaleString('en-US')} remaining meetings and shared history have stayed with you. They still live farther away, so another visit may take time.`;
        const opening = pick(world, [
            `${data.name} appeared again.`,
            `You met ${data.name} again, away from the last goodbye.`,
            `For a moment, seeing ${data.name} again felt unfamiliar.`
        ]);
        const state =
            data.relationshipState === 'warm'
                ? 'They seemed ready to make room for you again.'
                : 'They stayed at a small distance; returning did not settle everything.';
        const cause = {
            relocation:
                'A different city had put distance between you without erasing the friendship.',
            romance: 'Their new relationship was still part of their life.',
            move: 'The move had not erased the possibility of another meeting.',
            conflict: 'The disagreement still belonged to your shared history.',
            circle_split: 'The broken circle could not simply be put back.',
            drift: 'The distance between you had become something you could acknowledge.'
        }[departure.reason];
        let memory = departure.choice
            ? `Your choice to ${departure.choice} remained part of the reunion.`
            : TRAIT_LINES[data.traits[0]];
        const companions = (departure.groupIds || [])
            .filter((id) => id !== data.id)
            .map((id) => world.population.find((d) => d.id === id)?.name)
            .filter(Boolean);
        if (companions.length)
            memory =
                memory.slice(0, -1) +
                '; ' +
                companions.join(' and ') +
                ' left in that same sequence.';
        return pick(world, [
            [opening, cause, memory, state],
            [
                opening,
                memory,
                state,
                `${data.encountersLeft} new encounters are possible; the ${departure.lost} missed ones have not been restored.`
            ]
        ]).join(' ');
    }
    function groupDepartureStory(world, people, reason, choice) {
        const relatives = people.filter((data) => NL.isBloodRelative(data));
        if (relatives.length) {
            const ordinaryLoss = people
                .filter((data) => !NL.isBloodRelative(data))
                .reduce((sum, data) => sum + data.departures.at(-1).lost, 0);
            return `${people.map((data) => data.name).join(' and ')} are farther away after the move. You chose to ${choice}. ${relatives.map((data) => data.name).join(' and ')} remain part of your family, with their remaining meetings intact. ${ordinaryLoss ? `${ordinaryLoss} meetings with other departing friends went unused; family visits may be rarer.` : 'Family visits may be rarer, but reunions remain possible.'}`;
        }
        const names = people.map((d) => d.name),
            lost = people.reduce((sum, d) => sum + d.departures.at(-1).lost, 0);
        const who =
            names.length === 2
                ? names.join(' and ')
                : names.slice(0, -1).join(', ') + ', and ' + names.at(-1);
        const cause =
            reason === 'relocation'
                ? 'The move changed who could be here.'
                : 'The disagreement travelled through the connections between your friends.';
        const variants = [
            [
                `${who} left in turn.`,
                cause,
                `You chose to ${choice}.`,
                `${lost} encounters remained unused between you.`
            ],
            [
                `You chose to ${choice}.`,
                `${names[0]} left first, and ${names.slice(1).join(' and ')} followed.`,
                cause,
                `Their places are empty; ${lost} possible meetings went with them.`
            ],
            [
                cause,
                `${who} are no longer here.`,
                `Your choice to ${choice} remains part of their shared history.`,
                `${lost} encounters were left behind.`
            ]
        ];
        return pick(world, variants).join(' ');
    }
    function showNarrative(world, title, text, kind = 'story') {
        const message = { kind, title, text, elapsed: 0, choices: [] };
        if (world.narrative.current) world.narrative.queue.push(message);
        else world.narrative.current = message;
    }
    function dismissNarrative(world) {
        if (world.narrative.current?.kind === 'decision') return false;
        world.narrative.current = world.narrative.queue.shift() || null;
        world.socialClock.nextAllowedAt =
            world.socialClock.time + world.c.SOCIAL.EVENT_GAP;
        return true;
    }
    function updateNarrativePresentation(world, dt) {
        const current = world.narrative.current;
        if (!current) return;
        if (current.kind !== 'decision') {
            current.elapsed += dt;
            if (current.elapsed >= world.c.SOCIAL.STORY_SECONDS)
                dismissNarrative(world);
        }
    }
    function narrativeBlocking(world) {
        return !!world.narrative?.current;
    }
    Object.assign(NL, {
        groupDepartureStory,
        pick,
        departureStory,
        reunionStory,
        showNarrative,
        dismissNarrative,
        updateNarrativePresentation,
        narrativeBlocking
    });
})();
