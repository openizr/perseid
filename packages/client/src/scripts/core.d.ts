/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '@perseid/client' {
  import type {
    UserInputs,
    FormPlugin,
    Configuration,
    FieldConfiguration,
  } from '@perseid/form';
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
  import BaseStore from '@perseid/store';
  import type { Module } from '@perseid/store';
  import type { RoutingContext } from '@perseid/store/extensions/router';

  /**
   * Generic confirmation modal props.
   */
  interface GenericConfirmationModalProps {
    /** Confirmation title. */
    title: string;

    /** Confirmation subtitle. */
    subTitle: string;

    /** Confirmation button label. */
    confirm: string;

    /** Cancel button label. */
    cancel: string;

    /** Callback triggered at confirmation. */
    onConfirm?: () => void;
  }

  /**
   * Mapping of field paths to their respective sorting orders.
   * The value `1` denotes an ascending sort order, while `-1` indicates a descending sort order.
   */
  type Sorting = Record<string, 1 | -1>;

  /**
   * Generic component props.
   */
  type ComponentProps = Record<string, unknown>;

  /**
   * Complete form definition, containing both its configuration and rendering properties.
   */
  interface FormDefinition {
    /** Form configuration. */
    configuration: Configuration;

    /** List of fields that need to be fetched. */
    requestedFields: Set<string>;

    /** List of visual properties for each form field. */
    fieldProps: Record<string, {
      /** Name of the component to use for that field. */
      component: string;

      /** Component props for that field. */
      componentProps?: ComponentProps;
    } | undefined>;
  }

  /**
   * List of data model resources, per id.
   */
  type Resources<
    DataModel extends DefaultDataModel,
    Resource extends keyof DataModel & string = keyof DataModel & string
  > = Record<string, DataModel[Resource]>;

  /**
   * Global resources registry.
   */
  type Registry<DataModel extends DefaultDataModel> = {
    [Resource in keyof DataModel & string]: Resources<DataModel, Resource>;
  };

  /**
   * Request search body, containing full-text search and filters.
   */
  interface SearchBody {
    /** Search query, for performing full-text searches. */
    query: null | {
      /** List of fields paths on which to perform the full-text search. */
      on: string[];

      /** Search query. */
      text: string;
    };

    /** Filters to apply to the request, per field. */
    filters: null | Record<string, unknown>;
  }

  /**
   * Query options to use when fetching resources.
   */
  interface QueryOptions {
    page?: number;
    query?: string;
    limit?: number;
    offset?: number;
    sortBy?: string[];
    fields?: string[];
    sortOrder?: (1 | -1)[];
    filters?: SearchBody['filters'];
  }

  /**
   * HTTP error mock.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/core/errors/Http.ts
   */
  export class HttpError extends Error {
    /** Mocked HTTP response. */
    public response: { data: unknown; status: number; };

    /**
     * Class constructor.
     *
     * @param response Mocked HTTP response.
     */
    constructor(response: { data: unknown; status: number; });
  }

  /**
   * Logger settings
   */
  export interface LoggerSettings {
    /** Minimum logging level (all logs below that level won't be logs). */
    logLevel: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  }

  /**
   * Console-based logging system.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/core/services/Logger.ts
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
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/core/services/Model.ts
   */
  export class Model<
    /** Data model types definitions. */
    DataModel extends DefaultDataModel = DefaultDataModel,
  > extends BaseModel<DataModel> {
    /**
     * Deserializes `schema` received from the API.
     *
     * @param schema Serialized schema.
     *
     * @returns Data model field schema.
     */
    private deserializeSchema(schema: Record<string, unknown>): FieldSchema<DataModel>;

    /**
     * Updates data model with `schemaFragment`.
     *
     * @param schemaFragment Fragment of data model schema. Contains a subset of resources schemas.
     */
    public update(schemaFragment: Partial<DataModelSchema<DataModel>>): void;
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
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/core/services/ApiClient.ts
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

    /** Used to deduplicate `refreshToken` calls, when performing multiple API calls at once. */
    protected refreshTokenPromise: Promise<Credentials> | null;

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

  interface NotificationData {
    message: string;
    duration?: number;
    closable?: boolean;
    modifiers?: string;
  }

  /**
   * Access types for a specific resource field.
   */
  export type AccessType = 'SEARCH' | 'LIST' | 'CREATE' | 'UPDATE' | 'VIEW' | 'DELETE';

  /**
   * App page configuration.
   */
  export interface Page {
    /** Page route. */
    route: string;

    /**
     * Name of the page component to display. For generic pages, the default components will be used
     * if this value is not specified.
     */
    component?: string;

    /** Page visibility. */
    visibility: 'PRIVATE' | 'PUBLIC' | 'PUBLIC_ONLY';

    /** Additional props to pass to the page component. */
    pageProps?: Record<string, unknown>;

    /** Additional props to pass to the global layout when displaying this page. */
    layoutProps?: {
      /** Whether to display layout itself, or only its children. Defaults to `true`. */
      display?: boolean;

      /** Any additional prop. */
      [name: string]: unknown;
    };
  }

  /**
   * Auth store module state.
   */
  export interface AuthState<DataModel extends DefaultDataModel = DefaultDataModel> {
    /** Auth status. */
    status: 'INITIAL' | 'SUCCESS' | 'ERROR' | 'PENDING';

    /** Currently sign-in user, if any. */
    user: DataModel['users'] | null;
  }

  /**
   * Resource view page data.
   */
  export type ViewPageData = {
    /** Resource id. */
    id: Id;

    /** Whether resource is being loaded. */
    loading: boolean;

    /** List of resource fields to display. */
    fields: string[];
  } | null;

  /**
   * Resource update or create page data.
   */
  export type UpdateOrCreatePageData = {
    /** Resource id. */
    id?: Id;

    /** Whether resource is being loaded. */
    loading: boolean;

    /** Form configuration to update or create resource. */
    configuration: FormDefinition['configuration'];

    /** Additional form fields props. */
    fieldProps: FormDefinition['fieldProps'];
  } | null;

  /**
   * Resources list page data.
   */
  export type ListPageData<DataModel extends DefaultDataModel> = {
    /** Whether resource is being loaded. */
    loading: boolean;

    /** List of resource fields to display. */
    fields: string[];

    /** Current results page. */
    page: number;

    /** Total number of results. */
    total: number;

    /** Maximum number of results to fetch at a time. */
    limit: number;

    /** How to sort results. */
    sorting: Sorting;

    /** List of results ids. */
    results: Id[] | null;

    /** Fields over which to search for results. */
    searchFields: string[];

    /** Results resource. */
    resource: keyof DataModel & string;

    /** Results search query. */
    search: SearchBody | null;
  } | null;

  /**
   * Modal store module state.
   */
  export interface ModalState {
    /** Whether to display the modal. */
    show: boolean;

    /** Additional modifiers to apply to the modal container. */
    modifiers: string;

    /** Name of the component to display in modal. */
    component: string;

    /** Additional props to pass to the component once mounted in modal. */
    componentProps: Record<string, unknown>;
  }

  /** Notification information. */
  export type NotifierState = {
    /** Notification unique id. */
    id: string;

    /** Notification message. */
    message: string;

    /** Whether notification can be manually dismissed. */
    closable: boolean;

    /** Additional modifiers to apply. */
    modifiers?: string;

    /** Handles notification duration. */
    timer: {
      id: number;
      duration: number;
      startedAt: number;
    };
  }[];

  /**
   * Store settings.
   */
  export interface StoreSettings<DataModel extends DefaultDataModel = DefaultDataModel> {
    /** Route to use as a fallback for redirects. */
    fallbackPageRoute: string;

    /** Generic pages configurations. */
    pages: {
      auth: {
        signUp?: Omit<Page, 'visibility' | 'resource' | 'type'>;
        signIn?: Omit<Page, 'visibility' | 'resource' | 'type'>;
        updateUser?: Omit<Page, 'visibility' | 'resource' | 'type'>;
        verifyEmail?: Omit<Page, 'visibility' | 'resource' | 'type'>;
        resetPassword?: Omit<Page, 'visibility' | 'resource' | 'type'>;
      };
      resources: Partial<Record<keyof DataModel & string, Partial<Record<string, Omit<Page, 'visibility'>>>>>;
    };
  }

  /**
   * Perseid store, extended with various methods and attributes to handle generic apps states.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/core/services/Store.ts
   */
  export class Store<
    DataModel extends DefaultDataModel = DefaultDataModel
  > extends BaseStore {
    /** Logging system to use. */
    protected logger: Logger;

    /** Perseid model to use. */
    protected model: Model<DataModel>;

    /** API client to use. */
    protected apiClient: ApiClient<DataModel>;

    /** Form builder to use. */
    protected formBuilder: FormBuilder<DataModel>;

    /** Page route used as a fallback for missing pages. */
    protected fallbackPageRoute: string;

    /** Current app route. */
    protected currentRoute: string | null;

    /** `useSubscription` method to use in components. */
    public useSubscription: unknown;

    /** List of resource already existing in data model. */
    protected loadedResources: Set<keyof DataModel & string>;

    /** List of app pages configurations. */
    protected pages: Partial<Record<string, Omit<Page, 'route'>>>;

    /** Currently signed-in user. */
    protected user: DataModel['users'] | null;

    /** List of auth and resources pages routes.  */
    protected pageRoutes: {
      auth: {
        signIn?: string;
        signUp?: string;
        signOut?: string;
        refreshToken?: string;
        updateUser?: string;
        verifyEmail?: string;
        resetPassword?: string;
      };
      resources: Partial<Record<keyof DataModel & string, Partial<Record<string, string>>>>;
    };

    /** Notifies user when unhandled errors happen in the form. */
    protected errorNotifierPlugin: FormPlugin;

    /** Store module that handles app errors. */
    protected errorModule: Module<Error | null>;

    /** Store module that handles global resources registry. */
    protected registryModule: Module<Partial<Registry<DataModel>>>;

    /** Store module that handles current page state. */
    protected pageModule: Module<ListPageData<DataModel> | ViewPageData | UpdateOrCreatePageData>;

    /** Store module that handles users authentication. */
    protected authModule: Module<AuthState<DataModel>>;

    /** Store module that handles UI notifications. */
    protected notifierModule: Module<NotifierState>;

    /** Store module that handles app modal. */
    protected modalModule: Module<ModalState>;

    /**
     * Parses querystring `sortBy` and `sortOrder` into a proper structure.
     *
     * @param querySortBy `sortBy` query param.
     *
     * @param querySortOrder `sortOrder` query param.
     *
     * @returns Structured sorting.
     */
    protected computeSorting(querySortBy?: string, querySortOrder?: string): Sorting;

    /**
     * Redirects user to sign-in page if it exists.
     *
     * @param path Redirect page after signing in.
     */
    protected redirectToSignInPage(path: string): void;

    /**
     * Catches and handles most common errors thrown by `callback`.
     *
     * @param callback Callback to wrap.
     *
     * @param redirect Whether user should be redirected to 403 or 404 pages if necessary.
     *
     * @returns Wrapped callback.
     */
    protected catchErrors<T>(promise: Promise<T>, redirect: boolean): Promise<T | null>;

    /**
     * Formats `output` from HTTP response into store registry.
     *
     * @param output Output to format.
     *
     * @param model Current output data model.
     *
     * @param registry Global resources registry to use.
     *
     * @returns Formatted output.
     */
    protected formatOutput<Resource extends keyof DataModel & string>(
      output: DataModel[Resource],
      model: FieldSchema<DataModel>,
      registry: Partial<Registry<DataModel>>,
    ): DataModel[Resource];

    /**
     * Normalizes `resources` of `resource`, extracting all relations into their registry and
     * replacing them by their id. Also updates global resources registry.
     *
     * @param resource Resources resource.
     *
     * @param resources Resources to normalize.
     *
     * @returns Normalized resources.
     */
    protected normalizeResources<Resource extends keyof DataModel & string>(
      resource: Resource,
      resources: DataModel[Resource][],
    ): DataModel[Resource][];

    /**
     * Returns current page data.
     *
     * @param newState Routing, auth and error states.
     *
     * @returns Page data.
     */
    protected getPageData(
      newState: [RoutingContext, AuthState],
    ): Promise<unknown>;

    /**
     * Builds the URL querystring from `options`.
     *
     * @param options Query options.
     *
     * @returns URL querystring.
     */
    protected buildQuery(options: QueryOptions): string;

    /**
     * Class constructor.
     *
     * @param model Data model instance to use.
     *
     * @param logger Logging system to use.
     *
     * @param apiClient API client to use.
     *
     * @param formBuilder Form builder to use.
     *
     * @param settings Store settings.
     */
    constructor(
      model: Model<DataModel>,
      logger: Logger,
      apiClient: ApiClient<DataModel>,
      formBuilder: FormBuilder<DataModel>,
      settings: StoreSettings<DataModel>,
    );

    /**
     * Returns `true` if user has permissions to access `field` from `resource` in given context.
     *
     * @param resource Field resource.
     *
     * @param field Field path in resource.
     *
     * @param accessType Access type.
     *
     * @returns `true` if user has necessary permissions, `false` otherwise.
     */
    public canAccessField<Resource extends keyof DataModel & string>(
      resource: Resource,
      field: string,
      accessType: AccessType,
    ): boolean;

    /**
     * Returns field value at `path`, from resource with id `id` in `resource`.
     *
     * @param resource Resource resource.
     *
     * @param id Resource id.
     *
     * @param path Path to the resource field.
     *
     * @param registry Global registry to use.
     *
     * @param currentPath Used internally - current path in resource.
     *
     * @param currentPrefix Used internally - current prefix in resource.
     *
     * @param currentValue Used internally - current value in resource.
     *
     * @returns Field value if it exists, `null` otherwise.
     */
    public getValue(
      resource: keyof DataModel & string,
      id: Id,
      path: string,
      registry: Partial<Registry<DataModel>>,
      currentPath?: string,
      currentPrefix?: string[],
      currentValue?: unknown,
    ): DataModel[keyof DataModel & string] | null;

    /**
     * API client `view` method wrapper, that handles common errors and updates global registry.
     *
     * @param resource Type of resource for which to call the API.
     *
     * @param id Resource id.
     *
     * @param options Additional requests options.
     *
     * @returns Requested resource.
     */
    public view<Resource extends keyof DataModel & string>(
      resource: Resource,
      id: Id,
      options?: QueryOptions,
    ): Promise<DataModel[Resource] | null>;

    /**
     * API client `delete` method wrapper, that handles common errors and deletes global registry.
     *
     * @param resource Type of resource for which to call the API.
     *
     * @param id Resource id.
     */
    public delete<Resource extends keyof DataModel & string>(
      resource: Resource,
      id: Id,
    ): Promise<void>;

    /**
     * API client `update` method wrapper, that handles common errors and updates global registry.
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
     */
    public update<Resource extends keyof DataModel & string>(
      resource: Resource,
      id: Id,
      payload: unknown,
      options?: QueryOptions,
    ): Promise<DataModel[Resource] | null>;

    /**
     * API client `create` method wrapper, that handles common errors and updates global registry.
     *
     * @param resource Type of resource for which to call the API.
     *
     * @param id Resource id.
     *
     * @param options Additional requests options.
     *
     * @returns Created resource.
     */
    public create<Resource extends keyof DataModel & string>(
      resource: Resource,
      payload: unknown,
      options?: QueryOptions,
    ): Promise<DataModel[Resource] | null>;

    /**
     * API client `search` method wrapper, that handles common errors and updates global registry.
     *
     * @param resource Type of resource for which to call the API.
     *
     * @param searchBody Search request body.
     *
     * @param options Additional requests options.
     *
     * @returns Requested resources list.
     */
    public search<Resource extends keyof DataModel & string>(
      resource: Resource,
      searchBody: SearchBody,
      options?: QueryOptions,
    ): Promise<Results<DataModel[Resource]> | null>;

    /**
     * API client `list` method wrapper, that handles common errors and updates global registry.
     *
     * @param resource Type of resource for which to call the API.
     *
     * @param options Additional requests options.
     *
     * @returns Requested resources list.
     */
    public list<Resource extends keyof DataModel & string>(
      resource: Resource,
      options?: QueryOptions,
    ): Promise<Results<DataModel[Resource]> | null>;

    /**
     * Either lists or searches for resources, depending on `searchBody`.
     *
     * @param resource Type of resource for which to call the API.
     *
     * @param searchBody Search request body. If null, a simple resources list will be performed.
     *
     * @param options Additional requests options.
     */
    public listOrSearch<Resource extends keyof DataModel & string>(
      resource: Resource,
      searchBody: SearchBody | null,
      options?: QueryOptions & { sorting?: Sorting; },
    ): Promise<void>;

    /**
     * Navigates user to the given page.
     *
     * @param data Page data.
     */
    public goToPage(data: Exclude<ListPageData<DataModel>, null>): Promise<void>;

    /**
     * Initializes app router.
     */
    public createRoutes(): void;

    /**
     * Creates a new app page at `route` with `configuration`.
     *
     * @param route Path to the app page.
     *
     * @param configuration Route configuration.
     */
    public createRoute(route: string, configuration: Omit<Page, 'route'>): void;

    /**
    * Navigates to `url`, without reloading the page.
    * Caveat: the `router` store module must be registered.
    *
    * @param url Target URL.
    *
    * @returns The actual navigation function.
    */
    public navigate(url: string): (event?: MouseEvent) => void;

    /**
     * Returns page route for `type`.
     *
     * @param type Route type (e.g. `auth.signIn`, `users.list`).
     *
     * @returns Page route.
     */
    public getRoute(type: string): string | null;

    /**
     * Returns all resources list pages routes.
     *
     * @returns Resources list routes.
     */
    public getResourceRoutes(): { resource: string; route: string; }[];

    /**
     * Returns all registered pages routes.
     *
     * @returns App pages routes.
     */
    public getAllRoutes(): string[];

    /**
     * Returns page configuration for `route`.
     *
     * @param route Route for which to get page configuration.
     *
     * @returns Page configuration if route exists, `null` otherwise.
     */
    public getPage(route: string): Page | null;

    /**
     * Returns app fallback page route.
     *
     * @returns Fallback page route.
     */
    public getFallbackPageRoute(): string;

    /**
     * Creates a new UI notification with `message`.
     *
     * @param message Notification message.
     */
    public notify(message: string): void;

    /**
     * Displays a confirmation modal with `props`.
     *
     * @param props Confirmation modal props.
     */
    public confirm<ConfirmationModalProps extends GenericConfirmationModalProps>(
      props: ConfirmationModalProps,
    ): void;

    /**
     * Navigates back through user history.
     */
    public goBack(): void;
  }

  /**
   * Filtered perseid data model, according to user permissions.
   */
  export interface FilteredModel<DataModel extends DefaultDataModel> {
    fields: Set<string>,
    canUserCreateResource: boolean,
    schema: FieldSchema<DataModel>,
  }

  /**
   * Perseid data model to form configuration schema formatter.
   */
  export type FormFormatter<DataModel extends DefaultDataModel> = (
    schema: FieldSchema<DataModel>,
    path: string,
    extraFieldsTree: Record<string, unknown>,
    store: Store<DataModel>,
  ) => {
    configuration: FieldConfiguration;
    fieldProps: Record<string, { component: string; componentProps: Record<string, unknown>; }>;
  };

  /**
   * Handles forms configurations generation.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/core/services/FormBuilder.ts
   */
  export class FormBuilder<
    DataModel extends DefaultDataModel = DefaultDataModel
  > {
    /** Logging system to use. */
    protected logger: Logger;

    /** Perseid model to use. */
    protected model: Model<DataModel>;

    /** Password pattern regexp. */
    protected readonly PASSWORD_REGEXP: RegExp;

    /** Email pattern regexp. */
    protected readonly EMAIL_REGEXP: RegExp;

    /** List of formatters, used to format a perseid data model into its form equivalent. */
    protected readonly FORMATTERS: Record<FieldSchema<DataModel>['type'], FormFormatter<DataModel>>;

    /**
     * Generates fields tree from `fields`. Used to fetch nested relations fields in formatters.
     *
     * @param fields List of fields to generate tree from.
     *
     * @returns Generated fields tree.
     */
    protected generateFieldsTree(fields: Set<string>): Record<string, unknown>;

    /**
     * Filters `resource` data model schema and removes all fields for which user has no permission.
     *
     * @param resource Resource data model to filter.
     *
     * @param mode Edition mode (update / create).
     *
     * @param schema Current schema in data model schema.
     *
     * @param path Current path in data model.
     *
     * @param store Store instance that provides useful methods.
     *
     * @returns `null` if user has no access to the field, filtered data model otherwise.
     */
    protected filterModel<Resource extends keyof DataModel & string>(
      resource: Resource,
      mode: 'UPDATE' | 'CREATE',
      schema: FieldSchema<DataModel>,
      path: string,
      store: Store<DataModel>,
    ): null | FilteredModel<DataModel>;

    protected filterModel<T extends FilteredModel<DataModel>>(
      resource: keyof DataModel & string,
      mode: 'UPDATE' | 'CREATE',
      schema: FieldSchema<DataModel>,
      path: string,
      store: Store<DataModel>,
    ): T;

    protected filterModel<Resource extends keyof DataModel & string>(
      resource: Resource,
      mode: 'UPDATE' | 'CREATE',
      schema: FieldSchema<DataModel>,
      path: string,
      store: Store<DataModel>,
    ): null | FilteredModel<DataModel>;

    /**
     * Class constructor.
     *
     * @param model Data model instance to use.
     *
     * @param logger Logging system to use.
     */
    constructor(
      model: Model<DataModel>,
      logger: Logger,
    );

    /**
     * Generates the form configuration for the resource update / creation UI of `resource`.
     *
     * @param resource Resource resource.
     *
     * @param id Id of the resource to update, if applicable. Defaults to `null`.
     *
     * @param extraFields Additional fields to request when fetching resource, if applicable.
     * This is especially useful if you need to use a different field than `_id` to display
     * relations. Defaults to `new Set()`.
     *
     * @param store Store instance that provides useful methods.
     *
     * @returns Generated form configuration.
     */
    public buildConfiguration<Resource extends keyof DataModel & string>(
      resource: Resource,
      id: Id | null,
      extraFields: Set<string>,
      store: Store<DataModel>,
    ): FormDefinition;

    /**
     * Returns sign-up page form configuration.
     *
     * @param signIn Submit callback to execute to sign user up.
     *
     * @returns Form configuration.
     */
    public getSignUpConfiguration(signUp: (data: UserInputs) => Promise<void>): FormDefinition;

    /**
     * Returns sign-in page form configuration.
     *
     * @param signIn Submit callback to execute to sign user in.
     *
     * @returns Form configuration.
     */
    public getSignInConfiguration(signIn: (data: UserInputs) => Promise<void>): FormDefinition;

    /**
     * Returns user update page form configuration.
     *
     * @param user Currently signed-in user.
     *
     * @param updateUser Submit callback to execute to update user info.
     *
     * @param resetPassword Callback to execute to request user password reset.
     *
     * @returns Form configuration.
     */
    public getUpdateUserConfiguration(
      user: DataModel['users'],
      updateUser: (data: UserInputs) => Promise<void>,
      resetPassword: () => Promise<void>,
    ): FormDefinition;

    /**
     * Returns password reset page form configuration.
     *
     * @param resetToken Password reset token.
     *
     * @param resetPassword Submit callback to execute to reset user password.
     *
     * @param requestPasswordReset Submit callback to execute to request user password reset.
     *
     * @returns Form configuration.
     */
    public getResetPasswordConfiguration(
      resetToken: string | null,
      resetPassword: (data: UserInputs) => Promise<void>,
      requestPasswordReset: (data: UserInputs) => Promise<void>,
    ): FormDefinition;
  }
}
