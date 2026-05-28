import { Events } from 'discord.js';
import { useQueue } from 'discord-player';
import type { BotClient } from '../types/client.js';

export default {
  name: Events.GuildDelete,
  once: false,
  execute(guild: import('discord.js').Guild) {
    const client = guild.client as BotClient;

    const queue = useQueue(guild.id);
    if (queue) queue.delete();

    client.playerController.deletePlayer(guild.id);
    client.activePlayers.delete(guild.id);
    client.autoplayEnabled.delete(guild.id);
    client.searchSessions.cleanupGuildSessions(guild.id);
    client.updatePresence();
  },
};
