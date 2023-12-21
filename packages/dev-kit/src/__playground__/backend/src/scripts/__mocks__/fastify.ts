/**
 * Fastify mock.
 */

type Callback = (...args: unknown[]) => void;

const addHook = vi.fn((_event, callback: Callback) => {
  callback(null, {
    header: vi.fn(() => Promise.resolve()),
    status: vi.fn(() => ({
      send: vi.fn(() => Promise.resolve()),
    })),
  }, null, vi.fn());
});

const setValidatorCompiler = vi.fn((callback: Callback) => { callback({ schema: {} }); });

const register = vi.fn((callback: Callback) => {
  callback({
    post: vi.fn(),
    get: vi.fn(),
  }, null, vi.fn());
});

const listen = vi.fn((_a, callback: Callback) => {
  callback(
    (process.env.ENV === 'production')
      ? 'error'
      : undefined,
  );
});

const fastify = vi.fn(() => ({
  addHook,
  register,
  listen,
  setValidatorCompiler,
  log: { fatal: vi.fn() },
}));

export {
  fastify,
  addHook,
  register,
  listen,
  setValidatorCompiler,
};
export default fastify;
