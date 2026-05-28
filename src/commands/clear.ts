import { requirePlayer, requireSameVoice } from '../utils/interactionHelpers.js';
import { clearQueue } from '../utils/PlayerActions.js';
import type { BotClient, Command } from '../types/client.js';

export default {
  data: { name: 'clear', description: 'Clear the queue' },
  async execute(interaction) {
    const client = interaction.client as BotClient;
    const queue = await requirePlayer(interaction, { requireQueue: true });
    if (!queue) return;
    if (!(await requireSameVoice(interaction, queue))) return;

    clearQueue(queue);
    client.autoplayEnabled.delete(interaction.guild!.id);
    client.playerController.updatePlayer(interaction.guild!.id);

    await interaction.reply(`🗑 ${client.t('QUEUE_CLEARED')}`);
  },
} satisfies Command;
