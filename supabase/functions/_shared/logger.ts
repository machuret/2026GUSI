/**
 * _shared/logger.ts
 * Structured JSON logger for Supabase edge functions.
 *
 * Outputs newline-delimited JSON compatible with log aggregators
 * (Datadog, Logflare, Supabase log drain, etc.).
 *
 * Usage:
 *   import { createLogger } from "../_shared/logger.ts";
 *   const log = createLogger("grant-audit");
 *   log.info("Audit complete", { grantName, score: 87 });
 *   log.error("DB save failed", { error: String(err) });
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  ts: string;         // ISO timestamp
  level: LogLevel;
  fn: string;         // edge function name
  msg: string;        // human-readable message
  [key: string]: unknown; // arbitrary structured fields
}

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

export function createLogger(fnName: string): Logger {
  function write(level: LogLevel, msg: string, fields?: Record<string, unknown>): void {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      fn: fnName,
      msg,
      ...fields,
    };
    // console.error routes to Supabase function logs as structured output
    if (level === "error" || level === "warn") {
      console.error(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
  }

  return {
    debug: (msg, fields) => write("debug", msg, fields),
    info:  (msg, fields) => write("info",  msg, fields),
    warn:  (msg, fields) => write("warn",  msg, fields),
    error: (msg, fields) => write("error", msg, fields),
  };
}
