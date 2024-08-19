/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { buildClass } from '@perseid/ui/react';
import type BaseStore from 'scripts/core/services/Store';
import type BaseModel from 'scripts/core/services/Model';
import DefaultLoader from 'scripts/react/components/Loader';
import { type ViewPageData } from 'scripts/core/services/Store';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import DefaultPageLayout from 'scripts/react/components/PageLayout';
import DefaultFieldValue from 'scripts/react/components/FieldValue';
import DefaultFieldLabel from 'scripts/react/components/FieldLabel';
import { type DefaultDataModel, type I18n as BaseI18n } from '@perseid/core';

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
function View({
  services,
  resource,
  components,
}: ViewProps): JSX.Element {
  const Loader = components.Loader ?? DefaultLoader;
  const PageLayout = components.PageLayout ?? DefaultPageLayout;
  const FieldValue = components.FieldValue ?? DefaultFieldValue;
  const FieldLabel = components.FieldLabel ?? DefaultFieldLabel;

  const pageData = services.store.useSubscription<ViewPageData>('page');
  const registry = services.store.useSubscription<Registry<DefaultDataModel>>('registry');

  // Page is still loading...
  if (pageData === null) {
    return <Loader services={services} components={components} />;
  }

  return (
    <main className={buildClass('view-page', String(resource))}>
      <PageLayout services={services} components={components} resource={resource} page="VIEW">
        <div className="view-page__fields">
          {pageData.fields.map((field) => (
            <div className="view-page__fields__field" key={field}>
              <FieldLabel
                page="VIEW"
                field={field}
                services={services}
                resource={resource}
                components={components}
              />
              <FieldValue
                page="VIEW"
                field={field}
                id={pageData.id}
                registry={registry}
                services={services}
                resource={resource}
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
