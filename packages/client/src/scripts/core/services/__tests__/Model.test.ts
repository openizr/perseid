/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Id, type IdSchema } from '@perseid/core';
import Model from 'scripts/core/services/Model';

type TestModel = Model & {
  schema: Model['schema'];
};

describe('core/services/Model', () => {
  vi.mock('@perseid/core');

  let model: TestModel;

  beforeEach(() => {
    vi.clearAllMocks();
    model = new Model() as TestModel;
  });

  test('[update]', () => {
    model.update({
      users: {
        fields: {
          test: {
            type: 'string',
            pattern: {
              source: 'test',
              flags: 'ig',
            } as unknown as RegExp,
          },
          date: {
            type: 'date',
            enum: ['2023-01-01T00:00:00.000Z' as unknown as Date],
          },
          id: {
            type: 'id',
            enum: ['000000000000000000000001' as unknown as Id],
          },
          array: {
            type: 'array',
            fields: {
              type: 'object',
              fields: {
                test: { type: 'string' },
              },
            },
          },
        },
      },
    });
    expect(model.schema).toEqual({
      users: {
        fields: {
          test: {
            type: 'string',
            pattern: /test/ig,
          },
          date: {
            type: 'date',
            enum: [new Date('2023-01-01T00:00:00.000Z')],
          },
          id: {
            type: 'id',
            enum: [expect.any(Id)],
          },
          array: {
            type: 'array',
            fields: {
              type: 'object',
              fields: {
                test: { type: 'string' },
              },
            },
          },
        },
      },
    });
    expect((model.schema.users.fields.id as IdSchema<DataModel>).enum?.[0].toString()).toEqual('000000000000000000000001');
  });
});
