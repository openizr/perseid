/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `fastify` mock.
 */

export default vi.fn(() => ({
  get: vi.fn(),
  listen: vi.fn(),
  addHook: vi.fn(),
  register: vi.fn(),
}));
