/* c8 ignore start */

import {
  Logger,
  CacheClient,
  BucketClient,
  type CommandContext,
} from '@perseid/server';
import { workerData } from 'worker_threads';
import JobScheduler from 'scripts/services/JobScheduler';
import DatabaseClient from 'scripts/services/DatabaseClient';

const logger = new Logger({ logLevel: 'info', prettyPrint: true });
const bucketClient = new BucketClient(logger);
const databaseClient = new DatabaseClient(logger, new CacheClient({
  cachePath: '/var/www/html/node_modules/.cache',
}), {
  host: 'mongaodb',
  port: 27017,
  user: null,
  password: null,
  protocol: 'mongodb:',
  database: 'jobs',
  connectTimeout: 2000,
  cacheDuration: 0,
  maxPoolSize: 2,
  connectionLimit: 10,
  queueLimit: 0,
});

const jobs: Record<string, JobScript> = {
  testJob: async (taskId, metaData, log): Promise<void> => {
    await Promise.resolve();
    log.info(`Hello from ${taskId}!`);
    log.info(metaData.lastCompletedAt);
  },
};

const jobScheduler = new JobScheduler(
  logger,
  databaseClient,
  bucketClient,
  {
    jobs,
    availableSlots: 512,
    logsPath: '/var/www/html/node_modules/.cache',
  },
);

if (workerData === null) {
  databaseClient.reset()
    .then(async () => {
      const job = await jobScheduler.create('jobs', {
        requiredSlots: 256,
        maximumExecutionTime: 10,
        scriptPath: '/var/www/html/dist/main.js testJob',
      }, {}, {} as CommandContext);

      await jobScheduler.create('tasks', {
        job: job._id,
        metaData: '{}',
        startAt: new Date(),
        recurrence: 10,
        startAfter: null,
      }, {}, {} as CommandContext);

      await jobScheduler.run();
    }).catch((error) => {
      logger.fatal(error);
      process.exit(1);
    });
} else {
  JobScheduler.runJob(jobs, '/var/www/html/node_modules/.cache', 'debug').catch((error) => {
    logger.fatal(error);
    process.exit(1);
  });
}
