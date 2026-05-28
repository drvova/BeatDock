import { useQueue, QueueRepeatMode } from 'discord-player';
import type { BotClient, Command } from '../types/client.js';

export default {
  data: { name: 'autoplay', description: 'Toggle autoplay' },
  async execute(interaction) {
    const client = interaction.client as BotClient;
    const queue = useQueue(interaction.guild!.id);
    if (!queue) {
      await interaction.reply({ content: `❌ ${client.t('NO_PLAYER')}`, ephemeral: true });
      return;
    }

    const enabled = !client.autoplayEnabled.get(interaction.guild!.id);
    client.autoplayEnabled.set(interaction.guild!.id, enabled);

    if (enabled) {
      queue.setRepeatMode(QueueRepeatMode.OFF);
    }

    await interaction.reply(enabled ? `▶ ${client.t('AUTOPLAY_ON')}` : `⏹ ${client.t('AUTOPLAY_OFF')}`);
  },
} satisfies Command;
