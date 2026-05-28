import { requirePlayer, requireSameVoice } from '../utils/interactionHelpers.js';
import type { BotClient, Command } from '../types/client.js';

export default {
  data: { name: 'stop', description: 'Stop playback and clear the queue' },
  async execute(interaction) {
    const client = interaction.client as BotClient;
    const queue = await requirePlayer(interaction);
    if (!queue) return;
    if (!(await requireSameVoice(interaction, queue))) return;

    queue.delete();
    client.autoplayEnabled.delete(interaction.guild!.id);
    client.activePlayers.delete(interaction.guild!.id);
    client.updatePresence();

    await interaction.reply(`⏹ ${client.t('STOPPED')}`);
  },
} satisfies Command;
