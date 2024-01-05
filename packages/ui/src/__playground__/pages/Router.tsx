/* c8 ignore start */

import * as React from 'react';
import { routes, store } from '__playground__/store';
import connect from '@perseid/store/connectors/react';
import { type RoutingContext } from '@perseid/store/extensions/router';

type Translate = (label: string) => string;
type LazyComponent = () => Promise<{ default: React.ComponentType<{ translate: Translate; }>; }>;

const useCombiner = connect(store);

export default function Router(): JSX.Element {
  const routing = useCombiner<RoutingContext>('router');
  const { route } = routing;

  let currentPage = null;
  if (route !== null && routes[route] as unknown !== undefined) {
    const Component = React.lazy(routes[route] as LazyComponent);
    currentPage = <Component translate={(label: string): string => label} />;
  }

  return (
    <React.Suspense fallback={<div>LOADING...</div>}>
      {currentPage}
    </React.Suspense>
  );
}
