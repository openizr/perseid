/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { v7 as uuid, validate } from 'uuid';

const SNOWFLAKE_ID_MASK = 0xffffff;
const SNOWFLAKE_ID_REGEXP = /^[a-f0-9]{24}$/;
let SNOWFLAKE_ID_PROCESS_ID: string | null = null;
let SNOWFLAKE_ID_INCREMENT = Math.floor(Math.random() * 0xffffff);
const toHex = (uint: number): string => uint.toString(16);

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
      SNOWFLAKE_ID_PROCESS_ID = Array.prototype.map
        .call(window.crypto.getRandomValues(new Uint32Array(3)), toHex)
        .join('')
        .slice(0, 10);
    }

    // 4-byte timestamp.
    const time = Math.floor(Date.now() / 1000).toString(16);

    // 5-byte process id.
    const processId = SNOWFLAKE_ID_PROCESS_ID;

    // 3-byte counter.
    SNOWFLAKE_ID_INCREMENT = (SNOWFLAKE_ID_INCREMENT + 1) % SNOWFLAKE_ID_MASK;
    const counter = SNOWFLAKE_ID_INCREMENT;
    const counterId = (((counter >> 16) & SNOWFLAKE_ID_MASK)
      + ((counter >> 8) & SNOWFLAKE_ID_MASK)
      + (counter & SNOWFLAKE_ID_MASK)).toString(16).slice(0, 6);

    return `${time}${processId}${counterId}`;
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
