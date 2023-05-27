/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { User } from '@perseid/core';

interface Query {
  fields: string[];
}

interface Params {
  loggedUser: User;
  collection: string;
}

/**
 * `POST /:collection` endpoint handler.
 *
 * @param services Available internal services.
 *
 * @returns Actual fastify endpoint.
 */
export default function create(services: ServerServices): Endpoint {
  return {
    handler: async (request, response): Promise<void> => {
      await services.controller.catchErrors(async () => {
        const { fields } = <Query>request.query;
        const { collection, loggedUser } = <Params>request.params;
        const newResource = (collection === 'users')
          ? await services.engine.createUser(request.body, { user: loggedUser })
          : await services.engine.create(collection, request.body, { fields }, {
            user: loggedUser,
          });
        response.status(201).send(newResource);
      });
    },
  };
}
