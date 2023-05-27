/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/* eslint-disable max-classes-per-file */

import { Document } from 'mongodb';

/**
 * mongodb mock.
 */

export class Binary {
  public buffer = { length: 10 };
}
export const ObjectId = String;

const methodsPerCollection: Record<string, unknown> = {};

const collection = vi.fn((name) => {
  methodsPerCollection[name] ??= {
    deleteOne: vi.fn(() => ((process.env.NO_RESULT === 'true')
      ? { deletedCount: 0 }
      : { deletedCount: 1 }
    )),
    insertOne: vi.fn(),
    updateOne: vi.fn(() => ((process.env.NO_RESULT === 'true')
      ? { matchedCount: 0 }
      : { matchedCount: 1 }
    )),
    findOneAndUpdate: vi.fn(() => ((process.env.NO_RESULT === 'true')
      ? { value: null }
      : { _id: new ObjectId('64723318e84f943f1ad6578b') }
    )),
    aggregate: vi.fn(() => ({
      toArray: vi.fn(() => {
        if (name === '_config') {
          return (process.env.MISSING_FOREIGN_KEYS === 'true')
            ? [
              {
                _id: new ObjectId('646b9be5e921d0ef42f88888'),
                externalRelation: [],
              },
            ]
            : [
              {
                _id: new ObjectId('646b9be5e921d0ef42f88888'),
                externalRelation: [
                  { _id: ObjectId('646b9be5e921d0ef42f8a147') },
                  { _id: ObjectId('646b9be5e921d0ef42f8a142') },
                  { _id: ObjectId('646b9be5e921d0ef42f8a143') },
                  { _id: ObjectId('646b9be5e921d0ef42f8a141') },
                  { _id: ObjectId('646b9be5e921d0ef42f8a146') },
                ],
              },
            ];
        }
        if (process.env.VIEW_MODE === 'true') {
          return (process.env.NO_RESULT === 'true')
            ? []
            : [{
              _id: new ObjectId('64723318e84f943f1ad6578b'),
              test: 1,
            }];
        }
        return [{
          total: (process.env.NO_RESULT === 'true') ? [] : [{ total: 1 }],
          results: (process.env.NO_RESULT === 'true') ? [] : [{
            _id: new ObjectId('64723318e84f943f1ad6578b'),
            test: 1,
          }],
        }];
      }),
    })),
  };
  return methodsPerCollection[name];
});

export class MongoServerError {
  public code: number;

  public keyValue: Document;

  constructor(code: number) {
    this.code = code;
    this.keyValue = {
      _id: 'test',
    };
  }
}

const connect = vi.fn();

const db = vi.fn(() => ((process.env.NO_DATABASE === 'true') ? null : ({
  connect,
  collection,
})));

export class MongoClient {
  public db = db;

  public connect = connect;
}
