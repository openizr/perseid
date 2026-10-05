/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Id } from '@perseid/core';
import Model from 'scripts/core/services/Model';
import Telemetry from 'scripts/core/services/Telemetry';
import AuthEngine from 'scripts/core/services/AuthEngine';
import EmailClient from 'scripts/core/services/EmailClient';
import CacheClient from 'scripts/core/services/CacheClient';
import schema, { type DataModel } from 'scripts/core/services/__mocks__/schema';
import type AbstractDatabaseClient from 'scripts/core/services/AbstractDatabaseClient';
import DatabaseClient from 'scripts/core/services/__mocks__/AbstractDatabaseClient';

vi.mock('scripts/core/services/Model');
vi.mock('scripts/core/services/Telemetry');
vi.mock('scripts/core/services/EmailClient');
vi.mock('scripts/core/services/CacheClient');

describe('core/services/AuthEngine', () => {
  vi.setSystemTime(new Date('2023-01-01T00:00:00.000Z'));

  const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC0LQeAgOIJ0hFg
MnANWl9xQ5fwflfS3rp3kX4Y6sHlxNZALb4K2ssTaiZhKuA3FZrJbvnPh07uXqE/
6AgUQYMGH/Q5ZVBB8g+DJxEL/NnWzSFpOOc2PZ3M6HkXj8Qla0JtIYMNBMEv7TPp
9epmh4QnpRtr519TMpGJgFYxI69ja9vh5mTlmIYAJNjOUoYKXVV/ufDARV5mpimC
6jzT1AdT71Qb8keYEOWBMxZ5iMbjzdSfn9Qp47S8NRoOOBU7oYqP47gOzUuMXS5R
ZD1XqrlDbjPA03lMaX+VXwrZ1pHUiRdrP5CrFp2hKsh9M2WybVmY8+dh+5IN+KVI
TT+oSDXvAgMBAAECggEAGfgbirQI4G18v6bFa8dI1mRts+Yh9mzP54f66tB7Xgi+
8MUnDR14A7ZbDcpGQupEQyBRtU3FXKobB8ED2ReQMQPOCa/Gn5qqDbdFx7qME1/B
nw7qlHDRG8WuHm1EUjhhfKVF5Ex5I9VGlEQzos+JhsVPbIAOx0kUnQL4aWDBWMzn
Fqh3EMT09D/B/Bx/RX8Q8p7KQul/OcoLH+i/pWm9m0RlYwFNWbPDWSGNvmrqm33E
6btbqGZb3mN6aHULoylGyNlEKzesFIrc1ihqXzfLTElIiuaEgFIL6DLMZ9456QwK
kS4iJgMIa2HdmVg0K3+LelnMtnjQr/Vil/X6f6Bm4QKBgQDdDZySUQiK31Tl7ecd
fIB2CM7y7YfzUFbIa+yzDls0ePtbEYw+HRjuBDK6CxvvwYPDPHRSh1hFnQA99x/C
2VRnMgAuEGNZxFAOb1LM027YaJQsLWXVegfLiR0nRMxMWN6uCETOsIeiQjgrJZBQ
yayg9mHty7IzZFMXq+44s7BZJwKBgQDQqQvuMLhenKWAZ18fAEacUNIIx75IJUo0
iU6+/oKNcsZsucfBTyR+NlnFo8wMBl1aaYEb9PyaMWHTlQXj6bq83aS+nJUAI67G
NDSoMVpvTDpvGSwSGhPA4ycKzpYe6Qxd3M7640YDYbRPGEd99l2OyxRNz5d/tJf8
zG8BKpvp+QKBgQCEgMg9nH02YTCOstA6iIqoNhd23pMDckDS2n6DxjM9fNeOezJJ
eT+cTL/rbQVN7f2BZheD8MUk1Ttz6VIMhiFlyj75XbFv+ZDTVj+Xr5Vd+zH2WTAV
ipRpmML06vRbP1obj7FPA9oJlQ/+LQIYqwrjYUzKMbObwqNcKR8etfcbOQKBgQCj
kG/+tghAehCuF9oTphazwBL0uQbq7Pg/OIcW5tEV6iuq3PK+ELjtitNSPzTbFD4n
el6vuJoukJk7zyx/3R75n9DdbkbKhi4hxpikY5OdfSatIhFO20wyvp1DNm+tKUf9
Z/KD7pZaXkOGYOTh07bBEWYIHLuIattdWi+FvY3cmQKBgCnxuD+LoiYSX7Uavl39
HtN2zo8E+jQb8XuYgrlXwip4X5r1zgfCRtctsx3K8pjmsEvRYD/6GgQnM2RLS4jh
vX0oZUo5tQhyhv/l0HNpFdgRxpngi5KZe6h9gML2L9QL2982SvXhBaQosKUNqcIZ
9Tpe2nCowHMUOzbfWPlFOLMa
-----END PRIVATE KEY-----`;

  const publicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtC0HgIDiCdIRYDJwDVpf
cUOX8H5X0t66d5F+GOrB5cTWQC2+CtrLE2omYSrgNxWayW75z4dO7l6hP+gIFEGD
Bh/0OWVQQfIPgycRC/zZ1s0haTjnNj2dzOh5F4/EJWtCbSGDDQTBL+0z6fXqZoeE
J6Uba+dfUzKRiYBWMSOvY2vb4eZk5ZiGACTYzlKGCl1Vf7nwwEVeZqYpguo809QH
U+9UG/JHmBDlgTMWeYjG483Un5/UKeO0vDUaDjgVO6GKj+O4Ds1LjF0uUWQ9V6q5
Q24zwNN5TGl/lV8K2daR1IkXaz+QqxadoSrIfTNlsm1ZmPPnYfuSDfilSE0/qEg1
7wIDAQAB
-----END PUBLIC KEY-----`;

  const settings = {
    baseUrl: 'https://test.test',
    auth: {
      privateKey,
      publicKey,
      clientId: 'test',
      issuer: 'perseid',
      algorithm: 'RS256' as const,
    },
  };

  // Hash of "Test123!".
  const hashedPassword = '$2b$10$9oJWKREOivSdg9OCHq3Fz.rc6Tb43r4.QxXyTkSCL5tk8v.FmysNu';
  const userId = new Id('00000000-0000-7000-8000-000000000001');
  const resourceId = new Id('00000000-0000-7000-8000-000000000002');
  const roleId = new Id('00000000-0000-7000-8000-000000000003');
  const currentDevice = {
    _id: 'device1',
    _userAgent: 'Chrome',
    _refreshToken: 'refreshToken1',
    _expiration: new Date('2023-01-15T00:00:00.000Z'),
  };
  const otherDevice = {
    _id: 'device2',
    _userAgent: 'Safari',
    _refreshToken: 'refreshToken2',
    _expiration: new Date('2023-01-15T00:00:00.000Z'),
  };
  const expiredDevice = {
    _id: 'device3',
    _userAgent: 'Edge',
    _refreshToken: 'refreshToken3',
    _expiration: new Date('2022-12-15T00:00:00.000Z'),
  };

  const test = it.extend<{
    telemetry: Telemetry;
    cacheClient: CacheClient;
    emailClient: EmailClient;
    databaseClient: DatabaseClient;
    engine: AuthEngine<DataModel>;
  }>({
    telemetry: async ({ onTestFinished }, use) => {
      onTestFinished(() => { vi.restoreAllMocks(); });
      await use(new Telemetry());
    },
    cacheClient: async ({ telemetry }, use) => {
      await use(new CacheClient(telemetry, { cachePath: '/.cache', requestTimeout: 0 }));
    },
    emailClient: async ({ telemetry }, use) => {
      await use(new EmailClient(telemetry as never, { requestTimeout: 0 }));
    },
    databaseClient: async ({ telemetry, cacheClient }, use) => {
      await use(new DatabaseClient(new Model<DataModel>(schema), telemetry, cacheClient));
    },
    engine: async ({
      telemetry,
      cacheClient,
      emailClient,
      databaseClient,
    }, use) => {
      await use(new AuthEngine<DataModel>(
        new Model<DataModel>(schema),
        telemetry,
        databaseClient as unknown as AbstractDatabaseClient<DataModel>,
        emailClient,
        cacheClient,
        settings,
      ));
    },
  });

  describe('[viewMe]', () => {
    test('fetches current user', async ({ engine, databaseClient }) => {
      vi.spyOn(databaseClient, 'view').mockImplementation((resource, id) => Promise.resolve((
        resource === 'users' && String(id) === String(userId)
      ) ? { _id: id, email: 'test@test.test' } : null));
      expect(await engine.viewMe({
        session: {
          user: {
            _id: userId,
            _devices: [],
            email: 'test@test.test',
            _permissions: new Set(),
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
          },
        },
      })).toEqual({ _id: userId, email: 'test@test.test' });
    });

    test('rejects a user that does not exist', async ({ engine, databaseClient }) => {
      vi.spyOn(databaseClient, 'view').mockResolvedValueOnce(null);
      await expect(engine.viewMe({
        session: {
          user: {
            _id: userId,
            _devices: [],
            email: 'test@test.test',
            _permissions: new Set(),
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
          },
        },
      })).rejects.toMatchObject({ code: 'NO_RESOURCE', details: { id: userId } });
    });
  });

  describe('[verifyToken]', () => {
    test('returns the id of the user the token was issued for', async ({ engine }) => {
      const accessToken = jwt.sign({}, privateKey, {
        expiresIn: 60,
        issuer: 'perseid',
        audience: 'test',
        algorithm: 'RS256',
        subject: `${String(userId)}_device1`,
      });
      expect(await engine.verifyToken(accessToken, false, {
        session: { deviceId: 'device1' },
      })).toEqual(userId);
    });

    test('rejects a token issued for another device', async ({ engine }) => {
      const accessToken = jwt.sign({}, privateKey, {
        expiresIn: 60,
        issuer: 'perseid',
        audience: 'test',
        algorithm: 'RS256',
        subject: `${String(userId)}_device1`,
      });
      await expect(engine.verifyToken(accessToken, false, {
        session: { deviceId: 'device2' },
      })).rejects.toMatchObject({ code: 'INVALID_DEVICE_ID' });
    });

    test('rejects an expired token', async ({ engine }) => {
      const accessToken = jwt.sign({ exp: 1672531140 }, privateKey, {
        issuer: 'perseid',
        audience: 'test',
        algorithm: 'RS256',
        subject: `${String(userId)}_device1`,
      });
      await expect(engine.verifyToken(accessToken, false, {
        session: { deviceId: 'device1' },
      })).rejects.toThrow(jwt.TokenExpiredError);
    });

    test('accepts an expired token when asked to ignore expiration', async ({ engine }) => {
      const accessToken = jwt.sign({ exp: 1672531140 }, privateKey, {
        issuer: 'perseid',
        audience: 'test',
        algorithm: 'RS256',
        subject: `${String(userId)}_device1`,
      });
      expect(await engine.verifyToken(accessToken, true, {
        session: { deviceId: 'device1' },
      })).toEqual(userId);
    });
  });

  describe('[signUp]', () => {
    test('creates a new unverified user and sends a verification email', async ({
      engine,
      cacheClient,
      emailClient,
      databaseClient,
    }) => {
      const credentials = await engine.signUp('new@test.test', 'Test123!', 'Test123!', {
        session: { deviceId: 'device1', userAgent: 'Firefox' },
      });
      const [[, newUser]] = databaseClient.create.mock.calls as [[string, {
        _id: Id;
        password: string;
      }]];
      expect(credentials).toEqual({
        expiresIn: 1200,
        accessToken: expect.any(String) as string,
        deviceId: expect.stringMatching(/^[0-9a-f]{24}$/) as string,
        refreshToken: expect.stringMatching(/^[0-9a-f]{24}$/) as string,
        refreshTokenExpiration: new Date('2023-01-31T00:00:00.000Z'),
      });
      expect(jwt.verify(credentials.accessToken, publicKey)).toEqual({
        aud: 'test',
        iss: 'perseid',
        iat: 1672531200,
        exp: 1672532400,
        sub: `${String(newUser._id)}_${credentials.deviceId}`,
      });
      expect(databaseClient.create).toHaveBeenCalledOnce();
      expect(databaseClient.create).toHaveBeenCalledWith('users', {
        roles: [],
        _updatedAt: null,
        _updatedBy: null,
        _id: newUser._id,
        _verifiedAt: null,
        email: 'new@test.test',
        _createdBy: newUser._id,
        _createdAt: new Date('2023-01-01T00:00:00.000Z'),
        password: expect.stringMatching(/^\$2[aby]\$10\$/) as string,
        _devices: [{
          _userAgent: 'Firefox',
          _id: credentials.deviceId,
          _refreshToken: credentials.refreshToken,
          _expiration: new Date('2023-01-31T00:00:00.000Z'),
        }],
      });
      expect(await bcrypt.compare('Test123!', newUser.password)).toBe(true);
      const [[, verificationToken]] = vi.mocked(cacheClient.set).mock.calls;
      expect(cacheClient.set).toHaveBeenCalledOnce();
      expect(cacheClient.set).toHaveBeenCalledWith(
        `verify_${String(newUser._id)}`,
        expect.stringMatching(/^[0-9a-f]{24}$/),
        7200,
      );
      expect(emailClient.sendVerificationEmail).toHaveBeenCalledOnce();
      expect(emailClient.sendVerificationEmail).toHaveBeenCalledWith(
        'new@test.test',
        `https://test.test/verify-email?verificationToken=${String(verificationToken)}`,
      );
    });

    test('creates a new user from an unknown device', async ({ engine, databaseClient }) => {
      const credentials = await engine.signUp('new@test.test', 'Test123!', 'Test123!', {
        session: { deviceId: 'device1' },
      });
      expect(databaseClient.create).toHaveBeenCalledOnce();
      expect(databaseClient.create).toHaveBeenCalledWith('users', expect.objectContaining({
        _devices: [{
          _userAgent: 'UNKNOWN',
          _id: credentials.deviceId,
          _refreshToken: credentials.refreshToken,
          _expiration: new Date('2023-01-31T00:00:00.000Z'),
        }],
      }));
    });

    test('rejects mismatching passwords', async ({ engine, databaseClient, emailClient }) => {
      await expect(engine.signUp('new@test.test', 'Test123!', 'Test456!', {
        session: { deviceId: 'device1' },
      })).rejects.toMatchObject({ code: 'PASSWORDS_MISMATCH' });
      expect(databaseClient.create).not.toHaveBeenCalled();
      expect(emailClient.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe('[signIn]', () => {
    test('signs user in, replacing current device and removing expired ones', async ({ engine, databaseClient }) => {
      vi.spyOn(databaseClient, 'list').mockImplementation((resource, searchBody) => Promise.resolve((
        resource === 'users' && searchBody?.filters?.email === 'test@test.test'
      ) ? {
          total: 1,
          results: [{
            _id: userId,
            password: hashedPassword,
            _devices: [currentDevice, otherDevice, expiredDevice],
          }],
        } : { total: 0, results: [] }));
      const credentials = await engine.signIn('test@test.test', 'Test123!', 'device1', 'Firefox');
      expect(credentials).toEqual({
        deviceId: 'device1',
        expiresIn: 1200,
        accessToken: expect.any(String) as string,
        refreshToken: expect.stringMatching(/^[0-9a-f]{24}$/) as string,
        refreshTokenExpiration: new Date('2023-01-31T00:00:00.000Z'),
      });
      expect(jwt.verify(credentials.accessToken, publicKey)).toEqual({
        aud: 'test',
        iss: 'perseid',
        iat: 1672531200,
        exp: 1672532400,
        sub: `${String(userId)}_device1`,
      });
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('users', userId, {
        _updatedBy: userId,
        _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
        _devices: [{
          _id: 'device1',
          _userAgent: 'Firefox',
          _refreshToken: credentials.refreshToken,
          _expiration: new Date('2023-01-31T00:00:00.000Z'),
        }, otherDevice],
      });
    });

    test('signs user in from a new unknown device', async ({ engine, databaseClient }) => {
      vi.spyOn(databaseClient, 'list').mockImplementation((resource, searchBody) => Promise.resolve((
        resource === 'users' && searchBody?.filters?.email === 'test@test.test'
      ) ? {
          total: 1,
          results: [{ _id: userId, password: hashedPassword, _devices: [currentDevice] }],
        } : { total: 0, results: [] }));
      const credentials = await engine.signIn('test@test.test', 'Test123!');
      expect(credentials.deviceId).toMatch(/^[0-9a-f]{24}$/);
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('users', userId, {
        _updatedBy: userId,
        _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
        _devices: [{
          _userAgent: 'UNKNOWN',
          _id: credentials.deviceId,
          _refreshToken: credentials.refreshToken,
          _expiration: new Date('2023-01-31T00:00:00.000Z'),
        }, currentDevice],
      });
    });

    test('rejects an unknown email', async ({ engine, databaseClient }) => {
      await expect(engine.signIn('unknown@test.test', 'Test123!')).rejects.toMatchObject({
        code: 'NO_USER',
      });
      expect(databaseClient.update).not.toHaveBeenCalled();
    });

    test('rejects a wrong password', async ({ engine, databaseClient }) => {
      vi.spyOn(databaseClient, 'list').mockImplementation((resource, searchBody) => Promise.resolve((
        resource === 'users' && searchBody?.filters?.email === 'test@test.test'
      ) ? {
          total: 1,
          results: [{ _id: userId, password: hashedPassword, _devices: [] }],
        } : { total: 0, results: [] }));
      await expect(engine.signIn('test@test.test', 'Test456!')).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
      expect(databaseClient.update).not.toHaveBeenCalled();
    });
  });

  describe('[requestEmailVerification]', () => {
    test('sends a new verification email', async ({ engine, cacheClient, emailClient }) => {
      await engine.requestEmailVerification({
        session: {
          user: {
            _id: userId,
            _devices: [],
            _verifiedAt: null,
            email: 'test@test.test',
            _permissions: new Set(),
          },
        },
      });
      const [[, verificationToken]] = vi.mocked(cacheClient.set).mock.calls;
      expect(cacheClient.set).toHaveBeenCalledOnce();
      expect(cacheClient.set).toHaveBeenCalledWith(
        `verify_${String(userId)}`,
        expect.stringMatching(/^[0-9a-f]{24}$/),
        7200,
      );
      expect(emailClient.sendVerificationEmail).toHaveBeenCalledOnce();
      expect(emailClient.sendVerificationEmail).toHaveBeenCalledWith(
        'test@test.test',
        `https://test.test/verify-email?verificationToken=${String(verificationToken)}`,
      );
    });

    test('rejects an already verified user', async ({ engine, cacheClient, emailClient }) => {
      await expect(engine.requestEmailVerification({
        session: {
          user: {
            _id: userId,
            _devices: [],
            email: 'test@test.test',
            _permissions: new Set(),
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
          },
        },
      })).rejects.toMatchObject({ code: 'EMAIL_ALREADY_VERIFIED' });
      expect(cacheClient.set).not.toHaveBeenCalled();
      expect(emailClient.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe('[verifyEmail]', () => {
    test('verifies user email', async ({ engine, cacheClient, databaseClient }) => {
      vi.spyOn(cacheClient, 'get').mockImplementation((key) => Promise.resolve((
        key === `verify_${String(userId)}`
      ) ? 'verificationToken' : null));
      await engine.verifyEmail('verificationToken', {
        session: {
          user: {
            _id: userId,
            _devices: [],
            _verifiedAt: null,
            email: 'test@test.test',
            _permissions: new Set(),
          },
        },
      });
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('users', userId, {
        _updatedBy: userId,
        _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
        _verifiedAt: new Date('2023-01-01T00:00:00.000Z'),
      });
      expect(cacheClient.delete).toHaveBeenCalledOnce();
      expect(cacheClient.delete).toHaveBeenCalledWith(`verify_${String(userId)}`);
    });

    test('rejects an invalid verification token', async ({ engine, cacheClient, databaseClient }) => {
      vi.spyOn(cacheClient, 'get').mockImplementation((key) => Promise.resolve((
        key === `verify_${String(userId)}`
      ) ? 'verificationToken' : null));
      await expect(engine.verifyEmail('invalidToken', {
        session: {
          user: {
            _id: userId,
            _devices: [],
            _verifiedAt: null,
            email: 'test@test.test',
            _permissions: new Set(),
          },
        },
      })).rejects.toMatchObject({ code: 'INVALID_VERIFICATION_TOKEN' });
      expect(databaseClient.update).not.toHaveBeenCalled();
      expect(cacheClient.delete).not.toHaveBeenCalled();
    });
  });

  describe('[requestPasswordReset]', () => {
    test('sends a password reset email', async ({
      engine,
      cacheClient,
      emailClient,
      databaseClient,
    }) => {
      vi.spyOn(databaseClient, 'list').mockImplementation((resource, searchBody) => Promise.resolve((
        resource === 'users' && searchBody?.filters?.email === 'test@test.test'
      ) ? { total: 1, results: [{ _id: userId }] } : { total: 0, results: [] }));
      await engine.requestPasswordReset('test@test.test');
      const [[resetKey]] = vi.mocked(cacheClient.set).mock.calls;
      expect(cacheClient.set).toHaveBeenCalledOnce();
      expect(cacheClient.set).toHaveBeenCalledWith(
        expect.stringMatching(/^reset_[0-9a-f]{24}$/),
        'test@test.test',
        7200,
      );
      expect(emailClient.sendPasswordResetEmail).toHaveBeenCalledOnce();
      expect(emailClient.sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@test.test',
        `https://test.test/reset-password?resetToken=${resetKey.slice(6)}`,
      );
    });

    test('silently ignores an unknown email', async ({ engine, cacheClient, emailClient }) => {
      await engine.requestPasswordReset('unknown@test.test');
      expect(cacheClient.set).not.toHaveBeenCalled();
      expect(emailClient.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('[resetPassword]', () => {
    test('resets password, signing user out of all devices and verifying email', async ({
      engine,
      cacheClient,
      databaseClient,
    }) => {
      vi.spyOn(cacheClient, 'get').mockImplementation((key) => Promise.resolve((
        key === 'reset_resetToken'
      ) ? 'test@test.test' : null));
      vi.spyOn(databaseClient, 'list').mockImplementation((resource, searchBody) => Promise.resolve((
        resource === 'users' && searchBody?.filters?.email === 'test@test.test'
      ) ? { total: 1, results: [{ _id: userId, _verifiedAt: null }] } : { total: 0, results: [] }));
      await engine.resetPassword('Test456!', 'Test456!', 'resetToken');
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('users', userId, {
        _devices: [],
        _updatedBy: userId,
        _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
        _verifiedAt: new Date('2023-01-01T00:00:00.000Z'),
        password: expect.stringMatching(/^\$2[aby]\$10\$/) as string,
      });
      expect(cacheClient.delete).toHaveBeenCalledOnce();
      expect(cacheClient.delete).toHaveBeenCalledWith('reset_resetToken');
    });

    test('keeps the verification date of an already verified user', async ({
      engine,
      cacheClient,
      databaseClient,
    }) => {
      vi.spyOn(cacheClient, 'get').mockImplementation((key) => Promise.resolve((
        key === 'reset_resetToken'
      ) ? 'test@test.test' : null));
      vi.spyOn(databaseClient, 'list').mockImplementation((resource, searchBody) => Promise.resolve((
        resource === 'users' && searchBody?.filters?.email === 'test@test.test'
      ) ? {
          total: 1,
          results: [{ _id: userId, _verifiedAt: new Date('2022-01-01T00:00:00.000Z') }],
        } : { total: 0, results: [] }));
      await engine.resetPassword('Test456!', 'Test456!', 'resetToken');
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('users', userId, expect.objectContaining({
        _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
      }));
    });

    test('rejects an invalid reset token', async ({ engine, cacheClient, databaseClient }) => {
      vi.spyOn(cacheClient, 'get').mockImplementation((key) => Promise.resolve((
        key === 'reset_resetToken'
      ) ? 'test@test.test' : null));
      vi.spyOn(databaseClient, 'list').mockImplementation((resource, searchBody) => Promise.resolve((
        resource === 'users' && searchBody?.filters?.email === 'test@test.test'
      ) ? { total: 1, results: [{ _id: userId, _verifiedAt: null }] } : { total: 0, results: [] }));
      await expect(engine.resetPassword('Test456!', 'Test456!', 'invalidToken')).rejects.toMatchObject({
        code: 'INVALID_RESET_TOKEN',
      });
      expect(databaseClient.update).not.toHaveBeenCalled();
      expect(cacheClient.delete).not.toHaveBeenCalled();
    });

    test('rejects mismatching passwords', async ({ engine, databaseClient }) => {
      await expect(engine.resetPassword('Test456!', 'Test789!', 'resetToken')).rejects.toMatchObject({
        code: 'PASSWORDS_MISMATCH',
      });
      expect(databaseClient.update).not.toHaveBeenCalled();
    });
  });

  describe('[refreshToken]', () => {
    test('refreshes credentials of current device, removing expired ones', async ({ engine, databaseClient }) => {
      const credentials = await engine.refreshToken('refreshToken1', {
        session: {
          deviceId: 'device1',
          userAgent: 'Firefox',
          user: {
            _id: userId,
            email: 'test@test.test',
            _permissions: new Set(),
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
            _devices: [otherDevice, currentDevice, expiredDevice],
          },
        },
      });
      expect(credentials).toEqual({
        deviceId: 'device1',
        expiresIn: 1200,
        accessToken: expect.any(String) as string,
        refreshToken: expect.stringMatching(/^[0-9a-f]{24}$/) as string,
        refreshTokenExpiration: new Date('2023-01-31T00:00:00.000Z'),
      });
      expect(jwt.verify(credentials.accessToken, publicKey)).toEqual({
        aud: 'test',
        iss: 'perseid',
        iat: 1672531200,
        exp: 1672532400,
        sub: `${String(userId)}_device1`,
      });
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('users', userId, {
        _updatedBy: userId,
        _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
        _devices: [otherDevice, {
          _id: 'device1',
          _userAgent: 'Firefox',
          _refreshToken: credentials.refreshToken,
          _expiration: new Date('2023-01-31T00:00:00.000Z'),
        }],
      });
    });

    test('keeps the user agent of current device when it is unknown', async ({ engine, databaseClient }) => {
      const credentials = await engine.refreshToken('refreshToken1', {
        session: {
          deviceId: 'device1',
          user: {
            _id: userId,
            email: 'test@test.test',
            _permissions: new Set(),
            _devices: [otherDevice, currentDevice],
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
          },
        },
      });
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('users', userId, expect.objectContaining({
        _devices: [otherDevice, {
          _id: 'device1',
          _userAgent: 'Chrome',
          _refreshToken: credentials.refreshToken,
          _expiration: new Date('2023-01-31T00:00:00.000Z'),
        }],
      }));
    });

    test('rejects an invalid refresh token', async ({ engine, databaseClient }) => {
      await expect(engine.refreshToken('invalidToken', {
        session: {
          deviceId: 'device1',
          user: {
            _id: userId,
            email: 'test@test.test',
            _permissions: new Set(),
            _devices: [currentDevice],
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
          },
        },
      })).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
      expect(databaseClient.update).not.toHaveBeenCalled();
    });

    test('rejects an expired refresh token', async ({ engine, databaseClient }) => {
      await expect(engine.refreshToken('refreshToken3', {
        session: {
          deviceId: 'device3',
          user: {
            _id: userId,
            email: 'test@test.test',
            _permissions: new Set(),
            _devices: [expiredDevice],
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
          },
        },
      })).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
      expect(databaseClient.update).not.toHaveBeenCalled();
    });
  });

  describe('[signOut]', () => {
    test('removes current device and expired ones', async ({ engine, databaseClient }) => {
      await engine.signOut({
        queryOptions: { fields: ['_id'] },
        session: {
          deviceId: 'device1',
          user: {
            _id: userId,
            email: 'test@test.test',
            _permissions: new Set(),
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
            _devices: [currentDevice, otherDevice, expiredDevice],
          },
        },
      });
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('users', userId, {
        _updatedBy: userId,
        _devices: [otherDevice],
        _updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      }, { fields: ['_id'] });
    });
  });

  describe('[create]', () => {
    test('creates an unverified user with a hashed password, and sends an invitation email', async ({
      engine,
      emailClient,
      databaseClient,
    }) => {
      const result = await engine.create('users', {
        roles: [],
        password: 'Test123!',
        email: 'new@test.test',
      }, {});
      const [[, newUser]] = databaseClient.create.mock.calls as [[string, { password: string; }]];
      expect(databaseClient.create).toHaveBeenCalledOnce();
      expect(databaseClient.create).toHaveBeenCalledWith('users', {
        roles: [],
        _devices: [],
        _verifiedAt: null,
        email: 'new@test.test',
        _id: (result as { _id: Id; })._id,
        password: expect.stringMatching(/^\$2[aby]\$10\$/) as string,
      }, { fields: ['_id'], poolOrSession: 'SESSION' });
      expect(await bcrypt.compare('Test123!', newUser.password)).toBe(true);
      expect(emailClient.sendInviteEmail).toHaveBeenCalledOnce();
      expect(emailClient.sendInviteEmail).toHaveBeenCalledWith(
        'new@test.test',
        'https://test.test/sign-in',
        'Test123!',
      );
    });

    test('creates any other resource without email', async ({ engine, databaseClient, emailClient }) => {
      await engine.create('otherTest', {
        enum: 'ONE',
        optionalRelation: null,
        binary: new ArrayBuffer(0),
        data: { optionalRelation: null, optionalFlatArray: null },
      }, {});
      expect(databaseClient.create).toHaveBeenCalledOnce();
      expect(emailClient.sendInviteEmail).not.toHaveBeenCalled();
    });
  });

  describe('[update]', () => {
    test('requires a new verification on email change, signs user out on password change', async ({
      engine,
      databaseClient,
    }) => {
      await engine.update('users', resourceId, { email: 'new@test.test', password: 'Test456!' }, {});
      const [[, , payload]] = databaseClient.update.mock.calls as [[string, Id, {
        password: string;
      }]];
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('users', resourceId, {
        _devices: [],
        _verifiedAt: null,
        email: 'new@test.test',
        password: expect.stringMatching(/^\$2[aby]\$10\$/) as string,
      }, { fields: ['_id'], poolOrSession: 'SESSION' });
      expect(await bcrypt.compare('Test456!', payload.password)).toBe(true);
    });

    test('updates roles of a user allowed to', async ({ engine, databaseClient }) => {
      await engine.update('users', resourceId, { roles: [roleId] }, {
        session: {
          user: {
            _id: userId,
            _devices: [],
            email: 'test@test.test',
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
            _permissions: new Set(['USERS.UPDATE', 'USERS.UPDATE_ROLES']),
          },
        },
      });
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('users', resourceId, {
        roles: [roleId],
      }, { fields: ['_id'], poolOrSession: 'SESSION' });
    });

    test('updates roles when there is no session', async ({ engine, databaseClient }) => {
      await engine.update('users', resourceId, { roles: [roleId] }, {});
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('users', resourceId, {
        roles: [roleId],
      }, { fields: ['_id'], poolOrSession: 'SESSION' });
    });

    test('updates any other resource without checking roles', async ({ engine, databaseClient }) => {
      await engine.update('otherTest', resourceId, { enum: 'TWO' }, {
        session: {
          user: {
            _id: userId,
            _devices: [],
            email: 'test@test.test',
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
            _permissions: new Set(['OTHER_TEST.UPDATE']),
          },
        },
      });
      expect(databaseClient.update).toHaveBeenCalledOnce();
      expect(databaseClient.update).toHaveBeenCalledWith('otherTest', resourceId, {
        enum: 'TWO',
      }, { fields: ['_id'], poolOrSession: 'SESSION' });
    });

    test('rejects a roles update from a user not allowed to', async ({ engine, databaseClient }) => {
      await expect(engine.update('users', resourceId, { roles: [roleId] }, {
        session: {
          user: {
            _id: userId,
            _devices: [],
            email: 'test@test.test',
            _verifiedAt: new Date('2022-01-01T00:00:00.000Z'),
            _permissions: new Set(['USERS.UPDATE']),
          },
        },
      })).rejects.toMatchObject({ code: 'FORBIDDEN', details: { permission: 'USERS.UPDATE_ROLES' } });
      expect(databaseClient.update).not.toHaveBeenCalled();
    });

    test('rejects a roles update from an unverified user', async ({ engine, databaseClient }) => {
      await expect(engine.update('users', resourceId, { roles: [roleId] }, {
        session: {
          user: {
            _id: userId,
            _devices: [],
            _verifiedAt: null,
            email: 'test@test.test',
            _permissions: new Set(['USERS.UPDATE']),
          },
        },
      })).rejects.toMatchObject({ code: 'USER_NOT_VERIFIED' });
      expect(databaseClient.update).not.toHaveBeenCalled();
    });
  });
});
