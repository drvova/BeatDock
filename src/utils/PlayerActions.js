const { useHistory, useQueue } = require('discord-player');

async function playPrevious(interaction) {
    const history = useHistory(interaction.guild.id);
    if (!history) {
        return interaction.reply({
            content: interaction.client.t('NO_PLAYER'),
            flags: 64,
        });
    }

    const previousTracks = history.previous();
    if (!previousTracks || previousTracks.length === 0) {
        return interaction.reply({
            content: interaction.client.t('NO_PREVIOUS_TRACKS'),
            flags: 64,
        });
    }

    const previousTrack = previousTracks[0];
    const queue = useQueue(interaction.guild.id);

    if (queue.currentTrack) {
        queue.insertTrack(queue.currentTrack, 0);
    }
    queue.node.play(previousTrack);

    return interaction.reply({
        content: interaction.client.t('PLAYING_PREVIOUS', previousTrack.title),
        flags: 64,
    });
}

function shuffleQueue(queue) {
    queue.tracks.shuffle();
}

function clearQueue(queue) {
    queue.tracks.clear();
}

function jumpToTrack(queue, trackIndex) {
    const tracks = queue.tracks.toArray();
    if (trackIndex < 0 || trackIndex >= tracks.length) return false;

    for (let i = 0; i < trackIndex; i++) {
        queue.removeTrack(0);
    }
    queue.node.skip();
    return true;
}

function paginatedQueue(queue, page = 1, itemsPerPage = 10) {
    const tracks = queue.tracks.toArray();
    const totalPages = Math.ceil(tracks.length / itemsPerPage) || 1;
    const safePage = Math.max(1, Math.min(page, totalPages));
    const start = (safePage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return {
        tracks: tracks.slice(start, end),
        page: safePage,
        totalPages,
        totalTracks: tracks.length,
        startIndex: start,
    };
}

function createPaginatedQueueResponse(client, queue, page = 1) {
    const { tracks, page: currentPage, totalPages, totalTracks, startIndex } = paginatedQueue(queue, page);

    if (totalTracks === 0) {
        return { content: client.t('QUEUE_EMPTY'), embeds: [], components: [] };
    }

    const trackList = tracks.map((track, i) => {
        const num = startIndex + i + 1;
        return `**${num}.** [${track.title}](${track.url}) — ${track.author}`;
    }).join('\n');

    const currentTrack = queue.currentTrack;
    const nowPlaying = currentTrack
        ? `${client.t('NOW_PLAYING')}: [${currentTrack.title}](${currentTrack.url})\n`
        : '';

    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle(client.t('QUEUE_TITLE', totalTracks))
        .setDescription(`${nowPlaying}\n${trackList}`)
        .setFooter({ text: client.t('PAGE_INFO', currentPage, totalPages) });

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`queue_prev_${currentPage}`)
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage <= 1),
        new ButtonBuilder()
            .setCustomId(`queue_next_${currentPage}`)
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= totalPages),
        new ButtonBuilder()
            .setCustomId('queue_close')
            .setEmoji('✖️')
            .setStyle(ButtonStyle.Danger),
    );

    return { embeds: [embed], components: [row] };
}

module.exports = { playPrevious, shuffleQueue, clearQueue, jumpToTrack, paginatedQueue, createPaginatedQueueResponse };
