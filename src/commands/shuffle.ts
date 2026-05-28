import { requirePlayer, requireSameVoice } from '../utils/interactionHelpers.js';
import { shuffleQueue } from '../utils/PlayerActions.js';
import type { BotClient, Command } from '../types/client.js';

export default {
  data: { name: 'shuffle', description: 'Shuffle the queue' },
  async execute(interaction) {
    const client = interaction.client as BotClient;
    const queue = await requirePlayer(interaction, { requireQueue: true });
    if (!queue) return;
    if (!(await requireSameVoice(interaction, queue))) return;

    shuffleQueue(queue);
    client.autoplayEnabled.delete(interaction.guild!.id);
    client.playerController.updatePlayer(interaction.guild!.id);

    await interaction.reply(`🔀 ${client.t('SHUFFLED')}`);
  },
} satisfies Command;
