import testJob from 'scripts/testJob';
import { CacheClient, Logger, BucketClient } from '@perseid/server';
import { JobScheduler, DatabaseClient, JobSchedulerSettings } from '@perseid/jobs';


const logger = new Logger({ logLevel: 'info', prettyPrint: true });
const bucketClient = new BucketClient(logger);
const configuration: JobSchedulerSettings = {
  jobs: { testJob },
  availableSlots: 512,
  logs: {
    path: '/var/www/html/jobs/dist/',
    prettyPrint: true,
    logLevel: 'info',
  }
};

const databaseClient = new DatabaseClient(logger, new CacheClient(), {
  host: 'mongodb',
  port: 27017,
  user: null,
  password: null,
  protocol: 'mongodb:',
  database: 'test',
  connectTimeout: 2000,
  cacheDuration: 0,
  maxPoolSize: 2,
  connectionLimit: 10,
  queueLimit: 0,
});

const jobSchedulerOne = new JobScheduler(logger, databaseClient, bucketClient, configuration);
const jobSchedulerTwo = new JobScheduler(logger, databaseClient, bucketClient, configuration);

async function main() {
  await databaseClient.reset();
  const job = await jobSchedulerOne.create('jobs', {
    maximumExecutionTime: 10,
    requiredSlots: 256,
    scriptPath: '/var/www/html/jobs/dist/runJob.js testJob'
  }, {}, {});
  await jobSchedulerOne.create('tasks', {
    job: job._id,
    metaData: '{}',
    startAt: new Date(),
    recurrence: 10,
    startAfter: null,
  }, {}, {});

  jobSchedulerOne.run();
  jobSchedulerTwo.run();
}

main();