import testJob from 'scripts/testJob';
import { JobScheduler, DatabaseClient } from '@perseid/jobs';
import { CacheClient, Logger, BucketClient } from '@perseid/server';


const logger = new Logger({ logLevel: 'info', prettyPrint: true });
const bucketClient = new BucketClient(logger);

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

const jobScheduler = new JobScheduler(logger, databaseClient, bucketClient, {
  jobs: { testJob },
  availableSlots: 512,
  logsPath: '/var/www/html/jobs/dist/',
});
// If you want to test load balancing...
// const jobSchedulerTwo = new JobScheduler(logger, databaseClient, bucketClient, {
//   jobs: { testJob },
//   availableSlots: 512,
//   logsPath: '/var/www/html/jobs/dist/',
// });

jobScheduler.run();
// jobSchedulerTwo.run();

