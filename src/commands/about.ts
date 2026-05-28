import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateInviteUrl } from '../utils/inviteUrl.js';
import type { BotClient, Command } from '../types/client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(' ');
}

function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export default {
  data: new SlashCommandBuilder().setName('about').setDescription('Bot information'),

  async execute(interaction) {
    const client = interaction.client as BotClient;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const version = getVersion();
    const uptime = formatUptime(process.uptime() * 1000);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('VovaPlayer')
      .setDescription(`Version **${version}**`)
      .addFields(
        { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
        { name: 'Active Players', value: `${client.activePlayers.size}`, inline: true },
        { name: 'Uptime', value: uptime, inline: true },
        { name: 'Node.js', value: process.version, inline: true },
        { name: 'Platform', value: process.platform, inline: true },
      )
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setLabel('GitHub').setURL('https://github.com/lazaroagomez/BeatDock').setStyle(ButtonStyle.Link),
      new ButtonBuilder().setLabel('Invite').setURL(generateInviteUrl(client.user!.id)).setStyle(ButtonStyle.Link),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },
} satisfies Command;
