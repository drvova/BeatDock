const { useMainPlayer, useQueue } = require('discord-player');

async function handleSearchNavigation(interaction) {
    const { client, guild, member, customId, channel } = interaction;
    const searchSessions = require('../utils/searchSessions');

    if (customId === 'search_cancel') {
        const session = searchSessions.getSessionByInteraction(interaction);
        if (session) searchSessions.deleteSession(session.sessionId);
        return interaction.update({ content: client.t('SEARCH_CANCELLED'), embeds: [], components: [] });
    }

    const session = searchSessions.getSessionByInteraction(interaction);
    if (!session) {
        return interaction.reply({ content: client.t('SEARCH_SESSION_EXPIRED'), flags: 64 });
    }

    if (interaction.user.id !== session.userId) {
        return interaction.reply({ content: client.t('NOT_YOUR_SEARCH'), flags: 64 });
    }

    if (customId === 'search_prev' || customId === 'search_next') {
        const direction = customId === 'search_next' ? 1 : -1;
        const newPage = (session.currentPage || 0) + direction;
        session.currentPage = newPage;
        const { createSearchEmbed, createSearchComponents } = require('../utils/embeds');
        const embed = createSearchEmbed(client, session.results, session.query, newPage);
        const components = createSearchComponents(session.sessionId, session.results, newPage);
        return interaction.update({ embeds: [embed], components });
    }

    if (customId.startsWith('search_select_')) {
        const index = parseInt(customId.split('_')[2], 10);
        const track = session.results[index];
        if (!track) {
            return interaction.reply({ content: client.t('TRACK_NOT_FOUND'), flags: 64 });
        }

        const voiceChannel = member.voice.channel;
        if (!voiceChannel) {
            searchSessions.deleteSession(session.sessionId);
            return interaction.reply({ content: client.t('JOIN_VOICE_FIRST'), flags: 64 });
        }

        const player = useMainPlayer();
        let existingQueue = useQueue(guild.id);

        try {
            if (!existingQueue) {
                const result = await player.play(voiceChannel, track, {
                    nodeOptions: {
                        metadata: channel,
                        selfDeaf: true,
                        volume: session.volume,
                        leaveOnEmpty: true,
                        leaveOnEnd: true,
                    },
                    requestedBy: interaction.user,
                });
                existingQueue = result.queue;
            } else {
                existingQueue.tracks.add(track);
                if (!existingQueue.isPlaying()) {
                    existingQueue.node.play();
                }
            }

            searchSessions.deleteSession(session.sessionId);

            await interaction.update({
                content: client.t('TRACK_ADDED', track.title, track.author),
                embeds: [],
                components: [],
            });

            await client.playerController.sendPlayer(channel, guild.id, existingQueue.currentTrack);
        } catch {
            searchSessions.deleteSession(session.sessionId);
            await interaction.update({ content: client.t('PLAY_ERROR'), embeds: [], components: [] });
        }
    }
}

module.exports = { handleSearchNavigation };
