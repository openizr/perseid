/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `mongodb` mock.
 */

export class Binary {
  public buffer = { length: 10 };
}
let count = 0;
export class ObjectId {
  protected value: string;

  constructor(value?: string) {
    if (value !== undefined) {
      this.value = value;
    } else {
      count += 1;
      this.value = String(count).padStart(24, '0');
    }
  }

  public toString(): string {
    return this.value;
  }
}
