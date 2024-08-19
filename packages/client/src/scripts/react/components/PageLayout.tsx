/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { UIButton } from '@perseid/ui/react';
import { type AuthState } from 'scripts/core/services/Store';
import { toSnakeCase, type DefaultDataModel } from '@perseid/core';
import DefaultActionsWrapper from 'scripts/react/components/ActionsWrapper';

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
function PageLayout<DataModel extends DefaultDataModel = DefaultDataModel>({
  page,
  children,
  services,
  resource,
  components,
}: PageLayoutProps<DataModel>): JSX.Element {
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
    const canUserCreateResource = permissions?.has(toSnakeCase(`${String(resource)}_create`));
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

export default React.memo(PageLayout) as ReactPageLayoutComponent;
