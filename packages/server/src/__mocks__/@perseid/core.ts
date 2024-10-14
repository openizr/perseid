/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `@perseid/core` mock.
 */

export const deepMerge = (): unknown => ({});
export const isPlainObject = (variable: unknown): boolean => variable !== null && typeof variable === 'object';
export const toSnakeCase = (text: string): string => `SNAKE_CASED_${text}`;
export const forEach = async (
  items: unknown[],
  callback: (item: unknown, index: number) => Promise<void>,
): Promise<void> => {
  for (let index = 0; index < items.length; index += 1) {
    await callback(items[index], index);
  }
};

export class Model {
  protected schema: Record<string, unknown>;

  public get = vi.fn((resource: string) => ({
    schema: this.schema[resource],
    canonicalPath: [resource],
  }));

  constructor(schema: Record<string, unknown>) {
    this.schema = { ...schema };
    this.schema.otherExternalRelation = {
      ...schema.otherExternalRelation as Record<string, unknown>,
    };
    const { otherExternalRelation } = this.schema;
    (otherExternalRelation as { fields: { _version: Record<string, unknown> } }).fields = {
      ...(otherExternalRelation as { fields: { _version: Record<string, unknown> } }).fields,
      ...{ _version: { type: 'integer' } },
    };
  }
}

let count = 0;
export class Id {
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

export class HttpClient {
  protected mock = true;
}
