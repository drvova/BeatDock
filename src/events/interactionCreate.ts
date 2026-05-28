import {
  Events,
  MessageFlags,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { QueueRepeatMode, useMainPlayer } from 'discord-player';
import { requirePlayer, requireSameVoice } from '../utils/interactionHelpers.js';
import { playPrevious, shuffleQueue, clearQueue, createPaginatedQueueResponse } from '../utils/PlayerActions.js';
import { handleFilterNavigation } from '../interactions/filterNavigation.js';
import { handleSearchNavigation } from '../interactions/searchNavigation.js';
import { withSpan, commandCounter, interactionCounter, commandDuration, errorCounter, autocompleteCounter, searchLatency } from '../telemetry/index.js';
import type { BotClient } from '../types/client.js';

async function handlePlayerInteraction(interaction: ButtonInteraction, action: string): Promise<void> {
  const client = interaction.client as BotClient;
  const queue = await requirePlayer(interaction);
  if (!queue) return;
  if (!(await requireSameVoice(interaction, queue))) return;

  await interaction.deferUpdate();

  switch (action) {
    case 'back': {
      const track = await playPrevious(interaction);
      if (track) {
        client.playerController.updatePlayer(interaction.guild!.id);
        await interaction.followUp({ content: `⏭ ${client.t('PLAYING_PREVIOUS', track.title)}`, flags: MessageFlags.Ephemeral }).catch(() => {});
      } else {
        await interaction.followUp({ content: `❌ ${client.t('NO_PREVIOUS_TRACKS')}`, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      break;
    }
    case 'playpause': {
      if (queue.node.isPaused()) {
        queue.node.resume();
        client.playerController.updatePlayer(interaction.guild!.id);
        await interaction.followUp({ content: `▶ ${client.t('RESUMED')}`, flags: MessageFlags.Ephemeral }).catch(() => {});
      } else {
        queue.node.pause();
        client.playerController.updatePlayer(interaction.guild!.id);
        await interaction.followUp({ content: `⏸ ${client.t('PAUSED')}`, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      break;
    }
    case 'skip': {
      const autoplaySkip = client.autoplayEnabled.get(interaction.guild!.id) && queue.tracks.size === 0;
      queue.node.skip();
      await interaction.followUp({ content: autoplaySkip ? `⏭ ${client.t('AUTOPLAY_SKIP')}` : `⏭ ${client.t('SKIPPED')}`, flags: MessageFlags.Ephemeral }).catch(() => {});
      break;
    }
    case 'stop': {
      client.playerController.deletePlayer(interaction.guild!.id);
      queue.delete();
      client.autoplayEnabled.delete(interaction.guild!.id);
      client.activePlayers.delete(interaction.guild!.id);
      client.updatePresence();
      await interaction.followUp({ content: `⏹ ${client.t('STOPPED')}`, flags: MessageFlags.Ephemeral }).catch(() => {});
      break;
    }
    case 'shuffle': {
      shuffleQueue(queue);
      client.autoplayEnabled.delete(interaction.guild!.id);
      client.playerController.updatePlayer(interaction.guild!.id);
      await interaction.followUp({ content: `🔀 ${client.t('SHUFFLED')}`, flags: MessageFlags.Ephemeral }).catch(() => {});
      break;
    }
    case 'vol_down': {
      const currentVol = queue.node.volume;
      const newVol = Math.max(0, currentVol - 10);
      queue.node.setVolume(newVol);
      client.playerController.updatePlayer(interaction.guild!.id);
      await interaction.followUp({ content: `🔉 Volume: ${newVol}%`, flags: MessageFlags.Ephemeral }).catch(() => {});
      break;
    }
    case 'vol_up': {
      const currentVol = queue.node.volume;
      const newVol = Math.min(150, currentVol + 10);
      queue.node.setVolume(newVol);
      client.playerController.updatePlayer(interaction.guild!.id);
      await interaction.followUp({ content: `🔊 Volume: ${newVol}%`, flags: MessageFlags.Ephemeral }).catch(() => {});
      break;
    }
  }
}

async function handleQueueInteraction(interaction: ButtonInteraction, action: string): Promise<void> {
  const client = interaction.client as BotClient;

  switch (action) {
    case 'loop': {
      const queue = await requirePlayer(interaction);
      if (!queue) return;
      if (!(await requireSameVoice(interaction, queue))) return;

      await interaction.deferUpdate();
      const modeCycle = new Map<number, { next: number; label: string }>([
        [QueueRepeatMode.OFF, { next: QueueRepeatMode.TRACK, label: 'Track' }],
        [QueueRepeatMode.TRACK, { next: QueueRepeatMode.QUEUE, label: 'Queue' }],
        [QueueRepeatMode.QUEUE, { next: QueueRepeatMode.OFF, label: 'Off' }],
      ]);
      const current = queue.repeatMode;
      const cycle = modeCycle.get(current) ?? modeCycle.get(QueueRepeatMode.OFF)!;
      queue.setRepeatMode(cycle.next as QueueRepeatMode);
      client.playerController.updatePlayer(interaction.guild!.id);
      await interaction.followUp({ content: `🔁 ${client.t('LOOP_SET', cycle.label)}`, flags: MessageFlags.Ephemeral }).catch(() => {});
      break;
    }
    case 'list': {
      const queue = await requirePlayer(interaction);
      if (!queue) return;
      const response = createPaginatedQueueResponse(client, queue, 1);
      await interaction.reply({ ...response, flags: MessageFlags.Ephemeral });
      break;
    }
    case 'clear': {
      const queue = await requirePlayer(interaction, { requireQueue: true });
      if (!queue) return;
      if (!(await requireSameVoice(interaction, queue))) return;

      await interaction.deferUpdate();
      clearQueue(queue);
      client.autoplayEnabled.delete(interaction.guild!.id);
      client.playerController.updatePlayer(interaction.guild!.id);
      await interaction.followUp({ content: `🗑 ${client.t('QUEUE_CLEARED')}`, flags: MessageFlags.Ephemeral }).catch(() => {});
      break;
    }
    case 'prev':
    case 'next': {
      const queue = await requirePlayer(interaction);
      if (!queue) return;
      const pageData = (await import('../utils/PlayerActions.js')).paginatedQueue(queue, 1);
      const currentPage = pageData.page;
      const newPage = action === 'prev' ? currentPage - 1 : currentPage + 1;
      const response = createPaginatedQueueResponse(client, queue, newPage);
      await interaction.update(response);
      return;
    }
    case 'close': {
      await interaction.update({ content: 'Queue closed.', embeds: [], components: [] });
      return;
    }
  }
}

async function handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;
  const client = interaction.client as BotClient;

  // Player buttons: player_back, player_playpause, etc.
  if (customId.startsWith('player_')) {
    const action = customId.slice('player_'.length);
    await handlePlayerInteraction(interaction, action);
    return;
  }

  // Queue buttons: queue_loop, queue_list, queue_clear, queue_prev, queue_next, queue_close
  if (customId.startsWith('queue_')) {
    const action = customId.slice('queue_'.length);
    await handleQueueInteraction(interaction, action);
    return;
  }

  // Search buttons: search_select_{sessionId}, search_prev_{sessionId}, search_next_{sessionId}, search_cancel_{sessionId}
  if (customId.startsWith('search_')) {
    const rest = customId.slice('search_'.length);
    const underscoreIdx = rest.indexOf('_');
    if (underscoreIdx === -1) return;
    const action = rest.slice(0, underscoreIdx);
    const sessionId = rest.slice(underscoreIdx + 1);
    await handleSearchNavigation(interaction, action, [sessionId]);
    return;
  }

  // Filter buttons: filter_reset, filter_prev_{page}, filter_next_{page}, filter_{effect}
  if (customId.startsWith('filter_')) {
    const rest = customId.slice('filter_'.length);
    if (rest === 'reset') {
      await handleFilterNavigation(interaction, 'reset', []);
      return;
    }
    if (rest.startsWith('prev_')) {
      const page = rest.slice('prev_'.length);
      await handleFilterNavigation(interaction, 'prev', [page]);
      return;
    }
    if (rest.startsWith('next_')) {
      const page = rest.slice('next_'.length);
      await handleFilterNavigation(interaction, 'next', [page]);
      return;
    }
    // Individual filter effect
    await handleFilterNavigation(interaction, rest, []);
    return;
  }

  // Unknown button
  await interaction.reply({ content: `❌ ${client.t('UNKNOWN_INTERACTION')}`, flags: MessageFlags.Ephemeral }).catch(() => {});
}

async function handleSelectMenuInteraction(interaction: StringSelectMenuInteraction): Promise<void> {
  const customId = interaction.customId;

  // Search select: search_select_{sessionId}
  if (customId.startsWith('search_select_')) {
    const sessionId = customId.slice('search_select_'.length);
    await handleSearchNavigation(interaction, 'select', [sessionId, interaction.values[0]]);
    return;
  }
}

async function handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused();
  if (!focused) {
    await interaction.respond([]).catch(() => {});
    return;
  }

  try {
    const player = useMainPlayer();
    const start = performance.now();
    const result = await player.search(focused, { requestedBy: interaction.user as any });
    searchLatency.record(performance.now() - start, { source: result.tracks[0]?.source ?? 'unknown' });
    const tracks = result.tracks.slice(0, 10);

    await interaction.respond(
      tracks.map(track => ({
        name: `${track.title} — ${track.author}`.slice(0, 100),
        value: track.url,
      })),
    );
  } catch {
    await interaction.respond([]).catch(() => {});
  }
}

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction | AutocompleteInteraction) {
    const client = interaction.client as BotClient;

    try {
      if (interaction.isAutocomplete()) {
        autocompleteCounter.add(1, { command: interaction.commandName });
        await handleAutocomplete(interaction);
      } else if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        const start = performance.now();
        await withSpan(`command.${interaction.commandName}`, {
          'interaction.command': interaction.commandName,
          'interaction.guild': interaction.guildId ?? 'dm',
          'interaction.user': interaction.user.id,
        }, async () => {
          await command.execute(interaction);
        });
        const elapsed = performance.now() - start;
        commandCounter.add(1, { command: interaction.commandName, outcome: 'success' });
        commandDuration.record(elapsed, { command: interaction.commandName });
      } else if (interaction.isButton()) {
        interactionCounter.add(1, { type: 'button', customId: interaction.customId });
        await handleButtonInteraction(interaction);
      } else if (interaction.isStringSelectMenu()) {
        interactionCounter.add(1, { type: 'select', customId: interaction.customId });
        await handleSelectMenuInteraction(interaction);
      }
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      if (err.code === 10062) return; // Unknown interaction — expired

      errorCounter.add(1, { subsystem: 'interaction' });
      commandCounter.add(1, { command: 'unknown', outcome: 'error' });
      console.error(`[interactionCreate] Error: ${err.message}`);

      // Autocomplete interactions only support respond() — skip reply/followUp
      if (!interaction.isAutocomplete()) {
        const reply = { content: '❌ An error occurred.', flags: MessageFlags.Ephemeral } as const;
        if (interaction.isRepliable()) {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply).catch(() => {});
          } else {
            await interaction.reply(reply).catch(() => {});
          }
        }
      }
    }
  },
};
