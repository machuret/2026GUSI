/**
 * Structured logger — wraps console with context and severity.
 * In production, swap the console calls for your logging provider
 * (e.g. Axiom, Datadog, Sentry) by replacing the transport below.
 */

type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, context: string, message: string, extra?: unknown) {
  const entry = {
    level,
    context,
    message,
    ts: new Date().toISOString(),
    ...(extra !== undefined ? { extra } : {}),
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info:  (context: string, message: string, extra?: unknown) => log("info",  context, message, extra),
  warn:  (context: string, message: string, extra?: unknown) => log("warn",  context, message, extra),
  error: (context: string, message: string, extra?: unknown) => log("error", context, message, extra),
};
