import * as React from 'react';
import store from 'scripts/store';
import routes from 'scripts/store/routes';
import Loader from 'scripts/components/Loader';
import translate from 'scripts/helpers/translate';
import useStore from '@perseid/store/connectors/react';

type LazyComponent = () => Promise<{
  default: React.ComponentType<{
    translate: (label: string, values: Record<string, string>) => string
  }>
}>;

const useCombiner = useStore(store); // eslint-disable-line react-hooks/rules-of-hooks

/**
 * App router.
 */
export default function Router(props: { locale: unknown; }): React.JSX.Element {
  const { log } = console;
  const { locale } = props;
  log(locale);
  const route = useCombiner('router', (newState: { route: string; }) => newState.route);
  const component = routes[route] as LazyComponent | undefined;
  let currentPage = null;
  if (component !== undefined) {
    const Component = React.lazy(component);
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
