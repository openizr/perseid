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

export const Id = String;
export const deepMerge = (): unknown => ({});
export const toSnakeCase = (text: string): string => `SNAKE_CASED_${text}`;
export class Model {
  protected schema: Record<string, unknown>;

  public get = vi.fn((collection: string) => ({
    schema: this.schema[collection],
    canonicalPath: [collection],
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
