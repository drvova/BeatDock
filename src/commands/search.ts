import { GuildMember, SlashCommandBuilder, type TextChannel } from 'discord.js';
import { useMainPlayer, type SearchResult } from 'discord-player';
import { checkInteractionPermission } from '../utils/permissionChecker.js';
import { getValidVolume } from '../utils/volumeValidator.js';
import { createSearchEmbed, createSearchComponents } from '../utils/embeds.js';
import type { BotClient, Command } from '../types/client.js';

export default {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for a song')
    .addStringOption(opt => opt.setName('query').setDescription('Song name').setRequired(true).setAutocomplete(true))
    .addIntegerOption(opt => opt.setName('volume').setDescription('Volume (0-150)').setMinValue(0).setMaxValue(150)),

  async execute(interaction) {
    const client = interaction.client as BotClient;
    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      await interaction.reply({ content: `❌ ${client.t('JOIN_VOICE_FIRST')}`, ephemeral: true });
      return;
    }
    if (!(await checkInteractionPermission(interaction))) return;

    await interaction.deferReply();

    const query = interaction.options.getString('query', true);
    const volume = getValidVolume(interaction.options.getInteger('volume')?.toString(), parseInt(process.env.DEFAULT_VOLUME || '80'));

    const player = useMainPlayer();
    const searchResult: SearchResult = await player.search(query, { requestedBy: interaction.user as any });

    if (!searchResult.tracks.length) {
      await interaction.editReply(`❌ ${client.t('TRACK_NOT_FOUND')}`);
      return;
    }

    const results = searchResult.tracks.slice(0, 10);

    const sessionId = client.searchSessions.createSession({
      userId: interaction.user.id,
      guildId: interaction.guild!.id,
      channelId: interaction.channel!.id,
      voiceChannelId: voiceChannel.id,
      results,
      query,
      volume,
    });

    const pageData = {
      tracks: results,
      currentPage: 1,
      totalPages: 1,
      totalTracks: results.length,
      startIndex: 0,
    };

    const embed = createSearchEmbed(client, pageData, query);
    const components = createSearchComponents(sessionId, pageData);
    await interaction.editReply({ embeds: [embed], components });
  },
} satisfies Command;
