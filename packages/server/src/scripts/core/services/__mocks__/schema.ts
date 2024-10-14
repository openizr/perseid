/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Id,
  type Ids,
  type Authors,
  type Version,
  type Deletion,
  type Timestamps,
  type DataModelSchema,
  type DefaultDataModel,
} from '@perseid/core';

export interface DataModel extends DefaultDataModel {
  test: Ids & Deletion & Version & Authors & Timestamps & {
    indexedString: string;
    objectOne: {
      boolean: boolean;
      optionalRelations: (Id | DataModel['otherTest'] | null)[] | null;
      objectTwo: {
        optionalIndexedString: string | null;
        optionalNestedArray: ({
          data: {
            optionalInteger: number | null;
            flatArray: (string | null)[];
            nestedArray: {
              optionalRelation: Id | DataModel['otherTest'] | null;
              key: string;
            }[];
          };
        } | null)[] | null;
      };
    };
  };
  otherTest: Ids & {
    _createdAt: Date;
    binary: ArrayBuffer;
    enum: 'ONE' | 'TWO' | 'THREE';
    optionalRelation: Id | DataModel['test'] | null;
    data: {
      optionalRelation: Id | DataModel['test'] | null;
      optionalFlatArray: string[] | null;
    };
  };
}

export default {
  test: {
    version: 1,
    enableDeletion: false,
    enableAuthors: true,
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
      indexedString: {
        type: 'string',
        isIndexed: true,
        isRequired: true,
      },
      objectOne: {
        type: 'object',
        isRequired: true,
        errorMessages: {
          type: 'test',
        },
        fields: {
          boolean: {
            type: 'boolean',
            isRequired: true,
          },
          optionalRelations: {
            type: 'array',
            fields: {
              type: 'id',
              isIndexed: true,
              relation: 'otherTest',
            },
          },
          objectTwo: {
            type: 'object',
            isRequired: true,
            fields: {
              optionalIndexedString: {
                type: 'string',
                isUnique: true,
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
                        optionalInteger: {
                          type: 'integer',
                          isIndexed: true,
                        },
                        flatArray: {
                          type: 'array',
                          isRequired: true,
                          fields: {
                            type: 'string',
                            isIndexed: true,
                          },
                        },
                        nestedArray: {
                          type: 'array',
                          isRequired: true,
                          fields: {
                            type: 'object',
                            isRequired: true,
                            fields: {
                              optionalRelation: {
                                type: 'id',
                                relation: 'otherTest',
                              },
                              key: {
                                type: 'string',
                                isRequired: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  otherTest: {
    enableDeletion: true,
    fields: {
      _id: {
        type: 'id',
        isUnique: true,
        isRequired: true,
      },
      _createdAt: {
        type: 'date',
        isIndexed: true,
        isRequired: true,
      },
      binary: {
        type: 'binary',
        isRequired: true,
      },
      optionalRelation: {
        type: 'id',
        isIndexed: true,
        relation: 'test',
      },
      enum: {
        type: 'string',
        isRequired: true,
        enum: ['ONE', 'TWO', 'THREE'],
      },
      data: {
        type: 'object',
        isRequired: true,
        fields: {
          optionalRelation: {
            type: 'id',
            isIndexed: true,
            relation: 'test',
          },
          optionalFlatArray: {
            type: 'array',
            fields: {
              type: 'string',
              isUnique: true,
              isRequired: true,
              enum: ['test1', 'test2', 'test3', 'test4', 'test5'],
            },
          },
        },
      },
    },
  },
} as unknown as DataModelSchema<DataModel>;
