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
import Conflict from 'scripts/errors/Conflict';
import EngineError from 'scripts/errors/Engine';
import Forbidden from 'scripts/errors/Forbidden';
import BadRequest from 'scripts/errors/BadRequest';
import DatabaseError from 'scripts/errors/Database';
import Controller from 'scripts/services/Controller';
import Unauthorized from 'scripts/errors/Unauthorized';
import UsersEngine from 'scripts/services/UsersEngine';
import EmailClient from 'scripts/services/EmailClient';
import CacheClient from 'scripts/services/CacheClient';
import NotAcceptable from 'scripts/errors/NotAcceptable';
import DatabaseClient from 'scripts/services/DatabaseClient';
import { type DataModel } from 'scripts/services/__mocks__/schema';
import { type CollectionSchema, Id, type User } from '@perseid/core';

type TestController = Controller<DataModel> & {
  rbac: Controller['rbac'];
  parseQuery: Controller['parseQuery'];
  catchErrors: Controller['catchErrors'];
  formatOutput: Controller['formatOutput'];
  parseSearchBody: Controller['parseSearchBody'];
  isAllowedToFetch: Controller['isAllowedToFetch'];
  generateFieldsTreeFrom: Controller['generateFieldsTreeFrom'];
};

describe('services/Controller', () => {
  vi.mock('jsonwebtoken');
  vi.mock('@perseid/core');
  vi.mock('scripts/services/Model');
  vi.mock('scripts/services/Logger');
  vi.mock('scripts/services/UsersEngine');
  vi.mock('scripts/services/CacheClient');
  vi.mock('scripts/services/EmailClient');
  vi.mock('scripts/services/DatabaseClient');
  vi.setSystemTime(new Date('2023-01-01'));

  const logger = new Logger({ logLevel: 'info', prettyPrint: false });
  const emailClient = new EmailClient(logger);
  const cacheClient = new CacheClient({ cachePath: '/var/www/html/node_modules/.cache' });
  const model = new Model<DataModel>({} as Record<keyof DataModel, CollectionSchema<DataModel>>);
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
  const engine = new UsersEngine<DataModel>(
    model,
    logger,
    databaseClient,
    emailClient,
    cacheClient,
    {
      baseUrl: '',
      auth: {
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
        auth: {},
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

  test('[generateFieldsTreeFrom] invalid field', () => {
    expect(() => {
      controller.generateFieldsTreeFrom('test', ['invalid']);
    }).toThrow(new BadRequest('INVALID_FIELD', 'Requested field "invalid" does not exist.'));
    expect(() => {
      controller.generateFieldsTreeFrom('test', ['invalid.*']);
    }).toThrow(new BadRequest('INVALID_FIELD', 'Requested field "invalid.*" does not exist.'));
  });

  test('[generateFieldsTreeFrom] valid fields', () => {
    expect(controller.generateFieldsTreeFrom('test2', ['relation', 'relation.*'])).toEqual({
      requestedCollections: new Set(['test2.relation', 'test2']),
      requestedFieldsTree: {
        'test2._id': new Set(['relation._id']),
        'test2.array': new Set(['relation.array']),
        'test2.arrayTwo': new Set(['relation.arrayTwo']),
        'test2.binary': new Set(['relation.binary']),
        'test2.boolean': new Set(['relation.boolean']),
        'test2.booleanTwo': new Set(['relation.booleanTwo']),
        'test2.date': new Set(['relation.date']),
        'test2.dateTwo': new Set(['relation.dateTwo']),
        'test2.enum': new Set(['relation.enum']),
        'test2.float': new Set(['relation.float']),
        'test2.floatTwo': new Set(['relation.floatTwo']),
        'test2.id': new Set(['relation.id']),
        'test2.idTwo': new Set(['relation.idTwo']),
        'test2.integer': new Set(['relation.integer']),
        'test2.integerTwo': new Set(['relation.integerTwo']),
        'test2.null': new Set(['relation.null']),
        'test2.relation': new Set(['relation']),
        'test2.string': new Set(['relation.string']),
      },
    });
    expect(controller.generateFieldsTreeFrom('test', [
      '*',
      'objectOne.testTwo.type',
      'primitiveOne',
      'primitiveOne',
      'primitiveTwo',
      'arrayOne.*',
      'arrayTwo._id',
      'arrayFour',
      'objectOne.*',
      'objectOne.testTwo.type',
      'objectOne.testOne.relations._id',
      'arrayOne.object.testOne._id',
      'arrayOne.object.testOne.*',
      'objectOne.testOne.name',
      'objectOne.testTwo._id',
      'objectOne.testOne.relations.type',
      'objectOne.specialTest',
      'objectOne.specialTestTwo.name',
      'objectOne.specialTestThree',
      'objectOne.specialTestTwo',
      'arrayOne.object',
      'objectOne.testOne.relations',
    ])).toEqual({
      requestedCollections: new Set([
        'test',
        'test.primitiveOne',
        'test.primitiveTwo',
        'test.arrayOne',
        'test.arrayTwo._id',
        'test.arrayFour',
        'test.objectOne',
        'test.objectOne.testOne.relations._id',
        'test.arrayOne.object.testOne._id',
        'test.arrayOne.object.testOne',
        'test.objectOne.testOne.name',
        'test.objectOne.testTwo._id',
        'test.objectOne.testOne.relations.type',
        'test.objectOne.specialTest',
        'test.objectOne.specialTestTwo.name',
        'test.objectOne.specialTestThree',
        'test.objectOne.specialTestTwo',
        'test.arrayOne.object',
        'test.objectOne.testOne.relations',
      ]),
      requestedFieldsTree: {
        'test._id': new Set(['_id']),
        'test.primitiveOne': new Set(['primitiveOne']),
        'test.primitiveTwo': new Set(['primitiveTwo']),
        'test.primitiveThree': new Set(['primitiveThree']),
        'test.arrayOne': new Set(['arrayOne']),
        'test.arrayTwo': new Set(['arrayTwo']),
        'test.arrayThree': new Set(['arrayThree']),
        'test.arrayFour': new Set(['arrayFour']),
        'test.arrayFive': new Set(['arrayFive']),
        'test.objectOne': new Set(['objectOne']),
        'test.objectOne.testTwo': new Set(['objectOne.testTwo']),
        'test.objectOne.testTwo.type': new Set(['objectOne.testTwo.type']),
      },
    });
  });

  test('[parseQuery] no sortOrder', () => {
    expect(controller.parseQuery({
      sortBy: '_id',
    })).toEqual({
      sortBy: ['_id'],
      sortOrder: [],
    });
  });

  test('[parseQuery] with sortOrder', () => {
    expect(controller.parseQuery({
      fields: 'array',
      sortBy: '_id',
      sortOrder: '-1',
      other: 'test',
    })).toEqual({
      fields: ['array'],
      sortBy: ['_id'],
      sortOrder: [-1],
      other: 'test',
    });
  });

  test('[parseSearchBody] no search query nor filters', () => {
    expect(controller.parseSearchBody('test2', {})).toEqual({});
  });

  test('[parseSearchBody] invalid search filters', () => {
    expect(() => {
      controller.parseSearchBody('test2', { filters: { invalid: true } });
    }).toThrow(new BadRequest('INVALID_FIELD', 'Requested field "test2.invalid" does not exist.'));
  });

  test('[parseSearchBody] search query and filters', () => {
    expect(controller.parseSearchBody('test2', {
      query: {
        on: ['array'],
        text: 'test',
      },
      filters: {
        _id: '646b9be5e921d0ef42f8a147',
        float: ['1.3'],
        array: ['test'],
        date: '2023-01-01',
        integer: ['1', '2', '3'],
        relation: '646b9be5e921d0ef42f8a147',
        'relation._id': '646b9be5e921d0ef42f8a147',
        'dynamicObject.test': 'test',
        'objectOne.testOne.name': 'test',
      },
    })).toEqual({
      query: {
        on: ['array'],
        text: 'test',
      },
      filters: {
        _id: new Id('646b9be5e921d0ef42f8a147'),
        float: 1.3,
        array: 'test',
        integer: [1, 2, 3],
        date: new Date('2023-01-01'),
        'dynamicObject.test': 'test',
        'objectOne.testOne.name': 'test',
        relation: new Id('646b9be5e921d0ef42f8a147'),
        'relation._id': new Id('646b9be5e921d0ef42f8a147'),
      },
    });
  });

  test('[catchErrors] TOKEN_EXPIRED', async () => {
    await expect(async () => {
      await controller.catchErrors(() => {
        throw new jwt.TokenExpiredError('', new Date());
      });
    }).rejects.toThrow(new Unauthorized('TOKEN_EXPIRED', 'Access token has expired.'));
  });

  test('[catchErrors] INVALID_TOKEN', async () => {
    await expect(async () => {
      await controller.catchErrors(() => {
        throw new jwt.JsonWebTokenError('');
      });
    }).rejects.toThrow(new Unauthorized('INVALID_TOKEN', 'Invalid access token.'));
  });

  test('[catchErrors] INVALID_DEVICE_ID', async () => {
    await expect(async () => {
      await controller.catchErrors(() => {
        throw new EngineError('INVALID_DEVICE_ID');
      });
    }).rejects.toThrow(new Unauthorized('INVALID_DEVICE_ID', 'Invalid device id.'));
  });

  test('[catchErrors] NO_RESOURCE', async () => {
    await expect(async () => {
      await controller.catchErrors(() => {
        throw new EngineError('NO_RESOURCE', { id: 'test' });
      });
    }).rejects.toThrow(new Unauthorized('NO_RESOURCE', 'Resource with id "test" does not exist or has been deleted.'));
  });

  test('[catchErrors] NO_RESOURCE', async () => {
    await expect(async () => {
      await controller.catchErrors(() => {
        throw new DatabaseError('NO_RESOURCE', { id: 'test' });
      });
    }).rejects.toThrow(new Unauthorized('NO_RESOURCE', 'Resource with id "test" does not exist or does not match required criteria.'));
  });

  test('[catchErrors] DUPLICATE_RESOURCE', async () => {
    await expect(async () => {
      await controller.catchErrors(() => {
        throw new DatabaseError('DUPLICATE_RESOURCE', { field: 'test', value: 'value' });
      });
    }).rejects.toThrow(new Conflict('RESOURCE_EXISTS', 'Resource with field "test" set to "value" already exists.'));
  });

  test('[catchErrors] NO_USER', async () => {
    await expect(async () => {
      await controller.catchErrors(() => {
        throw new EngineError('NO_USER');
      });
    }).rejects.toThrow(new Unauthorized('NO_USER', 'Invalid credentials.'));
  });

  test('[catchErrors] INVALID_CREDENTIALS', async () => {
    await expect(async () => {
      await controller.catchErrors(() => {
        throw new EngineError('INVALID_CREDENTIALS');
      });
    }).rejects.toThrow(new Unauthorized('INVALID_CREDENTIALS', 'Invalid credentials.'));
  });

  test('[catchErrors] INVALID_VERIFICATION_TOKEN', async () => {
    await expect(async () => {
      await controller.catchErrors(() => {
        throw new EngineError('INVALID_VERIFICATION_TOKEN');
      });
    }).rejects.toThrow(new Unauthorized('INVALID_VERIFICATION_TOKEN', 'Invalid or expired verification token.'));
  });

  test('[catchErrors] INVALID_RESET_TOKEN', async () => {
    await expect(async () => {
      await controller.catchErrors(() => {
        throw new EngineError('INVALID_RESET_TOKEN');
      });
    }).rejects.toThrow(new Unauthorized('INVALID_RESET_TOKEN', 'Invalid or expired reset token.'));
  });

  test('[catchErrors] INVALID_REFRESH_TOKEN', async () => {
    await expect(async () => {
      await controller.catchErrors(() => {
        throw new EngineError('INVALID_REFRESH_TOKEN');
      });
    }).rejects.toThrow(new Unauthorized('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.'));
  });

  test('[catchErrors] PASSWORDS_MISMATCH', async () => {
    await expect(async () => {
      await controller.catchErrors(() => {
        throw new EngineError('PASSWORDS_MISMATCH');
      });
    }).rejects.toThrow(new BadRequest('PASSWORDS_MISMATCH', 'Passwords mismatch.'));
  });

  test('[catchErrors] EMAIL_ALREADY_VERIFIED', async () => {
    await expect(async () => {
      await controller.catchErrors(() => {
        throw new EngineError('EMAIL_ALREADY_VERIFIED');
      });
    }).rejects.toThrow(new NotAcceptable('EMAIL_ALREADY_VERIFIED', 'User email is already verified.'));
  });

  test('[catchErrors] INVALID_FIELD', async () => {
    await expect(async () => {
      await controller.catchErrors(() => {
        throw new DatabaseError('INVALID_FIELD', { path: 'path' });
      });
    }).rejects.toThrow(new BadRequest('INVALID_FIELD', 'Requested field "path" does not exist.'));
  });

  test('[catchErrors] INVALID_INDEX', async () => {
    await expect(async () => {
      await controller.catchErrors(() => {
        throw new DatabaseError('INVALID_INDEX', { path: 'path' });
      });
    }).rejects.toThrow(new BadRequest('INVALID_INDEX', 'Requested field "path" is not indexed.'));
  });

  test('[catchErrors] RESOURCE_REFERENCED', async () => {
    await expect(async () => {
      await controller.catchErrors(() => {
        throw new DatabaseError('RESOURCE_REFERENCED', { collection: 'collection' });
      });
    }).rejects.toThrow(new BadRequest('RESOURCE_REFERENCED', 'Resource is still referenced in collection "collection".'));
  });

  test('[catchErrors] MAXIMUM_DEPTH_EXCEEDED', async () => {
    await expect(async () => {
      await controller.catchErrors(() => {
        throw new DatabaseError('MAXIMUM_DEPTH_EXCEEDED', { path: 'path' });
      });
    }).rejects.toThrow(new BadRequest('MAXIMUM_DEPTH_EXCEEDED', 'Maximum level of depth exceeded for field "path".'));
  });

  test('[catchErrors] other error', async () => {
    await expect(async () => {
      await controller.catchErrors(() => {
        throw new Error('test');
      });
    }).rejects.toThrow(new Error('test'));
  });

  test('[rbac] user is not verified', () => {
    expect(() => {
      controller.rbac(undefined, {}, {
        requestedFieldsTree: {},
        permissions: new Set(['TEST']),
        requestedCollections: new Set(),
        user: { _verifiedAt: null } as User,
      });
    }).toThrow(new Forbidden('NOT_VERIFIED', 'Please verify your email address before performing this operation.'));
  });

  test('[rbac] user is verified, missing permission', () => {
    expect(() => {
      controller.rbac(undefined, {}, {
        type: 'VIEW',
        requestedFieldsTree: {},
        permissions: new Set(),
        collection: 'test' as const,
        requestedCollections: new Set(),
        user: { _verifiedAt: new Date('2023-01-01'), _permissions: new Set() } as User,
      });
    }).toThrow(new Forbidden('FORBIDDEN', 'You are missing "SNAKE_CASED_test_VIEW" permission to perform this operation.'));
    expect(() => {
      controller.rbac(undefined, {}, {
        type: 'VIEW',
        permissions: new Set(),
        requestedFieldsTree: {},
        collection: 'test' as const,
        requestedCollections: new Set(['test2']),
        user: { _verifiedAt: new Date('2023-01-01'), _permissions: new Set(['SNAKE_CASED_test_VIEW']) } as User,
      });
    }).toThrow(new Forbidden('FORBIDDEN', 'You are missing "SNAKE_CASED_test2_VIEW" permission to perform this operation.'));
  });

  test('[rbac] user is verified, missing USERS_ROLES_VIEW permission', () => {
    expect(() => {
      controller.rbac({}, {}, {
        type: 'VIEW',
        permissions: new Set(),
        collection: 'users' as const,
        requestedCollections: new Set(),
        requestedFieldsTree: { 'users.roles': new Set(['roles']) },
        user: { _verifiedAt: new Date('2023-01-01'), _permissions: new Set(['SNAKE_CASED_users_VIEW']) } as User,
      });
    }).toThrow(new Forbidden('FORBIDDEN', 'You are missing "USERS_ROLES_VIEW" permission to perform this operation.'));
  });

  test('[rbac] user is verified, missing USERS_ROLES_UPDATE permission', () => {
    expect(() => {
      controller.rbac({ roles: [] }, {}, {
        type: 'UPDATE',
        requestedFieldsTree: {},
        permissions: new Set(),
        collection: 'users' as const,
        requestedCollections: new Set(),
        user: { _verifiedAt: new Date('2023-01-01'), _permissions: new Set(['SNAKE_CASED_users_UPDATE']) } as User,
      });
    }).toThrow(new Forbidden('FORBIDDEN', 'You are missing "USERS_ROLES_UPDATE" permission to perform this operation.'));
  });

  test('[rbac] user is verified, missing USERS_AUTH_DETAILS_VIEW permission', () => {
    expect(() => {
      controller.rbac(undefined, {}, {
        type: 'VIEW',
        permissions: new Set(),
        collection: 'users' as const,
        requestedCollections: new Set(),
        requestedFieldsTree: { 'users._verifiedAt': new Set(['*']) },
        user: { _verifiedAt: new Date('2023-01-01'), _permissions: new Set(['SNAKE_CASED_users_VIEW']) } as User,
      });
    }).toThrow(new Forbidden('FORBIDDEN', 'You are missing "USERS_AUTH_DETAILS_VIEW" permission to perform this operation.'));
  });

  test('[rbac] user is verified, trying to access password', () => {
    expect(() => {
      controller.rbac(undefined, {}, {
        type: 'VIEW',
        permissions: new Set(),
        collection: 'users' as const,
        requestedCollections: new Set(),
        requestedFieldsTree: { 'users.password': new Set(['*']) },
        user: { _verifiedAt: new Date('2023-01-01'), _permissions: new Set(['SNAKE_CASED_users_VIEW']) } as User,
      });
    }).toThrow(new Forbidden('FORBIDDEN', 'You are not allowed to perform this operation.'));
  });

  test('[rbac] user is verified, no missing permission', () => {
    controller.rbac(undefined, {}, {
      id: 'me',
      type: 'VIEW',
      permissions: new Set(),
      collection: 'users' as const,
      requestedCollections: new Set(),
      requestedFieldsTree: { 'users._verifiedAt': new Set(['_verifiedAt']) },
      user: { _verifiedAt: new Date('2023-01-01'), _permissions: new Set(['SNAKE_CASED_users_VIEW']) } as User,
    });
  });
});
