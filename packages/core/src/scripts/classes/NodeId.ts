/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import crypto from 'crypto';
import { v7 as uuid, validate } from 'uuid';

const SNOWFLAKE_ID_MASK = 0xffffff;
const SNOWFLAKE_ID_REGEXP = /^[a-f0-9]{24}$/;
let SNOWFLAKE_ID_PROCESS_ID: Buffer | null = null;
let SNOWFLAKE_ID_INCREMENT = Math.floor(Math.random() * 0xffffff);

/**
 * Isomorphic, universally unique identifiers generator.
 * Inspired from mongodb ObjectId implementation and Snowflake algorithm.
 * Generated ID can be in one of the following formats:
 *  - UUID (default): A RFC 9562 compliant, 16-byte value.
 *  - SNOWFLAKE: A 12-byte value, constructed as follows:
 *    - A 4-byte timestamp
 *    - A 5-byte process-specific ID
 *    - A 3-byte script-specific ID
 */
export default class Id {
  /**
   * ID string representation.
   */
  protected value: string;

  /**
   * Id format. Supports 'SNOWFLAKE' and 'UUID'.
   */
  public static FORMAT: 'SNOWFLAKE' | 'UUID' = 'UUID';

  /**
   * Generates a new ID.
   * When using the 'SNOWFLAKE' format, a slightly different algorithm is used depending on the
   * environment (node/browser).
   *
   * @param format ID format to use.
   *
   * @returns Generated ID.
   */
  protected generate(format: 'SNOWFLAKE' | 'UUID'): string {
    if (format === 'UUID') {
      return uuid();
    }

    if (this.value === '' || SNOWFLAKE_ID_PROCESS_ID === null) {
      SNOWFLAKE_ID_PROCESS_ID = crypto.randomBytes(5);
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
    ] = SNOWFLAKE_ID_PROCESS_ID;

    // 3-byte counter.
    SNOWFLAKE_ID_INCREMENT = (SNOWFLAKE_ID_INCREMENT + 1) % SNOWFLAKE_ID_MASK;
    const counter = SNOWFLAKE_ID_INCREMENT;
    buffer[11] = counter & 0xff;
    buffer[10] = (counter >> 8) & 0xff;
    buffer[9] = (counter >> 16) & 0xff;

    return buffer.toString('hex');
  }

  /**
   * Class constructor.
   *
   * @param value ID string representation. If not defined or valid, a new ID will be generated.
   *
   * @param format ID format to use. Defaults to the default specified format.
   */
  constructor(value?: string, format = Id.FORMAT) {
    if (format === 'UUID') {
      const shouldGenerateId = typeof value === 'string' && validate(value);
      this.value = shouldGenerateId ? value : this.generate(format);
    } else {
      const shouldGenerateId = typeof value === 'string' && SNOWFLAKE_ID_REGEXP.test(value);
      this.value = shouldGenerateId ? value : this.generate(format);
    }
  }

  /**
   * Returns ID string representation.
   *
   * @returns ID string representation.
   */
  public toString(): string {
    return this.value;
  }

  /**
   * Returns ID value representation.
   *
   * @returns ID value representation.
   */
  public valueOf(): string {
    return this.value;
  }

  /**
   * Returns ID JSON representation.
   *
   * @returns ID JSON representation.
   */
  public toJSON(): string {
    return this.value;
  }
}
