const { requirePlayer } = require('../utils/interactionHelpers');

module.exports = {
    data: { name: 'nowplaying', description: 'Show the currently playing track' },
    async execute(interaction) {
        const { client, guild } = interaction;
        const queue = await requirePlayer(interaction);
        if (!queue) return;

        const track = queue.currentTrack;
        if (!track) {
            return interaction.reply({ content: client.t('NO_TRACK_PLAYING'), flags: 64 });
        }

        const embed = client.playerController.createPlayerEmbed(guild.id, track);
        if (!embed) {
            return interaction.reply({ content: client.t('NO_TRACK_PLAYING'), flags: 64 });
        }

        await interaction.reply({ embeds: [embed], flags: 64 });
    },
};
