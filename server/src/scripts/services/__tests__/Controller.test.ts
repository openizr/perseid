/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import jwt from 'jsonwebtoken';
import Model from 'scripts/services/Model';
import Logger from 'scripts/services/Logger';
import { Id, type User } from '@perseid/core';
import Conflict from 'scripts/errors/Conflict';
import EngineError from 'scripts/errors/Engine';
import Forbidden from 'scripts/errors/Forbidden';
import BadRequest from 'scripts/errors/BadRequest';
import DatabaseError from 'scripts/errors/Database';
import Controller from 'scripts/services/Controller';
import Unauthorized from 'scripts/errors/Unauthorized';
import OAuthEngine from 'scripts/services/OAuthEngine';
import EmailClient from 'scripts/services/EmailClient';
import CacheClient from 'scripts/services/CacheClient';
import NotAcceptable from 'scripts/errors/NotAcceptable';
import DatabaseClient from 'scripts/services/DatabaseClient';
import { type DataModel } from 'scripts/services/__mocks__/schema';

type TestController = Controller<DataModel> & {
  rbac: Controller['rbac'];
  parseQuery: Controller['parseQuery'];
  catchErrors: Controller['catchErrors'];
  toSnakeCase: Controller['toSnakeCase'];
  formatOutput: Controller['formatOutput'];
  generateFieldsFrom: Controller['generateFieldsFrom'];
  formatSearchFilters: Controller['formatSearchFilters'];
};

