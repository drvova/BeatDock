// Barrel export — import everything from here in instrumented files.
export { OTEL_ENABLED } from './instrumentation.js';
export { getTracer, getActiveSpan, withSpan } from './tracing.js';
export {
  commandCounter,
  interactionCounter,
  trackPlayCounter,
  trackSkipCounter,
  errorCounter,
  autoplayCounter,
  voiceDisconnectCounter,
  guildEventCounter,
  autocompleteCounter,
  commandDuration,
  searchLatency,
  queueSize,
  activePlayers,
} from './metrics.js';
