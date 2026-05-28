const { requirePlayer, requireSameVoice } = require('../utils/interactionHelpers');

module.exports = {
    data: { name: 'stop', description: 'Stop playback and clear the queue' },
    async execute(interaction) {
        const { client, guild } = interaction;
        const queue = await requirePlayer(interaction);
        if (!queue) return;
        if (!(await requireSameVoice(interaction, queue))) return;

        queue.delete();
        client.autoplayEnabled.delete(guild.id);

        await interaction.reply({ content: client.t('STOPPED'), flags: 64 });
    },
};
