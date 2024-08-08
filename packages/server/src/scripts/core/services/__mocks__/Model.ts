/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { type Document } from 'mongodb';
import { type DataModelMetadata } from '@perseid/core';
import schema from 'scripts/core/services/__mocks__/schema';

/** `core/services/Model` mock. */

export default class Model {
  protected defaultSchema = { fields: {} };

  public static email = vi.fn(() => ({ type: 'string' }));

  public static password = vi.fn(() => ({ type: 'string' }));

  public static tinyText = vi.fn(() => ({ type: 'string' }));

  public static shortText = vi.fn(() => ({ type: 'string' }));

  public static mediumText = vi.fn(() => ({ type: 'string' }));

  public static longText = vi.fn(() => ({ type: 'string' }));

  public static hugeText = vi.fn(() => ({ type: 'string' }));

  public static token = vi.fn(() => ({ type: 'string' }));

  public static credentials = vi.fn(() => ({ type: 'string' }));

  public getResources = vi.fn(() => ['test', 'otherTest']);

  public getPublicSchema = vi.fn((collection) => (collection === 'unknown' ? null : {}));

  public get(path: string): DataModelMetadata<Document> | null {
    if (path === 'otherTest') {
      return {
        canonicalPath: ['otherTest'],
        schema: schema.otherTest,
      };
    }
    if (path === 'test') {
      return {
        canonicalPath: ['test'],
        schema: schema.test,
      };
    }
    if (path === 'users') {
      return {
        canonicalPath: ['users'],
        schema: {
          fields: {
            _id: { type: 'id' },
            password: { type: 'string' },
            _verifiedAt: { type: 'date' },
            roles: { type: 'array', fields: { type: 'id' } },
          },
        },
      };
    }
    return (path.split('.').at(-1) === 'invalid') ? null : {
      canonicalPath: [path],
      schema: this.defaultSchema,
    };
  }
}
