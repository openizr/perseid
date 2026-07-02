/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { PerseidError } from '@perseid/core';
import * as opentelemetry from '@opentelemetry/api';
import { AsyncLocalStorage } from 'node:async_hooks';
import { pino, type DestinationStream, type Logger as PinoLogger } from 'pino';
import { hrTime, hrTimeDuration, hrTimeToMilliseconds } from '@opentelemetry/core';
import type { AnyValue, AnyValueMap, Logger as OTELLogger } from '@opentelemetry/api-logs';

type PinoDestination = DestinationStream & {
  flushSync: () => void;
  on: (event: string, callback: () => void) => void;
};

/**
 * Simplified OpenTelemetry span.
 */
export interface OpenTelemetrySpan {
  /**
   * Sets span `attributes`.
   *
   * @param attributes Attributes to set to the span.
   */
  setAttributes(attributes: AnyValue): void;

  /**
   * Sets span status to `status`.
   *
   * @param status Status to set to the span.
   */
  setStatus(status: { code: 'OK' | 'UNSET' | 'ERROR' }): void;

  /**
   * Returns span context.
   *
   * @returns Span context.
   */
  getContext(): opentelemetry.SpanContext;
}

/**
 * Telemetry settings.
 */
export interface TelemetrySettings {
  /**
   * OTEL meter instance to use. Defaults to `null`.
   */
  otelMeter?: opentelemetry.Meter | null;

  /**
   * OTEL tracer provider instance to use. Defaults to `null`.
   */
  otelTracer?: opentelemetry.Tracer | null;

  /**
   * OTEL logger provider instance to use. Defaults to `null`.
   */
  otelLogger?: OTELLogger | null;

  /**
   * Callback that gracefully shuts down OTEL instances.
   */
  shutdownCallback?: () => Promise<void>;

  /**
   * Whether to pretty-print logs. Defaults to `false`.
   */
  prettyPrint?: boolean;

  /**
   * Custom pino destination for logs (e.g. specific file, distant stream, ...).
   */
  destination?: PinoDestination;

  /**
   * Minimum logging level (all messages below that level won't be logged). Defaults to `info`.
   */
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
}

/**
 * Observability service, providing logging, tracing and metrics-related features.
 * Fully supports OpenTelemetry API: https://opentelemetry.io.
 */
export default class Telemetry {
  /**
   * Number representation of log levels, used to determine whether to log.
   */
  protected readonly LOG_LEVELS: Record<string, 0 | 1 | 2 | 3 | 4>;

  /**
   * OTEL span kind between OpenTelemetry specs and our own.
   */
  protected readonly OTEL_SPAN_KIND_MAPPING: Record<string, opentelemetry.SpanKind>;

  /**
   * OTEL span status between OpenTelemetry specs and our own.
   */
  protected readonly OTEL_SPAN_STATUS_MAPPING: Record<string, opentelemetry.SpanStatusCode>;

  /**
   * Minimum logging level (all messages below that level won't be logged).
   */
  public readonly logLevel: 0 | 1 | 2 | 3 | 4;

  /**
   * Used to prevent logging the same error multiple times through nested spans.
   */
  protected readonly loggedErrors: WeakSet<Error>;

  /**
   * Used to prevent recording the same exception multiple times through nested spans.
   */
  protected readonly recordedExceptions: WeakSet<Error>;

  /**
   * Stores span context in async stack.
   */
  protected readonly asyncStorage: AsyncLocalStorage<{ span?: opentelemetry.Span; }>;

  /**
   * Pino logger instance to use.
   */
  protected readonly pinoLogger: PinoLogger;

  /**
   * Custom pino destination for logs (e.g. specific file, distant stream, ...).
   */
  protected readonly pinoDestination: PinoDestination | undefined;

  /**
   * OTEL logger instance to use.
   */
  protected readonly otelLogger: OTELLogger | null;

  /**
   * OTEL tracer instance to use.
   */
  protected readonly otelTracer: opentelemetry.Tracer | null;

