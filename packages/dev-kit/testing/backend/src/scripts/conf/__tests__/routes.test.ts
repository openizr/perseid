import { FastifyInstance } from 'fastify';
import declareRoutes from 'scripts/conf/routes';
import fastify, { register } from 'scripts/__mocks__/fastify';

describe('conf/routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('correctly declares routes', async () => {
    await declareRoutes(fastify() as unknown as FastifyInstance);
    expect(register).toHaveBeenCalledTimes(1);
  });
});
