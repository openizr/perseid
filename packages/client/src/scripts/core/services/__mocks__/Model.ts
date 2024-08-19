/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `scripts/core/services/Model` mock.
 */

export default class Model {
  public update = vi.fn();

  public get = vi.fn((path: string) => {
    if (path === 'users') {
      return {
        schema: {
          fields: {
            _id: { type: 'id' },
            roles: { type: 'array', fields: { type: 'id' } },
          },
        },
      };
    }
    if (path === 'users._id') {
      return {
        canonicalPath: ['users'],
        schema: { type: 'id' },
      };
    }
    if (path === 'users._verifiedAt') {
      return {
        canonicalPath: ['users', '_verifiedAt'],
        schema: { type: 'date' },
      };
    }
    if (path === 'users.password') {
      return {
        canonicalPath: ['users', 'password'],
        schema: { type: 'string' },
      };
    }
    if (path === 'users.roles') {
      return {
        canonicalPath: ['users', 'roles'],
        schema: { type: 'array' },
      };
    }
    return null;
  });
}
