/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { type User } from '@perseid/core';

interface Params {
  loggedUser: User;
  collection: string;
}

/**
 * `GET /:collection` endpoint handler.
 *
 * @param services Available internal services.
 *
 * @returns Actual fastify endpoint.
 */
export default function list(services: ServerServices): Endpoint {
  return {
    handler: async (request, response): Promise<void> => {
      await services.controller.catchErrors(async () => {
        const { collection } = <Params>request.params;
        const results = await services.engine.list(collection, request.query);
        response.send(results);
      });
    },
  };
}
