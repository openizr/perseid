/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '@perseid/client/react' {
  import type { Fields } from '@perseid/form';
  import type { UIButtonProps } from '@perseid/ui';
  import type BaseStore from 'scripts/core/services/Store';
  import type BaseModel from 'scripts/core/services/Model';
  import { type FormFieldProps } from '@perseid/form/react';
  import type BaseApiClient from 'scripts/core/services/ApiClient';
  import { I18n as BaseI18n, Id, type DefaultDataModel } from '@perseid/core';
  import type { UseSubscription as ReactUseSubscription } from '@perseid/store/connectors/react';

  /**
   * Common props passed to generic React components.
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
      store: Store & { useSubscription: ReactUseSubscription; };

      /** Perseid model instance. */
      model: Model;

      /** API client instance. */
      apiClient: ApiClient;
    };

    /** Data model resource, if any. */
    resource?: keyof DataModel & string;

    /** List of custom React components to use in pages. */
    components: ReactCustomComponents<DataModel>;
  }

  interface ReactPredefinedCustomComponents {
    Table?: (props: TableProps) => React.ReactNode;
    Layout?: (props: LayoutProps) => React.ReactNode;
    Menu?: (props: ReactCommonProps) => React.ReactNode;
    Modal?: (props: ReactCommonProps) => React.ReactNode;
    Loader?: (props: ReactCommonProps) => React.ReactNode;
    ErrorPage?: (props: ErrorPageProps) => React.ReactNode;
    Notifier?: (props: ReactCommonProps) => React.ReactNode;
    FieldLabel?: (props: FieldLabelProps) => React.ReactNode;
    FieldValue?: (props: FieldValueProps) => React.ReactNode;
    Pagination?: (props: PaginationProps) => React.ReactNode;
    PageLayout?: (props: PageLayoutProps) => React.ReactNode;
    ActionsWrapper?: (props: ActionsWrapperProps) => React.ReactNode;
    PermissionsWrapper?: (props: ReactCommonProps) => React.ReactNode;
    ConfirmationModal?: (props: ConfirmationModalProps) => React.ReactNode;
    FormField?: (props: FormFieldProps & { _canonicalPath?: string; }) => React.ReactNode;
  }

  type ReactGenericCustomComponents<
    DataModel extends DefaultDataModel
  > = Partial<Record<string, (props: ReactCommonProps<DataModel>) => React.ReactNode>>;

  type ReactCustomComponents<
    DataModel extends DefaultDataModel
  > = ReactGenericCustomComponents<DataModel> & ReactPredefinedCustomComponents;

  /**
   * Common props passed to generic React components.
   */
  interface ReactCommonProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends CommonProps<DataModel, I18n, Store, Model, ApiClient> {
    /** List of custom React components to use in pages. */
    components: ReactCustomComponents<DataModel>;
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
  > extends ReactCommonProps<DataModel, I18n, Store, Model, ApiClient> {
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
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/ActionsWrapper.tsx
   */
  export function ActionsWrapper({
    services,
    resource,
    moreButtonProps,
    deleteButtonProps,
    updateButtonProps,
  }: ActionsWrapperProps): JSX.Element;

  /**
   * Confirmation modal props.
   */
  export type ConfirmationModalProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > = GenericConfirmationModalProps & ReactCommonProps<DataModel, I18n, Store, Model, ApiClient>;

  /**
   * Confirmation modal.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/ConfirmationModal.tsx
   */
  export function ConfirmationModal({
    title,
    cancel,
    confirm,
    services,
    subTitle,
    onConfirm,
  }: ConfirmationModalProps): JSX.Element;

  /**
   * Error wrapper props.
   */
  export interface ErrorWrapperProps {
    /** Components to wrap. */
    children?: React.ReactNode;

    /** Components to display when an error occurs. */
    fallback?: React.ReactNode;

    /** Callback to trigger when an error occurs. */
    onError?: (error: Error, errorInfo: { componentStack: string }) => void;
  }

  /**
   * Handles uncaught errors and displays a generic UI.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/ErrorWrapper.tsx
   */
  export class ErrorWrapper extends React.Component<ErrorWrapperProps, {
    hasError: boolean;
  }> {
    constructor(props: ErrorWrapperProps);

    componentDidCatch(error: Error, errorInfo: { componentStack: string }): void;

    static getDerivedStateFromError(): { hasError: boolean };

    render(): JSX.Element;
  }

  /**
   * Field label props.
   */
  export interface FieldLabelProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends ReactCommonProps<DataModel, I18n, Store, Model, ApiClient> {
    /** Field to display. */
    field: string;

    /** Which page is being displayed. */
    page: 'LIST' | 'VIEW';
  }

  /**
   * Displays a specific resource field label.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/FieldLabel.tsx
   */
  export function FieldLabel({
    page,
    field,
    services,
    resource,
  }: FieldLabelProps): JSX.Element;

  /**
   * Field value props.
   */
  export interface FieldValueProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends ReactCommonProps<DataModel, I18n, Store, Model, ApiClient> {
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
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/FieldValue.tsx
   */
  export function FieldValue({
    id,
    page,
    field,
    loading,
    services,
    registry,
    resource,
  }: FieldValueProps): JSX.Element | null;

  /**
   * Generic form field.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/FormField.tsx
   */
  export function FormField(
    fieldProps: FormDefinition['fieldProps'],
    context: { prefix: string; services: ReactCommonProps['services']; },
  ): React.FC<FormFieldProps & { _canonicalPath?: string; }>;

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
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/Grid.tsx
   */
  export function Grid({ columns }: GridProps): JSX.Element;

  /**
   * Layout props.
   */
  export interface LayoutProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends ReactCommonProps<DataModel, I18n, Store, Model, ApiClient> {
    /** Whether to display layout itself, or only its children. Defaults to `true`. */
    display?: boolean;

    /** Layout children. */
    children: React.ReactNode;
  }

  /**
   * Application layout.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/Layout.tsx
   */
  export function Layout({
    display,
    children,
    services,
    components,
  }: LayoutProps): JSX.Element;

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
    store: BaseStore & { useSubscription: ReactUseSubscription; };
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
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/LazyOptions.tsx
   */
  export function LazyOptions<DataModel extends DefaultDataModel = DefaultDataModel>({
    label,
    value,
    helper,
    store,
    labelFn,
    onChange,
    id: htmlId,
    loadResults,
    placeholder,
    resource,
    loadingLabel,
    noResultLabel,
    modifiers,
    disabled,
    autofocus,
    forceSuggestions,
    loadResultsOnFocus,
    resetResultsOnChange,
  }: LazyOptionsProps<DataModel>): JSX.Element;

  /**
   * App loader.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/Loader.tsx
   */
  export function Loader({
    services,
  }: ReactCommonProps): JSX.Element;

  /**
   * App menu.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/Menu.tsx
   */
  export function Menu({
    services,
  }: ReactCommonProps): JSX.Element;

  /**
   * App modal.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/Modal.tsx
   */
  export function Modal({
    services,
    components,
  }: ReactCommonProps): JSX.Element;

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
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/NestedFields.tsx
   */
  export function NestedFields({
    id,
    type,
    path,
    Field,
    label,
    value,
    helper,
    engine,
    fields,
    isActive,
    minItems,
    maxItems,
    modifiers,
    activeStep,
    setActiveStep,
    _canonicalPath,
    addButtonProps,
    useSubscription,
    removeButtonProps,
  }: NestedFieldsProps): JSX.Element;

  /**
   * Displays UI notifications.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/Notifier.tsx
   */
  export function Notifier({
    services,
    components,
  }: ReactCommonProps): JSX.Element | null;

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
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/OptionalField.tsx
   */
  export function OptionalField({
    showLabel,
    hideLabel,
    modifiers,
    ...field
  }: OptionalFieldProps): JSX.Element;

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
    extends ReactCommonProps<DataModel, I18n, Store, Model, ApiClient> {
    /** Name of the resource resource. */
    resource: keyof DataModel & string;

    /** Page to wrap. */
    page: 'UPDATE' | 'CREATE' | 'VIEW' | 'LIST';

    /** Layout children. */
    children: React.ReactNode;
  }

  /**
   * Page layout.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/PageLayout.tsx
   */
  export function PageLayout({
    page,
    children,
    services,
    resource,
    components,
  }: PageLayoutProps): JSX.Element;

  /**
   * Pagination buttons props.
   */
  export interface PaginationProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends ReactCommonProps<DataModel, I18n, Store, Model, ApiClient> {
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
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/Pagination.tsx
   */
  export function Pagination({
    total,
    onClick,
    services,
    currentPage,
    itemsPerPage,
  }: PaginationProps): JSX.Element | null;

  /**
   * Permissions wrapper props.
   */
  export interface PermissionsWrapper<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends ReactCommonProps<DataModel, I18n, Store, Model, ApiClient> {
    /** Permissions that are required to display content. */
    requiredPermissions: string[];

    /** Content to display if user has required permissions. */
    children: React.ReactNode;
  }

  /**
   * Displays its children if user has proper permissions.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/PermissionsWrapper.tsx
   */
  export function PermissionsWrapper({
    children,
    services,
    requiredPermissions,
  }: PermissionsWrapper): JSX.Element;

  /**
   * Router props.
   */
  export interface RouterProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends Pick<ReactCommonProps<DataModel, I18n, Store, Model, ApiClient>, 'services'> {
    /** App DOM container. Automatic dimensionning is enabled only if this prop is specified. */
    container?: HTMLElement;

    /** Custom components declaration. */
    components?: ReactCommonProps<DataModel>['components'];

    /** Custom pages components declaration. */
    pages?: Partial<Record<string, (() => Promise<{
      default: (props: ReactCommonProps<
        DataModel,
        I18n,
        Store,
        Model,
        ApiClient
      >) => React.ReactNode;
    }>)>>;
  }

  /**
   * App router. Handles redirects, not founds, and pages loading.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/Router.tsx
   */
  export function Router<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  >(
    props: RouterProps<DataModel, I18n, Store, Model, ApiClient>,
  ): React.ReactNode;

  /**
   * Table column.
   */
  export interface TableColumn {
    /** Field path for that column. */
    path: string;

    /** Whether field can be sorted. */
    isSortable?: boolean;

    /** Component to display for that column. */
    component: React.ReactNode;
  }

  /**
   * Table row.
   */
  export interface TableRow {
    /** List of columns values for this row. */
    value: Record<string, unknown>;

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
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/Table.tsx
   */
  export function Table({
    labels,
    rows,
    onSort,
    columns,
    sorting,
    modifiers,
  }: TableProps): JSX.Element;

  /**
   * Resource creation / update page props.
   */
  export interface CreateOrUpdateProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends ReactCommonProps<DataModel, I18n, Store, Model, ApiClient> {
    /** Name of the resource resource. */
    resource: keyof DataModel & string;
  }

  /**
   * Resource creation / update page.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/pages/CreateOrUpdate.tsx
   */
  export function CreateOrUpdatePage({
    services,
    resource,
    components,
  }: CreateOrUpdateProps): JSX.Element;

  /**
   * Error page props.
   */
  export interface ErrorPageProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends ReactCommonProps<DataModel, I18n, Store, Model, ApiClient> {
    /** Additional modifiers to apply to the error page. */
    modifiers?: string;

    /** Error to display. */
    error?: Error | Response | null;
  }

  /**
   * Error page.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/pages/Error.tsx
   */
  export function ErrorPage({
    services,
    components,
    error,
    modifiers,
  }: ErrorPageProps): JSX.Element | null;

  /**
   * Resources list page props.
   */
  export interface ListProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends ReactCommonProps<DataModel, I18n, Store, Model, ApiClient> {
    /** Name of the resource resource. */
    resource: keyof DataModel & string;
  }

  /**
   * Resources list page.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/pages/List.tsx
   */
  export function ListPage({
    services,
    resource,
    components,
  }: ListProps): JSX.Element;

  /**
   * Reset password page.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/pages/ResetPassword.tsx
   */
  export function ResetPasswordPage({
    services,
    components,
  }: ReactCommonProps): JSX.Element;

  /**
   * Sign-in page.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/pages/SignIn.tsx
   */
  export function SignInPage({
    services,
    components,
  }: ReactCommonProps): JSX.Element;

  /**
   * Sign-up page.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/pages/SignUp.tsx
   */
  export function SignUpPage({
    services,
    components,
  }: ReactCommonProps): JSX.Element;

  /**
   * Connected user update page.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/pages/UpdateUser.tsx
   */
  export function UpdateUserPage({
    services,
    components,
  }: ReactCommonProps): JSX.Element;

  /**
   * Verify email page.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/pages/VerifyEmail.tsx
   */
  export function VerifyEmailPage({
    services,
    components,
  }: ReactCommonProps): JSX.Element;

  /**
   * Resource view page props.
   */
  export interface ViewProps<
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  > extends ReactCommonProps<DataModel, I18n, Store, Model, ApiClient> {
    /** Name of the resource resource. */
    resource: keyof DataModel & string;
  }

  /**
   * Resource view page.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/pages/View.tsx
   */
  export function ViewPage({
    services,
    resource,
    components,
  }: ViewProps): JSX.Element;
}
