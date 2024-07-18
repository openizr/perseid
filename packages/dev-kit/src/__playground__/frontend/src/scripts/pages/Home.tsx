import * as React from 'react';
import Message from 'scripts/components/Message';
import PropTypes, { type InferProps } from 'prop-types';

const propTypes = {
  translate: PropTypes.func.isRequired,
};

/**
 * Home page.
 */
export default function Home(props: InferProps<typeof propTypes>): JSX.Element {
  const { translate } = props;

  return (
    <Message label={(translate as (...args: string[]) => string)('LABEL_TEST')} />
  );
}

Home.propTypes = propTypes;
Home.displayName = 'Home';
