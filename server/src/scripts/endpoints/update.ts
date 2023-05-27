/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Id, type User } from '@perseid/core';
import Forbidden from 'scripts/errors/Forbidden';

interface Query {
  fields: string[];
}

interface Params {
  id: string;
  loggedUser: User;
  collection: string;
}

/**
 * `PUT /:collection/:id` endpoint handler.
 *
 * @param services Available internal services.
 *
 * @returns Actual fastify endpoint.
 */
export default function update(services: ServerServices): Endpoint {
  return {
    handler: async (request, response): Promise<void> => {
      await services.controller.catchErrors(async () => {
        const { fields } = <Query>request.query;
        const { id, collection, loggedUser } = <Params>request.params;
        const { _id } = loggedUser;
        const resourceId = (collection === 'users' && id === 'me') ? _id : new Id(id);
        const updatedResource = await services.engine.update(collection, resourceId, request.body, {
          fields,
        }, { user: loggedUser });
        // Users need a specific permission to update all other users information.
        if (collection === 'users') {
          if (`${resourceId}` !== `${_id}` && !loggedUser._permissions?.USERS_UPDATE_DETAILS) {
            throw new Forbidden('FORBIDDEN', 'You are not allowed to update this resource.');
          }
        }
        response.send(updatedResource);
      });
    },
  };
}
