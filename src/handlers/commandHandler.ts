import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Collection } from 'discord.js';
import type { BotClient, Command } from '../types/client.js';
import { cmd as logCmd } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadCommands(client: BotClient): Promise<void> {
  client.commands = new Collection();
  const commandsDir = join(__dirname, '..', 'commands');

  for (const file of readdirSync(commandsDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'))) {
    const { default: command } = await import(join(commandsDir, file)) as { default: Command };
    if (command?.data && typeof command?.execute === 'function') {
      const name = ('name' in command.data) ? command.data.name : undefined;
      if (name) {
        client.commands.set(name, command);
        logCmd('cmd', `Loaded command: ${name}`);
      }
    }
  }
}
