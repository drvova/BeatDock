const { requirePlayer } = require('../utils/interactionHelpers');
const { createPaginatedQueueResponse } = require('../utils/PlayerActions');

module.exports = {
    data: { name: 'queue', description: 'Show the current queue' },
    async execute(interaction) {
        const queue = await requirePlayer(interaction);
        if (!queue) return;

        const response = createPaginatedQueueResponse(interaction.client, queue, 1);
        await interaction.reply({ ...response, flags: 64 });
    },
};
