const { useQueue } = require('discord-player');

module.exports = {
    data: { name: 'autoplay', description: 'Toggle autoplay of recommended songs' },
    async execute(interaction) {
        const { client, guild } = interaction;

        if (!useQueue(guild.id)) {
            return interaction.reply({ content: client.t('NO_PLAYER'), flags: 64 });
        }

        const current = client.autoplayEnabled.get(guild.id) || false;
        const newValue = !current;
        client.autoplayEnabled.set(guild.id, newValue);

        if (newValue) {
            const queue = useQueue(guild.id);
            if (queue.repeatMode !== 0) {
                queue.setRepeatMode(0);
            }
        }

        await interaction.reply({
            content: newValue ? client.t('AUTOPLAY_ON') : client.t('AUTOPLAY_OFF'),
            flags: 64,
        });
    },
};
