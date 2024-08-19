/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '@perseid/client' {
  import type {
    Id,
    Results,
    HttpClient,
    FieldSchema,
    ResourceSchema,
    RequestSettings,
    DefaultDataModel,
    DataModelMetadata,
    Model as BaseModel,
    Logger as BaseLogger,
  } from '@perseid/core';

  /**
   * Logger settings
   */
  export interface LoggerSettings {
    /** Minimum logging level (all logs below that level won't be logs). */
    logLevel: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  }

  /**
   * Console-based logging system.
   */
  export class Logger extends BaseLogger {
    /** Console logger instance. */
    protected logger: Console;

    /** Minimum logging level (all logs below that level won't be logs). */
    public readonly level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';

    /**
     * Class constructor.
     *
     * @param settings Logger settings.
     */
    public constructor(settings: LoggerSettings);

    /**
     * @deprecated Use `debug` instead.
     */
    public trace(message: unknown, ...args: unknown[]): void;

    /**
     * Information that is diagnostically helpful to people more than just developers
     * (IT, sysadmins, etc.).
     * This should be the minimum logging level in development.
     */
    public debug(message: unknown, ...args: unknown[]): void;

    /**
     * Generally useful information to log (service start/stop, configuration assumptions, etc).
     * Info we want to always have available but usually don't care about under normal
     * circumstances. This should be the minimum logging level in (pre)production.
     */
    public info(message: unknown, ...args: unknown[]): void;

    /**
     * Anything that can potentially cause application oddities, but which is not a serious concern
     * (Such as switching from a primary to backup server, retrying an operation, missing secondary
     * data, etc.). Not much to worry about, but it is still important to analyze warnings on a
     * regular basis to identify potential issues.
     */
    public warn(message: unknown, ...args: unknown[]): void;

    /**
     * Any error which is fatal to the operation, but not the service or application (can't open a
     * required file, missing data, etc.). These errors will force user (administrator, or direct
     * user) intervention. These are usually reserved for incorrect connection strings, missing
     * services, uncaught exceptions, etc. Constitutes a degradation of service, which means
     * engineering team must be immediately notified.
     */
    public error(message: unknown, ...args: unknown[]): void;

    /**
     * Any error that is forcing a shutdown of the service or application to prevent data loss
     * (or further data loss). Reserved only for the most heinous errors and situations where there
     * is guaranteed to have been data corruption or loss. Constitutes an interruption of service,
     * which means engineering and SysAdmin / DevOps teams must be immediatly notified.
     */
    public fatal(message: unknown, ...args: unknown[]): void;

    /**
     * Gracefully closes the logging system (before stopping the program, for instance).
     */
    public close(): Promise<void>;
  }

  /**
   * Data model.
   */
  export class Model<
    /** Data model types definitions. */
    DataModel extends DefaultDataModel = DefaultDataModel,
  > extends BaseModel<DataModel> {
    /**
     * Updates data model with `schemaFragment`.
     *
     * @param schemaFragment Fragment of data model schema. Contains a subset of resources schemas.
     */
    public update(schemaFragment: Partial<DataModel>): void;
  }

  /** API request settings. */
  export type ApiRequestSettings = Omit<RequestSettings, 'url'> & {
    /** API endpoint to call, from API baseUrl. */
    endpoint?: string;

    /** Absolute API URL to call, if necessary. */
    url?: string;
  }

  /** Build-in endpoint configuration. */
  export interface BuiltInEndpoint {
    /** API route for this endpoint. */
    route: string;
  }

  /** List of all available built-in endpoints. */
  export interface BuiltInEndpoints<DataModel> {
    /** Auth-related endpoints. */
    auth: {
      /** Sign-up endpoint. */
      signUp?: BuiltInEndpoint;

      /** Sign-in endpoint. */
      signIn?: BuiltInEndpoint;

      /** Sign-out endpoint. */
      signOut?: BuiltInEndpoint;

      /** User info endpoint. */
      viewMe?: BuiltInEndpoint;

      /** Email verification endpoint. */
      verifyEmail?: BuiltInEndpoint;

      /** Access token refresh endpoint. */
      refreshToken?: BuiltInEndpoint;

      /** Password reset endpoint. */
      resetPassword?: BuiltInEndpoint;

      /** Password reset request endpoint. */
      requestPasswordReset?: BuiltInEndpoint;

      /** Email verification request endpoint. */
      requestEmailVerification?: BuiltInEndpoint;
    };

    /** Resources-related endpoints. */
    resources: Partial<Record<keyof DataModel & string, Partial<Record<
      'search' | 'view' | 'list' | 'create' | 'update' | 'delete',
      BuiltInEndpoint
    >>>>;
  }

  /**
   * API client settings.
   */
  export interface ApiClientSettings<DataModel> {
    /** API base URL. */
    baseUrl: string;

    /** Maximum request duration (in ms) before generating a timeout. */
    connectTimeout: number;

    /** List of built-in endpoints to register. */
    endpoints: BuiltInEndpoints<DataModel>;

    /** List of mocked API responses, for each endpoint. */
    mockedResponses: Partial<Record<string, {
      /** Response code for each request, in that order. */
      codes?: number[];

      /** Duration for each request, in that order. */
      durations?: number[];

      /** Response body for each request, in that order. */
      responses?: unknown[];
    }>>;
  }

  /**
   * Auth credentials.
   */
  export interface Credentials {
    /** Current user device id. */
    deviceId: string;

    /** Remaining number of seconds before access token expiration. */
    expiresIn: number;

    /** Access token expiration absolute timestamp. */
    expiration: number;

    /** Current access token. */
    accessToken: string;

    /** Refresh token for current user device. */
    refreshToken: string;
  }

  /**
   * Handles HTTP requests.
   */
  export class ApiClient<
    /** Data model types definitions. */
    DataModel extends DefaultDataModel = DefaultDataModel,
  > extends HttpClient {
    /** Logging system to use. */
    protected logger: Logger;

    /** Perseid model to use. */
    protected model: Model<DataModel>;

    /** API base URL. */
    protected baseUrl: string;

    /** List of resources types already loaded in data model. */
    protected loadedResources: Set<keyof DataModel & string>;

    /** List of mocked API responses, for each endpoint. */
    protected mockedResponses: ApiClientSettings<DataModel>['mockedResponses'];

    /** List of built-in endpoints to register. */
    protected endpoints: BuiltInEndpoints<DataModel>;

    /** Default query options. */
    protected defaultOptions: QueryOptions;

    /** Encoder for binary uploads. */
    protected encoder: TextEncoder;

    /** Decoder for binary downloads. */
    protected decoder: TextDecoder;

    /**
     * Formats `input` into an HTTP request body.
     *
     * @param input Input to format.
     *
     * @returns Formatted input.
     */
    protected formatInput(input: unknown): Promise<unknown>;

    /**
     * Formats `output` from HTTP response into valid resources.
     *
     * @param output Output to format.
     *
     * @param model Current output data model.
     *
     * @returns Formatted output.
     */
    protected formatOutput<T = unknown>(
      output: unknown,
      model: FieldSchema<DataModel>,
    ): T;

    /**
     * Builds the URL querystring from `options`.
     *
     * @param options Query options.
     *
     * @returns URL querystring.
     */
    protected buildQuery(options: QueryOptions): string;

    /**
     * Performs either an real HTTP request or a mocked request depending on `settings`,
     * and handles authentication, errors, and environment-specific behaviour.
     *
     * @param settings Request settings.
     *
     * @param authenticate Whether authenticate user before sending request. Defaults to `true`.
     *
     * @returns HTTP response.
     */
    protected request<T>(settings: ApiRequestSettings, authenticate?: boolean): Promise<T>;

    /**
     * Class constructor.
     *
     * @param model Data model instance to use.
     *
     * @param logger Logging system to use.
     *
     * @param settings API client settings.
     */
    constructor(model: Model<DataModel>, logger: Logger, settings: ApiClientSettings<DataModel>);

    /**
     * Fetches data model fragment for `resource` if necessary, and returns its metadata.
     *
     * @param resource Type of resource for which to get data model metadata.
     *
     * @returns Resource data model metadata.
     */
    public getDataModel<Resource extends keyof DataModel & string>(
      resource: Resource,
    ): Promise<DataModelMetadata<ResourceSchema<DataModel>>>;

    /**
     * Performs an API call to the `auth.refreshToken` endpoint.
     *
     * @returns New credentials.
     *
     * @throws If `auth.refreshToken` endpoint does not exist in configuration.
     */
    public refreshToken(): Promise<Credentials>;

    /**
     * Performs an API call to the `auth.signOut` endpoint.
     *
     * @throws If `auth.signOut` endpoint does not exist in configuration.
     */
    public signOut(): Promise<void>;

    /**
     * Performs an API call to the `auth.signIn` endpoint.
     *
     * @param email User email.
     *
     * @param password User password.
     *
     * @throws If `auth.signIn` endpoint does not exist in configuration.
     */
    public signIn(email: string, password: string): Promise<void>;

    /**
     * Performs an API call to the `auth.signUp` endpoint.
     *
     * @param email New user email.
     *
     * @param password New user password.
     *
     * @param passwordConfirmation New user password confirmation.
     *
     * @throws If `auth.signUp` endpoint does not exist in configuration.
     */
    public signUp(
      email: string,
      password: string,
      passwordConfirmation: string,
    ): Promise<void>;

    /**
     * Performs an API call to the `auth.resetPassword` endpoint.
     *
     * @param resetToken Password reset token.
     *
     * @param password New user password.
     *
     * @param passwordConfirmation User password confirmation.
     *
     * @throws If `auth.resetPassword` endpoint does not exist in configuration.
     */
    public resetPassword(
      resetToken: string,
      password: string,
      passwordConfirmation: string,
    ): Promise<void>;

    /**
     * Performs an API call to the `auth.requestPasswordReset` endpoint.
     *
     * @param email User email.
     *
     * @throws If `auth.requestPasswordReset` endpoint does not exist in configuration.
     */
    public requestPasswordReset(email: string): Promise<void>;

    /**
     * Performs an API call to the `auth.verifyEmail` endpoint.
     *
     * @param verificationToken Verification token.
     *
     * @throws If `auth.verifyEmail` endpoint does not exist in configuration.
     */
    public verifyEmail(verificationToken: string): Promise<void>;

    /**
     * Performs an API call to the `auth.requestEmailVerification` endpoint.
     *
     * @throws If `auth.requestEmailVerification` endpoint does not exist in configuration.
     */
    public requestEmailVerification(): Promise<void>;

    /**
     * Performs an API call to the `auth.viewMe` endpoint.
     *
     * @returns Current user info.
     *
     * @throws If `auth.viewMe` endpoint does not exist in configuration.
     */
    public viewMe(): Promise<DataModel['users']>;

    /**
     * Performs an API call to the `resource` view endpoint.
     *
     * @param resource Type of resource for which to call the API.
     *
     * @param id Resource id.
     *
     * @param options Additional requests options.
     *
     * @returns Requested resource.
     *
     * @throws If view endpoint for this resource does not exist in configuration.
     */
    public view<Resource extends keyof DataModel & string>(
      resource: Resource,
      id: Id,
      options?: QueryOptions,
    ): Promise<DataModel[Resource]>;

    /**
     * Performs an API call to the `resource` delete endpoint.
     *
     * @param resource Type of resource for which to call the API.
     *
     * @param id Resource id.
     *
     * @throws If delete endpoint for this resource does not exist in configuration.
     */
    public delete<Resource extends keyof DataModel & string>(
      resource: Resource,
      id: Id,
    ): Promise<void>;

    /**
     * Performs an API call to the `resource` create endpoint.
     *
     * @param resource Type of resource for which to call the API.
     *
     * @param payload Resource payload.
     *
     * @param options Additional requests options.
     *
     * @returns Created resource.
     *
     * @throws If create endpoint for this resource does not exist in configuration.
     */
    public create<Resource extends keyof DataModel & string>(
      resource: Resource,
      payload: unknown,
      options?: QueryOptions,
    ): Promise<DataModel[Resource]>;

    /**
     * Performs an API call to the `resource` update endpoint.
     *
     * @param resource Type of resource for which to call the API.
     *
     * @param id Resource id.
     *
     * @param payload Resource payload.
     *
     * @param options Additional requests options.
     *
     * @returns Updated resource.
     *
     * @throws If update endpoint for this resource does not exist in configuration.
     */
    public update<Resource extends keyof DataModel & string>(
      resource: Resource,
      id: Id,
      payload: unknown,
      options?: QueryOptions,
    ): Promise<DataModel[Resource]>;

    /**
     * Performs an API call to the `resource` list endpoint.
     *
     * @param resource Type of resource for which to call the API.
     *
     * @param options Additional requests options.
     *
     * @returns Requested resources list.
     *
     * @throws If list endpoint for this resource does not exist in configuration.
     */
    public list<Resource extends keyof DataModel & string>(
      resource: Resource,
      options?: QueryOptions,
    ): Promise<Results<DataModel[Resource]>>;

    /**
     * Performs an API call to the `resource` search endpoint.
     *
     * @param resource Type of resource for which to call the API.
     *
     * @param searchBody Search body.
     *
     * @param options Additional requests options. Defaults to `{}`.
     *
     * @returns Requested resources list.
     *
     * @throws If search endpoint for this resource does not exist in configuration.
     */
    public search<Resource extends keyof DataModel & string>(
      resource: Resource,
      searchBody: SearchBody,
      options?: QueryOptions,
    ): Promise<Results<DataModel[Resource]>>;
  }
}
