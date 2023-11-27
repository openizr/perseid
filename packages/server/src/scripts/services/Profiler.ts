/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as os from 'os';

/**
 * CPU average load.
 */
export interface CpuLoad {
  idle: number;
  total: number;
}

/**
 * Snapshot metrics.
 */
export interface Measurement {
  name: string;
  memory: number;
  elapsedTime: number;
  cpuAverage: {
    idle: number;
    total: number;
  };
}

/**
 * Provides performance measurement tools (execution time, memory, ...).
 */
export default class Profiler {
  /** Profiling start timestamp. */
  private startTimestamp: number;

  /** Profiling start average CPU load. */
  private startCpuAverageLoad: CpuLoad;

  /** List of measurements for current profiling. */
  private measurements: Measurement[];

  /**
   * Class constructor.
   */
  public constructor() {
    this.startTimestamp = 0;
    this.measurements = [];
    this.startCpuAverageLoad = { idle: 0, total: 0 };
  }

  /**
   * Formats the given profiler metrics into a human-readable string.
   *
   * @param metrics Profiler metrics.
   *
   * @returns Formatted metrics.
   */
  public static formatMetrics(metrics: Measurement[]): string {
    const formattedMetrics = metrics.map((measurement) => `Snapshot Name: ${measurement.name}\nMemory used: ${measurement.memory.toFixed(3)} Mb\nElapsed time: ${measurement.elapsedTime} ms\nAverage CPU load: ${((1 - (measurement.cpuAverage.idle / measurement.cpuAverage.total)) * 100).toFixed(2)}%`).join('\n----\n');
    return `\n\n---------------------------\n\nPERFORMANCE REPORT\n\n---------------------------\n\n${formattedMetrics}`;
  }

  /**
   * Computes current CPU average load.
   * See https://gist.github.com/GaetanoPiazzolla/c40e1ebb9f709d091208e89baf9f4e00.
   *
   * @returns Current CPU average load.
   */
  public static getCpuAverageLoad(): CpuLoad {
    let totalIdle = 0;
    let totalTick = 0;
    const cpus = os.cpus();

    // Looping through CPU cores...
    for (let i = 0, len = cpus.length; i < len; i += 1) {
      const cpu = cpus[i];
      totalTick += cpu.times.user + cpu.times.sys + cpu.times.idle;
      totalIdle += cpu.times.idle;
    }

    return { idle: totalIdle / cpus.length, total: totalTick / cpus.length };
  }

  /**
   * Resets profiling.
   */
  public reset(): void {
    this.startTimestamp = Date.now();
    this.measurements = [];
    this.startCpuAverageLoad = Profiler.getCpuAverageLoad();
  }

  /**
   * Creates a snapshot of current performance metrics under the given name.
   *
   * @param name Snapshot name.
   */
  public snapshot(name: string): void {
    const currentCpuAverageLoad = Profiler.getCpuAverageLoad();
    this.measurements.push({
      name,
      memory: process.memoryUsage().heapUsed / 1024 / 1024,
      elapsedTime: (Date.now() - this.startTimestamp),
      cpuAverage: {
        idle: (currentCpuAverageLoad.idle - this.startCpuAverageLoad.idle) || 1,
        total: (currentCpuAverageLoad.total - this.startCpuAverageLoad.total) || 1,
      },
    });
  }

  /**
   * Returns collected performance metrics for the current profiling session.
   *
   * @returns Collected metrics.
   */
  public getMetrics(): Measurement[] {
    this.snapshot('TOTAL');
    return this.measurements;
  }
}