  /**
   * OTEL meter instance to use.
   */
  protected readonly otelMeter: opentelemetry.Meter | null;

  /**
   * Callback to gracefully shutdown OTEL providers.
   */
  protected readonly shutdownCallback: () => Promise<void>;

  /**
   * List of registered OTEL metrics.
   */
  protected readonly otelMetrics: Map<string, {
    type: 'HISTOGRAM';
    metric: opentelemetry.Histogram;
  } | {
    type: 'COUNTER';
    metric: opentelemetry.Counter;
  } | {
    type: 'UP_DOWN_COUNTER';
    metric: opentelemetry.UpDownCounter;
  } | {
    type: 'GAUGE';
    metric: opentelemetry.Gauge;
  }>;

  /**
   * Returns current context trace span, if it exists.
   *
   * @returns Current context trace span, if it exists.
   */
  protected getContext(span?: opentelemetry.Span): opentelemetry.Context | undefined {
    const store = this.asyncStorage.getStore();
    const currentSpan = span ?? store?.span;
    return (currentSpan !== undefined)
      ? opentelemetry.trace.setSpan(opentelemetry.context.active(), currentSpan)
      : undefined;
  }

  /**
   * Handles deduplicated error logging.
   *
   * @param error Error to handle.
   *
   * @param span Current context trace span.
   *
   * @param isFailure Whether the error is an actual failure. If not, the error will not be logged,
   * and the span will not be marked as error.
   */
  protected handleError(
    error: Error,
    span: opentelemetry.Span,
    isFailure: boolean,
  ): void {
    if (!isFailure) {
      if (!this.recordedExceptions.has(error)) {
        this.recordedExceptions.add(error);
        this.warn(error.message);
      }
    } else {
      if (!this.loggedErrors.has(error)) {
        this.loggedErrors.add(error);
        this.error(error);
      }
      span.setStatus({ code: opentelemetry.SpanStatusCode.ERROR });
    }
  }

  /**
   * Class constructor.
   *
   * @param settings Telemetry settings.
   */
  public constructor(settings?: TelemetrySettings) {
    this.OTEL_SPAN_KIND_MAPPING = {
      SERVER: opentelemetry.SpanKind.SERVER,
      CLIENT: opentelemetry.SpanKind.CLIENT,
      CONSUMER: opentelemetry.SpanKind.CONSUMER,
      PRODUCER: opentelemetry.SpanKind.PRODUCER,
      INTERNAL: opentelemetry.SpanKind.INTERNAL,
    };
    this.OTEL_SPAN_STATUS_MAPPING = {
      OK: opentelemetry.SpanStatusCode.OK,
      UNSET: opentelemetry.SpanStatusCode.UNSET,
      ERROR: opentelemetry.SpanStatusCode.ERROR,
    };
    this.LOG_LEVELS = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      fatal: 4,
    };
    this.otelMetrics = new Map();
    this.loggedErrors = new WeakSet<Error>();
    this.asyncStorage = new AsyncLocalStorage();
    this.recordedExceptions = new WeakSet<Error>();
    this.logLevel = this.LOG_LEVELS[settings?.logLevel ?? 'info'];
    const pinoSettings = {
      level: settings?.logLevel ?? 'info',
      transport: (settings?.prettyPrint === true && settings.destination === undefined)
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

    this.otelMeter = settings?.otelMeter ?? null;
    this.otelLogger = settings?.otelLogger ?? null;
    this.otelTracer = settings?.otelTracer ?? null;
    this.pinoDestination = settings?.destination ?? undefined;
    this.shutdownCallback = settings?.shutdownCallback ?? ((): Promise<void> => Promise.resolve());
    this.pinoLogger = (settings?.destination !== undefined)
      ? pino(pinoSettings, settings.destination)
      : pino(pinoSettings);

    process.on('warning', this.warn.bind(this));
    process.on('uncaughtException', this.fatal.bind(this));

    if (this.otelLogger !== null) {
      this.pinoLogger.info('OpenTelemetry logger is enabled, no logs will be sent to standard output.');
    }
    if (this.otelMeter !== null) {
      this.pinoLogger.info('OpenTelemetry meter is enabled, no metrics will be sent to standard output.');
    }
    if (this.otelTracer !== null) {
      this.pinoLogger.info('OpenTelemetry gateway tracer is enabled, no trace will be sent to standard output.');
    }
  }

