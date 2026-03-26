export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogValue = string | number | boolean | null | undefined | Record<string, unknown> | unknown[];
export type LogContext = Record<string, LogValue>;
export type LogSink = (line: string) => void;

export type Logger = {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, context?: LogContext) => void;
  child: (context: LogContext) => Logger;
};

export type CreateLoggerOptions = {
  level?: LogLevel;
  defaultContext?: LogContext;
  stdout?: LogSink;
  stderr?: LogSink;
  clock?: () => Date;
};

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function shouldLog(configuredLevel: LogLevel, messageLevel: LogLevel): boolean {
  return levelOrder[messageLevel] >= levelOrder[configuredLevel];
}

function serializeValue(value: LogValue): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeValue(entry as LogValue));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, serializeValue(nestedValue as LogValue)])
    );
  }

  return value;
}

function createBoundLogger(
  level: LogLevel,
  context: LogContext,
  stdout: LogSink,
  stderr: LogSink,
  clock: () => Date
): Logger {
  const emit = (messageLevel: LogLevel, message: string, messageContext: LogContext = {}) => {
    if (!shouldLog(level, messageLevel)) {
      return;
    }

    const payload = {
      timestamp: clock().toISOString(),
      level: messageLevel,
      message,
      ...((serializeValue({ ...context, ...messageContext }) as LogContext | undefined) ?? {})
    };
    const sink = messageLevel === "warn" || messageLevel === "error" ? stderr : stdout;
    sink(JSON.stringify(payload));
  };

  return {
    debug: (message, messageContext) => emit("debug", message, messageContext),
    info: (message, messageContext) => emit("info", message, messageContext),
    warn: (message, messageContext) => emit("warn", message, messageContext),
    error: (message, messageContext) => emit("error", message, messageContext),
    child: (childContext) => createBoundLogger(level, { ...context, ...childContext }, stdout, stderr, clock)
  };
}

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  return createBoundLogger(
    options.level ?? "info",
    options.defaultContext ?? {},
    options.stdout ?? ((line) => process.stdout.write(`${line}\n`)),
    options.stderr ?? ((line) => process.stderr.write(`${line}\n`)),
    options.clock ?? (() => new Date())
  );
}
