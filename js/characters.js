// CHARACTERS — one responsibility; shared systems live on NumberLeft.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    class CharacterData {
        constructor(id, template, rng, c) {
            this.id = id;
            this.template = template;
            this.kind = 'person';
            this.specialType = template?.key || null;
            this.familyRole = template?.familyRole || null;
            this.relationshipCategory =
                template?.relationshipCategory || 'ordinary';
            this.canTake = template?.canTake !== false;
            this.availability =
                this.relationshipCategory === 'blood_relative'
                    ? 'temporarily_absent'
                    : null;
            this.familyDistance = null;
            this.initialEncounters =
                template?.initialEncounters ??
                (template?.encounterRange
                    ? NL.integer(rng, template.encounterRange)
                    : ordinaryInitial(rng, c));
            // Seven is created by a player's gift, never by a random/template starting value.
            if (this.initialEncounters === 7) this.initialEncounters = 6;
            this.encountersLeft = this.initialEncounters;
            this.giftedEncounters = 0;
            this.takenEncounters = 0;
            this.relationship = 'STRANGER';
            this.timesMet = 0;
            this.recognitionPoints = 0;
            this.recognitionLevel = 0;
            this.returnWeight = NL.range(rng, c.RETURN.BASE_WEIGHT);
            this.storyState = 'alone';
            this.visualStage = 0;
            this.colour = template ? template.colour : '#c8bd9f';
            this.active = false;
            this.permanentlyGone = false;
            this.visits = 0;
            this.nextReturnAt = 0;
            this.companionId = null;
            this.lastMetAt = -Infinity;
            this.lastMeetingVisit = 0;
        }
    }

    class CharacterView {
        constructor(data, x, y, rng, c) {
            this.data = data;
            this.x = x;
            this.y = y;
            this.tx = x;
            this.ty = y;
            this.state = 'present';
            this.speed =
                NL.range(rng, c.NPC_SPEED) *
                (data.template?.speedMultiplier || 1);
            this.turnIn = 0;
            this.visitLeft = NL.range(rng, c.RETURN.VISIT);
            this.pauseLeft = 0;
            this.step = rng() * Math.PI * 2;
            // Reuse the existing gait seed; do not change gameplay's random sequence.
            this.walk =
                data.kind === 'person' &&
                data.template?.svgAsset !== 'biker-grandma'
                    ? {
                          step: this.step,
                          hop: this.step / (Math.PI * 2),
                          _lastHop: this.step / (Math.PI * 2),
                          bounce: 1,
                          previousBounce: 1,
                          bounceVel: 0,
                          bounceAcc: 0.2,
                          bounceDamp: 0.6,
                          remainder: 0,
                          scale: 1
                      }
                    : null;
            this.moving = false;
            this.feedback = 0;
            this.previousNumber = data.encountersLeft;
            this.finalElapsed = 0;
            this.opacity = 1;
            this.sitting = false;
            this.storyHold = 0;
            this.storyAnchor = false;
            this.meetingDwell = 0;
            this.visual = {
                ...c.BODY,
                colourCoverage: data.template?.progressiveColour
                    ? (data.strength || 0) / 100
                    : 0
            };
            updateAppearance(this, c);
        }
    }

    /*
     * Adapted from Nicky Case, We Become What We Behold, js/game/Peep.js:
     * https://github.com/ncase/wbwwb/blob/7c68c7e44e66b5be95ebd07d22391de707090397/js/game/Peep.js
     * Commit: 7c68c7e44e66b5be95ebd07d22391de707090397. License: CC0 1.0.
     * Reused: walkAnim()'s hop/half-cycle landing impulses and update()'s
     * bounceVel / bounce / damping recurrence (0.2, 0.6, landing squash 1.2).
     * Adapted: hop samples our existing gait step instead of speed / 40.
     * Fixed 60 Hz spring substeps run inside the existing dt update, with
     * interpolation for drawing. No new movement, random calls or timer loop.
     * The matching sway, lift and reciprocal squash are in drawCharacter().
     */
    function updateWalkAnimation(view, dt) {
        const walk = view.walk;
        const walking =
            view.moving &&
            !view.sitting &&
            view.state !== 'final' &&
            view.state !== 'farewell';
        const tick = 1 / 60;
        const elapsed = walk.remainder + dt;
        const ticks = Math.floor((elapsed + 1e-10) / tick);
        for (let i = 0; i < ticks; i++) {
            // Sample the old and new gait phases at each original 60 Hz tick.
            const fraction = Math.min(
                1,
                (tick * (i + 1) - walk.remainder) / dt
            );
            walk.hop = NL.lerp(walk.step, view.step, fraction) / (Math.PI * 2);
            walk.hop %= 1;
            walk.previousBounce = walk.bounce;
            if (walking) {
                // Peep.walkAnim(): squash at the bottom of each half-cycle.
                if (walk._lastHop < 0.5 && walk.hop >= 0.5) walk.bounce = 1.2;
                if (walk._lastHop > 0.9 && walk.hop <= 0.1) walk.bounce = 1.2;
            }
            // Peep.update(): original spring recurrence, kept at its original tick rate.
            walk.bounceVel += (1 - walk.bounce) * walk.bounceAcc;
            walk.bounce += walk.bounceVel;
            walk.bounceVel *= walk.bounceDamp;
            walk._lastHop = walk.hop;
        }
        walk.remainder = Math.max(0, elapsed - ticks * tick);
        walk.step = view.step;
        walk.scale = NL.lerp(
            walk.previousBounce,
            walk.bounce,
            walk.remainder / tick
        );
    }

    function isBloodRelative(data) {
        return data?.relationshipCategory === 'blood_relative';
    }

    function ordinaryInitial(rng, c) {
        const ticket = rng();
        let cumulative = 0;
        for (const [value, probability] of c.ORDINARY_DISTRIBUTION) {
            cumulative += probability;
            if (ticket < cumulative) {
                return value;
            }
        }
        return c.ORDINARY_DISTRIBUTION.at(-1)[0];
    }

    const SPECIAL_CHARACTERS = [
        {
            key: 'blue',
            colour: '#8ebed7',
            hair: 'side',
            accessory: 'scarf',
            shape: 'coat',
            movement: 'slow'
        },
        {
            key: 'orange',
            colour: '#e7ac7e',
            hair: 'tuft',
            accessory: 'bag',
            shape: 'slim',
            movement: 'quick'
        },
        {
            key: 'green',
            colour: '#9cc9a8',
            hair: 'bob',
            accessory: 'satchel',
            shape: 'coat',
            movement: 'rest'
        },
        {
            key: 'purple',
            colour: '#baa3da',
            hair: 'curl',
            accessory: 'scarf',
            shape: 'slim',
            movement: 'shy'
        }
    ];

    const FAMILY_CHARACTERS = [
        { key: 'family-father', familyRole: 'Father', svgAsset: 'father' },
        { key: 'family-mother', familyRole: 'Mother', svgAsset: 'mother' },
        { key: 'family-grandpa', familyRole: 'Grandpa', svgAsset: 'grandpa' },
        { key: 'family-grandma', familyRole: 'Grandma', svgAsset: 'grandma' },
        {
            key: 'family-biker-grandma',
            familyRole: 'Biker Grandma',
            svgAsset: 'biker-grandma',
            speedMultiplier: 1.45
        }
    ].map((template) => ({
        ...template,
        relationshipCategory: 'blood_relative',
        colour: '#87917b',
        movement: 'walk'
    }));
    const AFFECTION_CHARACTER = {
        key: 'affection',
        svgAsset: 'affection-npc',
        progressiveColour: true,
        colour: '#a56352',
        movement: 'walk'
    };
    function familyTemplate(role, rng, config, usedCounts = []) {
        const base = FAMILY_CHARACTERS.find(
            (template) => template.familyRole === role
        );
        if (!base) return null;
        const pool = config.FAMILY_PEOPLE.ENCOUNTERS.map((value) =>
            value === 7 ? 6 : value
        ).filter(
            (value) =>
                Number.isSafeInteger(value) &&
                value > 0 &&
                value <= config.DEV_MAX_ENCOUNTERS
        );
        const unused = pool.filter((value) => !usedCounts.includes(value));
        const choices = unused.length ? unused : pool;
        if (!choices.length)
            throw Error(
                'Family encounter pool must contain positive whole numbers.'
            );
        return {
            ...base,
            initialEncounters: choices[Math.floor(rng() * choices.length)]
        };
    }

    function createPopulation(rng, c) {
        const ids = Array.from({ length: c.NPC_COUNT }, (_, i) => i);
        for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [ids[i], ids[j]] = [ids[j], ids[i]];
        }
        const count = NL.clamp(
            Math.max(
                c.SPECIAL_MIN,
                Math.round(c.NPC_COUNT * c.SPECIAL_PROBABILITY)
            ),
            4,
            c.NPC_COUNT
        );
        const templates = new Map();
        ids.slice(0, count).forEach((id, i) =>
            templates.set(id, SPECIAL_CHARACTERS[i % 4])
        );
        const people = ids.map(
            (id) =>
                new CharacterData(
                    `person-${String(id + 1).padStart(2, '0')}`,
                    templates.get(id) || null,
                    rng,
                    c
                )
        );
        // Stable partner: story staging never invents or duplicates a person.
        const blue = people.find((d) => d.template?.key === 'blue');
        const partner =
            people.find((d) => !d.template) || people.find((d) => d !== blue);
        blue.companionId = partner.id;
        // Shuffle presentation order too: special identities are not a visible cluster.
        people.sort((a, b) => a.id.localeCompare(b.id));
        // Reuse ordinary slots. At least one family role and the colour archetype can be met early.
        const slots = people.filter((data) => !data.template);
        const roles = [...FAMILY_CHARACTERS];
        for (let i = roles.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [roles[i], roles[j]] = [roles[j], roles[i]];
        }
        const usedCounts = [];
        const familyCount = Math.min(
            Math.max(0, Math.trunc(c.FAMILY_PEOPLE.COUNT)),
            roles.length,
            slots.length
        );
        const colourSlot = c.AFFECTION_PERSON.ENABLED
            ? slots.splice(Math.min(1, slots.length - 1), 1)[0]
            : null;
        if (colourSlot) {
            colourSlot.template = {
                ...AFFECTION_CHARACTER,
                colour: c.AFFECTION_PERSON.COLOUR
            };
            colourSlot.specialType = 'affection';
            colourSlot.colour = c.AFFECTION_PERSON.COLOUR;
        }
        for (let i = 0; i < Math.min(familyCount, slots.length); i++) {
            const data = slots[i];
            const template = familyTemplate(
                roles[i].familyRole,
                rng,
                c,
                usedCounts
            );
            usedCounts.push(template.initialEncounters);
            Object.assign(data, {
                template,
                specialType: template.key,
                familyRole: template.familyRole,
                relationshipCategory: template.relationshipCategory,
                availability: 'temporarily_absent',
                colour: template.colour,
                initialEncounters: template.initialEncounters,
                encountersLeft: template.initialEncounters
            });
        }
        // Reserve ordinary-looking identities for one unrepeatable meeting each.
        for (const data of people.filter((d) => !d.template).slice(-c.BRIEF_ENCOUNTERS.COUNT)) {
            data.briefEncounter = true;
            data.canTake = false;
            data.initialEncounters = data.encountersLeft = 1;
        }
        return people;
    }

    function addRecognition(data, amount, c) {
        data.recognitionPoints = Math.min(
            c.RECOGNITION_THRESHOLDS[5],
            data.recognitionPoints + amount
        );
        data.recognitionLevel = 0;
        c.RECOGNITION_THRESHOLDS.forEach((threshold, level) => {
            if (data.recognitionPoints >= threshold) {
                data.recognitionLevel = level;
            }
        });
        data.visualStage = data.recognitionLevel;
    }

    function updateAppearance(character, config, dt = 0) {
        const data = character.data;
        const template = data.template;
        const level = data.visualStage;
        const appearance = character.visual;
        appearance.accentColor = data.colour;
        appearance.bodyColor = config.BODY.bodyColor;
        appearance.hairType =
            level >= 3 && template ? template.hair : config.BODY.hairType;
        appearance.accessoryType =
            level >= 3 && template
                ? template.accessory
                : config.BODY.accessoryType;
        appearance.bodyShape =
            level >= 4 && template ? template.shape : config.BODY.bodyShape;
        appearance.movementStyle =
            level >= config.SPECIAL.BEHAVIOUR_STAGE && template
                ? template.movement
                : config.BODY.movementStyle;
        if (template?.progressiveColour) {
            const target = NL.clamp((data.strength || 0) / 100, 0, 1);
            const current = appearance.colourCoverage ?? target;
            // Follow the same relationship in both directions; reunions create views at the saved value.
            appearance.colourCoverage = NL.lerp(
                current,
                target,
                1 - Math.exp(-config.AFFECTION_PERSON.RESPONSE * dt)
            );
            if (Math.abs(appearance.colourCoverage - target) < 0.0001)
                appearance.colourCoverage = target;
            appearance.accentColor = config.AFFECTION_PERSON.COLOUR;
        }
    }
    Object.assign(NL, {
        isBloodRelative,
        CharacterData,
        CharacterView,
        ordinaryInitial,
        SPECIAL_CHARACTERS,
        FAMILY_CHARACTERS,
        AFFECTION_CHARACTER,
        familyTemplate,
        createPopulation,
        addRecognition,
        updateAppearance,
        updateWalkAnimation
    });
})();
