/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  type FastifyError,
  type FastifyReply,
  type FastifyRequest,
  type FastifyInstance,
} from 'fastify';
import Gone from 'scripts/core/errors/Gone';
import Model from 'scripts/core/services/Model';
import Logger from 'scripts/core/services/Logger';
import NotFound from 'scripts/core/errors/NotFound';
import Conflict from 'scripts/core/errors/Conflict';
import Forbidden from 'scripts/core/errors/Forbidden';
import BadRequest from 'scripts/core/errors/BadRequest';
import Unauthorized from 'scripts/core/errors/Unauthorized';
import UsersEngine from 'scripts/core/services/UsersEngine';
import EmailClient from 'scripts/core/services/EmailClient';
import CacheClient from 'scripts/core/services/CacheClient';
import NotAcceptable from 'scripts/core/errors/NotAcceptable';
import { Id, type ResourceSchema } from '@perseid/core';
import TooManyRequests from 'scripts/core/errors/TooManyRequests';
import { type DataModel } from 'scripts/core/services/__mocks__/schema';
import UnprocessableEntity from 'scripts/core/errors/UnprocessableEntity';
import FastifyController from 'scripts/fastify/services/FastifyController';
import RequestEntityTooLarge from 'scripts/core/errors/RequestEntityTooLarge';
import MongoDatabaseClient from 'scripts/mongodb/services/MongoDatabaseClient';

type TestFastifyController = FastifyController<DataModel> & {
  apiHandlers: FastifyController['apiHandlers'];
  handleError: FastifyController['handleError'];
};

