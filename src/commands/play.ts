import { GuildMember, MessageFlags, SlashCommandBuilder, type TextChannel } from 'discord.js';
import { useMainPlayer, useQueue } from 'discord-player';
import { checkInteractionPermission } from '../utils/permissionChecker.js';
import { getValidVolume } from '../utils/volumeValidator.js';
import { searchLatency, queueSize } from '../telemetry/index.js';
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
      await interaction.reply({ content: `❌ ${client.t('JOIN_VOICE_FIRST')}`, flags: MessageFlags.Ephemeral });
      return;
    }
    if (!(await checkInteractionPermission(interaction))) return;

    await interaction.deferReply();

    const query = interaction.options.getString('query', true);
    const volume = getValidVolume(interaction.options.getInteger('volume')?.toString(), parseInt(process.env.DEFAULT_VOLUME || '80'));
    const position = interaction.options.getInteger('position');

    const player = useMainPlayer();
    const searchStart = performance.now();
    const searchResult = await player.search(query, { requestedBy: interaction.user as any });
    searchLatency.record(performance.now() - searchStart, { source: searchResult.tracks[0]?.source ?? 'unknown' });

    if (!searchResult.tracks.length) {
      await interaction.editReply(`❌ ${client.t('TRACK_NOT_FOUND')}`);
      return;
    }

    const existingQueue = useQueue(interaction.guild!.id);

    if (!existingQueue) {
      try {
        const track = searchResult.playlist ? searchResult.playlist.tracks[0] : searchResult.tracks[0];
        await player.play(voiceChannel as any, track, {
          nodeOptions: {
            metadata: interaction.channel as TextChannel,
            volume,
            selfDeaf: true,
            leaveOnEmpty: true,
            leaveOnEmptyCooldown: 30_000,
            leaveOnEnd: false,
            leaveOnEndCooldown: 30_000,
          },
          requestedBy: interaction.user as any,
        });

        if (searchResult.playlist) {
          const queue = useQueue(interaction.guild!.id);
          if (queue) {
            for (let i = 1; i < searchResult.playlist.tracks.length; i++) {
              queue.tracks.add(searchResult.playlist.tracks[i]);
            }
          }
          await interaction.editReply(`📋 **${searchResult.playlist.title}** — ${searchResult.playlist.tracks.length} ${client.t('TRACK_ADDED')}`);
        } else {
          await interaction.editReply(`🎶 **${track.title}** ${client.t('NOW_PLAYING')}`);
        }
      } catch (err) {
        console.error('[play] Error:', err);
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
