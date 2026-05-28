import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BotClient } from '../types/client.js';
import { cmd as logCmd } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function registerEvents(client: BotClient): Promise<void> {
  const eventsDir = join(__dirname, '..', 'events');

  for (const file of readdirSync(eventsDir).filter(f => f.endsWith('.js') && !f.endsWith('.d.ts'))) {
    const { default: event } = await import(join(eventsDir, file)) as {
      default: { name: string; once?: boolean; execute: (...args: unknown[]) => Promise<void> | void };
    };
    if (event?.name && event?.execute) {
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
      } else {
        client.on(event.name, (...args) => event.execute(...args));
      }
      logCmd('cmd', `Loaded event: ${event.name}`);
    }
  }
}
