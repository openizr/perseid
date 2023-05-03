import postMessage from 'scripts/routes/v1/postMessage';

vi.mock('fastify');

describe('routes/v1/postMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('correctly handles request', () => {
    const send = vi.fn();
    postMessage.handler({}, { send });
    expect(postMessage.schema).toMatchSnapshot();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith();
  });
});