describe('fastify/services/FastifyController', () => {
  vi.mock('fastify');
  vi.mock('@perseid/core');
  vi.mock('scripts/core/services/Model');
  vi.mock('scripts/core/services/Logger');
  vi.mock('scripts/core/services/Controller');
  vi.mock('scripts/core/services/UsersEngine');
  vi.mock('scripts/core/services/EmailClient');
  vi.mock('scripts/core/services/CacheClient');
  vi.mock('scripts/mongodb/services/MongoDatabaseClient');

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
  let controller: TestFastifyController;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.INVALID_SEARCH_BODY;
    controller = new FastifyController<DataModel>(model, logger, engine, {
      version: '0.0.1',
      handleCORS: true,
      endpoints: {
        auth: {},
        resources: {},
      },
    }) as TestFastifyController;
  });

  describe('[handleError]', () => {
    test('BadRequest', async () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = new BadRequest('ERROR', 'Error');
      const response = { status } as unknown as FastifyReply;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
      await controller.handleError(error as FastifyError, request, response);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(400);
      expect(header).toHaveBeenCalledOnce();
      expect(header).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(send).toHaveBeenCalledOnce();
      expect(send).toHaveBeenCalledWith({ error: { code: 'ERROR', message: 'Error' } });
      expect(logger.info).toHaveBeenCalledOnce();
      expect(logger.info).toHaveBeenCalledWith(error, {
        headers: [],
        method: 'GET',
        statusCode: 400,
        url: 'https://test.test',
      });
    });

    test('Unauthorized', async () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = new Unauthorized('ERROR', 'Error');
      const response = { status } as unknown as FastifyReply;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
      await controller.handleError(error as FastifyError, request, response);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(401);
    });

    test('Forbidden', async () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = new Forbidden('ERROR', 'Error');
      const response = { status } as unknown as FastifyReply;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
      await controller.handleError(error as FastifyError, request, response);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(403);
    });

    test('NotFound', async () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = new NotFound('ERROR', 'Error');
      const response = { status } as unknown as FastifyReply;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
      await controller.handleError(error as FastifyError, request, response);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(404);
    });

    test('NotAcceptable', async () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = new NotAcceptable('ERROR', 'Error');
      const response = { status } as unknown as FastifyReply;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
      await controller.handleError(error as FastifyError, request, response);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(406);
    });

    test('Conflict', async () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = new Conflict('ERROR', 'Error');
      const response = { status } as unknown as FastifyReply;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
      await controller.handleError(error as FastifyError, request, response);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(409);
    });

    test('Gone', async () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = new Gone('ERROR', 'Error');
      const response = { status } as unknown as FastifyReply;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
      await controller.handleError(error as FastifyError, request, response);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(410);
    });

    test('UnprocessableEntity', async () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = new UnprocessableEntity('ERROR', 'Error');
      const response = { status } as unknown as FastifyReply;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
      await controller.handleError(error as FastifyError, request, response);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(422);
    });

    test('RequestEntityTooLarge', async () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = new RequestEntityTooLarge('ERROR', 'Error');
      const response = { status } as unknown as FastifyReply;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
      await controller.handleError(error as FastifyError, request, response);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(413);
    });

    test('TooManyRequests', async () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = new TooManyRequests('ERROR', 'Error');
      const response = { status } as unknown as FastifyReply;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
      await controller.handleError(error as FastifyError, request, response);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(429);
    });

    test('validation error', async () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = { validation: {} };
      const response = { status } as unknown as FastifyReply;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
      await controller.handleError(error as FastifyError, request, response);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(400);
    });

    test('payload error', async () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = { statusCode: 400 };
      const response = { status } as unknown as FastifyReply;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
      await controller.handleError(error as FastifyError, request, response);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(400);
      expect(send).toHaveBeenCalledOnce();
      expect(send).toHaveBeenCalledWith({ error: { code: 'INVALID_PAYLOAD', message: 'Invalid JSON payload.' } });
    });

    test('other error', async () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = {};
      const response = { status } as unknown as FastifyReply;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as FastifyRequest;
      await controller.handleError(error as FastifyError, request, response);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(500);
      expect(send).toHaveBeenCalledOnce();
      expect(send).toHaveBeenCalledWith({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal Server Error.' } });
      expect(logger.error).toHaveBeenCalledOnce();
      expect(logger.error).toHaveBeenCalledWith(error, {
        headers: [],
        method: 'GET',
        statusCode: 500,
        url: 'https://test.test',
      });
    });
  });

  describe('[createEndpoint]', () => {
    const handler = vi.fn();
    const request = {
      headers: {
        'x-device-id': 'valid',
        'user-agent': 'Chrome',
      },
      params: { id: '000000000000000000000001' },
      body: {},
      query: {},
      method: 'GET',
      url: 'https://test.test',
    } as unknown as FastifyRequest;

    test('body validation error', async () => {
      await expect(async () => {
        const endpoint = controller.createEndpoint({
          body: { fields: { error: { type: 'string' } } },
          handler,
        });
        await endpoint.handler(request, {} as FastifyReply);
      }).rejects.toThrow(new Error('body'));
    });

    test('headers validation error', async () => {
      await expect(async () => {
        const endpoint = controller.createEndpoint({
          headers: { fields: { error: { type: 'string' } } },
          handler,
        });
        await endpoint.handler(request, {} as FastifyReply);
      }).rejects.toThrow(new Error('headers'));
    });

    test('query validation error', async () => {
      await expect(async () => {
        const endpoint = controller.createEndpoint({
          query: { fields: { error: { type: 'string' } } },
          handler,
        });
        await endpoint.handler(request, {} as FastifyReply);
      }).rejects.toThrow(new Error('query'));
    });

    test('params validation error', async () => {
      await expect(async () => {
        const endpoint = controller.createEndpoint({
          params: { fields: { error: { type: 'string' } } },
          handler,
        });
        await endpoint.handler(request, {} as FastifyReply);
      }).rejects.toThrow(new Error('params'));
    });

    test('no error', async () => {
      const endpoint = controller.createEndpoint({
        authenticate: true,
        handler,
      });
      await endpoint.handler(request, {} as FastifyReply);
      expect(endpoint).toEqual({
        handler: expect.any(Function) as unknown,
      });
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(request, {});
      expect(request.params).toEqual({
        deviceId: 'valid',
        userAgent: 'Chrome',
        id: '000000000000000000000001',
        user: { _id: new Id('000000000000000000000001') },
      });
    });
  });

  describe('[createEndpoints]', () => {
    test('handler error', async () => {
      process.env.INVALID_SEARCH_BODY = 'true';
      const send = vi.fn();
      const catchError = vi.fn((e: unknown) => e);
      const request = { params: {}, body: { query: { on: [] } }, query: {} } as FastifyRequest;
      const response = { send, status: vi.fn(() => ({ send })) } as unknown as FastifyReply;
      const server = {
        get: vi.fn(),
        put: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
      };
      const instance = {
        addHook: vi.fn(async (_event, callback: (...args: unknown[]) => Promise<void>) => {
          try {
            await callback({ method: 'OPTIONS' }, {
              header: vi.fn(),
              status: vi.fn(() => ({ send: vi.fn() })),
            });
          } catch (e) {
            vi.fn(() => e);
          }
        }),
        setErrorHandler: vi.fn(),
        setNotFoundHandler: vi.fn(),
        setValidatorCompiler: vi.fn(),
        addContentTypeParser: vi.fn((_, callback: (...args: unknown[]) => unknown) => {
          callback('', { headers: { 'content-type': 'multipart/form-data' } }, vi.fn());
          callback('', { headers: { 'content-type': 'application/json' }, on: vi.fn() }, vi.fn());
        }),
        register: vi.fn((callback: (...args: unknown[]) => unknown) => (
          callback(server, null, vi.fn())
        )),
      } as unknown as FastifyInstance;
      vi.spyOn(controller, 'createEndpoint').mockImplementation(({ handler }) => {
        handler(request, response).catch(catchError);
        return { handler };
      });
      await expect(async () => {
        await controller.apiHandlers._model.handler({
          query: { resource: 'unknown', id: 'me' },
        } as FastifyRequest, response);
      }).rejects.toEqual(new NotFound('NO_RESOURCE', 'Resource type "unknown" does not exist.'));
      await controller.createEndpoints(instance);
    });

    test('no error', async () => {
      const send = vi.fn();
      const catchError = vi.fn((e: unknown) => e);
      const request = { params: {}, body: { query: { on: [] } }, query: {} } as FastifyRequest;
      const response = { send, status: vi.fn(() => ({ send })) } as unknown as FastifyReply;
      vi.spyOn(controller, 'createEndpoint').mockImplementation(({ handler }) => {
        handler(request, response).catch(catchError);
        return { handler };
      });
      await expect(async () => {
        await controller.apiHandlers._model.handler({
          query: { resource: 'unknown', id: 'me' },
        } as FastifyRequest, response);
      }).rejects.toEqual(new NotFound('NO_RESOURCE', 'Resource type "unknown" does not exist.'));
      const server = {
        get: vi.fn(),
        put: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
      };
      const instance = {
        addHook: vi.fn(async (_event, callback: (...args: unknown[]) => Promise<void>) => {
          try {
            await callback({ method: 'OPTIONS' }, {
              header: vi.fn(),
              status: vi.fn(() => ({ send: vi.fn() })),
            });
          } catch (e) {
            vi.fn(() => e);
          }
        }),
        setErrorHandler: vi.fn(),
        setNotFoundHandler: vi.fn(),
        setValidatorCompiler: vi.fn(),
        addContentTypeParser: vi.fn((_, callback: (...args: unknown[]) => unknown) => {
          callback('', { headers: { 'content-type': 'multipart/form-data' } }, vi.fn());
          callback('', { headers: { 'content-type': 'application/json' }, on: vi.fn() }, vi.fn());
        }),
        register: vi.fn((callback: (...args: unknown[]) => unknown) => (
          callback(server, null, vi.fn())
        )),
      } as unknown as FastifyInstance;
      const handler = expect.any(Function) as unknown;
      await controller.createEndpoints(instance);
      expect(send).toHaveBeenCalledTimes(22);
      expect(send).toHaveBeenCalledWith({});
      expect(server.delete).toHaveBeenCalledTimes(2);
      expect(server.delete).toHaveBeenCalledWith('/users/:id', { handler });
      expect(server.delete).toHaveBeenCalledWith('/roles/:id', { handler });
      expect(server.get).toHaveBeenCalledTimes(6);
      expect(server.get).toHaveBeenCalledWith('/users', { handler });
      expect(server.get).toHaveBeenCalledWith('/roles', { handler });
      expect(server.get).toHaveBeenCalledWith('/_model', { handler });
      expect(server.get).toHaveBeenCalledWith('/auth/me', { handler });
      expect(server.get).toHaveBeenCalledWith('/users/:id', { handler });
      expect(server.get).toHaveBeenCalledWith('/roles/:id', { handler });
      expect(server.put).toHaveBeenCalledTimes(4);
      expect(server.put).toHaveBeenCalledWith('/users/:id', { handler });
      expect(server.put).toHaveBeenCalledWith('/roles/:id', { handler });
      expect(server.put).toHaveBeenCalledWith('/auth/verify-email', { handler });
      expect(server.put).toHaveBeenCalledWith('/auth/reset-password', { handler });
      expect(server.post).toHaveBeenCalledTimes(10);
      expect(server.post).toHaveBeenCalledWith('/users', { handler });
      expect(server.post).toHaveBeenCalledWith('/roles', { handler });
      expect(server.post).toHaveBeenCalledWith('/users/:id', { handler });
      expect(server.post).toHaveBeenCalledWith('/roles/:id', { handler });
      expect(server.post).toHaveBeenCalledWith('/auth/sign-in', { handler });
      expect(server.post).toHaveBeenCalledWith('/auth/sign-up', { handler });
      expect(server.post).toHaveBeenCalledWith('/auth/sign-out', { handler });
      expect(server.post).toHaveBeenCalledWith('/auth/verify-email', { handler });
      expect(server.post).toHaveBeenCalledWith('/auth/reset-password', { handler });
      expect(server.post).toHaveBeenCalledWith('/auth/refresh-token', { handler });
      expect(instance.addHook).toHaveBeenCalledTimes(4);
      expect(instance.addHook).toHaveBeenCalledWith('onSend', expect.any(Function));
      expect(instance.addHook).toHaveBeenCalledWith('onRequest', expect.any(Function));
      expect(instance.addHook).toHaveBeenCalledWith('onTimeout', expect.any(Function));
      expect(instance.addContentTypeParser).toHaveBeenCalledOnce();
    });
  });
});
