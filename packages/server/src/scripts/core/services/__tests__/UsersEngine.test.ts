/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Model from 'scripts/core/services/Model';
import Logger from 'scripts/core/services/Logger';
import EngineError from 'scripts/core/errors/Engine';
import { type ResourceSchema, Id } from '@perseid/core';
import UsersEngine from 'scripts/core/services/UsersEngine';
import CacheClient from 'scripts/core/services/CacheClient';
import EmailClient from 'scripts/core/services/EmailClient';
import { type DataModel } from 'scripts/core/services/__mocks__/schema';
import MongoDatabaseClient from 'scripts/mongodb/services/MongoDatabaseClient';

type TestUsersEngine = UsersEngine<DataModel> & {
  generateCredentials: UsersEngine['generateCredentials'];
  withAutomaticFields: UsersEngine['withAutomaticFields'];
  checkAndUpdatePayload: UsersEngine['checkAndUpdatePayload'];
};

describe('core/services/UsersEngine', () => {
  vi.mock('bcrypt');
  vi.mock('crypto');
  vi.mock('jsonwebtoken');
  vi.mock('@perseid/core');
  vi.mock('scripts/core/services/Model');
  vi.mock('scripts/core/services/Logger');
  vi.mock('scripts/core/services/Engine');
  vi.mock('scripts/core/services/CacheClient');
  vi.mock('scripts/core/services/EmailClient');
  vi.mock('scripts/mongodb/services/MongoDatabaseClient');
  vi.setSystemTime(new Date('2023-01-01'));

  const mockedCheckAndUpdatePayload = vi.fn((_, __, payload) => Promise.resolve({
    ...payload,
    updated: true,
  }));

  let engine: TestUsersEngine;
  const context = { deviceId: 'test' } as CommandContext<DataModel>;
  const logger = new Logger({ logLevel: 'info', prettyPrint: false });
  const emailClient = new EmailClient(logger, { connectTimeout: 0 });
  const cacheClient = new CacheClient({ cachePath: '/.cache', connectTimeout: 0 });
  const model = new Model<DataModel>({} as Record<keyof DataModel, ResourceSchema<DataModel>>);
  const databaseClient = new MongoDatabaseClient<DataModel>(model, logger, cacheClient, {
    connectionLimit: 0,
    connectTimeout: 0,
    database: '',
    host: '',
    password: '',
    port: 0,
    protocol: '',
    user: '',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NO_RESULT;
    delete process.env.PASSWORDS_MISMATCH;
    engine = new UsersEngine<DataModel>(model, logger, databaseClient, emailClient, cacheClient, {
      baseUrl: 'https://test.com',
      auth: {
        algorithm: 'RS256',
        clientId: 'test',
        issuer: 'test',
        privateKey: '',
        publicKey: '',
      },
    }) as TestUsersEngine;
  });

  describe('[withAutomaticFields]', () => {
    test('users resource', async () => {
      const payload = { password: 'test', email: 'test@test.test' } as DataModel['users'];
      const newPayload = await engine.withAutomaticFields('users', null, payload, {
        ...context,
        credentials: {
          accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
          deviceId: 'test',
          expiresIn: 1200,
          refreshToken: '12345azerty',
          refreshTokenExpiration: new Date('2023-01-31T00:00:00.000Z'),
        },
      } as CommandContext<DataModel>);
      expect(newPayload).toEqual({
        _devices: [{
          _id: 'test',
          _userAgent: 'UNKNOWN',
          _refreshToken: '12345azerty',
          _expiration: new Date('2023-01-31T00:00:00.000Z'),
        }],
        _apiKeys: [],
        _verifiedAt: null,
        email: 'test@test.test',
        _updatedAt: new Date('2023-01-01'),
        password: 'test',
      });
    });

    test('users resource, user in context', async () => {
      const payload = { password: 'test' } as DataModel['users'];
      const user = { _verifiedAt: new Date('2023-01-01'), _devices: [] } as unknown as DataModel['users'];
      const newPayload = await engine.withAutomaticFields('users', null, payload, {
        ...context,
        user,
        deviceId: 'test',
        credentials: null,
      } as CommandContext<DataModel>);
      expect(newPayload).toEqual({
        _apiKeys: [],
        _devices: [],
        _verifiedAt: new Date('2023-01-01T00:00:00.000Z'),
        _updatedAt: new Date('2023-01-01'),
        password: 'test',
      });
    });

    test('users resource, user in context, existing device', async () => {
      const payload = { password: 'test' } as DataModel['users'];
      const user = {
        _verifiedAt: new Date('2023-01-01'),
        _devices: [{ _id: 'test' }],
      } as unknown as DataModel['users'];
      const newPayload = await engine.withAutomaticFields('users', null, payload, {
        ...context,
        user,
        deviceId: 'test',
        credentials: {
          accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
          deviceId: 'test',
          expiresIn: 1200,
          refreshToken: '12345azerty',
          refreshTokenExpiration: new Date('2023-01-31T00:00:00.000Z'),
        },
      } as CommandContext<DataModel>);
      expect(newPayload).toEqual({
        _apiKeys: [],
        _devices: [{
          _id: 'test',
          _userAgent: 'UNKNOWN',
          _refreshToken: '12345azerty',
          _expiration: new Date('2023-01-31T00:00:00.000Z'),
        }],
        _verifiedAt: new Date('2023-01-01T00:00:00.000Z'),
        _updatedAt: new Date('2023-01-01'),
        password: 'test',
      });
    });

    test('other resource', async () => {
      const payload = {} as DataModel['roles'];
      const newPayload = await engine.withAutomaticFields('roles', payload, payload, context);
      expect(newPayload).toEqual({ _updatedAt: new Date('2023-01-01') });
    });
  });

  test('[checkAndUpdatePayload]', async () => {
    const payload = { password: 'test' } as DataModel['users'];
    const newPayload = await engine.checkAndUpdatePayload('users', null, payload, context);
    expect(newPayload).toEqual({
      password: 'HASHED_TEXT_test',
      _updatedAt: new Date('2023-01-01'),
    });
  });

  describe('[verifyToken]', () => {
    test('INVALID_DEVICE_ID error', async () => {
      const newContext = { deviceId: 'other' } as unknown as CommandContext<DataModel>;
      await expect(async () => {
        await engine.verifyToken('invalid', true, newContext);
      }).rejects.toThrow(new Error('INVALID_DEVICE_ID'));
    });

    test('no error', async () => {
      const newContext = { deviceId: 'test' } as unknown as CommandContext<DataModel>;
      expect(await engine.verifyToken('invalid', true, newContext)).toEqual(new Id('000000000000000000000001'));
    });
  });

  describe('[create]', () => {
    test('users resource', async () => {
      const payload = { email: 'test@test.io', password: 'test' } as DataModel['users'];
      await engine.create('users', payload, {}, context);
      expect(emailClient.sendInviteEmail).toHaveBeenCalledOnce();
      expect(emailClient.sendInviteEmail).toHaveBeenCalledWith(
        'test@test.io',
        'https://test.com/sign-in',
        'test',
      );
    });

    test('other resource', async () => {
      await engine.create('roles', {} as DataModel['roles'], {}, context);
      expect(emailClient.sendInviteEmail).not.toHaveBeenCalled();
    });
  });

  test('[viewMe]', async () => {
    await engine.viewMe({ ...context, user: { _id: new Id('000000000000000000000001') } as DataModel['users'] });
    expect(databaseClient.view).toHaveBeenCalledOnce();
    expect(databaseClient.view).toHaveBeenCalledWith(
      'users',
      new Id('000000000000000000000001'),
      {
        fields: new Set([
          '_id',
          'email',
          '_createdAt',
          '_updatedAt',
          'roles.name',
          '_verifiedAt',
          'roles.permissions',
        ]),
        maximumDepth: 2,
      },
    );
  });

  describe('[signUp]', () => {
    test('PASSWORDS_MISMATCH error', async () => {
      await expect(async () => {
        await engine.signUp('test@test.io', 'test', 'invalid', context);
      }).rejects.toThrow(new EngineError('PASSWORDS_MISMATCH'));
    });

    test('no error', async () => {
      const credentials = {
        accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
        deviceId: 'test',
        expiresIn: 1200,
        refreshToken: '12345azerty',
        refreshTokenExpiration: new Date('2023-01-31T00:00:00.000Z'),
      };
      vi.spyOn(engine, 'generateCredentials').mockImplementation(vi.fn(() => credentials));
      vi.spyOn(engine, 'withAutomaticFields').mockImplementation(mockedCheckAndUpdatePayload);
      vi.spyOn(engine, 'checkAndUpdatePayload').mockImplementation(mockedCheckAndUpdatePayload);
      expect(await engine.signUp('test@test.io', 'test', 'test', context)).toEqual({
        accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
        deviceId: 'test',
        expiresIn: 1200,
        refreshToken: '12345azerty',
        refreshTokenExpiration: new Date('2023-01-31T00:00:00.000Z'),
      });
      expect(engine.checkAndUpdatePayload).toHaveBeenCalledOnce();
      expect(engine.checkAndUpdatePayload).toHaveBeenCalledWith('users', null, {
        roles: [],
        password: 'test',
        email: 'test@test.io',
      }, { credentials, deviceId: 'test' });
      expect(engine.withAutomaticFields).toHaveBeenCalledOnce();
      expect(engine.withAutomaticFields).toHaveBeenCalledWith('users', null, {
        roles: [],
        password: 'test',
        email: 'test@test.io',
        updated: true,
      }, { credentials, deviceId: 'test' });
      expect(databaseClient.create).toHaveBeenCalledOnce();
      expect(databaseClient.create).toHaveBeenCalledWith('users', {
        _id: new Id('000000000000000000000001'),
        email: 'test@test.io',
        password: 'test',
        roles: [],
        updated: true,
      });
      expect(emailClient.sendVerificationEmail).toHaveBeenCalledOnce();
      expect(emailClient.sendVerificationEmail).toHaveBeenCalledWith(
        'test@test.io',
        'https://test.com/verify-email?verificationToken=12345azerty',
      );
      expect(cacheClient.set).toHaveBeenCalledOnce();
      expect(cacheClient.set).toHaveBeenCalledWith('verify_000000000000000000000001', '12345azerty', 7200);
    });
  });

  describe('[signIn]', () => {
    test('NO_USER error', async () => {
      process.env.NO_RESULT = 'true';
      await expect(async () => {
        await engine.signIn('test@test.io', 'test', context);
      }).rejects.toThrow(new EngineError('NO_USER'));
    });

    test('INVALID_CREDENTIALS error', async () => {
      process.env.PASSWORDS_MISMATCH = 'true';
      await expect(async () => {
        await engine.signIn('test@test.io', 'test', context);
      }).rejects.toThrow(new EngineError('INVALID_CREDENTIALS'));
    });

    test('no error', async () => {
      const credentials = {
        accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
        deviceId: 'test',
        expiresIn: 1200,
        refreshToken: '12345azerty',
        refreshTokenExpiration: new Date('2023-01-31T00:00:00.000Z'),
      };
      vi.spyOn(engine, 'generateCredentials').mockImplementation(vi.fn(() => credentials));
      vi.spyOn(engine, 'withAutomaticFields').mockImplementation(mockedCheckAndUpdatePayload);
      const newContext = { deviceId: '000000000000000000000009' } as CommandContext<DataModel>;
      expect(await engine.signIn('test@test.io', 'test', newContext)).toEqual(credentials);
      expect(engine.withAutomaticFields).toHaveBeenCalledOnce();
      expect(engine.withAutomaticFields).toHaveBeenCalledWith('users', {
        _id: new Id('000000000000000000000001'),
        _devices: [{ _id: '000000000000000000000009' }],
      }, {}, {
        ...newContext,
        deviceId: '000000000000000000000009',
        credentials,
        user: {
          _id: new Id('000000000000000000000001'),
          _devices: [{ _id: '000000000000000000000009' }],
        },
      });
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('users', new Id('000000000000000000000001'), {
        updated: true,
      });
      // Covers other specific cases.
      await engine.signIn('test@test.io', 'test', { deviceId: 'test' } as CommandContext<DataModel>);
    });
  });

  describe('[requestEmailVerification]', () => {
    test('EMAIL_ALREADY_VERIFIED error', async () => {
      const newContext = {
        user: { _verifiedAt: new Date(), _id: new Id('000000000000000000000001') },
      } as unknown as CommandContext<DataModel>;
      await expect(async () => {
        await engine.requestEmailVerification(newContext);
      }).rejects.toThrow(new EngineError('EMAIL_ALREADY_VERIFIED'));
    });

    test('no error', async () => {
      const newContext = {
        user: { _verifiedAt: null, email: 'test@test.io', _id: new Id('000000000000000000000001') },
      } as unknown as CommandContext<DataModel>;
      await engine.requestEmailVerification(newContext);
      expect(cacheClient.set).toHaveBeenCalledOnce();
      expect(cacheClient.set).toHaveBeenCalledWith('verify_000000000000000000000001', '12345azerty', 7200);
      expect(emailClient.sendVerificationEmail).toHaveBeenCalledOnce();
      expect(emailClient.sendVerificationEmail).toHaveBeenCalledWith(
        'test@test.io',
        'https://test.com/verify-email?verificationToken=12345azerty',
      );
    });
  });

  describe('[verifyEmail]', () => {
    test('INVALID_VERIFICATION_TOKEN error', async () => {
      const newContext = { user: {} } as unknown as CommandContext<DataModel>;
      await expect(async () => {
        await engine.verifyEmail('invalid', newContext);
      }).rejects.toThrow(new EngineError('INVALID_VERIFICATION_TOKEN'));
    });

    test('no error', async () => {
      const newContext = {
        user: { _id: new Id('000000000000000000000001') },
      } as unknown as CommandContext<DataModel>;
      const payload = { _verifiedAt: new Date('2023-01-01T00:00:00.000Z') };
      vi.spyOn(engine, 'withAutomaticFields').mockImplementation(mockedCheckAndUpdatePayload);
      await engine.verifyEmail('test', newContext);
      expect(cacheClient.delete).toHaveBeenCalledOnce();
      expect(cacheClient.delete).toHaveBeenCalledWith('verify_000000000000000000000001');
      expect(engine.withAutomaticFields).toHaveBeenCalledOnce();
      expect(engine.withAutomaticFields).toHaveBeenCalledWith('users', newContext.user, payload, newContext);
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('users', new Id('000000000000000000000001'), {
        _verifiedAt: new Date('2023-01-01T00:00:00.000Z'),
        updated: true,
      });
    });
  });

  describe('[requestPasswordReset]', () => {
    test('user does not exist', async () => {
      process.env.NO_RESULT = 'true';
      await engine.requestPasswordReset('test@test.io');
      expect(logger.info).toHaveBeenCalledOnce();
      expect(logger.info).toHaveBeenCalledWith(
        'User with email "test@test.io" does not exist, skipping email sending...',
      );
      expect(emailClient.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    test('user exists', async () => {
      await engine.requestPasswordReset('test@test.io');
      expect(cacheClient.set).toHaveBeenCalledOnce();
      expect(cacheClient.set).toHaveBeenCalledWith('reset_12345azerty', 'test@test.io', 7200);
      expect(emailClient.sendPasswordResetEmail).toHaveBeenCalledOnce();
      expect(emailClient.sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@test.io',
        'https://test.com/reset-password?resetToken=12345azerty',
      );
    });
  });

  describe('[resetPassword]', () => {
    test('PASSWORDS_MISMATCH error', async () => {
      await expect(async () => {
        await engine.resetPassword('test', 'invalid', 'token');
      }).rejects.toThrow(new EngineError('PASSWORDS_MISMATCH'));
    });

    test('INVALID_RESET_TOKEN error', async () => {
      process.env.NO_RESULT = 'true';
      await expect(async () => {
        await engine.resetPassword('test', 'test', 'token');
      }).rejects.toThrow(new EngineError('INVALID_RESET_TOKEN'));
    });

    test('no error', async () => {
      const user = {
        _devices: [{ _id: '000000000000000000000009' }],
        _id: new Id('000000000000000000000001'),
      };
      vi.spyOn(engine, 'withAutomaticFields').mockImplementation(mockedCheckAndUpdatePayload);
      vi.spyOn(engine, 'checkAndUpdatePayload').mockImplementation(mockedCheckAndUpdatePayload);
      await engine.resetPassword('test', 'test', 'test');
      expect(cacheClient.delete).toHaveBeenCalledOnce();
      expect(cacheClient.delete).toHaveBeenCalledWith('reset_test');
      expect(engine.checkAndUpdatePayload).toHaveBeenCalledOnce();
      expect(engine.checkAndUpdatePayload).toHaveBeenCalledWith('users', user, { password: 'test' }, { user });
      expect(engine.withAutomaticFields).toHaveBeenCalledOnce();
      expect(engine.withAutomaticFields).toHaveBeenCalledWith('users', user, {
        password: 'test',
        updated: true,
      }, { user });
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('users', new Id('000000000000000000000001'), {
        password: 'test',
        updated: true,
      });
    });
  });

  describe('[refreshToken]', () => {
    test('INVALID_REFRESH_TOKEN error', async () => {
      const newContext = {
        user: {
          _id: new Id('000000000000000000000001'),
          _devices: [],
        },
      } as unknown as CommandContext<DataModel>;
      await expect(async () => {
        await engine.refreshToken('token', newContext);
      }).rejects.toThrow(new EngineError('INVALID_REFRESH_TOKEN'));
    });

    test('no error', async () => {
      const newContext = {
        user: {
          _id: new Id('000000000000000000000001'),
          _devices: [{
            _id: 'test',
            _refreshToken: 'token',
            _expiration: new Date('2024-01-01'),
          }],
        },
        deviceId: 'test',
      } as unknown as CommandContext<DataModel>;
      const credentials = {
        accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
        deviceId: 'test',
        expiresIn: 1200,
        refreshToken: '12345azerty',
        refreshTokenExpiration: new Date('2023-01-31T00:00:00.000Z'),
      };
      vi.spyOn(engine, 'generateCredentials').mockImplementation(vi.fn(() => credentials));
      vi.spyOn(engine, 'withAutomaticFields').mockImplementation(mockedCheckAndUpdatePayload);
      expect(await engine.refreshToken('token', newContext)).toEqual(credentials);
      expect(engine.generateCredentials).toHaveBeenCalledOnce();
      expect(engine.generateCredentials).toHaveBeenCalledWith(new Id('000000000000000000000001'), 'test');
      expect(engine.withAutomaticFields).toHaveBeenCalledOnce();
      expect(engine.withAutomaticFields).toHaveBeenCalledWith('users', newContext.user, {}, {
        ...newContext,
        credentials,
      });
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('users', new Id('000000000000000000000001'), { updated: true });
    });
  });

  test('[signOut]', async () => {
    vi.spyOn(engine, 'withAutomaticFields').mockImplementation(mockedCheckAndUpdatePayload);
    const newContext = {
      user: {
        _id: new Id('000000000000000000000001'),
        _devices: [{
          _id: 'test',
          _refreshToken: 'token',
          _expiration: new Date('2024-01-01'),
        }],
      },
      deviceId: 'test',
    } as unknown as CommandContext<DataModel>;
    await engine.signOut(newContext);
    expect(engine.withAutomaticFields).toHaveBeenCalledOnce();
    expect(engine.withAutomaticFields).toHaveBeenCalledWith('users', newContext.user, {}, {
      ...newContext,
      credentials: null,
    });
    expect(databaseClient.update).toHaveBeenCalledOnce();
    expect(databaseClient.update).toHaveBeenCalledWith('users', new Id('000000000000000000000001'), {
      updated: true,
    });
  });

  test('[reset]', async () => {
    vi.spyOn(engine, 'signUp').mockImplementation(vi.fn());
    await engine.reset('test@test.io', 'test');
    expect(logger.info).toHaveBeenCalledTimes(3);
    expect(logger.info).toHaveBeenCalledWith('[UsersEngine][reset] Creating root user...');
    expect(logger.info).toHaveBeenCalledWith('[UsersEngine][reset] Creating root role...');
    expect(logger.info).toHaveBeenCalledWith('[UsersEngine][reset] Updating root user...');
    expect(engine.signUp).toHaveBeenCalledOnce();
    expect(engine.signUp).toHaveBeenCalledWith('test@test.io', 'test', 'test', {});
    expect(databaseClient.create).toHaveBeenCalledOnce();
    expect(databaseClient.create).toHaveBeenCalledWith('roles', {
      name: 'ROOT',
      permissions: [
        'VIEW_USERS_ROLES',
        'UPDATE_USERS_ROLES',
        'VIEW_USERS_AUTH_DETAILS',
        'VIEW_SNAKE_CASED_test',
        'LIST_SNAKE_CASED_test',
        'SEARCH_SNAKE_CASED_test',
        'CREATE_SNAKE_CASED_test',
        'UPDATE_SNAKE_CASED_test',
        'DELETE_SNAKE_CASED_test',
        'VIEW_SNAKE_CASED_otherTest',
        'LIST_SNAKE_CASED_otherTest',
        'SEARCH_SNAKE_CASED_otherTest',
        'CREATE_SNAKE_CASED_otherTest',
        'UPDATE_SNAKE_CASED_otherTest',
        'DELETE_SNAKE_CASED_otherTest',
      ],
    });
    expect(databaseClient.update).toHaveBeenCalledOnce();
    expect(databaseClient.update).toHaveBeenCalledWith('users', new Id('000000000000000000000001'), {
      roles: [new Id('000000000000000000000001')],
      _verifiedAt: new Date('2023-01-01T00:00:00.000Z'),
    });
  });
});
