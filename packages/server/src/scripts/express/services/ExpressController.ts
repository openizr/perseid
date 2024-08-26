/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import express, {
  type Request,
  type Response,
  type Application,
  type NextFunction,
  type RequestHandler,
} from 'express';
import {
  Id,
  type ResourceSchema,
  type DefaultDataModel,
  type DataModelMetadata,
} from '@perseid/core';
import Controller, {
  type EndpointType,
  type CustomEndpoint,
  type BuiltInEndpoint,
} from 'scripts/core/services/Controller';
import Gone from 'scripts/core/errors/Gone';
import BaseModel from 'scripts/core/services/Model';
import NotFound from 'scripts/core/errors/NotFound';
import Conflict from 'scripts/core/errors/Conflict';
import Forbidden from 'scripts/core/errors/Forbidden';
import type HttpError from 'scripts/core/errors/Http';
import BadRequest from 'scripts/core/errors/BadRequest';
import Unauthorized from 'scripts/core/errors/Unauthorized';
import NotAcceptable from 'scripts/core/errors/NotAcceptable';
import type UsersEngine from 'scripts/core/services/UsersEngine';
import TooManyRequests from 'scripts/core/errors/TooManyRequests';
import UnprocessableEntity from 'scripts/core/errors/UnprocessableEntity';
import RequestEntityTooLarge from 'scripts/core/errors/RequestEntityTooLarge';

/**
 * Custom endpoint configuration.
 */
export interface ExpressCustomEndpoint<
  DataModel extends DefaultDataModel
> extends CustomEndpoint<DataModel> {
  /** Actual endpoint handler. */
  handler: (request: Request, response: Response) => Promise<void>;
}

/**
 * API controller, designed for the Express framework.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/express/services/ExpressController.ts
 */
export default class ExpressController<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel = DefaultDataModel,

  /** Model class types definitions. */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,

  /** Database client types definition. */
  Engine extends UsersEngine<DataModel> = UsersEngine<DataModel>,
