// ECONOMY — an opportunity has one ID for its whole journey. Gifts do not mint progress.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    function newOpportunity(world) {
        return 'opportunity-' + world.nextOpportunityId++;
    }
    function alignOpportunities(world, actor, isPlayer = false) {
        const count = isPlayer ? actor.heldEncounters : actor.encountersLeft;
        actor.opportunities ||= [];
        while (actor.opportunities.length < count)
            actor.opportunities.push(newOpportunity(world));
        actor.opportunities.length = Math.min(
            actor.opportunities.length,
            count
        );
    }
    function initializeEconomy(world) {
        world.nextOpportunityId = 1;
        world.collectedIds = new Set();
        world.lastMilestone = 0;
        // Reserve enough ordinary opportunities to make 50 possible without recycling gifts.
        let available = world.population.reduce(
            (sum, data) =>
                sum + (NL.canTakeFrom(data) ? data.encountersLeft : 0),
            0
        );
        while (
            available < world.c.COLLECTION_THRESHOLD &&
            world.population.length < world.c.DEV_MAX_POPULATION
        ) {
            const data = new NL.CharacterData(
                'person-' +
                    String(world.population.length + 1).padStart(2, '0'),
                null,
                world.rng,
                world.c
            );
            world.population.push(data);
            available += data.encountersLeft;
        }
        for (const data of world.population) alignOpportunities(world, data);
        world.player.opportunities = [];
    }
    function collectOpportunity(world, data) {
        alignOpportunities(world, data);
        alignOpportunities(world, world.player, true);
        const token = data.opportunities.pop();
        world.player.opportunities.push(token);
        world.collectedIds.add(token);
        const milestone =
            Math.floor(
                world.collectedIds.size / world.c.SOCIAL.MILESTONE_STEP
            ) * world.c.SOCIAL.MILESTONE_STEP;
        if (milestone > world.lastMilestone) {
            world.lastMilestone = milestone;
            world.informationNotice = `${milestone} distinct opportunities collected. Time given back is counted only once.`;
        }
    }
    function giveOpportunity(world, data) {
        alignOpportunities(world, data);
        alignOpportunities(world, world.player, true);
        data.opportunities.push(world.player.opportunities.pop());
    }
    function setCollectedForTesting(world, count) {
        world.television.collectionUnlocked = count > 0;
        world.collectedIds = new Set(
            Array.from({ length: count }, (_, index) => 'presentation-' + index)
        );
    }
    Object.assign(NL, {
        newOpportunity,
        alignOpportunities,
        initializeEconomy,
        collectOpportunity,
        giveOpportunity,
        setCollectedForTesting
    });
})();
