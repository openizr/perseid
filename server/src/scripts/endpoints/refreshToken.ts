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

interface Body {
  refreshToken: string;
}

/**
 * `POST /oauth/refresh-token` endpoint handler.
 *
 * @param model Perseid data model.
 *
 * @param services Available internal services.
 *
 * @returns Actual fastify endpoint.
 */
export default function refreshToken(_model: Model, services: ServerServices): Endpoint {
  return {
    handler: async (request, response): Promise<void> => {
      await services.controller.catchErrors(async () => {
        const requestRefreshToken = (<Body>request.body).refreshToken;
        const { loggedUser, deviceId } = <Params>request.params;
        const credentials = await services.engine.refreshToken(requestRefreshToken, {
          deviceId,
          user: { _id: loggedUser._id },
          userAgent: request.headers['user-agent'] || 'UNKNOWN',
        });
        response.send(credentials);
      });
    },
    schema: {
      body: services.controller.createSchema({ refreshToken: { type: 'token' } }),
      response: services.controller.createSchema({ '2xx': { type: 'credentials' } }, 'RESPONSE'),
    },
  };
}
