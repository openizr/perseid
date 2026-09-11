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

  public getPublicSchema = vi.fn((resource) => (resource === 'unknown' ? null : {}));

  public get(path: string): DataModelMetadata<Document> | null {
    if (path === 'otherTest') {
      return {
        depth: 1,
        schema: schema.otherTest,
        canonicalPath: ['otherTest'],
        permissions: ['OTHER_TEST.VIEW'],
      };
    }
    if (path === 'test') {
      return {
        depth: 1,
        schema: schema.test,
        canonicalPath: ['test'],
        permissions: ['TEST.VIEW'],
      };
    }
    if (path === 'notImplemented') {
      return {
        depth: 1,
        schema: schema.notImplemented,
        canonicalPath: ['notImplemented'],
        permissions: ['NOT_IMPLEMENTED.VIEW'],
      };
    }
    if (path === 'test.objectOne') {
      return {
        depth: 1,
        schema: schema.test.fields.objectOne,
        canonicalPath: ['test', 'objectOne'],
        permissions: ['TEST.VIEW'],
      };
    }
    if (path === 'test._isDeleted') {
      return {
        depth: 1,
        schema: schema.test.fields._isDeleted,
        canonicalPath: ['test', '_isDeleted'],
        permissions: ['TEST.VIEW', 'TEST.IS_DELETED.VIEW'],
      };
    }
    if (path === 'test.objectOne.optionalRelations._id') {
      return {
        depth: 2,
        schema: schema.otherTest.fields._id,
        canonicalPath: ['test', 'objectOne', 'optionalRelations', '_id'],
        permissions: ['TEST.VIEW', 'OTHER_TEST.VIEW'],
      };
    }
    if (path === 'test._id') {
      return {
        depth: 1,
        schema: schema.test.fields._id,
        canonicalPath: ['_id'],
        permissions: ['TEST.VIEW'],
      };
    }
    if (path === 'test.objectOne.optionalRelations') {
      return {
        depth: 2,
        schema: { type: 'id', relation: 'otherTest' },
        canonicalPath: ['test', 'objectOne', 'optionalRelations'],
        permissions: ['TEST.VIEW', 'OTHER_TEST.VIEW'],
      };
    }
    if (path === 'users') {
      return {
        depth: 1,
        canonicalPath: ['users'],
        permissions: ['USERS.VIEW'],
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
    const splittedPath = path.split('.');
    return (splittedPath[splittedPath.length - 1] === 'invalid') ? null : {
      depth: 1,
      permissions: [],
      canonicalPath: [path],
      schema: this.defaultSchema,
    };
  }
}
