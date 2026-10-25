// vitrin-core has no logging dependency. Hosts plug theirs in with setLogger:
// the CLI routes it to winston, the desktop app to its own log.
export interface CoreLogger {
  debug(message: string): void;
  info(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  error(message: string, error?: unknown): void;
}

const noop = () => {};

let current: CoreLogger = {
  debug: noop,
  info: noop,
  success: noop,
  warn: noop,
  error: noop,
};

export function setLogger(logger: CoreLogger): void {
  current = logger;
}

export const logger: CoreLogger = {
  debug: message => current.debug(message),
  info: message => current.info(message),
  success: message => current.success(message),
  warn: message => current.warn(message),
  error: (message, error) => current.error(message, error),
};
