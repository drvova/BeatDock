const { RepeatMode } = require('discord-player');
const { requirePlayer, requireSameVoice } = require('../utils/interactionHelpers');

module.exports = {
    data: { name: 'loop', description: 'Set the loop mode' },
    async execute(interaction) {
        const { client } = interaction;
        const queue = await requirePlayer(interaction);
        if (!queue) return;
        if (!(await requireSameVoice(interaction, queue))) return;

        const modeMap = {
            [RepeatMode.OFF]: { next: RepeatMode.TRACK, label: 'LOOP_TRACK' },
            [RepeatMode.TRACK]: { next: RepeatMode.QUEUE, label: 'LOOP_QUEUE' },
            [RepeatMode.QUEUE]: { next: RepeatMode.OFF, label: 'LOOP_OFF' },
        };

        const current = queue.repeatMode;
        const cycle = modeMap[current] || modeMap[RepeatMode.OFF];

        queue.setRepeatMode(cycle.next);

        await interaction.reply({ content: client.t(cycle.label), flags: 64 });
        await client.playerController.updatePlayer(interaction.guild.id);
    },
};
