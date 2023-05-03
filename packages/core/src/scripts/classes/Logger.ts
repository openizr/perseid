/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * Abstract class that represents a logging system.
 * Extend this class with a real implementation depending on the environment (node/browser).
 */
export default abstract class Logger {
  /**
   * Information that is diagnostically helpful to people more than just developers
   * (IT, sysadmins, etc.).
   * This should be the minimum logging level in development.
   */
  public abstract debug(...args: unknown[]): void;

  /**
   * Generally useful information to log (service start/stop, configuration assumptions, etc).
   * Info we want to always have available but usually don't care about under normal circumstances.
   * This should be the minimum logging level in (pre)production.
   */
  public abstract info(...args: unknown[]): void;

  /**
   * Anything that can potentially cause application oddities, but which is not a serious concern
   * (Such as switching from a primary to backup server, retrying an operation, missing secondary
   * data, etc.). Not much to worry about, but it is still important to analyze warnings on a
   * regular basis to identify potential issues.
   */
  public abstract warn(...args: unknown[]): void;

  /**
   * Any error which is fatal to the operation, but not the service or application (can't open a
   * required file, missing data, etc.). These errors will force user (administrator, or direct
   * user) intervention. These are usually reserved for incorrect connection strings, missing
   * services, uncaught exceptions, etc. Constitutes a degradation of service, which means
   * engineering team must be immediately notified.
   */
  public abstract error(...args: unknown[]): void;

  /**
   * Any error that is forcing a shutdown of the service or application to prevent data loss
   * (or further data loss). Reserved only for the most heinous errors and situations where there is
   * guaranteed to have been data corruption or loss. Constitutes an interruption of service, which
   * means engineering and SysAdmin / DevOps teams must be immediatly notified.
   */
  public abstract fatal(...args: unknown[]): void;

  /**
   * Gracefully closes the logging system (before stopping the program, for instance).
   */
  public abstract close(): Promise<void>;
}
