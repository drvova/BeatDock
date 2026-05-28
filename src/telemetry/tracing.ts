// Tracing helpers — wraps @opentelemetry/api with graceful no-ops when OTEL is disabled.

import { trace, SpanStatusCode, type Span, type Tracer } from '@opentelemetry/api';
import { OTEL_ENABLED } from './instrumentation.js';

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'vovaplayer';

/** Get the default tracer for this service. */
export function getTracer(): Tracer {
  return trace.getTracer(SERVICE_NAME);
}

/** Get the currently active span (or undefined if none). */
export function getActiveSpan(): Span | undefined {
  return trace.getActiveSpan();
}

/**
 * Run `fn` inside a new span. Records exceptions and sets error status on failure.
 * Returns the value that `fn` returns.
 */
export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean> | undefined,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  if (!OTEL_ENABLED) return fn(NOOP_SPAN);

  const tracer = getTracer();
  return tracer.startActiveSpan(name, async (span) => {
    if (attributes) span.setAttributes(attributes);
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

/** A no-op span used when OTEL is disabled. All methods are silent. */
const NOOP_SPAN: Span = {
  setAttribute() { return this; },
  setAttributes() { return this; },
  addEvent() { return this; },
  setStatus() { return this; },
  recordException() { return this; },
  updateName() { return this; },
  end() {},
  isRecording() { return false; },
  spanContext() { return { traceId: '', spanId: '', traceFlags: 0 }; },
} as unknown as Span;
