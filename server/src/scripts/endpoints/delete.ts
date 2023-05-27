/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Id, type User } from '@perseid/core';

interface Params {
  id: string;
  loggedUser: User;
  collection: string;
}

/**
 * `DELETE /:collection/:id` endpoint handler.
 *
 * @param services Available internal services.
 *
 * @returns Actual fastify endpoint.
 */
export default function deleteResource(services: ServerServices): Endpoint {
  return {
    handler: async (request, response): Promise<void> => {
      await services.controller.catchErrors(async () => {
        const { collection, id, loggedUser } = <Params>request.params;
        await services.engine.delete(collection, new Id(id), { user: loggedUser });
        response.send();
      });
    },
  };
}
