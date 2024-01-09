/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Id,
  isPlainObject,
  type Results,
  type IdSchema,
  type FieldSchema,
  type ArraySchema,
  type DefaultDataModel,
  type CollectionSchema,
  type DataModelMetadata,
} from '@perseid/core';
import * as idb from 'idb-keyval';
import Model from 'scripts/core/services/Model';
import HttpError from 'scripts/core/errors/Http';
import Logger from 'scripts/core/services/Logger';

/**
 * API request configuration.
 */
export interface RequestConfiguration {
  /** API endpoint to call, from API baseUrl. */
  endpoint?: string;

  /** Absolute API URL to call, if necessary. */
  url?: string;

  /** HTTP method to use for this request. */
  method: 'POST' | 'DELETE' | 'GET' | 'PUT';

  /** Request body. */
  body?: string;

  /** Request headers. */
  headers?: Record<string, string>;
}

/** Built-in endpoint type. */
export type EndpointType = 'search' | 'view' | 'list' | 'create' | 'update' | 'delete';

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

  /** Collections-related endpoints. */
  collections: Partial<Record<keyof DataModel, Partial<Record<EndpointType, BuiltInEndpoint>>>>;
}

/**
 * API client settings.
 */
export interface ApiClientSettings<DataModel> {
  /** API base URL. */
  baseUrl: string;

  /** List of built-in endpoints to register. */
  endpoints: BuiltInEndpoints<DataModel>;

