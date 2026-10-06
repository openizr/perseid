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

type Handler = (...args: unknown[]) => void;

type QueryResult = Promise<{ rowCount: number | null; rows: Record<string, unknown>[]; }>;

type Query = (sqlQuery: string, values?: unknown[]) => QueryResult;

/**
 * Registered pool events handlers, exposed so that tests can simulate pool events.
 */
export const handlers: Record<string, Handler | undefined> = {};

/**
 * Simulates the `event` pool event.
 *
 * @param event Event to simulate.
 *
 * @param args Arguments to pass to the event handler.
 */
export const emit = (event: string, ...args: unknown[]): void => {
  handlers[event]?.(...args);
};

/**
 * Connection acquired from the pool, used to run queries within a transaction.
 */
export const poolClient = {
  release: vi.fn(),
  query: vi.fn<Query>(() => Promise.resolve({
    rowCount: 1,
    rows: [{ __total: '10', _id: '000000000000000000000001' }],
  })),
};

/**
 * Connections pool. The same instance is always returned, so that tests can assert on it without
 * having to get hold of the one the tested class created.
 */
export const pool = {
  totalCount: 3,
  idleCount: 1,
  waitingCount: 2,
  end: vi.fn(() => Promise.resolve()),
  query: poolClient.query,
  connect: vi.fn(() => Promise.resolve(poolClient)),
  on: vi.fn((event: string, handler: Handler) => { handlers[event] = handler; }),
};

export const Pool = vi.fn(() => pool);

export default { Pool };
