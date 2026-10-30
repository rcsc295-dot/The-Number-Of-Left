// WORLD EVENTS — manual prototypes; earlier consequences retained behind an explicit disabled setting.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    function initializePlaces(world) {
        world.places = { city: 0, lastUsed: {}, markers: [], previewSerial: 0 };
        if (world.c.ENVIRONMENT_TESTS.ENABLED_BY_DEFAULT)
            for (const id of ['car', 'house', 'city']) spawnPlace(world, id);
    }
    function spawnPlace(world, id) {
        const positions = {
            car: [-0.7, 0.15, 'CAR'],
            house: [0.68, 0.12, 'HOME'],
            city: [0.4, 0.7, 'DIFFERENT CITY']
        };
        if (!positions[id]) return false;
        if (world.places.markers.some((place) => place.id === id)) return true;
        const e = NL.environment(world.c),
            [x, y, label] = positions[id];
        const point = NL.keepInEnvironment(world, {
            x: e.x + e.rx * x,
            y: e.y + e.ry * y
        });
        world.places.markers.push({ id, label, ...point, prototype: true });
        world.revision++;
        return true;
    }
    function removePlace(world, id) {
        world.places.markers = world.places.markers.filter(
            (place) => place.id !== id
        );
        delete world.places.lastUsed[id];
        const matches = (item) => item?.id.startsWith('prototype-' + id + '-');
        for (const key of world.television.seen)
            if (key.startsWith('prototype-' + id + '-'))
                world.television.seen.delete(key);
        world.television.queue = world.television.queue.filter(
            (item) => !matches(item)
        );
        if (matches(world.television.current))
            world.television.current = world.television.queue.shift() || null;
        world.revision++;
    }
    function clearPlaces(world) {
        for (const id of ['car', 'house', 'city']) removePlace(world, id);
        world.places.city = 0;
        world.places.lastUsed = {};
        world.places.previewSerial = 0;
    }
    function openPlace(world, id) {
        if (
            world.endingTriggered ||
            NL.narrativeBlocking(world) ||
            world.sixSevenProgress.pending ||
            !world.places.markers.some((p) => p.id === id)
        )
            return false;
        // Objects are visual/interaction prototypes until their consequences are approved.
        // Keep the earlier implementation below for future development, unreachable by default.
        if (!world.c.ENVIRONMENT_TESTS.ALLOW_CONSEQUENCES) {
            const place = world.places.markers.find(
                (marker) => marker.id === id
            );
            NL.televisionHint(
                world,
                'prototype-' + id + '-' + world.places.previewSerial++,
                place.label + ' · prototype',
                'A place being imagined. This preview does not change anyone’s relationships or move the world.',
                60
            );
            return true;
        }
        if (
            world.time - (world.places.lastUsed[id] ?? -Infinity) <
            world.c.ENVIRONMENT_EVENT_COOLDOWN
        ) {
            NL.televisionHint(
                world,
                'rest-' + id + '-' + world.time,
                'Not yet',
                'There is no new decision here just now.',
                20
            );
            return false;
        }
        const descriptions = {
            car: [
                'A seat beside you',
                'A short trip could bring someone new into your circle. You can make an introduction, or spend the time with the people already here.',
                [
                    'Introduce someone',
                    'Travel with your friends',
                    'Leave it for now'
                ]
            ],
            house: [
                'A place to gather',
                'A familiar home can bring a small circle closer. You can invite the people you know, or spend a quiet afternoon with one person.',
                [
                    'Invite the circle',
                    'Make time for one friend',
                    'Leave it for now'
                ]
            ],
            city: [
                'A different city',
                'Moving will change who can be here. Some friends may travel with you; others may stay behind without ending the friendship. Connected, unsettled friends may decide to leave together.',
                ['Invite your friends along', 'Move on your own', 'Stay here']
            ]
        };
        const [title, text, labels] = descriptions[id];
        world.narrative.current = {
            kind: 'decision',
            type: 'place-' + id,
            title,
            text,
            ids: [],
            choices: labels.map((label, i) => ({ id: String(i), label })),
            elapsed: 0
        };
        world.player.moveTarget = null;
        world.player.vx = world.player.vy = 0;
        return true;
    }
    function introducePerson(world, host) {
        if (world.population.length >= world.c.DEV_MAX_POPULATION) return null;
        let data = host?.connections
            .map((id) => world.population.find((d) => d.id === id))
            .find(
                (d) =>
                    d &&
                    !d.active &&
                    d.lifeStatus === 'present' &&
                    !d.permanentlyGone
            );
        if (!data) {
            data = new NL.CharacterData(
                'person-' +
                    String(world.population.length + 1).padStart(2, '0'),
                null,
                world.rng,
                world.c
            );
            NL.initializeIdentity(world, data);
            NL.alignOpportunities(world, data);
            world.population.push(data);
        }
        if (!world.recurrence.arrive(data, true)) return null;
        if (host) {
            NL.connectPeople(world, host, data, 75);
            NL.recordInteraction(world, host, 'introduction', {
                person: data.id
            });
        }
        return data;
    }
    function resolvePlaceChoice(world, choiceId) {
        if (!world.c.ENVIRONMENT_TESTS.ALLOW_CONSEQUENCES) return false;
        const event = world.narrative.current;
        if (
            !event?.type?.startsWith('place-') ||
            !event.choices.some((c) => c.id === choiceId)
        )
            return false;
        const place = event.type.slice(6);
        world.narrative.current = null;
        world.places.lastUsed[place] = world.time;
        const people = NL.friendsInWorld(world),
            host = people[0] || NL.currentFollowers(world)[0];
        const action = event.choices.find((c) => c.id === choiceId).label;
        for (const d of people)
            NL.recordInteraction(world, d, 'environment', {
                place,
                choice: action,
                city: world.places.city
            });
        let text = 'You leave the decision for another time.';
        if (choiceId !== '2' && place === 'car') {
            if (choiceId === '0') {
                const person = introducePerson(world, host);
                text = person
                    ? `${host ? host.name + ' introduces' : 'You meet'} ${person.name}. A new person has joined this place; friendship will still take time.`
                    : 'There is no room for another arrival just now. The opportunity can wait.';
            } else {
                for (const d of people) {
                    NL.changeStrength(d, 6);
                    NL.renewFollowing(world, d, 'shared trip');
                }
                text = people.length
                    ? 'You make the trip with the people already here. They choose to keep you company a little longer.'
                    : 'You take a quiet trip. There will be other chances to share it.';
            }
        } else if (choiceId !== '2' && place === 'house') {
            const group = choiceId === '0' ? people : people.slice(0, 1);
            for (const d of group) {
                NL.changeStrength(
                    d,
                    d.traits.includes('Reserved') && choiceId === '1' ? 12 : 7
                );
                NL.renewFollowing(world, d, 'afternoon at home');
            }
            for (let i = 1; i < group.length; i++)
                NL.changeTie(world, group[i - 1], group[i], 8, -8);
            text = group.length
                ? `${group.map((d) => d.name).join(', ')} ${group.length === 1 ? 'stays' : 'stay'} for the afternoon. ${group.length > 1 ? 'Some of your friends get to know each other better.' : 'You make room for a quieter conversation.'}`
                : 'The house is quiet. There will be space for company when you have met someone.';
        } else if (choiceId !== '2' && place === 'city') {
            const leaving = [],
                staying = [];
            world.places.city++;
            for (const d of people) {
                const comes =
                    choiceId === '0' &&
                    (d.traits.includes('Loyal') || d.strength >= 60) &&
                    !d.traits.includes('Independent');
                if (comes) {
                    staying.push(d);
                    NL.renewFollowing(world, d, 'shared move');
                } else leaving.push(d);
            }
            // Physical distance need not erase emotional strength. Independent friends may choose to stay.
            if (leaving.length)
                NL.departConnectedGroup(
                    world,
                    leaving,
                    'relocation',
                    choiceId === '0'
                        ? 'invite friends to move with you'
                        : 'move on your own',
                    [],
                    'unfinished'
                );
            for (const d of staying) d.location = world.places.city;
            for (const v of [...world.views.values()])
                if (
                    v.data.kind === 'person' &&
                    v.data.relationship !== 'FRIEND' &&
                    v.data.follow.remaining <= 0 &&
                    v.state === 'present'
                )
                    world.recurrence.depart(v);
            const arrival = introducePerson(world, staying[0]);
            text = `The markers now point to city ${world.places.city + 1}. ${staying.length ? staying.map((d) => d.name).join(', ') + ' came with you.' : 'You arrive without a travelling companion.'} ${arrival ? 'You meet ' + arrival.name + ' here.' : 'New people may appear here.'} Distance does not erase the friendships you left behind.`;
        }
        NL.showNarrative(world, event.title, text);
        world.socialClock.nextAllowedAt =
            world.socialClock.time + world.c.SOCIAL.EVENT_GAP;
        world.revision++;
        return true;
    }
    function drawPlaces(ctx, world) {
        ctx.save();
        ctx.strokeStyle = '#31524770';
        ctx.fillStyle = '#315247';
        ctx.lineWidth = 1.5;
        ctx.font = '9px Arial';
        ctx.textAlign = 'center';
        for (const p of world.places.markers) {
            ctx.save();
            ctx.translate(p.x, p.y);
            if (p.id === 'car') {
                ctx.strokeRect(-16, -12, 32, 11);
                ctx.beginPath();
                ctx.moveTo(-11, -12);
                ctx.lineTo(-6, -20);
                ctx.lineTo(8, -20);
                ctx.lineTo(13, -12);
                ctx.stroke();
                for (const x of [-10, 10]) {
                    ctx.beginPath();
                    ctx.arc(x, 1, 3, 0, Math.PI * 2);
                    ctx.stroke();
                }
            } else if (p.id === 'house') {
                ctx.strokeRect(-12, -17, 24, 20);
                ctx.beginPath();
                ctx.moveTo(-16, -17);
                ctx.lineTo(0, -30);
                ctx.lineTo(16, -17);
                ctx.stroke();
                ctx.strokeRect(-3, -7, 6, 10);
            } else {
                ctx.beginPath();
                ctx.moveTo(0, -23);
                ctx.lineTo(0, 5);
                ctx.moveTo(-18, -22);
                ctx.lineTo(14, -22);
                ctx.lineTo(20, -17);
                ctx.lineTo(14, -12);
                ctx.lineTo(-18, -12);
                ctx.closePath();
                ctx.stroke();
            }
            ctx.fillText(p.label, 0, 18);
            ctx.restore();
        }
        if (world.places.city) {
            ctx.font = '11px Georgia';
            ctx.fillText(
                'City ' + (world.places.city + 1),
                world.c.WIDTH / 2,
                NL.environment(world.c).y + NL.environment(world.c).ry - 12
            );
        }
        ctx.restore();
    }
    Object.assign(NL, {
        initializePlaces,
        spawnPlace,
        removePlace,
        clearPlaces,
        openPlace,
        introducePerson,
        resolvePlaceChoice,
        drawPlaces
    });
})();
