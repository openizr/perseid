import store from 'scripts/store';
import PropTypes from 'prop-types';
import React, { Suspense } from 'react';
import routes from 'scripts/store/routes';
import connect from 'diox/connectors/react';
import Loader from 'scripts/components/Loader';
import translate from 'scripts/helpers/translate';

const useSubscription = connect(store);

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

  let currentPage = null;
  if (routes[route] !== undefined) {
    const Component = React.lazy(routes[route]);
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
