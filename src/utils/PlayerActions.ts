import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type BaseInteraction,
} from 'discord.js';
import { useHistory, useQueue, type GuildQueue, type Track } from 'discord-player';
import type { BotClient } from '../types/client.js';

const ITEMS_PER_PAGE = 10;

export async function playPrevious(interaction: BaseInteraction): Promise<Track | null> {
  const client = interaction.client as BotClient;
  const queue = useQueue(interaction.guild!.id);
  if (!queue) return null;

  const history = useHistory(interaction.guild!.id);
  if (!history) return null;

  const previousTrack = history.previousTrack;
  if (!previousTrack) return null;

  if (queue.currentTrack) {
    queue.insertTrack(queue.currentTrack, 0);
  }

  await history.back();
  return previousTrack;
}

export function shuffleQueue(queue: GuildQueue): void {
  queue.tracks.shuffle();
}

export function clearQueue(queue: GuildQueue): void {
  queue.tracks.clear();
}

export function jumpToTrack(queue: GuildQueue, trackIndex: number): Track | null {
  const tracks = queue.tracks.toArray();
  if (trackIndex < 0 || trackIndex >= tracks.length) return null;

  const targetTrack = tracks[trackIndex];

  // Remove all tracks before the target
  for (let i = 0; i < trackIndex; i++) {
    queue.removeTrack(0);
  }

  queue.node.skip();
  return targetTrack;
}

export interface PaginatedQueueResult {
  tracks: Track[];
  page: number;
  totalPages: number;
  totalTracks: number;
  startIndex: number;
}

export function paginatedQueue(
  queue: GuildQueue,
  page: number,
  itemsPerPage = ITEMS_PER_PAGE
): PaginatedQueueResult {
  const allTracks = queue.tracks.toArray();
  const totalTracks = allTracks.length;
  const totalPages = Math.max(1, Math.ceil(totalTracks / itemsPerPage));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (safePage - 1) * itemsPerPage;
  const tracks = allTracks.slice(startIndex, startIndex + itemsPerPage);

  return { tracks, page: safePage, totalPages, totalTracks, startIndex };
}

export function createPaginatedQueueResponse(
  client: BotClient,
  queue: GuildQueue,
  page: number
): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const data = paginatedQueue(queue, page);
  const current = queue.currentTrack;

  const lines = data.tracks.map((track, i) => {
    const num = data.startIndex + i + 1;
    return `\`${num}.\` [${track.title}](${track.url}) — ${track.author}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('📋 Queue')
    .setDescription(
      (current ? `**Now Playing:** [${current.title}](${current.url}) — ${current.author}\n\n` : '') +
      (lines.length ? lines.join('\n') : 'No tracks in queue.')
    )
    .setFooter({ text: `Page ${data.page}/${data.totalPages} • ${data.totalTracks} track(s)` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('queue_prev')
      .setEmoji('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(data.page <= 1),
    new ButtonBuilder()
      .setCustomId('queue_next')
      .setEmoji('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(data.page >= data.totalPages),
    new ButtonBuilder()
      .setCustomId('queue_close')
      .setEmoji('✖')
      .setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [row] };
}
