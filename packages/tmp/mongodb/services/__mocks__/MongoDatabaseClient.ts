/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Id } from '@perseid/core';

/**
 * `mongodb/services/MongoDatabaseClient` mock.
 */

export default class {
  public create = vi.fn(() => ({ _id: new Id('000000000000000000000004') }));

  public update = vi.fn(() => (process.env.NO_RESULT !== 'true'));

  public reset = vi.fn();

  public checkFields = vi.fn();

  public checkForeignIds = vi.fn();

  public checkIntegrity = vi.fn();

  public view = vi.fn(() => ((process.env.NO_RESULT === 'true')
    ? null
    : ({
      _id: new Id('000000000000000000000001'),
      roles: [{
        name: 'TEST',
        permissions: ['TEST'],
      }],
    })));

  public delete = vi.fn(() => (process.env.NO_RESULT !== 'true'));

  public search = vi.fn((collection) => {
    if (process.env.NO_RESULT === 'true') {
      return { total: 0, results: [] };
    }
    if (collection === 'users') {
      return {
        total: 1,
        results: [
          {
            _id: new Id('000000000000000000000001'),
            _devices: [{
              _id: '000000000000000000000009',
            }],
          },
        ],
      };
    }
    return {
      total: 1,
      results: [
        {
          _id: new Id('000000000000000000000001'),
          _devices: [{
            _id: '000000000000000000000009',
          }],
        },
      ],
    };
  });

  public list = vi.fn((collection) => {
    if (collection === 'users') {
      return {
        total: 1,
        results: [
          {
            _id: new Id('000000000000000000000001'),
            _devices: [{
              _id: 'test',
            }],
          },
        ],
      };
    }
    return {
      total: 1,
      results: [
        {
          _id: new Id('000000000000000000000001'),
          _devices: [{
            _id: 'test',
          }],
        },
      ],
    };
  });
}
