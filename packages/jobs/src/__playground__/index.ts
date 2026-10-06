/* c8 ignore start */

import {
  Telemetry,
  CacheClient,
  type CommandContext,
} from '@perseid/server';
// import { workerData } from 'worker_threads';
import type { JobScript } from 'scripts/core';
import JobScheduler from 'scripts/core/services/JobScheduler';
// import MySQLDatabaseClient from 'scripts/mysql/services/MySQLDatabaseClient';
// import MongoDatabaseClient from 'scripts/mongodb/services/MongoDatabaseClient';
import PostgreSQLDatabaseClient from 'scripts/connectors/postgresql/services/PostgreSQLDatabaseClient';

const telemetry = new Telemetry({ logLevel: 'debug', prettyPrint: true });
const cacheClient = new CacheClient(telemetry, { requestTimeout: 0, cachePath: '/var/www/html/node_modules/.cache' });
const databaseClient = new PostgreSQLDatabaseClient(telemetry, cacheClient, {
  hashAliases: false,
  pools: {
    default: {
      queryTimeout: 3000,
      // host: 'mysql',
      // port: 3306,
      // user: 'root',
      // password: 'Test123!',
      // protocol: 'mysql:',
      // database: 'jobs',
      host: 'postgresql',
      port: 5432,
      user: 'root',
      password: 'Test123!',
      protocol: 'pg:',
      database: 'test',
      // host: 'mongodb',
      // port: 27017,
      // user: null,
      // password: null,
      // protocol: 'mongodb:',
      // database: 'jobs',
      connectTimeout: 2000,
      connectionLimit: 10,
      ssl: false,
    },
  },
});

const jobs: Record<string, JobScript> = {
  testJob: async (taskId, metaData): Promise<void> => {
    await Promise.resolve();
    telemetry.info(`Hello from ${String(taskId)}!`, { lastCompletedAt: String(metaData.lastCompletedAt) });
  },
};

const context = {
  user: {
    _permissions: new Set([
      'VIEW_JOBS',
      'VIEW_TASKS',
      'CREATE_JOBS',
      'CREATE_TASKS',
    ]),
  },
} as CommandContext;

const jobScheduler = new JobScheduler(
  telemetry,
  databaseClient,
  {
    jobs,
    availableSlots: 512,
    // logsPath: '/var/www/html/node_modules/.cache/',
  },
);

// if (workerData === null) {
//   databaseClient.reset()
//     .then(async () => {
(async () => {
  const job = await jobScheduler.create('jobs', {
    requiredSlots: 256,
    maximumExecutionTime: 10,
    scriptPath: '/var/www/html/dist/core.js testJob',
  }, context);

  await jobScheduler.create('tasks', {
    job: job._id,
    metadata: '{}',
    startAt: new Date(),
    recurrence: 10,
    startAfter: null,
  }, context);

  await jobScheduler.run();
})();
//     }).catch((error: unknown) => {
//       telemetry.fatal(error as Error);
//       process.exit(1);
//     });
// } else {
jobScheduler.runTask().catch((error: unknown) => {
  telemetry.fatal(error as Error);
  process.exit(1);
});
// }
