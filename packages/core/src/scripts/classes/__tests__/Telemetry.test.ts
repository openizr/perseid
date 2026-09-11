/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type * as opentelemetry from '@opentelemetry/api';
import Telemetry, { type OpenTelemetrySpan } from 'scripts/classes/Telemetry';

class TestTelemetry extends Telemetry {
  protected mock = vi.fn();

  public now(): opentelemetry.HrTime {
    this.mock();
    return [0, 0];
  }

  public duration(start: opentelemetry.HrTime): number {
    this.mock(start);
    return 0;
  }

  public waitForReady(): Promise<void> {
    this.mock();
    return Promise.resolve();
  }

  public debug(message: string, attributes?: Record<string, unknown>): void {
    this.mock(message, attributes);
  }

  public info(message: string, attributes?: Record<string, unknown>): void {
    this.mock(message, attributes);
  }

  public warn(message: string, attributes?: Record<string, unknown>): void {
    this.mock(message, attributes);
  }

  public error(message: string | Error, attributes?: Record<string, unknown>): void {
    this.mock(message, attributes);
  }

  public fatal(message: string | Error, attributes?: Record<string, unknown>): void {
    this.mock(message, attributes);
  }

  public createGauge(name: string): void {
    this.mock(name);
  }

  public createHistogram(name: string): void {
    this.mock(name);
  }

  public createCounter(name: string): void {
    this.mock(name);
  }

  public span<ReturnType = unknown>(
    name: string,
    options: Pick<opentelemetry.SpanOptions, 'attributes' | 'links'> & {
      traceState?: string;
      traceParent?: Pick<opentelemetry.SpanContext, 'traceId' | 'spanId' | 'traceFlags'>;
      kind?: 'CONSUMER' | 'PRODUCER' | 'SERVER' | 'CLIENT';
    },
    callback: (span: OpenTelemetrySpan) => ReturnType,
  ): ReturnType {
    return this.mock(name, options, callback) as ReturnType;
  }

  public createUpDownCounter(name: string): void {
    this.mock(name);
  }

  public measure(name: string, value: number, attributes?: Record<string, unknown>): void {
    this.mock(name, value, attributes);
  }

  public async close(): Promise<void> {
    await Promise.resolve();
    this.mock();
  }
}

describe('classes/Telemetry', () => {
  let telemetry: TestTelemetry;

  beforeEach(() => {
    telemetry = new TestTelemetry();
  });

  test('[constructor]', () => {
    expect(telemetry.info.bind(telemetry)).toBeDefined();
    expect(telemetry.warn.bind(telemetry)).toBeDefined();
    expect(telemetry.debug.bind(telemetry)).toBeDefined();
    expect(telemetry.error.bind(telemetry)).toBeDefined();
    expect(telemetry.fatal.bind(telemetry)).toBeDefined();
    expect(telemetry.close.bind(telemetry)).toBeDefined();
    expect(telemetry.span.bind(telemetry)).toBeDefined();
    expect(telemetry.close.bind(telemetry)).toBeDefined();
    expect(telemetry.measure.bind(telemetry)).toBeDefined();
    expect(telemetry.createGauge.bind(telemetry)).toBeDefined();
    expect(telemetry.createCounter.bind(telemetry)).toBeDefined();
    expect(telemetry.createHistogram.bind(telemetry)).toBeDefined();
    expect(telemetry.createUpDownCounter.bind(telemetry)).toBeDefined();
  });
});
