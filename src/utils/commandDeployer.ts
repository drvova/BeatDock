import { REST, Routes } from 'discord.js';
import type { BotClient } from '../types/client.js';
import { info as logInfo, error as logError } from './logger.js';

export async function deployCommands(client: BotClient): Promise<void> {
  const commands: Record<string, unknown>[] = [];

  for (const [, command] of client.commands) {
    const data = command.data;
    if ('toJSON' in data && typeof data.toJSON === 'function') {
      commands.push(data.toJSON());
    } else {
      commands.push(data as Record<string, unknown>);
    }
  }

  // Deduplicate by name
  const seen = new Set<string>();
  const unique = commands.filter(cmd => {
    const name = (cmd as { name?: string }).name;
    if (!name || seen.has(name)) return false;
    seen.add(name);
    return true;
  });

  const rest = new REST().setToken(process.env.TOKEN!);
  try {
    await rest.put(Routes.applicationCommands(client.user!.id), { body: unique });
    logInfo('deploy', `Deployed ${unique.length} slash command(s)`);
  } catch (err) {
    logError('deploy', `Failed to deploy commands: ${err}`);
  }
}