  /**
   * Returns the current time, formatted using OTEL `hrTime` implementation.
   *
   * @returns Current time.
   */
  public now(): opentelemetry.HrTime {
    return (typeof this.LOG_LEVELS === 'number') ? hrTime() : hrTime();
  }

  /**
   * Returns the duration between two OTEL `hrTime` values, in seconds.
   *
   * @param start Start time.
   *
   * @returns Calculated duration.
   */
  public duration(start: opentelemetry.HrTime): number {
    return (typeof this.LOG_LEVELS === 'number')
      ? hrTimeToMilliseconds(hrTimeDuration(start, hrTime())) / 1000
      : hrTimeToMilliseconds(hrTimeDuration(start, hrTime())) / 1000;
  }

  /**
   * Returns the OTEL tracer instance.
   *
   * @returns OTEL tracer instance.
   */
  public getOtelTracer(): opentelemetry.Tracer | null {
    return this.otelTracer;
  }

  /**
   * Resolves as soon as the logging system is ready to accept logs.
   */
  public async waitForReady(): Promise<void> {
    return new Promise((resolve) => {
      if (this.pinoDestination === undefined) {
        resolve();
      } else {
        this.pinoDestination.on('ready', resolve);
      }
    });
  }

  /**
   * Generates a new span context from HTTP `headers`.
   *
   * @param headers HTTP headers from which to extract trace parent information.
   *
   * @returns Span context.
   */
  public getSpanContextFromHeaders(
    headers: Partial<Record<string, string | string[]>>,
  ): opentelemetry.Context {
    // TODO remove
    this.debug('Extracting span context from HTTP headers...', { headers });
    return opentelemetry.propagation.extract(opentelemetry.context.active(), headers);
  }

