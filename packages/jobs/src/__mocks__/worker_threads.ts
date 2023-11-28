/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/** `worker_threads` mock. */

export const workerData = {};
export const Worker = vi.fn((_path, data) => {
  const registry: ((argument?: Error | number) => void)[] = [];
  return ({
    terminate: vi.fn(),
    on: vi.fn((_event, callback: () => void) => {
      registry.push(callback);
      if (registry.length === 3) {
        const exitCodes: Record<string, number> = {
          '626adcd0bfffbd0fec9e1664': 0,
          '626adcd0bfffbd0fec9e1668': 100,
          '626adcd0bfffbd0fec9e1666': 1,
        };
        setTimeout(() => {
          registry[0](); // `online` event.
          if ((data as { workerData: { id: string; } }).workerData.id === '626adcd0bfffbd0fec9e1666') {
            registry[1](new Error('Test')); // `error` event.
          }
          // `exit` event.
          registry[2](exitCodes[(data as { workerData: { id: string; } }).workerData.id]);
        });
      }
    }),
  });
});
