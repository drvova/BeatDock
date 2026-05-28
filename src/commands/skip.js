const { requirePlayer, requireSameVoice } = require('../utils/interactionHelpers');

module.exports = {
    data: { name: 'skip', description: 'Skip the current track' },
    async execute(interaction) {
        const { client, guild } = interaction;
        const queue = await requirePlayer(interaction, { requireQueue: false });
        if (!queue) return;
        if (!(await requireSameVoice(interaction, queue))) return;

        const autoplaySkip = client.autoplayEnabled.get(guild.id) && queue.tracks.size === 0;
        queue.node.skip();

        await interaction.reply({
            content: autoplaySkip ? client.t('AUTOPLAY_SKIP') : client.t('SKIPPED'),
            flags: 64,
        });
    },
};