  /**
   * Creates a new trace span that will wrap `callback` execution. Automatically handles errors
   * logging and span status setting in case of errors.
   *
   * @param name Span name.
   *
   * @param options Span extra options.
   * - `kind` allows you to specify the span kind.
   * - `links` allows you to link this span to other external spans.
   * - `attributes` allows you to provide additional telemetry attributes to the span.
   * - `traceState` and `traceParent` allow you to inject this span into an existing trace.
   * - `filterErrors` allows you to customize the span behaviour in case an error is thrown:
   * sometimes, throwing an error does not necessarily mean the span should be marked as error, nor
   * that an unexpected thing happened. If this function returns `true`, the error will be
   * considered as an actual operation failure. Defaults to a function that always returns `true`.
   *
   * @param callback Function to run within the span.
   */
  public span<T = unknown>(
    name: string,
    options: Pick<opentelemetry.SpanOptions, 'attributes' | 'links'> & {
      traceState?: string;
      filterErrors?: (error: Error) => boolean;
      kind?: 'CONSUMER' | 'PRODUCER' | 'SERVER' | 'CLIENT';
      traceParent?: Pick<opentelemetry.SpanContext, 'traceId' | 'spanId' | 'traceFlags'>;
    },
    callback: (span: OpenTelemetrySpan) => T,
  ): T {
    const store = this.asyncStorage.getStore() as { span?: opentelemetry.Span; } | undefined;
    let context = (store?.span !== undefined)
      ? opentelemetry.trace.setSpan(opentelemetry.context.active(), store.span)
      : undefined;
    if (options.traceParent !== undefined) {
      context = opentelemetry.trace.setSpanContext(opentelemetry.context.active(), {
        isRemote: true,
        spanId: options.traceParent.spanId,
        traceId: options.traceParent.traceId,
        traceFlags: options.traceParent.traceFlags,
        traceState: opentelemetry.createTraceState(options.traceState),
      });
    }

    if (this.otelTracer === null) {
      this.pinoLogger.debug(`Starting span "${name}"...`);
      this.pinoLogger.debug(options);
    }

    const span: opentelemetry.Span = (this.otelTracer === null)
      ? {
        addLink: () => span,
        addEvent: () => span,
        addLinks: () => span,
        updateName: () => span,
        isRecording: () => false,
        setAttribute: () => span,
        recordException: () => span,
        end: (): opentelemetry.Span => {
          this.pinoLogger.debug(`Ending span "${name}"...`);
          return span;
        },
        setStatus: (status: { code: opentelemetry.SpanStatusCode }): opentelemetry.Span => {
          this.pinoLogger.debug(`Setting status for span "${name}"...`);
          this.pinoLogger.debug(status);
          return span;
        },
        setAttributes: (attributes: Record<string, unknown>): opentelemetry.Span => {
          this.pinoLogger.debug(`Setting attributes for span "${name}"...`);
          this.pinoLogger.debug(attributes);
          return span;
        },
        spanContext: () => ({
          traceFlags: 0,
          traceId: '00000000000000000000000000000000',
          spanId: options.traceParent?.spanId ?? '0000000000000000',
          traceState: opentelemetry.createTraceState(options.traceState),
        }),
      }
      : this.otelTracer.startSpan(name, {
        ...options,
        kind: this.OTEL_SPAN_KIND_MAPPING[options.kind ?? 'INTERNAL'],
      }, context);
    return this.asyncStorage.run({ span }, (): T => {
      let callbackResponse;
      try {
        callbackResponse = callback({
          getContext: span.spanContext.bind(span),
          setAttributes: span.setAttributes.bind(span),
          setStatus: (status: { code: 'OK' | 'UNSET' | 'ERROR' }) => {
            span.setStatus({ code: this.OTEL_SPAN_STATUS_MAPPING[status.code] });
          },
        });

        return !(callbackResponse instanceof Promise)
          ? callbackResponse
          : callbackResponse.catch((error: unknown) => {
            const rawError = error as Error;
            this.handleError(rawError, span, options.filterErrors?.(rawError) ?? true);
            throw error;
          }).finally(span.end.bind(span)) as T;
      } catch (error) {
        const rawError = error as Error;
        this.handleError(rawError, span, options.filterErrors?.(rawError) ?? true);
        throw error;
      } finally {
        if (!(callbackResponse instanceof Promise)) {
          span.end();
        }
      }
    });
  }

  /**
   * Information that is diagnostically helpful to people more than just developers
   * (IT, sysadmins, etc.).
   * This should be the minimum logging level in development.
   *
   * @param message Message to log.
   *
   * @param attributes Additional attributes to link to the message.
   */
  public debug(message: string, attributes?: AnyValueMap): void {
    const debugAttributes = attributes ?? {};
    if (this.otelLogger === null) {
      this.pinoLogger.debug(message);
      this.pinoLogger.debug(debugAttributes);
    } else if (this.LOG_LEVELS.debug >= this.logLevel) {
      const context = this.getContext();

      // Logging message...
      this.otelLogger.emit({
        context,
        body: message,
        severityNumber: 5, // DEBUG = 5.
        severityText: 'debug',
        attributes: debugAttributes,
      });
    }
  }

  /**
   * Generally useful information to log (service start/stop, configuration assumptions, etc).
   * Info we want to always have available but usually don't care about under normal circumstances.
   * This should be the minimum logging level in (pre)production.
   *
   * @param message Message to log.
   *
   * @param attributes Additional attributes to link to the message.
   */
  public info(message: string, attributes?: AnyValueMap): void {
    const infoAttributes = attributes ?? {};
    if (this.otelLogger === null) {
      this.pinoLogger.info(message);
      this.pinoLogger.info(infoAttributes);
    } else if (this.LOG_LEVELS.info >= this.logLevel) {
      const context = this.getContext();

      // Logging message...
      this.otelLogger.emit({
        context,
        body: message,
        severityNumber: 9, // INFO = 9.
        severityText: 'info',
        attributes: infoAttributes,
      });
    }
  }

