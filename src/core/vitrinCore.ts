import { setLogger } from '@zidsa/vitrin-core';
import logger from '../utils/logger.js';

// Route vitrin-core's logging to the CLI logger. Imported by every wrapper
// below, so it runs before any core code logs.
setLogger({
  debug: message => logger.debug(message),
  info: message => logger.info(message),
  success: message => logger.success(message),
  warn: message => logger.warn(message),
  error: (message, error) =>
    error instanceof Error
      ? logger.error(message, error)
      : logger.error(message),
});

export * from '@zidsa/vitrin-core';
