import type { Client, Collection } from 'discord.js';
import type { Player } from 'discord-player';
import type { LanguageManager } from '../LanguageManager.js';
import type { PlayerController } from '../utils/PlayerController.js';
import type { SearchSessionManager } from '../utils/searchSessions.js';

export interface BotClient extends Client {
  discordPlayer: Player;
  languageManager: LanguageManager;
  defaultLanguage: string;
  playerController: PlayerController;
  searchSessions: SearchSessionManager;
  commands: Collection<string, Command>;
  activePlayers: Map<string, { voiceChannelId: string }>;
  autoplayEnabled: Map<string, boolean>;
  _emptyChannelTimeouts: Map<string, NodeJS.Timeout>;
  _queueEndTimeouts: Map<string, NodeJS.Timeout>;
  t: (key: string, ...args: string[]) => string;
  updatePresence: () => void;
}

export interface Command {
  data: { name: string } & Record<string, any>;
  execute: (interaction: import('discord.js').ChatInputCommandInteraction) => Promise<void>;
}

export interface SearchSession {
  sessionId: string;
  userId: string;
  guildId: string;
  channelId: string;
  voiceChannelId: string;
  results: import('discord-player').Track[];
  query: string;
  volume: number;
  currentPage: number;
  createdAt: number;
}
