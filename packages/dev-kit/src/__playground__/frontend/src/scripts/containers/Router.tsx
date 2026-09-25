import * as React from 'react';
import store from 'scripts/store';
import routes from 'scripts/store/routes';
import Loader from 'scripts/components/Loader';
import translate from 'scripts/helpers/translate';
import useStore from '@perseid/store/connectors/react';

type PageComponent = React.ComponentType<{
  translate: (label: string, values: Record<string, string>) => string;
}>;
type LazyComponent = () => Promise<{ default: PageComponent; }>;
type LazyPages = Record<string, React.LazyExoticComponent<PageComponent>>;

const useCombiner = useStore(store); // eslint-disable-line react-hooks/rules-of-hooks

// Lazy components must be created once, outside of render.
const lazyComponents = Object.keys(routes).reduce<LazyPages>((components, route) => ({
  ...components,
  [route]: React.lazy(routes[route] as LazyComponent),
}), {});

/**
 * App router.
 */
export default function Router(props: { locale: unknown; }): React.JSX.Element {
  const { log } = console;
  const { locale } = props;
  log(locale);
  const route = useCombiner('router', (newState: { route: string; }) => newState.route);
  const Component = lazyComponents[route] as LazyPages[string] | undefined;
  let currentPage = null;
  if (Component !== undefined) {
    currentPage = <Component translate={translate} />;
  }

  const { Suspense } = React;

  return (
    <Suspense fallback={<Loader />}>
      {currentPage}
    </Suspense>
  );
}

Router.propTypes = {};
Router.displayName = 'Router';
