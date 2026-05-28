const { ApplicationCommandOptionType } = require('discord.js');
const { useMainPlayer, useQueue } = require('discord-player');
const { getValidVolume } = require('../utils/volumeValidator');
const { createSearchEmbed, createSearchComponents } = require('../utils/embeds');
const searchSessions = require('../utils/searchSessions');

module.exports = {
    data: {
        name: 'search',
        description: 'Search for a song',
        options: [
            {
                name: 'query',
                type: ApplicationCommandOptionType.String,
                description: 'Song name to search',
                required: true,
                autocomplete: true,
            },
            {
                name: 'volume',
                type: ApplicationCommandOptionType.Integer,
                description: 'Volume (0-150)',
                required: false,
                min_value: 0,
                max_value: 150,
            },
        ],
    },
    async execute(interaction) {
        const { member, guild, client, channel } = interaction;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: client.t('JOIN_VOICE_FIRST'), flags: 64 });
        }

        const permissions = voiceChannel.permissionsFor(client.user);
        if (!permissions.has('Connect') || !permissions.has('Speak')) {
            return interaction.reply({ content: client.t('VOICE_PERMISSION_DENIED'), flags: 64 });
        }

        await interaction.deferReply();

        const player = useMainPlayer();
        const query = interaction.options.getString('query');
        const volume = getValidVolume(interaction.options.getInteger('volume'), client);

        try {
            const searchResult = await player.search(query, { requestedBy: interaction.user });

            if (!searchResult || searchResult.tracks.length === 0) {
                return interaction.editReply({ content: client.t('NO_RESULTS') });
            }

            const results = searchResult.tracks.slice(0, 10);

            const sessionId = searchSessions.createSession({
                userId: interaction.user.id,
                guildId: guild.id,
                channelId: channel.id,
                voiceChannelId: voiceChannel.id,
                results,
                volume,
            });

            const embed = createSearchEmbed(client, results, query);
            const components = createSearchComponents(sessionId, results);

            await interaction.editReply({ embeds: [embed], components });
        } catch (err) {
            await interaction.editReply({ content: client.t('SEARCH_ERROR') });
        }
    },
};
