/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type Model from 'scripts/common/Model';

interface Body {
  email: string;
  password: string;
}

/**
 * `POST /oauth/sign-in` endpoint handler.
 *
 * @param model Perseid data model.
 *
 * @param services Available internal services.
 *
 * @returns Actual fastify endpoint.
 */
export default function signIn(_model: Model, services: ServerServices): Endpoint {
  return {
    handler: async (request, response): Promise<void> => {
      await services.controller.catchErrors(async () => {
        const fields = ['password', '_devices'];
        const { email, password } = <Body>request.body;
        const deviceId = <string>request.headers['x-device-id'];
        const credentials = await services.engine.signIn(email, password, { fields }, {
          deviceId,
          userAgent: request.headers['user-agent'] || 'UNKNOWN',
        });
        response.send(credentials);
      });
    },
    schema: {
      headers: services.controller.createSchema({ 'x-device-id': { type: 'id' } }, 'CREATE', (schema) => ({
        ...schema,
        additionalProperties: true,
      })),
      body: services.controller.createSchema({ email: { type: 'string' }, password: { type: 'string' } }),
      response: services.controller.createSchema({ '2xx': { type: 'credentials' } }, 'RESPONSE'),
    },
  };
}
