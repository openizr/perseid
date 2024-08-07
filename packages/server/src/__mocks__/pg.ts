/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `pg` mock.
 */

const connection = {
  end: vi.fn(),
  connect: vi.fn(),
  release: vi.fn(),
  query: vi.fn((sqlQuery: string) => {
    if (sqlQuery.startsWith('SELECT table_schema')) {
      return { rows: [{ table_name: '_config' }] };
    }
    if (process.env.MISSING_FOREIGN_IDS === 'true') {
      return { rows: [] };
    }
    if (process.env.NO_RESULT === 'true') {
      return { rowCount: 0, rows: [{ __total: 0, _id: null }] };
    }
    if (process.env.DATABASE_ERROR === 'true' && sqlQuery !== 'BEGIN' && sqlQuery !== 'ROLLBACK') {
      throw new Error('ERROR');
    }
    return { rowCount: 1, rows: [{ __total: 10, _id: '000000000000000000000001' }] };
  }),
};

connection.connect = vi.fn(() => connection);

export default {
  Pool: vi.fn(() => connection),
};
