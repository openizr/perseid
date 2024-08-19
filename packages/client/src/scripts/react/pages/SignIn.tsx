/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import Form from '@perseid/form/react';
import { UILink, UITitle } from '@perseid/ui/react';
import FormField from 'scripts/react/components/FormField';
import DefaultLoader from 'scripts/react/components/Loader';

/**
 * Sign-in page.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/pages/SignIn.tsx
 */
function SignIn({
  services,
  components,
}: ReactCommonProps): JSX.Element {
  const prefix = 'PAGES.SIGN_IN';
  const Loader = components.Loader ?? DefaultLoader;
  const signUpRoute = services.store.getRoute('auth.signUp');
  const resetPasswordRoute = services.store.getRoute('auth.resetPassword');
  const pageData = services.store.useSubscription<FormDefinition | null>('page');

  // Page is still loading...
  if (pageData === null) {
    return <Loader services={services} components={components} />;
  }

  return (
    <main className="sign-in-page">
      <div className="sign-in-page__card">
        <UITitle label={services.i18n.t('PAGES.SIGN_IN.TITLE')} />
        <Form
          configuration={pageData.configuration}
          Field={FormField(pageData.fieldProps, { prefix, services })}
        />
        <div>
          {(resetPasswordRoute !== null) && (
            <UILink
              href={resetPasswordRoute}
              label={services.i18n.t('PAGES.SIGN_IN.FORGOT_PASSWORD')}
              onClick={services.store.navigate(resetPasswordRoute)}
            />
          )}
          {(signUpRoute !== null) && (
            <UILink
              href={signUpRoute}
              label={services.i18n.t('PAGES.SIGN_IN.SIGN_UP')}
              onClick={services.store.navigate(signUpRoute)}
            />
          )}
        </div>
      </div>
    </main>
  );
}

export default React.memo(SignIn);
