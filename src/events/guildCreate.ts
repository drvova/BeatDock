import { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, type TextChannel } from 'discord.js';
import type { BotClient } from '../types/client.js';

export default {
  name: Events.GuildCreate,
  once: false,
  execute(guild: import('discord.js').Guild) {
    const client = guild.client as BotClient;

    const channel = guild.systemChannel
      ?? guild.channels.cache.find(
        ch => ch.isTextBased() && ch.permissionsFor(guild.members.me!)?.has('SendMessages')
      ) as TextChannel | undefined;

    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('👋 Thanks for adding BeatDock!')
      .setDescription('Use `/play <song>` to start playing music.')
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setLabel('GitHub').setURL('https://github.com/BeatDock/BeatDock').setStyle(ButtonStyle.Link),
    );

    channel.send({ embeds: [embed], components: [row] }).catch(() => {});
  },
};
