const { useQueue } = require('discord-player');

module.exports = {
    name: 'voiceStateUpdate',
    execute(oldState, newState, client) {
        if (oldState.member.user.bot) return;

        const botVoice = oldState.guild.members.me?.voice;
        if (!botVoice?.channel) return;

        const botChannelId = botVoice.channel.id;

        if (oldState.channelId === botChannelId && newState.channelId !== botChannelId) {
            const channel = oldState.channel;
            const nonBotMembers = channel.members.filter(m => !m.user.bot);

            if (nonBotMembers.size === 0) {
                const queue = useQueue(oldState.guild.id);
                if (queue) {
                    const timeout = setTimeout(() => {
                        const currentChannel = oldState.guild.members.me?.voice?.channel;
                        if (currentChannel) {
                            const currentNonBot = currentChannel.members.filter(m => !m.user.bot);
                            if (currentNonBot.size === 0) {
                                queue.delete();
                                client.activePlayers.delete(oldState.guild.id);
                                client.autoplayEnabled.delete(oldState.guild.id);
                                client.playerController.deletePlayer(oldState.guild.id);
                                client.updatePresence();
                            }
                        }
                    }, 30000);

                    if (!client._emptyChannelTimeouts) client._emptyChannelTimeouts = new Map();
                    client._emptyChannelTimeouts.set(oldState.guild.id, timeout);
                }
            }
        }

        if (newState.channelId === botChannelId && oldState.channelId !== botChannelId) {
            if (client._emptyChannelTimeouts?.has(newState.guild.id)) {
                clearTimeout(client._emptyChannelTimeouts.get(newState.guild.id));
                client._emptyChannelTimeouts.delete(newState.guild.id);
            }
        }

        if (oldState.id === client.user.id && oldState.channelId && !newState.channelId) {
            const queue = useQueue(oldState.guild.id);
            if (queue) {
                queue.delete();
            }
            client.activePlayers.delete(oldState.guild.id);
            client.autoplayEnabled.delete(oldState.guild.id);
            client.playerController.deletePlayer(oldState.guild.id);
            client.updatePresence();

            if (client._emptyChannelTimeouts?.has(oldState.guild.id)) {
                clearTimeout(client._emptyChannelTimeouts.get(oldState.guild.id));
                client._emptyChannelTimeouts.delete(oldState.guild.id);
            }
        }
    },
};
