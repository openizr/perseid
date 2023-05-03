/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type Id from 'scripts/classes/Id';
import Model from 'scripts/classes/Model';

interface DataModel {
  test: {
    object: {
      relations: Id[];
    };
  };
  test2: { test: string; };
  users: { email: string; };
}

type TestModel = Model<DataModel>;

describe('services/Model', () => {
  const model = new Model<DataModel>({
    users: {
      fields: {
        email: { type: 'string' },
      },
    },
    test: {
      fields: {
        object: {
          type: 'object',
          fields: {
            relations: {
              type: 'array',
              fields: {
                type: 'id',
                relation: 'test2',
              },
            },
          },
        },
      },
    },
    test2: {
      version: 1,
      enableAuthors: true,
      enableDeletion: false,
      enableTimestamps: true,
      fields: {
        test2: {
          type: 'string',
        },
      },
    },
  }) as TestModel;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('[getCollections]', () => {
    expect(model.getCollections()).toEqual(['users', 'test', 'test2']);
  });

  test('[get] invalid path', () => {
    expect(model.get('')).toBeNull();
    expect(model.get('test.object.invalid.test')).toBeNull();
  });

  test('[get] valid path', () => {
    expect(model.get('test2')).toEqual({
      canonicalPath: ['test2'],
      schema: {
        version: 1,
        enableAuthors: true,
        enableDeletion: false,
        enableTimestamps: true,
        fields: {
          _id: {
            type: 'id',
            index: true,
            required: true,
          },
          _version: {
            type: 'integer',
            index: true,
            required: true,
          },
          _isDeleted: {
            type: 'boolean',
            index: true,
            required: true,
            default: false,
          },
          _createdBy: {
            type: 'id',
            index: true,
            required: true,
            relation: 'users',
          },
          _updatedBy: {
            type: 'id',
            index: true,
            relation: 'users',
          },
          _createdAt: {
            type: 'date',
            index: true,
            required: true,
          },
          _updatedAt: {
            type: 'date',
            index: true,
          },
          test2: {
            type: 'string',
          },
        },
      },
    });
    expect(model.get('test.object.relations.test2')).toEqual({
      canonicalPath: ['test2', 'test2'],
      schema: {
        type: 'string',
      },
    });
  });
});
