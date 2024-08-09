import { UIP } from 'biuty/react';
import PropTypes, { type InferProps } from 'prop-types';

const propTypes = {
  label: PropTypes.string.isRequired,
};

const defaultProps = {};

/**
 * Button.
 */
export default function TsButton(props: InferProps<typeof propTypes>): JSX.Element {
  const { label } = props;

  return (
    <button type="button">
      <UIP label="test" />
      {label}
    </button>
  );
}

TsButton.propTypes = propTypes;
TsButton.defaultProps = defaultProps;
TsButton.displayName = 'TsButton';
