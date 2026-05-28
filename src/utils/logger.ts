import pc from 'picocolors';
import { getActiveSpan } from '../telemetry/tracing.js';

const LEVELS: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const TAG_THRESHOLD: Record<string, number> = { cmd: 1, track: 1 };

const LOG_LEVEL = LEVELS[process.env.LOG_LEVEL ?? 'info'] ?? 1;

function formatTime(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function shouldLog(tag: string): boolean {
  const tagLevel = TAG_THRESHOLD[tag] ?? 1;
  return tagLevel >= LEVELS.debug || LOG_LEVEL <= (TAG_THRESHOLD[tag] ?? 1);
}

function traceContext(): string {
  const span = getActiveSpan();
  if (!span) return '';
  const ctx = span.spanContext();
  if (!ctx.traceId) return '';
  const short = ctx.traceId.slice(0, 8);
  return pc.gray(` {${short}}`);
}

export function debug(tag: string, message: string): void {
  if (LOG_LEVEL > LEVELS.debug) return;
  console.log(`${pc.gray(formatTime())} ${pc.cyan(`[${tag}]`)} ${message}${traceContext()}`);
}

export function info(tag: string, message: string): void {
  if (LOG_LEVEL > LEVELS.info) return;
  console.log(`${pc.gray(formatTime())} ${pc.green(`[${tag}]`)} ${message}${traceContext()}`);
}

export function warn(tag: string, message: string): void {
  if (LOG_LEVEL > LEVELS.warn) return;
  console.warn(`${pc.gray(formatTime())} ${pc.yellow(`[${tag}]`)} ${message}${traceContext()}`);
}

export function error(tag: string, message: string): void {
  console.error(`${pc.gray(formatTime())} ${pc.red(`[${tag}]`)} ${message}${traceContext()}`);
}

export function cmd(tag: string, message: string): void {
  if (!shouldLog(tag)) return;
  info(tag, message);
}

export function track(tag: string, message: string): void {
  if (!shouldLog(tag)) return;
  info(tag, message);
}
