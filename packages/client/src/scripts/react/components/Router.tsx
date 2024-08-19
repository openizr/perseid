/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import connect from '@perseid/store/connectors/react';
import DefaultErrorPage from 'scripts/react/pages/Error';
import type BaseModel from 'scripts/core/services/Model';
import type BaseStore from 'scripts/core/services/Store';
import DefaultLoader from 'scripts/react/components/Loader';
import DefaultLayout from 'scripts/react/components/Layout';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import ErrorWrapper from 'scripts/react/components/ErrorWrapper';
import { type Page as PageType } from 'scripts/core/services/Store';
import { type RoutingContext } from '@perseid/store/extensions/router';
import type { I18n as BaseI18n, DefaultDataModel } from '@perseid/core';
import ConfirmationModal from 'scripts/react/components/ConfirmationModal';

type ReactPage<DataModel extends DefaultDataModel> = PageType<DataModel> & {
  component: React.LazyExoticComponent<(props: ReactCommonProps<DataModel>) => JSX.Element>;
}

// Do not import all built-in components in this default list as it breaks tree shaking!
const resizeEventOptions = { capture: true };
const defaultComponents = { ConfirmationModal };
const defaultPages = {
  List: (): Promise<unknown> => import('scripts/react/pages/List'),
  View: (): Promise<unknown> => import('scripts/react/pages/View'),
  SignIn: (): Promise<unknown> => import('scripts/react/pages/SignIn'),
  SignUp: (): Promise<unknown> => import('scripts/react/pages/SignUp'),
  Update: (): Promise<unknown> => import('scripts/react/pages/CreateOrUpdate'),
  Create: (): Promise<unknown> => import('scripts/react/pages/CreateOrUpdate'),
  UpdateUser: (): Promise<unknown> => import('scripts/react/pages/UpdateUser'),
  VerifyEmail: (): Promise<unknown> => import('scripts/react/pages/VerifyEmail'),
  ResetPassword: (): Promise<unknown> => import('scripts/react/pages/ResetPassword'),
};

/**
 * Router props.
 */
export interface RouterProps<
  DataModel extends DefaultDataModel = DefaultDataModel,
  I18n extends BaseI18n = BaseI18n,
  Store extends BaseStore<DataModel> = BaseStore<DataModel>,
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,
  ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
> extends Pick<ReactCommonProps<DataModel, I18n, Store, Model, ApiClient>, 'services'> {
  /** App DOM container. Automatic dimensionning is enabled only if this prop is specified. */
  container?: HTMLElement;

  /** Custom components declaration. */
  components?: ReactCommonProps<DataModel>['components'];

  /** Custom pages components declaration. */
  pages?: Partial<Record<string, (() => Promise<{
    default: (props: ReactCommonProps<DataModel, I18n, Store, Model, ApiClient>) => React.ReactNode;
  }>)>>;
}

/**
 * App router. Handles redirects, not founds, and pages loading.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/Router.tsx
 */
function Router({
  pages,
  services,
  container,
  components,
}: RouterProps & {
  components: ReactCommonProps['components'];
  pages: Exclude<RouterProps['pages'], undefined>;
}): JSX.Element {
  const { store } = services;
  const error = store.useSubscription('error');
  const router = store.useSubscription<RoutingContext>('router');
  const Layout = components.Layout ?? DefaultLayout;
  const Loader = components.Loader ?? DefaultLoader;
  const ErrorPage = components.ErrorPage ?? DefaultErrorPage;

  // We need to wrap `React.lazy` in a `useState` as lazy components must not be declared in
  // rendering functions (see https://react.dev/reference/react/lazy#troubleshooting).
  const [allPages] = React.useState<Record<string, ReactPage<DefaultDataModel>>>(() => {
    const allRoutes = services.store.getAllRoutes();
    return allRoutes.reduce((finalRoutes, route) => {
      const pageConfiguration = services.store.getPage(route);
      const page = pages[String(pageConfiguration?.component)] ?? null;
      return ({
        ...finalRoutes,
        [route]: {
          ...pageConfiguration,
          component: (page !== null) ? React.lazy(page) : page,
        },
      });
    }, {});
  });

  // Adapts application dimensions to provide a unified UX accross devices.
  React.useEffect(() => {
    const parent = container;
    // For some reason, resizing on mobile always happens in 2 times (first, available width and
    // height are updated, then inner height). Thus, we need a memoization mechanism to trigger
    // container resizing at the right moment.
    let shouldResize = true;
    let currentViewportHeight = window.innerHeight;
    let currentViewportAvailableWidth = window.screen.availWidth;
    const setHeight = (): void => {
      const innerHeightDifference = Math.abs(window.innerHeight - currentViewportHeight);
      if (
        // Most likely a desktop device...
        navigator.maxTouchPoints <= 1
        // Available screen width big modification means portrait/landscape switching on mobile.
        || Math.abs(currentViewportAvailableWidth - window.screen.availWidth) > 50
        // Big height difference on resize most likely means virtual keyboard was opened.
        || (innerHeightDifference > 0 && innerHeightDifference <= 50)
      ) {
        shouldResize = true;
        currentViewportHeight = window.innerHeight;
        currentViewportAvailableWidth = window.screen.availWidth;
      } else if (parent !== undefined && shouldResize) {
        shouldResize = false;
        requestAnimationFrame(() => { parent.style.height = `${String(window.innerHeight)}px`; });
      }
    };
    setHeight();
    window.addEventListener('resize', setHeight, { capture: true });
    return (): void => { window.removeEventListener('resize', setHeight, resizeEventOptions); };
  }, [container]);

  // Error...
  if (error !== null || router.route === null) {
    return (
      <ErrorPage
        services={services}
        components={components}
        error={router.route === null ? new Error('NOT_FOUND') : error as Error}
      />
    );
  }

  // Success...
  const page = allPages[router.route];
  const Page = page.component;
  return (
    <Layout
      services={services}
      components={components}
      {...page.layoutProps}
    >
      <React.Suspense fallback={<Loader services={services} components={components} />}>
        {(Page as unknown !== null) && (
          <Page
            services={services}
            {...page.pageProps}
            components={components}
            resource={page.resource}
          />
        )}
      </React.Suspense>
    </Layout>
  );
}

export default React.memo(({
  pages,
  services,
  container,
  components,
}: RouterProps) => {
  const allComponents = {
    ...defaultComponents,
    ...components,
  } as ReactCustomComponents<DefaultDataModel>;
  const allPages = { ...defaultPages, ...pages } as Exclude<RouterProps['pages'], undefined>;
  const ErrorPage = allComponents.ErrorPage ?? DefaultErrorPage;

  // Initializes React connection to the store.
  const { store } = services;
  store.useSubscription = connect(services.store);

  // We need to wrap all components including Router inside the error handler at the highest
  // level, to be able to cleanly handle as many errors as possible, including store errors.
  return (
    <ErrorWrapper fallback={<ErrorPage services={services} components={allComponents} />}>
      <Router
        pages={allPages}
        services={services}
        container={container}
        components={allComponents}
      />
    </ErrorWrapper>
  );
}) as ReactRouterComponent;
