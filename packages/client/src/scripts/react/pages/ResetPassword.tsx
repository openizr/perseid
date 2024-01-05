/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import Form from '@perseid/form/react';
import { UILink } from '@perseid/ui/react';
import { type DefaultDataModel } from '@perseid/core';
import FormField from 'scripts/react/components/FormField';
import DefaultLoader from 'scripts/react/components/Loader';

/**
 * Reset password page.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/pages/ResetPassword.tsx
 */
function ResetPassword<DataModel extends DefaultDataModel = DefaultDataModel>({
  services,
  components,
}: ReactCommonProps<DataModel>): JSX.Element {
  const prefix = 'PAGES.RESET_PASSWORD';
  const Loader = components.Loader ?? DefaultLoader;
  const signInRoute = services.store.getRoute('auth.signIn');
  const pageData = services.store.useSubscription<FormDefinition | null>('page');

  // Page is still loading...
  if (pageData === null) {
    return <Loader services={services} components={components} />;
  }

  return (
    <main className="reset-password-page">
      <div className="reset-password-page__card">
        <Form
          configuration={pageData.configuration}
          Field={FormField(pageData.fieldProps, { prefix, services })}
        />
        <div>
          {(signInRoute !== null) && (
            <UILink
              href={signInRoute}
              onClick={services.store.navigate(signInRoute)}
              label={services.i18n.t('PAGES.RESET_PASSWORD.SIGN_IN')}
            />
          )}
        </div>
      </div>
    </main>
  );
}

export default React.memo(ResetPassword);
