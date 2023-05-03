import fastify, { addHook, listen } from 'scripts/__mocks__/fastify';

vi.mock('ajv');
vi.mock('ajv-errors');
vi.mock('scripts/conf/routes', () => ({ default: () => Promise.reject() }));
vi.spyOn(process, 'exit').mockImplementation((code) => code);

describe('javascript', () => {
  beforeEach(() => {
    process.env.PLAYGROUND_PORT = '4000';
    process.env.ENV = 'test';
    vi.clearAllMocks();
    vi.resetModules();
  });

  test('correctly initializes server - development mode', async () => {
    delete process.env.PLAYGROUND_PORT;
    process.env.ENV = 'development';
    vi.mock('fastify', () => ({ default: fastify }));
    await import('scripts/javascript');
    expect(fastify).toHaveBeenCalledTimes(1);
    expect(fastify).toHaveBeenCalledWith({
      connectionTimeout: 3000,
      ignoreTrailingSlash: true,
      keepAliveTimeout: 2000,
      logger: { level: 'info' },
    });
    expect(addHook).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledWith({ port: 3000, host: '0.0.0.0' }, expect.any(Function));
  });

  test('correctly initializes server - production mode', async () => {
    process.env.ENV = 'production';
    vi.mock('fastify', () => ({ default: fastify }));
    await import('scripts/javascript');
    expect(fastify).toHaveBeenCalledTimes(1);
    expect(fastify).toHaveBeenCalledWith({
      connectionTimeout: 3000,
      ignoreTrailingSlash: true,
      keepAliveTimeout: 2000,
      logger: { level: 'error' },
    });
    expect(addHook).not.toHaveBeenCalled();
    expect(listen).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledWith({ port: 4000, host: '0.0.0.0' }, expect.any(Function));
  });
});
