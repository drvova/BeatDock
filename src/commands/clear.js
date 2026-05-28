const { requirePlayer, requireSameVoice } = require('../utils/interactionHelpers');
const { clearQueue } = require('../utils/PlayerActions');

module.exports = {
    data: { name: 'clear', description: 'Clear the queue' },
    async execute(interaction) {
        const { client, guild } = interaction;
        const queue = await requirePlayer(interaction, { requireQueue: true });
        if (!queue) return;
        if (!(await requireSameVoice(interaction, queue))) return;

        clearQueue(queue);

        if (client.autoplayEnabled.get(guild.id)) {
            client.autoplayEnabled.set(guild.id, false);
        }

        await interaction.reply({ content: client.t('QUEUE_CLEARED'), flags: 64 });
    },
};
