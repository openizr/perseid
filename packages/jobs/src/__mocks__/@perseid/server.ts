/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { Ids } from '@perseid/core';
import type { AbstractDatabaseClient } from '@perseid/server';

/** `@perseid/server` mock. */

const close = vi.fn();
const waitForReady = vi.fn();

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

export class Telemetry {
  public silent = vi.fn();

  public debug = vi.fn();

  public info = vi.fn();

  public warn = vi.fn();

  public error = vi.fn();

  public fatal = vi.fn();

  public waitForReady = waitForReady;

  public close = close;
}

export class Engine {
  protected telemetry: Telemetry;

  protected databaseClient: unknown;

  protected createMock = vi.fn();

  protected withAutomaticFields(_: unknown, __: unknown, data: Record<string, unknown>): unknown {
    this.createMock();
    return ({
      ...data,
      updated: true,
    });
  }

  constructor(
    _model: Model,
    telemetry: Telemetry,
    databaseClient: AbstractDatabaseClient<Record<string, Ids>>,
  ) {
    this.telemetry = telemetry;
    this.databaseClient = databaseClient;
  }

  public view = vi.fn();

  public async create(): Promise<void> {
    await (this.createMock as unknown as Promise<void>);
  }
}
