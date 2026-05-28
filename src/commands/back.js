const { requirePlayer, requireSameVoice } = require('../utils/interactionHelpers');
const { playPrevious } = require('../utils/PlayerActions');

module.exports = {
    data: { name: 'back', description: 'Play the previous track' },
    async execute(interaction) {
        const queue = await requirePlayer(interaction);
        if (!queue) return;
        if (!(await requireSameVoice(interaction, queue))) return;

        await playPrevious(interaction);
    },
};
