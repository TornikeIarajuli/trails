import { Injectable, LoggerService as NestLoggerService, LogLevel } from '@nestjs/common';

/**
 * Structured logger that outputs JSON lines for production
 * and readable format for development.
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  private isProd = process.env.NODE_ENV === 'production';

  log(message: string, context?: string) {
    this.write('info', message, context);
  }

  error(message: string, trace?: string, context?: string) {
    this.write('error', message, context, trace);
  }

  warn(message: string, context?: string) {
    this.write('warn', message, context);
  }

  debug(message: string, context?: string) {
    this.write('debug', message, context);
  }

  verbose(message: string, context?: string) {
    this.write('verbose', message, context);
  }

  setLogLevels(_levels: LogLevel[]) {
    // no-op, all levels enabled
  }

  private write(level: string, message: string, context?: string, trace?: string) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      context: context ?? 'App',
      message,
      ...(trace ? { trace } : {}),
    };

    if (this.isProd) {
      const stream = level === 'error' ? process.stderr : process.stdout;
      stream.write(JSON.stringify(entry) + '\n');
    } else {
      const prefix = `[${entry.context}]`;
      if (level === 'error') {
        console.error(`${prefix} ${message}`, trace ?? '');
      } else if (level === 'warn') {
        console.warn(`${prefix} ${message}`);
      } else {
        console.log(`${prefix} ${message}`);
      }
    }
  }
}
