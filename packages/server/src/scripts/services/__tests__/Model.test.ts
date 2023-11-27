/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Model from 'scripts/services/Model';
import schema from 'scripts/services/__mocks__/schema';

type TestModel = Model<{
  test: {
    test: string;
  };
  testTwo: {
    test: string;
  };
}> & {
  relationsPerCollection: Model['relationsPerCollection'];
};

describe('services/Model', () => {
  vi.mock('@perseid/core');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('[constructor]', () => {
    const otherModel = new Model<unknown>(schema) as unknown as TestModel;
    expect(otherModel.relationsPerCollection).toEqual({
      test: new Set(['externalRelation', 'otherExternalRelation']),
      test2: new Set(['externalRelation', 'otherExternalRelation']),
      externalRelation: new Set(['otherExternalRelation']),
      otherExternalRelation: new Set(),
    });
  });

  test('[email]', () => {
    expect(Model.email()).toEqual({
      required: true,
      type: 'string',
      customType: 'email',
      errorMessages: {
        type: 'must be a valid email',
        pattern: 'must be a valid email',
      },
      pattern: '^(([^<>()[\\]\\\\.,;:\\s@"]+(\\.[^<>()[\\]\\\\.,;:\\s@"]+)*)|(".+"))@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\])|(([a-zA-Z\\-0-9]+\\.)+[a-zA-Z]{2,}))$',
    });
  });

  test('[tinyText]', () => {
    expect(Model.tinyText({ minLength: 2 })).toEqual({
      minLength: 2,
      maxLength: 50,
      required: true,
      type: 'string',
      customType: 'tinyText',
    });
  });

  test('[shortText]', () => {
    expect(Model.shortText({ minLength: 2 })).toEqual({
      minLength: 2,
      maxLength: 100,
      required: true,
      type: 'string',
      customType: 'shortText',
    });
  });

  test('[mediumText]', () => {
    expect(Model.mediumText({ minLength: 2 })).toEqual({
      minLength: 2,
      maxLength: 500,
      required: true,
      type: 'string',
      customType: 'mediumText',
    });
  });

  test('[longText]', () => {
    expect(Model.longText({ minLength: 2 })).toEqual({
      minLength: 2,
      maxLength: 2500,
      required: true,
      type: 'string',
      customType: 'longText',
    });
  });

  test('[hugeText]', () => {
    expect(Model.hugeText({ minLength: 2 })).toEqual({
      minLength: 2,
      required: true,
      type: 'string',
      maxLength: 10000,
      customType: 'hugeText',
    });
  });

  test('[token]', () => {
    expect(Model.token()).toEqual({
      required: true,
      type: 'string',
      customType: 'token',
      pattern: /^[0-9A-Za-z]{24}$/.source,
      errorMessages: {
        type: 'must be a valid token',
        pattern: 'must be a valid token',
      },
    });
  });

  test('[password]', () => {
    expect(Model.password()).toEqual({
      required: true,
      type: 'string',
      customType: 'password',
      pattern: /^(?=.*[A-Z])(?=.*[!@#$&*])(?=.*[0-9])(?=.*[a-z]).{8,}$/.source,
      errorMessages: {
        type: 'must be a valid password (8 chars minimum, containing lower case, upper case, number and special char)',
        pattern: 'must be a valid password (8 chars minimum, containing lower case, upper case, number and special char)',
      },
    });
  });

  test('[credentials]', () => {
    expect(Model.credentials()).toEqual({
      required: true,
      type: 'object',
      customType: 'credentials',
      fields: {
        deviceId: {
          required: true,
          type: 'string',
          customType: 'token',
          pattern: /^[0-9A-Za-z]{24}$/.source,
          errorMessages: {
            type: 'must be a valid token',
            pattern: 'must be a valid token',
          },
        },
        refreshToken: {
          required: true,
          type: 'string',
          customType: 'token',
          pattern: /^[0-9A-Za-z]{24}$/.source,
          errorMessages: {
            type: 'must be a valid token',
            pattern: 'must be a valid token',
          },
        },
        expiresIn: {
          type: 'integer',
          minimum: 0,
        },
        accessToken: {
          type: 'string',
          minLength: 10,
          maxLength: 500,
          required: true,
        },
      },
    });
  });

  test('[getPublicSchema] collection exists', () => {
    const otherModel = new Model<unknown>(schema) as unknown as TestModel;
    expect(otherModel.getPublicSchema('externalRelation' as unknown as 'test')).toEqual({
      externalRelation: {
        type: 'object',
        fields: {
          _createdAt: {
            type: 'date',
          },
          _createdBy: {
            type: 'id',
          },
          _id: {
            index: true,
            type: 'id',
          },
          _isDeleted: {
            type: 'boolean',
          },
          _updatedAt: {
            type: 'date',
          },
          _updatedBy: {
            type: 'id',
          },
          _version: {
            type: 'integer',
          },
          name: {
            type: 'string',
          },
          relations: {
            type: 'array',
            fields: {
              type: 'id',
              relation: 'otherExternalRelation',
            },
          },
        },
      },
      otherExternalRelation: {
        type: 'object',
        fields: {
          _id: { type: 'id', index: true, required: true },
          type: { type: 'string' },
          _version: { type: 'integer' },
        },
      },
    });
  });

  test('[getPublicSchema] collection does not exist', () => {
    const otherModel = new Model<unknown>(schema) as unknown as TestModel;
    expect(otherModel.getPublicSchema('unknown' as unknown as 'test')).toBeNull();
  });
});
