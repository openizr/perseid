/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '@perseid/server/fastify' {
  import type {
    FastifyError,
    FastifyReply,
    FastifyRequest,
    FastifyInstance,
  } from 'fastify';
  import type {
    Controller,
    UsersEngine,
    CustomEndpoint,
    Model as BaseModel,
  } from '@perseid/server';
  import type { DefaultDataModel } from '@perseid/core';
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
    protected apiHandlers: Record<string, FastifyCustomEndpoint<DataModel>>;

    /**
     * Handles thrown errors and formats a clean HTTP response.
     *
     * @param error Error thrown by fastify.
     *
     * @param request Fastify request.
     *
     * @param response Fastify response.
     */
    protected handleError(
      error: FastifyError,
      request: FastifyRequest,
      response: FastifyReply,
    ): Promise<void>;

    /**
     * Creates a new fastify endpoint from `settings`.
     *
     * @param settings Endpoint configuration.
     *
     * @returns Fastify endpoint to register.
     */
    public createEndpoint(settings: FastifyCustomEndpoint<DataModel>): {
      handler: (request: FastifyRequest, response: FastifyReply) => Promise<void>;
    };

    /**
     * Registers hooks, handlers, auth and CRUD-related endpoints to `instance`.
     *
     * @param instance Fastify instance to register endpoints and hooks to.
     *
     * @param options Additional options to pass to fastify `register` function.
     */
    public createEndpoints(
      instance: FastifyInstance,
      options?: { prefix?: string; },
    ): Promise<void>;
  }
}
