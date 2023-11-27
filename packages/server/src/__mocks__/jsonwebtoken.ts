/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `jsonwebtoken` mock.
 */

class JsonWebTokenError {
  protected mock = vi.fn();
}
class TokenExpiredError {
  protected mock = vi.fn();
}

export default {
  JsonWebTokenError,
  TokenExpiredError,
  sign: vi.fn(() => 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9'),
  verify: vi.fn(() => ({ sub: '64723318e84f943f1ad6578b_test' })),
};
