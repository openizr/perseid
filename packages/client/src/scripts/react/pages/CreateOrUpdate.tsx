/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import Form from '@perseid/form/react';
import { buildClass } from 'biuty/react';
import FormField from 'scripts/react/components/FormField';
import DefaultLoader from 'scripts/react/components/Loader';
import { type DefaultDataModel, toSnakeCase } from '@perseid/core';
import DefaultPageLayout from 'scripts/react/components/PageLayout';
import { type UpdateOrCreatePageData } from 'scripts/core/services/Store';

/**
 * Resource creation / update page props.
 */
export interface CreateOrUpdateProps<
  DataModel extends DefaultDataModel
> extends ReactCommonProps<DataModel> {
  /** Name of the resource collection. */
  collection: keyof DataModel;
}

/**
 * Resource creation / update page.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/pages/CreateOrUpdate.tsx
 */
function CreateOrUpdate<DataModel extends DefaultDataModel = DefaultDataModel>({
  services,
  collection,
  components,
}: CreateOrUpdateProps<DataModel>): JSX.Element {
  const Loader = components.Loader ?? DefaultLoader;
  const PageLayout = components.PageLayout ?? DefaultPageLayout;
  const pageData = services.store.useSubscription<UpdateOrCreatePageData>('page');

  // Page is still loading...
  if (pageData === null) {
    return <Loader services={services} components={components} />;
  }

  const mode = (pageData.id !== undefined) ? 'UPDATE' : 'CREATE';
  const prefix = `PAGES.${toSnakeCase(String(collection))}.${mode}`;

  return (
    <main className={buildClass(`${mode.toLowerCase()}-page`, String(collection))}>
      <PageLayout services={services} components={components} collection={collection} page={mode}>
        <Form
          configuration={pageData.configuration}
          Field={FormField(pageData.fieldProps, { prefix, services })}
        />
      </PageLayout>
    </main>
  );
}

export default React.memo(CreateOrUpdate);
