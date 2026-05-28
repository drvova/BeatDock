import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type TextChannel,
  type Message,
} from 'discord.js';
import { useQueue, QueueRepeatMode, type Track } from 'discord-player';
import type { BotClient } from '../types/client.js';

interface PlayerMessage {
  messageId: string;
  channelId: string;
}

export class PlayerController {
  private playerMessages = new Map<string, PlayerMessage>();
  private client: BotClient;

  constructor(client: BotClient) {
    this.client = client;
  }

  createPlayerEmbed(guildId: string, track: Track): EmbedBuilder {
    const queue = useQueue(guildId);
    const volume = queue?.node.volume ?? 100;
    const repeatMode = queue?.repeatMode ?? QueueRepeatMode.OFF;
    const isPaused = queue?.node.isPaused() ?? false;
    const queueSize = queue?.tracks.size ?? 0;

    const repeatLabel =
      repeatMode === QueueRepeatMode.TRACK ? '🔂 Track'
      : repeatMode === QueueRepeatMode.QUEUE ? '🔁 Queue'
      : repeatMode === QueueRepeatMode.AUTOPLAY ? '▶️ Auto'
      : '▶ Off';

    return new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(track.title)
      .setURL(track.url)
      .setAuthor({ name: isPaused ? 'Paused' : 'Now Playing' })
      .setThumbnail(track.thumbnail ?? null)
      .addFields(
        { name: 'Artist', value: track.author || 'Unknown', inline: true },
        { name: 'Duration', value: this.formatDuration(Number(track.duration)), inline: true },
        { name: 'Volume', value: `${volume}%`, inline: true },
        { name: 'Loop', value: repeatLabel, inline: true },
        { name: 'Queue', value: `${queueSize} track${queueSize !== 1 ? 's' : ''}`, inline: true },
      )
      .setFooter({ text: `Requested by ${track.requestedBy?.tag ?? 'Unknown'}` })
      .setTimestamp();
  }

  createPlayerButtons(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('player_back').setEmoji('⏮').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('player_playpause').setEmoji('⏯').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('player_skip').setEmoji('⏭').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('player_stop').setEmoji('⏹').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('player_shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary),
    );
  }

  createQueueRow(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('queue_loop').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('queue_list').setEmoji('📋').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('queue_clear').setEmoji('🗑').setStyle(ButtonStyle.Danger),
    );
  }

  async sendPlayer(channel: TextChannel, guildId: string, track: Track): Promise<void> {
    const existing = this.playerMessages.get(guildId);
    const embed = this.createPlayerEmbed(guildId, track);
    const components = [this.createPlayerButtons(), this.createQueueRow()];

    try {
      if (existing) {
        const msg = await channel.messages.fetch(existing.messageId).catch(() => null);
        if (msg) {
          await msg.edit({ embeds: [embed], components });
          return;
        }
      }
      const sent = await channel.send({ embeds: [embed], components });
      this.playerMessages.set(guildId, { messageId: sent.id, channelId: channel.id });
    } catch {
      // Channel may be inaccessible
    }
  }

  async updatePlayer(guildId: string): Promise<void> {
    const existing = this.playerMessages.get(guildId);
    if (!existing) return;

    const queue = useQueue(guildId);
    if (!queue?.currentTrack) return;

    try {
      const channel = this.client.channels.cache.get(existing.channelId) as TextChannel | undefined;
      if (!channel) return;
      const msg = await channel.messages.fetch(existing.messageId).catch(() => null) as Message | null;
      if (!msg) return;

      const embed = this.createPlayerEmbed(guildId, queue.currentTrack);
      await msg.edit({ embeds: [embed] });
    } catch {
      // Message may be deleted
    }
  }

  deletePlayer(guildId: string): void {
    this.playerMessages.delete(guildId);
  }

  formatDuration(ms: number): string {
    if (!ms || ms <= 0) return '0:00';
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
