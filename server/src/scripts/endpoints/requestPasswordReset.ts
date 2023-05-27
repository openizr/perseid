/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type Model from 'scripts/common/Model';

interface Query {
  email: string;
}

/**
 * `POST /oauth/reset-password` endpoint handler.
 *
 * @param model Perseid data model.
 *
 * @param services Available internal services.
 *
 * @returns Actual fastify endpoint.
 */
export default function requestPasswordReset(_model: Model, services: ServerServices): Endpoint {
  return {
    handler: async (request, response): Promise<void> => {
      await services.controller.catchErrors(async () => {
        const { email } = <Query>request.query;
        await services.engine.requestPasswordReset(email);
        response.send();
      });
    },
    schema: {
      query: services.controller.createSchema({ email: { type: 'email', required: true } }),
      response: services.controller.createSchema({ '2xx': { type: 'string' } }, 'RESPONSE'),
    },
  };
}
