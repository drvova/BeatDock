import { requirePlayer } from '../utils/interactionHelpers.js';
import { buildFilterResponse } from '../interactions/filterNavigation.js';
import type { BotClient, Command } from '../types/client.js';

export default {
  data: { name: 'filter', description: 'Manage audio filters' },
  async execute(interaction) {
    const client = interaction.client as BotClient;
    const queue = await requirePlayer(interaction);
    if (!queue) return;

    const response = buildFilterResponse(client, queue, 1);
    await interaction.reply(response as any);
  },
} satisfies Command;
