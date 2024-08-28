/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Id,
  deepCopy,
  deepMerge,
  toSnakeCase,
  type Logger,
  type Results,
  type IdSchema,
  isPlainObject,
  type FieldSchema,
  type ArraySchema,
  type ObjectSchema,
  type DefaultDataModel,
  type ResourceSchema,
  type DataModelMetadata,
} from '@perseid/core';
import { generateRandomId } from '@perseid/ui';
import Model from 'scripts/core/services/Model';
import ApiClient from 'scripts/core/services/ApiClient';
import BaseStore, { type Module } from '@perseid/store';
import FormBuilder from 'scripts/core/services/FormBuilder';
import { type UserInputs, type FormPlugin } from '@perseid/form';
import router, { type RoutingContext } from '@perseid/store/extensions/router';

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

  /** Page related resource, if applicable. */
  resource?: keyof DataModel & string;

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
      signUp?: Omit<Page<DataModel>, 'visibility' | 'resource' | 'type'>;
      signIn?: Omit<Page<DataModel>, 'visibility' | 'resource' | 'type'>;
      updateUser?: Omit<Page<DataModel>, 'visibility' | 'resource' | 'type'>;
      verifyEmail?: Omit<Page<DataModel>, 'visibility' | 'resource' | 'type'>;
      resetPassword?: Omit<Page<DataModel>, 'visibility' | 'resource' | 'type'>;
    };
    resources: Partial<Record<keyof DataModel & string, Partial<Record<string, Omit<Page<DataModel>, 'visibility' | 'resource' | 'type'>>>>>;
  };
}

const findNotification = (state: NotifierState, notificationId: string): number => (
  state.findIndex((notification) => notification.id === notificationId)
);

const RESULTS_PER_PAGE = 20;
const DEFAULT_NOTIFICATION_DURATION = 5000;

/**
 * Perseid store, extended with various methods and attributes to handle generic apps states.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/core/services/Store.ts
 */
