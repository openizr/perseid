/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import express from 'express';
import {
  type Request,
  type Response,
  type Application,
  type NextFunction,
} from 'express';
import Gone from 'scripts/errors/Gone';
import Model from 'scripts/services/Model';
import Logger from 'scripts/services/Logger';
import NotFound from 'scripts/errors/NotFound';
import Conflict from 'scripts/errors/Conflict';
import Forbidden from 'scripts/errors/Forbidden';
import BadRequest from 'scripts/errors/BadRequest';
import Unauthorized from 'scripts/errors/Unauthorized';
import UsersEngine from 'scripts/services/UsersEngine';
import EmailClient from 'scripts/services/EmailClient';
import CacheClient from 'scripts/services/CacheClient';
import { Id, type ResourceSchema } from '@perseid/core';
import NotAcceptable from 'scripts/errors/NotAcceptable';
import TooManyRequests from 'scripts/errors/TooManyRequests';
import { type DataModel } from 'scripts/services/__mocks__/schema';
import ExpressController from 'scripts/services/ExpressController';
import UnprocessableEntity from 'scripts/errors/UnprocessableEntity';
import MongoDatabaseClient from 'scripts/services/MongoDatabaseClient';
import RequestEntityTooLarge from 'scripts/errors/RequestEntityTooLarge';

type Handler = (request: Request, response: Response, next: NextFunction) => Promise<void>;

type TestExpressController = ExpressController<DataModel> & {
  apiHandlers: ExpressController['apiHandlers'];
  handleError: ExpressController['handleError'];
};