describe('services/Controller', () => {
  vi.mock('jsonwebtoken');
  vi.mock('@perseid/core');
  vi.mock('scripts/services/Model');
  vi.mock('scripts/services/Logger');
  vi.mock('scripts/services/OAuthEngine');
  vi.mock('scripts/services/CacheClient');
  vi.mock('scripts/services/EmailClient');
  vi.mock('scripts/services/DatabaseClient');
  vi.setSystemTime(new Date('2023-01-01'));

  const logger = new Logger({ logLevel: 'info', prettyPrint: false });
  const emailClient = new EmailClient(logger);
  const cacheClient = new CacheClient({ cachePath: '/var/www/html/node_modules/.cache' });
  const model = new Model<DataModel>({} as Record<keyof DataModel, CollectionDataModel<DataModel>>);
  const databaseClient = new DatabaseClient<DataModel>(model, logger, cacheClient, {
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
  const engine = new OAuthEngine<DataModel>(
    model,
    logger,
    databaseClient,
    emailClient,
    cacheClient,
    {
      baseUrl: '',
      oAuth: {
        algorithm: 'RS256',
        clientId: '',
        issuer: '',
        privateKey: '',
        publicKey: '',
      },
    },
  );
  let controller: TestController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new Controller<DataModel>(model, logger, engine, {
      version: '0.0.1',
      endpoints: {
        oAuth: {},
        collections: {},
      },
    }) as TestController;
  });

  test('[formatOutput]', () => {
    vi.useRealTimers();
    expect(controller.formatOutput({
      array: [],
      object: {},
      id: new Id('64723318e84f943f1ad6578b'),
      date: new Date('2023-01-01T00:00:00.000Z'),
      other: 'test',
      binary: new ArrayBuffer(0),
    })).toEqual({
      array: [],
      object: {},
      id: '64723318e84f943f1ad6578b',
      date: '2023-01-01T00:00:00.000Z',
      other: 'test',
      binary: '',
    });
  });

  test('[generateFieldsFrom]', () => {
    expect(controller.toSnakeCase('relation')).toBe('RELATION');
    expect(controller.toSnakeCase('externalRelation')).toBe('EXTERNAL_RELATION');
  });

  test('[generateFieldsFrom]', () => {
    const permissions = new Set();
    expect(controller.generateFieldsFrom('test', [
      '*',
      'invalid',
      'primitiveOne',
      'primitiveOne',
      'primitiveTwo',
      'arrayOne.object.*',
      'arrayOne.*',
      'dynamicOne.testThree.test',
      'arrayTwo._id',
      'arrayFour',
      'dynamicOne.*',
      'dynamicOne.testTwo.type',
      'dynamicOne.testOne.relations._id',
      'arrayOne.dynamicObject.testOne._id',
      'arrayOne.dynamicObject.testOne.*',
      'dynamicOne.testOne.name',
      'dynamicOne.testTwo._id',
      'dynamicOne.testOne.relations.type',
      'dynamicOne.specialTest',
      'dynamicOne.specialTestTwo.name',
      'dynamicOne.specialTestThree',
      'dynamicTwo',
      'dynamicOne.specialTestTwo',
      'arrayOne.object',
      'dynamicOne.testOne.relations',
    ].join(','), permissions)).toEqual([
      '_id',
      'primitiveOne',
      'primitiveTwo',
      'primitiveThree',
      'arrayOne',
      'arrayTwo',
      'arrayThree',
      'arrayFour',
      'arrayFive',
      'dynamicOne',
      'dynamicTwo',
      'invalid',
      'arrayOne.object.fieldOne',
      'arrayOne.dynamicObject',
      'arrayOne.object',
      'dynamicOne.testThree.test',
      'arrayTwo._id',
      'dynamicOne.testTwo.type',
      'dynamicOne.testOne.relations._id',
      'arrayOne.dynamicObject.testOne._id',
      'arrayOne.dynamicObject.testOne.name',
      'arrayOne.dynamicObject.testOne._isDeleted',
      'arrayOne.dynamicObject.testOne.relations',
      'dynamicOne.testOne.name',
      'dynamicOne.testTwo._id',
      'dynamicOne.testOne.relations.type',
      'dynamicOne.specialTest',
      'dynamicOne.specialTestTwo.name',
      'dynamicOne.specialTestThree',
      'dynamicOne.specialTestTwo',
      'dynamicOne.testOne.relations',
    ]);
    expect([...permissions]).toEqual([
      'TEST_VIEW',
      'PRIMITIVE_THREE_VIEW',
      'ARRAY_ONE_VIEW',
      'ARRAY_ONE_OBJECT_VIEW',
      'ARRAY_ONE_OBJECT_FIELD_ONE_VIEW',
      'EXTERNAL_RELATION_VIEW',
      'OTHER_EXTERNAL_RELATION_VIEW',
    ]);
  });

  test('[formatSearchFilters]', () => {
    const permissions = new Set();
    expect(controller.formatSearchFilters('test2', {
      _id: '646b9be5e921d0ef42f8a147',
      float: ['1.3'],
      array: ['test'],
      date: '2023-01-01',
      integer: ['1', '2', '3'],
      relation: '646b9be5e921d0ef42f8a147',
      'relation._id': '646b9be5e921d0ef42f8a147',
      'dynamicObject.test': 'test',
      'dynamicOne.testOne.name': 'test',
    }, permissions)).toEqual({
      _id: new Id('646b9be5e921d0ef42f8a147'),
      float: 1.3,
      array: 'test',
      integer: [1, 2, 3],
      date: new Date('2023-01-01'),
      'dynamicObject.test': 'test',
      'dynamicOne.testOne.name': 'test',
      relation: new Id('646b9be5e921d0ef42f8a147'),
      'relation._id': new Id('646b9be5e921d0ef42f8a147'),
    });
    expect([...permissions]).toEqual(['ARRAY_VIEW', 'INTEGER_VIEW', 'EXTERNAL_RELATION_VIEW']);
  });

  test('[parseQuery] no sortOrder', () => {
    const permissions = new Set();
    expect(controller.parseQuery('test2', {
      sortBy: '_id',
    }, permissions)).toEqual({
      sortBy: ['_id'],
      sortOrder: [],
    });
    expect([...permissions]).toEqual(['TEST2_VIEW']);
  });

  test('[parseQuery] with sortOrder', () => {
    const permissions = new Set();
    expect(controller.parseQuery('test2', {
      fields: 'array',
      sortBy: '_id',
      sortOrder: '-1',
      other: 'test',
    }, permissions)).toEqual({
      fields: ['array'],
      sortBy: ['_id'],
      sortOrder: [-1],
      other: 'test',
    });
    expect([...permissions]).toEqual(['TEST2_VIEW', 'ARRAY_VIEW']);
  });

  test('[parseSearchBody] no search query nor filters', () => {
    const permissions = new Set();
    expect(controller.parseSearchBody('test2', {}, permissions)).toEqual({});
    expect([...permissions]).toEqual([]);
  });

  test('[parseSearchBody] search query and filters', () => {
    const permissions = new Set();
    expect(controller.parseSearchBody('test2', {
      query: {
        on: ['array'],
        text: 'test',
      },
      filters: {},
    }, permissions)).toEqual({
      query: {
        on: ['array'],
        text: 'test',
      },
      filters: {},
    });
    expect([...permissions]).toEqual(['TEST2_VIEW', 'ARRAY_VIEW']);
  });

  test('[catchErrors] TOKEN_EXPIRED', () => {
    expect(async () => {
      await controller.catchErrors(() => {
        throw new jwt.TokenExpiredError('', new Date());
      });
    }).rejects.toThrow(new Unauthorized('TOKEN_EXPIRED', 'Access token has expired.'));
  });

  test('[catchErrors] INVALID_TOKEN', () => {
    expect(async () => {
      await controller.catchErrors(() => {
        throw new jwt.JsonWebTokenError('');
      });
    }).rejects.toThrow(new Unauthorized('INVALID_TOKEN', 'Invalid access token.'));
  });

  test('[catchErrors] INVALID_DEVICE_ID', () => {
    expect(async () => {
      await controller.catchErrors(() => {
        throw new EngineError('INVALID_DEVICE_ID');
      });
    }).rejects.toThrow(new Unauthorized('INVALID_DEVICE_ID', 'Invalid device id.'));
  });

  test('[catchErrors] NO_RESOURCE', () => {
    expect(async () => {
      await controller.catchErrors(() => {
        throw new EngineError('NO_RESOURCE', { id: 'test' });
      });
    }).rejects.toThrow(new Unauthorized('NO_RESOURCE', 'Resource with id "test" does not exist or has been deleted.'));
  });

  test('[catchErrors] NO_RESOURCE', () => {
    expect(async () => {
      await controller.catchErrors(() => {
        throw new DatabaseError('NO_RESOURCE', { id: 'test' });
      });
    }).rejects.toThrow(new Unauthorized('NO_RESOURCE', 'Resource with id "test" does not exist or does not match required criteria.'));
  });

  test('[catchErrors] DUPLICATE_RESOURCE', () => {
    expect(async () => {
      await controller.catchErrors(() => {
        throw new DatabaseError('DUPLICATE_RESOURCE', { field: 'test', value: 'value' });
      });
    }).rejects.toThrow(new Conflict('RESOURCE_EXISTS', 'Resource with field "test" set to "value" already exists.'));
  });

  test('[catchErrors] NO_USER', () => {
    expect(async () => {
      await controller.catchErrors(() => {
        throw new EngineError('NO_USER');
      });
    }).rejects.toThrow(new Unauthorized('NO_USER', 'Invalid credentials.'));
  });

  test('[catchErrors] INVALID_CREDENTIALS', () => {
    expect(async () => {
      await controller.catchErrors(() => {
        throw new EngineError('INVALID_CREDENTIALS');
      });
    }).rejects.toThrow(new Unauthorized('INVALID_CREDENTIALS', 'Invalid credentials.'));
  });

  test('[catchErrors] INVALID_VERIFICATION_TOKEN', () => {
    expect(async () => {
      await controller.catchErrors(() => {
        throw new EngineError('INVALID_VERIFICATION_TOKEN');
      });
    }).rejects.toThrow(new Unauthorized('INVALID_VERIFICATION_TOKEN', 'Invalid or expired verification token.'));
  });

  test('[catchErrors] INVALID_RESET_TOKEN', () => {
    expect(async () => {
      await controller.catchErrors(() => {
        throw new EngineError('INVALID_RESET_TOKEN');
      });
    }).rejects.toThrow(new Unauthorized('INVALID_RESET_TOKEN', 'Invalid or expired reset token.'));
  });

  test('[catchErrors] INVALID_REFRESH_TOKEN', () => {
    expect(async () => {
      await controller.catchErrors(() => {
        throw new EngineError('INVALID_REFRESH_TOKEN');
      });
    }).rejects.toThrow(new Unauthorized('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.'));
  });

  test('[catchErrors] PASSWORDS_MISMATCH', () => {
    expect(async () => {
      await controller.catchErrors(() => {
        throw new EngineError('PASSWORDS_MISMATCH');
      });
    }).rejects.toThrow(new BadRequest('PASSWORDS_MISMATCH', 'Passwords mismatch.'));
  });

  test('[catchErrors] EMAIL_ALREADY_VERIFIED', () => {
    expect(async () => {
      await controller.catchErrors(() => {
        throw new EngineError('EMAIL_ALREADY_VERIFIED');
      });
    }).rejects.toThrow(new NotAcceptable('EMAIL_ALREADY_VERIFIED', 'User email is already verified.'));
  });

  test('[catchErrors] INVALID_FIELD', () => {
    expect(async () => {
      await controller.catchErrors(() => {
        throw new DatabaseError('INVALID_FIELD', { path: 'path' });
      });
    }).rejects.toThrow(new BadRequest('INVALID_FIELD', 'Requested field "path" does not exist.'));
  });

  test('[catchErrors] INVALID_INDEX', () => {
    expect(async () => {
      await controller.catchErrors(() => {
        throw new DatabaseError('INVALID_INDEX', { path: 'path' });
      });
    }).rejects.toThrow(new BadRequest('INVALID_INDEX', 'Requested field "path" is not indexed.'));
  });

  test('[catchErrors] RESOURCE_REFERENCED', () => {
    expect(async () => {
      await controller.catchErrors(() => {
        throw new DatabaseError('RESOURCE_REFERENCED', { collection: 'collection' });
      });
    }).rejects.toThrow(new BadRequest('RESOURCE_REFERENCED', 'Resource is still referenced in collection "collection".'));
  });

  test('[catchErrors] MAXIMUM_DEPTH_EXCEEDED', () => {
    expect(async () => {
      await controller.catchErrors(() => {
        throw new DatabaseError('MAXIMUM_DEPTH_EXCEEDED', { path: 'path' });
      });
    }).rejects.toThrow(new BadRequest('MAXIMUM_DEPTH_EXCEEDED', 'Maximum level of depth exceeded for field "path".'));
  });

  test('[catchErrors] other error', () => {
    expect(async () => {
      await controller.catchErrors(() => {
        throw new Error('test');
      });
    }).rejects.toThrow(new Error('test'));
  });

  test('[rbac] user is not verified', () => {
    expect(() => {
      controller.rbac({ _verifiedAt: null } as User, ['TEST']);
    }).toThrow(new Forbidden('NOT_VERIFIED', 'Please verify your email address before performing this operation.'));
  });

  test('[rbac] user is verified, missing permission', () => {
    expect(() => {
      controller.rbac({ _verifiedAt: new Date('2023-01-01'), _permissions: {} } as User, ['TEST']);
    }).toThrow(new Forbidden('FORBIDDEN', 'You are missing "TEST" permission to perform this operation.'));
  });

  test('[rbac] user is verified, no missing permission', () => {
    controller.rbac({
      _verifiedAt: new Date('2023-01-01'),
      _permissions: { TEST: true },
    } as unknown as User, ['TEST']);
  });
});
