// Metric definitions — all backed by the OpenTelemetry global meter.
// When OTEL is disabled the meter returns no-op instruments (zero overhead).

import { metrics } from '@opentelemetry/api';
import { OTEL_ENABLED } from './instrumentation.js';

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'vovaplayer';
const meter = metrics.getMeter(SERVICE_NAME);

// ── Counters ─────────────────────────────────────────────────────────────────

/** Total slash commands executed, labelled by command name and outcome. */
export const commandCounter = meter.createCounter('bot.commands.total', {
  description: 'Total slash commands executed',
  unit: '{commands}',
});

/** Total button/select-menu interactions executed. */
export const interactionCounter = meter.createCounter('bot.interactions.total', {
  description: 'Total component interactions executed',
  unit: '{interactions}',
});

/** Total tracks played. */
export const trackPlayCounter = meter.createCounter('bot.tracks.played', {
  description: 'Total tracks that started playback',
  unit: '{tracks}',
});

/** Total tracks skipped. */
export const trackSkipCounter = meter.createCounter('bot.tracks.skipped', {
  description: 'Total tracks skipped',
  unit: '{tracks}',
});

/** Total errors (player, command, interaction). */
export const errorCounter = meter.createCounter('bot.errors.total', {
  description: 'Total errors across all subsystems',
  unit: '{errors}',
});

/** Total autoplay events. */
export const autoplayCounter = meter.createCounter('bot.autoplay.total', {
  description: 'Total autoplay queue refills',
  unit: '{events}',
});

/** Total voice disconnects (empty channel, manual stop). */
export const voiceDisconnectCounter = meter.createCounter('bot.voice.disconnects', {
  description: 'Total voice channel disconnections',
  unit: '{events}',
});

/** Total guild join/leave events. */
export const guildEventCounter = meter.createCounter('bot.guilds.total', {
  description: 'Guild join and leave events',
  unit: '{events}',
});

/** Total autocomplete requests. */
export const autocompleteCounter = meter.createCounter('bot.autocomplete.total', {
  description: 'Total autocomplete requests',
  unit: '{requests}',
});

// ── Histograms ───────────────────────────────────────────────────────────────

/** Command execution duration in milliseconds. */
export const commandDuration = meter.createHistogram('bot.commands.duration_ms', {
  description: 'Command execution duration',
  unit: 'ms',
});

/** Search latency in milliseconds. */
export const searchLatency = meter.createHistogram('bot.search.latency_ms', {
  description: 'Track search latency',
  unit: 'ms',
});

/** Queue size at time of measurement. */
export const queueSize = meter.createHistogram('bot.queue.size', {
  description: 'Queue size when tracks are added',
  unit: '{tracks}',
});

// ── Gauges (UpDownCounters) ──────────────────────────────────────────────────

/** Number of guilds currently playing music. */
export const activePlayers = meter.createUpDownCounter('bot.players.active', {
  description: 'Guilds currently playing music',
  unit: '{guilds}',
});

// ── Re-export enabled flag for convenience ────────────────────────────────────
export { OTEL_ENABLED };
