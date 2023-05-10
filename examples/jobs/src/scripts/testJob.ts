import { JobScript } from '@perseid/jobs';

export default <JobScript>(async (taskId, metaData, logger) => {
  logger.info(`Hello from ${taskId}!`);
  logger.info(metaData.lastCompletedAt);
})