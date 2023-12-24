/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '@perseid/client' {
  import {
    type FormPlugin,
    type UserInputs,
    type Configuration,
    type FieldConfiguration,
  } from '@perseid/form';
  import {
    type Id,
    type User,
    type I18n,
    type Results,
    type FieldSchema,
    Model as BaseModel,
    Logger as BaseLogger,
    type DefaultDataModel,
  } from '@perseid/core';
  import BaseStore, { type Module } from '@perseid/store';
  import { type RoutingContext } from '@perseid/store/extensions/router';

  type UseSubscription = <T>(id: string, reducer?: ((state: any) => T) | undefined) => T;

  interface NotificationData {
    message: string;
    duration?: number;
    closable?: boolean;
    modifiers?: string;
  }

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
   * Mapping of field paths to their respective sorting orders.
   * The value `1` denotes an ascending sort order, while `-1` indicates a descending sort order.
   */
  type Sorting = Record<string, 1 | -1>;

  /**
   * Generic data model resource.
   */
  type Resource = Record<string, unknown>;

  /**
   * List of data model resources, per id.
   */
  type Resources<
    DataModel extends DefaultDataModel,
    Collection extends keyof DataModel = keyof DataModel
  > = Record<string, DataModel[Collection]>;

  /**
   * Global resources registry.
   */
  type Registry<DataModel extends DefaultDataModel> = {
    [Collection in keyof DataModel]: Resources<DataModel, Collection>;
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
   * Common props passed to generic components.
   */
  interface CommonProps<DataModel extends DefaultDataModel> {
    /** Perseid client services instances. */
    services: {
      /** I18n instance. */
      i18n: I18n;

      /** Perseid store instance. */
      store: Store<DataModel>;

      /** Perseid model instance. */
      model: Model<DataModel>;

      /** API client instance. */
      apiClient: ApiClient<DataModel>;
    };

    /** Data model collection, if any. */
    collection?: keyof DataModel;
  }

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
   * Generic Layout props.
   */
  interface GenericLayoutProps<DataModel extends DefaultDataModel> extends CommonProps<DataModel> {
    /** Whether to display layout itself, or only its children. Defaults to `true`. */
    display?: boolean;

    /** Layout children. */
    children: React.ReactNode;
  }

  /**
   * HTTP error mock.
   */
  export class HttpError extends Error {
    /** Mocked HTTP response. */
    public response: { data: unknown; status: number; };

    /**
     * Class constructor.
     *
     * @param response Mocked HTTP response.
     */
    constructor(response: { data: unknown; status: number; })
  }

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
  export class ApiClient<
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
    protected defaultOptions: QueryOptions;

    /** Encoder for binary uploads. */
    protected encoder: TextEncoder;

    /** Decoder for binary downloads. */
    protected decoder: TextDecoder;

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
    protected formatInput(input: unknown, isRoot?: boolean): Promise<string>;

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
    ): DataModel[Collection];

    /**
     * Refreshes API access token.
     *
     * @returns New credentials.
     */
    protected refreshToken(): Promise<Credentials>;

    /**
     * Performs either an real HTTP request or a mocked request depending on `requrest`
     * configuration, and handles authentication, errors, and environment-specific behaviour.
     *
     * @param request Request configuration.
     *
     * @param authenticate Whether to perform authentication before sending request.
     *
     * @returns HTTP response.
     */
    protected request<T>(request: RequestConfiguration, authenticate?: boolean): Promise<T>;

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
     * Builds the URL querystring from `options`.
     *
     * @param options Query options.
     *
     * @returns URL querystring.
     */
    public buildQuery(options: QueryOptions): string;

    /**
     * Fetches data model fragment for `collection`.
     *
     * @param collection Collection to fetch data model for.
     */
    public getModel<Collection extends keyof DataModel>(collection: Collection): Promise<void>;

    /**
     * Signs user out.
     */
    public signOut(): Promise<void>;

    /**
     * Signs user in.
     *
     * @param email User email.
     *
     * @param password User password.
     */
    public signIn(email: string, password: string): Promise<void>;

    /**
     * Signs user up.
     *
     * @param email New user email.
     *
     * @param password New user password.
     *
     * @param passwordConfirmation New user password confirmation.
     */
    public signUp(
      email: string,
      password: string,
      passwordConfirmation: string,
    ): Promise<void>;

    /**
     * Resets user password.
     *
     * @param resetToken Password reset token.
     *
     * @param password New user password.
     *
     * @param passwordConfirmation User password confirmation.
     */
    public resetPassword(
      resetToken: string,
      password: string,
      passwordConfirmation: string,
    ): Promise<void>;

    /**
     * Requests user password reset.
     *
     * @param email User email.
     */
    public requestPasswordReset(email: string): Promise<void>;

    /**
     * Verifies user email.
     *
     * @param verificationToken Verification token.
     */
    public verifyEmail(verificationToken: string): Promise<void>;

    /**
     * Requests user email verification.
     */
    public requestEmailVerification(): Promise<void>;

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
    public view<Collection extends keyof DataModel>(
      collection: Collection,
      id: Id | 'me',
      options?: QueryOptions,
    ): Promise<DataModel[Collection]>;

    /**
     * Deletes resource identified by `id` from `collection`.
     *
     * @param collection Resource collection.
     *
     * @param id Resource id.
     */
    public delete<Collection extends keyof DataModel>(
      collection: Collection,
      id: Id,
    ): Promise<void>;

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
    public create<Collection extends keyof DataModel>(
      collection: Collection,
      payload: unknown,
      options?: QueryOptions,
    ): Promise<DataModel[Collection]>;

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
    public update<Collection extends keyof DataModel>(
      collection: Collection,
      id: Id | 'me',
      payload: unknown,
      options?: QueryOptions,
    ): Promise<DataModel[Collection]>;

    /**
     * Fetches a list of resources from `collection`.
     *
     * @param collection Resources collection.
     *
     * @param options Additional requests options.
     *
     * @returns Requested resources list.
     */
    public list<Collection extends keyof DataModel>(
      collection: Collection,
      options?: QueryOptions,
    ): Promise<Results<DataModel[Collection]>>;

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
    public search<Collection extends keyof DataModel>(
      collection: Collection,
      searchBody: SearchBody,
      options?: QueryOptions,
    ): Promise<Results<DataModel[Collection]>>;
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
   * Perseid store, extended with various methods and attributes to handle generic apps states.
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

    /** Checks that password and password confirmation match. */
    protected passwordConfirmationPlugin: FormPlugin;

    /**
     * Generates fields tree from `fields`. Used to fetch nested relations fields in formatters.
     *
     * @param fields List of fields to generate tree from.
     *
     * @returns Generated fields tree.
     */
    protected generateFieldsTree(fields: Set<string>): Record<string, unknown>;

    /**
     * Filters `collection` data model schema and removes all fields for which user has no
     * permission.
     *
     * @param collection Collection data model to filter.
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
    protected filterModel<Collection extends keyof DataModel>(
      collection: Collection,
      mode: 'UPDATE' | 'CREATE',
      schema: FieldSchema<DataModel>,
      path: string,
      store: Store<DataModel>,
    ): null | FilteredModel<DataModel>;

    protected filterModel<T extends FilteredModel<DataModel>>(
      collection: keyof DataModel,
      mode: 'UPDATE' | 'CREATE',
      schema: FieldSchema<DataModel>,
      path: string,
      store: Store<DataModel>,
    ): T;

    protected filterModel<Collection extends keyof DataModel>(
      collection: Collection,
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
     * Generates the form configuration for the resource update / creation UI of `collection`.
     *
     * @param collection Resource collection.
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
    public buildConfiguration<Collection extends keyof DataModel>(
      collection: Collection,
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
      user: User,
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
    DataModel = DefaultDataModel,
  > extends BaseModel<DataModel> {
    /**
     * Updates data model with `schemaFragment`.
     *
     * @param schemaFragment Fragment of data model schema. Contains a subset of collections
     * schemas.
     */
    public update(schemaFragment: Partial<DataModel>): void;
  }

  /**
   * Access types for a specific resource field.
   */
  export type AccessType = 'SEARCH' | 'LIST' | 'CREATE' | 'UPDATE' | 'VIEW' | 'DELETE';

  /**
   * App page configuration.
   */
  export interface Page<DataModel extends DefaultDataModel> {
    /** Page route. */
    route: string;

    /** Type of page, if applicable. */
    type?: 'CREATE' | 'UPDATE' | 'LIST' | 'VIEW';

    /**
     * Name of the page component to display. For generic pages, the default components will be used
     * if this value is not specified.
     */
    component?: string;

    /** Page related collection, if applicable. */
    collection?: keyof DataModel;

    /** Page visibility. */
    visibility: 'PRIVATE' | 'PUBLIC' | 'PUBLIC_ONLY';

    /** Additional props to pass to the page component. */
    pageProps?: Record<string, unknown>;

    /** Additional props to pass to the global layout when displaying this page. */
    layoutProps?: Partial<GenericLayoutProps<DataModel>>;
  }

  /**
   * Auth store module state.
   */
  export interface AuthState {
    /** Auth status. */
    status: 'INITIAL' | 'SUCCESS' | 'ERROR' | 'PENDING';

    /** Currently sign-in user, if any. */
    user: User | null;
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

    /** Results collection. */
    collection: keyof DataModel;

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
        signUp?: Omit<Page<DataModel>, 'visibility' | 'collection' | 'type'>;
        signIn?: Omit<Page<DataModel>, 'visibility' | 'collection' | 'type'>;
        updateUser?: Omit<Page<DataModel>, 'visibility' | 'collection' | 'type'>;
        verifyEmail?: Omit<Page<DataModel>, 'visibility' | 'collection' | 'type'>;
        resetPassword?: Omit<Page<DataModel>, 'visibility' | 'collection' | 'type'>;
      };
      collections: Partial<Record<keyof DataModel, Partial<Record<string, Omit<Page<DataModel>, 'visibility'>>>>>;
    };
  }

  /**
   * Perseid store, extended with various methods and attributes to handle generic apps states.
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
    public useSubscription: UseSubscription;

    /** List of collection already existing in data model. */
    protected loadedCollections: Set<keyof DataModel>;

    /** List of app pages configurations. */
    protected pages: Partial<Record<string, Omit<Page<DataModel>, 'route'>>>;

    /** Currently signed-in user. */
    protected user: User & { _permissions: Exclude<User['_permissions'], undefined>; } | null;

    /** List of auth and collections pages routes.  */
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
      collections: Partial<Record<keyof DataModel, Partial<Record<string, string>>>>;
    };

    /** Notifies user when unhandled errors happen in the form. */
    protected errorNotifierPlugin: FormPlugin;

    /** Store module that handles app errors. */
    protected errorModule: Module<Error | null>;

    /** Store module that handles generic resources view pages state. */
    protected viewModule: Module<{ loading: boolean; fields: string[]; }>;

    /** Store module that handles generic resources creation or update pages state. */
    protected createModule: Module<FormDefinition | null>;

    /** Store module that handles global resources registry. */
    protected registryModule: Module<Partial<Registry<DataModel>>>;

    /** Store module that handles current page state. */
    protected pageModule: Module<ListPageData<DataModel> | ViewPageData | UpdateOrCreatePageData>;

    /** Store module that handles users authentication. */
    protected authModule: Module<AuthState>;

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
    protected formatOutput<Collection extends keyof DataModel>(
      output: DataModel[Collection],
      model: FieldSchema<DataModel>,
      registry: Partial<Registry<DataModel>>,
    ): DataModel[Collection];

    /**
     * Normalizes `resources` of `collection`, extracting all relations into their registry and
     * replacing them by their id. Also updates global resources registry.
     *
     * @param collection Resources collection.
     *
     * @param resources Resources to normalize.
     *
     * @returns Normalized resources.
     */
    protected normalizeResources<Collection extends keyof DataModel>(
      collection: Collection,
      resources: DataModel[Collection][],
    ): DataModel[Collection][];

    /**
     * Returns `true` if user has permissions to access `field` from `collection` in given context.
     *
     * @param collection Field collection.
     *
     * @param field Field path in collection.
     *
     * @param accessType Access type.
     *
     * @returns `true` if user has necessary permissions, `false` otherwise.
     */
    public canAccessField<Collection extends keyof DataModel>(
      collection: Collection,
      field: string,
      accessType: AccessType,
    ): boolean;

    /**
     * Returns current page data.
     *
     * @param newState Routing, auth and error states.
     *
     * @returns Page data.
     */
    protected getPageData(
      newState: [RoutingContext, AuthState, Error | null],
    ): Promise<unknown>;

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
     * Returns field value at `path`, from resource with id `id` in `collection`.
     *
     * @param collection Resource collection.
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
      collection: keyof DataModel,
      id: Id,
      path: string,
      registry: Partial<Registry<DataModel>>,
      currentPath?: string,
      currentPrefix?: string[],
      currentValue?: unknown,
    ): DataModel[keyof DataModel] | null;

    /**
     * API client `view` method wrapper, that handles common errors and updates global registry.
     *
     * @param collection Resource collection.
     *
     * @param id Resource id.
     *
     * @param options Additional requests options.
     *
     * @returns Requested resource.
     */
    public view<Collection extends keyof DataModel>(
      collection: Collection,
      id: Id | 'me',
      options?: QueryOptions,
    ): Promise<DataModel[Collection] | null>;

    /**
     * API client `delete` method wrapper, that handles common errors and deletes global registry.
     *
     * @param collection Resource collection.
     *
     * @param id Resource id.
     */
    public delete<Collection extends keyof DataModel>(
      collection: Collection,
      id: Id,
    ): Promise<void>;

    /**
     * API client `update` method wrapper, that handles common errors and updates global registry.
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
    public update<Collection extends keyof DataModel>(
      collection: Collection,
      id: Id | 'me',
      payload: unknown,
      options?: QueryOptions,
    ): Promise<DataModel[Collection] | null>;

    /**
     * API client `create` method wrapper, that handles common errors and updates global registry.
     *
     * @param collection Resource collection.
     *
     * @param id Resource id.
     *
     * @param options Additional requests options.
     *
     * @returns Created resource.
     */
    public create<Collection extends keyof DataModel>(
      collection: Collection,
      payload: unknown,
      options?: QueryOptions,
    ): Promise<DataModel[Collection] | null>;

    /**
     * API client `search` method wrapper, that handles common errors and updates global registry.
     *
     * @param collection Resources collection.
     *
     * @param searchBody Search request body.
     *
     * @param options Additional requests options.
     *
     * @returns Requested resources list.
     */
    public search<Collection extends keyof DataModel>(
      collection: Collection,
      searchBody: SearchBody,
      options?: QueryOptions,
    ): Promise<Results<DataModel[Collection]> | null>;

    /**
     * API client `list` method wrapper, that handles common errors and updates global registry.
     *
     * @param collection Resources collection.
     *
     * @param options Additional requests options.
     *
     * @returns Requested resources list.
     */
    public list<Collection extends keyof DataModel>(
      collection: Collection,
      options?: QueryOptions,
    ): Promise<Results<DataModel[Collection]> | null>;

    /**
     * Either lists or searches for resources, depending on `searchBody`.
     *
     * @param collection Resources collection.
     *
     * @param searchBody Search request body. If null, a simple resources list will be performed.
     *
     * @param options Additional requests options.
     */
    public listOrSearch<Collection extends keyof DataModel>(
      collection: Collection,
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
    public createRoute(route: string, configuration: Omit<Page<DataModel>, 'route'>): void;

    /**
     * Downloads data model fragment for `collection` and updates local data model, if necessary.
     *
     * @param collection Collection for which to fetch data model fragment.
     */
    public updateModel<Collection extends keyof DataModel>(
      collection: Collection,
    ): Promise<void>;

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
     * Returns all collections list pages routes.
     *
     * @returns Collections list routes.
     */
    public getCollectionRoutes(): { collection: string; route: string; }[];

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
    public getPage(route: string): Page<DataModel> | null;

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
     * Either navigates back through user history if it exists, or navigates to the fallback route.
     */
    public goBack(): void;
  }
}
