import { requirePlayer } from '../utils/interactionHelpers.js';
import type { BotClient, Command } from '../types/client.js';

export default {
  data: { name: 'nowplaying', description: 'Show the current track' },
  async execute(interaction) {
    const client = interaction.client as BotClient;
    const queue = await requirePlayer(interaction);
    if (!queue) return;

    const track = queue.currentTrack;
    if (!track) {
      await interaction.reply({ content: `❌ ${client.t('NO_TRACK_PLAYING')}`, ephemeral: true });
      return;
    }

    const embed = client.playerController.createPlayerEmbed(interaction.guild!.id, track);
    await interaction.reply({ embeds: [embed] });
  },
} satisfies Command;
