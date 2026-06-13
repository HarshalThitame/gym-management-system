const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

function formatLog(level: LogLevel, action: string, message: string, meta?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    action,
    message,
    ...(meta ? { meta } : {}),
  };
  return JSON.stringify(entry);
}

function writeLog(level: LogLevel, action: string, message: string, meta?: Record<string, unknown>) {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) return;
  const line = formatLog(level, action, message, meta);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const billingLogger = {
  debug: (action: string, message: string, meta?: Record<string, unknown>) => writeLog("debug", action, message, meta),
  info: (action: string, message: string, meta?: Record<string, unknown>) => writeLog("info", action, message, meta),
  warn: (action: string, message: string, meta?: Record<string, unknown>) => writeLog("warn", action, message, meta),
  error: (action: string, message: string, meta?: Record<string, unknown>) => writeLog("error", action, message, meta),
};
