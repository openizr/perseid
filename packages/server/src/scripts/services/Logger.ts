/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Logger as BaseLogger } from '@perseid/core';
import { pino, type DestinationStream, type Logger as PinoLogger } from 'pino';

type PinoDestination = DestinationStream & {
  flushSync: () => void;
  on: (event: string, callback: () => void) => void;
};

/**
 * Logger settings
 */
export interface LoggerSettings {
  /** Minimum logging level (all logs below that level won't be logs). */
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'fatal';

  /** Whether to pretty-print logs. */
  prettyPrint: boolean;

  /** Custom pino destination for logs (e.g. specific file, distant stream, ...). */
  destination?: PinoDestination;
}

/**
 * pino-based logging system.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/services/Logger.ts
 */
export default class Logger extends BaseLogger {
  /** pino logger instance. */
  protected logger: PinoLogger;

  /** Custom pino destination for logs (e.g. specific file, distant stream, ...). */
  protected destination?: PinoDestination;

  /** Minimum logging level (all logs below that level won't be logs). */
  public readonly level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';

  /**
   * Class constructor.
   *
   * @param settings Logger settings.
   */
  public constructor(settings: LoggerSettings) {
    super();
    const pinoSettings = {
      level: settings.logLevel,
      transport: (settings.prettyPrint && settings.destination === undefined)
        ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'hostname,pid',
            suppressFlushSyncWarning: true,
            translateTime: 'yyyy-mm-dd HH:MM:ss',
          },
        }
        : undefined,
    };
    this.level = settings.logLevel;
    this.destination = settings.destination;
    this.logger = (this.destination !== undefined)
      ? pino(pinoSettings, this.destination)
      : pino(pinoSettings);

    process.on('warning', this.warn.bind(this));
    process.on('uncaughtException', this.fatal.bind(this));
    process.on('unhandledRejection', this.fatal.bind(this));
  }

  /**
   * Only for pino compatibility.
   */
  public child(): PinoLogger {
    return this.logger;
  }

  /**
   * Only for pino compatibility.
   */
  public silent(message: unknown, ...args: unknown[]): void {
    // No-op.
    if (message && args.length) {
      this.child();
    }
  }

  /**
   * @deprecated Use `debug` instead.
   */
  public trace(message: unknown, ...args: unknown[]): void {
    this.debug(message as string, ...args);
  }

  /**
   * Information that is diagnostically helpful to people more than just developers
   * (IT, sysadmins, etc.).
   * This should be the minimum logging level in development.
   */
  public debug(message: unknown, ...args: unknown[]): void {
    this.logger.debug(message as string, ...args);
  }

  /**
   * Generally useful information to log (service start/stop, configuration assumptions, etc).
   * Info we want to always have available but usually don't care about under normal circumstances.
   * This should be the minimum logging level in (pre)production.
   */
  public info(message: unknown, ...args: unknown[]): void {
    this.logger.info(message as string, ...args);
  }

  /**
   * Anything that can potentially cause application oddities, but which is not a serious concern
   * (Such as switching from a primary to backup server, retrying an operation, missing secondary
   * data, etc.). Not much to worry about, but it is still important to analyze warnings on a
   * regular basis to identify potential issues.
   */
  public warn(message: unknown, ...args: unknown[]): void {
    this.logger.warn(message as string, ...args);
  }

  /**
   * Any error which is fatal to the operation, but not the service or application (can't open a
   * required file, missing data, etc.). These errors will force user (administrator, or direct
   * user) intervention. These are usually reserved for incorrect connection strings, missing
   * services, uncaught exceptions, etc. Constitutes a degradation of service, which means
   * engineering team must be immediately notified.
   */
  public error(message: unknown, ...args: unknown[]): void {
    this.logger.error(message as string, ...args);
  }

  /**
   * Any error that is forcing a shutdown of the service or application to prevent data loss
   * (or further data loss). Reserved only for the most heinous errors and situations where there is
   * guaranteed to have been data corruption or loss. Constitutes an interruption of service, which
   * means engineering and SysAdmin / DevOps teams must be immediatly notified.
   */
  public fatal(message: unknown, ...args: unknown[]): void {
    this.logger.fatal(message as string, ...args);
  }

  /**
   * Resolves as soon as the logging system is ready to accept logs.
   */
  public async waitForReady(): Promise<void> {
    return new Promise((resolve) => {
      if (this.destination !== undefined) {
        this.destination.on('ready', resolve);
      } else {
        resolve();
      }
    });
  }

  /**
   * Gracefully closes pino logger, flushing remaining buffered logs.
   */
  public async close(): Promise<void> {
    await Promise.resolve();
    this.destination?.flushSync();
  }
}
