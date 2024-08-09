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
export interface FastifyCustomEndpoint<
  DataModel extends DefaultDataModel
> extends CustomEndpoint<DataModel> {
  /** Actual endpoint handler. */
  handler: (request: FastifyRequest, response: FastifyReply) => Promise<void>;
}

/**
 * API controller, designed for the Fastify framework.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/fastify/services/FastifyController.ts
 */
export default class FastifyController<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel = DefaultDataModel,

  /** Model class types definitions. */
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,

  /** Database client types definition. */
  Engine extends UsersEngine<DataModel> = UsersEngine<DataModel>,
> extends Controller<DataModel, Model, Engine> {
  /** Built-in API handlers for auth-related endpoints. */
  protected apiHandlers: Record<string, FastifyCustomEndpoint<DataModel>> = {
    _model: {
      authenticate: true,
      handler: async (request, response) => {
        const { resource } = request.query as { resource: keyof DataModel & string; };
        const publicSchema = this.model.getPublicSchema(resource);
        if (publicSchema === null) {
          throw new NotFound('NO_RESOURCE_TYPE', `Resource type "${resource}" does not exist.`);
        }
        await response.status(200).send(publicSchema);
      },
      query: {
        fields: {
          resource: { type: 'string', isRequired: true },
        },
      },
    },
    signUp: {
      handler: async (request, response) => {
        const context = request.params as CommandContext<DataModel>;
        const { email, password, passwordConfirmation: confirmation } = request.body as {
          email: string;
          password: string;
          passwordConfirmation: string;
        };
        const credentials = await this.engine.signUp(email, password, confirmation, context);
        await response.status(201).send(credentials);
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
        const context = request.params as CommandContext<DataModel>;
        const { email, password } = request.body as Record<string, string>;
        const credentials = await this.engine.signIn(email, password, context);
        await response.status(200).send(credentials);
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
      handler: async (request, response) => {
        const user = await this.engine.viewMe(request.params as CommandContext<DataModel>);
        await response.status(200).send(user);
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
        const context = request.params as CommandContext<DataModel>;
        const { refreshToken } = request.body as { refreshToken: string; };
        const credentials = await this.engine.refreshToken(refreshToken, context);
        await response.status(200).send(credentials);
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
        await response.status(200).send();
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
        await response.status(200).send();
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
        await this.engine.requestEmailVerification(request.params as CommandContext<DataModel>);
        await response.status(200).send();
      },
    },
    verifyEmail: {
      authenticate: true,
      handler: async (request, response) => {
        const context = request.params as CommandContext<DataModel>;
        const { verificationToken } = request.body as { verificationToken: string; };
        await this.engine.verifyEmail(verificationToken, context);
        await response.status(200).send();
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
        await this.engine.signOut(request.params as CommandContext<DataModel>);
        await response.status(200).send();
      },
    },
  };

  /**
   * Handles thrown errors and formats a clean HTTP response.
   *
   * @param error Error thrown by fastify.
   *
   * @param request Fastify request.
   *
   * @param response Fastify response.
   */
  protected async handleError(
    error: FastifyError,
    request: FastifyRequest,
    response: FastifyReply,
  ): Promise<void> {
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
    } else if (error.validation !== undefined) {
      statusCode = 400;
    }

    // HTTP 500 errors reason should not be displayed to end user.
    // Invalid JSON payloads throw a SyntaxError when fastify tries to parse them.
    if (statusCode === 500 && error.statusCode === 400) {
      statusCode = 400;
      errorCode = 'INVALID_PAYLOAD';
      message = 'Invalid JSON payload.';
    } else if (statusCode !== 500) {
      errorCode = error.code;
      message = error.message;
    }

    this.logger[(statusCode === 500) ? 'error' : 'info'](error, {
      statusCode,
      url: request.url,
      method: request.method,
      headers: Object.keys(request.headers),
    });

    await response
      .status(statusCode)
      .header('Content-Type', 'application/json')
      .send({ error: { code: errorCode, message } });
  }

  /**
   * Creates a new fastify endpoint from `settings`.
   *
   * @param settings Endpoint configuration.
   *
   * @returns Fastify endpoint to register.
   */
  public createEndpoint(settings: FastifyCustomEndpoint<DataModel>): {
    handler: (request: FastifyRequest, response: FastifyReply) => Promise<void>;
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
    const validateHeaders = this.ajv.compile(this.AJV_FORMATTERS.object({
      type: 'object',
      isRequired: true,
      fields: {
        ...settings.headers?.fields,
        authorization: { type: 'string', isRequired: true },
        'user-agent': { type: 'string', isRequired: true },
        connection: { type: 'string', isRequired: true },
        'accept-encoding': { type: 'string', isRequired: true },
        accept: { type: 'string', isRequired: true },
        'content-length': { type: 'string', isRequired: true },
        'content-type': { type: 'string', isRequired: true },
        host: { type: 'string', isRequired: true },
        origin: { type: 'string', isRequired: true },
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
    }, false));
    return {
      handler: async (request, response): Promise<void> => {
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

          request.query = this.parseQuery(request.query as Record<string, string | null>);
          const deviceId = String(request.headers['x-device-id']);
          const userAgent = request.headers['user-agent'] as unknown as string;
          (request.params as CommandContext<DataModel>).deviceId = deviceId;
          (request.params as CommandContext<DataModel>).userAgent = userAgent;

          if (settings.authenticate) {
            const accessToken = String(request.headers.authorization).replace('Bearer ', '');
            user = await this.auth(accessToken, deviceId, settings.ignoreExpiration);
            (request.params as CommandContext<DataModel>).user = user;
          }

          await settings.handler(request, response);
        });
      },
    };
  }

  /**
   * Registers hooks, handlers, auth and CRUD-related endpoints to `instance`.
   *
   * @param instance Fastify instance to register endpoints and hooks to.
   *
   * @param options Additional options to pass to fastify `register` function.
   */
  public async createEndpoints(
    instance: FastifyInstance,
    options?: { prefix?: string; },
  ): Promise<void> {
    // Response formatting for serialization.
    instance.addHook('preSerialization', async (_request, _response, payload): Promise<unknown> => (
      this.formatOutput(payload)
    ));

    // API Versionning.
    instance.addHook('onSend', async (_request, response, payload) => {
      response.header('X-Api-Version', this.version);
      return payload;
    });

    // Default errors handlers.
    instance.setErrorHandler(this.handleError.bind(this));
    instance.setNotFoundHandler(this.handleNotFound.bind(this));

    // Logs requests timeouts.
    instance.addHook('onTimeout', (request, _response, done) => {
      this.logger.error(new Error(`Request "${request.method} ${request.url}" timed out.`), {
        statusCode: 504,
        url: request.url,
        method: request.method,
        headers: Object.keys(request.headers),
      });
      done();
    });

    // CORS automatic handling.
    if (this.handleCORS) {
      instance.addHook('onRequest', async (request, response) => {
        response.header('Access-Control-Allow-Origin', '*');
        response.header('Access-Control-Allow-Headers', '*');
        response.header('Access-Control-Allow-Methods', '*');
        if (request.method === 'OPTIONS') {
          await response.status(200).send();
        }
      });
    }

    // Catch-all for unsupported content types. Prevents fastify from throwing HTTP 500 when
    // dealing with unknown payloads. See https://www.fastify.io/docs/latest/ContentTypeParser/.
    instance.addContentTypeParser('*', (_request, payload, next) => {
      const headers = payload.headers as Record<string, string>;
      if (headers['content-type'].startsWith('multipart/form-data')) {
        next(null, payload);
      } else {
        let data = '';
        payload.on('data', (chunk) => { data += chunk as string; });
        payload.on('end', () => { next(null, data); });
      }
    });

    await instance.register((server, _, done) => {
      // Model endpoint.
      server.get('/_model', this.createEndpoint(this.apiHandlers._model));

      // Auth endpoints.
      const { auth, resources } = this.endpoints;
      Object.keys(auth).forEach((key) => {
        const authEndpoint = (auth as Record<string, BuiltInEndpoint>)[key];
        const method = (key === 'resetPassword' || key === 'verifyEmail') ? 'put' : 'post';
        server[(key === 'viewMe') ? 'get' : method](authEndpoint.path, this.createEndpoint(this.apiHandlers[key]));
      });

      // CRUD endpoints.
      (Object.keys(resources) as (keyof DataModel & string)[]).forEach((resource) => {
        const resourceEndpoints = resources[resource] as Record<string, BuiltInEndpoint>;
        const model = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;
        (Object.keys(resourceEndpoints) as EndpointType[]).forEach((endpoint) => {
          const { path, maximumDepth } = resourceEndpoints[endpoint];
          if (endpoint === 'create') {
            server.post(path, this.createEndpoint({
              authenticate: true,
              handler: async (request, response) => {
                const params = request.params as CommandContext<DataModel>;
                const body = request.body as CreatePayload<DataModel[keyof DataModel & string]>;
                const fullOptions = { ...request.query as ViewCommandOptions, maximumDepth };
                const result = await this.engine.create(resource, body, fullOptions, params);
                await response.status(201).send(result);
              },
              body: {
                allowPartial: false,
                fields: model.schema.fields,
              },
              query: {
                allowPartial: true,
                fields: {
                  fields: this.FIELDS_QUERY_PARAM_SCHEMA,
                },
              },
            }));
          } else if (endpoint === 'update') {
            server.put(path, this.createEndpoint({
              authenticate: true,
              handler: async (request, response) => {
                const { id, ...params } = request.params as CommandContext<DataModel> & { id: Id; };
                const body = request.body as UpdatePayload<DataModel[keyof DataModel & string]>;
                const fullOptions = { ...request.query as ViewCommandOptions, maximumDepth };
                const result = await this.engine.update(resource, id, body, fullOptions, params);
                await response.status(200).send(result);
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
            }));
          } else if (endpoint === 'view') {
            server.get(path, this.createEndpoint({
              authenticate: true,
              handler: async (request, response) => {
                const { id, ...params } = request.params as CommandContext<DataModel> & { id: Id; };
                const fullOptions = { ...request.query as ViewCommandOptions, maximumDepth };
                const result = await this.engine.view(resource, id, fullOptions, params);
                await response.status(200).send(result);
              },
              query: {
                allowPartial: true,
                fields: {
                  fields: this.FIELDS_QUERY_PARAM_SCHEMA,
                },
              },
              params: { fields: { id: { type: 'id', isRequired: true } } },
            }));
          } else if (endpoint === 'list') {
            server.get(path, this.createEndpoint({
              authenticate: true,
              handler: async (request, response) => {
                const params = request.params as CommandContext<DataModel>;
                const fullOptions = { ...request.query as SearchCommandOptions, maximumDepth };
                const results = await this.engine.list(resource, fullOptions, params);
                await response.send(results);
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
            }));
          } else if (endpoint === 'search') {
            const validateBody = this.ajv.compile({
              type: 'object',
              additionalProperties: false,
              required: ['query', 'filters'],
              properties: {
                query: {
                  type: ['object', 'null'],
                  default: null,
                  nullable: true,
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
                  nullable: true,
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
            server.post(path, this.createEndpoint({
              authenticate: true,
              handler: async (request, response) => {
                if (!validateBody(request.body)) {
                  throw this.formatError(validateBody.errors?.[0], 'body');
                }
                const searchBody = request.body as SearchBody;
                if (searchBody.query !== null) {
                  searchBody.query.on = new Set(searchBody.query.on);
                }
                const params = request.params as CommandContext<DataModel>;
                const fullOptions = { ...request.query as SearchCommandOptions, maximumDepth };
                const results = await this.engine.search(resource, searchBody, fullOptions, params);
                await response.status(200).send(results);
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
            }));
          } else {
            server.delete(path, this.createEndpoint({
              authenticate: true,
              params: { fields: { id: { type: 'id', isRequired: true } } },
              handler: async (request, response) => {
                const { id, ...params } = request.params as CommandContext<DataModel> & { id: Id; };
                await this.engine.delete(resource, id, params);
                await response.status(200).send();
              },
            }));
          }
        });
      });

      done();
    }, options);
  }
}
