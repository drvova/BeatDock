import { Events, type GuildMember } from 'discord.js';
import { useQueue } from 'discord-player';
import type { BotClient } from '../types/client.js';

const EMPTY_CHANNEL_TIMEOUT = parseInt(process.env.EMPTY_CHANNEL_DESTROY_MS || '30000', 10);

export default {
  name: Events.VoiceStateUpdate,
  once: false,
  execute(oldState: import('discord.js').VoiceState, newState: import('discord.js').VoiceState) {
    const client = oldState.client as BotClient;
    const guild = oldState.guild;

    // Bot was disconnected
    if (oldState.id === client.user!.id && !newState.channelId) {
      const queue = useQueue(guild.id);
      if (queue) queue.delete();
      client.playerController.deletePlayer(guild.id);
      client.activePlayers.delete(guild.id);
      client.autoplayEnabled.delete(guild.id);
      const timeout = client._emptyChannelTimeouts.get(guild.id);
      if (timeout) {
        clearTimeout(timeout);
        client._emptyChannelTimeouts.delete(guild.id);
      }
      client.updatePresence();
      return;
    }

    // Ignore non-bot user changes if no queue
    if (oldState.id === client.user!.id) return;

    const queue = useQueue(guild.id);
    if (!queue) return;

    const botChannel = queue.channel?.id;
    if (!botChannel) return;

    // User left the bot's channel
    if (oldState.channelId === botChannel && newState.channelId !== botChannel) {
      const channel = guild.channels.cache.get(botChannel);
      if (channel && 'members' in channel) {
        const humanMembers = (channel as import('discord.js').VoiceChannel).members.filter(m => !m.user.bot);
        if (humanMembers.size === 0) {
          const timeout = setTimeout(() => {
            client._emptyChannelTimeouts.delete(guild.id);
            const q = useQueue(guild.id);
            if (q) {
              q.delete();
              client.playerController.deletePlayer(guild.id);
              client.activePlayers.delete(guild.id);
              client.autoplayEnabled.delete(guild.id);
              client.updatePresence();
            }
          }, EMPTY_CHANNEL_TIMEOUT);
          client._emptyChannelTimeouts.set(guild.id, timeout);
        }
      }
    }

    // User joined the bot's channel — cancel empty timeout
    if (newState.channelId === botChannel && oldState.channelId !== botChannel) {
      const timeout = client._emptyChannelTimeouts.get(guild.id);
      if (timeout) {
        clearTimeout(timeout);
        client._emptyChannelTimeouts.delete(guild.id);
      }
    }
  },
};
