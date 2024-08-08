/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import HttpError from 'scripts/core/errors/Http';

/**
 * HTTP 413 error.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/server/src/scripts/core/errors/RequestEntityTooLarge.ts
 */
export default class RequestEntityTooLarge extends HttpError { }
