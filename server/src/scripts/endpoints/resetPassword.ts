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
  resetToken: string;
}

interface Body {
  password: string;
  passwordConfirmation: string;
}

/**
 * `PUT /oauth/reset-password` endpoint handler.
 *
 * @param model Perseid data model.
 *
 * @param services Available internal services.
 *
 * @returns Actual fastify endpoint.
 */
export default function resetPassword(_model: Model, services: ServerServices): Endpoint {
  return {
    handler: async (request, response): Promise<void> => {
      await services.controller.catchErrors(async () => {
        const { resetToken, email } = <Query>request.query;
        const { passwordConfirmation, password } = <Body>request.body;
        await services.engine.resetPassword({
          email,
          password,
          resetToken,
          passwordConfirmation,
        });
        response.send();
      });
    },
    schema: {
      body: services.controller.createSchema({
        password: { type: 'password' },
        passwordConfirmation: { type: 'password' },
      }),
      query: services.controller.createSchema({
        email: { type: 'email' },
        resetToken: { type: 'token' },
      }),
      response: services.controller.createSchema({ '2xx': { type: 'string' } }, 'RESPONSE'),
    },
  };
}
