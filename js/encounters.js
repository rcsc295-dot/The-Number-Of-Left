// ENCOUNTERS — one responsibility; shared systems live on NumberLeft.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    function canTakeFrom(data) {
        return !!data && !NL.isBloodRelative(data) && data.canTake !== false;
    }

    function canInteract(world, character, action) {
        return (
            !world.endingTriggered &&
            !NL.narrativeBlocking(world) &&
            !world.sixSevenProgress.pending &&
            !!character &&
            (action !== 'take' ||
                (canTakeFrom(character.data) &&
                    character.data.encountersLeft !== 8)) &&
            world.cooldowns[action] <= 0 &&
            character.state === 'present' &&
            !character.data.permanentlyGone &&
            (character.data.kind !== 'person' ||
                character.data.lifeStatus === 'present') &&
            character.data.encountersLeft > 0 &&
            NL.distance(world.player, character) <= world.c.INTERACTION_RADIUS
        );
    }

    function acknowledge(world, character, action, previous) {
        const config = world.c;
        const data = character.data;
        world.cooldowns[action] =
            config[{ take: 'TAKE_COOLDOWN', give: 'GIVE_COOLDOWN' }[action]];
        world.lastActivity = world.time;
        world.actionCount++;
        world.revision++;
        world.actionSignal = { data: data, action };
        character.previousNumber = previous;
        world.meterPulse = {
            direction: action,
            time: config.METER_PULSE_SECONDS
        };
        NL.queueContextHint(world, action);
        if (world.hints.seen.has('take') && world.hints.seen.has('give')) {
            NL.queueContextHint(world, 'transfer');
        }
        if (data.id === 'letter-F') {
            NL.queueContextHint(world, 'unusual');
        }
        character.feedback = config.FEEDBACK_SECONDS;
        character.pauseLeft = config.ACTION_PAUSE;
        if (data.encountersLeft === 0) {
            retireCharacter(world, character);
        }
    }

    function retireCharacter(world, character) {
        character.data.encountersLeft = 0;
        character.data.permanentlyGone = true;
        if (character.data.kind === 'person') {
            character.data.lifeStatus = 'closed';
            NL.stopFollowing(character.data);
            NL.recordInteraction(world, character.data, 'exhausted');
            if (character.data.relationship === 'FRIEND') {
                const departure = {
                    reason: 'exhausted',
                    choice: 'take the last encounter',
                    lost: 0,
                    at: world.socialClock.time,
                    farewell: 'quiet',
                    irreversible: true
                };
                character.data.departures.push(departure);
                NL.recordInteraction(
                    world,
                    character.data,
                    'departure',
                    departure
                );
                NL.showNarrative(
                    world,
                    character.data.name + ' will not return',
                    NL.departureStory(world, character.data, departure)
                );
            }
        }
        character.state = 'final';
        character.finalElapsed = 0;
        world.revision++;
    }

    function registerMeeting(world, character) {
        const data = character;
        if (
            data.kind !== 'person' ||
            data.permanentlyGone ||
            !data.active ||
            data.encountersLeft <= 0 ||
            data.lastMeetingVisit === data.visits
        ) {
            return false;
        }
        data.lastMeetingVisit = data.visits;
        data.timesMet++;
        data.lastMetAt = world.time;
        NL.addRecognition(data, world.c.MEETING_RECOGNITION, world.c);
        data.returnWeight = Math.min(
            world.c.RETURN.MAX_WEIGHT,
            data.returnWeight + world.c.RETURN.MEETING_GAIN
        );
        world.meetings++;
        world.tutorial.met = true;
        world.revision++;
        return true;
    }

    function updateMeetings(world, dt) {
        const nearest = world.nearest();
        for (const character of world.views.values()) {
            if (character.data.kind !== 'person') {
                continue;
            }
            character.meetingDwell =
                character === nearest && character.state === 'present'
                    ? character.meetingDwell + dt
                    : 0;
            if (character.meetingDwell >= world.c.MEETING_DWELL_SECONDS) {
                registerMeeting(world, character.data);
            }
        }
    }

    function takeEncounter(world, character) {
        // Authorization is shared by every caller. A denied attempt only supplies a UI hint.
        if (
            character &&
            !canTakeFrom(character.data) &&
            !world.endingTriggered &&
            !world.sixSevenProgress.pending &&
            !NL.narrativeBlocking(world) &&
            character.state === 'present' &&
            !character.data.permanentlyGone &&
            character.data.encountersLeft > 0 &&
            NL.distance(world.player, character) <= world.c.INTERACTION_RADIUS
        )
            NL.protectedTakeHint(world, character.data);
        if (
            character?.data.encountersLeft === 8 &&
            canTakeFrom(character.data) &&
            canInteract(world, character, 'give')
        )
            NL.televisionHint(
                world,
                'seven-by-giving',
                'A number made by giving',
                'Seven can only be made by giving. This meeting cannot be taken.',
                70
            );
        if (!canInteract(world, character, 'take')) {
            return false;
        }
        const previous = character.data.encountersLeft;
        NL.collectOpportunity(world, character.data);
        character.data.encountersLeft--;
        character.data.takenEncounters++;
        world.player.heldEncounters++;
        world.player.totalTaken++;
        NL.recordTransfer(world, character.data, 'take');
        world.television.collectionUnlocked = true;
        acknowledge(world, character, 'take', previous);
        NL.familyDiscovery(world, character.data);
        NL.noteSixSevenTransfer(world, character, 'take');
        NL.checkTakenEnding(world);
        world.family.checkUnlocks();
        return true;
    }

    function giveEncounter(world, character) {
        if (
            !canInteract(world, character, 'give') ||
            world.player.heldEncounters <= 0
        ) {
            return false;
        }
        const data = character.data;
        const wasFriend = data.relationship === 'FRIEND';
        const previous = data.encountersLeft;
        NL.giveOpportunity(world, data);
        world.player.heldEncounters--;
        data.encountersLeft++;
        if (data.kind === 'person') {
            data.giftedEncounters++;
            NL.addRecognition(data, world.c.GIFT_RECOGNITION, world.c);
            updateRelationship(data, world.c, true);
        }
        NL.televisionHint(
            world,
            'first-gift',
            'A way to become friends',
            'Give a stranger enough meetings to reach 5, and they may become your friend.',
            85
        );
        NL.recordTransfer(
            world,
            data,
            'give',
            !wasFriend && data.relationship === 'FRIEND'
        );
        acknowledge(world, character, 'give', previous);
        NL.followingGift(world, data);
        NL.familyDiscovery(world, data);
        NL.noteSixSevenTransfer(world, character, 'give');
        if (!wasFriend && data.relationship === 'FRIEND') {
            if (NL.isBloodRelative(data)) {
                NL.recordInteraction(world, data, 'family-milestone', {
                    gifts: data.giftedEncounters
                });
                NL.televisionHint(
                    world,
                    'family-care-' + data.id,
                    data.name,
                    'Five meetings given back. You have made more time for someone who has already given you so much.',
                    55
                );
            } else NL.queueContextHint(world, 'friend');
        }
        world.family.checkUnlocks();
        return true;
    }

    function updateRelationship(data, config, successfulGive = false) {
        if (data.kind !== 'person') return;
        if (NL.isBloodRelative(data)) {
            data.relationship =
                data.giftedEncounters >= config.FRIEND_GIFT_THRESHOLD
                    ? 'FRIEND'
                    : 'STRANGER';
        } else if (
            successfulGive &&
            data.encountersLeft === config.FRIEND_ENCOUNTER_THRESHOLD
        ) {
            data.relationship = 'FRIEND';
        }
    }

    function heldMeterValues(value, config) {
        const unit = Math.max(1, Math.ceil(value / config.HELD_METER_SEGMENTS));
        return {
            unit,
            fills: Array.from({ length: config.HELD_METER_SEGMENTS }, (_, i) =>
                NL.clamp((value - i * unit) / unit, 0, 1)
            )
        };
    }
    Object.assign(NL, {
        canTakeFrom,
        canInteract,
        acknowledge,
        retireCharacter,
        registerMeeting,
        updateMeetings,
        takeEncounter,
        giveEncounter,
        updateRelationship,
        heldMeterValues
    });
})();
