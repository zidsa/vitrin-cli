import winston from 'winston';
import chalk from 'chalk';
import type { LogLevel, LoggerOptions } from '../types/index.js';

class Logger {
  private logger: winston.Logger;
  private useColors: boolean;

  constructor(options: LoggerOptions = { level: 'info' }) {
    this.useColors = process.stdout.isTTY;

    const formats = [
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
    ];

    if (options.format === 'json') {
      formats.push(winston.format.json());
    } else {
      formats.push(
        winston.format.printf(({ timestamp, level, message, stack }) => {
          const colorizedLevel = this.colorizeLevel(level);
          const time = new Date(timestamp as string).toLocaleTimeString();
          return `[${time}] ${colorizedLevel}: ${message}${stack ? `\n${stack}` : ''}`;
        })
      );
    }

    const transports: winston.transport[] = [
      new winston.transports.Console({
        level: options.level,
        silent: process.env.NODE_ENV === 'test',
      }),
    ];

    if (options.file) {
      transports.push(
        new winston.transports.File({
          filename: options.file,
          level: options.level,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        })
      );
    }

    this.logger = winston.createLogger({
      level: options.level,
      format: winston.format.combine(...formats),
      transports,
    });
  }

  private colorizeLevel(level: string): string {
    if (!this.useColors) return level.toUpperCase();

    switch (level) {
      case 'error':
        return chalk.red('ERROR');
      case 'warn':
        return chalk.yellow('WARN');
      case 'info':
        return chalk.blue('INFO');
      case 'debug':
        return chalk.gray('DEBUG');
      default:
        return level.toUpperCase();
    }
  }

  error(message: string, error?: Error): void {
    this.logger.error(message, error);
  }

  warn(message: string): void {
    this.logger.warn(message);
  }

  info(message: string): void {
    this.logger.info(message);
  }

  debug(message: string): void {
    this.logger.debug(message);
  }

  success(message: string): void {
    if (this.useColors) {
      console.log(chalk.green(`✓ ${message}`));
    } else {
      this.info(`✓ ${message}`);
    }
  }

  loading(message: string): void {
    if (this.useColors) {
      console.log(chalk.cyan(`⏳ ${message}`));
    } else {
      this.info(`⏳ ${message}`);
    }
  }

  log(message?: string, color?: string): void {
    if (!message) {
      console.log();
      return;
    }

    if (this.useColors && color) {
      const colorFn = (chalk as any)[color] || chalk.white;
      console.log(colorFn(message));
    } else {
      this.info(message);
    }
  }

  setLevel(level: LogLevel): void {
    this.logger.level = level;
  }

  disableColors(): void {
    this.useColors = false;
  }
}

const logger = new Logger({
  level: (process.env.LOG_LEVEL || 'info') as LogLevel,
});

export default logger;
export { Logger };
