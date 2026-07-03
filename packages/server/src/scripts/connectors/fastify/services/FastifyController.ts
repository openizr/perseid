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
  type RouteGenericInterface,
} from 'fastify';
import Controller, {
  type EndpointType,
  type CustomEndpoint,
  type BuiltInEndpoint,
} from 'scripts/core/services/Controller';
import type {
  SearchBody,
  UpdatePayload,
  CreatePayload,
  UserCommandContext,
  AnonymousCommandContext,
} from 'scripts/core/types';
import jwt from 'jsonwebtoken';
import { PerseidError } from '@perseid/core';
import type { Span } from '@opentelemetry/api';
import Model from 'scripts/core/services/Model';
import Telemetry from 'scripts/core/services/Telemetry';
import ControllerError from 'scripts/core/errors/Controller';
import type AuthEngine from 'scripts/core/services/AuthEngine';
import { Id, deepMerge, type UserDataModel } from '@perseid/core';

type AnySchema = any;

type OTELRequest<T extends RouteGenericInterface = RouteGenericInterface> = FastifyRequest<T> & {
  telemetry?: {
    span: Span;
    logError?: boolean;
    errorType?: string;
    statusCode: number;
    endSpanInHandler?: boolean;
    spanStartTime: [number, number];
  }
};

/**
 * Default Fastify request schema.
 */
export interface DefaultRequestSchema {
  /**
   * Request body schema.
   */
  body?: AnySchema;

  /**
   * Request query schema.
   */
  query?: AnySchema;

  /**
   * Request params schema.
   */
  params?: AnySchema;

  /**
   * Request headers schema.
   */
  headers?: AnySchema;
}

/**
 * Custom endpoint configuration.
 */
export interface FastifyCustomEndpoint<
  RequestSchema extends DefaultRequestSchema = DefaultRequestSchema,
> extends CustomEndpoint {
  /**
   * Actual endpoint handler.
   */
  handler: (
    request: FastifyRequest<{
      Body: RequestSchema['body'];
      Params: RequestSchema['params'];
      Headers: RequestSchema['headers'];
      Querystring: RequestSchema['query'];
    }>,
    response: FastifyReply
  ) => Promise<FastifyReply>;
}

/**
 * API controller, designed for the Fastify framework.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/fastify/services/FastifyController.ts
 */
export default class FastifyController<
  /**
   * Data model type definition.
   */
  DataModelType extends UserDataModel = UserDataModel,

  /**
   * Telemetry system type definition.
   */
  TelemetryType extends Telemetry = Telemetry,

  /**
   * Model class type definition.
   */
  ModelType extends Model<DataModelType> = Model<DataModelType>,

  /**
   * Engine type definition.
   */
  EngineType extends AuthEngine<DataModelType> = AuthEngine<DataModelType>,
