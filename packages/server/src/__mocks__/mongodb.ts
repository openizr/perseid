/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `mongodb` mock.
 */

export class Binary {
  public buffer = { length: 10 };
}
let count = 0;
export class ObjectId {
  protected value: string;

  constructor(value?: string) {
    if (value !== undefined) {
      this.value = value;
    } else {
      count += 1;
      this.value = String(count).padStart(24, '0');
    }
  }

  public toString(): string {
    return this.value;
  }
}
const methodsPerCollection: Record<string, unknown> = {};

const collection = vi.fn((name: string) => {
  methodsPerCollection[name] ??= {
    dropIndexes: vi.fn(),
    insertOne: vi.fn(() => {
      if (process.env.DATABASE_ERROR === 'true') {
        throw new Error('ERROR');
      }
      return { insertedCount: 1 };
    }),
    createIndexes: vi.fn(),
    find: vi.fn(() => ({
      toArray: vi.fn(() => [{ _id: new ObjectId('000000000000000000000001') }]),
    })),
    deleteOne: vi.fn(() => {
      if (process.env.DATABASE_ERROR === 'true') {
        throw new Error('ERROR');
      }
      return ((process.env.NO_RESULT === 'true')
        ? { deletedCount: 0 }
        : { deletedCount: 1 }
      );
    }),
    updateOne: vi.fn(() => {
      if (process.env.DATABASE_ERROR === 'true') {
        throw new Error('ERROR');
      }
      return ((process.env.NO_RESULT === 'true')
        ? { matchedCount: 0 }
        : { matchedCount: 1 }
      );
    }),
    findOneAndUpdate: vi.fn(() => ((process.env.NO_RESULT === 'true')
      ? null
      : { _id: new ObjectId('000000000000000000000001') }
    )),
    aggregate: vi.fn(() => {
      if (process.env.DATABASE_ERROR === 'true') {
        throw new Error('ERROR');
      }
      return {
        toArray: vi.fn(() => {
          if (name === '_config') {
            if (process.env.REFERENCES_MODE === 'true') {
              return (process.env.REFERENCE_EXISTS === 'true')
                ? [{
                  _id: new ObjectId('646b9be5e921d0ef42f88888'),
                  test__data_optionalRelation: [new ObjectId('646b9be5e921d0ef42f88887')],
                }]
                : [{
                  _id: new ObjectId('646b9be5e921d0ef42f88888'),
                  test__data_optionalRelation: [],
                }];
            }
            return (process.env.MISSING_FOREIGN_IDS === 'true')
              ? [
                {
                  _id: new ObjectId('000000000000000000000008'),
                  optionalRelation: [{ _id: new ObjectId('000000000000000000000001') }],
                  'data.optionalRelation': [{ _id: new ObjectId('000000000000000000000001') }],
                },
              ]
              : [
                {
                  _id: new ObjectId('000000000000000000000008'),
                  optionalRelation: [{ _id: new ObjectId('000000000000000000000002') }],
                  'data.optionalRelation': [
                    { _id: new ObjectId('000000000000000000000001') },
                    { _id: new ObjectId('000000000000000000000002') },
                  ],
                },
              ];
          }
          return [{
            total: (process.env.NO_RESULT === 'true') ? [] : [{ total: 1 }],
            results: (process.env.NO_RESULT === 'true') ? [] : [{
              _id: new ObjectId('000000000000000000000001'),
              test: 1,
            }],
          }];
        }),
      };
    }),
  };
  return methodsPerCollection[name];
});

export class MongoServerError {
  public code: number;

  public message: string;

  constructor(description: { message: string; }, code: number) {
    this.code = code;
    this.message = description.message;
  }
}

const connect = vi.fn();
const command = vi.fn();
const dropDatabase = vi.fn();
const dropCollection = vi.fn();
const createCollection = vi.fn();
const session = {
  endSession: vi.fn(),
  startTransaction: vi.fn(),
  abortTransaction: vi.fn(),
  commitTransaction: vi.fn(),
};
const startSession = vi.fn(() => session);
const listCollections = vi.fn(() => ({ toArray: vi.fn(() => ['test']) }));
const db = vi.fn(() => ({
  connect,
  command,
  collection,
  dropDatabase,
  dropCollection,
  listCollections,
  createCollection,
}));

export class MongoClient {
  public db = db;

  public connect = connect;

  public startSession = startSession;
}
