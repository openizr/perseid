/* c8 ignore start */

/**
 * Live, end-to-end testing environment.
 */

import {
  Model,
  Logger,
  CacheClient,
  EmailClient,
  UsersEngine,
  DatabaseClient,
  FastifyController,
  type DefaultDataModel,
} from 'scripts/main';
import fastify, { FastifyBaseLogger } from 'fastify';

const model = new Model<DefaultDataModel>(Model.DEFAULT_MODEL);

const logger = new Logger({ logLevel: 'debug', prettyPrint: true });

const emailClient = new EmailClient(logger);

const cacheClient = new CacheClient({
  cachePath: '/var/www/html/node_modules/.cache',
});

const databaseClient = new DatabaseClient<DefaultDataModel>(model, logger, cacheClient, {
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

const engine = new UsersEngine<DefaultDataModel>(
  model,
  logger,
  databaseClient,
  emailClient,
  cacheClient,
  {
    baseUrl: `http://localhost:${process.env.FRONTEND_EXAMPLES_PORT}`,
    auth: {
      algorithm: 'RS256',
      clientId: 'example',
      issuer: 'example',
      privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIG4wIBAAKCAYEAi8OWC9kddk5KUKlSx2Zvz0vUhIR7oPHss+g8HdRnAUqsgXR8\n2dNwedmhyF5cJWN11DmQ+XYkrlpgpiXPaKwGJjEBtVByXQhO3S9yMwoqI1i9tIZw\nwvJRyNf/ZW5MEQOI1bj+5sCmMLi+kWTgICnSErZa54a+/9brJfXBx+Ti0DoShgpQ\noLpGo2qCjzWpBc7I2/evaF+kV3af+od4XHwhSTW4Sz4dfsmYHqSVUPBoNm//sMXb\ngBuSD4ceRUsb7+r4GnLP6rgktJnfKiPJZFgF5YJOasgHO/HZsxTW1uWBjwbXt/Wk\nSwSTheYV5clJQTdfLZl0uJILAHW4bAqPpORd2vkZXAotW6gFs41F5TRnm79pRFbC\nIz5noLnfumyJ+4N55wEaHAvcrfK9jRpu/bCtX5nvNSp2pQ4MLzSqXESFlCPsT3Wt\ntx+u7BvGD5tSZ7p98v2MfC1OrOzwTmZ0tbgkxnyeXSoeaoRCM9aykHsF63eSdRQD\nE6cdel/8EpNLRqD9AgMBAAECggGAA/48dyNcHovvPsg5APuZ1gXwMQa5oy1zn5KS\n8HWSftHecAa/EBh6Jhppb03WMKGblXVn7AoBKMkUv1J6ZJ7GQIjrEqjVJ6LL4Vu7\nFcm5zqTjq04hrR7avClYVufJ57zeh9//SmJL1+hYq33taFssMRQsMIwOlhp9a+oj\nqp13vHltm45HuPExgPbopYT5NV0FK0GzmCtkCOAEWJZObPKv9G/tj3AbdsqgMb9D\n3oThLq2lqWwxu1fY+mAYJY8sjGl9uTErl5f6hoXqiThsYWqPlWbxZSSElnit5+d7\nAhKqH1Fb8hT6Kw18nMT5hsAn9ANi6QFKRxME/q1IGXO/cDzfmFa6nG+J06RxOG+U\n5dpErPN01hpxavywNEZM9rlzgtsXukvfoEDG+KoU0oE8m9UF/zbkQJGuzAaZyj+P\n3GGb0HFfMr7XdIYJBZmUnNZu1PcVgGYmoWksFl3x5Ky7CGtoJoSZr/KKd5OVqKuE\ntwrxJDDT2eBSpnamW508EPlyDiwRAoHBALrRGFCfBOaueXysUKItYDqV8HA8asxu\ny/y3w/XYamxisZX6Lf+F+ysG/vCWE++b6K2yYCfLV04+Z7e2Mvekeo9w1bTiLH5T\nZ6mrJgXmAwKjuphIH2pgN/YBhbuTtKvACTqJf2LbWimleA0VXYVPHScMq5cJB5si\nDCsvfiq0FolGAmnjR39LojBgEE6cNk6v4JFUgUfd+jHcpabZYpzJy1y4KrLYRcI7\nKYlbPlAjbyf77GcYyUT87WFIARA6y3zi7QKBwQC/hbf/sgrlqPzoRiKz4x5xjbQi\nxrYynIjmCbsnR5p1fFabz9Yh+nFDWtP0xrzArnGJF7QGPIkDGyt2G51cB0YU5t8D\nwN4xOsAH1jT1jsj3p+tkIzWX9d6v50tUI4flgU0M0cKbJZBvrCWTPnEQP9yvJnz3\naEkJKT4NEGcvdefi0O24ZxaKBaxqzYL+6fC2yMPZIl5s3CF9U5drNKbXalimD8Hl\n1LB03wCXRXnk5kFxSIgkRBhIX9vF4shQVRmPpFECgcApwf02YCUfTxaWuImZhp0A\n220QGWEh6w4rogPqWwKG0ZSyWmaXvCIFXx3zNwijwWzEDqARpRERyz8xwEcqNZiz\noVwTf47Eee4s7bWlEeHQYDqgOVbUV0eK9JIo+H4k+drWO8++kBtaPcNU4VazKpjw\nlpNwQjNyCK1Bpe8EqpZy/rQhaQ0dNhG90Gs0txQoiIWg1ovDPankJVbdsa+qLi0H\nv57DtTX6kXDaZAvMq+73uAcCkHbEteh1mzupngrIEo0CgcEAmPEAqYkVWKblJ9ty\nNPLGyeleE3NZ5frI++KDeO+eMfnT8+M53bJwJlhu8IaQDtJ/SfoKwfwvcbKNt2h/\n9hC8704ag5XOGcQPu3Jcokeext5qhHH1h19JsHDk39Dr4eOqkvUjEeAignsXGol/\nonlNEvWKT8wQnuc3bRlPPUBLp/4uB9cS0a+MK1HoLQbGOkEC3O+sNgRoHfvV7D+E\niHudRSdKMO3y57F5eFN77sXNNti0Fznlpk4eY90hF72Nhv6xAoHAVISSi4T6XDVo\n1OPNhQcc3JTzMKE4FjCTnYkE7w77fM26rcJbC1LkXnLq4PustC1z26tHJlYn3nL0\nwK8Dp5JXfIiizt/hFZOc3mFd449BctZoTltmxLemKdOOkWqFWzmUu+aiDLR3FVIt\nTUcc2LOAPEC3+ePAVxat5rBmsLNKxJkVo+h8fuW7ncWihhsKrmYnf4H6RvpuSj5O\n6iX5ubz53VpYgjKf2ebZjjnBR+OeufD377OzY7/uRLdaJf22p1RW\n-----END RSA PRIVATE KEY-----',
      publicKey: '-----BEGIN RSA PUBLIC KEY-----\nMIIBigKCAYEAi8OWC9kddk5KUKlSx2Zvz0vUhIR7oPHss+g8HdRnAUqsgXR82dNw\nedmhyF5cJWN11DmQ+XYkrlpgpiXPaKwGJjEBtVByXQhO3S9yMwoqI1i9tIZwwvJR\nyNf/ZW5MEQOI1bj+5sCmMLi+kWTgICnSErZa54a+/9brJfXBx+Ti0DoShgpQoLpG\no2qCjzWpBc7I2/evaF+kV3af+od4XHwhSTW4Sz4dfsmYHqSVUPBoNm//sMXbgBuS\nD4ceRUsb7+r4GnLP6rgktJnfKiPJZFgF5YJOasgHO/HZsxTW1uWBjwbXt/WkSwST\nheYV5clJQTdfLZl0uJILAHW4bAqPpORd2vkZXAotW6gFs41F5TRnm79pRFbCIz5n\noLnfumyJ+4N55wEaHAvcrfK9jRpu/bCtX5nvNSp2pQ4MLzSqXESFlCPsT3Wttx+u\n7BvGD5tSZ7p98v2MfC1OrOzwTmZ0tbgkxnyeXSoeaoRCM9aykHsF63eSdRQDE6cd\nel/8EpNLRqD9AgMBAAE=\n-----END RSA PUBLIC KEY-----',
    },
  },
);

const controller = new FastifyController<DefaultDataModel>(model, logger, engine, {
  version: '0.0.1',
  endpoints: {
    auth: {
      signUp: { path: '/auth/sign-up' },
      signIn: { path: '/auth/sign-in' },
      signOut: { path: '/auth/sign-out' },
      verifyEmail: { path: '/auth/verify-email' },
      refreshToken: { path: '/auth/refresh-token' },
      resetPassword: { path: '/auth/reset-password' },
      requestPasswordReset: { path: '/auth/reset-password' },
      requestEmailVerification: { path: '/auth/verify-email' },
    },
    collections: {
      roles: {
        list: { path: '/roles', maximumDepth: 6 },
        create: { path: '/roles' },
        view: { path: '/roles/:id' },
        update: { path: '/roles/:id' },
        search: { path: '/roles/:id' },
        delete: { path: '/roles/:id' },
      },
      users: {
        list: { path: '/users' },
        create: { path: '/users' },
        view: { path: '/users/:id' },
        update: { path: '/users/:id' },
        delete: { path: '/users/:id' },
        search: { path: '/users/search' },
      },
    },
  },
});

async function main(): Promise<void> {
  if (process.argv.includes('--reset')) {
    await engine.reset('test@test.test', 'Hello123!');
    process.exit(0);
  } else {
    await databaseClient.checkIntegrity();

    const app = fastify({
      ignoreTrailingSlash: true,
      logger: logger.child() as FastifyBaseLogger,
    });

    // Handles CORS.
    app.addHook('onRequest', async (request, response) => {
      response.header('Access-Control-Allow-Origin', '*');
      response.header('Access-Control-Allow-Headers', '*');
      response.header('Access-Control-Allow-Methods', '*');
      if (request.method === 'OPTIONS') {
        await response.status(200).send();
      }
    });

    app.get('/hello', {
      handler: async (_request, response) => {
        await response.status(200).send('HELLO WORLD!');
      },
    });

    await controller.createEndpoints(app, { prefix: '/perseid' });

    app.listen({ port: parseInt(String(process.env.BACKEND_EXAMPLES_PORT), 10), host: '0.0.0.0' }, (error) => {
      if (error) {
        logger.fatal(error);
        process.exit(1);
      }
    });
  }
}

main().catch((error) => {
  logger.fatal(error);
  process.exit(1);
});
