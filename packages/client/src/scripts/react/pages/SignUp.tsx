/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import Form from '@perseid/form/react';
import { UILink, UITitle } from 'biuty/react';
import { type DefaultDataModel } from '@perseid/core';
import FormField from 'scripts/react/components/FormField';
import DefaultLoader from 'scripts/react/components/Loader';

/**
 * Sign-up page.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/pages/SignUp.tsx
 */
function SignUp<DataModel extends DefaultDataModel = DefaultDataModel>({
  services,
  components,
}: ReactCommonProps<DataModel>): JSX.Element {
  const prefix = 'PAGES.SIGN_UP';
  const Loader = components.Loader ?? DefaultLoader;
  const signInRoute = services.store.getRoute('auth.signIn');
  const pageData = services.store.useSubscription<FormDefinition | null>('page');

  // Page is still loading...
  if (pageData === null) {
    return <Loader services={services} components={components} />;
  }

  return (
    <main className="sign-up-page">
      <div className="sign-up-page__card">
        <UITitle label={services.i18n.t('PAGES.SIGN_UP.TITLE')} />
        <Form
          configuration={pageData.configuration}
          Field={FormField(pageData.fieldProps, { prefix, services })}
        />
        <div>
          {(signInRoute !== null) && (
            <UILink
              href={signInRoute}
              label={services.i18n.t('PAGES.SIGN_UP.SIGN_IN')}
              onClick={services.store.navigate(signInRoute)}
            />
          )}
        </div>
      </div>
    </main>
  );
}

export default React.memo(SignUp);
