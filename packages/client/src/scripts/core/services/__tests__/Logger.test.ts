/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import Logger from 'scripts/core/services/Logger';

type TestLogger = Logger & { logger: Console; };

describe('core/services/Logger', () => {
  let logger: TestLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new Logger({ logLevel: 'debug' }) as TestLogger;
  });

  test('[constructor]', () => {
    vi.spyOn(window, 'addEventListener');
    logger = new Logger({ logLevel: 'info' }) as TestLogger;
    expect(window.addEventListener).toHaveBeenCalledTimes(2);
    expect(window.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(window.addEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
  });

  test('[trace]', () => {
    vi.spyOn(console, 'trace').mockImplementation(() => null);
    logger.trace('test');
    expect(logger.logger.trace).toHaveBeenCalledTimes(1);
    expect(logger.logger.trace).toHaveBeenCalledWith('test');
  });

  test('[debug]', () => {
    vi.spyOn(console, 'debug').mockImplementation(() => null);
    logger.debug('test');
    expect(logger.logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.logger.debug).toHaveBeenCalledWith('test');
  });

  test('[info]', () => {
    vi.spyOn(console, 'info').mockImplementation(() => null);
    logger.info('test');
    expect(logger.logger.info).toHaveBeenCalledTimes(1);
    expect(logger.logger.info).toHaveBeenCalledWith('test');
  });

  test('[warn]', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => null);
    logger.warn('test');
    expect(logger.logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.logger.warn).toHaveBeenCalledWith('test');
  });

  test('[error]', () => {
    vi.spyOn(console, 'error').mockImplementation(() => null);
    logger.error('test');
    expect(logger.logger.error).toHaveBeenCalledTimes(1);
    expect(logger.logger.error).toHaveBeenCalledWith('test');
  });

  test('[fatal]', () => {
    vi.spyOn(console, 'error').mockImplementation(() => null);
    logger.fatal('test');
    expect(logger.logger.error).toHaveBeenCalledTimes(1);
    expect(logger.logger.error).toHaveBeenCalledWith('test');
  });

  test('[close]', async () => {
    Object.assign(console, { profileEnd: vi.fn() });
    await logger.close();
  });
});
