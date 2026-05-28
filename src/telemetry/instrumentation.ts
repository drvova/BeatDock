// MUST be imported first in the entry point — side-effect module that initializes the OpenTelemetry SDK.
// When OTEL_ENABLED is not 'true', all exports become no-ops and zero overhead.

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

export const OTEL_ENABLED = process.env.OTEL_ENABLED === 'true';

let sdk: NodeSDK | null = null;

if (OTEL_ENABLED) {
  const endpoint = process.env.OTEL_EXPORTER_ENDPOINT || 'http://localhost:4318';
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'vovaplayer',
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '3.0.0',
  });

  const traceExporter = new OTLPTraceExporter({ url: `${endpoint}/v1/traces` });
  const metricReader = new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
    exportIntervalMillis: parseInt(process.env.OTEL_EXPORT_INTERVAL_MS || '15000', 10),
  });

  sdk = new NodeSDK({ resource, traceExporter, metricReader });

  sdk.start();
  console.log('[otel] SDK started — exporting to', endpoint);

  process.on('SIGTERM', () => sdk?.shutdown().catch(() => {}));
  process.on('SIGINT', () => sdk?.shutdown().catch(() => {}));
}
