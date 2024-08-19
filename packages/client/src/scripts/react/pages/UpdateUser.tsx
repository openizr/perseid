/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import Form from '@perseid/form/react';
import { UITitle } from '@perseid/ui/react';
import FormField from 'scripts/react/components/FormField';
import DefaultLoader from 'scripts/react/components/Loader';

/**
 * Connected user update page.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/pages/UpdateUser.tsx
 */
function UpdateUser({
  services,
  components,
}: ReactCommonProps): JSX.Element {
  const Loader = components.Loader ?? DefaultLoader;
  const pageData = services.store.useSubscription<FormDefinition | null>('page');

  // Page is still loading...
  if (pageData === null) {
    return <Loader services={services} components={components} />;
  }

  return (
    <main className="update-user-page">
      <div className="update-user-page__card">
        <UITitle label={services.i18n.t('PAGES.UPDATE_USER.TITLE')} />
        <Form
          configuration={pageData.configuration}
          Field={FormField(pageData.fieldProps, { prefix: 'PAGES.UPDATE_USER', services })}
        />
      </div>
    </main>
  );
}

export default React.memo(UpdateUser);