export default class Store<
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
  protected currentRoute: string | null = null;

  /** `useSubscription` method to use in components. */
  public useSubscription: UseSubscription = undefined as unknown as UseSubscription;

  /** List of resource already existing in data model. */
  protected loadedResources = new Set<keyof DataModel & string>();

  /** List of app pages configurations. */
  protected pages: Partial<Record<string, Omit<Page<DataModel>, 'route'>>> = {};

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
  protected errorNotifierPlugin: FormPlugin = (engine): void => {
    engine.on('error', (error, next) => {
      this.logger.error(error);
      this.notify('NOTIFICATIONS.ERRORS.UNKNOWN');
      return next(error);
    });
  };

  /** Store module that handles app errors. */
  protected errorModule: Module<Error | null> = {
    state: null,
    mutations: {
      SET(_, error: Error | null) {
        return error;
      },
      RESET() {
        return null;
      },
    },
  };

  /** Store module that handles global resources registry. */
  protected registryModule: Module<Partial<Registry<DataModel>>> = {
    state: {},
    mutations: {
      DELETE({ state }) {
        return { ...state };
      },
      REMOVE({ state }, data: { id: string; resource: keyof DataModel & string; }) {
        const resources = Object.keys(state) as (keyof DataModel & string)[];
        return resources.reduce<Partial<Registry<DataModel>>>((newState, resource) => {
          const resourceRegistry = newState[resource] as unknown as Resources<DataModel>;
          const resourceIds = Object.keys(resourceRegistry);
          return ({
            ...newState,
            [resource]: (data.resource !== resource)
              ? resourceRegistry
              : resourceIds.reduce<Resources<DataModel>>((registry, resourceId) => (
                (data.id === resourceId)
                  ? registry
                  : { ...registry, [resourceId]: resourceRegistry[resourceId] }
              ), {}),
          });
        }, state);
      },
      REFRESH({ state }, data: Registry<DataModel>) {
        const newState = { ...state };
        (Object.keys(data) as (keyof DataModel & string)[]).forEach((resource) => {
          const newResourceRegistry = data[resource];
          const resourceRegistry = { ...state[resource] } as Resources<DataModel>;
          Object.keys(newResourceRegistry).forEach((id) => {
            const entity = newResourceRegistry[id];
            resourceRegistry[id] = deepMerge(resourceRegistry[id] as unknown ?? {}, entity);
          });
          newState[resource] = resourceRegistry;
        });
        return newState;
      },
    },
  };

  /** Store module that handles current page state. */
  protected pageModule: Module<ListPageData<DataModel> | ViewPageData | UpdateOrCreatePageData> = {
    state: null,
    mutations: {
      UPDATE({ state }, data: ListPageData<DataModel> | ViewPageData | UpdateOrCreatePageData) {
        if (data === null) {
          return null;
        }
        return { ...state, ...data };
      },
    },
  };

  /** Store module that handles users authentication. */
  protected authModule: Module<AuthState<DataModel>> = {
    state: {
      user: null,
      status: 'INITIAL',
    },
    mutations: {
      UPDATE_STATUS({ state }, status: AuthState['status']) {
        return { ...state, status };
      },
      SIGN_IN({ state }, user: DataModel['users']) {
        return deepMerge(state, { status: 'SUCCESS', user });
      },
      SIGN_OUT({ state }) {
        return deepMerge(state, { status: 'ERROR', user: null });
      },
    },
    actions: {
      signIn: async ({ id, dispatch }, data: { email: string; password: string; }) => {
        await this.apiClient.signIn(data.email, data.password);
        await dispatch(id, 'getUser');
      },
      signOut: async ({ id, mutate }) => {
        await this.catchErrors(this.apiClient.signOut().then(() => {
          mutate(id, 'SIGN_OUT');
          this.redirectToSignInPage(this.fallbackPageRoute);
        }), false);
      },
      signUp: async ({ id, dispatch }, data: Record<string, string>) => {
        await this.apiClient.signUp(data.email, data.password, data.passwordConfirmation);
        await dispatch(id, 'getUser');
      },
      resetPassword: async (_, data: Record<string, string>) => {
        const { resetToken, password, passwordConfirmation } = data;
        await this.apiClient.resetPassword(resetToken, password, passwordConfirmation);
      },
      verifyEmail: async (_, verificationToken: string) => {
        await this.apiClient.verifyEmail(verificationToken);
      },
      requestEmailVerification: async () => {
        await this.catchErrors(this.apiClient.requestEmailVerification(), false);
      },
      requestPasswordReset: async (_, email: string) => {
        await this.catchErrors(this.apiClient.requestPasswordReset(email), false);
      },
      updateUser: async ({ mutate }, data) => {
        const options = { fields: ['email', '_verifiedAt', 'roles.*'] };
        await this.apiClient.update('users', (this.user as unknown as DataModel['users'])._id, data, options).then((user) => {
          mutate('registry', 'REFRESH', { users: { [String(user._id)]: user } });
          this.user = {
            ...user,
            _permissions: new Set(
              (user.roles as DataModel['roles'][]).reduce<string[]>((permissions, role) => (
                permissions.concat(role.permissions)
              ), []),
            ),
          };
        });
      },
      getUser: async ({ id, mutate }, redirect = true) => {
        mutate(id, 'UPDATE_STATUS', 'PENDING');
        await this.catchErrors((async (): Promise<void> => {
          await this.apiClient.viewMe().then((user) => {
            mutate('registry', 'REFRESH', { users: { [String(user._id)]: user } });
            this.user = {
              ...user,
              _permissions: new Set((user.roles as DataModel['roles'][]).reduce<string[]>((permissions, role) => (
                permissions.concat(role.permissions)
              ), [])),
            };
            mutate(id, 'SIGN_IN', this.user);
          });
        })(), redirect as boolean);
      },
    },
  };

  /** Store module that handles UI notifications. */
  protected notifierModule: Module<NotifierState> = {
    state: [],
    mutations: {
      PUSH: ({ state, id }, notification: NotificationData) => {
        const notificationId = generateRandomId();
        const duration = notification.duration ?? DEFAULT_NOTIFICATION_DURATION;
        const finalNotification: NotifierState[0] = {
          ...notification,
          id: notificationId,
          timer: {
            duration,
            startedAt: Date.now(),
            id: setTimeout(() => {
              this.mutate(id, 'REMOVE', notificationId);
            }, duration) as unknown as number,
          },
          modifiers: notification.modifiers ?? '',
          closable: notification.closable !== false,
        };
        return state.concat([finalNotification]);
      },
      PAUSE({ state }, notificationId: string) {
        const notificationIndex = findNotification(state, notificationId);
        if (notificationIndex >= 0) {
          const notification = state[notificationIndex];
          clearTimeout(notification.timer.id);
          return state.slice(0, notificationIndex).concat([deepMerge(notification, {
            timer: {
              duration: notification.timer.duration - (Date.now() - notification.timer.startedAt),
            },
          })]).concat(state.slice(notificationIndex + 1));
        }
        return deepCopy(state);
      },
      RESUME: ({ id, state }, notificationId: string) => {
        const notificationIndex = findNotification(state, notificationId);
        if (notificationIndex >= 0) {
          const notification = state[notificationIndex];
          return state.slice(0, notificationIndex).concat([deepMerge(notification, {
            timer: {
              startedAt: Date.now(),
              id: setTimeout(() => {
                this.mutate(id, 'REMOVE', notificationId);
              }, notification.timer.duration),
            },
          })]).concat(state.slice(notificationIndex + 1));
        }
        return deepCopy(state);
      },
      REMOVE({ state }, notificationId: string) {
        const notificationIndex = findNotification(state, notificationId);
        if (notificationIndex >= 0) {
          const notification = state[notificationIndex];
          clearTimeout(notification.timer.id);
          return state.slice(0, notificationIndex).concat(state.slice(notificationIndex + 1));
        }
        return deepCopy(state);
      },
    },
  };

  /** Store module that handles app modal. */
  protected modalModule: Module<ModalState> = {
    state: {
      show: false,
      component: '',
      modifiers: '',
      componentProps: {},
    },
    mutations: {
      SHOW(_, data: Partial<ModalState>) {
        return {
          show: true,
          modifiers: data.modifiers ?? '',
          component: data.component ?? '',
          componentProps: data.componentProps ?? {},
        };
      },
      HIDE({ state }) {
        return {
          ...state,
          show: false,
        };
      },
    },
  };

  /**
   * Parses querystring `sortBy` and `sortOrder` into a proper structure.
   *
   * @param querySortBy `sortBy` query param.
   *
   * @param querySortOrder `sortOrder` query param.
   *
   * @returns Structured sorting.
   */
  protected computeSorting(querySortBy?: string, querySortOrder?: string): Sorting {
    const newSorting: Sorting = {};
    const sortBy = querySortBy?.split(',') ?? [];
    const sortOrder = querySortOrder?.split(',') ?? [];
    sortBy.forEach((path, index) => {
      if (path !== '') {
        newSorting[path] = sortOrder[index] === '-1' ? -1 : 1;
      }
    });
    return newSorting;
  }

  /**
   * Redirects user to sign-in page if it exists.
   *
   * @param path Redirect page after signing in.
   */
  protected redirectToSignInPage(path: string): void {
    if (this.pageRoutes.auth.signIn !== undefined
      && this.currentRoute !== this.pageRoutes.auth.signIn
      && this.currentRoute !== this.pageRoutes.auth.signUp
      && this.currentRoute !== this.pageRoutes.auth.resetPassword
    ) {
      this.navigate(`${this.pageRoutes.auth.signIn}?redirect=${encodeURIComponent(path)}`)();
    }
  }

  /**
   * Catches and handles most common errors thrown by `callback`.
   *
   * @param callback Callback to wrap.
   *
   * @param redirect Whether user should be redirected to 403 or 404 pages if necessary.
   *
   * @returns Wrapped callback.
   */
  protected async catchErrors<T>(promise: Promise<T>, redirect: boolean): Promise<T | null> {
    try {
      return await promise;
    } catch (error) {
      const { status } = error as Response;
      const body = (error as Response).body as unknown as { error: { code: string; }; } | null;
      if (status === 401) {
        this.mutate('auth', 'SIGN_OUT');
        if (redirect) {
          this.redirectToSignInPage(`${window.location.pathname}${window.location.search}`);
        }
      } else if (status === 403 && body?.error.code === 'USER_NOT_VERIFIED') {
        if (this.pageRoutes.auth.verifyEmail === undefined) {
          this.mutate('error', 'SET', { status: 403 });
        } else if (this.currentRoute !== this.pageRoutes.auth.verifyEmail) {
          this.navigate(this.pageRoutes.auth.verifyEmail)();
        }
      } else if (redirect && (status === 403 || status === 404)) {
        this.mutate('error', 'SET', error);
      } else if (body?.error.code === 'RESOURCE_EXISTS') {
        this.notify('NOTIFICATIONS.ERRORS.RESOURCE_EXISTS');
      } else if (body?.error.code === 'RESOURCE_REFERENCED') {
        this.notify('NOTIFICATIONS.ERRORS.RESOURCE_REFERENCED');
      } else if (status === 403) {
        this.notify('NOTIFICATIONS.ERRORS.FORBIDDEN');
      } else if (status === 404) {
        this.notify('NOTIFICATIONS.ERRORS.NOT_FOUND');
      } else {
        throw error;
      }
      return null;
    }
  }

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
  ): DataModel[Resource] {
    const { type } = model;
    const { fields } = model as ArraySchema<DataModel>;
    const relation = (model as IdSchema<DataModel>).relation as (
      keyof DataModel & string | undefined
    );

    if (output as unknown === null) {
      return output;
    }

    // Arrays...
    if (type === 'array') {
      const formattedOutput = [];
      const outputArray = output as unknown as DataModel[Resource][];
      for (let index = 0, { length } = outputArray; index < length; index += 1) {
        formattedOutput.push(this.formatOutput(outputArray[index], fields, registry));
      }
      return formattedOutput as unknown as DataModel[Resource];
    }

    // Objects...
    if (type === 'object') {
      const formattedOutput: Record<string, unknown> = {};
      const keys = Object.keys(output as Resource);
      for (let index = 0, { length } = keys; index < length; index += 1) {
        const key = keys[index];
        const subOutput = (output as Record<string, unknown>)[key] as DataModel[Resource];
        formattedOutput[key] = this.formatOutput(subOutput, model.fields[key], registry);
      }
      return formattedOutput as DataModel[Resource];
    }

    // Expanded relation...
    if (type === 'id' && relation !== undefined) {
      const updatedRegistry = registry;
      const resources: Partial<Resources<DataModel>> = registry[relation] ?? {};
      if (isPlainObject(output)) {
        const resourceId = String((output as Record<string, unknown>)._id);
        const { schema } = this.model.get(relation) as DataModelMetadata<ObjectSchema<DataModel>>;
        const resourceModel: ObjectSchema<DataModel> = { type: 'object', fields: schema.fields };
        const formattedOutput = this.formatOutput(output, resourceModel, registry);
        resources[resourceId] = deepMerge(resources[resourceId] ?? {}, formattedOutput);
        updatedRegistry[relation] = resources as Resources<DataModel>;
        return (output as Record<string, unknown>)._id as DataModel[Resource];
      }
      resources[String(output)] ??= { _id: output } as DataModel[Resource];
      updatedRegistry[relation] = resources as Resources<DataModel>;
    }

    return output;
  }

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
  ): DataModel[Resource][] {
    const registry = { [resource]: {} } as Partial<Registry<DataModel>>;
    const model = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;
    const normalizedResources = resources.map((entity) => {
      // Do not move the following before `formatOutput`, or it will break registry recursive
      // and nested updates. TODO put in unit tests intead of a comment
      // DO NOT PUT formatOutput ON THE SAME LINE AS DEEPMERGE : cases like fetching
      // user.roles._createdBy._updatedBy =>   reg[col][`${resource._id}`] does not exist yet before
      // calling formatOutput, and thus _updatedBy data is overriten by { _id, roles } at the end.
      const resourceId = String((entity as Record<string, unknown>)._id);
      const subRegistry = registry[resource] as Record<string, Record<string, unknown> | undefined>;
      const resourceModel: ObjectSchema<DataModel> = { type: 'object', fields: model.schema.fields };
      const normalizedResource = this.formatOutput(entity, resourceModel, registry);
      subRegistry[resourceId] = deepMerge(subRegistry[resourceId] ?? {}, normalizedResource);
      return normalizedResource;
    });
    this.mutate('registry', 'REFRESH', registry);
    return normalizedResources;
  }

  /**
   * Returns current page data.
   *
   * @param newState Routing, auth and error states.
   *
   * @returns Page data.
   */
  protected async getPageData(
    newState: [RoutingContext, AuthState],
  ): Promise<unknown> {
    const [routerState, authState] = newState;
    this.currentRoute = String(routerState.route);
    const currentPage = this.pages[this.currentRoute];
    const idParam = routerState.params.id as string | undefined;
    const redirect = routerState.query.redirect as string | undefined;
    const id = (idParam === undefined || !/^[0-9A-Za-z]{24}$/.test(idParam)) ? null : new Id(idParam);

    // Page does not exist...
    if (currentPage === undefined) {
      return null;
    }

    // We always try to authenticate user first.
    if (authState.status === 'INITIAL') {
      await this.dispatch('auth', 'getUser', currentPage.visibility === 'PRIVATE');
      return null;
    }

    // Waiting for user info...
    if (authState.status === 'PENDING') {
      return null;
    }

    // User needs to sign-in (private page)...
    if (currentPage.visibility === 'PRIVATE' && authState.status === 'ERROR') {
      this.redirectToSignInPage(routerState.path);
      return null;
    }

    // User needs to sign-out (public-only page)...
    if (currentPage.visibility === 'PUBLIC_ONLY' && authState.status === 'SUCCESS') {
      this.navigate(decodeURIComponent(redirect ?? this.fallbackPageRoute))();
      return null;
    }

    const filteredFields: string[] = [];
    const { type } = currentPage;
    const resource = currentPage.resource as unknown as keyof DataModel & string;
    const { searchFields } = currentPage.pageProps as Partial<Record<string, string[]>>;
    const fields = (currentPage.pageProps as Partial<Record<string, string[]>>).fields ?? [];

    // Unknown resource...
    if (type !== undefined && (resource as unknown) === undefined) {
      this.mutate('error', 'SET', { status: 404 });
      return null;
    }

    // Invalid resource id...
    if ((type === 'UPDATE' || type === 'VIEW') && id === null) {
      this.mutate('error', 'SET', { status: 404 });
      return null;
    }

    // Checking user permissions to access resources...
    if (type === 'LIST' || type === 'VIEW') {
      await this.apiClient.getDataModel(resource);
      fields.forEach((field) => {
        if (this.canAccessField(resource, field, type)) {
          filteredFields.push(field);
        }
      });
      if (filteredFields.length === 0) {
        this.mutate('error', 'SET', { status: 403 });
        return null;
      }
    }

    // Resource view page...
    if (type === 'VIEW') {
      this.mutate('page', 'UPDATE', { id, fields: filteredFields, loading: true });
      await this.view(resource, id as unknown as Id, { fields: filteredFields });
      return { id: id as unknown as Id, fields: filteredFields, loading: false };
    }

    // Resources list page...
    if (type === 'LIST') {
      const queryPage = parseInt(routerState.query.page, 10);
      const { query, sortBy, sortOrder } = routerState.query;
      const sorting = this.computeSorting(sortBy, sortOrder);
      const page = !Number.isNaN(queryPage) ? queryPage : 1;
      const offset = Math.max(0, (page - 1) * RESULTS_PER_PAGE);
      const filteredSearchFields = searchFields?.filter((field) => (
        this.canAccessField(resource, field, 'SEARCH')
      )) ?? [];
      const searchBody = (query as unknown === undefined)
        ? null
        : { filters: null, query: { on: filteredSearchFields, text: query } };
      this.mutate('page', 'UPDATE', {
        page,
        limit: RESULTS_PER_PAGE,
        sorting,
        total: 0,
        resource,
        results: null,
        loading: true,
        search: searchBody,
        fields: filteredFields,
        searchFields: filteredSearchFields,
      });
      const response = (searchBody === null) ? await this.list(resource, {
        offset,
        fields: filteredFields,
        limit: RESULTS_PER_PAGE,
        sortBy: Object.keys(sorting),
        sortOrder: Object.values(sorting),
      }) : await this.search(resource, searchBody, {
        offset,
        fields: filteredFields,
        limit: RESULTS_PER_PAGE,
        sortBy: Object.keys(sorting),
        sortOrder: Object.values(sorting),
      });
      if (response !== null) {
        return {
          page,
          sorting,
          resource,
          loading: false,
          search: searchBody,
          fields: filteredFields,
          limit: RESULTS_PER_PAGE,
          searchFields: filteredSearchFields,
          total: response.total,
          results: response.results.map((result) => (result as Record<string, unknown>)._id),
        };
      }
    }

    // Resource creation / update page...
    if (type === 'CREATE' || type === 'UPDATE') {
      await this.apiClient.getDataModel(resource);
      const { configuration, fieldProps, requestedFields } = this.formBuilder.buildConfiguration(
        resource,
        id,
        new Set(fields.filter((field) => this.canAccessField(resource, field, 'VIEW'))),
        this,
      );
      configuration.plugins ??= [];
      configuration.plugins.push(this.errorNotifierPlugin);
      configuration.plugins.push((engine) => {
        engine.on('submit', async (data, next) => {
          if (data !== null) {
            const response = (id !== null)
              ? await this.update(resource, id, data, { fields: [...fields] })
              : await this.create(resource, data);
            if (response !== null) {
              const [updatedResource] = this.normalizeResources(resource, [response]);
              engine.setInitialValues(updatedResource as UserInputs);
              Object.keys(updatedResource as UserInputs).forEach((key) => {
                const newFieldValue = (updatedResource as UserInputs)[key];
                if (newFieldValue !== data[key] && !key.startsWith('_')) {
                  engine.userAction({ type: 'input', path: `root.0.${key}`, data: newFieldValue });
                }
              });
              if (id !== null) {
                this.notify('NOTIFICATIONS.UPDATED_RESOURCE');
              } else {
                const resourceListRoute = this.getRoute(`${String(resource)}.list`);
                this.navigate(resourceListRoute ?? this.getFallbackPageRoute())();
                this.notify('NOTIFICATIONS.CREATED_RESOURCE');
              }
            }
          }
          return next(data);
        });
      });
      if (requestedFields.size === 0) {
        this.mutate('error', 'SET', { status: 403 });
        return null;
      }
      if (id === null) {
        return { loading: false, configuration, fieldProps };
      }
      fields.filter((field) => this.canAccessField(resource, field, 'VIEW')).forEach((field) => (
        requestedFields.add(field)
      ));
      const options = { fields: [...requestedFields] };
      const response = await this.view(resource, id, options);
      if (response !== null) {
        const [updatedResource] = this.normalizeResources(resource, [response]);
        configuration.initialValues = updatedResource as UserInputs;
        return {
          id,
          fieldProps,
          configuration,
          loading: false,
        };
      }
    }

    // User update page...
    if (routerState.route === this.pageRoutes.auth.updateUser && authState.user !== null) {
      const formConfiguration = this.formBuilder.getUpdateUserConfiguration(
        authState.user,
        async (data) => {
          await this.dispatch('auth', 'updateUser', data).then(() => {
            this.notify('NOTIFICATIONS.UPDATED_USER');
          }).catch((error: unknown) => {
            const { body } = (error as { body?: { error: { code: string; }; }; });
            if (body?.error.code === 'RESOURCE_EXISTS') {
              this.notify('NOTIFICATIONS.ERRORS.USER_EXISTS');
            } else {
              throw error;
            }
          });
        },
        async () => {
          if (this.pageRoutes.auth.resetPassword !== undefined) {
            await this.dispatch('auth', 'signOut');
            this.navigate(this.pageRoutes.auth.resetPassword)();
          }
        },
      );
      formConfiguration.configuration.plugins ??= [];
      formConfiguration.configuration.plugins.push(this.errorNotifierPlugin);
      return formConfiguration;
    }

    // Password reset page...
    if (routerState.route === this.pageRoutes.auth.resetPassword) {
      const resetToken = /^[0-9a-fA-F]{24}$/.test(routerState.query.resetToken)
        ? routerState.query.resetToken
        : null;
      const formConfiguration = this.formBuilder.getResetPasswordConfiguration(
        resetToken,
        async (data) => {
          await this.dispatch('auth', 'resetPassword', { ...data, resetToken })
            .then(() => {
              if (this.pageRoutes.auth.signIn !== undefined) {
                this.notify('NOTIFICATIONS.RESET_PASSWORD');
                this.navigate(this.pageRoutes.auth.signIn)();
              }
            }).catch((error: unknown) => {
              const { body } = (error as { body?: { error: { code: string; }; }; });
              if (body?.error.code === 'INVALID_RESET_TOKEN') {
                this.notify('NOTIFICATIONS.ERRORS.INVALID_RESET_TOKEN');
              } else {
                throw error;
              }
            });
        },
        async (data) => {
          await this.dispatch('auth', 'requestPasswordReset', (data as { email: string; }).email);
        },
      );
      formConfiguration.configuration.plugins ??= [];
      formConfiguration.configuration.plugins.push(this.errorNotifierPlugin);
      return formConfiguration;
    }

    // Sign-in page...
    if (routerState.route === this.pageRoutes.auth.signIn) {
      const formConfiguration = this.formBuilder.getSignInConfiguration(
        async (data) => {
          await this.dispatch('auth', 'signIn', data).catch(() => {
            this.notify('NOTIFICATIONS.ERRORS.INVALID_CREDENTIALS');
          });
        },
      );
      formConfiguration.configuration.plugins ??= [];
      formConfiguration.configuration.plugins.push(this.errorNotifierPlugin);
      return formConfiguration;
    }

    // Sign-up page...
    if (routerState.route === this.pageRoutes.auth.signUp) {
      const formConfiguration = this.formBuilder.getSignUpConfiguration(
        async (data) => {
          await this.dispatch('auth', 'signUp', data).catch((error: unknown) => {
            const { body } = (error as { body?: { error: { code: string; }; }; });
            if (body?.error.code === 'RESOURCE_EXISTS') {
              this.notify('NOTIFICATIONS.ERRORS.DUPLICATE_USER');
            } else {
              throw error;
            }
          });
        },
      );
      formConfiguration.configuration.plugins ??= [];
      formConfiguration.configuration.plugins.push(this.errorNotifierPlugin);
      return formConfiguration;
    }

    // Any other page...
    return {};
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
      sortBy,
      sortOrder,
      query: text,
    } = options;
    if (page !== undefined && page > 1) {
      query.push(`page=${String(page)}`);
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
  ) {
    super();
    this.user = null;
    this.model = model;
    this.logger = logger;
    this.apiClient = apiClient;
    this.formBuilder = formBuilder;
    const { auth, resources } = settings.pages;
    this.pageRoutes = { auth: {}, resources: {} };
    this.fallbackPageRoute = settings.fallbackPageRoute;
    const capitalize = (text: string): string => text[0].toUpperCase() + text.slice(1);

    (Object.keys(auth) as (keyof StoreSettings<DataModel>['pages']['auth'])[]).forEach((type) => {
      const authRoute = auth[type] as unknown as Page<DataModel>;
      this.pageRoutes.auth[type] = authRoute.route;
      this.createRoute(authRoute.route, {
        pageProps: authRoute.pageProps,
        layoutProps: authRoute.layoutProps,
        component: authRoute.component ?? capitalize(type),
        visibility: (type === 'verifyEmail' || type === 'updateUser') ? 'PRIVATE' : 'PUBLIC_ONLY',
      });
    });
    (Object.keys(resources) as (keyof DataModel & string)[]).forEach((resource) => {
      // Sorting is important to register routes in the correct order (create, then everything else)
      // Otherwise `create` is treated as an id of update/:id route.
      const resourceRoutes = resources[resource] as Record<string, Page<DataModel>>;
      Object.keys(resourceRoutes).sort().forEach((type) => {
        this.pageRoutes.resources[resource] ??= {};
        const resourcePages = this.pageRoutes.resources[resource] as Record<string, string>;
        resourcePages[type] = resourceRoutes[type].route;
        this.createRoute(resourceRoutes[type].route, {
          resource,
          visibility: 'PRIVATE',
          type: type.toUpperCase() as 'UPDATE',
          pageProps: resourceRoutes[type].pageProps,
          layoutProps: resourceRoutes[type].layoutProps,
          component: resourceRoutes[type].component ?? capitalize(type),
        });
      });
    });

    this.goBack = this.goBack.bind(this);
    this.catchErrors = this.catchErrors.bind(this);
    this.getPageData = this.getPageData.bind(this);
    this.register('page', this.pageModule);
    this.register('auth', this.authModule);
    this.register('modal', this.modalModule);
    this.register('error', this.errorModule);
    this.register('notifier', this.notifierModule);
    this.register('registry', this.registryModule);

    window.addEventListener('error', (error): void => {
      this.mutate('error', 'SET', error);
    });
    window.addEventListener('unhandledrejection', (error): void => {
      this.mutate('error', 'SET', error);
    });
  }

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
  ): boolean {
    const fieldMetadata = this.model.get(`${String(resource)}.${field}`);

    if (fieldMetadata === null) {
      throw new Error(`Requested field "${String(resource)}.${field}" does not exist.`);
    }

    const { canonicalPath } = fieldMetadata;

    // TODO put log debug/info to detail what permission is missing
    if (this.user === null) {
      return false;
    }

    if (!this.user._permissions.has(`VIEW_${toSnakeCase(canonicalPath[0])}`)) {
      return false;
    }

    if (!this.user._permissions.has(`${accessType}_${toSnakeCase(String(resource))}`)) {
      return false;
    }

    if (resource === 'users' && !this.user._permissions.has('VIEW_USERS_AUTH_DETAILS') && (
      canonicalPath[1] === '_devices'
      || canonicalPath[1] === '_apiKeys'
      || canonicalPath[1] === '_verifiedAt'
    )) {
      return false;
    }

    if (resource === 'users' && canonicalPath[1] === 'password' && accessType !== 'CREATE') {
      return false;
    }

    if (
      resource === 'users'
      && canonicalPath[1] === 'roles'
      && !this.user._permissions.has('VIEW_USERS_ROLES')
    ) {
      return false;
    }

    return true;
  }

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
    currentPath = '_',
    currentPrefix: string[] = [],
    currentValue: unknown = undefined,
  ): DataModel[keyof DataModel & string] | null {
    if (currentPath === '_') {
      const fullPrefix = [String(resource)];
      const subValue = registry[resource]?.[String(id)];
      return this.getValue(resource, id, path, registry, path, fullPrefix, subValue);
    }
    if (currentPath === '') {
      return currentValue as DataModel[keyof DataModel & string] | undefined ?? null;
    }
    const splittedPath = currentPath.split('.');
    const subPath = String(splittedPath.shift());
    if (isPlainObject(currentValue)) {
      const fullPath = splittedPath.join('.');
      const fullPrefix = currentPrefix.concat([subPath]);
      const subValue = (currentValue as Record<string, unknown>)[subPath];
      return this.getValue(resource, id, path, registry, fullPath, fullPrefix, subValue);
    }
    if (Array.isArray(currentValue)) {
      const fullPath = [subPath].concat(splittedPath).join('.');
      return currentValue.map((item) => (
        this.getValue(resource, id, path, registry, fullPath, [...currentPrefix], item)
      )) as DataModel[keyof DataModel & string];
    }
    if (currentValue instanceof Id) {
      const model = this.model.get(currentPrefix.join('.')) as DataModelMetadata<IdSchema<DataModel>>;
      const fullPrefix = [String(model.schema.relation)];
      const fullPath = [subPath].concat(splittedPath).join('.');
      const subValue = registry[model.schema.relation]?.[String(currentValue)];
      return this.getValue(resource, id, path, registry, fullPath, fullPrefix, subValue);
    }
    return currentValue as DataModel[keyof DataModel & string] | undefined ?? null;
  }

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
  public async view<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
    options?: QueryOptions,
  ): Promise<DataModel[Resource] | null> {
    return this.catchErrors(this.apiClient.view(resource, id, options).then((response) => {
      this.normalizeResources(resource, [response]);
      return response;
    }), true);
  }

  /**
   * API client `delete` method wrapper, that handles common errors and deletes global registry.
   *
   * @param resource Type of resource for which to call the API.
   *
   * @param id Resource id.
   */
  public async delete<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
  ): Promise<void> {
    await this.catchErrors(this.apiClient.delete(resource, id).then(() => {
      this.mutate('registry', 'REMOVE', { resource, id });
    }), true);
  }

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
  public async update<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id,
    payload: unknown,
    options?: QueryOptions,
  ): Promise<DataModel[Resource] | null> {
    return this.catchErrors(this.apiClient.update(resource, id, payload, options).then((res) => {
      this.normalizeResources(resource, [res]);
      return res;
    }), true);
  }

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
  public async create<Resource extends keyof DataModel & string>(
    resource: Resource,
    payload: unknown,
    options?: QueryOptions,
  ): Promise<DataModel[Resource] | null> {
    return this.catchErrors(this.apiClient.create(resource, payload, options).then((response) => {
      this.normalizeResources(resource, [response]);
      return response;
    }), true);
  }

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
  public async search<Resource extends keyof DataModel & string>(
    resource: Resource,
    searchBody: SearchBody,
    options?: QueryOptions,
  ): Promise<Results<DataModel[Resource]> | null> {
    return this.catchErrors(this.apiClient.search(resource, searchBody, options).then((res) => {
      this.normalizeResources(resource, res.results);
      return res;
    }), true);
  }

  /**
   * API client `list` method wrapper, that handles common errors and updates global registry.
   *
   * @param resource Type of resource for which to call the API.
   *
   * @param options Additional requests options.
   *
   * @returns Requested resources list.
   */
  public async list<Resource extends keyof DataModel & string>(
    resource: Resource,
    options?: QueryOptions,
  ): Promise<Results<DataModel[Resource]> | null> {
    return this.catchErrors(this.apiClient.list(resource, options).then((response) => {
      this.normalizeResources(resource, response.results);
      return response;
    }), true);
  }

  /**
   * Either lists or searches for resources, depending on `searchBody`.
   *
   * @param resource Type of resource for which to call the API.
   *
   * @param searchBody Search request body. If null, a simple resources list will be performed.
   *
   * @param options Additional requests options.
   */
  public async listOrSearch<Resource extends keyof DataModel & string>(
    resource: Resource,
    searchBody: SearchBody | null,
    options?: QueryOptions & { sorting?: Sorting; },
  ): Promise<void> {
    // Why using `replaceState` instead of `navigate`? Because we don't want to keep a history
    // of each user keystroke in the search field. Plus, we don't want to trigger a new
    // rendering in this specific case.
    window.history.replaceState({}, '', `${window.location.pathname}${this.buildQuery({
      page: options?.page,
      query: searchBody?.query?.text,
      sortBy: Object.keys(options?.sorting ?? {}),
      sortOrder: Object.values(options?.sorting ?? {}),
    })}`);
    const response = (searchBody === null) ? await this.list(resource, {
      limit: RESULTS_PER_PAGE,
      offset: options?.offset,
      fields: options?.fields,
      sortBy: Object.keys(options?.sorting ?? {}),
      sortOrder: Object.values(options?.sorting ?? {}),
    }) : await this.search(resource, searchBody, {
      limit: RESULTS_PER_PAGE,
      offset: options?.offset,
      fields: options?.fields,
      sortBy: Object.keys(options?.sorting ?? {}),
      sortOrder: Object.values(options?.sorting ?? {}),
    });
    if (response !== null) {
      this.mutate('page', 'UPDATE', {
        ...options,
        search: searchBody,
        total: response.total,
        results: response.results.map((result) => (result as DataModel['users'])._id),
      });
    }
  }

  /**
   * Navigates user to the given page.
   *
   * @param data Page data.
   */
  public async goToPage(data: Exclude<ListPageData<DataModel>, null>): Promise<void> {
    window.history.pushState({}, '', `${window.location.pathname}${this.buildQuery({
      page: data.page,
      query: data.search?.query?.text,
      sortBy: Object.keys(data.sorting),
      sortOrder: Object.values(data.sorting),
    })}`);
    const offset = Math.max(0, (data.page - 1) * RESULTS_PER_PAGE);
    await this.listOrSearch(data.resource, data.search, { ...data, offset });
  }

  /**
   * Initializes app router.
   */
  public createRoutes(): void {
    this.register('router', router(Object.keys(this.pages)));

    // We don't want to display error page forever, especially if user navigates through history.
    this.subscribe('router', () => {
      this.mutate('error', 'RESET');
    });

    this.combine('appRoute', ['router', 'auth'], (
      routerState: RoutingContext,
      authState: AuthState,
    ) => [routerState, authState]);

    this.subscribe('appRoute', async (newState: [RoutingContext, AuthState]) => {
      this.mutate('page', 'UPDATE', null);
      const newPageData = await this.getPageData(newState);
      this.mutate('page', 'UPDATE', newPageData);
    });
  }

  /**
   * Creates a new app page at `route` with `configuration`.
   *
   * @param route Path to the app page.
   *
   * @param configuration Route configuration.
   */
  public createRoute(route: string, configuration: Omit<Page<DataModel>, 'route'>): void {
    this.pages[route] = {
      component: configuration.component,
      visibility: configuration.visibility,
      resource: configuration.resource,
      pageProps: configuration.pageProps ?? {},
      layoutProps: configuration.layoutProps ?? {},
      type: (configuration.resource !== undefined) ? configuration.type : undefined,
    };
  }

  /**
  * Navigates to `url`, without reloading the page.
  * Caveat: the `router` store module must be registered.
  *
  * @param url Target URL.
  *
  * @returns The actual navigation function.
  */
  public navigate(url: string): (event?: MouseEvent) => void {
    return (event) => {
      if (event !== undefined) {
        event.preventDefault();
      }
      if (event?.ctrlKey) {
        window.open(url, '_blank');
      } else {
        this.mutate('error', 'RESET');
        this.mutate('router', 'NAVIGATE', url);
      }
    };
  }

  /**
   * Returns page route for `type`.
   *
   * @param type Route type (e.g. `auth.signIn`, `users.list`).
   *
   * @returns Page route.
   */
  public getRoute(type: string): string | null {
    const splittedType = type.split('.');
    const resource = String(splittedType.shift()) as keyof DataModel & string;
    if (resource === 'auth') {
      return this.pageRoutes.auth[String(splittedType.shift()) as 'signIn'] ?? null;
    }
    return this.pageRoutes.resources[resource]?.[String(splittedType.shift()) as 'list'] ?? null;
  }

  /**
   * Returns all resources list pages routes.
   *
   * @returns Resources list routes.
   */
  public getResourceRoutes(): { resource: string; route: string; }[] {
    const resources = Object.keys(this.pageRoutes.resources) as (keyof DataModel & string)[];
    return resources.reduce<{ resource: string; route: string; }[]>((routes, resource) => {
      const resourcePages = this.pageRoutes.resources[resource] as Record<string, string>;
      return (resourcePages.list as unknown !== undefined)
        ? routes.concat([{ resource: String(resource), route: resourcePages.list }])
        : routes;
    }, []);
  }

  /**
   * Returns all registered pages routes.
   *
   * @returns App pages routes.
   */
  public getAllRoutes(): string[] {
    return Object.keys(this.pages);
  }

  /**
   * Returns page configuration for `route`.
   *
   * @param route Route for which to get page configuration.
   *
   * @returns Page configuration if route exists, `null` otherwise.
   */
  public getPage(route: string): Page<DataModel> | null {
    return (this.pages[route] as unknown as Page<DataModel> | undefined) ?? null;
  }

  /**
   * Returns app fallback page route.
   *
   * @returns Fallback page route.
   */
  public getFallbackPageRoute(): string {
    return this.fallbackPageRoute;
  }

  /**
   * Creates a new UI notification with `message`.
   *
   * @param message Notification message.
   */
  public notify(message: string): void {
    this.mutate('notifier', 'PUSH', { message });
  }

  /**
   * Displays a confirmation modal with `props`.
   *
   * @param props Confirmation modal props.
   */
  public confirm<ConfirmationModalProps extends GenericConfirmationModalProps>(
    props: ConfirmationModalProps,
  ): void {
    this.mutate('modal', 'SHOW', {
      component: 'ConfirmationModal',
      componentProps: props,
    });
  }

  /**
   * Navigates back through user history.
   */
  public goBack(): void {
    window.history.back();
  }
}
