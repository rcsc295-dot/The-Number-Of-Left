// IDENTITY — names, traits, social links and a bounded factual interaction history.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    const FIRST_NAMES = [
        'Alex',
        'Daniel',
        'Emma',
        'Oliver',
        'Maya',
        'Leah',
        'Theo',
        'Nora',
        'Sam',
        'Robin',
        'Lina',
        'Eli',
        'Mira',
        'Owen',
        'Sofia',
        'Noah',
        'Ada',
        'Jamie',
        'Iris',
        'Leo',
        'Clara',
        'Isaac',
        'Zoe',
        'Miles',
        'Avery',
        'Jules',
        'Rosa',
        'Felix',
        'Elena',
        'Arun',
        'Amir',
        'June',
        'Grace',
        'Ben',
        'Lucy',
        'Kai'
    ];
    const LAST_NAMES = [
        'Bennett',
        'Chen',
        'Martin',
        'Patel',
        'Reed',
        'Park',
        'Rivera',
        'Wilson',
        'Brooks',
        'Shah',
        'Costa',
        'Lee'
    ];
    const TRAITS = [
        'Loyal',
        'Independent',
        'Sensitive',
        'Outgoing',
        'Reserved',
        'Impulsive'
    ];
    const FAMILY_INTRODUCTIONS = {
        Father: 'He may not always walk beside you, but he will always make time for you.',
        Mother: 'She has been part of your world longer than you can remember.',
        Grandpa:
            'He carries more memories than the numbers above his head can tell.',
        Grandma:
            'Some people have a way of making every meeting feel familiar.',
        'Biker Grandma':
            'She has thousands of meetings left, and apparently no intention of slowing down.'
    };
    function recordInteraction(world, data, type, details = {}) {
        const entry = { type, at: world.socialClock?.time || 0, ...details };
        data.history.push(entry);
        if (data.history.length > world.c.SOCIAL.HISTORY_LIMIT)
            data.history.shift();
        return entry;
    }
    function initializeIdentity(world, data) {
        if (NL.isBloodRelative(data)) {
            // A relative's role is their identity; never allocate a personal name.
            data.personalName = null;
            data.name = data.familyRole || 'Relative';
            data.selfProfile =
                FAMILY_INTRODUCTIONS[data.familyRole] ||
                'They have been making time for you for longer than you can remember.';
            if (data.traits) return;
        } else {
            if (data.name) return;
            const names = world.usedNames;
            let index = Math.floor(
                world.rng() * FIRST_NAMES.length * LAST_NAMES.length
            );
            let name;
            do {
                name =
                    FIRST_NAMES[index % FIRST_NAMES.length] +
                    ' ' +
                    LAST_NAMES[
                        Math.floor(index / FIRST_NAMES.length) %
                            LAST_NAMES.length
                    ];
                index++;
            } while (names.has(name));
            names.add(name);
            data.personalName = name;
            data.name = name;
        }
        const first = Math.floor(world.rng() * TRAITS.length);
        data.traits = [TRAITS[first]];
        if (world.rng() < 0.65)
            data.traits.push(
                TRAITS[
                    (first +
                        1 +
                        Math.floor(world.rng() * (TRAITS.length - 1))) %
                        TRAITS.length
                ]
            );
        const beginnings = [
            'grew up above a small repair shop, learning to mend things before replacing them.',
            'spent childhood summers near a railway station, imagining the places beyond the last stop.',
            'once worked in a neighbourhood bakery, and still wakes before the streets fill.',
            'learned to grow vegetables in a patch of borrowed garden and kept the habit after moving away.',
            'left a small coastal town years ago, but still measures the seasons by the weather there.',
            'studied drawing at evening classes while working days in a busy shop.',
            'inherited a collection of records and slowly learned the stories behind their favourite songs.',
            'moved between several towns growing up and learned to notice what makes a place feel familiar.'
        ];
        const habits = {
            Loyal: 'They keep old letters in a biscuit tin, unwilling to lose the handwriting of people who once mattered.',
            Independent:
                'They take long walks with no planned destination and enjoy finding a way home alone.',
            Sensitive:
                'They keep a notebook of small details: a changing shop window, a faded sign, the first cold morning.',
            Outgoing:
                'They help at a neighbourhood market, happiest when a brief conversation becomes a familiar face.',
            Reserved:
                'They draw familiar buildings in the margins of notebooks, rarely showing anyone the finished pages.',
            Impulsive:
                'They often begin a new project before finishing the last; their room is full of unfinished possibilities.'
        };
        let profileSeed = 0;
        for (const character of data.id + data.name)
            profileSeed = (profileSeed * 31 + character.charCodeAt(0)) >>> 0;
        if (!NL.isBloodRelative(data))
            data.selfProfile = `${data.name} ${beginnings[profileSeed % beginnings.length]} ${habits[data.traits[0]]}`;
        Object.assign(data, {
            strength: 0,
            socialTies: {},
            location: 0,
            behaviour: 'normal',
            follow: { remaining: 0, vx: 0, vy: 0, offset: world.rng() * 0.5 },
            history: [],
            connections: [],
            lifeStatus: 'present',
            relationshipState: 'new',
            departures: [],
            reunions: 0,
            lastSocialEvent: null,
            absenceUntil: 0,
            presenceFactor: 1
        });
    }
    function initializeSocialIdentities(world) {
        world.usedNames = new Set();
        for (const data of world.population) initializeIdentity(world, data);
        for (let i = 0; i < world.population.length; i++) {
            const group = world.population.slice(
                Math.floor(i / 3) * 3,
                Math.floor(i / 3) * 3 + 3
            );
            world.population[i].connections = group
                .filter((d) => d !== world.population[i])
                .map((d) => d.id);
        }
    }
    function changeStrength(data, amount) {
        data.strength = NL.clamp(data.strength + amount, 0, 100);
    }
    function recordTransfer(world, data, action, becameFriend = false) {
        if (data.kind !== 'person') return;
        recordInteraction(world, data, action, { count: 1 });
        changeStrength(
            data,
            action === 'give'
                ? 8
                : data.relationship === 'FRIEND'
                  ? data.traits.includes('Sensitive')
                      ? -4
                      : -2
                  : 0
        );
        if (becameFriend) {
            data.relationshipState = 'warm';
            recordInteraction(world, data, 'friend');
            const friends = world.population
                .filter(
                    (d) =>
                        d !== data &&
                        d.relationship === 'FRIEND' &&
                        d.lifeStatus === 'present'
                )
                .slice(-2);
            for (const friend of friends) {
                NL.connectPeople(world, data, friend, 70);
            }
        }
    }
    Object.assign(NL, {
        FIRST_NAMES,
        LAST_NAMES,
        TRAITS,
        recordInteraction,
        initializeIdentity,
        initializeSocialIdentities,
        changeStrength,
        recordTransfer
    });
})();
