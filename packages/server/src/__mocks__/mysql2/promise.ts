/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `mysql2/promise` mock.
 */

const connection = {
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  release: vi.fn(),
  rollback: vi.fn(),
  query: vi.fn(),
  execute: vi.fn(() => {
    if (process.env.DATABASE_ERROR === 'true') {
      throw new Error('ERROR');
    }
    if (process.env.NO_RESULT === 'true') {
      return [{ __total: 0 }];
    }
    return [{ affectedRows: 1 }];
  }),
};

export default {
  createPool: vi.fn(() => ({
    getConnection: vi.fn(() => connection),
    query: vi.fn((sqlQuery) => {
      if (sqlQuery === 'SHOW TABLES;') {
        return [[{ _config: 1 }]];
      }
      if (process.env.NO_RESULT === 'true') {
        return [[{ __total: 10, _id: null }]];
      }
      return [[{ __total: 10, _id: '000000000000000000000001' }]];
    }),
    execute: vi.fn(() => {
      if (process.env.DATABASE_ERROR === 'true') {
        throw new Error('ERROR');
      }
      if (process.env.NO_RESULT === 'true') {
        return [[{ __total: 10, _id: null }]];
      }
      return [[{ __total: 10, _id: '000000000000000000000001' }]];
    }),
  })),
};
