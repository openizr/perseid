/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { UIButton } from '@perseid/ui/react';
import type BaseStore from 'scripts/core/services/Store';
import type BaseModel from 'scripts/core/services/Model';
import { type AuthState } from 'scripts/core/services/Store';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import DefaultActionsWrapper from 'scripts/react/components/ActionsWrapper';
import { toSnakeCase, type DefaultDataModel, type I18n as BaseI18n } from '@perseid/core';

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
function PageLayout({
  page,
  children,
  services,
  resource,
  components,
}: PageLayoutProps): JSX.Element {
  const ActionsWrapper = components.ActionsWrapper ?? DefaultActionsWrapper;
  const permissions = services.store.useSubscription('auth', (newState: AuthState) => newState.user?._permissions);

  if (page === 'VIEW') {
    return (
      <>
        <UIButton
          modifiers="secondary"
          onClick={services.store.goBack}
          label={services.i18n.t('NAVIGATION.GO_BACK')}
        />
        {children}
        <ActionsWrapper
          services={services}
          components={components}
          resource={resource}
        />
      </>
    );
  }

  if (page === 'LIST') {
    const resourceCreateRoute = services.store.getRoute(`${String(resource)}.create`);
    const canUserCreateResource = permissions?.has(toSnakeCase(`create_${String(resource)}`));
    return (
      <>
        {children}
        {(resourceCreateRoute !== null && canUserCreateResource) && (
          <UIButton
            icon="plus"
            modifiers="primary floating"
            onClick={services.store.navigate(resourceCreateRoute)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <UIButton
        modifiers="secondary"
        onClick={services.store.goBack}
        label={services.i18n.t('NAVIGATION.GO_BACK')}
      />
      {children}
    </>
  );
}

export default React.memo(PageLayout);
