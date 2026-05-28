import 'dotenv/config';
import { Client, GatewayIntentBits, ActivityType } from 'discord.js';
import { Player, useHistory, useQueue, type Track } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';
import { LanguageManager } from './LanguageManager.js';
import { PlayerController } from './utils/PlayerController.js';
import { SearchSessionManager } from './utils/searchSessions.js';
import { loadCommands } from './handlers/commandHandler.js';
import { registerEvents } from './handlers/eventHandler.js';
import { findAutoplayTracks } from './utils/autoplay.js';
import { info as logInfo, warn as logWarn, error as logError, track as logTrack } from './utils/logger.js';
import { getValidVolume } from './utils/volumeValidator.js';
import type { BotClient } from './types/client.js';


const AUTOPLAY_TIMEOUT_MS = 5000;
const TRACK_END_CLEANUP_DELAY_MS = 500;

const TOKEN = process.env.TOKEN!;
const DEFAULT_VOLUME = getValidVolume(process.env.DEFAULT_VOLUME, 80);
const QUEUE_EMPTY_DESTROY_MS = parseInt(process.env.QUEUE_EMPTY_DESTROY_MS || '30000', 10);

function createClient(): BotClient {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  }) as BotClient;

  client.languageManager = new LanguageManager();
  client.defaultLanguage = process.env.DEFAULT_LANGUAGE || 'en';
  client.playerController = new PlayerController(client);
  client.searchSessions = new SearchSessionManager();
  client.activePlayers = new Map();
  client.autoplayEnabled = new Map();
  client._emptyChannelTimeouts = new Map();
  client._queueEndTimeouts = new Map();

  client.t = (key: string, ...args: string[]) =>
    client.languageManager.get(client.defaultLanguage, key, ...args);

  client.updatePresence = () => {
    const count = client.activePlayers.size;
    client.user?.setPresence({
      activities: [{
        name: count > 0 ? `music in ${count} server${count > 1 ? 's' : ''}` : '/play',
        type: count > 0 ? ActivityType.Listening : ActivityType.Playing,
      }],
      status: count > 0 ? 'online' : 'idle',
    });
  };

  return client;
}

function cleanupGuildPlayer(client: BotClient, guildId: string): void {
  client.playerController.deletePlayer(guildId);
  client.activePlayers.delete(guildId);
  client.autoplayEnabled.delete(guildId);
  const timeout = client._queueEndTimeouts.get(guildId);
  if (timeout) {
    clearTimeout(timeout);
    client._queueEndTimeouts.delete(guildId);
  }
  client.updatePresence();
}

async function setupPlayer(client: BotClient): Promise<void> {
  const player = new Player(client as any);
  await player.extractors.loadMulti(DefaultExtractors);
  client.discordPlayer = player;
}

function registerPlayerEvents(client: BotClient): void {
  const player = client.discordPlayer;

  player.events.on('playerStart', (queue, track) => {
    const existingTimeout = client._queueEndTimeouts.get(queue.guild.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      client._queueEndTimeouts.delete(queue.guild.id);
    }

    if (!client.autoplayEnabled.has(queue.guild.id)) {
      client.autoplayEnabled.set(queue.guild.id, process.env.AUTOPLAY_DEFAULT === 'true');
    }

    client.activePlayers.set(queue.guild.id, { voiceChannelId: queue.channel?.id ?? '' });
    client.playerController.sendPlayer(queue.metadata as import('discord.js').TextChannel, queue.guild.id, track);
    client.updatePresence();
    logTrack('track', `Now playing: ${track.title} by ${track.author} [${queue.guild.name}]`);
  });

  player.events.on('playerFinish', (queue) => {
    setTimeout(() => {
      if (!queue.currentTrack && queue.tracks.size === 0) {
        client.playerController.deletePlayer(queue.guild.id);
      }
    }, TRACK_END_CLEANUP_DELAY_MS);
  });

  player.events.on('emptyQueue', async (queue) => {
    if (!client.autoplayEnabled.get(queue.guild.id)) {
      cleanupGuildPlayer(client, queue.guild.id);
      return;
    }

    const timeout = setTimeout(async () => {
      client._queueEndTimeouts.delete(queue.guild.id);
      const newQueue = useQueue(queue.guild.id);
      if (!newQueue || newQueue.tracks.size > 0 || newQueue.currentTrack) return;

      const history = useHistory(queue.guild.id);
      const lastPlayed = history?.previousTrack ?? undefined;
      if (!lastPlayed) {
        cleanupGuildPlayer(client, queue.guild.id);
        return;
      }

      try {
        const tracks = await findAutoplayTracks(client.discordPlayer, queue.guild.id, lastPlayed);
        if (!tracks?.length) {
          cleanupGuildPlayer(client, queue.guild.id);
          return;
        }

        const q = useQueue(queue.guild.id);
        if (!q) return;
        for (const t of tracks) q.tracks.add(t);
        if (!q.isPlaying()) q.node.play();
        logTrack('track', `Autoplay added ${tracks.length} track(s) [${q.guild.name}]`);
      } catch (err) {
        logError('autoplay', `Autoplay error: ${err}`);
        cleanupGuildPlayer(client, queue.guild.id);
      }
    }, AUTOPLAY_TIMEOUT_MS);

    client._queueEndTimeouts.set(queue.guild.id, timeout);
  });

  player.events.on('playerSkip', (queue, track) => {
    logTrack('track', `Track skipped: ${track.title} [${queue.guild.name}]`);
  });

  player.events.on('playerError', (queue, error, track) => {
    logError('track', `Player error for "${track.title}": ${error.message} [${queue.guild.name}]`);
  });

  player.events.on('error', (_queue, error) => {
    logError('player', `Player error: ${error.message}`);
  });
}

function setupShutdown(client: BotClient): void {
  const shutdown = () => {
    logInfo('shutdown', 'Shutting down...');
    client.searchSessions.destroy();
    client.discordPlayer.destroy();
    client.destroy();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function bootstrap(): Promise<void> {
  const client = createClient();
  await setupPlayer(client);
  registerPlayerEvents(client);
  await loadCommands(client);
  await registerEvents(client);
  setupShutdown(client);

  client.once('ready', () => {
    logInfo('ready', `Logged in as ${client.user?.tag}`);
    client.updatePresence();
  });

  await client.login(TOKEN);
}

bootstrap().catch(err => {
  logError('bootstrap', `Fatal: ${err}`);
  process.exit(1);
});

export { cleanupGuildPlayer };
