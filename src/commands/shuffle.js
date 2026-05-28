const { requirePlayer, requireSameVoice } = require('../utils/interactionHelpers');
const { shuffleQueue } = require('../utils/PlayerActions');

module.exports = {
    data: { name: 'shuffle', description: 'Shuffle the queue' },
    async execute(interaction) {
        const { client, guild } = interaction;
        const queue = await requirePlayer(interaction, { requireQueue: true });
        if (!queue) return;
        if (!(await requireSameVoice(interaction, queue))) return;

        shuffleQueue(queue);

        if (client.autoplayEnabled.get(guild.id)) {
            client.autoplayEnabled.set(guild.id, false);
        }

        await interaction.reply({ content: client.t('SHUFFLED'), flags: 64 });
    },
};
