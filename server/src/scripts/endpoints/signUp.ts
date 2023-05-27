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
  lastName: string;
  firstName: string;
  password: string;
  passwordConfirmation: string;
}

/**
 * `POST /oauth/sign-up` endpoint handler.
 *
 * @param model Perseid data model.
 *
 * @param services Available internal services.
 *
 * @returns Actual fastify endpoint.
 */
export default function signUp(_model: Model, services: ServerServices): Endpoint {
  return {
    handler: async (request, response): Promise<void> => {
      await services.controller.catchErrors(async () => {
        const credentials = await services.engine.signUp(<Body>request.body, {
          userAgent: request.headers['user-agent'] || 'UNKNOWN',
        });
        response.status(201).send(credentials);
      });
    },
    schema: (services.controller.createSchema as any)('', {
      body: {
        type: 'object',
        fields: {
          email: { type: 'email', required: true },
          firstName: { type: 'shortString', required: true },
          lastName: { type: 'shortString', required: true },
          password: { type: 'password', required: true },
          passwordConfirmation: { type: 'password', required: true },
        },
      },
      'response.2xx': { type: 'credentials' },
    }),
  };
}
