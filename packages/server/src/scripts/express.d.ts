/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '@perseid/server/express' {
  import type {
    Controller,
    UsersEngine,
    CustomEndpoint,
    Model as BaseModel,
  } from '@perseid/server';
  import type { DefaultDataModel } from '@perseid/core';
  import type { Application, NextFunction, RequestHandler } from 'express';

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
    protected apiHandlers: Record<string, ExpressCustomEndpoint<DataModel>>;

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
    ): void;

    /**
     * Creates a new express endpoint from `settings`.
     *
     * @param settings Endpoint configuration.
     *
     * @returns Express endpoint to register.
     */
    public createEndpoint(settings: ExpressCustomEndpoint<DataModel>): {
      handler: RequestHandler;
    };

    /**
     * Registers hooks, handlers, auth and CRUD-related endpoints to `instance`.
     *
     * @param instance Express instance to register endpoints and hooks to.
     *
     * @param options Additional options to pass to express `register` function.
     */
    public createEndpoints(
      instance: Application,
      options?: { prefix?: string; },
    ): Promise<void>;
  }
}
