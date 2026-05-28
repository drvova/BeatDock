import { requirePlayer, requireSameVoice } from '../utils/interactionHelpers.js';
import { getValidVolume } from '../utils/volumeValidator.js';
import type { BotClient, Command } from '../types/client.js';

export default {
  data: {
    name: 'volume',
    description: 'Set the playback volume',
    options: [
      { name: 'level', description: 'Volume level (0-150)', type: 4, required: true, min_value: 0, max_value: 150 },
    ],
  },
  async execute(interaction) {
    const client = interaction.client as BotClient;
    const queue = await requirePlayer(interaction);
    if (!queue) return;
    if (!(await requireSameVoice(interaction, queue))) return;

    const rawVolume = interaction.options.getInteger('level', true);
    const volume = getValidVolume(rawVolume.toString(), 80);

    queue.node.setVolume(volume);
    client.playerController.updatePlayer(interaction.guild!.id);

    await interaction.reply(`🔊 ${client.t('VOLUME_SET', volume.toString())}`);
  },
} satisfies Command;
