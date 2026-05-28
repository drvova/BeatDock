import { requirePlayer, requireSameVoice } from '../utils/interactionHelpers.js';
import { playPrevious } from '../utils/PlayerActions.js';
import type { BotClient, Command } from '../types/client.js';

export default {
  data: { name: 'back', description: 'Play the previous track' },
  async execute(interaction) {
    const client = interaction.client as BotClient;
    const queue = await requirePlayer(interaction);
    if (!queue) return;
    if (!(await requireSameVoice(interaction, queue))) return;

    const track = await playPrevious(interaction);
    if (!track) {
      await interaction.reply({ content: `❌ ${client.t('NO_PREVIOUS_TRACKS')}`, ephemeral: true });
      return;
    }

    await interaction.reply(`⏮ ${client.t('PLAYING_PREVIOUS', track.title)}`);
  },
} satisfies Command;
