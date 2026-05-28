import { MessageFlags, type ChatInputCommandInteraction, type ButtonInteraction, type StringSelectMenuInteraction, type GuildMember } from 'discord.js';
import { useQueue, type GuildQueue } from 'discord-player';
import type { BotClient } from '../types/client.js';

type AnyInteraction = ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction;

export async function requirePlayer(
  interaction: AnyInteraction,
  options: { requireQueue?: boolean } = {}
): Promise<GuildQueue | null> {
  const { requireQueue = false } = options;
  const client = interaction.client as BotClient;
  const queue = useQueue(interaction.guild!.id);

  if (!queue) {
    await interaction.reply({
      content: `❌ ${client.t('NO_PLAYER')}`,
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  if (requireQueue && queue.tracks.size === 0 && !queue.currentTrack) {
    await interaction.reply({
      content: `❌ ${client.t('QUEUE_EMPTY')}`,
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  return queue;
}

export async function requireSameVoice(
  interaction: AnyInteraction,
  queue: GuildQueue
): Promise<boolean> {
  const client = interaction.client as BotClient;
  const member = interaction.member as GuildMember;

  if (!member.voice.channel) {
    await interaction.reply({
      content: `❌ ${client.t('JOIN_VOICE_FIRST')}`,
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  if (queue.channel?.id !== member.voice.channel.id) {
    await interaction.reply({
      content: `❌ ${client.t('ALREADY_IN_VOICE')}`,
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  return true;
}
