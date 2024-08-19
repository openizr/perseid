/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { UITitle, UIButton } from '@perseid/ui/react';
import { type DefaultDataModel } from '@perseid/core';
import DefaultLoader from 'scripts/react/components/Loader';
import { type AuthState } from 'scripts/core/services/Store';
import { type RoutingContext } from '@perseid/store/extensions/router';

/**
 * Verify email page.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/pages/VerifyEmail.tsx
 */
function VerifyEmail<DataModel extends DefaultDataModel = DefaultDataModel>({
  services,
  components,
}: ReactCommonProps<DataModel>): JSX.Element {
  const { store, i18n } = services;
  const Loader = components.Loader ?? DefaultLoader;
  const { user } = store.useSubscription<AuthState>('auth');
  const router = store.useSubscription<RoutingContext>('router');
  const { verificationToken } = router.query;

  const requestEmailVerification = React.useCallback(async () => {
    await store.dispatch('auth', 'requestEmailVerification');
    store.notify('NOTIFICATIONS.REQUESTED_EMAIL');
  }, [store]);

  // Automatically redirects users to the default page if their email is already verified.
  React.useEffect(() => {
    if (user?._verifiedAt) {
      store.navigate(store.getFallbackPageRoute())();
    }
  }, [user?._verifiedAt, store]);

  // Verifies user email when a verification token is passed in the URL.
  React.useEffect(() => {
    if (/^[0-9a-fA-F]{24}$/.test(verificationToken)) {
      store.dispatch('auth', 'verifyEmail', verificationToken).catch(() => {
        store.notify('NOTIFICATIONS.ERRORS.INVALID_VERIFICATION_TOKEN');
      }).finally(() => {
        store.navigate(store.getFallbackPageRoute())();
      });
    } else {
      store.dispatch('auth', 'requestEmailVerification').catch(() => {
        // No-op.
      });
    }
  }, [verificationToken, store]);

  return (
    <main className="verify-email-page">
      {(user?._verifiedAt !== null || /^[0-9a-fA-F]{24}$/.test(verificationToken))
        // Verifying email...
        ? <Loader services={services} components={components} />
        // Email must be verified...
        : (
          <div>
            <UITitle level="1" label={i18n.t('PAGES.VERIFY_EMAIL.TITLE')} />
            <UITitle level="2" label={i18n.t('PAGES.VERIFY_EMAIL.SUBTITLE')} />
            <UIButton
              modifiers="primary"
              label={i18n.t('PAGES.VERIFY_EMAIL.CTA')}
              onClick={requestEmailVerification as () => void}
            />
          </div>
        )}
    </main>
  );
}

export default React.memo(VerifyEmail);
