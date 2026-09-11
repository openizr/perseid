/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type Id from 'scripts/classes/NodeId';
import Model, { type DataModelSchema } from 'scripts/classes/Model';

interface DataModel {
  test: {
    object: {
      relations: Id[];
    };
  };
  test2: { test: string; };
}

type TestModel = Model<DataModel> & {
  schema: Model<DataModel>['schema'];
};

describe('classes/Model', () => {
  vi.mock('scripts/helpers/toSnakeCase');

  const schema: DataModelSchema<DataModel> = {
    test: {
      description: 'test',
      fields: {
        object: {
          type: 'object',
          description: 'object relation',
          fields: {
            relations: {
              type: 'array',
              permission: 'TEST.VIEW_RELATIONS',
              fields: {
                type: 'id',
                relation: 'test2',
                description: 'test2 relation',
              },
            },
          },
        },
      },
    },
    test2: {
      enableAuthors: true,
      enableDeletion: false,
      enableTimestamps: true,
      description: 'test2',
      fields: {
        test2: {
          type: 'string',
          maxLength: 256,
          description: 'test2 field',
        },
      },
    },
  };
  const model = new Model<DataModel>(schema) as TestModel;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('[constructor]', () => {
    test('empty schema', () => {
      const emptyModel = new Model() as TestModel;
      expect(emptyModel.schema).toEqual({});
    });

    test('non-empty schema', () => {
      const schemaModel = new Model<DataModel>({
        test: {
          description: 'test',
          fields: {
            test2: {
              type: 'string',
              maxLength: 256,
              description: 'test2 field',
            },
          },
        },
      }) as TestModel;
      expect(schemaModel.schema).toEqual({
        test: {
          enableAuthors: false,
          enableDeletion: true,
          enableTimestamps: false,
          fields: {
            _id: {
              type: 'id',
              isUnique: true,
              isRequired: true,
            },
            test2: {
              type: 'string',
            },
          },
        },
      });
    });
  });

  test('[getResources]', () => {
    expect(model.getResources()).toEqual(['test', 'test2']);
  });

  describe('[get]', () => {
    test('invalid path', () => {
      expect(model.get('')).toBeNull();
      expect(model.get('test.object.invalid.test')).toBeNull();
    });

    test('valid path', () => {
      expect(model.get('test2')).toEqual({
        canonicalPath: ['test2'],
        depth: 1,
        permissions: ['TO_SNAKE_CASE_test2.VIEW'],
        schema: {
          enableAuthors: true,
          enableDeletion: false,
          enableTimestamps: true,
          fields: {
            _id: {
              type: 'id',
              isUnique: true,
              isRequired: true,
            },
            _isDeleted: {
              type: 'boolean',
              isIndexed: true,
              isRequired: true,
            },
            _createdBy: {
              type: 'id',
              isIndexed: true,
              isRequired: true,
              relation: 'users',
            },
            _updatedBy: {
              type: 'id',
              isIndexed: true,
              relation: 'users',
            },
            _createdAt: {
              type: 'date',
              isIndexed: true,
              isRequired: true,
            },
            _updatedAt: {
              type: 'date',
              isIndexed: true,
            },
            test2: {
              type: 'string',
            },
          },
        },
      });
      expect(model.get('test.object.relations.test2')).toEqual({
        canonicalPath: ['test2', 'test2'],
        depth: 2,
        permissions: ['TO_SNAKE_CASE_test.VIEW', 'TEST.VIEW_RELATIONS', 'TO_SNAKE_CASE_test2.VIEW'],
        schema: {
          type: 'string',
        },
      });
    });
  });
});