> extends Controller<DataModel, Model, Engine> {
  /** Built-in API handlers for auth-related endpoints. */
  protected apiHandlers: Record<string, ExpressCustomEndpoint<DataModel>> = {
    _model: {
      authenticate: false,
      handler: ((request, response) => {
        const { resource } = request.query as { resource: keyof DataModel & string; };
        const publicSchema = this.model.getPublicSchema(resource);
        if (publicSchema === null) {
          throw new NotFound('NO_RESOURCE_TYPE', `Resource type "${resource}" does not exist.`);
        }
        response.status(200).send(publicSchema);
      }) as ExpressCustomEndpoint<DataModel>['handler'],
      query: {
        fields: {
          resource: { type: 'string', isRequired: true },
        },
      },
    },
    signUp: {
      handler: async (request, response) => {
        const context = request.params as unknown as CommandContext<DataModel>;
        const { email, password, passwordConfirmation: confirmation } = request.body as {
          email: string;
          password: string;
          passwordConfirmation: string;
        };
        const credentials = await this.engine.signUp(email, password, confirmation, context);
        response.status(201).send(credentials);
      },
      body: {
        fields: {
          email: BaseModel.email(),
          password: BaseModel.password(),
          passwordConfirmation: BaseModel.password(),
        },
      },
    },
    signIn: {
      handler: async (request, response) => {
        const context = request.params as unknown as CommandContext<DataModel>;
        const { email, password } = request.body as Record<string, string>;
        const credentials = await this.engine.signIn(email, password, context);
        response.status(200).send(credentials);
      },
      headers: {
        fields: {
          'x-device-id': {
            type: 'string',
            isRequired: true,
            errorMessages: {
              type: 'must be a valid device id',
              pattern: 'must be a valid device id',
            },
          },
        },
      },
      body: {
        fields: {
          email: { type: 'string', isRequired: true },
          password: { type: 'string', isRequired: true },
        },
      },
    },
    viewMe: {
      authenticate: true,
      handler: async (request, response) => {
        const context = request.params as unknown as CommandContext<DataModel>;
        const user = await this.engine.viewMe(context);
        response.status(200).send(user);
      },
      headers: {
        fields: {
          'x-device-id': {
            type: 'string',
            isRequired: true,
            errorMessages: {
              type: 'must be a valid device id',
              pattern: 'must be a valid device id',
            },
          },
        },
      },
    },
    refreshToken: {
      authenticate: true,
      ignoreExpiration: true,
      handler: async (request, response) => {
        const context = request.params as unknown as CommandContext<DataModel>;
        const { refreshToken } = request.body as { refreshToken: string; };
        const credentials = await this.engine.refreshToken(refreshToken, context);
        response.status(200).send(credentials);
      },
      body: {
        fields: {
          refreshToken: BaseModel.token(),
        },
      },
    },
    requestPasswordReset: {
      handler: async (request, response) => {
        const { email } = request.body as { email: string; };
        await this.engine.requestPasswordReset(email);
        response.status(200).send();
      },
      body: {
        fields: {
          email: BaseModel.email(),
        },
      },
    },
    resetPassword: {
      handler: async (request, response) => {
        const { resetToken, password, passwordConfirmation } = request.body as {
          password: string;
          resetToken: string;
          passwordConfirmation: string;
        };
        await this.engine.resetPassword(password, passwordConfirmation, resetToken);
        response.status(200).send();
      },
      body: {
        fields: {
          password: BaseModel.password(),
          resetToken: BaseModel.token(),
          passwordConfirmation: BaseModel.password(),
        },
      },
    },
    requestEmailVerification: {
      authenticate: true,
      handler: async (request, response) => {
        const context = request.params as unknown as CommandContext<DataModel>;
        await this.engine.requestEmailVerification(context);
        response.status(200).send();
      },
    },
    verifyEmail: {
      authenticate: true,
      handler: async (request, response) => {
        const context = request.params as unknown as CommandContext<DataModel>;
        const { verificationToken } = request.body as { verificationToken: string; };
        await this.engine.verifyEmail(verificationToken, context);
        response.status(200).send();
      },
      body: {
        fields: {
          verificationToken: BaseModel.token(),
        },
      },
    },
    signOut: {
      authenticate: true,
      ignoreExpiration: true,
      handler: async (request, response) => {
        await this.engine.signOut(request.params as unknown as CommandContext<DataModel>);
        response.status(200).send();
      },
    },
  };

  /**
   * Handles thrown errors and formats a clean HTTP response.
   *
   * @param error Error thrown by express.
   *
   * @param request Express request.
   *
   * @param response Express response.
   */
  protected handleError(
    error: unknown,
    request: Request,
    response: Response,
    next: NextFunction,
  ): void {
    // Logs requests timeouts.
    if ((request as unknown as { timedout: boolean; }).timedout) {
      this.logger.silent(next);
      this.logger.error(new Error(`Request "${request.method} ${request.url}" timed out.`), {
        statusCode: 504,
        url: request.url,
        method: request.method,
        headers: Object.keys(request.headers),
      });
    } else {
      let message = 'Internal Server Error.';
      let errorCode = 'INTERNAL_SERVER_ERROR';
      let statusCode = 500;

      if (error instanceof BadRequest) {
        statusCode = 400;
      } else if (error instanceof Unauthorized) {
        statusCode = 401;
      } else if (error instanceof Forbidden) {
        statusCode = 403;
      } else if (error instanceof NotFound) {
        statusCode = 404;
      } else if (error instanceof NotAcceptable) {
        statusCode = 406;
      } else if (error instanceof Conflict) {
        statusCode = 409;
      } else if (error instanceof Gone) {
        statusCode = 410;
      } else if (error instanceof UnprocessableEntity) {
        statusCode = 422;
      } else if (error instanceof RequestEntityTooLarge) {
        statusCode = 413;
      } else if (error instanceof TooManyRequests) {
        statusCode = 429;
      }

      // HTTP 500 errors reason should not be displayed to end user.
      // Invalid JSON payloads throw a SyntaxError when express tries to parse them.
      if (statusCode === 500 && (error as { statusCode: number; }).statusCode === 400) {
        statusCode = 400;
        errorCode = 'INVALID_PAYLOAD';
        message = 'Invalid JSON payload.';
      } else if (statusCode !== 500) {
        errorCode = (error as HttpError).code as string;
        message = (error as HttpError).message;
      }

      this.logger[(statusCode === 500) ? 'error' : 'info'](error, {
        statusCode,
        url: request.url,
        method: request.method,
        headers: Object.keys(request.headers),
      });

      response
        .status(statusCode)
        .header('Content-Type', 'application/json')
        .send({ error: { code: errorCode, message } });
    }
  }

  /**
   * Creates a new express endpoint from `settings`.
   *
   * @param settings Endpoint configuration.
   *
   * @returns Express endpoint to register.
   */
  public createEndpoint(settings: ExpressCustomEndpoint<DataModel>): {
    handler: RequestHandler;
  } {
    const validateBody = this.ajv.compile(this.AJV_FORMATTERS.object({
      type: 'object',
      isRequired: true,
      fields: settings.body?.fields ?? {},
    }, settings.body?.allowPartial !== true));
    const validateQuery = this.ajv.compile(this.AJV_FORMATTERS.object({
      type: 'object',
      isRequired: true,
      fields: settings.query?.fields ?? {},
    }, settings.query?.allowPartial !== true));
    const validateParams = this.ajv.compile(this.AJV_FORMATTERS.object({
      type: 'object',
      isRequired: true,
      fields: settings.params?.fields ?? {},
    }, settings.params?.allowPartial !== true));
    const headersSchema = this.AJV_FORMATTERS.object({
      type: 'object',
      isRequired: true,
      fields: {
        ...settings.headers?.fields,
        ...(settings.authenticate ? {
          'x-device-id': {
            type: 'string',
            isRequired: true,
            errorMessages: {
              type: 'must be a valid device id',
              pattern: 'must be a valid device id',
            },
          },
        } : {}),
      },
    }, false);
    headersSchema.additionalProperties = true;
    const validateHeaders = this.ajv.compile(headersSchema);
    return {
      handler: (async (request: Request, response: Response, next: NextFunction): Promise<void> => {
        try {
          await this.catchErrors(async () => {
            let user: DataModel['users'] | null = null;

            if (settings.body !== undefined && !validateBody(request.body)) {
              throw this.formatError(validateBody.errors?.[0], 'body');
            }

            if (!validateHeaders(request.headers)) {
              throw this.formatError(validateHeaders.errors?.[0], 'headers');
            }

            if (!validateQuery(request.query)) {
              throw this.formatError(validateQuery.errors?.[0], 'query');
            }

            if (!validateParams(request.params)) {
              throw this.formatError(validateParams.errors?.[0], 'params');
            }

            const parsedQuery = this.parseQuery(request.query as Record<string, string | null>);
            request.query = parsedQuery as unknown as Request['query'];
            const deviceId = String(request.headers['x-device-id']);
            const userAgent = request.headers['user-agent'] as unknown as string;
            (request.params as unknown as CommandContext<DataModel>).deviceId = deviceId;
            (request.params as unknown as CommandContext<DataModel>).userAgent = userAgent;

            if (settings.authenticate) {
              const accessToken = String(request.headers.authorization).replace('Bearer ', '');
              user = await this.auth(accessToken, deviceId, settings.ignoreExpiration);
              (request.params as unknown as CommandContext<DataModel>).user = user;
            }

            await settings.handler(request, response);
          });
        } catch (error) {
          next(error);
        }
      }) as unknown as RequestHandler,
    };
  }

  /**
   * Registers hooks, handlers, auth and CRUD-related endpoints to `instance`.
   *
   * @param instance Express instance to register endpoints and hooks to.
   *
   * @param options Additional options to pass to express `register` function.
   */
  public async createEndpoints(
    instance: Application,
    options?: { prefix?: string; },
  ): Promise<void> {
    await Promise.resolve();
    const prefix = options?.prefix ?? '';

    // Response formatting for serialization.
    instance.use((_request, response, next): void => {
      const originalSend = response.send.bind(response);
      (response as unknown as { send: (body: unknown) => void }).send = (body): void => {
        originalSend(this.formatOutput(body));
      };
      next();
    });

    // API Versionning.
    instance.use((_request, response, next) => {
      response.header('X-Api-Version', this.version);
      next();
    });

    // CORS automatic handling.
    if (this.handleCORS) {
      instance.use((request, response, next) => {
        response.header('Access-Control-Allow-Origin', '*');
        response.header('Access-Control-Allow-Headers', '*');
        response.header('Access-Control-Allow-Methods', '*');
        if (request.method === 'OPTIONS') {
          response.status(200).send();
        } else {
          next();
        }
      });
    }

    // Parses request body.
    instance.use(express.json());

    // Model endpoint.
    const { handler: modelHandler } = this.createEndpoint(this.apiHandlers._model);
    instance.get(`${prefix}/_model`, modelHandler as unknown as () => void);

    // Auth endpoints.
    const { auth, resources } = this.endpoints;
    Object.keys(auth).forEach((key) => {
      const authEndpoint = (auth as Record<string, BuiltInEndpoint>)[key];
      const method = (key === 'resetPassword' || key === 'verifyEmail') ? 'put' : 'post';
      const { handler } = this.createEndpoint(this.apiHandlers[key]);
      instance[(key === 'viewMe') ? 'get' : method](`${prefix}${authEndpoint.path}`, handler);
    });

    // CRUD endpoints.
    (Object.keys(resources) as (keyof DataModel & string)[]).forEach((resource) => {
      const resourceEndpoints = resources[resource] as Record<string, BuiltInEndpoint>;
      const model = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;
      (Object.keys(resourceEndpoints) as EndpointType[]).forEach((endpoint) => {
        const { path, maximumDepth } = resourceEndpoints[endpoint];
        if (endpoint === 'create') {
          instance.post(`${prefix}${path}`, this.createEndpoint({
            authenticate: true,
            handler: async (request, response) => {
              const params = request.params as unknown as CommandContext<DataModel>;
              const body = request.body as CreatePayload<DataModel[keyof DataModel & string]>;
              const fullOptions = { ...request.query as ViewCommandOptions, maximumDepth };
              const result = await this.engine.create(resource, body, fullOptions, params);
              response.status(201).send(result);
            },
            query: {
              allowPartial: true,
              fields: {
                fields: this.FIELDS_QUERY_PARAM_SCHEMA,
              },
            },
            body: {
              allowPartial: false,
              fields: model.schema.fields,
            },
          }).handler);
        } else if (endpoint === 'update') {
          instance.put(`${prefix}${path}`, this.createEndpoint({
            authenticate: true,
            handler: async (request, response) => {
              const params = request.params as unknown as CommandContext<DataModel> & { id: Id; };
              const { id, ...context } = params;
              const body = request.body as UpdatePayload<DataModel[keyof DataModel & string]>;
              const fullOptions = { ...request.query as ViewCommandOptions, maximumDepth };
              const result = await this.engine.update(resource, id, body, fullOptions, context);
              response.status(200).send(result);
            },
            body: {
              allowPartial: true,
              fields: model.schema.fields,
            },
            query: {
              allowPartial: true,
              fields: {
                fields: this.FIELDS_QUERY_PARAM_SCHEMA,
              },
            },
            params: { fields: { id: { type: 'id', isRequired: true } } },
          }).handler);
        } else if (endpoint === 'view') {
          instance.get(`${prefix}${path}`, this.createEndpoint({
            authenticate: true,
            handler: async (request, response) => {
              const params = request.params as unknown as CommandContext<DataModel> & { id: Id; };
              const { id, ...context } = params;
              const fullOptions = { ...request.query as ViewCommandOptions, maximumDepth };
              const result = await this.engine.view(resource, id, fullOptions, context);
              response.status(200).send(result);
            },
            query: {
              allowPartial: true,
              fields: {
                fields: this.FIELDS_QUERY_PARAM_SCHEMA,
              },
            },
            params: { fields: { id: { type: 'id', isRequired: true } } },
          }).handler);
        } else if (endpoint === 'list') {
          instance.get(`${prefix}${path}`, this.createEndpoint({
            authenticate: true,
            handler: async (request, response) => {
              const params = request.params as unknown as CommandContext<DataModel>;
              const fullOptions = { ...request.query as SearchCommandOptions, maximumDepth };
              const results = await this.engine.list(resource, fullOptions, params);
              response.send(results);
            },
            query: {
              allowPartial: true,
              fields: {
                limit: this.LIMIT_QUERY_PARAM_SCHEMA,
                fields: this.FIELDS_QUERY_PARAM_SCHEMA,
                offset: this.OFFSET_QUERY_PARAM_SCHEMA,
                sortBy: this.SORT_BY_QUERY_PARAM_SCHEMA,
                sortOrder: this.SORT_ORDER_QUERY_PARAM_SCHEMA,
              },
            },
          }).handler);
        } else if (endpoint === 'search') {
          const validateBody = this.ajv.compile({
            type: 'object',
            additionalProperties: false,
            required: ['query', 'filters'],
            properties: {
              query: {
                type: ['object', 'null'],
                default: null,
                additionalProperties: false,
                required: ['on', 'text'],
                properties: {
                  on: {
                    type: 'array',
                    items: {
                      type: 'string',
                    },
                  },
                  text: {
                    type: 'string',
                  },
                },
              },
              filters: {
                type: ['object', 'null'],
                default: null,
                additionalProperties: true,
                patternProperties: {
                  '^[0-9A-Za-z.]$': {
                    oneOf: [
                      { type: 'string' },
                      { type: 'array', items: { type: 'string' } },
                    ],
                  },
                },
              },
            },
          });
          instance.post(`${prefix}${path}`, this.createEndpoint({
            authenticate: true,
            handler: async (request, response) => {
              if (!validateBody(request.body)) {
                throw this.formatError(validateBody.errors?.[0], 'body');
              }
              const searchBody = request.body as SearchBody;
              if (searchBody.query !== null) {
                searchBody.query.on = new Set(searchBody.query.on);
              }
              const params = request.params as unknown as CommandContext<DataModel>;
              const fullOptions = { ...request.query as SearchCommandOptions, maximumDepth };
              const results = await this.engine.search(resource, searchBody, fullOptions, params);
              response.status(200).send(results);
            },
            query: {
              allowPartial: true,
              fields: {
                limit: this.LIMIT_QUERY_PARAM_SCHEMA,
                fields: this.FIELDS_QUERY_PARAM_SCHEMA,
                offset: this.OFFSET_QUERY_PARAM_SCHEMA,
                sortBy: this.SORT_BY_QUERY_PARAM_SCHEMA,
                sortOrder: this.SORT_ORDER_QUERY_PARAM_SCHEMA,
              },
            },
          }).handler);
        } else {
          instance.delete(`${prefix}${path}`, this.createEndpoint({
            authenticate: true,
            params: { fields: { id: { type: 'id', isRequired: true } } },
            handler: async (request, response) => {
              const params = request.params as unknown as CommandContext<DataModel> & { id: Id; };
              const { id, ...context } = params;
              await this.engine.delete(resource, id, context);
              response.status(200).send();
            },
          }).handler);
        }
      });
    });

    // Not Found error handler.
    instance.use(this.handleNotFound.bind(this));

    // Default errors handlers.
    instance.use(this.handleError.bind(this));
  }
}