  /** List of mocked API responses, for each endpoint. */
  mockedResponses: Record<string, {
    /** Response code for each request, in that order. */
    codes?: number[];

    /** Duration for each request, in that order. */
    durations?: number[];

    /** Response body for each request, in that order. */
    responses?: unknown[];
  }>;
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
 * Handles HTTP requests to the API.
 */
export default class ApiClient<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel = DefaultDataModel,
> {
  /** Logging system to use. */
  protected logger: Logger;

  /** Perseid model to use. */
  protected model: Model<DataModel>;

  /** API base URL. */
  protected baseUrl: string;

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

  /**
   * Formats `input` into an HTTP body.
   *
   * @param input Input to format.
   *
   * @param isRoot Whether this is the root call. Used internally to stringify payload.
   * Defaults to `true`.
   *
   * @returns Formatted input.
   */
  protected async formatInput(input: unknown, isRoot = true): Promise<string> {
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
        reader.onload = (): void => { resolve(reader.result?.toString() ?? ''); };
        reader.onerror = (error): void => { reject(error); };
      });
    }
    if (Array.isArray(input)) {
      return Promise.all(input.map((item) => this.formatInput(item, false))) as unknown as string;
    }
    if (isPlainObject(input)) {
      const inputObject = input as Record<string, unknown>;
      const formattedInput = await (Object.keys(inputObject).reduce(async (resource, key) => ({
        ...await (resource as Promise<Record<string, unknown>>),
        [key]: await this.formatInput(inputObject[key], false),
      }), {}) as Promise<string>);
      return isRoot ? JSON.stringify(formattedInput) : formattedInput as unknown as string;
    }
    return input as string;
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
  protected formatOutput<Collection extends keyof DataModel>(
    output: unknown,
    model: FieldSchema<DataModel>,
  ): DataModel[Collection] {
    const { type } = model;
    const { relation } = model as IdSchema<DataModel>;
    const { fields } = model as ArraySchema<DataModel>;

    if (output === null) {
      return output as unknown as DataModel[Collection];
    }

    // Arrays...
    if (type === 'array') {
      const formattedOutput = [];
      for (let index = 0, { length } = output as unknown[]; index < length; index += 1) {
        formattedOutput[index] = this.formatOutput((output as unknown[])[index], fields);
      }
      return formattedOutput as unknown as DataModel[Collection];
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
      return formattedInput as unknown as DataModel[Collection];
    }

    // Expanded relation...
    if (type === 'id' && relation !== undefined && isPlainObject(output)) {
      const metaData = this.model.get(relation) as DataModelMetadata<CollectionSchema<DataModel>>;
      return this.formatOutput(output, { type: 'object', fields: metaData.schema.fields });
    }

    // Primitive values...
    if (type === 'id') {
      return new Id(output as string) as unknown as DataModel[Collection];
    }
    if (type === 'binary') {
      return this.encoder.encode(output as string) as unknown as DataModel[Collection];
    }
    if (type === 'date') {
      return new Date(output as string) as unknown as DataModel[Collection];
    }
    return output as unknown as DataModel[Collection];
  }

  /**
   * Refreshes API access token.
   *
   * @returns New credentials.
   */
  protected async refreshToken(): Promise<Credentials> {
    const credentials = await idb.get<Credentials>('credentials');
    const newCredentials = await this.request<Credentials>({
      method: 'POST',
      endpoint: '/auth/refresh-token',
      body: await this.formatInput({ refreshToken: credentials?.refreshToken }),
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
   * Performs either an real HTTP request or a mocked request depending on `requrest` configuration,
   * and handles authentication, errors, and environment-specific behaviour.
   *
   * @param request Request configuration.
   *
   * @param authenticate Whether to perform authentication before sending request.
   *
   * @returns HTTP response.
   */
  protected async request<T>(request: RequestConfiguration, authenticate = true): Promise<T> {
    let updatedRequest = request;
    let credentials = await idb.get<Credentials>('credentials');

    // Refreshing credentials if necessary...
    if (authenticate && this.endpoints.auth.refreshToken?.route !== undefined) {
      if (
        credentials !== undefined
        // && credentials.expiration < Date.now()
        && request.endpoint !== this.endpoints.auth.refreshToken.route
      ) {
        await this.refreshToken().then((newCredentials) => { credentials = newCredentials; });
      }
      updatedRequest = {
        ...request,
        headers: {
          ...request.headers,
          Authorization: `Bearer ${credentials?.accessToken}`,
        },
      };
    }

    // Sending HTTP request...
    updatedRequest = {
      ...updatedRequest,
      headers: {
        ...(request.body ? { 'Content-Type': 'application/json' } : {}),
        ...updatedRequest.headers,
        'X-Device-Id': credentials?.deviceId as unknown as string,
      },
    };

    const { endpoint, method, headers } = updatedRequest;
    const key = `${method} ${endpoint}`;

    // Classic HTTP request.
    if (this.mockedResponses[key] as unknown === undefined) {
      const response = await fetch(`${this.baseUrl}${endpoint}`, updatedRequest);
      if (response.status >= 400) {
        // Spreading error doesn't work, we need to explicitely list all its properties.
        throw {
          ok: response.ok,
          url: response.url,
          type: response.type,
          status: response.status,
          headers: response.headers,
          statusText: response.statusText,
          redirected: response.redirected,
          body: await response.json() as string,
        } as unknown as Error;
      }
      return response.headers.get('content-type')?.includes('application/json')
        ? response.json() as T
        : response.text() as T;
    }

    // Mocked HTTP request.
    return new Promise((resolve, reject) => {
      const statusCode = (this.mockedResponses[key].codes ?? [200]).splice(0, 1)[0];
      const response = (this.mockedResponses[key].responses ?? ['']).splice(0, 1)[0];
      const duration = (this.mockedResponses[key].durations ?? [500]).splice(0, 1)[0];
      this.logger.debug(`[API CLIENT] Calling ${method} '${endpoint}' API endpoint...`, headers, updatedRequest.body ?? '');
      setTimeout(() => {
        this.logger.debug(`[API CLIENT] HTTP status code: ${statusCode}, HTTP response: `, response);
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
    this.model = model;
    this.logger = logger;
    this.baseUrl = settings.baseUrl;
    this.endpoints = settings.endpoints;
    this.mockedResponses = settings.mockedResponses;
    this.formatInput = this.formatInput.bind(this);
  }

  /**
   * Builds the URL querystring from `options`.
   *
   * @param options Query options.
   *
   * @returns URL querystring.
   */
  public buildQuery(options: QueryOptions): string {
    const query: string[] = [];
    const {
      page,
      limit,
      offset,
      fields,
      sortBy,
      sortOrder,
      query: text,
    } = options;
    if (page !== undefined && page > 1) {
      query.push(`page=${page}`);
    }
    if (limit !== undefined && !Number.isNaN(limit)) {
      query.push(`limit=${limit}`);
    }
    if (offset !== undefined && !Number.isNaN(offset)) {
      query.push(`offset=${offset}`);
    }
    if (fields !== undefined && fields.length > 0) {
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

    return (query.length > 0) ? `?${query.join('&')}` : '';
  }

  /**
   * Fetches data model fragment for `collection`.
   *
   * @param collection Collection to fetch data model for.
   */
  public async getModel<Collection extends keyof DataModel>(collection: Collection): Promise<void> {
    const modelFragment = await this.request<Partial<DataModel>>({
      method: 'GET',
      endpoint: `/_model?collection=${collection as string}`,
    });
    this.model.update(modelFragment);
  }

  /**
   * Signs user out.
   */
  public async signOut(): Promise<void> {
    await this.request({
      method: 'POST',
      endpoint: '/auth/sign-out',
    });
    await idb.del('credentials');
  }

  /**
   * Signs user in.
   *
   * @param email User email.
   *
   * @param password User password.
   */
  public async signIn(email: string, password: string): Promise<void> {
    const credentials = await this.request<Credentials>({
      method: 'POST',
      endpoint: '/auth/sign-in',
      body: await this.formatInput({ email, password }),
    }, false);
    await idb.set('credentials', {
      deviceId: credentials.deviceId,
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      expiration: Date.now() + credentials.expiresIn * 1000,
    });
  }

  /**
   * Signs user up.
   *
   * @param email New user email.
   *
   * @param password New user password.
   *
   * @param passwordConfirmation New user password confirmation.
   */
  public async signUp(
    email: string,
    password: string,
    passwordConfirmation: string,
  ): Promise<void> {
    const credentials = await this.request<Credentials>({
      method: 'POST',
      endpoint: '/auth/sign-up',
      body: await this.formatInput({
        email,
        password,
        passwordConfirmation,
      }),
    }, false);
    await idb.set('credentials', {
      deviceId: credentials.deviceId,
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      expiration: Date.now() + credentials.expiresIn * 1000,
    });
  }

  /**
   * Resets user password.
   *
   * @param resetToken Password reset token.
   *
   * @param password New user password.
   *
   * @param passwordConfirmation User password confirmation.
   */
  public async resetPassword(
    resetToken: string,
    password: string,
    passwordConfirmation: string,
  ): Promise<void> {
    await this.request({
      method: 'PUT',
      endpoint: '/auth/reset-password',
      body: await this.formatInput({
        resetToken,
        password,
        passwordConfirmation,
      }),
    }, false);
  }

  /**
   * Requests user password reset.
   *
   * @param email User email.
   */
  public async requestPasswordReset(email: string): Promise<void> {
    await this.request({
      method: 'POST',
      endpoint: '/auth/reset-password',
      body: await this.formatInput({ email }),
    }, false);
  }

  /**
   * Verifies user email.
   *
   * @param verificationToken Verification token.
   */
  public async verifyEmail(verificationToken: string): Promise<void> {
    await this.request({
      method: 'PUT',
      endpoint: '/auth/verify-email',
      body: await this.formatInput({ verificationToken }),
    });
  }

  /**
   * Requests user email verification.
   */
  public async requestEmailVerification(): Promise<void> {
    await this.request({
      method: 'POST',
      endpoint: '/auth/verify-email',
    });
  }

  /**
   * Fetches resource identified by `id` from `collection`.
   *
   * @param collection Resource collection.
   *
   * @param id Resource id.
   *
   * @param options Additional requests options.
   *
   * @returns Requested resource.
   */
  public async view<Collection extends keyof DataModel>(
    collection: Collection,
    id: Id | 'me',
    options = this.defaultOptions,
  ): Promise<DataModel[Collection]> {
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
    const endpoint = this.endpoints.collections[collection]?.view?.route.replace(':id', String(id));
    return this.formatOutput<Collection>(await this.request({
      method: 'GET',
      endpoint: `${endpoint}${this.buildQuery(options)}`,
    }), { type: 'object', fields: metaData.schema.fields });
  }

  /**
   * Deletes resource identified by `id` from `collection`.
   *
   * @param collection Resource collection.
   *
   * @param id Resource id.
   */
  public async delete<Collection extends keyof DataModel>(
    collection: Collection,
    id: Id,
  ): Promise<void> {
    return this.request({
      method: 'DELETE',
      endpoint: this.endpoints.collections[collection]?.delete?.route.replace(':id', String(id)),
    });
  }

  /**
   * Creates a new resource in `collection`.
   *
   * @param collection Resource collection.
   *
   * @param payload Resource payload.
   *
   * @param options Additional requests options.
   *
   * @returns Created resource.
   */
  public async create<Collection extends keyof DataModel>(
    collection: Collection,
    payload: unknown,
    options = this.defaultOptions,
  ): Promise<DataModel[Collection]> {
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
    return this.formatOutput(await this.request({
      method: 'POST',
      endpoint: `${this.endpoints.collections[collection]?.create?.route}${this.buildQuery(options)}`,
      body: await this.formatInput(payload),
    }), { type: 'object', fields: metaData.schema.fields });
  }

  /**
   * Updates resource identified by `id` in `collection`.
   *
   * @param collection Resource collection.
   *
   * @param id Resource id.
   *
   * @param payload Resource payload.
   *
   * @param options Additional requests options.
   *
   * @returns Updated resource.
   */
  public async update<Collection extends keyof DataModel>(
    collection: Collection,
    id: Id | 'me',
    payload: unknown,
    options = this.defaultOptions,
  ): Promise<DataModel[Collection]> {
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
    const endpoint = this.endpoints.collections[collection]?.update?.route.replace(':id', String(id));
    return this.formatOutput(await this.request({
      method: 'PUT',
      endpoint: `${endpoint}${this.buildQuery(options)}`,
      body: await this.formatInput(payload),
    }), { type: 'object', fields: metaData.schema.fields });
  }

  /**
   * Fetches a list of resources from `collection`.
   *
   * @param collection Resources collection.
   *
   * @param options Additional requests options.
   *
   * @returns Requested resources list.
   */
  public async list<Collection extends keyof DataModel>(
    collection: Collection,
    options = this.defaultOptions,
  ): Promise<Results<DataModel[Collection]>> {
    const response = await this.request<Results<DataModel>>({
      method: 'GET',
      endpoint: `${this.endpoints.collections[collection]?.list?.route}${this.buildQuery(options)}`,
    });
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
    return {
      total: response.total,
      results: response.results.map((result) => (
        this.formatOutput(result, { type: 'object', fields: metaData.schema.fields })
      )),
    };
  }

  /**
   * Searches for specific resources in `collection`.
   *
   * @param collection Resources collection.
   *
   * @param searchBody Search request body.
   *
   * @param options Additional requests options.
   *
   * @returns Requested resources list.
   */
  public async search<Collection extends keyof DataModel>(
    collection: Collection,
    searchBody: SearchBody,
    options = this.defaultOptions,
  ): Promise<Results<DataModel[Collection]>> {
    const metaData = this.model.get(collection) as DataModelMetadata<CollectionSchema<DataModel>>;
    const response = await this.request<Results<DataModel>>({
      method: 'POST',
      body: await this.formatInput(searchBody),
      endpoint: `${this.endpoints.collections[collection]?.search?.route}${this.buildQuery(options)}`,
    });
    return {
      total: response.total,
      results: response.results.map((result) => (
        this.formatOutput(result, { type: 'object', fields: metaData.schema.fields })
      )),
    };
  }
}
