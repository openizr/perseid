/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { type Configuration } from '@perseid/form';
import BaseStore from 'scripts/core/services/Store';
import BaseModel from 'scripts/core/services/Model';
import { type FormFieldProps } from '@perseid/form/react';
import { type ErrorPageProps } from 'scripts/react/pages/Error';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import { type TableProps } from 'scripts/react/components/Table';
import { type RouterProps } from 'scripts/react/components/Router';
import { DefaultDataModel, I18n as BaseI18n } from '@perseid/core';
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
   * Common props passed to generic components.
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
      store: Store;

      /** Perseid model instance. */
      model: Model;

      /** API client instance. */
      apiClient: ApiClient;
    };

    /** Data model resource, if any. */
    resource?: keyof DataModel & string;
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
  }

  /**
   * React generic types.
   */

  type ReactRouterComponent = <
    DataModel extends DefaultDataModel = DefaultDataModel,
    I18n extends BaseI18n = BaseI18n,
    Store extends BaseStore<DataModel> = BaseStore<DataModel>,
    Model extends BaseModel<DataModel> = BaseModel<DataModel>,
    ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
  >(
    props: RouterProps<DataModel, I18n, Store, Model, ApiClient>,
  ) => React.ReactNode;

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
}
