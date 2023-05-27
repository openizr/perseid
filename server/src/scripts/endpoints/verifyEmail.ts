/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { type Id } from '@perseid/core';
import type Model from 'scripts/common/Model';

interface Query {
  verifyToken: string;
}

interface Params {
  loggedUser: Id;
  deviceId: string;
}

/**
 * `PUT /oauth/verify-email` endpoint handler.
 *
 * @param model Perseid data model.
 *
 * @param services Available internal services.
 *
 * @returns Actual fastify endpoint.
 */
export default function verifyEmail(_model: Model, services: ServerServices): Endpoint {
  return {
    handler: async (request, response): Promise<void> => {
      await services.controller.catchErrors(async () => {
        const { verifyToken } = <Query>request.query;
        const { loggedUser: userId } = <Params>request.params;
        await services.engine.verifyEmail({ userId, verifyToken });
        response.send();
      });
    },
    schema: {
      query: services.controller.createSchema({ verifyToken: { type: 'token', required: true } }),
      response: services.controller.createSchema({ '2xx': { type: 'string' } }, 'RESPONSE'),
    },
  };
}
