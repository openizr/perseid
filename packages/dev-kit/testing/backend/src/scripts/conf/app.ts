/**
 * App configuration.
 */
export default {
  // Mode (development | production).
  mode: process.env.ENV,
  // Server's port.
  port: parseInt(process.env.PLAYGROUND_PORT ?? '3000', 10),
  // Logging options.
  logger: {
    level: (process.env.ENV === 'development') ? 'info' : 'error',
  },
  // Server's options.
  keepAliveTimeout: 2000,
  connectionTimeout: 3000,
  ignoreTrailingSlash: true,
};
