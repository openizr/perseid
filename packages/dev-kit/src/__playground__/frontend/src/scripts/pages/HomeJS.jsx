import * as React from 'react';
import PropTypes from 'prop-types';
import Message from 'scripts/components/Message';

const propTypes = {
  translate: PropTypes.func.isRequired,
};

/**
 * Home page.
 */
export default function HomeJS(props) {
  const { translate } = props;

  return (
    <Message label={translate('LABEL_TEST')} />
  );
}

HomeJS.propTypes = propTypes;
HomeJS.defaultProps = {};
HomeJS.displayName = 'HomeJS';
