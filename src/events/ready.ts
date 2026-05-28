import { Events } from 'discord.js';
import { deployCommands } from '../utils/commandDeployer.js';
import { generateInviteUrl } from '../utils/inviteUrl.js';
import type { BotClient } from '../types/client.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: BotClient) {
    await deployCommands(client);
    const inviteUrl = generateInviteUrl(client.user!.id);
    console.log(`\n🔗 Invite URL: ${inviteUrl}\n`);
    client.user?.setActivity();
  },
};
