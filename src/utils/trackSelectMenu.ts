import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import type { Track } from 'discord-player';

function truncateText(text: string, maxLength = 30): string {
  return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text;
}

interface TrackSelectOptions {
  customId?: string;
  placeholder?: string;
  startIndex?: number;
  maxOptions?: number;
  valueFormatter?: (track: Track, index: number) => string;
}

export function createTrackSelectMenu(
  tracks: Track[],
  options: TrackSelectOptions = {}
): ActionRowBuilder<StringSelectMenuBuilder> | null {
  if (!tracks.length) return null;

  const {
    customId = 'track_select',
    placeholder = 'Select a track',
    startIndex = 0,
    maxOptions = 25,
    valueFormatter,
  } = options;

  const menuOptions = tracks.slice(0, maxOptions).map((track, i) => {
    const index = startIndex + i;
    const value = valueFormatter
      ? valueFormatter(track, index)
      : String(index);

    return new StringSelectMenuOptionBuilder()
      .setLabel(truncateText(track.title))
      .setDescription(truncateText(`${track.author} • ${track.duration ? Math.floor(Number(track.duration) / 1000) + 's' : 'Unknown'}`, 50))
      .setValue(value);
  });

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(menuOptions)
  );

  return row;
}
