/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { type User } from '@perseid/core';

interface Body {
  query: {
    on: string[];
    text: string;
  };
  filters: {
    [fieldPath: string]: string | string[];
  };
}

interface Params {
  loggedUser: User;
  collection: string;
}

/**
 * `POST /:collection/search` endpoint handler.
 *
 * @param services Available internal services.
 *
 * @returns Actual fastify endpoint.
 */
export default function search(services: ServerServices): Endpoint {
  return {
    handler: async (request, response): Promise<void> => {
      await services.controller.catchErrors(async () => {
        const { collection } = <Params>request.params;
        const { query, filters } = <Body>request.body;
        const results = await services.engine.search(collection, { query, filters }, request.query);
        response.send(results);
      });
    },
  };
}
