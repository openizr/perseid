/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as opentelemetry from '@opentelemetry/api';
import type { AnyValue, AnyValueMap } from '@opentelemetry/api-logs';

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
 * Observability service, providing logging, tracing and metrics-related features.
 * Fully supports OpenTelemetry API: https://opentelemetry.io.
 */
export default abstract class Telemetry {
  /**
   * Resolves as soon as the logging system is ready to accept logs.
   */
  public abstract waitForReady(): Promise<void>;

  /**
   * Creates a new trace span that will wrap `callback` execution. Automatically handles errors
   * logging and span status setting in case of errors.
   *
   * @param name Span name.
   *
   * @param options Span extra options.
   *
   * @param callback Function to run within the span.
   *
   * @param isAnExpectedError Allows you to customize the span behaviour in case an error is thrown.
   * Sometimes, throwing an error does not necessarily mean the span should be marked as error, nor
   * that an unexpected thing happened. Defaults to a function that always returns `false`.
   */
  public abstract span<T = unknown>(
    name: string,
    options: Pick<opentelemetry.SpanOptions, 'attributes' | 'links'> & {
      traceState?: string;
      traceParent?: Pick<opentelemetry.SpanContext, 'traceId' | 'spanId' | 'traceFlags'>;
      kind?: 'CONSUMER' | 'PRODUCER' | 'SERVER' | 'CLIENT';
    },
    callback: (span: OpenTelemetrySpan) => T,
    isAnExpectedError?: (error: Error) => boolean,
  ): T;

  /**
   * Information that is diagnostically helpful to people more than just developers
   * (IT, sysadmins, etc.).
   * This should be the minimum logging level in development.
   *
   * @param message Message to log.
   *
   * @param attributes Additional attributes to link to the message.
   */
  public abstract debug(message: string, attributes?: AnyValueMap): void;

  /**
   * Generally useful information to log (service start/stop, configuration assumptions, etc).
   * Info we want to always have available but usually don't care about under normal circumstances.
   * This should be the minimum logging level in (pre)production.
   *
   * @param message Message to log.
   *
   * @param attributes Additional attributes to link to the message.
   */
  public abstract info(message: string, attributes?: AnyValueMap): void;

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
  public abstract warn(message: string, attributes?: AnyValueMap): void;

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
  public abstract error(message: string | Error, attributes?: AnyValueMap): void;

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
  public abstract fatal(message: string | Error, attributes?: AnyValueMap): void;

  /**
   * Creates a new gauge metric.
   *
   * @param name Metric name.
   *
   * @param options Metric options.
   */
  public abstract createGauge(name: string, options: opentelemetry.MetricOptions): void;

  /**
   * Creates a new histogram metric.
   *
   * @param name Metric name.
   *
   * @param options Metric options.
   */
  public abstract createHistogram(name: string, options: opentelemetry.MetricOptions): void;

  /**
   * Creates a new counter metric.
   *
   * @param name Metric name.
   *
   * @param options Metric options.
   */
  public abstract createCounter(name: string, options: opentelemetry.MetricOptions): void;

  /**
   * Creates a new up-down counter metric.
   *
   * @param name Metric name.
   *
   * @param options Metric options.
   */
  public abstract createUpDownCounter(name: string, options: opentelemetry.MetricOptions): void;

  /**
   * Adds a new measurement for a metric.
   *
   * @param name Metric name.
   *
   * @param value Value to add.
   *
   * @param attributes Additional attributes to link to the metric.
   */
  public abstract measure(name: string, value: number, attributes?: opentelemetry.Attributes): void;

  /**
   * Gracefully closes pino logger and OTEL providers, flushing remaining buffered logs.
   */
  public abstract close(): Promise<void>;

  /**
   * Returns the current time, formatted using OTEL `hrTime` implementation.
   *
   * @returns Current time.
   */
  public abstract now(): opentelemetry.HrTime;

  /**
   * Returns the duration between two OTEL `hrTime` values, in seconds.
   *
   * @param start Start time.
   *
   * @returns Calculated duration.
   */
  public abstract duration(start: opentelemetry.HrTime): number;
}
