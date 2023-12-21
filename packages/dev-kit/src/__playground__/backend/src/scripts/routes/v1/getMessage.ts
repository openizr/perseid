import { deepMerge } from 'basx';
import schema from 'scripts/lib/baseSchema';
import { FastifyRequest, FastifyReply } from 'fastify';

const routeSchema = deepMerge(
  schema,
  {
    response: {
      200: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
      },
    },
  },
);

delete routeSchema.body;

/**
 * `GET /v1/message` endpoint handler.
 */
export default {
  handler: async (_request: FastifyRequest, response: FastifyReply): Promise<void> => (
    response.send({ message: 'WELCOME_MESSAGE' })
  ),
  schema: routeSchema,
};
