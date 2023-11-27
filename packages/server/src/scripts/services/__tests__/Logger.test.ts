/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Logger from 'scripts/services/Logger';
import { pino, type Logger as PinoLogger } from 'pino';

type TestLogger = Logger & { logger: PinoLogger; };

describe('services/Logger', () => {
  vi.mock('pino');
  vi.spyOn(process, 'on').mockImplementation(() => process);

  let logger: TestLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new Logger({ logLevel: 'info', prettyPrint: true }) as TestLogger;
  });

  test('[constructor] with no destination', () => {
    expect(pino).toHaveBeenCalledWith({
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'hostname,pid',
          suppressFlushSyncWarning: true,
          translateTime: 'yyyy-mm-dd HH:MM:ss',
        },
      },
    });
    expect(process.on).toHaveBeenCalledTimes(3);
    expect(process.on).toHaveBeenCalledWith('warning', expect.any(Function));
    expect(process.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
    expect(process.on).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
  });

  test('[constructor] with destination', async () => {
    vi.clearAllMocks();
    const destination = pino.destination({});
    logger = new Logger({ logLevel: 'info', prettyPrint: false, destination }) as TestLogger;
    expect(pino).toHaveBeenCalledWith({ level: 'info', transport: undefined }, destination);
    await logger.waitForReady();
    await logger.close();
    expect(destination.flushSync).toHaveBeenCalledTimes(1);
  });

  test('[child]', () => {
    expect(logger.child()).toBe(logger.logger);
  });

  test('[silent]', () => {
    logger.silent('test', '');
  });

  test('[trace]', () => {
    logger.trace('test');
    expect(logger.logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.logger.debug).toHaveBeenCalledWith('test');
  });

  test('[debug]', () => {
    logger.debug('test');
    expect(logger.logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.logger.debug).toHaveBeenCalledWith('test');
  });

  test('[info]', () => {
    logger.info('test');
    expect(logger.logger.info).toHaveBeenCalledTimes(1);
    expect(logger.logger.info).toHaveBeenCalledWith('test');
  });

  test('[warn]', () => {
    logger.warn('test');
    expect(logger.logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.logger.warn).toHaveBeenCalledWith('test');
  });

  test('[error]', () => {
    logger.error('test');
    expect(logger.logger.error).toHaveBeenCalledTimes(1);
    expect(logger.logger.error).toHaveBeenCalledWith('test');
  });

  test('[fatal]', () => {
    logger.fatal('test');
    expect(logger.logger.fatal).toHaveBeenCalledTimes(1);
    expect(logger.logger.fatal).toHaveBeenCalledWith('test');
  });

  test('[waitForReady]', async () => {
    await logger.waitForReady();
    expect(pino.destination().on).not.toHaveBeenCalled();
  });

  test('[close]', async () => {
    await logger.close();
    expect(pino.destination().flushSync).not.toHaveBeenCalled();
  });
});
