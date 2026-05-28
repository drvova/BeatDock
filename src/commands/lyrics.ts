import { EmbedBuilder, MessageFlags } from 'discord.js';
import { useQueue } from 'discord-player';
import type { BotClient, Command } from '../types/client.js';

interface LrclibResult {
  trackName: string;
  artistName: string;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

async function fetchLyrics(title: string, artist: string, duration: number): Promise<string | null> {
  const durationSec = Math.floor(duration / 1000);
  try {
    const resp = await fetch(
      `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}&duration=${durationSec}`
    );
    if (resp.ok) {
      const data = (await resp.json()) as LrclibResult;
      if (data.plainLyrics) return data.plainLyrics;
    }
  } catch { /* fallback to search */ }

  try {
    const resp = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(`${title} ${artist}`)}`
    );
    if (resp.ok) {
      const results = (await resp.json()) as LrclibResult[];
      const match = results.find(r => r.plainLyrics);
      if (match) return match.plainLyrics;
    }
  } catch { /* ignore */ }

  return null;
}

export default {
  data: {
    name: 'lyrics',
    description: 'Get lyrics for the current track',
    options: [
      { name: 'query', description: 'Custom search query', type: 3, required: false },
    ],
  },
  async execute(interaction) {
    const client = interaction.client as BotClient;
    const queue = useQueue(interaction.guild!.id);

    let title: string;
    let artist: string;
    let duration: number;

    const customQuery = interaction.options.getString('query');
    if (customQuery) {
      const parts = customQuery.split(' - ');
      title = parts.length > 1 ? parts[1].trim() : customQuery;
      artist = parts.length > 1 ? parts[0].trim() : '';
      duration = 0;
    } else {
      if (!queue?.currentTrack) {
        await interaction.reply({ content: `❌ ${client.t('NO_TRACK_PLAYING')}`, flags: MessageFlags.Ephemeral });
        return;
      }
      const track = queue.currentTrack;
      title = track.title;
      artist = track.author;
      duration = Number(track.duration);
    }

    await interaction.deferReply();

    const lyrics = await fetchLyrics(title, artist, duration);
    if (!lyrics) {
      await interaction.editReply(`❌ ${client.t('LYRICS_NOT_FOUND')}`);
      return;
    }

    const chunks: string[] = [];
    let remaining = lyrics;
    while (remaining.length > 0) {
      if (remaining.length <= 4096) {
        chunks.push(remaining);
        break;
      }
      const splitAt = remaining.lastIndexOf('\n', 4096);
      chunks.push(remaining.slice(0, splitAt > 0 ? splitAt : 4096));
      remaining = remaining.slice(splitAt > 0 ? splitAt + 1 : 4096);
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🎤 ${title} — ${artist}`)
      .setDescription(chunks[0]);

    for (let i = 1; i < chunks.length; i++) {
      embed.addFields({ name: '\u200b', value: chunks[i] });
    }

    embed.setFooter({ text: `${client.t('LYRICS_SOURCE_LRCLIB')}` });

    await interaction.editReply({ embeds: [embed] });
  },
} satisfies Command;
