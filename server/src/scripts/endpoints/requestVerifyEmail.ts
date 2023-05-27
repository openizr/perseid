/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { type Id } from '@perseid/core';
import type Model from 'scripts/common/Model';

interface Params {
  deviceId: string;
  loggedUserId: Id;
}

/**
 * `POST /oauth/verify-email` endpoint handler.
 *
 * @param model Perseid data model.
 *
 * @param services Available internal services.
 *
 * @returns Actual fastify endpoint.
 */
export default function requestVerifyEmail(_model: Model, services: ServerServices): Endpoint {
  return {
    handler: async (request, response): Promise<void> => {
      await services.controller.catchErrors(async () => {
        const userId = (<Params>request.params).loggedUserId;
        await services.engine.requestVerifyEmail(userId);
        response.send();
      });
    },
    schema: {
      response: services.controller.createSchema({ '2xx': { type: 'string' } }, 'RESPONSE'),
    },
  };
}