> extends Controller<DataModelType, TelemetryType, ModelType, EngineType> {
  /**
   * Built-in API handlers for auth-related endpoints.
   */
  protected apiHandlers: Record<string, FastifyCustomEndpoint<{
    body?: any;
    query?: any;
    params?: any;
    headers?: any;
  }>> = {
      _model: {
        handler: async (request: FastifyRequest<{
          Querystring: { resource: keyof DataModelType & string; };
      }>, response: FastifyReply) => {
          const { resource } = request.query;
          await this.generateContext(request, true, false);
          const publicSchema = this.model.getPublicSchema(resource);
          if (publicSchema === null) {
            return this.error(response, 404, 'NO_RESOURCE_TYPE', `Resource type "${resource}" does not exist.`);
          }
          return response.status(200).send(publicSchema);
        },
        query: {
          requireAllFields: true,
          fields: {
            resource: {
              type: 'string',
              maxLength: 100,
              isRequired: true,
              description: 'Resource type.',
            },
          },
        },
      },
      signUp: {
        handler: async (
          request: FastifyRequest<{
            Body: { email: string; password: string; passwordConfirmation: string; };
          }>,
          response: FastifyReply,
        ) => {
          const context = await this.generateContext(request, false, false);
          const { email, password, passwordConfirmation: confirmation } = request.body;
          const credentials = await this.engine.signUp(
            email,
            password,
            confirmation,
            context as UserCommandContext<DataModelType>,
          );
          return response.status(201).send(credentials);
        },
        headers: {
          fields: deepMerge(this.COMMON_HEADERS, {
            'x-device-id': {
              isRequired: false,
            },
          }),
        },
        body: {
          fields: {
            email: Model.email(),
            password: Model.password(),
            passwordConfirmation: Model.password(),
          },
        },
      },
      signIn: {
        handler: async (
          request: FastifyRequest<{ Body: { email: string; password: string; }; }>,
          response: FastifyReply,
        ) => {
          const { email, password } = request.body;
          const context = await this.generateContext(request, false, false);
          const { deviceId, userAgent } = context.session;
          const credentials = await this.engine.signIn(email, password, deviceId, userAgent);
          return response.status(200).send(credentials);
        },
        headers: {
          fields: deepMerge(this.COMMON_HEADERS, {
            'x-device-id': {
              isRequired: false,
            },
          }),
        },
        body: {
          fields: {
            email: {
              type: 'string',
              isRequired: true,
              maxLength: 250,
              description: 'User email address.',
            },
            password: {
              type: 'string',
              isRequired: true,
              maxLength: 100,
              description: 'User password.',
            },
          },
        },
      },
      viewMe: {
        handler: async (request, response) => {
          const context = await this.generateContext(request, true, false);
          const user = await this.engine.viewMe(context);
          return response.status(200).send(user);
        },
      },
      refreshToken: {
        handler: async (
          request: FastifyRequest<{ Body: { refreshToken: string; }; }>,
          response: FastifyReply,
        ) => {
          const context = await this.generateContext(request, true, true);
          const { refreshToken } = request.body as { refreshToken: string; };
          const credentials = await this.engine.refreshToken(refreshToken, context);
          return response.status(200).send(credentials);
        },
        body: {
          fields: {
            refreshToken: Model.token(),
          },
        },
      },
      requestPasswordReset: {
        handler: async (request: FastifyRequest<{ Body: { email: string; }; }>, response) => {
          const { email } = request.body;
          await this.engine.requestPasswordReset(email);
          return response.status(200).send();
        },
        body: {
          fields: {
            email: Model.email(),
          },
        },
        headers: {
          fields: deepMerge(this.COMMON_HEADERS, {
            'x-device-id': {
              isRequired: false,
            },
          }),
        },
      },
      resetPassword: {
        handler: async (
          request: FastifyRequest<{
            Body: { password: string; resetToken: string; passwordConfirmation: string; };
          }>,
          response: FastifyReply,
        ) => {
          const { resetToken, password, passwordConfirmation } = request.body;
          await this.engine.resetPassword(password, passwordConfirmation, resetToken);
          return response.status(200).send();
        },
        body: {
          fields: {
            password: Model.password(),
            resetToken: Model.token(),
            passwordConfirmation: Model.password(),
          },
        },
        headers: {
          fields: deepMerge(this.COMMON_HEADERS, {
            'x-device-id': { isRequired: false },
          }),
        },
      },
      requestEmailVerification: {
        handler: async (
          request: FastifyRequest<{
            Body: { verificationToken: string; };
          }>,
          response: FastifyReply,
        ) => {
          const context = await this.generateContext(request, true, false);
          await this.engine.requestEmailVerification(context);
          return response.status(200).send();
        },
      },
      verifyEmail: {
        handler: async (
          request: FastifyRequest<{
            Body: { verificationToken: string; };
          }>,
          response: FastifyReply,
        ) => {
          const context = await this.generateContext(request, true, false);
          const { verificationToken } = request.body;
          await this.engine.verifyEmail(verificationToken, context);
          return response.status(200).send();
        },
      },
      signOut: {
        handler: async (request, response) => {
          const context = await this.generateContext(request, true, true);
          await this.engine.signOut(context);
          return response.status(200).send();
        },
      },
    };

  /**
   * Builds an error HTTP response.
   *
   * @param response HTTP response to send.
   *
   * @param status HTTP status code.
   *
   * @param errorCode Error code.
   *
   * @param errorMessage Error message.
   *
   * @returns Error HTTP response.
   */
  protected error(
    response: FastifyReply,
    status: number,
    errorCode: string,
    errorMessage: string,
  ): FastifyReply {
    this.telemetry.debug(errorCode, { message: errorMessage });
    return response
      .status(status)
      .header('Content-Type', 'application/json')
      .send({ error: { code: errorCode, message: errorMessage } });
  }

  /**
   * Formats an invalid payload error response.
   *
   * @param response HTTP response to send.
   *
   * @param error Error object.
   *
   * @param payloadType Type of payload that is invalid.
   *
   * @returns HTTP response.
   */
  protected invalidPayload(
    response: FastifyReply,
    error: unknown,
    payloadType: string,
  ): FastifyReply {
    let { message } = error as { message?: string; };
    const { keyword, instancePath, params } = error as {
      keyword?: string;
      instancePath?: string;
      params?: Record<string, unknown>;
    };

    const fullPath = `${payloadType}${(String(instancePath)).replace(/\//g, '.')}`;
    message = `"${fullPath}" ${message as unknown as string}.`;
    if (keyword === 'required') {
      message = `"${fullPath}.${params?.missingProperty as string}" is required.`;
    } else if (keyword === 'additionalProperties') {
      message = `Unknown field "${fullPath}.${params?.additionalProperty as string}".`;
    }

    return this.error(response, 400, 'INVALID_PAYLOAD', message);
  }

  /**
   * Handles thrown errors and formats a clean HTTP response.
   *
   * @param error Error thrown by fastify.
   *
   * @param _request Fastify request.
   *
   * @param response Fastify response.
   *
   * @returns HTTP response.
   */
  protected async handleError(
    error: FastifyError,
    _request: FastifyRequest,
    response: FastifyReply,
  ): Promise<FastifyReply> {
    let message = (error.statusCode === 400)
      ? 'Invalid payload.'
      : 'Internal Server Error.';
    let errorCode = (error.statusCode === 400)
      ? 'INVALID_PAYLOAD'
      : 'INTERNAL_SERVER_ERROR';
    let statusCode = (error.statusCode === 400)
      ? 400
      : 500;

    // HTTP 500 errors reason should not be displayed to end user.
    // Invalid JSON payloads throw a SyntaxError when fastify tries to parse them.
    if (error.validation !== undefined) {
      statusCode = 400;
    }

    if (statusCode !== 500) {
      errorCode = error.code;
      message = error.message;
      this.telemetry.debug(errorCode, { message });
    }

    return this.error(response, statusCode, errorCode, message);
  }

  /**
   * Handles Fastify not found errors and formats a clean HTTP response.
   *
   * @param request Fastify request.
   *
   * @param response Fastify response.
   *
   * @returns HTTP response.
   */
  protected handleNotFound(_request: FastifyRequest, response: FastifyReply): FastifyReply {
    return this.error(response, 404, 'NOT_FOUND', 'Not Found.');
  }

  /**
   * Generates engine context from `request`.
   *
   * @param authenticate Whether to authenticate user. If `true`, a full session will be generated.
   *
   * @param ignoreExpiration Whether to ignore expiration of the access token, if applicable.
   *
   * @returns Engine context.
   */
  protected generateContext(
    request: FastifyRequest,
    authenticate: true,
    ignoreExpiration: boolean
  ): Promise<Omit<UserCommandContext<DataModelType>, 'queryOptions'> & {
    queryOptions: Exclude<UserCommandContext<DataModelType>['queryOptions'], undefined>;
  }>;

  protected generateContext(
    request: FastifyRequest,
    authenticate: false,
    ignoreExpiration: boolean
  ): Promise<Omit<AnonymousCommandContext<DataModelType>, 'queryOptions'> & {
    queryOptions: Exclude<AnonymousCommandContext<DataModelType>['queryOptions'], undefined>;
  }>;

  protected async generateContext(
    request: FastifyRequest,
    authenticate: boolean,
    ignoreExpiration: boolean,
  ): Promise<Omit<
    UserCommandContext<DataModelType>, 'queryOptions'>
    | Omit<AnonymousCommandContext<DataModelType>, 'queryOptions'
  > & {
    queryOptions: Exclude<AnonymousCommandContext<DataModelType>['queryOptions'], undefined>;
  }> {
    const deviceId = String(request.headers['x-device-id']);
    const userAgent = String(request.headers['user-agent']);
    const queryOptions = this.parseQuery(request.query as Record<string, string | null>);

    if (!authenticate) {
      return {
        queryOptions,
        session: {
          deviceId,
          userAgent,
        },
      };
    }

    // Authentication through access token....
    const context = { session: { deviceId } };
    const accessToken = String(request.headers.authorization).replace('Bearer ', '');
    const userId = await this.engine.verifyToken(accessToken, ignoreExpiration, context);

    let user: UserCommandContext<DataModelType>['session']['user'] | null = null;
    try {
      user = await this.engine.unsafeView<UserCommandContext<DataModelType>['session']['user']>('users', userId, {
        queryOptions: {
          fields: [
            '_id',
            'email',
            'roles',
            'roles.name',
            'roles.permissions',
            '_apiKeys',
            '_verifiedAt',
            '_devices._id',
            '_devices._userAgent',
            '_devices._expiration',
            '_devices._refreshToken',
          ],
        },
      });
      if (!user._devices.some((device) => device._id === deviceId)) {
        throw new ControllerError('NO_RESOURCE');
      }
      user._permissions = new Set(user.roles.reduce<string[]>((permissions, role) => (
        permissions.concat(role.permissions)
      ), []));
    } catch (error) {
      if (error instanceof PerseidError && error.code === 'NO_RESOURCE') {
        throw new ControllerError('INVALID_CREDENTIALS');
      }
      throw error;
    }

    return { queryOptions, session: { user, deviceId, userAgent } };
  }

  /**
   * Updates root request span attributes and status. The logic and conditions are a bit flakky here
   * because Fastify triggers hooks in a different order depending on the case:
   * - When an error happens in another hook like `preSerialization`, the `onError` hook is
   * triggered first, then `onResponse`.
   * - When an error happens in the endpoint handler, the `onError` hook is triggered first,
   * then `onResponse`, then the handler ends.
   * - When everything goes well, the `onResponse` hook is triggered first, then the handler ends.
   *
   * @param request Fastify request.
   *
   * @param response Fastify response.
   *
   * @param error Error to record, if any.
   */
  protected updateSpan(request: OTELRequest): void {
    const { telemetry } = request;

    if (telemetry !== undefined) {
      const { span, spanStartTime, statusCode } = telemetry;

      span.setAttribute('http.response.status_code', statusCode);
      span.setAttribute('http.route', request.routeOptions.url ?? 'null');

      if (statusCode >= 500) {
        span.setStatus({ code: 2 });
      }

      if (telemetry.errorType !== undefined) {
        span.setAttribute('error.type', telemetry.errorType);
      }

      this.telemetry.measure('http.server.active_requests', -1, {
        'url.scheme': request.protocol,
        'http.request.method': request.method,
        'server.port': request.socket.localPort,
        'server.address': request.socket.localAddress,
      });
      this.telemetry.measure('http.server.request.duration', this.telemetry.duration(spanStartTime), {
        'url.scheme': request.protocol,
        'error.type': telemetry.errorType,
        'http.request.method': request.method,
        'server.port': request.socket.localPort,
        'http.response.status_code': statusCode,
        'server.address': request.socket.localAddress,
        'http.route': request.routeOptions.url ?? 'null',
      });

      span.end();
    }
  }

  /**
   * Creates a new fastify endpoint from `settings`.
   *
   * @param settings Endpoint configuration.
   *
   * @returns Fastify endpoint to register.
   */
  public createEndpoint<RequestSchema extends DefaultRequestSchema = DefaultRequestSchema>(
    settings: FastifyCustomEndpoint<RequestSchema>,
  ): {
    handler: (request: FastifyRequest<{
      Body: RequestSchema['body'];
      Params: RequestSchema['params'];
      Headers: RequestSchema['headers'];
      Querystring: RequestSchema['query'];
    }>, response: FastifyReply) => Promise<FastifyReply>;
  } {
    const validateBody = this.ajv.compile(this.AJV_FORMATTERS.object({
      type: 'object',
      isRequired: true,
      description: 'Request body.',
      fields: settings.body?.fields ?? {},
    }, settings.body?.requireAllFields !== false));
    const validateQuery = this.ajv.compile(this.AJV_FORMATTERS.object({
      type: 'object',
      isRequired: true,
      description: 'Request query.',
      fields: settings.query?.fields ?? {},
    }, settings.query?.requireAllFields === true));
    const validateParams = this.ajv.compile(this.AJV_FORMATTERS.object({
      type: 'object',
      isRequired: true,
      description: 'Request params.',
      fields: settings.params?.fields ?? {},
    }, settings.params?.requireAllFields !== false));
    const headersSchema = this.AJV_FORMATTERS.object({
      type: 'object',
      isRequired: true,
      description: 'Request headers.',
      fields: {
        ...this.COMMON_HEADERS,
        ...settings.headers?.fields,
      },
    }, settings.headers?.requireAllFields !== false);
    headersSchema.additionalProperties = true;
    const validateHeaders = this.ajv.compile(headersSchema);
    return {
      handler: async (request, response): Promise<FastifyReply> => {
        const { telemetry } = request as OTELRequest;
        const spanContext = telemetry?.span.spanContext();

        if (telemetry !== undefined) {
          telemetry.endSpanInHandler = true;
        }

        return await this.telemetry.span(`${this.constructor.name}.handler`, {
          attributes: {
            'code.class.name': this.constructor.name,
          },
          ...(spanContext !== undefined ? {
            traceState: spanContext.traceState?.serialize(),
            traceParent: {
              spanId: spanContext.spanId,
              traceId: spanContext.traceId,
              traceFlags: spanContext.traceFlags,
            },
          } : {}),
        }, async () => {
          try {
            if (settings.body !== undefined && !validateBody(request.body)) {
              return await this.invalidPayload(response, validateBody.errors?.[0], 'body');
            }

            if (!validateHeaders(request.headers)) {
              return await this.invalidPayload(response, validateHeaders.errors?.[0], 'headers');
            }

            if (!validateQuery(request.query)) {
              return await this.invalidPayload(response, validateQuery.errors?.[0], 'query');
            }

            if (!validateParams(request.params)) {
              return await this.invalidPayload(response, validateParams.errors?.[0], 'params');
            }

            return await settings.handler(request, response);
          } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
              return this.error(response, 401, 'TOKEN_EXPIRED', 'Access token has expired.');
            }
            if (error instanceof jwt.JsonWebTokenError) {
              return this.error(response, 401, 'INVALID_TOKEN', 'Invalid access token.');
            }
            if (error instanceof PerseidError) {
              const formattedError = this.KNOWN_ERRORS[error.code]?.(error);
              if (formattedError !== undefined) {
                const [status, code, message] = formattedError;
                return this.error(response, status, code, message);
              }
            }
            if (telemetry !== undefined) {
              telemetry.logError = false;
              telemetry.endSpanInHandler = false;
            }
            throw error;
          }
        }).finally(() => {
          if (telemetry?.endSpanInHandler) {
            this.updateSpan(request);
          }
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
    instance.addHook('onTimeout', (request: OTELRequest, _response, done) => {
      const span = request.telemetry?.span;
      if (span !== undefined) {
        span.setStatus({ code: 2 });
        if (request.telemetry?.logError) {
          this.telemetry.error(new Error('Request timed out.'), {}, span);
        }
      }
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

    // Telemetry instrumentation for all fastify endpoints.
    if (this.instrumentEndpoints) {
      const otelTracer = this.telemetry.getOtelTracer();

      instance.addHook('onError', async (request: OTELRequest, _, error) => {
        // TODO transform fastify errors into Perseid errors, pass it to the next hook
        // If perseid erorr, then don't telemetry.error() it

        // FST_ERR_CTP_INVALID_JSON_BODY
        // FST_ERR_CTP_EMPTY_JSON_BODY
        // FST_ERR_CTP_INVALID_CONTENT_LENGTH
        // FST_ERR_CTP_EMPTY_TYPE
        // FST_ERR_CTP_INVALID_TYPE
        // FST_ERR_CTP_BODY_TOO_LARGE
        // FST_ERR_CTP_INVALID_MEDIA_TYPE

        if (error instanceof PerseidError) {
          const formattedError = this.KNOWN_ERRORS[error.code]?.(error);
          if (formattedError !== undefined) {
            const [status, code, message] = formattedError;
            return this.error(response, status, code, message);
          }
        }

        const span = request.telemetry?.span;
        if (span !== undefined) {
          span.setStatus({ code: 2 });
          if (request.telemetry?.logError) {
            this.telemetry.error(error, {}, span);
          }
        }
      });

      instance.addHook('preSerialization', async (
        request: OTELRequest,
        response,
        payload: { error?: { code?: string; } },
      ): Promise<unknown> => {
        if (response.statusCode >= 400) {
          const { telemetry } = request;
          if (telemetry !== undefined && typeof payload === 'object') {
            telemetry.errorType = payload.error?.code;
          }
        }
        return payload;
      });

      instance.addHook('onRequest', async (request: OTELRequest, response: FastifyReply) => {
        if (otelTracer !== null) {
          this.telemetry.measure('http.server.active_requests', 1, {
            'url.scheme': request.protocol,
            'http.request.method': request.method,
            'server.port': request.socket.localPort,
            'server.address': request.socket.localAddress,
          });
          request.telemetry = {
            logError: true,
            statusCode: 200,
            endSpanInHandler: false,
            spanStartTime: this.telemetry.now(),
            span: otelTracer.startSpan(`${request.method} ${String(request.routeOptions.url)}`, {
              kind: 1,
              attributes: {
                'url.path': request.url,
                'client.address': request.ip,
                'url.scheme': request.protocol,
                'http.request.method': request.method,
                'server.port': request.socket.localPort,
                'server.address': request.socket.localAddress,
                'user_agent.original': request.headers['user-agent'],
                'url.full': `${request.protocol}://${request.hostname}${request.url}`,
              },
            }, this.telemetry.getSpanContextFromHeaders(request.headers)),
          };

          response.raw.on('close', () => {
            const { telemetry } = request;
            if (telemetry !== undefined && !telemetry.endSpanInHandler) {
              telemetry.statusCode = response.statusCode;
              this.updateSpan(request);
            }
          });
        }
      });
    }

    // Catch-all for unsupported content types. Prevents fastify from throwing HTTP 500 when
    // dealing with unknown payloads. See https://www.fastify.io/docs/latest/ContentTypeParser/.
    instance.addContentTypeParser('*', (_request, payload, next) => {
      const headers = payload.headers as Partial<Record<string, string>>;
      if (headers['content-type']?.startsWith('multipart/form-data')) {
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
      const keys = Object.keys(resources) as (keyof DataModelType)[];
      keys.forEach((resource) => {
        const model = this.model.get(resource);
        const resourceEndpoints = resources[resource] as Record<EndpointType, BuiltInEndpoint>;
        (Object.keys(resourceEndpoints) as EndpointType[]).forEach((endpoint) => {
          const { path, maximumDepth } = resourceEndpoints[endpoint];
          if (endpoint === 'create') {
            server.post(path, this.createEndpoint<{
              body: CreatePayload<DataModelType[keyof DataModelType]>;
            }>({
              query: { fields: { fields: Model.queryFields() } },
              body: { requireAllFields: true, fields: model.schema.fields },
              handler: async (request, response) => {
                const context = await this.generateContext(request, true, false);
                context.queryOptions.maximumDepth ??= maximumDepth;
                const body = request.body as CreatePayload<DataModelType[keyof DataModelType]>;
                const result = await this.engine.create(resource, body, context);
                return response.status(201).send(result);
              },
            }));
          } else if (endpoint === 'update') {
            server.patch(path, this.createEndpoint<{
              params: { id: Id; };
              body: UpdatePayload<DataModelType[keyof DataModelType]>;
            }>({
              params: { fields: { id: Model.id() } },
              query: { fields: { fields: Model.queryFields() } },
              body: { requireAllFields: false, fields: model.schema.fields },
              handler: async (request, response) => {
                const context = await this.generateContext(request, true, false);
                context.queryOptions.maximumDepth ??= maximumDepth;
                const body = request.body as UpdatePayload<DataModelType[keyof DataModelType]>;
                const result = await this.engine.update(resource, request.params.id, body, context);
                return response.status(200).send(result);
              },
            }));
          } else if (endpoint === 'view') {
            server.get(path, this.createEndpoint<{
              params: { id: Id; };
            }>({
              params: { fields: { id: Model.id() } },
              query: { fields: { fields: Model.queryFields() } },
              handler: async (request, response) => {
                const context = await this.generateContext(request, true, false);
                context.queryOptions.maximumDepth ??= maximumDepth;
                const result = await this.engine.view(resource, request.params.id, context);
                return response.status(200).send(result);
              },
            }));
          } else if (endpoint === 'list') {
            server.get(path, this.createEndpoint<{
              params: { id: Id; };
            }>({
              handler: async (request, response) => {
                const context = await this.generateContext(request, true, false);
                context.queryOptions.maximumDepth ??= maximumDepth;
                const searchBody = { filters: null, query: null };
                const results = await this.engine.list(resource, searchBody, context);
                return response.status(200).send(results);
              },
              query: {
                fields: {
                  sortBy: Model.sortBy(),
                  limit: Model.queryLimit(),
                  fields: Model.queryFields(),
                  offset: Model.queryOffset(),
                  sortOrder: Model.sortOrder(),
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
            server.post(path, this.createEndpoint<{
              body: SearchBody;
            }>({
              handler: async (request, response) => {
                if (!validateBody(request.body)) {
                  return await this.invalidPayload(response, validateBody.errors?.[0], 'body');
                }
                const searchBody = request.body;
                if (searchBody.query !== null) {
                  searchBody.query.on = new Set(searchBody.query.on);
                }
                const context = await this.generateContext(request, true, false);
                context.queryOptions.maximumDepth ??= maximumDepth;
                const results = await this.engine.list(resource, searchBody, context);
                return response.status(200).send(results);
              },
              query: {
                fields: {
                  sortBy: Model.sortBy(),
                  limit: Model.queryLimit(),
                  fields: Model.queryFields(),
                  offset: Model.queryOffset(),
                  sortOrder: Model.sortOrder(),
                },
              },
            }));
          } else {
            server.delete(path, this.createEndpoint<{
              params: { id: Id; };
            }>({
              params: { fields: { id: Model.id() } },
              handler: async (request, response) => {
                const context = await this.generateContext(request, true, false);
                await this.engine.delete(resource, request.params.id, context);
                return response.status(200).send();
              },
            }));
          }
        });
      });

      done();
    }, options);
  }
}
