/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { type Document } from 'mongodb';
import { type DataModelMetadata } from '@perseid/core';
import schema from 'scripts/services/__mocks__/schema';

/** `services/Model` mock. */

export default class Model {
  protected defaultCollection = { fields: {} };

  public static email = vi.fn(() => ({ type: 'string' }));

  public static password = vi.fn(() => ({ type: 'string' }));

  public static tinyText = vi.fn(() => ({ type: 'string' }));

  public static shortText = vi.fn(() => ({ type: 'string' }));

  public static mediumText = vi.fn(() => ({ type: 'string' }));

  public static longText = vi.fn(() => ({ type: 'string' }));

  public static hugeText = vi.fn(() => ({ type: 'string' }));

  public static token = vi.fn(() => ({ type: 'string' }));

  public static credentials = vi.fn(() => ({ type: 'string' }));

  public getCollections = vi.fn(() => ['users', 'roles', 'test', 'externalRelation', 'otherExternalRelation']);

  public getPublicSchema = vi.fn((collection) => (collection === 'unknown' ? null : {}));

  public get(path: string): DataModelMetadata<Document> | null {
    const schemas: Record<string, unknown> = {
      'test2._id': { type: 'id' },
      'test2.float': { type: 'float' },
      'test2.array': { type: 'array' },
      'test2.date': { type: 'date' },
      'test2.integer': { type: 'integer' },
      'test2.relation': { type: 'id', relation: 'test2' },
      'test2.relation._id': { type: 'id' },
      'test2.object.test': { type: 'string' },
      'test.objectOne.testTwo.type': { type: 'string' },
    };
    if (path === 'test.objectOne.testTwo.type') {
      return {
        canonicalPath: ['test', 'objectOne', 'testTwo', 'type'],
        schema: { type: 'string' },
      };
    }
    const subSchema = (schema as Document)[path] as Document | undefined;
    return (path.split('.').at(-1) === 'invalid') ? null : {
      canonicalPath: [path],
      schema: subSchema ?? schemas[path] ?? this.defaultCollection,
    };
  }
}
