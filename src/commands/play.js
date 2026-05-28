const { ApplicationCommandOptionType } = require('discord.js');
const { useMainPlayer, useQueue } = require('discord-player');
const { getValidVolume } = require('../utils/volumeValidator');

module.exports = {
    data: {
        name: 'play',
        description: 'Play a song or playlist',
        options: [
            {
                name: 'query',
                type: ApplicationCommandOptionType.String,
                description: 'Song name or URL',
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
            {
                name: 'position',
                type: ApplicationCommandOptionType.Integer,
                description: 'Position in queue',
                required: false,
                min_value: 1,
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
        const volumeOption = interaction.options.getInteger('volume');
        const position = interaction.options.getInteger('position');
        const volume = getValidVolume(volumeOption, client);

        try {
            const searchResult = await player.search(query, {
                requestedBy: interaction.user,
            });

            if (!searchResult || searchResult.tracks.length === 0) {
                return interaction.editReply({ content: client.t('NO_RESULTS') });
            }

            let existingQueue = useQueue(guild.id);
            const nodeOptions = {
                metadata: channel,
                selfDeaf: true,
                volume,
                leaveOnEmpty: true,
                leaveOnEnd: true,
            };

            if (!existingQueue) {
                try {
                    const result = await player.play(voiceChannel, searchResult, {
                        nodeOptions,
                        requestedBy: interaction.user,
                    });
                    existingQueue = result.queue;
                } catch (err) {
                    return interaction.editReply({ content: client.t('PLAY_ERROR') });
                }
            } else {
                if (searchResult.playlist) {
                    for (const track of searchResult.playlist.tracks) {
                        if (position) {
                            existingQueue.insertTrack(track, position - 1);
                        } else {
                            existingQueue.tracks.add(track);
                        }
                    }
                } else {
                    const track = searchResult.tracks[0];
                    if (position) {
                        existingQueue.insertTrack(track, position - 1);
                    } else {
                        existingQueue.tracks.add(track);
                    }
                }

                if (!existingQueue.isPlaying()) {
                    existingQueue.node.play();
                }
            }

            if (searchResult.playlist) {
                await interaction.editReply({
                    content: client.t('PLAYLIST_ADDED', searchResult.playlist.title, searchResult.playlist.tracks.length),
                });
            } else {
                const track = searchResult.tracks[0];
                await interaction.editReply({
                    content: client.t('TRACK_ADDED', track.title, track.author),
                });
            }

            await client.playerController.sendPlayer(channel, guild.id, existingQueue.currentTrack);
        } catch (err) {
            await interaction.editReply({ content: client.t('PLAY_ERROR') });
        }
    },
};
