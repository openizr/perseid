import Ajv from 'ajv';
import fastify from 'fastify';
import ajvErrors from 'ajv-errors';
import configuration from 'scripts/conf/app';
import declareRoutes from 'scripts/conf/routes';

// Initializing validator compiler...
const ajv = new Ajv({ allErrors: true });
ajvErrors(ajv);

// Initializing fastify server...
const app = fastify({
  logger: configuration.logger,
  keepAliveTimeout: configuration.keepAliveTimeout,
  connectionTimeout: configuration.connectionTimeout,
  ignoreTrailingSlash: configuration.ignoreTrailingSlash,
});

// Handles CORS in development mode.
if (configuration.mode === 'development') {
  app.addHook('onSend', (_request, response, _payload, next) => {
    response.header('Access-Control-Allow-Origin', '*').then(() => {
      next(null, _payload);
    }, () => null);
  });
}

// Applies custom validator compiler.
app.setValidatorCompiler(({ schema }) => (
  ajv.compile(schema)
));

// Adding app routes...
declareRoutes(app).catch((error) => {
  app.log.fatal(error);
  process.exit(1);
});

// Starting server...
app.listen({ port: configuration.port, host: '0.0.0.0' }, (error) => {
  if (error) {
    app.log.fatal(error);
    process.exit(1);
  }
});
