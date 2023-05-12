import testJob from 'scripts/testJob';
import { JobScheduler } from '@perseid/jobs';

JobScheduler.runJob({ testJob }, '/var/www/html/jobs/dist/', 'debug');
