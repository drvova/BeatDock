require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { Player, useHistory, useQueue } = require('discord-player');
require('@discord-player/extractor');
const LanguageManager = require('./LanguageManager');
const PlayerController = require('./utils/PlayerController');
const searchSessions = require('./utils/searchSessions');
const { findAutoplayTracks } = require('./utils/autoplay');
const loadCommands = require('./handlers/commandHandler');
const registerEvents = require('./handlers/eventHandler');
const logger = require('./utils/logger');

const AUTOPLAY_TIMEOUT_MS = 5000;
const TRACK_END_CLEANUP_DELAY_MS = 500;
const DEFAULT_VOLUME = parseInt(process.env.DEFAULT_VOLUME || '80', 10);
const QUEUE_EMPTY_DESTROY_MS = parseInt(process.env.QUEUE_EMPTY_DESTROY_MS || '30000', 10);

function createClient() {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates,
        ],
    });

    client.languageManager = new LanguageManager();
    client.defaultLanguage = process.env.DEFAULT_LANGUAGE || 'en';

    client.t = function (key, ...args) {
        return this.languageManager.get(this.defaultLanguage, key, ...args);
    };

    client.playerController = new PlayerController(client);
    client.activePlayers = new Map();
    client.autoplayEnabled = new Map();

    client.updatePresence = function() {
        const activePlayers = Array.from(this.activePlayers.values());

        if (activePlayers.length === 0) {
            this.user.setActivity(null);
        } else if (activePlayers.length === 1) {
            this.user.setActivity(this.t('PLAYING_MUSIC_GENERIC'), { type: ActivityType.Listening });
        } else {
            this.user.setActivity(this.t('PLAYING_MUSIC_IN_SERVERS', activePlayers.length), { type: ActivityType.Listening });
        }
    };

    return client;
}

function cleanupGuildPlayer(client, guildId) {
    client.playerController.deletePlayer(guildId);
    client.activePlayers.delete(guildId);
    client.autoplayEnabled.delete(guildId);
    client.updatePresence();
}

async function setupPlayer(client) {
    const player = new Player(client);
    await player.extractors.loadDefault();

    player.nodes.defaults = {
        ...player.nodes.defaults,
        metadata: null,
        selfDeaf: true,
        volume: DEFAULT_VOLUME,
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: QUEUE_EMPTY_DESTROY_MS,
        leaveOnEnd: true,
        leaveOnEndCooldown: QUEUE_EMPTY_DESTROY_MS,
    };

    client.discordPlayer = player;
    logger.info('discord-player initialized with extractors loaded');
}

function registerPlayerEvents(client) {
    const player = client.discordPlayer;
    const queueEndTimeouts = new Map();

    player.events.on('playerStart', (queue, track) => {
        const guildId = queue.guild.id;

        if (queueEndTimeouts.has(guildId)) {
            clearTimeout(queueEndTimeouts.get(guildId));
            queueEndTimeouts.delete(guildId);
        }

        if (!client.autoplayEnabled.has(guildId)) {
            const autoplayDefault = process.env.AUTOPLAY_DEFAULT === 'true';
            client.autoplayEnabled.set(guildId, autoplayDefault);
        }

        client.playerController.updatePlayer(guildId);

        client.activePlayers.set(guildId, {
            title: track.title,
            startedAt: Date.now(),
        });
        client.updatePresence();

        logger.track(`Now playing: ${track.title} — ${track.author}`);
    });

    player.events.on('playerFinish', (queue, track) => {
        logger.debug(`Track ended: ${track.title}`);

        setTimeout(() => {
            const currentQueue = useQueue(queue.guild.id);
            if (currentQueue?.currentTrack) {
                client.playerController.updatePlayer(queue.guild.id);
            } else if (!client.autoplayEnabled.get(queue.guild.id)) {
                cleanupGuildPlayer(client, queue.guild.id);
            }
        }, TRACK_END_CLEANUP_DELAY_MS);
    });

    player.events.on('emptyQueue', (queue) => {
        const guildId = queue.guild.id;

        if (queueEndTimeouts.has(guildId)) {
            clearTimeout(queueEndTimeouts.get(guildId));
            queueEndTimeouts.delete(guildId);
        }

        if (client.autoplayEnabled.get(guildId)) {
            const timeout = setTimeout(async () => {
                queueEndTimeouts.delete(guildId);

                const currentQueue = useQueue(guildId);
                if (currentQueue?.currentTrack || currentQueue?.isPlaying()) return;

                try {
                    const history = useHistory(guildId);
                    const lastPlayed = history?.previous?.()?.[0];
                    if (!lastPlayed) {
                        cleanupGuildPlayer(client, guildId);
                        return;
                    }

                    const tracks = await findAutoplayTracks(client.discordPlayer, guildId, lastPlayed);
                    if (!client.autoplayEnabled.get(guildId)) return;

                    if (tracks.length > 0) {
                        const q = useQueue(guildId);
                        if (!q) return;
                        for (const track of tracks) {
                            q.tracks.add(track);
                        }
                        if (!q.isPlaying()) q.node.play();
                    } else {
                        cleanupGuildPlayer(client, guildId);
                    }
                } catch (err) {
                    logger.error('Autoplay failed:', err);
                    cleanupGuildPlayer(client, guildId);
                }
            }, AUTOPLAY_TIMEOUT_MS);
            queueEndTimeouts.set(guildId, timeout);
            return;
        }

        const playerMessage = client.playerController.playerMessages.get(guildId);
        if (playerMessage) {
            const textChannel = client.channels.cache.get(playerMessage.channelId);
            if (textChannel) {
                textChannel.send(client.t('QUEUE_ENDED')).catch(() => {});
            }
        }
        cleanupGuildPlayer(client, guildId);
    });

    player.events.on('playerSkip', (queue, track) => {
        logger.warn(`Track skipped: ${track.title}`);
    });

    player.events.on('playerError', (queue, track, error) => {
        logger.error(`Track error: ${track.title} — ${error.message}`);
    });

    player.events.on('error', (queue, error) => {
        logger.error('Queue error:', error);
    });
}

function setupShutdown(client) {
    const shutdown = async (signal) => {
        logger.info(`Received ${signal}, shutting down gracefully...`);

        searchSessions.destroy();

        try {
            client.discordPlayer.destroy();
        } catch {
            // Player may not be initialized
        }

        await client.destroy();
        process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

async function bootstrap() {
    const client = createClient();
    await setupPlayer(client);
    registerPlayerEvents(client);
    loadCommands(client);
    registerEvents(client);
    setupShutdown(client);
    await client.login(process.env.TOKEN);
}

process.on('unhandledRejection', (error) => {
    logger.error('Unhandled promise rejection:', error);
});

bootstrap().catch(err => {
    logger.error('Failed to start bot:', err);
    process.exit(1);
});
