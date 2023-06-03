/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Model from 'scripts/common/Model';
import { type DataModel as DefaultTypes } from '@perseid/core';

describe('common/Model', () => {
  const model = new Model<DefaultTypes & {
    test: {
      test: string;
    };
    testTwo: {
      test: string;
    };
  }>({
    ...Model.DEFAULT_MODEL,
    test: {
      version: 1,
      enableAuthors: true,
      enableDeletion: false,
      enableTimestamps: true,
      fields: {
        test: { type: 'string' },
      },
    },
    testTwo: {
      fields: {
        test: { type: 'string' },
      },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('[email]', async () => {
    expect(Model.email()).toEqual({
      required: true,
      type: 'string',
      customType: 'email',
      errorMessages: {
        type: 'must be a valid email.',
        pattern: 'must be a valid email.',
      },
      pattern: '^(([^<>()[\\]\\\\.,;:\\s@"]+(\\.[^<>()[\\]\\\\.,;:\\s@"]+)*)|(".+"))@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\])|(([a-zA-Z\\-0-9]+\\.)+[a-zA-Z]{2,}))$',
    });
  });

  test('[tinyText]', async () => {
    expect(Model.tinyText(true, false, false, 2)).toEqual({
      index: false,
      minLength: 2,
      unique: false,
      maxLength: 50,
      required: true,
      type: 'string',
      customType: 'tinyText',
    });
  });

  test('[shortText]', async () => {
    expect(Model.shortText(true, false, false, 2)).toEqual({
      index: false,
      minLength: 2,
      unique: false,
      maxLength: 100,
      required: true,
      type: 'string',
      customType: 'shortText',
    });
  });

  test('[mediumText]', async () => {
    expect(Model.mediumText(true, false, false, 2)).toEqual({
      index: false,
      minLength: 2,
      unique: false,
      maxLength: 500,
      required: true,
      type: 'string',
      customType: 'mediumText',
    });
  });

  test('[longText]', async () => {
    expect(Model.longText(true, false, false, 2)).toEqual({
      index: false,
      minLength: 2,
      unique: false,
      maxLength: 2500,
      required: true,
      type: 'string',
      customType: 'longText',
    });
  });

  test('[hugeText]', async () => {
    expect(Model.hugeText(true, false, false, 2)).toEqual({
      index: false,
      minLength: 2,
      unique: false,
      required: true,
      type: 'string',
      maxLength: 10000,
      customType: 'hugeText',
    });
  });

  test('[token]', async () => {
    expect(Model.token()).toEqual({
      index: false,
      unique: false,
      required: true,
      type: 'string',
      customType: 'token',
      pattern: /^[0-9A-Za-z]{24}$/.source,
      errorMessages: {
        type: 'must be a valid token.',
        pattern: 'must be a valid token.',
      },
    });
  });

  test('[password]', async () => {
    expect(Model.password()).toEqual({
      required: true,
      type: 'string',
      customType: 'password',
      pattern: /^(?=.*[A-Z])(?=.*[!@#$&*])(?=.*[0-9])(?=.*[a-z]).{8,}$/.source,
      errorMessages: {
        type: 'must be a valid password (8 chars minimum, containing lower case, upper case, number and special char).',
        pattern: 'must be a valid password (8 chars minimum, containing lower case, upper case, number and special char).',
      },
    });
  });

  test('[credentials]', async () => {
    expect(Model.credentials()).toEqual({
      required: true,
      type: 'object',
      customType: 'credentials',
      fields: {
        deviceId: {
          index: false,
          unique: false,
          required: true,
          type: 'string',
          customType: 'token',
          pattern: /^[0-9A-Za-z]{24}$/.source,
          errorMessages: {
            type: 'must be a valid token.',
            pattern: 'must be a valid token.',
          },
        },
        refreshToken: {
          index: false,
          unique: false,
          required: true,
          type: 'string',
          customType: 'token',
          pattern: /^[0-9A-Za-z]{24}$/.source,
          errorMessages: {
            type: 'must be a valid token.',
            pattern: 'must be a valid token.',
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

  test('[getCollections]', async () => {
    expect(model.getCollections()).toEqual(['users', 'roles', 'test', 'testTwo']);
  });

  test('[getCollection]', async () => {
    expect(model.getCollection('test')).toEqual({
      version: 1,
      enableAuthors: true,
      enableDeletion: false,
      enableTimestamps: true,
      fields: {
        _id: { type: 'id', index: true, required: true },
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
        test: { type: 'string' },
      },
    });
  });
});
