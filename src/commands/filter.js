const { requirePlayer } = require('../utils/interactionHelpers');
const { buildFilterResponse } = require('../interactions/filterNavigation');

module.exports = {
    data: { name: 'filter', description: 'Apply audio filters' },
    async execute(interaction) {
        const queue = await requirePlayer(interaction);
        if (!queue) return;

        const response = buildFilterResponse(interaction.client, queue, 1);
        await interaction.reply({ ...response, flags: 64 });
    },
};
