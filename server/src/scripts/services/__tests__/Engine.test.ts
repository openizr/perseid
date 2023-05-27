/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Model from 'scripts/common/Model';
import Logger from 'scripts/services/Logger';
import { type Id } from '@perseid/core';
import Engine from 'scripts/services/Engine';
import CacheClient from 'scripts/services/CacheClient';
import DatabaseClient from 'scripts/services/DatabaseClient';

type TestEngine = Engine<{ test: unknown; }> & { deepMerge: Engine['deepMerge']; };

interface DataModel {
  test: {
    primitiveOne: Id;
    primitiveTwo: ArrayBuffer;
    primitiveThree: string;
    arrayOne: {
      dynamicObject: {
        [key: string]: Id | DataModel['externalRelation'];
      };
      object: {
        fieldOne: string;
      }
    }[];
    arrayTwo: (Id | null | DataModel['externalRelation'])[];
    arrayThree: (Id | DataModel['externalRelation'])[];
    arrayFour: string[];
    arrayFive: {
      fieldOne: string;
    }[];
    dynamicOne: {
      [key: string]: Id | {
        test: string;
      } | DataModel['externalRelation'];
    };
    dynamicTwo: {
      [key: string]: Id | {
        test: string;
      };
    };
  };
  externalRelation: {
    _id: Id;
    name: string;
    relations: (Id | DataModel['otherExternalRelation']);
  };
  otherExternalRelation: {
    _id: Id;
    type: string;
  };
}

describe('services/Engine', () => {
  vi.mock('stream');
  vi.mock('scripts/common/Model');
  vi.mock('scripts/services/Logger');
  vi.mock('scripts/services/CacheClient');
  vi.mock('scripts/services/DatabaseClient');

  let engine: TestEngine;
  const model = new Model<{ test: unknown; }>({ types: {}, collections: {} });
  const logger = new Logger({ logLevel: 'info', prettyPrint: false });
  const databaseClient = new DatabaseClient<{ test: unknown; }>(model, logger, new CacheClient(), {
    cacheDuration: 0,
    connectionLimit: 0,
    connectTimeout: 0,
    database: '',
    host: '',
    maxPoolSize: 0,
    password: '',
    port: 0,
    protocol: '',
    queueLimit: 0,
    user: '',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new Engine<{ test: unknown; }>(model, logger, databaseClient) as TestEngine;
  });

  test('[deepMerge] primitive values', async () => {
    expect(engine.deepMerge('2', '3', { type: 'number' })).toEqual('3');
  });

  test('[deepMerge] nested objects', async () => {
    const dataModel: DynamicObjectDataModel<keyof DataModel> = {
      type: 'dynamicObject',
      fields: {
        '^key$': {
          type: 'object',
          fields: {
            subKeyOne: {
              type: 'string',
            },
            subKeyTwo: {
              type: 'string',
            },
          },
        },
        '^newKey$': {
          type: 'string',
        },
      },
    };

    const objectOne = {
      key: {
        subKeyOne: 'valueOne',
        subKeyTwo: 'valueTwo',
      },
    };

    const objectTwo = {
      key: { subKeyTwo: 'newValueTwo' },
      newKey: 'otherValue',
    };

    expect(engine.deepMerge(objectOne, objectTwo, dataModel)).toEqual({
      key: {
        subKeyOne: 'valueOne',
        subKeyTwo: 'newValueTwo',
      },
      newKey: 'otherValue',
    });
  });

  test.only('[deepMerge] nested arrays', async () => {
    const dataModel: ArrayDataModel<keyof DataModel> = {
      type: 'array',
      fields: {
        type: 'dynamicObject',
        fields: {
          '^key$': {
            type: 'object',
            fields: {
              subKeyOne: {
                type: 'string',
              },
              subKeyTwo: {
                type: 'string',
              },
            },
          },
          '^newKey$': {
            type: 'string',
          },
        },
      },
    };

    const arrayOne = [
      {
        key: {
          subKeyOne: 'valueOne',
          subKeyTwo: 'valueTwo',
        },
      },
      {
        key: {
          subKeyOne: 'valueOne',
          subKeyTwo: 'valueTwo',
        },
      },
      {
        key: {
          subKeyOne: 'valueOne',
          subKeyTwo: 'valueTwo',
        },
        newKey: 'otherValue',
      },
      {
        key: {
          subKeyOne: 'valueOne',
          subKeyTwo: 'valueTwo',
        },
        newKey: 'otherValueThree',
      },
    ];

    const arrayTwo = [
      null,
      {
        key: { subKeyTwo: 'newValueTwo' },
        newKey: 'newOtherValue',
      },
      {
        newKey: null,
      },
    ];

    expect(engine.deepMerge(arrayOne, arrayTwo, dataModel)).toEqual([
      {
        key: {
          subKeyOne: 'valueOne',
          subKeyTwo: 'newValueTwo',
        },
        newKey: 'newOtherValue',
      },
      {
        key: {
          subKeyOne: 'valueOne',
          subKeyTwo: 'valueTwo',
        },
      },
      {
        key: {
          subKeyOne: 'valueOne',
          subKeyTwo: 'valueTwo',
        },
        newKey: 'otherValueThree',
      },
    ]);
  });
});
