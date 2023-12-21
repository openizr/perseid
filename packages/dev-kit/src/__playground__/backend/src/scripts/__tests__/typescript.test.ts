import fastify, { addHook, listen } from 'scripts/__mocks__/fastify';

vi.mock('ajv');
vi.mock('ajv-errors');
vi.mock('scripts/conf/routes', () => ({ default: (): Promise<void> => Promise.reject() }));
vi.spyOn(process, 'exit').mockImplementation((code: number | undefined) => code as unknown as never);

describe('typescript', () => {
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
    await import('scripts/typescript');
    expect(fastify).toHaveBeenCalledTimes(1);
    expect(fastify).toHaveBeenCalledWith({
      connectionTimeout: 3000,
      ignoreTrailingSlash: true,
      keepAliveTimeout: 2000,
      logger: { level: 'info' },
    });
    expect(addHook).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledWith({ port: parseInt(String(process.env.BACKEND_EXAMPLES_PORT), 10), host: '0.0.0.0' }, expect.any(Function));
  });

  test('correctly initializes server - production mode', async () => {
    process.env.ENV = 'production';
    vi.mock('fastify', () => ({ default: fastify }));
    await import('scripts/typescript');
    expect(fastify).toHaveBeenCalledTimes(1);
    expect(fastify).toHaveBeenCalledWith({
      connectionTimeout: 3000,
      ignoreTrailingSlash: true,
      keepAliveTimeout: 2000,
      logger: { level: 'error' },
    });
    expect(addHook).not.toHaveBeenCalled();
    expect(listen).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledWith({ port: parseInt(String(process.env.BACKEND_EXAMPLES_PORT), 10), host: '0.0.0.0' }, expect.any(Function));
  });
});
