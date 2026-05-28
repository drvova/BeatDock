import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { type Track } from 'discord-player';
import { createTrackSelectMenu } from './trackSelectMenu.js';
import type { BotClient } from '../types/client.js';

export function formatDuration(ms: number): string {
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

export interface PageData {
  tracks: Track[];
  currentPage: number;
  totalPages: number;
  totalTracks: number;
  startIndex: number;
}

export function createSearchEmbed(
  _client: BotClient,
  pageData: PageData,
  query: string
): EmbedBuilder {
  const lines = pageData.tracks.map((track, i) => {
    const num = pageData.startIndex + i + 1;
    return `\`${num}.\` [${track.title}](${track.url}) — ${track.author} \`[${formatDuration(Number(track.duration))}]\``;
  });

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🔍 Search: ${query}`)
    .setDescription(lines.join('\n') || 'No results found.')
    .setFooter({ text: `Page ${pageData.currentPage}/${pageData.totalPages} • ${pageData.totalTracks} result(s)` });
}

export function createSearchComponents(
  sessionId: string,
  pageData: PageData
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  const selectRow = createTrackSelectMenu(pageData.tracks, {
    customId: `search_select_${sessionId}`,
    placeholder: 'Select a track to play',
    startIndex: pageData.startIndex,
  });
  if (selectRow) rows.push(selectRow as unknown as ActionRowBuilder<ButtonBuilder>);

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`search_prev_${sessionId}`)
      .setEmoji('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageData.currentPage <= 1),
    new ButtonBuilder()
      .setCustomId(`search_next_${sessionId}`)
      .setEmoji('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageData.currentPage >= pageData.totalPages),
    new ButtonBuilder()
      .setCustomId(`search_cancel_${sessionId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger),
  );
  rows.push(navRow);

  return rows;
}
