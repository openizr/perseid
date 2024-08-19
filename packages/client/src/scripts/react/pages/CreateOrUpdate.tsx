/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import Form from '@perseid/form/react';
import { buildClass } from '@perseid/ui/react';
import type BaseStore from 'scripts/core/services/Store';
import type BaseModel from 'scripts/core/services/Model';
import FormField from 'scripts/react/components/FormField';
import DefaultLoader from 'scripts/react/components/Loader';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import DefaultPageLayout from 'scripts/react/components/PageLayout';
import { type UpdateOrCreatePageData } from 'scripts/core/services/Store';
import { type DefaultDataModel, toSnakeCase, type I18n as BaseI18n } from '@perseid/core';

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
function CreateOrUpdate({
  services,
  resource,
  components,
}: CreateOrUpdateProps): JSX.Element {
  const Loader = components.Loader ?? DefaultLoader;
  const PageLayout = components.PageLayout ?? DefaultPageLayout;
  const pageData = services.store.useSubscription<UpdateOrCreatePageData>('page');

  // Page is still loading...
  if (pageData === null) {
    return <Loader services={services} components={components} />;
  }

  const mode = (pageData.id !== undefined) ? 'UPDATE' : 'CREATE';
  const prefix = `PAGES.${toSnakeCase(String(resource))}.${mode}`;

  return (
    <main className={buildClass(`${mode.toLowerCase()}-page`, String(resource))}>
      <PageLayout services={services} components={components} resource={resource} page={mode}>
        <Form
          configuration={pageData.configuration}
          Field={FormField(pageData.fieldProps, { prefix, services })}
        />
      </PageLayout>
    </main>
  );
}

export default React.memo(CreateOrUpdate);
