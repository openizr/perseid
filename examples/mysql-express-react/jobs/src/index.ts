import { type JobScript } from '@perseid/jobs';

const jobs: Record<string, JobScript> = {
  testJob: async (taskId, metaData, log): Promise<void> => {
    await Promise.resolve();
    log.info(`Hello from ${String(taskId)}!`);
    log.info(metaData.lastCompletedAt);
  },
};

import MySQLDatabaseClient from '@perseid/jobs/mysql';
import { JobScheduler, type DataModel } from '@perseid/jobs';
import { Logger, CacheClient, BucketClient } from '@perseid/server';

// The Logger service logs any useful information happening in the main thread or in tasks, either
// for debugging or monitoring. Most services have access to this logger.
const logger = new Logger({ logLevel: 'info', prettyPrint: true });

// CacheClient can be used to store data in cache for a given period of time.
const cacheClient = new CacheClient({
  cachePath: '/var/www/html/node_modules/.cache',
  connectTimeout: 0,
});

// BucketClient is responsible for uploading tasks logs files to a remote bucket.
// By default, its methods are not implemented, meaning no file will be uploaded, and information
// will simply be logged. You will need to extend this service with a provider specific
// implementation (S3, Minio, ...).
const bucketClient = new BucketClient(logger, { connectTimeout: 3000 });

// This service provides a unified interface with the underlying DBMS to perform CRUD operations,
// and is totally interchangeable with other DatabaseClient implementations (PostgreSQL, MongoDB, ...).
const databaseClient = new MySQLDatabaseClient(logger, cacheClient, {
  host: 'mysql',
  port: 3306,
  user: 'root',
  password: 'Test123!',
  protocol: 'mysql:',
  database: 'jobs',
  connectTimeout: 2000,
  connectionLimit: 10,
});

// Actual JobScheduler service, responsible for managing pending and running tasks
const jobScheduler = new JobScheduler(
  logger,
  databaseClient,
  bucketClient,
  {
    jobs,
    availableSlots: 512,   // How many slots are available for this job scheduler.
    logsPath: '/var/www/html/node_modules/.cache/', // Directory where our tasks logs will be temporarily stored.
  },
);

import { workerData } from 'worker_threads';
import { type CommandContext } from '@perseid/server';

// `workerData` is null, meaning we are in the main thread...
if (workerData === null) {
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

  // Resetting database...
  databaseClient.reset()
    .then(async () => {
      // Registering our first job in database...
      const job = await jobScheduler.create('jobs', {
        maximumExecutionTime: 10,                          // After this duration (in seconds), the task will time out.
        requiredSlots: 256,                                // How many slots are required to run this job?
        scriptPath: '/var/www/html/dist/index.js testJob', // The path to the `index.js` script we created earlier.
      }, {}, context);

      // Registering a new task in database, that should execute this job right now...
      await jobScheduler.create('tasks', {
        job: job._id,
        metadata: '{}',       // Put any stringify JSON here.
        startAt: new Date(),  // When should the task start?
        recurrence: 10,       // This task will run every ten seconds.
        startAfter: null,     // We don't want this task to run after another one.
      }, {}, context);

      // Running job scheduler...
      await jobScheduler.run();
    }).catch((error: unknown) => {
      logger.fatal(error);
      process.exit(1);
    });
}
// `workerData` is not null, meaning we are in a task thread...
else {
  // Running job script...
  JobScheduler.runJob(jobs, '/var/www/html/node_modules/.cache', 'debug').catch((error: unknown) => {
    logger.fatal(error);
    process.exit(1);
  });
}