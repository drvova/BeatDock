import type { ChatInputCommandInteraction, ButtonInteraction, StringSelectMenuInteraction, GuildMember } from 'discord.js';
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
      ephemeral: true,
    });
    return null;
  }

  if (requireQueue && queue.tracks.size === 0 && !queue.currentTrack) {
    await interaction.reply({
      content: `❌ ${client.t('QUEUE_EMPTY')}`,
      ephemeral: true,
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
      ephemeral: true,
    });
    return false;
  }

  if (queue.channel?.id !== member.voice.channel.id) {
    await interaction.reply({
      content: `❌ ${client.t('ALREADY_IN_VOICE')}`,
      ephemeral: true,
    });
    return false;
  }

  return true;
}
