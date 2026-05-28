import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import { type GuildQueue } from 'discord-player';
import type { BotClient } from '../types/client.js';

interface EffectDef {
  name: string;
  label: string;
  emoji: string;
  filters: string[];
}

export const EFFECTS: Record<string, EffectDef> = {
  bassboost: { name: 'bassboost', label: 'Bass Boost', emoji: '🔈', filters: ['bassboost'] },
  nightcore: { name: 'nightcore', label: 'Nightcore', emoji: '⚡', filters: ['nightcore'] },
  vaporwave: { name: 'vaporwave', label: 'Vaporwave', emoji: '🌊', filters: ['vaporwave'] },
  '8d': { name: '8d', label: '8D Audio', emoji: '🎧', filters: ['8d'] },
  karaoke: { name: 'karaoke', label: 'Karaoke', emoji: '🎤', filters: ['karaoke'] },
  tremolo: { name: 'tremolo', label: 'Tremolo', emoji: '〰️', filters: ['tremolo'] },
  vibrato: { name: 'vibrato', label: 'Vibrato', emoji: '🎵', filters: ['vibrato'] },
  lowpass: { name: 'lowpass', label: 'Low Pass', emoji: '🔉', filters: ['lowpass'] },
  reset: { name: 'reset', label: 'Reset All', emoji: '🔄', filters: [] },
};

const EFFECTS_PER_PAGE = 5;

function isFilterActive(queue: GuildQueue, key: string): boolean {
  if (key === 'reset') return false;
  const effect = EFFECTS[key];
  if (!effect) return false;
  return effect.filters.some(f => queue.filters.ffmpeg.isEnabled(f as any));
}

function getFilterLabel(key: string): string {
  return EFFECTS[key]?.label ?? key;
}

export function buildFilterResponse(
  client: BotClient,
  queue: GuildQueue,
  page: number
): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const effectKeys = Object.keys(EFFECTS);
  const totalPages = Math.ceil(effectKeys.length / EFFECTS_PER_PAGE);
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * EFFECTS_PER_PAGE;
  const pageKeys = effectKeys.slice(start, start + EFFECTS_PER_PAGE);

  const lines = pageKeys.map(key => {
    const effect = EFFECTS[key];
    const active = isFilterActive(queue, key);
    return `${effect.emoji} **${effect.label}** — ${active ? '✅ ON' : '❌ OFF'}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎛 Audio Filters')
    .setDescription(lines.join('\n'))
    .setFooter({ text: `Page ${safePage}/${totalPages}` });

  const buttonRow = new ActionRowBuilder<ButtonBuilder>();
  for (const key of pageKeys) {
    const effect = EFFECTS[key];
    const active = isFilterActive(queue, key);
    buttonRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`filter_${key}`)
        .setLabel(effect.label)
        .setStyle(active ? ButtonStyle.Success : ButtonStyle.Secondary)
    );
  }

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`filter_prev_${safePage}`)
      .setEmoji('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage <= 1),
    new ButtonBuilder()
      .setCustomId(`filter_next_${safePage}`)
      .setEmoji('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage >= totalPages),
  );

  return {
    embeds: [embed],
    components: [buttonRow, navRow] as ActionRowBuilder<ButtonBuilder>[],
  };
}

export async function applyFilter(queue: GuildQueue, key: string): Promise<void> {
  if (key === 'reset') {
    await queue.filters.ffmpeg.setFilters([]);
    return;
  }
  const effect = EFFECTS[key];
  if (!effect) return;
  await queue.filters.ffmpeg.toggle(effect.filters as any);
}

export async function handleFilterNavigation(
  interaction: import('discord.js').ButtonInteraction,
  action: string,
  args: string[]
): Promise<void> {
  const client = interaction.client as BotClient;
  const { useQueue } = await import('discord-player');
  const queue = useQueue(interaction.guild!.id);
  if (!queue) {
    await interaction.reply({ content: `❌ ${client.t('NO_PLAYER')}`, flags: MessageFlags.Ephemeral });
    return;
  }

  if (action === 'reset') {
    await applyFilter(queue, 'reset');
    const response = buildFilterResponse(client, queue, 1);
    await interaction.update(response);
    return;
  }

  if (action === 'prev' || action === 'next') {
    const currentPage = parseInt(args[0]) || 1;
    const newPage = action === 'prev' ? currentPage - 1 : currentPage + 1;
    const response = buildFilterResponse(client, queue, newPage);
    await interaction.update(response);
    return;
  }

  // Individual filter toggle
  await applyFilter(queue, action);
  const response = buildFilterResponse(client, queue, 1);
  await interaction.update(response);
}