  /**
   * Anything that can potentially cause application oddities, but which is not a serious concern
   * (Such as switching from a primary to backup server, retrying an operation, missing secondary
   * data, etc.). Not much to worry about, but it is still important to analyze warnings on a
   * regular basis to identify potential issues.
   *
   * @param message Message to log.
   *
   * @param attributes Additional attributes to link to the message.
   */
  public warn(message: string | Error, attributes?: AnyValueMap): void {
    const warnAttributes = attributes ?? {};
    if (this.otelLogger === null) {
      this.pinoLogger.warn(message);
      this.pinoLogger.warn(warnAttributes);
    } else if (this.LOG_LEVELS.warn >= this.logLevel) {
      const context = this.getContext();

      // Adding warning severity to span...
      if (context !== undefined) {
        opentelemetry.trace.getSpan(context)?.setAttribute('severity', 'warn');
      }

      // Logging warning depending on the message type...
      this.otelLogger.emit(!(message instanceof Error)
        ? {
          context,
          body: message,
          severityNumber: 13, // WARN = 13.
          severityText: 'warn',
          attributes: warnAttributes,
        }
        : {
          context,
          severityNumber: 13, // WARN = 13.
          severityText: 'warn',
          body: message.message,
          attributes: {
            ...warnAttributes,
            ...(message instanceof PerseidError ? message.details : {}),
            name: message.name,
            message: message.message,
            stackTrace: message.stack,
            type: message.constructor.name,
          },
        });
    }
  }

  /**
   * Any error which is fatal to the operation, but not the service or application (can't open a
   * required file, missing data, etc.). These errors will force user (administrator, or direct
   * user) intervention. These are usually reserved for incorrect connection strings, missing
   * services, uncaught exceptions, etc. Constitutes a degradation of service, which means
   * engineering team should be notified at some point.
   *
   * @param message Message to log.
   *
   * @param attributes Additional attributes to link to the message.
   */
  public error(message: string | Error, attributes?: AnyValueMap, span?: opentelemetry.Span): void {
    const errorAttributes = attributes ?? {};
    if (this.otelLogger === null) {
      this.pinoLogger.error(message);
      this.pinoLogger.error(errorAttributes);
    } else if (this.LOG_LEVELS.error >= this.logLevel) {
      const context = this.getContext(span);

      // Logging error depending on the message type...
      this.otelLogger.emit(!(message instanceof Error)
        ? {
          context,
          body: message,
          severityNumber: 17, // ERROR = 17.
          severityText: 'error',
          attributes: errorAttributes,
        }
        : {
          context,
          severityNumber: 17, // ERROR = 17.
          body: message.message,
          severityText: 'error',
          attributes: {
            ...errorAttributes,
            ...(message instanceof PerseidError ? message.details : {}),
            name: message.name,
            message: message.message,
            stackTrace: message.stack,
            type: message.constructor.name,
          },
        });
    }
  }

  /**
   * Any error that is forcing a shutdown of the service or application to prevent data loss
   * (or further data loss). Reserved only for the most heinous errors and situations where there is
   * guaranteed to have been data corruption or loss. Constitutes an interruption of service, which
   * means engineering and SysAdmin / DevOps teams must be immediately notified.
   *
   * @param message Message to log.
   *
   * @param attributes Additional attributes to link to the message.
   */
  public fatal(message: string | Error, attributes?: AnyValueMap): void {
    const fatalAttributes = attributes ?? {};
    if (this.otelLogger === null) {
      this.pinoLogger.fatal(message);
      this.pinoLogger.fatal(fatalAttributes);
    } else if (this.LOG_LEVELS.fatal >= this.logLevel) {
      const context = this.getContext();

      // Logging error depending on the message type...
      this.otelLogger.emit(!(message instanceof Error)
        ? {
          context,
          body: message,
          severityNumber: 21, // FATAL = 21.
          severityText: 'fatal',
          attributes: fatalAttributes,
        }
        : {
          context,
          severityNumber: 21, // FATAL = 21.
          severityText: 'fatal',
          body: message.message,
          attributes: {
            ...fatalAttributes,
            ...(message instanceof PerseidError ? message.details : {}),
            name: message.name,
            message: message.message,
            stackTrace: message.stack,
            type: message.constructor.name,
          },
        });
    }
  }

