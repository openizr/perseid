/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Model from 'scripts/core/services/Model';
import Store from 'scripts/core/services/Store';
import { type Configuration } from '@perseid/form';
import { DefaultDataModel, I18n } from '@perseid/core';
import { type FormFieldProps } from '@perseid/form/react';
import type ApiClient from 'scripts/core/services/ApiClient';
import { type ErrorPageProps } from 'scripts/react/pages/Error';
import { type TableProps } from 'scripts/react/components/Table';
import { type RouterProps } from 'scripts/react/components/Router';
import { type LayoutProps } from 'scripts/react/components/Layout';
import { type FieldLabelProps } from 'scripts/react/components/FieldLabel';
import { type FieldValueProps } from 'scripts/react/components/FieldValue';
import { type PageLayoutProps } from 'scripts/react/components/PageLayout';
import { type PaginationProps } from 'scripts/react/components/Pagination';
import { type ActionsWrapperProps } from 'scripts/react/components/ActionsWrapper';
import { type ConfirmationModalProps } from 'scripts/react/components/ConfirmationModal';

declare module '*.svg';

declare global {
  type UseSubscription = <T>(id: string, reducer?: ((state: any) => T) | undefined) => T;

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
   * React generic types.
   */

  type ReactActionsWrapperComponent = <DataModel extends DefaultDataModel = DefaultDataModel>(
    props: ActionsWrapperProps<DataModel>,
  ) => JSX.Element;

  type ReactConfirmationModalComponent = <DataModel extends DefaultDataModel = DefaultDataModel>(
    props: ConfirmationModalProps<DataModel>,
  ) => JSX.Element;

  type ReactFieldLabelComponent = <DataModel extends DefaultDataModel = DefaultDataModel>(
    props: FieldLabelProps<DataModel>,
  ) => JSX.Element;

  type ReactFieldValueComponent = <DataModel extends DefaultDataModel = DefaultDataModel>(
    props: FieldValueProps<DataModel>,
  ) => JSX.Element;

  type ReactFormFieldComponent = (
    props: FormFieldProps & { _canonicalPath?: string; },
  ) => JSX.Element;

  type ReactLayoutComponent = <DataModel extends DefaultDataModel = DefaultDataModel>(
    props: LayoutProps<DataModel>,
  ) => JSX.Element;

  type ReactLoaderComponent = <DataModel extends DefaultDataModel = DefaultDataModel>(
    props: ReactCommonProps<DataModel>,
  ) => JSX.Element;

  type ReactModalComponent = <DataModel extends DefaultDataModel = DefaultDataModel>(
    props: ReactCommonProps<DataModel>,
  ) => JSX.Element;

  type ReactMenuComponent = <DataModel extends DefaultDataModel = DefaultDataModel>(
    props: ReactCommonProps<DataModel>,
  ) => JSX.Element;

  type ReactNotifierComponent = <DataModel extends DefaultDataModel = DefaultDataModel>(
    props: ReactCommonProps<DataModel>,
  ) => JSX.Element;

  type ReactPageLayoutComponent = <DataModel extends DefaultDataModel = DefaultDataModel>(
    props: PageLayoutProps<DataModel>,
  ) => JSX.Element;

  type ReactPaginationComponent = <DataModel extends DefaultDataModel = DefaultDataModel>(
    props: PaginationProps<DataModel>,
  ) => JSX.Element;

  type ReactErrorPageComponent = <DataModel extends DefaultDataModel = DefaultDataModel>(
    props: ErrorPageProps<DataModel>,
  ) => JSX.Element;

  type ReactPermissionsWrapperComponent = <DataModel extends DefaultDataModel = DefaultDataModel>(
    props: ReactCommonProps<DataModel>,
  ) => JSX.Element;

  type ReactTableComponent = (
    props: TableProps,
  ) => JSX.Element;

  type ReactRouterComponent = <DataModel extends DefaultDataModel = DefaultDataModel>(
    props: RouterProps<DataModel>,
  ) => JSX.Element;

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
    ActionsWrapper?: ReactActionsWrapperComponent;
    ConfirmationModal?: ReactConfirmationModalComponent;
    PermissionsWrapper?: ReactPermissionsWrapperComponent;
  }

  type ReactGenericCustomComponents<
    DataModel extends DefaultDataModel
  > = Record<string, ((props: ReactCommonProps<DataModel>) => JSX.Element | null) | undefined>;

  type ReactCustomComponents<
    DataModel extends DefaultDataModel
  > = ReactGenericCustomComponents<DataModel> & ReactPredefinedCustomComponents;

  /**
   * Common props passed to generic React components.
   */
  interface ReactCommonProps<DataModel extends DefaultDataModel> extends CommonProps<DataModel> {
    /** List of custom React components to use in pages. */
    components: ReactCustomComponents<DataModel>;
  }
}
