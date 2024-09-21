/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '@perseid/client/vue' {
  import type { DefineComponent } from 'vue';
  import type { Fields } from '@perseid/form';
  import type { UIButtonProps } from '@perseid/ui';
  import type BaseStore from 'scripts/core/services/Store';
  import type BaseModel from 'scripts/core/services/Model';
  import { type FormFieldProps } from '@perseid/form/vue';
  import type BaseApiClient from 'scripts/core/services/ApiClient';
  import { I18n as BaseI18n, Id, type DefaultDataModel } from '@perseid/core';
  import type { UseSubscription as VueUseSubscription } from '@perseid/store/connectors/vue';

  /**
   * Common props passed to generic Vue components.
   */
  interface CommonProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > {
    /** Perseid client services instances. */
    services: {
      /** I18n instance. */
      i18n: I18n;

      /** Perseid store instance. */
      store: Store & { useSubscription: VueUseSubscription; };

      /** Perseid model instance. */
      model: Model;

      /** API client instance. */
      apiClient: ApiClient;
    };

    /** Data model resource, if any. */
    resource?: keyof DataModel & string;

    /** List of custom Vue components to use in pages. */
    components: Partial<Record<string, DefineComponent>> & VuePredefinedCustomComponents;
  }

  interface VuePredefinedCustomComponents {
    Table?: DefineComponent<TableProps>;
    Layout?: DefineComponent<LayoutProps>;
    Menu?: DefineComponent<VueCommonProps>;
    Modal?: DefineComponent<VueCommonProps>;
    Loader?: DefineComponent<VueCommonProps>;
    ErrorPage?: DefineComponent<ErrorPageProps>;
    Notifier?: DefineComponent<VueCommonProps>;
    FieldLabel?: DefineComponent<FieldLabelProps>;
    FieldValue?: DefineComponent<FieldValueProps>;
    Pagination?: DefineComponent<PaginationProps>;
    PageLayout?: DefineComponent<PageLayoutProps>;
    ActionsWrapper?: DefineComponent<ActionsWrapperProps>;
    PermissionsWrapper?: DefineComponent<VueCommonProps>;
    ConfirmationModal?: DefineComponent<ConfirmationModalProps>;
    FormField?: DefineComponent<FormFieldProps>;
  }

  /**
   * Common props passed to generic Vue components.
   */
  interface VueCommonProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends CommonProps<DataModel, I18n, Store, Model, ApiClient> {
    /** List of custom Vue components to use in pages. */
    components: Partial<Record<string, DefineComponent>> & VuePredefinedCustomComponents;
  }

  /**
   * Actions wrapper props.
   */
  export interface ActionsWrapperProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends VueCommonProps<DataModel, I18n, Store, Model, ApiClient> {
    /** Name of the resource resource. */
    resource: keyof DataModel & string;

    /** "More" button props. */
    moreButtonProps?: ComponentProps;

    /** "Delete" button props. */
    deleteButtonProps?: ComponentProps;

    /** "Edit" button props. */
    updateButtonProps?: ComponentProps;
  }

  /**
   * Actions wrapper.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/ActionsWrapper.vue
   */
  export const ActionsWrapper: DefineComponent<ActionsWrapperProps>;

  /**
   * Confirmation modal props.
   */
  export type ConfirmationModalProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > = GenericConfirmationModalProps & VueCommonProps<DataModel, I18n, Store, Model, ApiClient>;

  /**
   * Confirmation modal.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/ConfirmationModal.vue
   */
  export const ConfirmationModal: DefineComponent<ConfirmationModalProps>;

  /**
   * Error wrapper props.
   */
  export interface ErrorWrapperProps {
    /** Callback to trigger when an error occurs. */
    onError?: (error: Error, errorInfo: { componentStack: string }) => void;
  }

  /**
   * Handles uncaught errors and displays a generic UI.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/ErrorWrapper.vue
   */
  export const ErrorWrapper: DefineComponent<ErrorWrapperProps>;

  /**
   * Field label props.
   */
  export interface FieldLabelProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends VueCommonProps<DataModel, I18n, Store, Model, ApiClient> {
    /** Field to display. */
    field: string;

    /** Which page is being displayed. */
    page: 'LIST' | 'VIEW';
  }

  /**
   * Displays a specific resource field label.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/FieldLabel.vue
   */
  export const FieldLabel: DefineComponent<FieldLabelProps>;

  /**
   * Field value props.
   */
  export interface FieldValueProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends VueCommonProps<DataModel, I18n, Store, Model, ApiClient> {
    /** Id of the resource to display. */
    id: Id;

    /** Field to display. */
    field: string;

    /** Which page is being displayed. */
    page: 'LIST' | 'VIEW';

    /** Whether resource is still being fetched, which means some values might not be there yet. */
    loading: boolean;

    /** Resources registry. */
    registry: Registry<DataModel>;

    /** Data model resource, if any. */
    resource: keyof DataModel & string;
  }

  /**
   * Displays a specific resource field value.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/FieldValue.vue
   */
  export const FieldValue: DefineComponent<FieldValueProps>;

  /**
   * Generic form field.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/FormField.vue
   */
  export const FormField: DefineComponent<FormFieldProps>;

  /**
   * Grid props.
   */
  export interface GridProps {
    /** Number of columns to display for each resolution. */
    columns: { mobile: number; tablet: number; desktop: number; };
  }

  /**
   * Responsive grid, used for design integration.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/Grid.vue
   */
  export const Grid: DefineComponent<GridProps>;

  /**
   * Layout props.
   */
  export interface LayoutProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends VueCommonProps<DataModel, I18n, Store, Model, ApiClient> {
    /** Whether to display layout itself, or only its children. Defaults to `true`. */
    display?: boolean;
  }

  /**
   * Application layout.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/Layout.vue
   */
  export const Layout: DefineComponent<LayoutProps>;

  interface Value {
    value: string;
    label: string;
  }

  /**
   * Lazy options props.
   */
  export interface LazyOptionsProps<DataModel> {
    /** `id` HTML attribute to set to the element. */
    id?: string;

    /** Perseid store instance. */
    store: BaseStore & { useSubscription: VueUseSubscription; };
    labelFn: (resource: Record<string, unknown> | null) => string;
    resource: keyof DataModel & string;

    /** Results loading label. */
    loadingLabel: string;

    /** No result label. */
    noResultLabel: string;

    /**
     * Initial value (pre-selected option).
     * Updating this prop with a new value will replace the current value by the one passed.
     */
    value?: string;

    /** Element's label. Supports light markdown. */
    label: string;

    /** Element's helper. Supports light markdown. */
    helper?: string;

    /**
     * When element is disabled, a special `disabled` modifier is automatically added, and all its
     * user interactions are disabled. Defaults to `false`.
     */
    disabled?: boolean;

    /** List of modifiers to apply to the element. Defaults to `""`. */
    modifiers?: string;

    /** `autofocus` HTML attribute to set to the element. Defaults to `false`. */
    autofocus?: boolean;

    /** Element's placeholder. */
    placeholder?: string;

    /**
     * When `forceSuggestions` is set to `true`, we don't want to rely on any pre-filled value,
     * and enforce the autocompletion to be sure we get a valid value. Defaults to `false`.
     */
    forceSuggestions?: boolean;

    /** Whether to load and display results when user focuses this field. Defaults to `true`. */
    loadResultsOnFocus?: boolean;

    /** Whether to reset results whenever user changes field value. Defaults to `true`. */
    resetResultsOnChange?: boolean;

    /**
     * `change` event handler.
     *
     * @param value New field value.
     */
    onChange?: (newValue: Value | null) => void;

    /**
     * Callback triggered whenever results need to be loaded.
     *
     * @param value User input, used to search results.
     *
     * @returns Results list.
     */
    loadResults: (value: string | null) => Promise<{ type: 'option'; label: string; value: string; }[]>;
  }

  /**
   * List of options fetched dynamically using a search bar.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/LazyOptions.vue
   */
  export const LazyOptions: DefineComponent<LazyOptionsProps<DefaultDataModel>>;

  /**
   * App loader.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/Loader.vue
   */
  export const Loader: DefineComponent<VueCommonProps>;

  /**
   * App menu.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/Menu.vue
   */
  export const Menu: DefineComponent<VueCommonProps>;

  /**
   * App modal.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/Modal.vue
   */
  export const Modal: DefineComponent<VueCommonProps>;

  /**
   * Nested fields props.
   */
  export interface NestedFieldsProps extends FormFieldProps {
    _canonicalPath?: string;

    /** `id` HTML attribute to set to the element. */
    id?: string;

    /** Initial field value. */
    value: unknown[];

    /** Element's label. Supports light markdown. */
    label?: string;

    /** Element's helper. Supports light markdown. */
    helper?: string;

    /** List of modifiers to apply to the element. Defaults to `""`. */
    modifiers?: string;

    /** Minimum items allowed for this field. Defaults to `0`. */
    minItems?: number;

    /** Maximum items allowed for this field. Defaults to `Infinity`. */
    maxItems?: number;

    /** Add item button props. */
    addButtonProps?: UIButtonProps;

    /** Remove item button props. */
    removeButtonProps?: UIButtonProps;

    /** Field sub-fields list. */
    fields: Fields;

    /** Field component to use for rendering. */
    Field: (props: FormFieldProps & { _canonicalPath?: string; }) => JSX.Element;
  }

  /**
   * Nested fields (array / object) form component.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/NestedFields.vue
   */
  export const NestedFields: DefineComponent<NestedFieldsProps>;

  /**
   * Displays UI notifications.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/Notifier.vue
   */
  export const Notifier: DefineComponent<VueCommonProps>;

  /**
   * Optional form field props.
   */
  export interface OptionalFieldProps extends FormFieldProps {
    /** Label to display for showing optional field. */
    showLabel: string;

    /** Label to display for hide optional field. */
    hideLabel: string;

    /** Additional modifiers to apply to the optional field. */
    modifiers?: string;
  }

  /**
   * Optional form field.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/OptionalField.vue
   */
  export const OptionalField: DefineComponent<OptionalFieldProps>;

  /**
   * Page layout props.
   */
  export interface PageLayoutProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  >
    extends VueCommonProps<DataModel, I18n, Store, Model, ApiClient> {
    /** Name of the resource resource. */
    resource: keyof DataModel & string;

    /** Page to wrap. */
    page: 'UPDATE' | 'CREATE' | 'VIEW' | 'LIST';
  }

  /**
   * Page layout.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/PageLayout.vue
   */
  export const PageLayout: DefineComponent<PageLayoutProps>;

  /**
   * Pagination buttons props.
   */
  export interface PaginationProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends VueCommonProps<DataModel, I18n, Store, Model, ApiClient> {
    /** Total number of displayed items. */
    total: number;

    /** Current page. */
    currentPage: number;

    /** Number of items per page. */
    itemsPerPage: number;

    /** Callback triggered when clicking on pagination buttons. */
    onClick: (page: number) => () => void;
  }

  /**
   * Pagination buttons.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/Pagination.vue
   */
  export const Pagination: DefineComponent<PaginationProps>;

  /**
   * Permissions wrapper props.
   */
  export interface PermissionsWrapper<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends VueCommonProps<DataModel, I18n, Store, Model, ApiClient> {
    /** Permissions that are required to display content. */
    requiredPermissions: string[];
  }

  /**
   * Displays its children if user has proper permissions.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/PermissionsWrapper.vue
   */
  export const PermissionsWrapper: DefineComponent<PermissionsWrapper>;

  /**
   * Router props.
   */
  export interface RouterProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends Pick<VueCommonProps<DataModel, I18n, Store, Model, ApiClient>, 'services'> {
    /** App DOM container. Automatic dimensionning is enabled only if this prop is specified. */
    container?: HTMLElement;

    /** Custom components declaration. */
    components?: VueCommonProps<DataModel>['components'];

    /** Custom pages components declaration. */
    pages?: Partial<Record<string, (() => Promise<{
      default: DefineComponent<VueCommonProps<DataModel, I18n, Store, Model, ApiClient>>
    }>)>>;
  }

  /**
   * App router. Handles redirects, not founds, and pages loading.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/Router.vue
   */
  export const Router: DefineComponent<RouterProps>;

  /**
   * Table column.
   */
  export interface TableColumn {
    /** Field path for that column. */
    path: string;

    /** Whether field can be sorted. */
    isSortable?: boolean;

    /** Component to display for that column. */
    component: DefineComponent;

    componentProps: Record<string, unknown>;
  }

  /**
   * Table row.
   */
  export interface TableRow {
    /** List of columns values for this row. */
    value: Record<string, {
      component: DefineComponent;

      componentProps: Record<string, unknown>;
    }>;

    /** Callback triggered when clicking on this row. */
    onClick?: () => void;
  }

  /**
   * Generic table props.
   */
  export interface TableProps {
    /** Sorting options */
    sorting?: Sorting;

    /** List of modifiers to apply to the element. Defaults to `""`. */
    modifiers?: string;

    /** Callback triggered when changing table sorting. */
    onSort?: (newSorting: Sorting) => void;

    /** List of table rows. Defaults to `null`. */
    rows?: TableRow[] | null;

    /** List of table columns. */
    columns: TableColumn[];

    /** Table labels. */
    labels: {
      loading?: string;
      noResult?: string;
      fallback?: string;
    };
  }

  /**
   * Generic table.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/components/Table.vue
   */
  export const Table: DefineComponent<TableProps>;

  /**
   * Resource creation / update page props.
   */
  export interface CreateOrUpdateProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends VueCommonProps<DataModel, I18n, Store, Model, ApiClient> {
    /** Name of the resource resource. */
    resource: keyof DataModel & string;
  }

  /**
   * Resource creation / update page.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/pages/CreateOrUpdate.vue
   */
  export const CreateOrUpdate: DefineComponent<CreateOrUpdateProps>;

  /**
   * Error page props.
   */
  export interface ErrorPageProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends VueCommonProps<DataModel, I18n, Store, Model, ApiClient> {
    /** Additional modifiers to apply to the error page. */
    modifiers?: string;

    /** Error to display. */
    error?: Error | Response | null;
  }

  /**
   * Error page.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/pages/Error.vue
   */
  export const ErrorPage: DefineComponent<ErrorPageProps>;

  /**
   * Resources list page props.
   */
  export interface ListProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends VueCommonProps<DataModel, I18n, Store, Model, ApiClient> {
    /** Name of the resource resource. */
    resource: keyof DataModel & string;
  }

  /**
   * Resources list page.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/pages/List.vue
   */
  export const List: DefineComponent<ListProps>;

  /**
   * Reset password page.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/pages/ResetPassword.vue
   */
  export const ResetPassword: DefineComponent<VueCommonProps>;

  /**
   * Sign-in page.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/pages/SignIn.vue
   */
  export const SignIn: DefineComponent<VueCommonProps>;

  /**
   * Sign-up page.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/pages/SignUp.vue
   */
  export const SignUp: DefineComponent<VueCommonProps>;

  /**
   * Connected user update page.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/pages/UpdateUser.vue
   */
  export const UpdateUser: DefineComponent<VueCommonProps>;

  /**
   * Verify email page.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/pages/VerifyEmail.vue
   */
  export const VerifyEmail: DefineComponent<VueCommonProps>;

  /**
   * Resource view page props.
   */
  export interface ViewProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends VueCommonProps<DataModel, I18n, Store, Model, ApiClient> {
    /** Name of the resource resource. */
    resource: keyof DataModel & string;
  }

  /**
   * Resource view page.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/vue/pages/View.vue
   */
  export const View: DefineComponent<ViewProps>;
}
