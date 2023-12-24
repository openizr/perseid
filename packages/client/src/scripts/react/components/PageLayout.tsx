/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { UIButton } from 'biuty/react';
import { type AuthState } from 'scripts/core/services/Store';
import { toSnakeCase, type DefaultDataModel } from '@perseid/core';
import DefaultActionsWrapper from 'scripts/react/components/ActionsWrapper';

/**
 * Page layout props.
 */
export interface PageLayoutProps<DataModel extends DefaultDataModel>
  extends ReactCommonProps<DataModel> {
  /** Name of the resource collection. */
  collection: keyof DataModel;

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
  collection,
  components,
}: PageLayoutProps<DataModel>): JSX.Element {
  const ActionsWrapper = components.ActionsWrapper ?? DefaultActionsWrapper;
  const permissions = services.store.useSubscription('auth', (newState: AuthState) => newState.user?._permissions);

  if (page === 'VIEW') {
    return (
      <>
        <UIButton
          modifiers="text"
          onClick={services.store.goBack}
          label={services.i18n.t('NAVIGATION.GO_BACK')}
        />
        {children}
        <ActionsWrapper
          services={services}
          components={components}
          collection={collection}
        />
      </>
    );
  }

  if (page === 'LIST') {
    const collectionCreateRoute = services.store.getRoute(`${String(collection)}.create`);
    const canUserCreateResource = permissions?.has(toSnakeCase(`${String(collection)}_create`));
    return (
      <>
        {children}
        {(collectionCreateRoute !== null && canUserCreateResource) && (
          <UIButton
            icon="plus"
            modifiers="primary floating"
            onClick={services.store.navigate(collectionCreateRoute)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <UIButton
        modifiers="text"
        onClick={services.store.goBack}
        label={services.i18n.t('NAVIGATION.GO_BACK')}
      />
      {children}
    </>
  );
}

export default React.memo(PageLayout) as ReactPageLayoutComponent;
