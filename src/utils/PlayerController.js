const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { useQueue, useTimeline, RepeatMode } = require('discord-player');

class PlayerController {
    constructor(client) {
        this.client = client;
        this.playerMessages = new Map();
    }

    createPlayerEmbed(guildId, track) {
        const queue = useQueue(guildId);
        if (!track || !queue) return null;

        const volume = queue.node.volume;
        const repeatMode = queue.repeatMode;
        const paused = queue.node.isPaused();
        const queueSize = queue.tracks.size;
        const repeatLabel = repeatMode === RepeatMode.TRACK ? '🔂'
            : repeatMode === RepeatMode.QUEUE ? '🔁'
            : repeatMode === RepeatMode.AUTOPLAY ? '♾️' : '';

        const descriptionParts = [];
        descriptionParts.push(this.client.t('NOW_PLAYING_DESC', track.url, track.title));

        const progress = this.#formatDuration(track.duration);
        descriptionParts.push(`\`⏱️ ${progress}\`  \`👤 ${track.author}\``);

        if (queueSize > 0) {
            descriptionParts.push(this.client.t('IN_QUEUE', queueSize));
        }

        const controlText = [
            '',
            this.client.t('PLAYER_CONTROLS_INFO'),
        ].join('\n');
        descriptionParts.push(controlText);

        const embed = new EmbedBuilder()
            .setColor(0x2B2D31)
            .setTitle(this.client.t('NOW_PLAYING'))
            .setDescription(descriptionParts.join('\n'))
            .setFooter({
                text: [
                    `🔊 ${volume}%`,
                    paused ? '⏸️' : '',
                    repeatLabel,
                ].filter(Boolean).join('  '),
            })
            .setThumbnail(track.thumbnail || null);

        return embed;
    }

    createPlayerButtons() {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('player_back').setEmoji('⏮️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('player_playpause').setEmoji('⏯️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('player_skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('player_stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('player_shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary),
        );
    }

    createQueueRow() {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('player_loop').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('player_queue').setEmoji('📋').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('player_clear').setEmoji('🗑️').setStyle(ButtonStyle.Secondary),
        );
    }

    async sendPlayer(channel, guildId, track) {
        const embed = this.createPlayerEmbed(guildId, track);
        if (!embed) return null;

        const row1 = this.createPlayerButtons();
        const row2 = this.createQueueRow();

        const existing = this.playerMessages.get(guildId);
        if (existing) {
            try {
                const msg = await channel.messages.fetch(existing.messageId);
                return await msg.edit({ embeds: [embed], components: [row1, row2] });
            } catch {
                this.playerMessages.delete(guildId);
            }
        }

        const message = await channel.send({ embeds: [embed], components: [row1, row2] });
        this.playerMessages.set(guildId, {
            messageId: message.id,
            channelId: channel.id,
        });
        return message;
    }

    async updatePlayer(guildId) {
        const entry = this.playerMessages.get(guildId);
        if (!entry) return null;

        const queue = useQueue(guildId);
        const track = queue?.currentTrack;
        if (!track) return null;

        const channel = this.client.channels.cache.get(entry.channelId);
        if (!channel) {
            this.playerMessages.delete(guildId);
            return null;
        }

        try {
            const message = await channel.messages.fetch(entry.messageId);
            const embed = this.createPlayerEmbed(guildId, track);
            if (!embed) return null;
            const row1 = this.createPlayerButtons();
            const row2 = this.createQueueRow();
            return await message.edit({ embeds: [embed], components: [row1, row2] });
        } catch {
            this.playerMessages.delete(guildId);
            return null;
        }
    }

    deletePlayer(guildId) {
        this.playerMessages.delete(guildId);
    }

    #formatDuration(ms) {
        if (!ms || ms === 0) return '0:00';
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }
}

module.exports = PlayerController;
