/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/** Collections with an `_id` field. */
export interface Ids {
  /** Resource id. */
  _id: Id;
}

/** Collections with authors-related automatic fields. */
export interface Authors {
  /** Resource creation author. */
  _createdBy: Id | User;

  /** Resource modification author. */
  _updatedBy: Id | User | null;
}

/** Collections with timestamps-related automatic fields. */
export interface Timestamps {
  /** Resource creation date. */
  _createdAt: Date;

  /** Resource modification date. */
  _updatedAt: Date | null;
}

/** Soft-deletable collections. */
export interface Deletion {
  /** Whether resource has been deleted. */
  _isDeleted: boolean;
}

/** Versionnable collections. */
export interface Version {
  /** Resource version. */
  _version: number;
}

/** List of user permissions. */
export interface UserPermissions {
  [name: string]: boolean;
}

/** Set of permissions, grouped for a specific purpose. */
export interface Role extends Ids, Version, Timestamps, Authors {
  /** Role name. */
  name: string;

  /** List of permissions granted by this role. */
  permissions: string[];
}

/** User. */
export interface User extends Ids, Version, Timestamps, Authors {
  /** User verification date. */
  _verifiedAt: Date | null;

  /** User permissions. */
  _permissions?: UserPermissions;

  /** User email. */
  email: string;

  /** User password. */
  password: string;

  /** User roles. */
  roles: (Id | Role)[];

  /** List of user API keys. */
  _apiKeys: string[];

  /** List of user devices. */
  _devices: {
    /** Device id. */
    id: string;

    /** Device user agent. */
    userAgent: string;

    /** Refresh token expiration date. */
    expiration: Date;

    /** Refresh token to use for that device. */
    refreshToken: string;
  }[];
}

/**
 * Default perseid data model.
 */
export interface DataModel {
  users: User;
  roles: Role;
}

/**
 * Implementation of JS `Array.forEach` method, adapted to asynchronous callbacks.
 *
 * @param items Items to iterate on.
 *
 * @param callback Asynchronous function to execute for each item.
 */
export function forEach<T>(
  items: T[],
  callback: (item: T, index: number) => Promise<void>,
): Promise<void>;

/**
 * Isomorphic universally unique identifiers generator.
 * Inspired from mongodb ObjectId implementation and Snowflake algorithm.
 * An id is a 12-byte value, constructed as follows:
 *  - A 4-byte timestamp
 *  - A 5-byte process-specific id
 *  - A 3-byte script-specific id
 */
export class Id {
  /** Bytes mask. */
  protected mask: number;

  /** Id value. */
  protected value: Buffer;

  /** Id string representation. */
  protected id: string;

  /** Unique set of bytes, specific to current process. */
  static uniqueId: Buffer | null;

  /** Increment that ensures that all ids generated from the same script are unique. */
  static index: number;

  /**
   * Returns incremented counter.
   *
   * @returns Incremented counter.
   */
  protected getCounter(): number;

  /**
   * Generates a new id.
   * A slightly different algorithm is used depending on the environment (node / browser).
   *
   * @returns Generated id.
   */
  protected generate(): Buffer;

  /**
   * Class constructor.
   *
   * @param value Id string representation. If not defined, a new id will be generated.
   */
  constructor(value?: string);

  /**
   * Returns id string representation.
   *
   * @returns Id string representation.
   */
  public toString(): string;
}

/**
 * Abstract class that represents a logging system.
 * Extend this class with a real implementation depending on the environment (node/browser).
 */
export abstract class Logger {
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
