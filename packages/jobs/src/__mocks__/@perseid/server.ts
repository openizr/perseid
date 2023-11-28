/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/** `@perseid/server` mock. */

const close = vi.fn();
const waitForReady = vi.fn();
const aggregate = vi.fn(() => ({ toArray: vi.fn(() => [{}, {}, {}]) }));

const database = {
  collection: vi.fn(() => ({ aggregate })),
};

export class Model { protected mock = vi.fn(); }

export class CacheClient { protected mock = vi.fn(); }

export class Profiler {
  public reset = vi.fn();

  public getMetrics = vi.fn();

  public static formatMetrics = vi.fn(() => 'FORMATTED METRICS');
}

export class BucketClient {
  public upload = vi.fn();
}

export class Logger {
  public debug = vi.fn();

  public info = vi.fn();

  public warn = vi.fn();

  public error = vi.fn();

  public fatal = vi.fn();

  public waitForReady = waitForReady;

  public close = close;
}

export class DatabaseClient {
  protected logger: Logger;

  protected database: unknown;

  protected handleError = vi.fn((callback: () => null) => callback());

  public dropDatabase = vi.fn();

  public createDatabase = vi.fn();

  public resetCollection = vi.fn();

  protected formatOutput = vi.fn(() => ({
    formatted: true,
  }));

  constructor(_model: Model, logger: Logger) {
    this.logger = logger;
    this.database = database;
  }
}

export class Engine {
  protected logger: Logger;

  protected databaseClient: unknown;

  protected createMock = vi.fn();

  protected withAutomaticFields = vi.fn((_, data) => ({
    ...data,
    _updatedAt: new Date('2022-01-01T00:00:00.000Z'),
  }) as unknown);

  constructor(_model: Model, logger: Logger, databaseClient: DatabaseClient) {
    this.logger = logger;
    this.databaseClient = databaseClient;
  }

  public view = vi.fn();

  public async create(): Promise<void> {
    await (this.createMock as unknown as Promise<void>);
  }
}
