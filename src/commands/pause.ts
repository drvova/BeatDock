import { requirePlayer, requireSameVoice } from '../utils/interactionHelpers.js';
import type { BotClient, Command } from '../types/client.js';

export default {
  data: { name: 'pause', description: 'Pause or resume playback' },
  async execute(interaction) {
    const client = interaction.client as BotClient;
    const queue = await requirePlayer(interaction);
    if (!queue) return;
    if (!(await requireSameVoice(interaction, queue))) return;

    if (queue.node.isPaused()) {
      queue.node.resume();
      await interaction.reply(`▶ ${client.t('RESUMED')}`);
    } else {
      queue.node.pause();
      await interaction.reply(`⏸ ${client.t('PAUSED')}`);
    }
  },
} satisfies Command;
