/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Model from 'scripts/core/services/Model';
import schema, { type DataModel } from 'scripts/core/services/__mocks__/schema';

type TestModel = Model<DataModel> & {
  relationsPerResource: Model['relationsPerResource'];
};

describe('core/services/Model', () => {
  vi.mock('@perseid/core');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('[constructor]', () => {
    const otherModel = new Model<DataModel>(schema) as TestModel;
    expect(otherModel.relationsPerResource).toEqual({
      test: new Set(['test', 'otherTest']),
      otherTest: new Set(['test', 'otherTest']),
    });
  });

  test('[email]', () => {
    expect(Model.email()).toEqual({
      isRequired: true,
      type: 'string',
      maxLength: 320,
      errorMessages: {
        type: 'must be a valid email',
        pattern: 'must be a valid email',
      },
      pattern: /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    });
  });

  test('[tinyText]', () => {
    expect(Model.tinyText({ minLength: 2 })).toEqual({
      minLength: 2,
      maxLength: 50,
      isRequired: true,
      type: 'string',
    });
  });

  test('[shortText]', () => {
    expect(Model.shortText({ minLength: 2 })).toEqual({
      minLength: 2,
      maxLength: 100,
      isRequired: true,
      type: 'string',
    });
  });

  test('[mediumText]', () => {
    expect(Model.mediumText({ minLength: 2 })).toEqual({
      minLength: 2,
      maxLength: 500,
      isRequired: true,
      type: 'string',
    });
  });

  test('[longText]', () => {
    expect(Model.longText({ minLength: 2 })).toEqual({
      minLength: 2,
      maxLength: 2500,
      isRequired: true,
      type: 'string',
    });
  });

  test('[hugeText]', () => {
    expect(Model.hugeText({ minLength: 2 })).toEqual({
      minLength: 2,
      isRequired: true,
      type: 'string',
      maxLength: 10000,
    });
  });

  test('[token]', () => {
    expect(Model.token()).toEqual({
      isRequired: true,
      type: 'string',
      maxLength: 24,
      pattern: /^[0-9A-Za-z]{24}$/,
      errorMessages: {
        type: 'must be a valid token',
        pattern: 'must be a valid token',
      },
    });
  });

  test('[password]', () => {
    expect(Model.password()).toEqual({
      isRequired: true,
      type: 'string',
      maxLength: 500,
      pattern: /^(?=.*[A-Z])(?=.*[!@#$&*])(?=.*[0-9])(?=.*[a-z]).{8,}$/,
      errorMessages: {
        type: 'must be a valid password (8 chars minimum, containing lower case, upper case, number and special char)',
        pattern: 'must be a valid password (8 chars minimum, containing lower case, upper case, number and special char)',
      },
    });
  });

  test('[credentials]', () => {
    expect(Model.credentials()).toEqual({
      isRequired: true,
      type: 'object',
      fields: {
        deviceId: {
          isRequired: true,
          type: 'string',
          maxLength: 24,
          pattern: /^[0-9A-Za-z]{24}$/,
          errorMessages: {
            type: 'must be a valid token',
            pattern: 'must be a valid token',
          },
        },
        refreshToken: {
          isRequired: true,
          type: 'string',
          maxLength: 24,
          pattern: /^[0-9A-Za-z]{24}$/,
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
          isRequired: true,
        },
      },
    });
  });

  describe('[getPublicSchema]', () => {
    test('collection does not exist', () => {
      const otherModel = new Model<DataModel>(schema) as TestModel;
      expect(otherModel.getPublicSchema('unknown' as unknown as 'test')).toBeNull();
    });

    test('collection exists', () => {
      const otherModel = new Model(schema) as unknown as TestModel;
      expect(otherModel.getPublicSchema('test')).toEqual({
        otherTest: {
          type: 'object',
          fields: {
            _id: {
              isIndexed: true,
              isRequired: true,
              type: 'id',
            },
            _createdAt: {
              isIndexed: true,
              isRequired: true,
              type: 'date',
            },
            binary: {
              isIndexed: false,
              isRequired: true,
              type: 'binary',
            },
            optionalRelation: {
              type: 'id',
              isIndexed: true,
              relation: 'test',
            },
            data: {
              type: 'object',
              isRequired: true,
              fields: {
                optionalFlatArray: {
                  type: 'array',
                  fields: {
                    type: 'string',
                    isIndexed: true,
                    isRequired: true,
                    enum: ['test1', 'test2', 'test3', 'test4', 'test5'],
                  },
                },
                optionalRelation: {
                  type: 'id',
                  isIndexed: true,
                  relation: 'test',
                },
              },
            },
          },
        },
        test: {
          type: 'object',
          fields: {
            _id: {
              type: 'id',
              isIndexed: true,
              isRequired: true,
            },
            _isDeleted: {
              isIndexed: true,
              isRequired: true,
              type: 'boolean',
            },
            indexedString: {
              type: 'string',
              isIndexed: true,
              isRequired: true,
            },
            objectOne: {
              type: 'object',
              isRequired: true,
              fields: {
                boolean: {
                  isIndexed: false,
                  isRequired: true,
                  type: 'boolean',
                },
                objectTwo: {
                  type: 'object',
                  isRequired: true,
                  fields: {
                    optionalIndexedString: {
                      type: 'string',
                      isIndexed: true,
                    },
                    optionalNestedArray: {
                      type: 'array',
                      fields: {
                        type: 'object',
                        fields: {
                          data: {
                            type: 'object',
                            isRequired: true,
                            fields: {
                              flatArray: {
                                type: 'array',
                                isRequired: true,
                                fields: {
                                  type: 'string',
                                  isIndexed: true,
                                },
                              },
                              nestedArray: {
                                fields: {
                                  fields: {
                                    key: {
                                      isIndexed: false,
                                      isRequired: true,
                                      type: 'string',
                                    },
                                    optionalRelation: {
                                      isIndexed: false,
                                      relation: 'otherTest',
                                      type: 'id',
                                    },
                                  },
                                  isRequired: true,
                                  type: 'object',
                                },
                                isRequired: true,
                                type: 'array',
                              },
                              optionalInteger: {
                                type: 'integer',
                                isIndexed: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                optionalRelations: {
                  type: 'array',
                  fields: {
                    type: 'id',
                    isIndexed: true,
                    relation: 'otherTest',
                  },
                },
              },
            },
          },
        },
      });
    });
  });
});
