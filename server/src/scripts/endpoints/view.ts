/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Id, type User } from '@perseid/core';

interface Query {
  fields: string[];
}

interface Params {
  id: string;
  loggedUser: User;
  collection: string;
}

/**
 * `GET /:collection/:id` endpoint handler.
 *
 * @param services Available internal services.
 *
 * @returns Actual fastify endpoint.
 */
export default function view(services: ServerServices): Endpoint {
  return {
    handler: async (request, response): Promise<void> => {
      await services.controller.catchErrors(async () => {
        const { collection, id, loggedUser: user } = <Params>request.params;
        const { fields } = <Query>request.query;
        const { _id } = user;
        const resourceId = (collection === 'users' && id === 'me') ? _id : new Id(id);
        const resource = await services.engine.view(collection, resourceId, { fields });
        response.send(resource);
      });
    },
  };
}
