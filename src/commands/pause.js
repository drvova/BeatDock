const { requirePlayer, requireSameVoice } = require('../utils/interactionHelpers');

module.exports = {
    data: { name: 'pause', description: 'Pause or resume playback' },
    async execute(interaction) {
        const { client } = interaction;
        const queue = await requirePlayer(interaction);
        if (!queue) return;
        if (!(await requireSameVoice(interaction, queue))) return;

        if (queue.node.isPaused()) {
            queue.node.resume();
            await interaction.reply({ content: client.t('RESUMED'), flags: 64 });
        } else {
            queue.node.pause();
            await interaction.reply({ content: client.t('PAUSED'), flags: 64 });
        }
    },
};
