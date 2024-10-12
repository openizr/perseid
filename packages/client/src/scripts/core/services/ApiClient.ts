/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Id,
  HttpClient,
  isPlainObject,
  type Results,
  type IdSchema,
  type FieldSchema,
  type ArraySchema,
  type ObjectSchema,
  type ResourceSchema,
  type RequestSettings,
  type DataModelSchema,
  type DefaultDataModel,
  type DataModelMetadata,
} from '@perseid/core';
import * as idb from 'idb-keyval';
import Model from 'scripts/core/services/Model';
import HttpError from 'scripts/core/errors/Http';
import Logger from 'scripts/core/services/Logger';

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
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/core/services/ApiClient.ts
 */
export default class ApiClient<
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
  protected loadedResources = new Set<keyof DataModel & string>();

  /** List of mocked API responses, for each endpoint. */
  protected mockedResponses: ApiClientSettings<DataModel>['mockedResponses'];

  /** List of built-in endpoints to register. */
  protected endpoints: BuiltInEndpoints<DataModel>;

  /** Default query options. */
  protected defaultOptions: QueryOptions = {};

  /** Encoder for binary uploads. */
  protected encoder = new TextEncoder();

  /** Decoder for binary downloads. */
  protected decoder = new TextDecoder();

  /** Used to deduplicate `refreshToken` calls, when performing multiple API calls at once. */
  protected refreshTokenPromise: Promise<Credentials> | null;

  /**
   * Formats `input` into an HTTP request body.
   *
   * @param input Input to format.
   *
   * @returns Formatted input.
   */
  protected async formatInput(input: unknown): Promise<unknown> {
    if (input instanceof Id) {
      return String(input);
    }
    if (input instanceof Date) {
      return input.toISOString();
    }
    if (input instanceof Uint8Array) {
      return this.decoder.decode(input);
    }
    if (input instanceof File) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(input);
        reader.onload = (): void => { resolve((reader.result?.toString() ?? '')); };
        reader.onerror = (error): void => { reject(error as unknown as Error); };
      });
    }
    if (Array.isArray(input)) {
      return Promise.all(input.map((item) => this.formatInput(item)));
    }
    if (isPlainObject(input)) {
      const inputObject = input as Record<string, unknown>;
      const formattedInput = await (Object.keys(inputObject).reduce(async (resource, key) => ({
        ...await (resource as Promise<Record<string, unknown>>),
        [key]: await this.formatInput(inputObject[key]),
      }), {}) as Promise<string>);
      return formattedInput;
    }
    return input;
  }

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
  ): T {
    const { type } = model;
    const { relation } = model as IdSchema<DataModel>;
    const { fields } = model as ArraySchema<DataModel>;

    if (output === null) {
      return output as T;
    }

    // Arrays...
    if (type === 'array') {
      const formattedOutput: unknown[] = [];
      for (let index = 0, { length } = output as unknown[]; index < length; index += 1) {
        formattedOutput[index] = this.formatOutput((output as unknown[])[index], fields);
      }
      return formattedOutput as T;
    }

    // Objects...
    if (type === 'object') {
      const keys = Object.keys(output as Record<string, unknown>);
      const formattedInput: Record<string, unknown> = {};
      for (let index = 0, { length } = keys; index < length; index += 1) {
        formattedInput[keys[index]] = this.formatOutput(
          (output as Record<string, unknown>)[keys[index]],
          model.fields[keys[index]],
        );
      }
      return formattedInput as T;
    }

    // Expanded relation...
    if (type === 'id' && relation !== undefined && isPlainObject(output)) {
      const metadata = this.model.get(relation) as DataModelMetadata<ResourceSchema<DataModel>>;
      return this.formatOutput(output, { type: 'object', fields: metadata.schema.fields });
    }

    // Primitive values...
    if (type === 'id') {
      return new Id(output as string) as T;
    }
    if (type === 'binary') {
      return this.encoder.encode(output as string) as T;
    }
    if (type === 'date') {
      return new Date(output as string) as T;
    }
    return output as T;
  }

  /**
   * Builds the URL querystring from `options`.
   *
   * @param options Query options.
   *
   * @returns URL querystring.
   */
  protected buildQuery(options: QueryOptions): string {
    const query: string[] = [];
    const {
      page,
      limit,
      offset,
      fields,
      filters,
      sortBy,
      sortOrder,
      query: text,
    } = options;
    if (page !== undefined && page > 1) {
      query.push(`page=${String(page)}`);
    }
    if (limit !== undefined && !Number.isNaN(limit)) {
      query.push(`limit=${String(limit)}`);
    }
    if (offset !== undefined && !Number.isNaN(offset)) {
      query.push(`offset=${String(offset)}`);
    }
    if (Array.isArray(fields) && fields.length > 0) {
      query.push(`fields=${fields.join(',')}`);
    }
    if (text !== undefined && text.trim().length > 0) {
      query.push(`query=${text.trim()}`);
    }
    if (
      sortBy !== undefined
      && sortOrder !== undefined
      && sortBy.length > 0
      && sortOrder.length === sortBy.length
    ) {
      query.push(`sortBy=${sortBy.join(',')}&sortOrder=${sortOrder.join(',')}`);
    }
    if (
      isPlainObject(filters)
      && Object.keys(filters as unknown as Record<string, unknown>).length > 0
    ) {
      query.push(`filters=${JSON.stringify(filters)}`);
    }

    return (query.length > 0) ? `?${query.join('&')}` : '';
  }

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
  protected async request<T>(settings: ApiRequestSettings, authenticate = true): Promise<T> {
    let updatedSettings = settings;

    if (authenticate) {
      let credentials = await idb.get<Credentials>('credentials');
      // Refreshing credentials if necessary...
      if (
        credentials !== undefined
        && credentials.expiration < Date.now()
        && settings.endpoint !== this.endpoints.auth.refreshToken?.route
      ) {
        this.refreshTokenPromise ??= this.refreshToken();
        credentials = await this.refreshTokenPromise;
        this.refreshTokenPromise = null;
      }
      if (credentials !== undefined) {
        updatedSettings = {
          ...settings,
          headers: {
            ...settings.headers,
            'X-Device-Id': credentials.deviceId,
            Authorization: `Bearer ${credentials.accessToken}`,
          },
        };
      }
    }

    const { url, endpoint } = updatedSettings;
    const { method, headers } = updatedSettings;
    const key = `${method} ${String(url ?? endpoint)}`;
    const mockedResponse = this.mockedResponses[key];
    const fullUrl = updatedSettings.url ?? `${this.baseUrl}${endpoint as unknown as string}`;

    // Classic HTTP request.
    if (mockedResponse === undefined) {
      return super.request<T>({
        method,
        headers,
        url: fullUrl,
        body: updatedSettings.body,
      });
    }

    // Mocked HTTP request.
    return new Promise((resolve, reject) => {
      const statusCode = (mockedResponse.codes ?? [200]).splice(0, 1)[0];
      const response = (mockedResponse.responses ?? ['']).splice(0, 1)[0];
      const duration = (mockedResponse.durations ?? [500]).splice(0, 1)[0];
      this.logger.debug(`[API CLIENT] Calling ${method} '${updatedSettings.url ?? String(endpoint)}' API endpoint...`);
      this.logger.debug(headers);
      this.logger.debug(updatedSettings.body);
      setTimeout(() => {
        this.logger.debug(`[API CLIENT] HTTP status code: ${String(statusCode)}, HTTP response: `);
        this.logger.debug(response);
        if (statusCode >= 400) {
          reject(new HttpError({ data: response, status: statusCode }));
        } else {
          resolve(response as T);
        }
      }, duration);
    });
  }

  /**
   * Class constructor.
   *
   * @param model Data model instance to use.
   *
   * @param logger Logging system to use.
   *
   * @param settings API client settings.
   */
  constructor(model: Model<DataModel>, logger: Logger, settings: ApiClientSettings<DataModel>) {
    super(settings.connectTimeout);
    this.model = model;
    this.logger = logger;
    this.baseUrl = settings.baseUrl;
    this.refreshTokenPromise = null;
    this.endpoints = settings.endpoints;
    this.mockedResponses = settings.mockedResponses;
    this.formatInput = this.formatInput.bind(this);
  }

  /**
   * Fetches data model fragment for `resource` if necessary, and returns its metadata.
   *
   * @param resource Type of resource for which to get data model metadata.
   *
   * @returns Resource data model metadata.
   */
  public async getDataModel<Resource extends keyof DataModel & string>(
    resource: Resource,
  ): Promise<DataModelMetadata<ResourceSchema<DataModel>>> {
    if (!this.loadedResources.has(resource)) {
      const modelFragment = await this.request<Partial<DataModelSchema<DataModel>>>({
        method: 'GET',
        endpoint: `/_model?resource=${resource}`,
      });
      this.model.update(modelFragment);
      const resources = (Object.keys(modelFragment) as Resource[]);
      resources.forEach(this.loadedResources.add.bind(this.loadedResources));
    }
    return this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;
  }

  /**
   * Performs an API call to the `auth.refreshToken` endpoint.
   *
   * @returns New credentials.
   *
   * @throws If `auth.refreshToken` endpoint does not exist in configuration.
   */
  public async refreshToken(): Promise<Credentials> {
    const endpoint = this.endpoints.auth.refreshToken?.route;
    if (endpoint === undefined) {
      throw new Error('auth.refreshToken endpoint does not exist in configuration.');
    }
    const credentials = await idb.get<Credentials>('credentials');
    const newCredentials = await this.request<Credentials>({
      endpoint,
      method: 'POST',
      body: await this.formatInput({
        refreshToken: credentials?.refreshToken,
      }) as Record<string, unknown>,
    });
    await idb.set('credentials', {
      deviceId: newCredentials.deviceId,
      accessToken: newCredentials.accessToken,
      refreshToken: newCredentials.refreshToken,
      expiration: Date.now() + newCredentials.expiresIn * 1000,
    });
    return newCredentials;
  }

  /**
   * Performs an API call to the `auth.signOut` endpoint.
   *
   * @throws If `auth.signOut` endpoint does not exist in configuration.
   */
  public async signOut(): Promise<void> {
    const endpoint = this.endpoints.auth.signOut?.route;
    if (endpoint === undefined) {
      throw new Error('auth.signOut endpoint does not exist in configuration.');
    }
    await this.request({
      endpoint,
      method: 'POST',
    });
    await idb.del('credentials');
  }

  /**
   * Performs an API call to the `auth.signIn` endpoint.
   *
   * @param email User email.
   *
   * @param password User password.
   *
   * @throws If `auth.signIn` endpoint does not exist in configuration.
   */
  public async signIn(email: string, password: string): Promise<void> {
    const endpoint = this.endpoints.auth.signIn?.route;
    if (endpoint === undefined) {
      throw new Error('auth.signIn endpoint does not exist in configuration.');
    }
    const credentials = await this.request<Credentials>({
      endpoint,
      method: 'POST',
      body: await this.formatInput({ email, password }) as Record<string, unknown>,
    }, false);
    await idb.set('credentials', {
      deviceId: credentials.deviceId,
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      expiration: Date.now() + credentials.expiresIn * 1000,
    });
  }

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
  public async signUp(
    email: string,
    password: string,
    passwordConfirmation: string,
  ): Promise<void> {
    const endpoint = this.endpoints.auth.signUp?.route;
    if (endpoint === undefined) {
      throw new Error('auth.signUp endpoint does not exist in configuration.');
    }
    const credentials = await this.request<Credentials>({
      endpoint,
      method: 'POST',
      body: await this.formatInput({
        email,
        password,
        passwordConfirmation,
      }) as Record<string, unknown>,
    }, false);
    await idb.set('credentials', {
      deviceId: credentials.deviceId,
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      expiration: Date.now() + credentials.expiresIn * 1000,
    });
  }

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
  public async resetPassword(
    resetToken: string,
    password: string,
    passwordConfirmation: string,
  ): Promise<void> {
    const endpoint = this.endpoints.auth.resetPassword?.route;
    if (endpoint === undefined) {
      throw new Error('auth.resetPassword endpoint does not exist in configuration.');
    }
    await this.request({
      endpoint,
      method: 'PUT',
      body: await this.formatInput({
        password,
        resetToken,
        passwordConfirmation,
      }) as Record<string, unknown>,
    }, false);
  }

  /**
   * Performs an API call to the `auth.requestPasswordReset` endpoint.
   *
   * @param email User email.
   *
   * @throws If `auth.requestPasswordReset` endpoint does not exist in configuration.
   */
  public async requestPasswordReset(email: string): Promise<void> {
    const endpoint = this.endpoints.auth.requestPasswordReset?.route;
    if (endpoint === undefined) {
      throw new Error('auth.requestPasswordReset endpoint does not exist in configuration.');
    }
    await this.request({
      endpoint,
      method: 'POST',
      body: await this.formatInput({ email }) as Record<string, unknown>,
    }, false);
  }

  /**
   * Performs an API call to the `auth.verifyEmail` endpoint.
   *
   * @param verificationToken Verification token.
   *
   * @throws If `auth.verifyEmail` endpoint does not exist in configuration.
   */
  public async verifyEmail(verificationToken: string): Promise<void> {
    const endpoint = this.endpoints.auth.verifyEmail?.route;
    if (endpoint === undefined) {
      throw new Error('auth.verifyEmail endpoint does not exist in configuration.');
    }
    await this.request({
      endpoint,
      method: 'PUT',
      body: await this.formatInput({ verificationToken }) as Record<string, unknown>,
    });
  }

  /**
   * Performs an API call to the `auth.requestEmailVerification` endpoint.
   *
   * @throws If `auth.requestEmailVerification` endpoint does not exist in configuration.
   */
  public async requestEmailVerification(): Promise<void> {
    const endpoint = this.endpoints.auth.requestEmailVerification?.route;
    if (endpoint === undefined) {
      throw new Error('auth.requestEmailVerification endpoint does not exist in configuration.');
    }
    await this.request({
      method: 'POST',
      endpoint,
    });
  }

  /**
   * Performs an API call to the `auth.viewMe` endpoint.
   *
   * @returns Current user info.
   *
   * @throws If `auth.viewMe` endpoint does not exist in configuration.
   */
  public async viewMe(): Promise<DataModel['users']> {
    const endpoint = this.endpoints.auth.viewMe?.route;
    if (endpoint === undefined) {
      throw new Error('auth.viewMe endpoint does not exist in configuration.');
    }
    const [metadata, response] = await Promise.all([
      this.getDataModel('users'),
      this.request({
        method: 'GET',
        endpoint,
      }),
    ]);
    const schema: ObjectSchema<DataModel> = { type: 'object', fields: metadata.schema.fields };
    return this.formatOutput<DataModel['users']>(response, schema);
  }

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
  public async view<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
    options = this.defaultOptions,
  ): Promise<DataModel[Resource]> {
    const endpoint = this.endpoints.resources[resource]?.view?.route;
    if (endpoint === undefined) {
      throw new Error(`View endpoint for ${resource} does not exist in configuration.`);
    }
    const [metadata, response] = await Promise.all([
      this.getDataModel(resource),
      this.request({
        method: 'GET',
        endpoint: `${endpoint.replace(':id', String(id))}${this.buildQuery(options)}`,
      }),
    ]);
    const schema: ObjectSchema<DataModel> = { type: 'object', fields: metadata.schema.fields };
    return this.formatOutput<DataModel[Resource]>(response, schema);
  }

  /**
   * Performs an API call to the `resource` delete endpoint.
   *
   * @param resource Type of resource for which to call the API.
   *
   * @param id Resource id.
   *
   * @throws If delete endpoint for this resource does not exist in configuration.
   */
  public async delete<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
  ): Promise<void> {
    const endpoint = this.endpoints.resources[resource]?.delete?.route;
    if (endpoint === undefined) {
      throw new Error(`Delete endpoint for ${resource} does not exist in configuration.`);
    }
    return this.request({
      method: 'DELETE',
      endpoint: endpoint.replace(':id', String(id)),
    });
  }

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
  public async create<Resource extends keyof DataModel & string>(
    resource: Resource,
    payload: unknown,
    options = this.defaultOptions,
  ): Promise<DataModel[Resource]> {
    const endpoint = this.endpoints.resources[resource]?.create?.route;
    if (endpoint === undefined) {
      throw new Error(`Create endpoint for ${resource} does not exist in configuration.`);
    }
    const [metadata, response] = await Promise.all([
      this.getDataModel(resource),
      this.request({
        method: 'POST',
        endpoint: `${endpoint}${this.buildQuery(options)}`,
        body: await this.formatInput(payload) as Record<string, unknown>,
      }),
    ]);
    const schema: ObjectSchema<DataModel> = { type: 'object', fields: metadata.schema.fields };
    return this.formatOutput<DataModel[Resource]>(response, schema);
  }

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
  public async update<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
    payload: unknown,
    options = this.defaultOptions,
  ): Promise<DataModel[Resource]> {
    const endpoint = this.endpoints.resources[resource]?.update?.route;
    if (endpoint === undefined) {
      throw new Error(`Update endpoint for ${resource} does not exist in configuration.`);
    }
    const [metadata, response] = await Promise.all([
      this.getDataModel(resource),
      this.request({
        method: 'PUT',
        body: await this.formatInput(payload) as Record<string, unknown>,
        endpoint: `${endpoint.replace(':id', String(id))}${this.buildQuery(options)}`,
      }),
    ]);
    const schema: ObjectSchema<DataModel> = { type: 'object', fields: metadata.schema.fields };
    return this.formatOutput<DataModel[Resource]>(response, schema);
  }

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
  public async list<Resource extends keyof DataModel & string>(
    resource: Resource,
    options = this.defaultOptions,
  ): Promise<Results<DataModel[Resource]>> {
    const endpoint = this.endpoints.resources[resource]?.list?.route;
    if (endpoint === undefined) {
      throw new Error(`List endpoint for ${resource} does not exist in configuration.`);
    }
    const [metadata, response] = await Promise.all([
      this.getDataModel(resource),
      this.request<Results<unknown>>({
        method: 'GET',
        endpoint: `${endpoint}${this.buildQuery(options)}`,
      }),
    ]);
    const schema: ObjectSchema<DataModel> = { type: 'object', fields: metadata.schema.fields };
    return {
      total: response.total,
      results: response.results.map((result) => this.formatOutput(result, schema)),
    };
  }

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
  public async search<Resource extends keyof DataModel & string>(
    resource: Resource,
    searchBody: SearchBody,
    options = this.defaultOptions,
  ): Promise<Results<DataModel[Resource]>> {
    const endpoint = this.endpoints.resources[resource]?.search?.route;
    if (endpoint === undefined) {
      throw new Error(`Search endpoint for ${resource} does not exist in configuration.`);
    }
    const [metadata, response] = await Promise.all([
      this.getDataModel(resource),
      this.request<Results<unknown>>({
        method: 'POST',
        endpoint: `${endpoint}${this.buildQuery(options)}`,
        body: await this.formatInput(searchBody) as Record<string, unknown>,
      }),
    ]);
    const schema: ObjectSchema<DataModel> = { type: 'object', fields: metadata.schema.fields };
    return {
      total: response.total,
      results: response.results.map((result) => this.formatOutput(result, schema)),
    };
  }
}
