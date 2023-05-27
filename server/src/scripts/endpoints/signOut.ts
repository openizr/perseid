/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { type User } from '@perseid/core';
import type Model from 'scripts/common/Model';

interface Params {
  loggedUser: User;
  deviceId: string;
}

/**
 * `POST /oauth/sign-out` endpoint handler.
 *
 * @param model Perseid data model.
 *
 * @param services Available internal services.
 *
 * @param configuration Perseid server configuration.
 *
 * @returns Actual fastify endpoint.
 */
export default function signOut(_model: Model, services: ServerServices): Endpoint {
  return {
    handler: async (request, response): Promise<void> => {
      await services.controller.catchErrors(async () => {
        const { loggedUser, deviceId } = <Params>request.params;
        await services.engine.signOut({ deviceId, userId: loggedUser._id });
        response.send();
      });
    },
    schema: {
      response: services.controller.createSchema({ '2xx': { type: 'string' } }, 'RESPONSE'),
    },
  };
}
