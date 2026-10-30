// CONFIG — one responsibility; shared systems live on NumberLeft.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    const CONFIG = {
        DEBUG: false,
        FOLLOW: { SECONDS: 30, MAX_SECONDS: 45 },
        ENVIRONMENT_EVENT_COOLDOWN: 45,
        ENVIRONMENT_TESTS: {
            ENABLED_BY_DEFAULT: false,
            ALLOW_CONSEQUENCES: false
        },
        FAMILY_PEOPLE: {
            COUNT: 2, // Replace two ordinary identities; do not increase world capacity.
            ENCOUNTERS: [2000, 3000, 4000, 5000, 7000, 8000]
        },
        FAMILY_AVAILABILITY: {
            RETURN_DELAY: [9, 18],
            LONG_DISTANCE_DELAY: [120, 180],
            TAKE_HINT_COOLDOWN: 10
        },
        AFFECTION_PERSON: { ENABLED: true, COLOUR: '#a56352', RESPONSE: 5 },
        WIDTH: 1100,
        HEIGHT: 700,
        MAX_DPR: 2,
        MAX_DELTA: 0.05,
        NPC_COUNT: 40,
        INITIAL_VISIBLE: 10,
        SPECIAL_MIN: 4,
        SPECIAL_PROBABILITY: 0.18,
        ORDINARY_DISTRIBUTION: [
            [1, 0.78],
            [2, 0.15],
            [3, 0.05],
            [6, 0.02] // A rare natural Six; Seven is reserved for player gifts.
        ],
        PLAYER_SPEED: 155,
        PLAYER_RESPONSE: 14,
        NPC_SPEED: [18, 31],
        WALK_TURN: [3, 8],
        PERSONAL_SPACE: 30,
        INTERACTION_RADIUS: 46,
        MEETING_DWELL_SECONDS: 2,
        TAKE_COOLDOWN: 0.65,
        GIVE_COOLDOWN: 0.4,
        FRIEND_GIFT_THRESHOLD: 5, // Protected relatives retain their existing care milestone.
        FRIEND_ENCOUNTER_THRESHOLD: 5,
        GIFT_RECOGNITION: 0.7,
        FAMILY_THRESHOLD: 5,
        FAMILY_INITIAL_ENCOUNTERS: 3,
        // Intro timings are milliseconds; the shared world clock runs in seconds.
        INITIAL_ORDINARY_ONLY_DURATION: 5000,
        FIRST_FAMILY_LETTER_DELAY: 10000,
        FIRST_BLOOD_RELATIVE_DELAY: 20000,
        BLOOD_RELATIVE_SPAWN_INTERVAL: 30000,
        FAMILY_RANDOM_SPAWN_MIN_DELAY: 2,
        FAMILY_RANDOM_SPAWN_MAX_DELAY: 6,
        FAMILY_FOLLOW_DISTANCE: 64,
        FAMILY_FOLLOW_SPEED: 190,
        FAMILY_FOLLOW_RESPONSE: 5,
        FAMILY_ASSEMBLE_SECONDS: 3.5,
        FAMILY_HOLD_SECONDS: 1.5,
        FAMILY_REVEAL_SECONDS: 3,
        FAMILY_STAGGER: 0.084,
        COLLECTION_THRESHOLD: 50,
        ENVIRONMENT: { RADIUS_X: 535, RADIUS_Y: 165, CENTER_Y: 0.65 },
        SOCIAL: {
            CASCADE_LIMIT: 12,
            EVENT_INTERVAL: 40,
            REUNION_INTERVAL: 30,
            MIN_ABSENCE: 60,
            EVENT_GAP: 12,
            EVENT_CHANCE: 0.72,
            REUNION_CHANCE: 0.3,
            STORY_SECONDS: 16,
            HISTORY_LIMIT: 24,
            FAREWELL_SECONDS: 1.8,
            MILESTONE_STEP: 10
        },
        SIX_SEVEN: { FADE_SECONDS: 1.2, GROW_SECONDS: 5, PREVIEW_SECONDS: 1.5 },
        ENDING_RETURN: { HOLD_SECONDS: 3, FADE_SECONDS: 0.8 },
        DEMO_SECONDS: 5.25, // J/K demonstration only: 30% shorter than 7.5 seconds.
        FAMILY_WARNING: { FADE_IN: 0.15, HOLD: 2.3, FADE_OUT: 0.55 },
        TIME_EMPTY_SECONDS: 4,
        PLAYER_GROWTH_DURATION: 11,
        PLAYER_GROWTH_SCALE: 16,
        CONTEXT_HINT_DURATION: 7,
        HELD_METER_SEGMENTS: 12,
        METER_PULSE_SECONDS: 0.6,
        PALETTE: {
            paper: '#eee9da',
            ink: '#233e35',
            green: '#315247',
            wash: '#d9dfcd'
        },
        SPAWN_MARGIN: 64,
        LETTER_SEPARATION: 64,
        LETTER_PLAYER_DISTANCE: 90,
        LETTER_SPEED: [10, 14],
        DEV_MAX_POPULATION: 100,
        DEV_MAX_ENCOUNTERS: 999999,
        DEV_ENDING_QUIET_SECONDS: 6,
        ACTION_PAUSE: 1.15,
        FEEDBACK_SECONDS: 0.8,
        FINAL_HOLD: 1.1,
        FINAL_FADE: 1.6,
        RECOGNITION_THRESHOLDS: [0, 1, 2.5, 4.5, 7, 10],
        MEETING_RECOGNITION: 1,
        RETURN: {
            BASE_WEIGHT: [0.7, 1.3],
            MAX_WEIGHT: 3,
            MEETING_GAIN: 0.12,
            SPAWN_INTERVAL: [2.5, 5.5],
            VISIT: [24, 48],
            EDGE_SPEED: 68,
            MARGIN: 35,
            CAPACITY: 10
        },
        SPECIAL: {
            SLOW: 0.72,
            QUICK: 1.35,
            LONG_ABSENCE: 1.9,
            AVOID_RADIUS: 95,
            IDLE_CHANCE: 0.35,
            IDLE_SECONDS: [2, 4.5],
            BEHAVIOUR_STAGE: 3,
            FOLLOW_GAP: 32
        },
        STORY: {
            VISITS: [1, 2, 3, 4],
            ANCHOR_X: 256,
            ANCHOR_Y: 513,
            HOLD_SECONDS: 6
        },
        RETURN_MIN_DELAY: 9,
        RETURN_MAX_DELAY: 24,
        QUOTE: { LANDING_FADE: 0.3, HOLD_SECONDS: 3.5, FADE_SECONDS: 0.4 },
        // Thomas Common, The Joyful Wisdom (1910), §341; source link beside QuoteScene.
        OPENING_QUOTE:
            'Dost thou want this once more, and also for innumerable times?',
        OPENING_QUOTE_AUTHOR: 'Friedrich Nietzsche',
        OPENING_QUOTE_SOURCE: 'The Gay Science, §341',
        BODY: {
            bodyColor: '#315247',
            accentColor: '#788a69',
            hairType: 'none',
            accessoryType: 'none',
            bodyShape: 'slim',
            scale: 1,
            movementStyle: 'walk'
        }
    };

    function validateConfig(config) {
        if (!Number.isInteger(config.NPC_COUNT) || config.NPC_COUNT < 4) {
            throw Error('NPC_COUNT must be an integer >= 4.');
        }
        if (
            [config.TAKE_COOLDOWN, config.GIVE_COOLDOWN].some((v) => v <= 0) ||
            config.INTERACTION_RADIUS <= config.PERSONAL_SPACE
        ) {
            throw Error('Invalid interaction timing or radius.');
        }
        if (
            Math.abs(
                config.ORDINARY_DISTRIBUTION.reduce(
                    (sum, item) => sum + item[1],
                    0
                ) - 1
            ) > 1e-8
        ) {
            throw Error('Ordinary probabilities must total 1.');
        }
        if (
            config.FAMILY_INITIAL_ENCOUNTERS <= 0 ||
            config.FAMILY_INITIAL_ENCOUNTERS >= config.FAMILY_THRESHOLD
        ) {
            throw Error(
                'Letters must start positive and below the unlock threshold.'
            );
        }
        if (
            config.FAMILY_ASSEMBLE_SECONDS <= 0 ||
            config.FAMILY_STAGGER < 0 ||
            config.FAMILY_STAGGER >= 0.2
        ) {
            throw Error(
                'FAMILY assembly duration must be positive; stagger must be 0–0.199.'
            );
        }
        if (
            config.SPAWN_MARGIN < 58 ||
            config.LETTER_SEPARATION < 48 ||
            config.LETTER_SPEED[0] <= 0 ||
            config.MEETING_DWELL_SECONDS <= 0
        ) {
            throw Error('Invalid safe letter bounds, speed, or meeting dwell.');
        }
        if (
            ![
                config.INITIAL_ORDINARY_ONLY_DURATION,
                config.FIRST_FAMILY_LETTER_DELAY,
                config.FIRST_BLOOD_RELATIVE_DELAY,
                config.BLOOD_RELATIVE_SPAWN_INTERVAL
            ].every(Number.isFinite) ||
            config.INITIAL_ORDINARY_ONLY_DURATION < 5000 ||
            config.FIRST_FAMILY_LETTER_DELAY < 10000 ||
            config.FIRST_BLOOD_RELATIVE_DELAY < 20000 ||
            config.FIRST_FAMILY_LETTER_DELAY <
                config.INITIAL_ORDINARY_ONLY_DURATION ||
            config.FIRST_BLOOD_RELATIVE_DELAY <
                config.FIRST_FAMILY_LETTER_DELAY ||
            config.BLOOD_RELATIVE_SPAWN_INTERVAL <= 0 ||
            config.FAMILY_RANDOM_SPAWN_MIN_DELAY <= 0 ||
            config.FAMILY_RANDOM_SPAWN_MAX_DELAY <
                config.FAMILY_RANDOM_SPAWN_MIN_DELAY
        ) {
            throw Error('Invalid FAMILY spawn delays.');
        }
        if (
            config.FAMILY_FOLLOW_DISTANCE < 40 ||
            config.FAMILY_FOLLOW_SPEED <= config.PLAYER_SPEED ||
            config.PLAYER_GROWTH_DURATION <= 0 ||
            config.CONTEXT_HINT_DURATION <= 0
        ) {
            throw Error('Invalid following or presentation timing.');
        }
        if (
            config.RETURN_MIN_DELAY < 0 ||
            config.RETURN_MAX_DELAY < config.RETURN_MIN_DELAY
        ) {
            throw Error('Invalid return delays.');
        }
        if (
            config.RECOGNITION_THRESHOLDS.length !== 6 ||
            config.RECOGNITION_THRESHOLDS.some((v, i, a) => i && v <= a[i - 1])
        ) {
            throw Error('Recognition needs six ascending thresholds.');
        }
    }
    Object.assign(NL, { CONFIG, validateConfig });
})();