describe('services/ExpressController', () => {
  vi.mock('express');
  vi.mock('@perseid/core');
  vi.mock('scripts/services/Model');
  vi.mock('scripts/services/Logger');
  vi.mock('scripts/services/Controller');
  vi.mock('scripts/services/UsersEngine');
  vi.mock('scripts/services/EmailClient');
  vi.mock('scripts/services/CacheClient');
  vi.mock('scripts/services/MongoDatabaseClient');

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
  let controller: TestExpressController;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.INVALID_SEARCH_BODY;
    controller = new ExpressController<DataModel>(model, logger, engine, {
      version: '0.0.1',
      handleCORS: true,
      endpoints: {
        auth: {},
        resources: {},
      },
    }) as TestExpressController;
  });

  describe('[handleError]', () => {
    test('timeout', () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const response = { status } as unknown as Response;
      const request = {
        headers: {},
        method: 'GET',
        timedout: true,
        url: 'https://test.test',
      } as unknown as Request;
      controller.handleError(null, request, response, vi.fn);
      expect(send).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledOnce();
      const message = 'Request "GET https://test.test" timed out.';
      expect(logger.error).toHaveBeenCalledWith(new Error(message), {
        headers: [],
        method: 'GET',
        statusCode: 504,
        url: 'https://test.test',
      });
    });

    test('BadRequest', () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = new BadRequest('ERROR', 'Error');
      const response = { status } as unknown as Response;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as Request;
      controller.handleError(error as unknown, request, response, vi.fn);
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

    test('Unauthorized', () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = new Unauthorized('ERROR', 'Error');
      const response = { status } as unknown as Response;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as Request;
      controller.handleError(error as unknown, request, response, vi.fn);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(401);
    });

    test('Forbidden', () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = new Forbidden('ERROR', 'Error');
      const response = { status } as unknown as Response;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as Request;
      controller.handleError(error as unknown, request, response, vi.fn);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(403);
    });

    test('NotFound', () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = new NotFound('ERROR', 'Error');
      const response = { status } as unknown as Response;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as Request;
      controller.handleError(error as unknown, request, response, vi.fn);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(404);
    });

    test('NotAcceptable', () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = new NotAcceptable('ERROR', 'Error');
      const response = { status } as unknown as Response;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as Request;
      controller.handleError(error as unknown, request, response, vi.fn);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(406);
    });

    test('Conflict', () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = new Conflict('ERROR', 'Error');
      const response = { status } as unknown as Response;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as Request;
      controller.handleError(error as unknown, request, response, vi.fn);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(409);
    });

    test('Gone', () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = new Gone('ERROR', 'Error');
      const response = { status } as unknown as Response;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as Request;
      controller.handleError(error as unknown, request, response, vi.fn);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(410);
    });

    test('UnprocessableEntity', () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = new UnprocessableEntity('ERROR', 'Error');
      const response = { status } as unknown as Response;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as Request;
      controller.handleError(error as unknown, request, response, vi.fn);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(422);
    });

    test('RequestEntityTooLarge', () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = new RequestEntityTooLarge('ERROR', 'Error');
      const response = { status } as unknown as Response;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as Request;
      controller.handleError(error as unknown, request, response, vi.fn);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(413);
    });

    test('TooManyRequests', () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = new TooManyRequests('ERROR', 'Error');
      const response = { status } as unknown as Response;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as Request;
      controller.handleError(error as unknown, request, response, vi.fn);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(429);
    });

    test('payload error', () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = { statusCode: 400 };
      const response = { status } as unknown as Response;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as Request;
      controller.handleError(error as unknown, request, response, vi.fn);
      expect(status).toHaveBeenCalledOnce();
      expect(status).toHaveBeenCalledWith(400);
      expect(send).toHaveBeenCalledOnce();
      expect(send).toHaveBeenCalledWith({ error: { code: 'INVALID_PAYLOAD', message: 'Invalid JSON payload.' } });
    });

    test('other error', () => {
      const send = vi.fn();
      const header = vi.fn(() => ({ send }));
      const status = vi.fn(() => ({ header }));
      const error = {};
      const response = { status } as unknown as Response;
      const request = { headers: {}, method: 'GET', url: 'https://test.test' } as Request;
      controller.handleError(error as unknown, request, response, vi.fn);
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
    const next = vi.fn();
    const handler = vi.fn();
    const response = {} as Response;
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
    } as unknown as Request;

    test('body validation error', async () => {
      const endpoint = controller.createEndpoint({
        body: { fields: { error: { type: 'string' } } },
        handler,
      });
      await ((endpoint.handler as unknown as Handler)(request, response, next));
      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith(new Error('body'));
    });

    test('headers validation error', async () => {
      const endpoint = controller.createEndpoint({
        headers: { fields: { error: { type: 'string' } } },
        handler,
      });
      await ((endpoint.handler as unknown as Handler)(request, response, next));
      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith(new Error('headers'));
    });

    test('query validation error', async () => {
      const endpoint = controller.createEndpoint({
        query: { fields: { error: { type: 'string' } } },
        handler,
      });
      await ((endpoint.handler as unknown as Handler)(request, response, next));
      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith(new Error('query'));
    });

    test('params validation error', async () => {
      const endpoint = controller.createEndpoint({
        params: { fields: { error: { type: 'string' } } },
        handler,
      });
      await ((endpoint.handler as unknown as Handler)(request, response, next));
      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith(new Error('params'));
    });

    test('no error', async () => {
      const endpoint = controller.createEndpoint({
        authenticate: true,
        handler,
      });
      await ((endpoint.handler as unknown as Handler)(request, response, next));
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
      const send = vi.fn();
      const catchError = vi.fn((e: unknown) => e);
      process.env.INVALID_SEARCH_BODY = 'true';
      const request = { params: {}, body: { query: { on: [] } }, query: {} } as Request;
      const response = { send, status: vi.fn(() => ({ send })) } as unknown as Response;
      vi.spyOn(express, 'json').mockImplementation(vi.fn(() => (): null => null));
      vi.spyOn(controller, 'handleError').mockImplementation(vi.fn(() => (): null => null));
      vi.spyOn(controller, 'createEndpoint').mockImplementation(({ handler }) => {
        (handler(request, response) as unknown as null | Promise<void>)?.catch(catchError);
        return { handler: handler as unknown as () => void };
      });
      const instance = {
        use: vi.fn((callback: (req: unknown, res: unknown, next: unknown) => void) => {
          callback({ headers: {} }, { header: vi.fn(), status: vi.fn(), send }, vi.fn);
        }),
        get: vi.fn(),
        put: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
      } as unknown as Application;
      expect(() => {
        controller.apiHandlers._model.handler({
          query: { resource: 'unknown', id: 'me' },
        } as unknown as Request, response);
      }).toThrow(new NotFound('NO_RESOURCE', 'Resource type "unknown" does not exist.'));
      await controller.createEndpoints(instance);
    });

    test('no error', async () => {
      const send = vi.fn();
      const header = vi.fn();
      const status = vi.fn(() => ({ send }));
      const catchError = vi.fn((e: unknown) => e);
      const request = { params: {}, body: { query: { on: [] } }, query: {} } as Request;
      const response = { send, status: vi.fn(() => ({ send })) } as unknown as Response;
      vi.spyOn(express, 'json').mockImplementation(vi.fn(() => (): null => null));
      vi.spyOn(controller, 'handleError').mockImplementation(vi.fn(() => (): null => null));
      vi.spyOn(controller, 'createEndpoint').mockImplementation(({ handler }) => {
        (handler(request, response) as unknown as null | Promise<void>)?.catch(catchError);
        return { handler: handler as unknown as () => void };
      });
      const instance = {
        use: vi.fn((callback: (req: unknown, res: unknown, next: unknown) => void) => {
          const res = { header, status, send };
          callback({ headers: {}, method: 'GET' }, res, vi.fn);
          callback({ headers: {}, method: 'OPTIONS' }, res, vi.fn);
          res.send();
        }),
        get: vi.fn(),
        put: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
      } as unknown as Application;
      const handler = expect.any(Function) as unknown;
      await controller.createEndpoints(instance, {});
      expect(send).toHaveBeenCalledTimes(29);
      expect(send).toHaveBeenCalledWith({});
      expect(instance.delete).toHaveBeenCalledTimes(2);
      expect(instance.delete).toHaveBeenCalledWith('/users/:id', handler);
      expect(instance.delete).toHaveBeenCalledWith('/roles/:id', handler);
      expect(instance.get).toHaveBeenCalledTimes(6);
      expect(instance.get).toHaveBeenCalledWith('/users', handler);
      expect(instance.get).toHaveBeenCalledWith('/roles', handler);
      expect(instance.get).toHaveBeenCalledWith('/_model', handler);
      expect(instance.get).toHaveBeenCalledWith('/auth/me', handler);
      expect(instance.get).toHaveBeenCalledWith('/users/:id', handler);
      expect(instance.get).toHaveBeenCalledWith('/roles/:id', handler);
      expect(instance.put).toHaveBeenCalledTimes(4);
      expect(instance.put).toHaveBeenCalledWith('/users/:id', handler);
      expect(instance.put).toHaveBeenCalledWith('/roles/:id', handler);
      expect(instance.put).toHaveBeenCalledWith('/auth/verify-email', handler);
      expect(instance.put).toHaveBeenCalledWith('/auth/reset-password', handler);
      expect(instance.post).toHaveBeenCalledTimes(10);
      expect(instance.post).toHaveBeenCalledWith('/users', handler);
      expect(instance.post).toHaveBeenCalledWith('/roles', handler);
      expect(instance.post).toHaveBeenCalledWith('/users/:id', handler);
      expect(instance.post).toHaveBeenCalledWith('/roles/:id', handler);
      expect(instance.post).toHaveBeenCalledWith('/auth/sign-in', handler);
      expect(instance.post).toHaveBeenCalledWith('/auth/sign-up', handler);
      expect(instance.post).toHaveBeenCalledWith('/auth/sign-out', handler);
      expect(instance.post).toHaveBeenCalledWith('/auth/verify-email', handler);
      expect(instance.post).toHaveBeenCalledWith('/auth/reset-password', handler);
      expect(instance.post).toHaveBeenCalledWith('/auth/refresh-token', handler);
      expect(instance.use).toHaveBeenCalledTimes(6);
      expect(header).toHaveBeenCalledTimes(8);
      expect(header).toHaveBeenCalledWith('X-Api-Version', '0.0.1');
      expect(header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(header).toHaveBeenCalledWith('Access-Control-Allow-Headers', '*');
      expect(header).toHaveBeenCalledWith('Access-Control-Allow-Methods', '*');
    });
  });
});
