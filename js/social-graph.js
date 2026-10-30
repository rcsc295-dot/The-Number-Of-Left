// SOCIAL GRAPH — stable symmetric ties; propagation happens only on decisions, never each frame.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    function connectPeople(world, a, b, strength = 70) {
        if (!a || !b || a === b) return;
        for (const [from, to] of [
            [a, b],
            [b, a]
        ]) {
            if (!from.connections.includes(to.id)) from.connections.push(to.id);
            from.socialTies[to.id] ||= { strength, tension: 0, kind: 'friend' };
        }
    }
    function changeTie(world, a, b, strength, tension = 0) {
        connectPeople(world, a, b);
        for (const [from, to] of [
            [a, b],
            [b, a]
        ]) {
            const tie = from.socialTies[to.id];
            tie.strength = NL.clamp(tie.strength + strength, 0, 100);
            tie.tension = NL.clamp(tie.tension + tension, 0, 100);
            NL.recordInteraction(world, from, 'social-tie', {
                person: to.id,
                strength: tie.strength,
                tension: tie.tension
            });
        }
    }
    function initializeSocialGraph(world) {
        for (const data of world.population)
            for (const id of data.connections)
                connectPeople(
                    world,
                    data,
                    world.population.find((d) => d.id === id)
                );
        world.socialOutcomes = [];
    }
    function connectedGroup(world, start, maxDepth = 3) {
        const visited = new Set([start.id]),
            queue = [{ data: start, depth: 0 }],
            group = [];
        while (queue.length && group.length < world.c.SOCIAL.CASCADE_LIMIT) {
            const { data, depth } = queue.shift();
            group.push(data);
            if (depth >= maxDepth) continue;
            for (const id of data.connections) {
                const next = world.population.find((d) => d.id === id),
                    tie = data.socialTies[id];
                if (next && tie?.strength >= 40 && !visited.has(id)) {
                    visited.add(id);
                    queue.push({ data: next, depth: depth + 1 });
                }
            }
        }
        return group;
    }
    function cascadeCandidates(world, seed, protectedId = null) {
        if (NL.isBloodRelative(seed)) return [];
        const result = [seed],
            visited = new Set([seed.id]),
            queue = [{ data: seed, depth: 0 }];
        while (queue.length && result.length < world.c.SOCIAL.CASCADE_LIMIT) {
            const { data, depth } = queue.shift();
            if (depth >= 3) continue;
            for (const id of data.connections) {
                if (visited.has(id)) continue;
                visited.add(id);
                const next = world.population.find((d) => d.id === id),
                    tie = data.socialTies[id];
                if (
                    !next ||
                    NL.isBloodRelative(next) ||
                    !tie ||
                    tie.strength < 60 ||
                    next.lifeStatus !== 'present' ||
                    !next.active ||
                    (next.relationship !== 'FRIEND' &&
                        next.follow.remaining <= 0) ||
                    next.strength >= 70
                )
                    continue;
                const warned = next.history.some(
                    (h) => h.type === 'warning' && h.event === 'circle_split'
                );
                let pressure =
                    tie.strength * 0.55 +
                    tie.tension * 0.3 +
                    (60 - next.strength) * 0.6 +
                    (warned ? 8 : 0) +
                    (next.follow.remaining > 0 ? 5 : 0);
                for (const trait of next.traits)
                    pressure +=
                        {
                            Sensitive: 15,
                            Impulsive: 12,
                            Loyal: 8,
                            Independent: -22,
                            Reserved: -4,
                            Outgoing: 3
                        }[trait] || 0;
                if (id === protectedId) pressure -= 8;
                if (pressure >= 50) {
                    result.push(next);
                    queue.push({ data: next, depth: depth + 1 });
                } else {
                    NL.changeStrength(next, -3);
                    NL.recordInteraction(world, next, 'stayed', {
                        after: data.id
                    });
                }
                if (result.length >= world.c.SOCIAL.CASCADE_LIMIT) break;
            }
        }
        return result;
    }
    function departConnectedGroup(
        world,
        people,
        reason,
        choice,
        irreversibleIds = [],
        farewell = 'unfinished'
    ) {
        const departed = [];
        for (const data of [...new Set(people)]) {
            if (
                NL.leaveFriend(
                    world,
                    data,
                    departed.length && reason !== 'relocation'
                        ? 'circle_split'
                        : reason,
                    choice,
                    departed.length * 0.7,
                    irreversibleIds.includes(data.id),
                    farewell,
                    true
                )
            )
                departed.push(data);
        }
        if (!departed.length) return [];
        const ids = departed.map((d) => d.id);
        for (const data of departed) {
            data.departures.at(-1).groupIds = ids;
            NL.recordInteraction(world, data, 'group-departure', {
                people: ids,
                cause: reason,
                choice
            });
        }
        world.socialOutcomes.push({
            type: 'departure',
            ids,
            reason,
            choice,
            at: world.socialClock.time
        });
        if (world.socialOutcomes.length > 8) world.socialOutcomes.shift();
        NL.showNarrative(
            world,
            departed.length > 1
                ? 'The circle changes'
                : departed[0].name + ' has left',
            departed.length > 1
                ? NL.groupDepartureStory(world, departed, reason, choice)
                : NL.departureStory(
                      world,
                      departed[0],
                      departed[0].departures.at(-1)
                  )
        );
        return departed;
    }
    Object.assign(NL, {
        connectPeople,
        changeTie,
        initializeSocialGraph,
        connectedGroup,
        cascadeCandidates,
        departConnectedGroup
    });
})();
