import { GuildMember, SlashCommandBuilder, type TextChannel } from 'discord.js';
import { useMainPlayer, useQueue, type SearchResult } from 'discord-player';
import { checkInteractionPermission } from '../utils/permissionChecker.js';
import { getValidVolume } from '../utils/volumeValidator.js';
import type { BotClient, Command } from '../types/client.js';

export default {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song')
    .addStringOption(opt => opt.setName('query').setDescription('Song name or URL').setRequired(true).setAutocomplete(true))
    .addIntegerOption(opt => opt.setName('volume').setDescription('Volume (0-150)').setMinValue(0).setMaxValue(150))
    .addIntegerOption(opt => opt.setName('position').setDescription('Position in queue').setMinValue(1)),

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
    const position = interaction.options.getInteger('position');

    const player = useMainPlayer();
    const searchResult: SearchResult = await player.search(query, { requestedBy: interaction.user as any });

    if (!searchResult.tracks.length) {
      await interaction.editReply(`❌ ${client.t('TRACK_NOT_FOUND')}`);
      return;
    }

    const existingQueue = useQueue(interaction.guild!.id);

    if (!existingQueue) {
      try {
        await player.play(voiceChannel as any, searchResult, {
          nodeOptions: {
            metadata: interaction.channel as TextChannel,
            volume,
            selfDeaf: true,
          },
          requestedBy: interaction.user as any,
        });
        await interaction.editReply(`🎶 ${client.t('NOW_PLAYING')}`);
      } catch {
        await interaction.editReply(`❌ ${client.t('PLAY_ERROR')}`);
      }
      return;
    }

    const queue = existingQueue;
    if (searchResult.playlist) {
      for (const track of searchResult.playlist.tracks) {
        queue.tracks.add(track);
      }
      await interaction.editReply(`📋 **${searchResult.playlist.title}** — ${searchResult.playlist.tracks.length} ${client.t('TRACK_ADDED')}`);
    } else {
      const track = searchResult.tracks[0];
      if (position && position > 0 && position <= queue.tracks.size) {
        queue.insertTrack(track, position - 1);
      } else {
        queue.tracks.add(track);
      }
      await interaction.editReply(`🎶 **${track.title}** ${client.t('TRACK_ADDED')}`);
    }

    if (!queue.isPlaying()) queue.node.play();
  },
} satisfies Command;
