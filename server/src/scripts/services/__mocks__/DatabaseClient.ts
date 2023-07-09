/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Id } from '@perseid/core';

/**
 * `services/DatabaseClient` mock.
 */

export default class {
  public create = vi.fn(() => ({ _id: new Id('64723318e84f943f1ad6578b') }));

  public update = vi.fn();

  public reset = vi.fn();

  public checkFields = vi.fn();

  public checkForeignIds = vi.fn();

  public checkIntegrity = vi.fn();

  public view = vi.fn(() => ((process.env.NO_RESULT === 'true')
    ? null
    : ({ _id: new Id('64723318e84f943f1ad6578b') })));

  public delete = vi.fn(() => process.env.NO_RESULT !== 'true');

  public search = vi.fn((collection) => {
    if (process.env.NO_RESULT === 'true') {
      return { total: 0, results: [] };
    }
    if (collection === 'users') {
      return {
        total: 1,
        results: [
          {
            _id: new Id('64723318e84f943f1ad6578b'),
            _devices: [{
              id: '64723318e84f943f1ad6578c',
            }],
          },
        ],
      };
    }
    return {
      total: 1,
      results: [
        {
          _id: new Id('64723318e84f943f1ad6578b'),
          _devices: [{
            id: '64723318e84f943f1ad6578c',
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
            _id: new Id('64723318e84f943f1ad6578b'),
            _devices: [{
              id: 'test',
            }],
          },
        ],
      };
    }
    return {
      total: 1,
      results: [
        {
          _id: new Id('64723318e84f943f1ad6578b'),
          _devices: [{
            id: 'test',
          }],
        },
      ],
    };
  });
}
