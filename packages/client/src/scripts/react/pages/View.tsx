/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { buildClass } from 'biuty/react';
import DefaultLoader from 'scripts/react/components/Loader';
import { type DefaultDataModel } from '@perseid/core';
import { type ViewPageData } from 'scripts/core/services/Store';
import DefaultPageLayout from 'scripts/react/components/PageLayout';
import DefaultFieldValue from 'scripts/react/components/FieldValue';
import DefaultFieldLabel from 'scripts/react/components/FieldLabel';

/**
 * Resource view page props.
 */
export interface ViewProps<
  DataModel extends DefaultDataModel
> extends ReactCommonProps<DataModel> {
  /** Name of the resource collection. */
  collection: keyof DataModel;
}

/**
 * Resource view page.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/pages/View.tsx
 */
function View<DataModel extends DefaultDataModel = DefaultDataModel>({
  services,
  collection,
  components,
}: ViewProps<DataModel>): JSX.Element {
  const Loader = components.Loader ?? DefaultLoader;
  const PageLayout = components.PageLayout ?? DefaultPageLayout;
  const FieldValue = components.FieldValue ?? DefaultFieldValue;
  const FieldLabel = components.FieldLabel ?? DefaultFieldLabel;

  const pageData = services.store.useSubscription<ViewPageData>('page');
  const registry = services.store.useSubscription<Registry<DataModel>>('registry');

  // Page is still loading...
  if (pageData === null) {
    return <Loader services={services} components={components} />;
  }

  return (
    <main className={buildClass('view-page', String(collection))}>
      <PageLayout services={services} components={components} collection={collection} page="VIEW">
        <div className="view-page__fields">
          {pageData.fields.map((field) => (
            <div className="view-page__fields__field" key={field}>
              <FieldLabel
                page="VIEW"
                field={field}
                services={services}
                collection={collection}
                components={components}
              />
              <FieldValue
                page="VIEW"
                field={field}
                id={pageData.id}
                registry={registry}
                services={services}
                collection={collection}
                components={components}
                loading={pageData.loading}
              />
            </div>
          ))}
        </div>
      </PageLayout>
    </main>
  );
}

export default React.memo(View);
