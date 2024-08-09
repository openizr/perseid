/* c8 ignore start */

import {
  Logger,
  CacheClient,
  BucketClient,
  type CommandContext,
} from '@perseid/server';
import { workerData } from 'worker_threads';
import JobScheduler from 'scripts/core/services/JobScheduler';
// import MySQLDatabaseClient from 'scripts/mysql/services/MySQLDatabaseClient';
// import MongoDatabaseClient from 'scripts/mongodb/services/MongoDatabaseClient';
import PostgreSQLDatabaseClient from 'scripts/postgresql/services/PostgreSQLDatabaseClient';

const logger = new Logger({ logLevel: 'info', prettyPrint: true });
const bucketClient = new BucketClient(logger, { connectTimeout: 3000 });
const cacheClient = new CacheClient({ connectTimeout: 0, cachePath: '/var/www/html/node_modules/.cache' });
const databaseClient = new PostgreSQLDatabaseClient(logger, cacheClient, {
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
});

const jobs: Record<string, JobScript> = {
  testJob: async (taskId, metaData, log): Promise<void> => {
    await Promise.resolve();
    log.info(`Hello from ${String(taskId)}!`);
    log.info(metaData.lastCompletedAt);
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
} as CommandContext<DataModel>;

const jobScheduler = new JobScheduler(
  logger,
  databaseClient,
  bucketClient,
  {
    jobs,
    availableSlots: 512,
    logsPath: '/var/www/html/node_modules/.cache/',
  },
);

if (workerData === null) {
  databaseClient.reset()
    .then(async () => {
      const job = await jobScheduler.create('jobs', {
        requiredSlots: 256,
        maximumExecutionTime: 10,
        scriptPath: '/var/www/html/dist/core.js testJob',
      }, {}, context);

      await jobScheduler.create('tasks', {
        job: job._id,
        metadata: '{}',
        startAt: new Date(),
        recurrence: 10,
        startAfter: null,
      }, {}, context);

      await jobScheduler.run();
    }).catch((error: unknown) => {
      logger.fatal(error);
      process.exit(1);
    });
} else {
  JobScheduler.runJob(jobs, '/var/www/html/node_modules/.cache', 'debug').catch((error: unknown) => {
    logger.fatal(error);
    process.exit(1);
  });
}
