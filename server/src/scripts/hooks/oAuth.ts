/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { FastifyRequest } from 'fastify';
import Controller from 'scripts/services/Controller';

/**
 * Handles users authentication.
 *
 * @param services Available internal services.
 *
 * @param configuration Perseid server configuration.
 *
 * @returns Actual fastify hook.
 */
export default function oAuth(
  controller: Controller,
  configuration: ServerConfiguration,
): Endpoint['handler'] {
  return async (request: FastifyRequest): Promise<void> => {
    const deviceId = request.headers['x-device-id'];
    // We need to store device ID in params as soon as possible to provide it to errors handler.
    (<OAuthParams>request.params).deviceId = <string>deviceId;
    // TODO check strict match endpoints (make sure the url ends up with these paths, not only
    // contains)
    const ignoreExpiration = (
      (
        typeof configuration.endpoints.signOut?.path === 'string'
        && request.url.indexOf(configuration.endpoints.signOut.path) >= 0
      )
      || (
        typeof configuration.endpoints.refreshToken?.path === 'string'
        && request.url.indexOf(configuration.endpoints.refreshToken.path) >= 0
      )
    );
    (<OAuthParams>request.params).loggedUser = await controller.oAuth(
      request.headers,
      ignoreExpiration,
    );
  };
}
