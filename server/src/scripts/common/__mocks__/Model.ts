/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { type Document } from 'mongodb';

/** `src/common/Model` mock. */

export default class Model {
  protected defaultCollection = { fields: {} };

  public getCollection(collection: string): CollectionDataModel<Document> {
    if (collection === 'test') {
      return {
        enableDeletion: true,
        fields: {
          _id: { type: 'id', index: true },
          primitiveOne: { type: 'id' },
          primitiveTwo: { type: 'binary' },
          primitiveThree: { type: 'string' },
          arrayOne: {
            type: 'array',
            fields: {
              type: 'object',
              fields: {
                dynamicObject: {
                  type: 'dynamicObject',
                  fields: {
                    '^testOne$': {
                      type: 'id',
                      relation: 'externalRelation',
                    },
                    '^testTwo$': {
                      type: 'id',
                      relation: 'externalRelation',
                    },
                    '^special(.*)$': {
                      type: 'id',
                      relation: 'externalRelation',
                    },
                  },
                },
                object: {
                  type: 'object',
                  fields: {
                    fieldOne: { type: 'string' },
                  },
                },
              },
            },
          },
          arrayTwo: {
            type: 'array',
            fields: {
              type: 'id',
              relation: 'externalRelation',
            },
          },
          arrayThree: {
            type: 'array',
            fields: {
              type: 'id',
              relation: 'otherExternalRelation',
            },
          },
          arrayFour: {
            type: 'array',
            fields: {
              type: 'string',
            },
          },
          arrayFive: {
            type: 'array',
            fields: {
              type: 'object',
              fields: {
                fieldOne: { type: 'string' },
              },
            },
          },
          dynamicOne: {
            type: 'dynamicObject',
            fields: {
              '^testOne$': {
                type: 'id',
                relation: 'externalRelation',
              },
              '^testTwo$': {
                type: 'id',
                relation: 'otherExternalRelation',
              },
              '^testThree$': {
                type: 'object',
                fields: {
                  test: { type: 'string' },
                },
              },
              '^special(.*)$': {
                type: 'id',
                relation: 'externalRelation',
              },
            },
          },
          dynamicTwo: {
            type: 'dynamicObject',
            fields: {
              '^testOne$': {
                type: 'id',
                relation: 'externalRelation',
              },
              '^testTwo$': {
                type: 'object',
                fields: {
                  test: { type: 'string' },
                },
              },
            },
          },
        },
      };
    }
    if (collection === 'externalRelation') {
      return {
        enableDeletion: false,
        fields: {
          _id: { type: 'id', index: true },
          name: { type: 'string' },
          _isDeleted: { type: 'boolean' },
          relations: {
            type: 'array',
            fields: { type: 'id', relation: 'otherExternalRelation' },
          },
        },
      };
    }
    if (collection === 'otherExternalRelation') {
      return {
        enableDeletion: true,
        fields: {
          _id: { type: 'id' },
          type: { type: 'string' },
        },
      };
    }

    return this.defaultCollection;
  }
}
