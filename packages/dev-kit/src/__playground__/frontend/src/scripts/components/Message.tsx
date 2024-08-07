import testJpg from 'images/test.jpg';
import testSvg from 'images/test.svg';
import PropTypes, { type InferProps } from 'prop-types';

const propTypes = {
  label: PropTypes.string.isRequired,
};

/**
 * Simple message.
 */
export default function Message(props: InferProps<typeof propTypes>): JSX.Element {
  const { label } = props;

  return (
    <p>
      <img alt="test" src={testJpg} />
      <img alt="test" src={testSvg} />
      {label}
    </p>
  );
}

Message.propTypes = propTypes;
Message.displayName = 'Message';
