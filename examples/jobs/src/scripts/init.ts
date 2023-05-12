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

// Now things get interesting:
// 1. We reset our database.
databaseClient.reset()
  .then(async () => {
    // 2. We register our first job in DB.
    const job = await jobScheduler.create('jobs', {
      maximumExecutionTime: 10,                           // After this duration (in seconds), the task will time out.
      requiredSlots: 256,                                 // How many slots are required to run this job?
      scriptPath: '/var/www/html/jobs/dist/runJob.js testJob', // The path to the `runJob.ts` script we created earlier.
    }, {}, {});

    // 3. We register a new task in DB, that should execute this job right now.
    await jobScheduler.create('tasks', {
      job: job._id,
      metaData: '{}',       // Put any stringify JSON here.
      startAt: new Date(),  // When should the task start?
      recurrence: 10,       // This task will run every ten seconds.
      startAfter: null,     // We don't want this task to run after another one.
    }, {}, {});

    import('./main');
  });