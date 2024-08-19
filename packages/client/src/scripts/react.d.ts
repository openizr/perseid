/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '@perseid/client/react' {
  import {
    type Store,
    type CommonProps,
  } from '@perseid/client';
  import {
    type Id,
    type DefaultDataModel,
  } from '@perseid/core';
  import { type UIButtonProps } from '@perseid/ui/react';
  import { type FormFieldProps, type Fields } from '@perseid/form/react';

  interface Value {
    value: string;
    label: string;
  }

  interface ReactPredefinedCustomComponents {
    Menu?: ReactMenuComponent;
    Table?: ReactTableComponent;
    Loader?: ReactLoaderComponent;
    Layout?: ReactLayoutComponent;
    Notifier?: ReactNotifierComponent;
    ErrorPage?: ReactErrorPageComponent;
    FormField?: ReactFormFieldComponent;
    PageLayout?: ReactPageLayoutComponent;
    Pagination?: ReactPaginationComponent;
    FieldLabel?: ReactFieldLabelComponent;
    FieldValue?: ReactFieldValueComponent;
    ActionsWrapper?: typeof ActionsWrapper;
    ConfirmationModal?: typeof ConfirmationModal;
    PermissionsWrapper?: ReactPermissionsWrapperComponent;
  }

  type ReactGenericCustomComponents<
    DataModel extends DefaultDataModel
  > = Record<string, ((props: ReactCommonProps<DataModel>) => JSX.Element | null) | undefined>;

  type ReactCustomComponents<
    DataModel extends DefaultDataModel
  > = ReactGenericCustomComponents<DataModel> & ReactPredefinedCustomComponents;

  /**
   * Generic component props.
   */
  type ComponentProps = Record<string, unknown>;

  /**
   * Common props passed to generic React components.
   */
  interface ReactCommonProps<DataModel extends DefaultDataModel> extends CommonProps<DataModel> {
    /** List of custom React components to use in pages. */
    components: ReactCustomComponents<DataModel>;
  }

  /**
   * Actions wrapper props.
   */
  export interface ActionsWrapperProps<
    DataModel extends DefaultDataModel
  > extends ReactCommonProps<DataModel> {
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
   * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/ActionsWrapper.tsx
   */
  export function ActionsWrapper<DataModel extends DefaultDataModel = DefaultDataModel>({
    services,
    resource,
    moreButtonProps,
    deleteButtonProps,
    updateButtonProps,
  }: ActionsWrapperProps<DataModel>): JSX.Element;

  /**
   * Confirmation modal props.
   */
  export type ConfirmationModalProps<
    DataModel extends DefaultDataModel
  > = GenericConfirmationModalProps & ReactCommonProps<DataModel>;

  /**
   * Confirmation modal.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/ConfirmationModal.tsx
   */
  export function ConfirmationModal<DataModel extends DefaultDataModel = DefaultDataModel>({
    title,
    cancel,
    confirm,
    services,
    subTitle,
    onConfirm: onConfirmProp,
  }: ConfirmationModalProps<DataModel>): JSX.Element;

  /**
   * Field label props.
   */
  export interface FieldLabelProps<
    DataModel extends DefaultDataModel
  > extends ReactCommonProps<DataModel> {
    /** Field to display. */
    field: string;

    /** Which page is being displayed. */
    page: 'LIST' | 'VIEW';
  }

  /**
   * Displays a specific resource field label.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/FieldLabel.tsx
   */
  export function FieldLabel<DataModel extends DefaultDataModel = DefaultDataModel>({
    page,
    field,
    services,
    resource,
  }: FieldLabelProps<DataModel>): JSX.Element;

  /**
   * Field value props.
   */
  export interface FieldValueProps<
    DataModel extends DefaultDataModel
  > extends ReactCommonProps<DataModel> {
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
   * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/FieldValue.tsx
   */
  export function FieldValue<DataModel extends DefaultDataModel = DefaultDataModel>({
    id,
    page,
    field,
    loading,
    services,
    registry,
    resource,
  }: FieldValueProps<DataModel>): JSX.Element | null;

  /**
   * Generic form field.
   */
  export function FormField<DataModel extends DefaultDataModel = DefaultDataModel>(
    fieldProps: FormDefinition['fieldProps'],
    context: { prefix: string; services: ReactCommonProps<DataModel>['services']; },
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
   * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/Grid.tsx
   */
  export function Grid({ columns }: GridProps): JSX.Element;

  /**
   * Layout props.
   */
  export interface LayoutProps<
    DataModel extends DefaultDataModel
  > extends ReactCommonProps<DataModel> {
    /** Whether to display layout itself, or only its children. Defaults to `true`. */
    display?: boolean;

    /** Layout children. */
    children: React.ReactNode;
  }

  /**
   * Application layout.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/Layout.tsx
   */
  export function Layout<DataModel extends DefaultDataModel = DefaultDataModel>({
    children,
    services,
    components,
    display,
  }: LayoutProps<DataModel>): JSX.Element;

  /**
   * Lazy options props.
   */
  export interface LazyOptionsProps<DataModel> {
    /** `id` HTML attribute to set to the element. */
    id?: string;

    /** Perseid store instance. */
    store: Store & { useSubscription: UseSubscription; };
    labelFn: (resource: Resource | null) => string;
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
   * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/LazyOptions.tsx
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
   * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/Loader.tsx
   */
  export function Loader<DataModel extends DefaultDataModel = DefaultDataModel>({
    services,
  }: ReactCommonProps<DataModel>): JSX.Element;

  /**
   * App menu.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/Menu.tsx
   */
  export function Menu<DataModel extends DefaultDataModel = DefaultDataModel>({
    services,
  }: ReactCommonProps<DataModel>): JSX.Element;

  /**
   * App modal.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/Modal.tsx
   */
  export function Modal<DataModel extends DefaultDataModel = DefaultDataModel>({
    services,
    components,
  }: ReactCommonProps<DataModel>): JSX.Element;

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
   * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/NestedFields.tsx
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
    active,
    modifiers,
    minItems,
    _canonicalPath,
    addButtonProps,
    useSubscription,
    removeButtonProps,
    maxItems,
  }: NestedFieldsProps): JSX.Element;

  /**
   * Displays UI notifications.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/Notifier.tsx
   */
  export function Notifier<DataModel extends DefaultDataModel = DefaultDataModel>({
    services,
    components,
  }: ReactCommonProps<DataModel>): JSX.Element | null;

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
   * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/OptionalField.tsx
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
  export interface PageLayoutProps<DataModel extends DefaultDataModel>
    extends ReactCommonProps<DataModel> {
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
  * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/PageLayout.tsx
  */
  export function PageLayout<DataModel extends DefaultDataModel = DefaultDataModel>({
    page,
    children,
    services,
    resource,
    components,
  }: PageLayoutProps<DataModel>): JSX.Element;

  /**
   * Pagination buttons props.
   */
  export interface PaginationProps<
    DataModel extends DefaultDataModel
  > extends ReactCommonProps<DataModel> {
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
   * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/Pagination.tsx
   */
  export function Pagination<DataModel extends DefaultDataModel = DefaultDataModel>({
    total,
    onClick,
    services,
    currentPage,
    itemsPerPage,
  }: PaginationProps<DataModel>): JSX.Element | null;

  /**
   * Permissions wrapper props.
   */
  export interface PermissionsWrapper<
    DataModel extends DefaultDataModel
  > extends ReactCommonProps<DataModel> {
    /** Permissions that are required to display content. */
    requiredPermissions: string[];

    /** Content to display if user has required permissions. */
    children: React.ReactNode;
  }

  /**
   * Displays its children if user has proper permissions.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/PermissionsWrapper.tsx
   */
  export function PermissionsWrapper<DataModel extends DefaultDataModel = DefaultDataModel>({
    children,
    services,
    requiredPermissions,
  }: PermissionsWrapper<DataModel>): JSX.Element;

  /**
   * Router props.
   */
  export interface RouterProps<
    DataModel extends DefaultDataModel
  > extends Pick<ReactCommonProps<DataModel>, 'services'> {
    /** App DOM container. Automatic resizing will be enabled only if this prop is specified. */
    container?: HTMLElement;

    /** Custom components declaration. */
    components?: ReactCommonProps<DataModel>['components'];

    /** Custom pages components declaration. */
    pages?: Partial<Record<string, (() => Promise<{
      default: (props: ReactCommonProps<DataModel>) => React.ReactNode;
    }>)>>;
  }

  /**
   * App router. Handles redirects, not founds, and pages loading.
   *
   * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/Router.tsx
   */
  export function Router<DataModel extends DefaultDataModel = DefaultDataModel>({
    pages,
    services,
    container,
    components,
  }: RouterProps<DataModel> & {
    components: ReactCommonProps<DataModel>['components'];
    pages: Exclude<RouterProps<DataModel>['pages'], undefined>;
  }): JSX.Element;

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
   * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/Table.tsx
   */
  export function Table({
    labels,
    columns,
    rows,
    modifiers,
    onSort,
    sorting,
  }: TableProps): JSX.Element;
}
