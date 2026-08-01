export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  child: (bindings: Record<string, unknown>) => Logger;
}

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveLogLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL;
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function shouldLog(level: LogLevel): boolean {
  return levelPriority[level] >= levelPriority[resolveLogLevel()];
}

function createConsoleLogger(bindings: Record<string, unknown> = {}): Logger {
  const write = (
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
  ): void => {
    if (!shouldLog(level)) {
      return;
    }

    const payload = {
      level,
      message,
      time: new Date().toISOString(),
      ...bindings,
      ...meta,
    };

    const method =
      level === "debug"
        ? console.debug
        : level === "info"
          ? console.info
          : level === "warn"
            ? console.warn
            : console.error;

    method(payload);
  };

  return {
    debug: (message, meta) => write("debug", message, meta),
    info: (message, meta) => write("info", message, meta),
    warn: (message, meta) => write("warn", message, meta),
    error: (message, meta) => write("error", message, meta),
    child: (childBindings) =>
      createConsoleLogger({ ...bindings, ...childBindings }),
  };
}

/**
 * Logger centralizado.
 * - development: console estructurado
 * - production: mismo contrato, listo para reemplazar por Winston/Pino
 */
function createLogger(): Logger {
  if (process.env.NODE_ENV === "production") {
    // Extensión: inyectar Winston/Pino aquí sin cambiar consumidores.
    return createConsoleLogger({ service: "kapso-crm" });
  }

  return createConsoleLogger();
}

export const logger = createLogger();
