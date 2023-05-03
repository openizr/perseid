/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import module from 'module';

/* c8 ignore next */
const require = (typeof window !== 'undefined') ? null : module.createRequire('/');
const toHex = (uint: number): string => uint.toString(16);

/**
 * Isomorphic universally unique identifiers generator.
 * Inspired from mongodb ObjectId implementation and Snowflake algorithm.
 * An id is a 12-byte value, constructed as follows:
 *  - A 4-byte timestamp
 *  - A 5-byte process-specific id
 *  - A 3-byte script-specific id
 */
export default class Id {
  /** Used to identify whether given value is a valid id. */
  private idRegExp = /^[a-f0-9]{24}$/;

  /** Bytes mask. */
  protected mask = 0xffffff;

  /** Id value. */
  protected value: Buffer;

  /** Id string representation. */
  protected id: string;

  /** Unique set of bytes, specific to current process. */
  static uniqueId: Buffer | null = null;

  /** Increment that ensures that all ids generated from the same script are unique. */
  static index = Math.floor(Math.random() * 0xffffff);

  /**
   * Returns incremented counter.
   *
   * @returns Incremented counter.
   */
  protected getCounter(): number {
    Id.index = (Id.index + 1) % this.mask;
    return Id.index;
  }

  /**
   * Generates a new id.
   * A slightly different algorithm is used depending on the environment (node / browser).
   *
   * @returns Generated id.
   */
  protected generate(): Buffer {
    if (typeof window !== 'undefined') {
      if (Id.uniqueId === null) {
        Id.uniqueId = Array.prototype.map
          .call(window.crypto.getRandomValues(new Uint32Array(3)), toHex)
          .join('')
          .slice(0, 10) as unknown as Buffer;
      }

      // 4-byte timestamp.
      const time = Math.floor(Date.now() / 1000).toString(16);

      // 5-byte process id.
      const processId = Id.uniqueId;

      // 3-byte counter.
      const counter = this.getCounter();
      const counterId = (((counter >> 16) & this.mask)
        + ((counter >> 8) & this.mask)
        + (counter & this.mask)).toString(16).slice(0, 6);

      return `${time}${processId as unknown as string}${counterId}` as unknown as Buffer;
    }

    if (Id.uniqueId === null) {
      Id.uniqueId = (require?.('crypto') as { randomBytes: (arg: number) => Buffer; }).randomBytes(5);
    }

    const buffer = Buffer.alloc(12);

    // 4-byte timestamp.
    buffer.writeUInt32BE(Math.floor(Date.now() / 1000), 0);

    // 5-byte process id.
    [
      buffer[4],
      buffer[5],
      buffer[6],
      buffer[7],
      buffer[8],
    ] = (Id as { uniqueId: Buffer; }).uniqueId;

    // 3-byte counter.
    const counter = this.getCounter();
    buffer[11] = counter & 0xff;
    buffer[10] = (counter >> 8) & 0xff;
    buffer[9] = (counter >> 16) & 0xff;

    return buffer;
  }

  /**
   * Class constructor.
   *
   * @param value Id string representation. If not defined, a new id will be generated.
   */
  constructor(value?: string) {
    if (typeof window !== 'undefined') {
      this.value = this.idRegExp.test(`${value}`) ? value as unknown as Buffer : this.generate();
      this.id = this.value as unknown as string;
    } else {
      this.value = this.idRegExp.test(`${value}`) ? Buffer.from(String(value), 'hex') : this.generate();
      this.id = this.value.toString('hex');
    }
  }

  /**
   * Returns id string representation.
   *
   * @returns Id string representation.
   */
  public toString(): string {
    return this.id;
  }

  /**
   * Returns id value representation.
   *
   * @returns Id value representation.
   */
  public valueOf(): string {
    return this.id;
  }

  /**
   * Returns id JSON representation.
   *
   * @returns Id JSON representation.
   */
  public toJSON(): string {
    return this.id;
  }
}
