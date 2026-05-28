import { MessageFlags, type TextChannel } from 'discord.js';
import { useMainPlayer, useQueue } from 'discord-player';
import { createSearchEmbed, createSearchComponents, type PageData } from '../utils/embeds.js';
import type { BotClient } from '../types/client.js';

export async function handleSearchNavigation(
  interaction: import('discord.js').StringSelectMenuInteraction | import('discord.js').ButtonInteraction,
  action: string,
  args: string[]
): Promise<void> {
  const client = interaction.client as BotClient;
  const isSelect = interaction.isStringSelectMenu();
  const sessionId = args[0] ?? '';

  // For select menus, the session ID is in the customId suffix
  // For buttons, it's in the args
  const resolvedSessionId = sessionId;

  if (action === 'cancel') {
    client.searchSessions.deleteSession(resolvedSessionId);
    await interaction.update({ content: '❌ Search cancelled.', embeds: [], components: [] });
    return;
  }

  const session = client.searchSessions.getSession(resolvedSessionId);
  if (!session) {
    await interaction.reply({ content: `❌ ${client.t('SEARCH_EXPIRED')}`, flags: MessageFlags.Ephemeral });
    return;
  }

  if (interaction.user.id !== session.userId) {
    await interaction.reply({ content: `❌ ${client.t('NOT_YOUR_SEARCH')}`, flags: MessageFlags.Ephemeral });
    return;
  }

  if (action === 'prev' || action === 'next') {
    const newPage = action === 'prev' ? session.currentPage - 1 : session.currentPage + 1;
    client.searchSessions.updatePage(resolvedSessionId, newPage);

    const pageData: PageData = {
      tracks: session.results,
      currentPage: newPage,
      totalPages: 1,
      totalTracks: session.results.length,
      startIndex: 0,
    };

    const embed = createSearchEmbed(client, pageData, session.query);
    const components = createSearchComponents(resolvedSessionId, pageData);
    await interaction.update({ embeds: [embed], components: components as any });
    return;
  }

  if (action === 'select') {
    let trackIndex = 0;
    if (isSelect) {
      trackIndex = parseInt(interaction.values[0]) || 0;
    } else {
      trackIndex = parseInt(args[1]) || 0;
    }

    const track = session.results[trackIndex];
    if (!track) {
      await interaction.reply({ content: `❌ ${client.t('TRACK_NOT_FOUND')}`, flags: MessageFlags.Ephemeral });
      return;
    }

    client.searchSessions.deleteSession(resolvedSessionId);

    const player = useMainPlayer();
    const existingQueue = useQueue(session.guildId);

    if (!existingQueue) {
      try {
        await player.play(
          interaction.guild!.channels.cache.get(session.voiceChannelId) as any,
          track,
          {
            nodeOptions: {
              metadata: interaction.channel as TextChannel,
              volume: session.volume,
              selfDeaf: true,
              leaveOnEmpty: true,
              leaveOnEmptyCooldown: 30_000,
              leaveOnEnd: false,
              leaveOnEndCooldown: 30_000,
            },
            requestedBy: interaction.user as any,
          }
        );
      } catch (err) {
        console.error('[searchNavigation] Error:', err);
        await interaction.update({ content: `❌ ${client.t('PLAY_ERROR')}`, embeds: [], components: [] });
        return;
      }
    } else {
      existingQueue.tracks.add(track);
      if (!existingQueue.isPlaying()) existingQueue.node.play();
    }

    await interaction.update({ content: `🎶 **${track.title}** added to queue.`, embeds: [], components: [] });
  }
}