  /**
   * Creates a new gauge metric.
   *
   * @param name Metric name.
   *
   * @param options Metric options.
   */
  public createGauge(name: string, options: opentelemetry.MetricOptions): void {
    if (this.otelMeter === null) {
      this.pinoLogger.debug(`Creating gauge metric "${name}"...`);
      this.pinoLogger.debug(options);
    } else {
      this.otelMetrics.set(name, {
        type: 'GAUGE',
        metric: this.otelMeter.createGauge(name, options),
      });
    }
  }

  /**
   * Creates a new histogram metric.
   *
   * @param name Metric name.
   *
   * @param options Metric options.
   */
  public createHistogram(name: string, options: opentelemetry.MetricOptions): void {
    if (this.otelMeter === null) {
      this.pinoLogger.debug(`Creating histogram metric "${name}"...`);
      this.pinoLogger.debug(options);
    } else {
      this.otelMetrics.set(name, {
        type: 'HISTOGRAM',
        metric: this.otelMeter.createHistogram(name, options),
      });
    }
  }

  /**
   * Creates a new counter metric.
   *
   * @param name Metric name.
   *
   * @param options Metric options.
   */
  public createCounter(name: string, options: opentelemetry.MetricOptions): void {
    if (this.otelMeter === null) {
      this.pinoLogger.debug(`Creating counter metric "${name}"...`);
      this.pinoLogger.debug(options);
    } else {
      this.otelMetrics.set(name, {
        type: 'COUNTER',
        metric: this.otelMeter.createCounter(name, options),
      });
    }
  }

  /**
   * Creates a new up-down counter metric.
   *
   * @param name Metric name.
   *
   * @param options Metric options.
   */
  public createUpDownCounter(name: string, options: opentelemetry.MetricOptions): void {
    if (this.otelMeter === null) {
      this.pinoLogger.debug(`Creating up-down counter metric "${name}"...`);
      this.pinoLogger.debug(options);
    } else {
      this.otelMetrics.set(name, {
        type: 'UP_DOWN_COUNTER',
        metric: this.otelMeter.createUpDownCounter(name, options),
      });
    }
  }

  /**
   * Adds a new measurement for a metric.
   *
   * @param name Metric name.
   *
   * @param value Value to add.
   *
   * @param attributes Additional attributes to link to the metric.
   */
  public measure(name: string, value: number, attributes?: opentelemetry.Attributes): void {
    const metricAttributes = attributes ?? {};
    if (this.otelMeter === null) {
      this.pinoLogger.debug(`Adding measurement for metric "${name}"...`);
      this.pinoLogger.debug(value);
      this.pinoLogger.debug(metricAttributes);
    } else {
      const context = this.getContext();
      const metric = this.otelMetrics.get(name);

      if (metric === undefined) {
        this.error('Metric not found.', { name });
      } else if (metric.type === 'HISTOGRAM') {
        metric.metric.record(value, metricAttributes, context);
      } else if (metric.type === 'COUNTER') {
        metric.metric.add(value, metricAttributes, context);
      } else if (metric.type === 'UP_DOWN_COUNTER') {
        metric.metric.add(value, metricAttributes, context);
      } else {
        metric.metric.record(value, metricAttributes, context);
      }
    }
  }

  /**
   * Gracefully closes pino logger and OTEL providers, flushing remaining buffered logs.
   */
  public async close(): Promise<void> {
    await this.shutdownCallback();
    this.pinoDestination?.flushSync();
    await new Promise((resolve) => { this.pinoLogger.flush(resolve); });
  }
}
