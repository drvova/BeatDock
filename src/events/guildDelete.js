const { Events } = require('discord.js');
const { useQueue } = require('discord-player');
const searchSessions = require('../utils/searchSessions');

module.exports = {
    name: Events.GuildDelete,
    async execute(guild) {
        const client = guild.client;
        const guildId = guild.id;

        const queue = useQueue(guildId);
        if (queue) queue.delete();
        client.playerController.deletePlayer(guildId);

        // Clean up search sessions for this guild
        searchSessions.cleanupGuildSessions(guildId);

        // Clean up state maps
        client.activePlayers.delete(guildId);
        client.autoplayEnabled.delete(guildId);
        client.updatePresence();

        // Clear any pending empty-channel disconnect timer
        if (client._emptyChannelTimeouts?.has(guildId)) {
            clearTimeout(client._emptyChannelTimeouts.get(guildId));
            client._emptyChannelTimeouts.delete(guildId);
        }
    },
};
