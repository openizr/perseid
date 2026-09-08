import store from 'scripts/store';
import PropTypes from 'prop-types';
import React, { Suspense } from 'react';
import routes from 'scripts/store/routes';
import Loader from 'scripts/components/Loader';
import translate from 'scripts/helpers/translate';
import connect from '@perseid/store/connectors/react';

const useSubscription = connect(store);

// Lazy components must be created once, outside of render.
const lazyComponents = Object.keys(routes).reduce((components, route) => ({
  ...components,
  [route]: React.lazy(routes[route]),
}), {});

const propTypes = {
  locale: PropTypes.instanceOf(Object).isRequired,
};

/**
 * App router.
 */
export default function RouterJS(props) {
  const { locale } = props;
  const { log } = console;
  log(locale);
  const route = useSubscription('router', (newState) => newState.route);

  const Component = lazyComponents[route];
  let currentPage = null;
  if (Component !== undefined) {
    currentPage = <Component translate={translate} />;
  }

  return (
    <Suspense fallback={<Loader />}>
      {currentPage}
    </Suspense>
  );
}

RouterJS.propTypes = propTypes;
RouterJS.displayName = 'RouterJS';
