/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { pino } from 'pino';
import * as opentelemetry from '@opentelemetry/api';
import Telemetry, { type OpenTelemetrySpan } from 'scripts/core/services/Telemetry';

type TestTelemetry = Telemetry & {
  getContext: Telemetry['getContext'];
  pinoLogger: Telemetry['pinoLogger'];
  otelMetrics: Telemetry['otelMetrics'];
  asyncStorage: Telemetry['asyncStorage'];
};

describe('core/services/Telemetry', () => {
  vi.mock('pino');
  vi.mock('node:async_hooks');
  vi.mock('@opentelemetry/api');

  let telemetry: TestTelemetry;
  const mockedCounter = { add: vi.fn() };
  const mockedGauge = { record: vi.fn() };
  const mockedHistogram = { record: vi.fn() };
  const mockedUpDownCounter = { add: vi.fn() };
  const pinoDestination = { flushSync: vi.fn(), on: vi.fn() };
  const shutdownCallback = vi.fn(async () => Promise.resolve());
  const otelLogger = {
    emit: vi.fn(),
  };
  const otelTracer = {
    startSpan: vi.fn(),
  };
  const otelMeter = {
    createGauge: vi.fn(() => mockedGauge),
    createCounter: vi.fn(() => mockedCounter),
    createHistogram: vi.fn(() => mockedHistogram),
    createUpDownCounter: vi.fn(() => mockedUpDownCounter),
  };
  let mockSpan: {
    end: ReturnType<typeof vi.fn>;
    setStatus: ReturnType<typeof vi.fn>;
    setAttributes: ReturnType<typeof vi.fn>;
    spanContext: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSpan = {
      end: vi.fn(),
      setStatus: vi.fn(),
      setAttributes: vi.fn(),
      spanContext: vi.fn(() => ({
        traceFlags: 1,
        spanId: '1234567890123456',
        traceId: '12345678901234567890123456789012',
      })),
    };
    vi.mocked(otelTracer.startSpan).mockReturnValue(mockSpan as never);
    telemetry = new Telemetry({
      logLevel: 'debug',
      shutdownCallback,
      destination: pinoDestination as never,
      otelLogger: otelLogger as never,
      otelMeter: otelMeter as never,
      otelTracer: otelTracer as never,
    }) as TestTelemetry;
  });

  describe('[getContext]', () => {
    test('returns undefined when no span is set', () => {
      expect(telemetry.getContext()).toBeUndefined();
    });

    test('returns span context when span is set', () => {
      vi.spyOn(telemetry.asyncStorage, 'getStore').mockReturnValue({ span: {} as never });
      telemetry.span('test span', {}, () => 'result');
      expect(telemetry.getContext()).toBeDefined();
    });
  });

  describe('[constructor]', () => {
    test('initializes with pretty print enabled', () => {
      telemetry = new Telemetry({ prettyPrint: true }) as TestTelemetry;
      expect(pino).toHaveBeenCalledTimes(2);
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
    });
  });

  describe('[waitForReady]', () => {
    test('resolves immediately when no destination is provided', async () => {
      telemetry = new Telemetry() as TestTelemetry;
      await telemetry.waitForReady();
      expect(telemetry).toBeDefined();
    });

    test('waits for destination ready event when destination is provided', async () => {
      const onCallback = vi.fn((_: string, callback: () => void) => { callback(); });
      const destination = { flushSync: vi.fn(), on: onCallback };
      telemetry = new Telemetry({ destination: destination as never }) as TestTelemetry;
      await telemetry.waitForReady();
      expect(onCallback).toHaveBeenCalledWith('ready', expect.any(Function));
    });
  });

  describe('[span]', () => {
    test('executes callback without OTEL tracer', () => {
      telemetry = new Telemetry() as TestTelemetry;
      const callback = vi.fn((span: OpenTelemetrySpan) => {
        span.setAttributes({ key: 'value' });
        span.setStatus({ code: 'OK' });
        span.getContext();
        return 'result';
      });
      const options = {
        attributes: { key: 'value' },
        traceParent: { spanId: '1234567890123456', traceId: '12345678901234567890123456789012', traceFlags: 1 },
      };
      telemetry.span('test span', {}, callback);
      const result = telemetry.span('test span', options, callback);
      expect(result).toBe('result');
      expect(telemetry.pinoLogger.debug).toHaveBeenCalledWith('test span');
      expect(telemetry.pinoLogger.debug).toHaveBeenCalledWith(options);
    });

    test('executes callback with OTEL tracer', () => {
      const callback = vi.fn((span: OpenTelemetrySpan) => {
        span.setAttributes({ key: 'value' });
        span.setStatus({ code: 'OK' });
        span.getContext();
        return 'result';
      });
      const options = {
        attributes: { key: 'value' },
        traceParent: {
          traceFlags: 1,
          traceState: undefined,
          spanId: '1234567890123456',
          traceId: '12345678901234567890123456789012',
        },
      };
      telemetry.span('test span', options, callback);
      expect(opentelemetry.trace.setSpanContext).toHaveBeenCalledOnce();
      expect(opentelemetry.trace.setSpanContext).toHaveBeenCalledWith({}, options.traceParent);
      expect(otelTracer.startSpan).toHaveBeenCalledOnce();
      expect(otelTracer.startSpan).toHaveBeenCalledWith('test span', {
        kind: 0,
        attributes: { key: 'value' },
        traceParent: options.traceParent,
      }, {});
    });

    test('handles sync errors in callback', () => {
      const error = new Error('test error');
      const callback = vi.fn(() => { throw error; });
      try {
        telemetry.span('test span', {}, callback);
      } catch (e: unknown) {
        expect(e).toBe(error);
      } finally {
        expect(mockSpan.end).toHaveBeenCalledOnce();
      }
    });

    test('handles async errors in callback', async () => {
      const error = new Error('test error');
      const callback = vi.fn(() => Promise.reject(error));
      try {
        await telemetry.span('test span', {}, callback);
      } catch (e: unknown) {
        expect(e).toBe(error);
      } finally {
        expect(mockSpan.end).toHaveBeenCalledOnce();
      }
    });
  });

  describe('[debug]', () => {
    test('logs debug message without OTEL logger', () => {
      telemetry = new Telemetry() as TestTelemetry;
      telemetry.debug('test message');
      expect(telemetry.pinoLogger.debug).toHaveBeenCalledWith('test message');
      expect(telemetry.pinoLogger.debug).toHaveBeenCalledWith({});
    });

    test('logs debug message with OTEL logger', () => {
      telemetry.debug('test message', { key: 'value' });
      expect(otelLogger.emit).toHaveBeenCalledWith({
        context: undefined,
        body: 'test message',
        severityNumber: 5,
        severityText: 'debug',
        attributes: { key: 'value' },
      });
    });
  });

  describe('[info]', () => {
    test('logs info message without OTEL logger', () => {
      telemetry = new Telemetry() as TestTelemetry;
      telemetry.info('test message');
      expect(telemetry.pinoLogger.info).toHaveBeenCalledWith('test message');
      expect(telemetry.pinoLogger.info).toHaveBeenCalledWith({});
    });

    test('logs info message with OTEL logger', () => {
      telemetry.info('test message', { key: 'value' });
      expect(otelLogger.emit).toHaveBeenCalledWith({
        context: undefined,
        body: 'test message',
        severityNumber: 9,
        severityText: 'info',
        attributes: { key: 'value' },
      });
    });
  });

  describe('[warn]', () => {
    test('logs warn message without OTEL logger', () => {
      telemetry = new Telemetry() as TestTelemetry;
      telemetry.warn('test message');
      expect(telemetry.pinoLogger.warn).toHaveBeenCalledWith('test message');
      expect(telemetry.pinoLogger.warn).toHaveBeenCalledWith({});
    });

    test('logs warn message with OTEL logger', () => {
      telemetry.warn('test message', { key: 'value' });
      expect(otelLogger.emit).toHaveBeenCalledWith({
        context: undefined,
        body: 'test message',
        severityNumber: 13,
        severityText: 'warn',
        attributes: { key: 'value' },
      });
    });
  });

  describe('[error]', () => {
    test('logs error message without OTEL logger', () => {
      telemetry = new Telemetry() as TestTelemetry;
      telemetry.error('test message');
      expect(telemetry.pinoLogger.error).toHaveBeenCalledWith('test message');
      expect(telemetry.pinoLogger.error).toHaveBeenCalledWith({});
    });

    test('logs error message with OTEL logger', () => {
      const context = {
        getValue: vi.fn(),
        setValue: vi.fn(),
        deleteValue: vi.fn(),
      };
      const span = opentelemetry.trace.getSpan(context);
      vi.spyOn(telemetry, 'getContext').mockReturnValue(context);
      telemetry.error('test message', { key: 'value' });
      expect(span?.setStatus).toHaveBeenCalledWith({
        code: opentelemetry.SpanStatusCode.ERROR,
      });
      expect(otelLogger.emit).toHaveBeenCalledWith({
        context,
        body: 'test message',
        severityNumber: 17,
        severityText: 'error',
        attributes: { key: 'value' },
      });
    });

    test('logs error error with OTEL logger', () => {
      const error = new Error('test error');
      const context = {
        getValue: vi.fn(),
        setValue: vi.fn(),
        deleteValue: vi.fn(),
      };
      vi.spyOn(telemetry, 'getContext').mockReturnValue(context);
      telemetry.error(error, { key: 'value' });
      expect(otelLogger.emit).toHaveBeenCalledWith({
        context,
        severityNumber: 17,
        body: error.message,
        severityText: 'error',
        attributes: {
          key: 'value',
          type: 'Error',
          message: 'test error',
          stackTrace: error.stack,
        },
      });
    });
  });

  describe('[fatal]', () => {
    test('logs fatal message without OTEL logger', () => {
      telemetry = new Telemetry() as TestTelemetry;
      telemetry.fatal('test message');
      expect(telemetry.pinoLogger.fatal).toHaveBeenCalledWith('test message');
      expect(telemetry.pinoLogger.fatal).toHaveBeenCalledWith({});
    });

    test('logs fatal message with OTEL logger', () => {
      const context = {
        getValue: vi.fn(),
        setValue: vi.fn(),
        deleteValue: vi.fn(),
      };
      const span = opentelemetry.trace.getSpan(context);
      vi.spyOn(telemetry, 'getContext').mockReturnValue(context);
      telemetry.fatal('test message', { key: 'value' });
      expect(span?.setStatus).toHaveBeenCalledWith({
        code: opentelemetry.SpanStatusCode.ERROR,
      });
      expect(otelLogger.emit).toHaveBeenCalledWith({
        context,
        body: 'test message',
        severityNumber: 21,
        severityText: 'fatal',
        attributes: { key: 'value' },
      });
    });

    test('logs fatal error with OTEL logger', () => {
      const error = new Error('test error');
      const context = {
        getValue: vi.fn(),
        setValue: vi.fn(),
        deleteValue: vi.fn(),
      };
      vi.spyOn(telemetry, 'getContext').mockReturnValue(context);
      telemetry.fatal(error, { key: 'value' });
      expect(otelLogger.emit).toHaveBeenCalledWith({
        context,
        severityNumber: 21,
        body: error.message,
        severityText: 'fatal',
        attributes: {
          key: 'value',
          type: 'Error',
          message: 'test error',
          stackTrace: error.stack,
        },
      });
    });
  });

  describe('[createGauge]', () => {
    test('logs metric creation without OTEL meter', () => {
      telemetry = new Telemetry() as TestTelemetry;
      telemetry.createGauge('test.gauge', { description: 'test gauge' });
      expect(telemetry.pinoLogger.debug).toHaveBeenCalledWith('test.gauge');
      expect(telemetry.pinoLogger.debug).toHaveBeenCalledWith({ description: 'test gauge' });
    });

    test('creates up-down gauge with OTEL meter', () => {
      vi.spyOn(telemetry.otelMetrics, 'set');
      telemetry.createGauge('test.gauge', { description: 'test gauge' });
      expect(telemetry.otelMetrics.set).toHaveBeenCalledWith('test.gauge', {
        type: 'GAUGE',
        metric: mockedGauge,
      });
      expect(otelMeter.createGauge).toHaveBeenCalledWith('test.gauge', {
        description: 'test gauge',
      });
    });
  });

  describe('[createHistogram]', () => {
    test('logs metric creation without OTEL meter', () => {
      telemetry = new Telemetry() as TestTelemetry;
      telemetry.createHistogram('test.histogram', { description: 'test histogram' });
      expect(telemetry.pinoLogger.debug).toHaveBeenCalledWith('test.histogram');
      expect(telemetry.pinoLogger.debug).toHaveBeenCalledWith({ description: 'test histogram' });
    });

    test('creates up-down histogram with OTEL meter', () => {
      vi.spyOn(telemetry.otelMetrics, 'set');
      telemetry.createHistogram('test.histogram', { description: 'test histogram' });
      expect(telemetry.otelMetrics.set).toHaveBeenCalledWith('test.histogram', {
        type: 'HISTOGRAM',
        metric: mockedHistogram,
      });
      expect(otelMeter.createHistogram).toHaveBeenCalledWith('test.histogram', {
        description: 'test histogram',
      });
    });
  });

  describe('[createCounter]', () => {
    test('logs metric creation without OTEL meter', () => {
      telemetry = new Telemetry() as TestTelemetry;
      telemetry.createCounter('test.counter', { description: 'test counter' });
      expect(telemetry.pinoLogger.debug).toHaveBeenCalledWith('test.counter');
      expect(telemetry.pinoLogger.debug).toHaveBeenCalledWith({ description: 'test counter' });
    });

    test('creates up-down counter with OTEL meter', () => {
      vi.spyOn(telemetry.otelMetrics, 'set');
      telemetry.createCounter('test.counter', { description: 'test counter' });
      expect(telemetry.otelMetrics.set).toHaveBeenCalledWith('test.counter', {
        type: 'COUNTER',
        metric: mockedCounter,
      });
      expect(otelMeter.createCounter).toHaveBeenCalledWith('test.counter', {
        description: 'test counter',
      });
    });
  });

  describe('[createUpDownCounter]', () => {
    test('logs metric creation without OTEL meter', () => {
      telemetry = new Telemetry() as TestTelemetry;
      telemetry.createUpDownCounter('test.updowncounter', { description: 'test updowncounter' });
      expect(telemetry.pinoLogger.debug).toHaveBeenCalledWith('test.updowncounter');
      expect(telemetry.pinoLogger.debug).toHaveBeenCalledWith({ description: 'test updowncounter' });
    });

    test('creates up-down counter with OTEL meter', () => {
      vi.spyOn(telemetry.otelMetrics, 'set');
      telemetry.createUpDownCounter('test.updowncounter', { description: 'test updowncounter' });
      expect(telemetry.otelMetrics.set).toHaveBeenCalledWith('test.updowncounter', {
        type: 'UP_DOWN_COUNTER',
        metric: mockedUpDownCounter,
      });
      expect(otelMeter.createUpDownCounter).toHaveBeenCalledWith('test.updowncounter', {
        description: 'test updowncounter',
      });
    });
  });

  describe('[measure]', () => {
    test('logs measurement without OTEL meter', () => {
      telemetry = new Telemetry() as TestTelemetry;
      telemetry.measure('test.metric', 42, { key: 'value' });
      expect(telemetry.pinoLogger.debug).toHaveBeenCalledWith(42);
      expect(telemetry.pinoLogger.debug).toHaveBeenCalledWith('test.metric');
      expect(telemetry.pinoLogger.debug).toHaveBeenCalledWith({ key: 'value' });
    });

    test('logs error when metric not found', () => {
      vi.spyOn(telemetry, 'error');
      telemetry.measure('unknown.metric', 42);
      expect(telemetry.error).toHaveBeenCalledOnce();
      expect(telemetry.error).toHaveBeenCalledWith('Metric not found.', { name: 'unknown.metric' });
    });

    test('records histogram measurement', () => {
      telemetry.otelMetrics.set('test.histogram', { type: 'HISTOGRAM', metric: mockedHistogram });
      telemetry.measure('test.histogram', 42, { key: 'value' });
      expect(mockedHistogram.record).toHaveBeenCalledWith(42, { key: 'value' }, undefined);
    });

    test('records counter measurement', () => {
      telemetry.otelMetrics.set('test.counter', { type: 'COUNTER', metric: mockedCounter });
      telemetry.measure('test.counter', 42, { key: 'value' });
      expect(mockedCounter.add).toHaveBeenCalledWith(42, { key: 'value' }, undefined);
    });

    test('records up-down counter measurement', () => {
      telemetry.otelMetrics.set('test.updowncounter', { type: 'UP_DOWN_COUNTER', metric: mockedUpDownCounter });
      telemetry.measure('test.updowncounter', 42, { key: 'value' });
      expect(mockedUpDownCounter.add).toHaveBeenCalledWith(42, { key: 'value' }, undefined);
    });

    test('records gauge measurement', () => {
      telemetry.otelMetrics.set('test.gauge', { type: 'GAUGE', metric: mockedGauge });
      telemetry.measure('test.gauge', 42, { key: 'value' });
      expect(mockedGauge.record).toHaveBeenCalledWith(42, { key: 'value' }, undefined);
    });
  });

  describe('[close]', () => {
    test('flushes logs and calls shutdown callback when provided', async () => {
      await telemetry.close();
      expect(shutdownCallback).toHaveBeenCalledOnce();
      expect(pinoDestination.flushSync).toHaveBeenCalledOnce();
      expect(telemetry.pinoLogger.flush).toHaveBeenCalledOnce();
    });

    test('flushes logs and calls default shutdown callback', async () => {
      telemetry = new Telemetry() as TestTelemetry;
      await telemetry.close();
      expect(pinoDestination.flushSync).not.toHaveBeenCalled();
      expect(telemetry.pinoLogger.flush).toHaveBeenCalledOnce();
    });
  });
});
