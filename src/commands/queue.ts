import { requirePlayer } from '../utils/interactionHelpers.js';
import { createPaginatedQueueResponse } from '../utils/PlayerActions.js';
import type { BotClient, Command } from '../types/client.js';

export default {
  data: { name: 'queue', description: 'Show the queue' },
  async execute(interaction) {
    const client = interaction.client as BotClient;
    const queue = await requirePlayer(interaction);
    if (!queue) return;

    const response = createPaginatedQueueResponse(client, queue, 1);
    await interaction.reply(response);
  },
} satisfies Command;
