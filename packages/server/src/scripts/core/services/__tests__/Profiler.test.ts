/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Profiler from 'scripts/core/services/Profiler';

describe('core/services/Profiler', () => {
  vi.setSystemTime(new Date(2022, 0, 1));
  const memoryUsage = (): {
    rss: number;
    heapUsed: number;
    external: number;
    heapTotal: number;
    arrayBuffers: number;
  } => ({
    heapUsed: 10 * 1024 * 1024,
    rss: 0,
    external: 0,
    heapTotal: 0,
    arrayBuffers: 0,
  });
  memoryUsage.rss = vi.fn();
  vi.spyOn(process, 'memoryUsage').mockImplementation(memoryUsage);
  vi.mock('os', () => ({
    cpus: vi.fn(() => [{
      model: '',
      speed: 0,
      times: {
        user: 0,
        sys: 0,
        idle: 0,
        nice: 1000,
        irq: 2000,
      },
    }]),
  }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('formatMetrics', () => {
    expect(Profiler.formatMetrics([
      {
        cpuAverage: {
          idle: 3000,
          total: 3000,
        },
        elapsedTime: 1640995200000,
        memory: 10,
        name: 'TOTAL',
      },
    ])).toBe(
      '\n\n---------------------------\n\nPERFORMANCE REPORT\n\n------------'
      + '---------------\n\nSnapshot Name: TOTAL\nMemory used: 10.000 Mb\nElapsed time: 16409952'
      + '00000 ms\nAverage CPU load: 0.00%',
    );
  });

  test('getCpuAverageLoad', () => {
    expect(Profiler.getCpuAverageLoad()).toEqual({
      idle: 0,
      total: 0,
    });
  });

  test('getMetrics', () => {
    const profiler = new Profiler();
    expect(profiler.getMetrics()).toEqual([
      {
        cpuAverage: {
          idle: 1,
          total: 1,
        },
        elapsedTime: 1640995200000,
        memory: 10,
        name: 'TOTAL',
      },
    ]);
  });

  test('reset', () => {
    const profiler = new Profiler();
    profiler.snapshot('TEST');
    profiler.snapshot('TEST2');
    profiler.reset();
    expect(profiler.getMetrics()).toEqual([
      {
        cpuAverage: {
          idle: 1,
          total: 1,
        },
        elapsedTime: 0,
        memory: 10,
        name: 'TOTAL',
      },
    ]);
  });
});
