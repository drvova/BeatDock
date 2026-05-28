const { ApplicationCommandOptionType } = require('discord.js');
const { requirePlayer, requireSameVoice } = require('../utils/interactionHelpers');
const { getValidVolume } = require('../utils/volumeValidator');

module.exports = {
    data: {
        name: 'volume',
        description: 'Set the playback volume',
        options: [
            {
                name: 'level',
                type: ApplicationCommandOptionType.Integer,
                description: 'Volume level (0-150)',
                required: true,
                min_value: 0,
                max_value: 150,
            },
        ],
    },
    async execute(interaction) {
        const { client } = interaction;
        const queue = await requirePlayer(interaction);
        if (!queue) return;
        if (!(await requireSameVoice(interaction, queue))) return;

        const volume = getValidVolume(interaction.options.getInteger('level'), client);
        queue.node.setVolume(volume);

        await interaction.reply({ content: client.t('VOLUME_SET', volume), flags: 64 });
        await client.playerController.updatePlayer(interaction.guild.id);
    },
};
