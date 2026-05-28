import { QueueRepeatMode } from 'discord-player';
import { requirePlayer, requireSameVoice } from '../utils/interactionHelpers.js';
import type { BotClient, Command } from '../types/client.js';

const MODE_CYCLE = new Map<number, { next: number; label: string }>([
  [QueueRepeatMode.OFF, { next: QueueRepeatMode.TRACK, label: 'Track' }],
  [QueueRepeatMode.TRACK, { next: QueueRepeatMode.QUEUE, label: 'Queue' }],
  [QueueRepeatMode.QUEUE, { next: QueueRepeatMode.OFF, label: 'Off' }],
]);

export default {
  data: { name: 'loop', description: 'Toggle loop mode' },
  async execute(interaction) {
    const client = interaction.client as BotClient;
    const queue = await requirePlayer(interaction);
    if (!queue) return;
    if (!(await requireSameVoice(interaction, queue))) return;

    const current = queue.repeatMode;
    const cycle = MODE_CYCLE.get(current) ?? MODE_CYCLE.get(QueueRepeatMode.OFF)!;
    queue.setRepeatMode(cycle.next as QueueRepeatMode);
    client.playerController.updatePlayer(interaction.guild!.id);

    await interaction.reply(`🔁 ${client.t('LOOP_SET', cycle.label)}`);
  },
} satisfies Command;
