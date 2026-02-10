/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import jwt from 'jsonwebtoken';
import Model from 'scripts/core/services/Model';
import EngineError from 'scripts/core/errors/Engine';
import Telemetry from 'scripts/core/services/Telemetry';
import AuthEngine from 'scripts/core/services/AuthEngine';
import CacheClient from 'scripts/core/services/CacheClient';
import EmailClient from 'scripts/core/services/EmailClient';
import { type DataModel } from 'scripts/core/services/__mocks__/schema';
import { Id, type Results, type Telemetry as TelemetryType } from '@perseid/core';
import type { CreatePayload, UpdatePayload, UserCommandContext } from 'scripts/core';
import PostgresqlDatabaseClient from 'scripts/connectors/postgresql/services/PostgreSQLDatabaseClient';

type TestAuthEngine = AuthEngine<DataModel> & {
  applyPermissions: AuthEngine<DataModel>['applyPermissions'];
  generateCredentials: AuthEngine<DataModel>['generateCredentials'];
  prepareCreatePayload: AuthEngine<DataModel>['prepareCreatePayload'];
  prepareUpdatePayload: AuthEngine<DataModel>['prepareUpdatePayload'];
};

describe('core/services/AuthEngine', () => {
  vi.mock('bcrypt');
  vi.mock('crypto');
  vi.mock('jsonwebtoken');
  vi.mock('@perseid/core');
  vi.mock('scripts/core/services/Model');
  vi.mock('scripts/core/services/Engine');
  vi.mock('scripts/core/services/Telemetry');
  vi.mock('scripts/core/services/CacheClient');
  vi.mock('scripts/core/services/EmailClient');
  vi.mock('scripts/postgresql/services/PostgreSQLDatabaseClient');
  vi.setSystemTime(new Date('2023-01-01'));

  let engine: TestAuthEngine;
  const telemetry = new Telemetry();
  const context: UserCommandContext<DataModel> = {
    session: {
      deviceId: '12345azerty',
      user: {
        _id: new Id('00000000-0000-0000-0000-000000000001'),
        _verifiedAt: null,
        roles: [],
        email: 'test@example.com',
        _permissions: new Set(['TEST.VIEW', 'OTHER_TEST.VIEW']),
        _devices: [{
          _id: '12345azerty',
          _userAgent: 'Test User Agent',
          _refreshToken: '12345azerty',
          _expiration: new Date('2024-01-01'),
        }],
      },
    },
  };
  const model = new Model<DataModel>(Model.USERS_MODEL);
  const cacheClient = new CacheClient(telemetry, { cachePath: '/.cache', requestTimeout: 0 });
  const emailClient = new EmailClient(telemetry as unknown as TelemetryType, { requestTimeout: 0 });
  const databaseClient = new PostgresqlDatabaseClient<DataModel>(model, telemetry, cacheClient, {
    connectionLimit: 0,
    connectTimeout: 0,
    database: '',
    host: '',
    password: '',
    port: 0,
    protocol: '',
    user: '',
    ssl: false,
  });
  const settings = {
    baseUrl: 'http://localhost:3000',
    auth: {
      issuer: 'test-issuer',
      algorithm: 'RS256' as const,
      clientId: 'test-client',
      privateKey: 'test-private-key',
      publicKey: 'test-public-key',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new AuthEngine<DataModel>(
      model,
      telemetry,
      databaseClient,
      emailClient,
      cacheClient,
      settings,
    ) as TestAuthEngine;
  });

  describe('[generateCredentials]', () => {
    test('generates credentials for a user', () => {
      const userId = new Id();
      expect(engine.generateCredentials(userId)).toEqual({
        expiresIn: 1200,
        deviceId: '12345azerty',
        refreshToken: '12345azerty',
        accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
        refreshTokenExpiration: new Date('2023-01-31T00:00:00.000Z'),
      });
    });
  });

  describe('[applyPermissions]', () => {
    test('does not check anything if no context is provided', async () => {
      const response = await engine.applyPermissions('users', 'CREATE', null, {}, {});
      expect(response).toEqual({ fields: ['_id'] });
    });

    test('throws an error if requested field does not exist', async () => {
      await expect(
        engine.applyPermissions('users', 'CREATE', null, {}, { ...context, queryOptions: { fields: ['invalid'] } }),
      ).rejects.toThrow(new EngineError('UNKNOWN_QUERY_FIELD', { path: 'invalid' }));
      await expect(
        engine.applyPermissions('users', 'CREATE', null, {}, { ...context, queryOptions: { fields: ['_id.*'] } }),
      ).rejects.toThrow(new EngineError('UNKNOWN_QUERY_FIELD', { path: '_id.*' }));
    });

    test('throws an error if user does not have necessary permissions on requested field', async () => {
      await expect(
        engine.applyPermissions('users', 'CREATE', null, {}, { ...context, queryOptions: { fields: ['_isDeleted'] } }),
      ).rejects.toThrow(new EngineError('MISSING_PERMISSION', { permission: 'TEST.IS_DELETED.VIEW' }));
    });

    test('returns requested fields if user has necessary permissions', async () => {
      const fields = ['*', 'objectOne.optionalRelations.*'];
      const response = await engine.applyPermissions('users', 'CREATE', null, {}, { ...context, queryOptions: { fields } });
      expect(response).toEqual({
        fields: [
          '_id',
          'indexedString',
          'objectOne.optionalRelations._id',
          'objectOne.optionalRelations._createdAt',
          'objectOne.optionalRelations.binary',
          'objectOne.optionalRelations.optionalRelation',
          'objectOne.optionalRelations.enum',
          'objectOne.optionalRelations.data',
          'objectOne.boolean',
          'objectOne.optionalRelations',
          'objectOne.objectTwo',
        ],
      });
    });
  });

  describe('[prepareCreatePayload]', () => {
    test('correctly prepares the creation payload', async () => {
      const payload: CreatePayload<DataModel['users']> = {
        email: 'test@example.com',
        password: 'password123',
        roles: [],
      };
      const updatedPayload = await engine.prepareCreatePayload('users', payload, context);
      expect(updatedPayload).toEqual({
        ...payload,
        _devices: [],
        password: 'HASHED_TEXT_password123',
        _createdAt: new Date('2023-01-01T00:00:00.000Z'),
        _verifiedAt: new Date('2023-01-01T00:00:00.000Z'),
      });
      expect(await engine.prepareCreatePayload('notImplemented', {}, context)).toEqual({
        _createdAt: new Date('2023-01-01T00:00:00.000Z'),
        _createdBy: context.session.user._id,
        _updatedBy: null,
      });
    });
  });

  describe('[prepareUpdatePayload]', () => {
    test('correctly prepares the update payload', async () => {
      const payload: UpdatePayload<DataModel['users']> = { email: 'test@example.com' };
      const updatedPayload = await engine.prepareUpdatePayload('users', payload, context);
      expect(updatedPayload).toEqual({
        ...payload,
        _verifiedAt: null,
        _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      });
      expect(await engine.prepareUpdatePayload('users', { password: 'password123' }, context)).toEqual({
        _devices: [],
        password: 'HASHED_TEXT_password123',
        _verifiedAt: new Date('2023-01-01T00:00:00.000Z'),
        _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      });
      expect(await engine.prepareUpdatePayload('notImplemented', {}, context)).toEqual({
        _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
        _updatedBy: context.session.user._id,
      });
    });
  });

  describe('[create]', () => {
    test('correctly creates the specified resource', async () => {
      vi.spyOn(engine, 'applyPermissions');
      expect(await engine.create('users', {
        email: 'test@example.com',
        password: 'password123',
        roles: [],
      }, context)).toEqual({
        _id: expect.any(Id) as Id,
        _createdAt: new Date('2023-01-01T00:00:00.000Z'),
        email: 'test@example.com',
        password: 'password123',
        roles: [],
      });
      expect(engine.applyPermissions).toHaveBeenCalledOnce();
      expect(engine.applyPermissions).toHaveBeenCalledWith('users', 'CREATE', {
        email: 'test@example.com',
        password: 'password123',
        roles: [],
      }, {}, context);
      expect(emailClient.sendInviteEmail).toHaveBeenCalledOnce();
      expect(emailClient.sendInviteEmail).toHaveBeenCalledWith(
        'test@example.com',
        `${settings.baseUrl}/sign-in`,
        'password123',
      );
    });
  });

  describe('[update]', () => {
    test('correctly updates the specified resource', async () => {
      const userId = new Id();
      vi.spyOn(engine, 'applyPermissions');
      expect(await engine.update('users', userId, { roles: [] }, context)).toEqual({
        _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
        roles: [],
      });
      expect(engine.applyPermissions).toHaveBeenCalledOnce();
      expect(engine.applyPermissions).toHaveBeenCalledWith('users', 'UPDATE', { roles: [] }, context);
    });
  });

  describe('[view]', () => {
    test('correctly fetches the specified resource', async () => {
      const userId = new Id();
      vi.spyOn(engine, 'applyPermissions');
      expect(await engine.view('users', userId, context)).toEqual({
        _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      });
      expect(engine.applyPermissions).toHaveBeenCalledOnce();
      expect(engine.applyPermissions).toHaveBeenCalledWith('users', 'VIEW', {}, context);
    });
  });

  describe('[list]', () => {
    test('correctly returns a list of resources', async () => {
      const searchBody = { query: null, filters: null };
      vi.spyOn(engine, 'applyPermissions');
      expect(await engine.list('users', searchBody, context)).toEqual({
        total: 1,
        results: [{
          _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
        }],
      });
      expect(engine.applyPermissions).toHaveBeenCalledOnce();
      expect(engine.applyPermissions).toHaveBeenCalledWith('users', 'LIST', searchBody, context);
    });
  });

  describe('[delete]', () => {
    test('correctly deletes the specified resource', async () => {
      const userId = new Id();
      vi.spyOn(engine, 'applyPermissions');
      await engine.delete('users', userId, context);
      expect(engine.applyPermissions).toHaveBeenCalledOnce();
      expect(engine.applyPermissions).toHaveBeenCalledWith('users', 'DELETE', {}, context);
    });
  });

  describe('[viewMe]', () => {
    test('correctly fetches the specified user', async () => {
      vi.spyOn(engine, 'applyPermissions');
      await engine.viewMe(context);
      expect(databaseClient.view).toHaveBeenCalledOnce();
      expect(databaseClient.view).toHaveBeenCalledWith('users', context.session.user._id, {
        fields: [
          '_id',
          'email',
          '_createdAt',
          '_updatedAt',
          'roles.name',
          '_verifiedAt',
          'roles.permissions',
        ],
      });
    });
  });

  describe('[verifyToken]', () => {
    test('throws an error if token is invalid', async () => {
      await expect(
        engine.verifyToken('invalid', false, context),
      ).rejects.toThrow(new EngineError('INVALID_DEVICE_ID'));
    });

    test('correctly verifies the token', async () => {
      const userId = new Id('00000000-0000-0000-0000-000000000001');
      expect(await engine.verifyToken('valid', false, { ...context, session: { ...context.session, deviceId: 'test' } })).toEqual(userId);
      expect(jwt.verify).toHaveBeenCalledOnce();
      expect(jwt.verify).toHaveBeenCalledWith('valid', 'test-public-key', {
        ignoreExpiration: false,
        issuer: 'test-issuer',
        audience: 'test-client',
        algorithms: ['RS256'],
      });
    });
  });

  describe('[signUp]', () => {
    test('throws an error if passwords do not match', async () => {
      await expect(
        engine.signUp('test@example.com', 'password123', 'password1234', context),
      ).rejects.toThrow(new EngineError('PASSWORDS_MISMATCH'));
    });

    test('correctly signs user up', async () => {
      const userId = new Id('00000000-0000-0000-0000-000000000001');
      vi.spyOn(engine, 'generateCredentials');
      vi.spyOn(engine, 'prepareCreatePayload').mockResolvedValue({ _id: userId, _devices: [] });
      expect(await engine.signUp('test@example.com', 'password123', 'password123', context)).toEqual({
        expiresIn: 1200,
        deviceId: '12345azerty',
        refreshToken: '12345azerty',
        accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
        refreshTokenExpiration: new Date('2023-01-31T00:00:00.000Z'),
      });
      expect(engine.prepareCreatePayload).toHaveBeenCalledOnce();
      expect(engine.prepareCreatePayload).toHaveBeenCalledWith('users', {
        email: 'test@example.com',
        password: 'password123',
        roles: [],
      }, context);
      expect(engine.generateCredentials).toHaveBeenCalledOnce();
      expect(engine.generateCredentials).toHaveBeenCalledWith(userId);
      expect(databaseClient.create).toHaveBeenCalledOnce();
      expect(databaseClient.create).toHaveBeenCalledWith('users', {
        _id: new Id('00000000-0000-0000-0000-000000000001'),
        _createdBy: new Id('00000000-0000-0000-0000-000000000001'),
        _devices: [{
          _expiration: new Date('2023-01-31T00:00:00.000Z'),
          _id: '12345azerty',
          _refreshToken: '12345azerty',
          _userAgent: 'UNKNOWN',
        }],
      });
      expect(cacheClient.set).toHaveBeenCalledOnce();
      expect(cacheClient.set).toHaveBeenCalledWith(
        'verify_00000000-0000-0000-0000-000000000001',
        '12345azerty',
        7200,
      );
      expect(emailClient.sendVerificationEmail).toHaveBeenCalledOnce();
      expect(emailClient.sendVerificationEmail).toHaveBeenCalledWith(
        'test@example.com',
        'http://localhost:3000/verify-email?verificationToken=12345azerty',
      );
    });
  });

  describe('[signIn]', () => {
    test('throws an error if user does not exist', async () => {
      vi.spyOn(databaseClient, 'list').mockResolvedValue({ total: 0, results: [] });
      await expect(
        engine.signIn('test@example.com', 'password123'),
      ).rejects.toThrow(new EngineError('NO_USER'));
    });

    test('throws an error if password is incorrect', async () => {
      vi.spyOn(databaseClient, 'list').mockResolvedValue({
        total: 1,
        results: [{ password: 'HASHED_TEXT_password' }],
      } as Results<DataModel['users']>);
      await expect(
        engine.signIn('test@example.com', 'password1234'),
      ).rejects.toThrow(new EngineError('INVALID_CREDENTIALS'));
    });

    test('correctly signs user in', async () => {
      const user = {
        _id: new Id('00000000-0000-0000-0000-000000000001'),
        password: 'password1234',
        _devices: [{
          _id: '123456azerty',
          _userAgent: 'UNKNOWN',
          _refreshToken: '12345azerty',
          _expiration: new Date('2023-01-31T00:00:00.000Z'),
        }],
      };
      vi.spyOn(engine, 'generateCredentials');
      vi.spyOn(engine, 'prepareUpdatePayload').mockResolvedValue({ _devices: [] });
      vi.spyOn(databaseClient, 'list').mockResolvedValue({
        total: 1,
        results: [user],
      } as Results<DataModel['users']>);
      expect(await engine.signIn('test@example.com', 'password1234', '12345azerty')).toEqual({
        expiresIn: 1200,
        deviceId: '12345azerty',
        refreshToken: '12345azerty',
        accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
        refreshTokenExpiration: new Date('2023-01-31T00:00:00.000Z'),
      });
      expect(engine.generateCredentials).toHaveBeenCalledOnce();
      expect(engine.generateCredentials).toHaveBeenCalledWith(user._id, context.session.deviceId);
      expect(engine.prepareUpdatePayload).toHaveBeenCalledOnce();
      expect(engine.prepareUpdatePayload).toHaveBeenCalledWith('users', {}, { ...context, session: { ...context.session, user } });
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('users', user._id, {
        _devices: [{
          _id: '12345azerty',
          _userAgent: 'UNKNOWN',
          _refreshToken: '12345azerty',
          _expiration: new Date('2023-01-31T00:00:00.000Z'),
        },
        {
          _id: '123456azerty',
          _userAgent: 'UNKNOWN',
          _refreshToken: '12345azerty',
          _expiration: new Date('2023-01-31T00:00:00.000Z'),
        }],
      });
    });
  });

  describe('[requestEmailVerification]', () => {
    test('throws an error if user email is already verified', async () => {
      const fullContext = {
        ...context,
        session: {
          ...context.session,
          user: { ...context.session.user, _verifiedAt: new Date() },
        },
      };
      await expect(
        engine.requestEmailVerification(fullContext),
      ).rejects.toThrow(new EngineError('EMAIL_ALREADY_VERIFIED'));
    });

    test('correctly requests an email verification', async () => {
      await engine.requestEmailVerification(context);
      expect(cacheClient.set).toHaveBeenCalledOnce();
      expect(cacheClient.set).toHaveBeenCalledWith(
        'verify_00000000-0000-0000-0000-000000000001',
        '12345azerty',
        7200,
      );
      expect(emailClient.sendVerificationEmail).toHaveBeenCalledOnce();
    });
  });

  describe('[verifyEmail]', () => {
    test('throws an error if verification token not valid', async () => {
      await expect(
        engine.verifyEmail('invalid', context),
      ).rejects.toThrow(new EngineError('INVALID_VERIFICATION_TOKEN'));
    });

    test('correctly requests an email verification', async () => {
      vi.spyOn(cacheClient, 'get').mockResolvedValue('12345azerty');
      await engine.verifyEmail('12345azerty', context);
      expect(cacheClient.get).toHaveBeenCalledOnce();
      expect(cacheClient.get).toHaveBeenCalledWith('verify_00000000-0000-0000-0000-000000000001');
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('users', context.session.user._id, {
        _verifiedAt: new Date('2023-01-01T00:00:00.000Z'),
        _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      });
      expect(cacheClient.delete).toHaveBeenCalledOnce();
      expect(cacheClient.delete).toHaveBeenCalledWith('verify_00000000-0000-0000-0000-000000000001');
    });
  });

  describe('[requestPasswordReset]', () => {
    test('does not send email if user does not exist', async () => {
      vi.spyOn(databaseClient, 'list').mockResolvedValue({ total: 0, results: [] });
      await engine.requestPasswordReset('test@example.com');
      expect(emailClient.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    test('correctly requests a password reset', async () => {
      vi.spyOn(databaseClient, 'list').mockResolvedValue({
        total: 1,
        results: [{ email: 'test@example.com' }],
      } as Results<DataModel['users']>);
      vi.spyOn(cacheClient, 'get').mockResolvedValue('12345azerty');
      await engine.requestPasswordReset('test@example.com');
      expect(cacheClient.set).toHaveBeenCalledOnce();
      expect(cacheClient.set).toHaveBeenCalledWith('reset_12345azerty', 'test@example.com', 7200);
      expect(emailClient.sendPasswordResetEmail).toHaveBeenCalledOnce();
      expect(emailClient.sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        'http://localhost:3000/reset-password?resetToken=12345azerty',
      );
    });
  });

  describe('[resetPassword]', () => {
    test('throws an error if reset token is not valid', async () => {
      vi.spyOn(databaseClient, 'list').mockResolvedValue({ total: 0, results: [] });
      await expect(
        engine.resetPassword('password1234', 'password1234', '12345azerty'),
      ).rejects.toThrow(new EngineError('INVALID_RESET_TOKEN'));
    });

    test('throws an error if passwords do not match', async () => {
      await expect(
        engine.resetPassword('password1234', 'password12344', '12345azerty'),
      ).rejects.toThrow(new EngineError('PASSWORDS_MISMATCH'));
    });

    test('correctly resets the password', async () => {
      const userId = new Id('00000000-0000-0000-0000-000000000001');
      vi.spyOn(databaseClient, 'list').mockResolvedValue({
        total: 1,
        results: [{ email: 'test@example.com', _id: userId }],
      } as Results<DataModel['users']>);
      await engine.resetPassword('password1234', 'password1234', '12345azerty');
      expect(cacheClient.get).toHaveBeenCalledOnce();
      expect(cacheClient.get).toHaveBeenCalledWith('reset_12345azerty');
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('users', userId, {
        _devices: [],
        password: 'HASHED_TEXT_password1234',
        _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
        _verifiedAt: new Date('2023-01-01T00:00:00.000Z'),
      });
      expect(cacheClient.delete).toHaveBeenCalledOnce();
      expect(cacheClient.delete).toHaveBeenCalledWith('reset_12345azerty');
    });
  });

  describe('[refreshToken]', () => {
    test('throws an error if refresh token is not valid', async () => {
      vi.spyOn(databaseClient, 'list').mockResolvedValue({ total: 0, results: [] });
      await expect(
        engine.refreshToken('invalid', context),
      ).rejects.toThrow(new EngineError('INVALID_REFRESH_TOKEN'));
    });

    test('correctly refreshes access token', async () => {
      const fullContext = {
        ...context,
        session: {
          ...context.session,
          user: {
            ...context.session.user,
            _devices: [
              ...context.session.user._devices,
              {
                _id: '123456azerty',
                _userAgent: 'UNKNOWN',
                _refreshToken: '123456azerty',
                _expiration: new Date('2024-01-31T00:00:00.000Z'),
              },
            ],
          },
        },
      };
      vi.spyOn(engine, 'generateCredentials').mockReturnValue({
        expiresIn: 1200,
        deviceId: '12345azerty',
        refreshToken: '12345azerty',
        accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
        refreshTokenExpiration: new Date('2024-01-31T00:00:00.000Z'),
      });
      vi.spyOn(databaseClient, 'list').mockResolvedValue({
        total: 1,
        results: [{ email: 'test@example.com', _id: context.session.user._id }],
      } as Results<DataModel['users']>);
      await engine.refreshToken('12345azerty', fullContext);
      expect(engine.generateCredentials).toHaveBeenCalledOnce();
      expect(engine.generateCredentials).toHaveBeenCalledWith(
        context.session.user._id,
        '12345azerty',
      );
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('users', context.session.user._id, {
        _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
        _devices: [{
          _id: '12345azerty',
          _refreshToken: '12345azerty',
          _userAgent: 'Test User Agent',
          _expiration: new Date('2024-01-31T00:00:00.000Z'),
        }, {
          _id: '123456azerty',
          _userAgent: 'UNKNOWN',
          _refreshToken: '123456azerty',
          _expiration: new Date('2024-01-31T00:00:00.000Z'),
        }],
      });
    });
  });

  describe('[signOut]', () => {
    test('correctly signs user out', async () => {
      const fullContext = {
        ...context,
        session: {
          ...context.session,
          user: {
            ...context.session.user,
            _devices: [
              ...context.session.user._devices,
              {
                _id: '123456azerty',
                _userAgent: 'UNKNOWN',
                _refreshToken: '123456azerty',
                _expiration: new Date('2024-01-31T00:00:00.000Z'),
              },
            ],
          },
        },
      };
      vi.spyOn(engine, 'prepareUpdatePayload').mockResolvedValue({ _devices: [] });
      await engine.signOut(fullContext);
      expect(engine.prepareUpdatePayload).toHaveBeenCalledOnce();
      expect(engine.prepareUpdatePayload).toHaveBeenCalledWith('users', {}, fullContext);
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('users', context.session.user._id, {
        _devices: [{
          _id: '123456azerty',
          _userAgent: 'UNKNOWN',
          _refreshToken: '123456azerty',
          _expiration: new Date('2024-01-31T00:00:00.000Z'),
        }],
      });
    });
  });
});
