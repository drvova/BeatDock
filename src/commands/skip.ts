import { requirePlayer, requireSameVoice } from '../utils/interactionHelpers.js';
import type { BotClient, Command } from '../types/client.js';

export default {
  data: { name: 'skip', description: 'Skip the current track' },
  async execute(interaction) {
    const client = interaction.client as BotClient;
    const queue = await requirePlayer(interaction);
    if (!queue) return;
    if (!(await requireSameVoice(interaction, queue))) return;

    const autoplaySkip = client.autoplayEnabled.get(interaction.guild!.id) && queue.tracks.size === 0;

    queue.node.skip();

    await interaction.reply(
      autoplaySkip ? `⏭ ${client.t('AUTOPLAY_SKIP')}` : `⏭ ${client.t('SKIPPED')}`
    );
  },
} satisfies Command;
