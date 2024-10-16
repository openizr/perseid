/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import DefaultLayout from 'scripts/react/components/Layout';
import { UITitle, UILink, buildClass } from '@perseid/ui/react';

/**
 * Error page.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/pages/Error.tsx
 */
function ErrorPage({
  services,
  components,
  error = null,
  modifiers = '',
}: React.ErrorPageProps): JSX.Element | null {
  const { i18n } = services;
  const Layout = components.Layout ?? DefaultLayout;
  const fallbackRoute = services.store.getFallbackPageRoute();

  // Forbidden.
  if ((error as Response | null)?.status === 403) {
    const title = i18n.t('PAGES.ERROR.FORBIDDEN.TITLE');
    return (
      <Layout services={services} components={components}>
        <main className={buildClass('error-page', `${modifiers} forbidden`)}>
          <UITitle label={title} />
          <UITitle level="2" label={i18n.t('PAGES.ERROR.FORBIDDEN.SUBTITLE')} />
          <UILink href={fallbackRoute} label={i18n.t('PAGES.ERROR.FORBIDDEN.CTA')} modifiers="button" />
        </main>
      </Layout>
    );
  }

  // Not Found - router.
  if ((error as Error | null)?.message === 'NOT_FOUND') {
    return (
      <Layout services={services} components={components} display={false}>
        <main className={buildClass('error-page', `${modifiers} not-found`)}>
          <UITitle label={i18n.t('PAGES.ERROR.NOT_FOUND.TITLE')} />
          <UITitle level="2" label={i18n.t('PAGES.ERROR.NOT_FOUND.SUBTITLE')} />
          <UILink href={fallbackRoute} label={i18n.t('PAGES.ERROR.NOT_FOUND.CTA')} modifiers="button" />
        </main>
      </Layout>
    );
  }

  // Not Found - API.
  if ((error as Response | null)?.status === 404) {
    const title = i18n.t('PAGES.ERROR.NOT_FOUND.TITLE');
    return (
      <Layout services={services} components={components}>
        <main className={buildClass('error-page', `${modifiers} resource-not-found`)}>
          <UITitle label={title} />
          <UITitle level="2" label={i18n.t('PAGES.ERROR.NOT_FOUND.SUBTITLE')} />
          <UILink href={fallbackRoute} label={i18n.t('PAGES.ERROR.NOT_FOUND.CTA')} modifiers="button" />
        </main>
      </Layout>
    );
  }

  // Uncaught / unknown. We don't use Layout here, as if the error comes from the store, we might
  // fall into an infinite loop while subscribing to modal / notifications / ... modules.
  return (
    <div className="layout">
      <div className="layout__content">
        <main className={buildClass('error-page', `${modifiers} generic`)}>
          <UITitle label={i18n.t('PAGES.ERROR.GENERIC.TITLE')} />
          <UITitle level="2" label={i18n.t('PAGES.ERROR.GENERIC.SUBTITLE')} />
          <UILink href={fallbackRoute} label={i18n.t('PAGES.ERROR.GENERIC.CTA')} modifiers="button" />
        </main>
      </div>
    </div>
  );
}

export default React.memo(ErrorPage);
