import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import { generateInviteUrl } from '../utils/inviteUrl.js';
import type { BotClient, Command } from '../types/client.js';

export default {
  data: new SlashCommandBuilder().setName('invite').setDescription('Get the bot invite link'),

  async execute(interaction) {
    const client = interaction.client as BotClient;
    await interaction.deferReply({ ephemeral: true });

    const inviteUrl = generateInviteUrl(client.user!.id);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Invite VovaPlayer')
      .setDescription(`[Click here to invite me!](${inviteUrl})`)
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setLabel('Invite').setURL(inviteUrl).setStyle(ButtonStyle.Link),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },
} satisfies Command;
