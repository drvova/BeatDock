const { useQueue } = require('discord-player');

async function requirePlayer(interaction, { requireQueue = false } = {}) {
    const queue = useQueue(interaction.guild.id);

    if (!queue) {
        await interaction.reply({
            content: interaction.client.t('NO_PLAYER'),
            flags: 64,
        });
        return null;
    }

    if (requireQueue && queue.tracks.size === 0) {
        await interaction.reply({
            content: interaction.client.t('QUEUE_EMPTY'),
            flags: 64,
        });
        return null;
    }

    return queue;
}

async function requireSameVoice(interaction, queue) {
    const member = interaction.member;
    const botChannel = queue.channel?.id;
    const userChannel = member.voice.channel?.id;

    if (!userChannel) {
        await interaction.reply({
            content: interaction.client.t('JOIN_VOICE_FIRST'),
            flags: 64,
        });
        return false;
    }

    if (botChannel && botChannel !== userChannel) {
        await interaction.reply({
            content: interaction.client.t('ALREADY_IN_VOICE'),
            flags: 64,
        });
        return false;
    }

    return true;
}

module.exports = { requirePlayer, requireSameVoice };
