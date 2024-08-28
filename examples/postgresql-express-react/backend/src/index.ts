import { Model } from '@perseid/server';
import type { DataModelSchema } from '@perseid/core';

const dataModelSchema: DataModelSchema<DataModel> = {
  // Default data model contains `users` and `roles` resources,
  // essential for authentication and RBAC.
  ...Model.DEFAULT_MODEL,
  galaxies: {
    enableAuthors: true,
    enableDeletion: false,
    enableTimestamps: true,
    fields: {
      name: {
        type: 'string',
        isUnique: true,
        isRequired: true,
      }
    }
  },
  celestialBodies: {
    enableDeletion: true,
    enableAuthors: false,
    enableTimestamps: false,
    fields: {
      type: {
        type: 'string',
        isIndexed: true,
        isRequired: true,
        enum: ['ASTEROID', 'PLANET', 'BACK_HOLE', 'STAR']
      },
      name: {
        type: 'string',
        isIndexed: true,
        isRequired: true,
      },
      discoveredIn: {
        type: 'integer',
        isIndexed: true,
        isRequired: true,
      },
      galaxy: {
        type: 'id',
        relation: 'galaxies',
        isRequired: true,
        isIndexed: true,
      },
      isLifePossible: {
        type: 'boolean',
        isRequired: true,
      },
      coordinates: {
        type: 'object',
        isRequired: true,
        fields: {
          x: {
            type: 'float',
            isRequired: true,
          },
          y: {
            type: 'float',
            isRequired: true,
          }
        }
      },
      composition: {
        type: 'array',
        fields: {
          type: 'object',
          isRequired: true,
          fields: {
            element: {
              type: 'string',
              isRequired: true,
            },
            percentage: {
              type: 'float',
              isRequired: true,
            }
          }
        }
      }
    }
  }
};

import PostgreSQLDatabaseClient from '@perseid/server/postgresql';
import { Logger, EmailClient, CacheClient, UsersEngine } from '@perseid/server';

// This is the actual data model service. It provides methods to manipulate and access data model.
// As you can see, we initialize it from our data model schema.
const model = new Model<DataModel>(dataModelSchema);

// The Logger service logs any useful information happening in the app, either for debugging or
// monitoring. Most services have access to this logger.
const logger = new Logger({ logLevel: 'debug', prettyPrint: true });

// The EmailClient service is used to send transactional emails (e.g. password reset, and such).
// By default, its methods are not implemented, meaning no email will be sent, and information will
// simply be logged. You will need to extend this service with a provider specific implementation
// (mailgun, sendgrid, ...).
const emailClient = new EmailClient(logger, { connectTimeout: 0 });

// CacheClient can be used to store data in cache for a given period of time.
const cacheClient = new CacheClient({
  cachePath: '/var/www/html/node_modules/.cache',
  connectTimeout: 0,
});

// This service provides a unified interface with the underlying DBMS to perform CRUD operations,
// and is totally interchangeable with other DatabaseClient implementations (MongoDB, MySQL, ...).
const databaseClient = new PostgreSQLDatabaseClient<DataModel>(model, logger, cacheClient, {
  host: 'postgresql',
  port: 5432,
  user: 'root',
  password: 'Test123!',
  protocol: 'pg:',
  database: 'test',
  connectionLimit: 10,
  connectTimeout: 2000,
});

// Engine is THE central element in a Perseid server, as it handles all business logic, orchestrates
// calls to the different services, validates payloads, manages permissions and authentication, ...
const engine = new UsersEngine<DataModel>(
  model,
  logger,
  databaseClient,
  emailClient,
  cacheClient,
  {
    // This parameter allows email client to send correct links to the app in transactional emails
    // (e.g. password reset page).
    baseUrl: `http://localhost:${String(process.env.FRONTEND_PORT)}`,
    // Native Perseid authentication system uses JWT access tokens convention (https://jwt.io/).
    // Thus, you need to provide a private and public key to sign these tokens.
    // You can use sites like https://cryptotools.net/rsagen to generate your keys, or the command:
    // `ssh-keygen -t rsa`. Just replace linebreaks by `\n` to get one-lined strings keys.
    auth: {
      algorithm: 'RS256',
      clientId: 'example',
      issuer: 'example',
      privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAmdomLCERP8NXupqSnFImtAtUUCxZBYc4aZtRY7fb2QppBY9B\narL5yyyJu3ZGU3is17NneLsg2YwkYWh5Ysj9lx8aEifCt7YHkkfDXWcCmLfSoKlv\nNwSuUGfPbJUgDlvpxNwHn2YxVJEk5b1VAgdY0/CExWR867/feTfZ7BjzbpRVue3t\nMHsGJ63d2/avk+Sia6YIlXS36FCt0jJnHGjB6yUgaYkXrlBzyZxpojmxIM1sS9kx\nttzKxxMDVYMVml5slg9FSNqFE2rAmWEzgCF9xP0uQEVuRQoRTT1ndoIsO5jCgFAz\nPt/fZ+jedxUz7BWxKfXg9rbxJXK2sO3VHxzccwIDAQABAoIBAB0F3QuYFVPs+sC1\n5hBdIvX16SrSotx7HLY3WYwxI+T2pMcqthF1v8+HEFhvwGaArkJmko9g5ZqEaFyD\nw9pRxhza/iUMoRvc1+LNbNpS01eR3cb3D4bWeDeszaFTJF/xENFVHI8CTS4Bz28T\nX1Tpo+UfSzydbz9dy79nPNHgBxQF1aBhb2Qw4XvstnCaggUSZqNwy5Al51H1R522\ndrIxM2VmNZwg37CVTrS+VZTe1csS8vp8uheAg4borMEks82XWuOkZGAsFureWZyL\nic7Wu1sS1bsdpqDmQ3+Pc378DcbI3a2qFr9W8DWfbtFHUBzoxNPf33ocfbDwtbT3\ni3e/X0ECgYEA6cE8Z8KaiibkOWrgyWD5AXhNr5wxZrqoGRtZfsmieoZ+cS9IPWSw\nx7TIHkMC14Dco6kteBexeASWr9ajrRe2h/VRiD8P6itamJ2157HaWs/bjlxXqcOJ\nud5Z+drv3srOnZLOtR8lBOS3RunRxAJn7BOvzBELbaiAoeuI+XXbN+ECgYEAqH5Q\naQw3oD6IHjZ3Gv1XxDJzbqJjPM46farl0feKtqjuGkE4t/d6tE0MPOS+pznXBfCO\nRI+F38k2Ew8wzvEKkoutJtwaLhekYyUfD7TWrE+N/PLJ2Km8tvqJfyh92VcO7FMe\noRGCv0AhninOJRgQlsCS6vdFg+n66Nu7R6RPjtMCgYAMtG3+DbusipSY8lApYdXm\n2I0QYGLm/HoqcywYEgl8s1an/DPm8lQRZqgBzQ6Ye+6CDq3j+xWwOj+eawIWZFWN\nai32Q8cvqQ+Rf/DlGOuPSADc6fPxzCjuK0GkrNugtlEoi1Qkz/6JF41Gk2rNRnwz\nfpZtdveyDBiBtHWLaXZywQKBgCkxKEtmNzsvzmtEeX3ZrdlDVEEZ5hT5fgc2/pSE\nZh8d0YgNpeYj1JW7uGAytAGB/HVxR/au99WsBVJHhnExMJp/F0fGy4e1M/UhICTg\n2xKpKFdMq9gSNxaszWyO46V8ySMxdu19sG89KHrYUZNz/Ko+TiyvYwlK7JJ9FZ4A\nJ4sNAoGBAIxD96rtWNCyPaN8M4/+5prSnsTx9vTiixaNGk9p/sI9t7I7aSj/Awzq\ndwal0J224bL3kbe2bTP2iVdZTd6wn7x4SFz57mqqqdSb+wPu4AIc719j3YzRaJZs\nqNyTfLQxNPE0uzzkw3FAa8thN2NAmg2hkBLPzKzzclviriH/dg+r\n-----END RSA PRIVATE KEY-----',
      publicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmdomLCERP8NXupqSnFIm\ntAtUUCxZBYc4aZtRY7fb2QppBY9BarL5yyyJu3ZGU3is17NneLsg2YwkYWh5Ysj9\nlx8aEifCt7YHkkfDXWcCmLfSoKlvNwSuUGfPbJUgDlvpxNwHn2YxVJEk5b1VAgdY\n0/CExWR867/feTfZ7BjzbpRVue3tMHsGJ63d2/avk+Sia6YIlXS36FCt0jJnHGjB\n6yUgaYkXrlBzyZxpojmxIM1sS9kxttzKxxMDVYMVml5slg9FSNqFE2rAmWEzgCF9\nxP0uQEVuRQoRTT1ndoIsO5jCgFAzPt/fZ+jedxUz7BWxKfXg9rbxJXK2sO3VHxzc\ncwIDAQAB\n-----END PUBLIC KEY-----',
    },
  },
);

import express from 'express';
import ExpressController from '@perseid/server/express';

// Works exactly the same with the `FastifyController` service.
const controller = new ExpressController<DataModel>(model, logger, engine, {
  version: '1.0.0',
  handleCORS: true,
  endpoints: {
    // Here we configure paths enpoints all build-in authentication-related engine methods that we
    // want to expose through the API.
    auth: {
      viewMe: { path: '/auth/me' },
      signUp: { path: '/auth/sign-up' },
      signIn: { path: '/auth/sign-in' },
      signOut: { path: '/auth/sign-out' },
      verifyEmail: { path: '/auth/verify-email' },
      refreshToken: { path: '/auth/refresh-token' },
      resetPassword: { path: '/auth/reset-password' },
      requestPasswordReset: { path: '/auth/reset-password' },
      requestEmailVerification: { path: '/auth/verify-email' },
    },
    // And we do the same here, but this time, for data model resources CRUD methods.
    resources: {
      roles: {
        list: { path: '/roles' },
        create: { path: '/roles' },
        view: { path: '/roles/:id' },
        update: { path: '/roles/:id' },
        delete: { path: '/roles/:id' },
        search: { path: '/roles/search' },
      },
      users: {
        list: { path: '/users' },
        create: { path: '/users' },
        view: { path: '/users/:id' },
        update: { path: '/users/:id' },
        delete: { path: '/users/:id' },
        search: { path: '/users/search' },
      },
      galaxies: {
        list: { path: '/galaxies' },
        create: { path: '/galaxies' },
        view: { path: '/galaxies/:id' },
        update: { path: '/galaxies/:id' },
        delete: { path: '/galaxies/:id' },
        search: { path: '/galaxies/search' },
      },
      celestialBodies: {
        list: { path: '/bodies' },
        create: { path: '/bodies' },
        view: { path: '/bodies/:id' },
        update: { path: '/bodies/:id' },
        delete: { path: '/bodies/:id' },
        search: { path: '/bodies/search' },
      },
    },
  },
});

async function main() {
  // We first prepare our database...
  await engine.reset('test@test.test', 'Test123!');

  // Now that a root user has been created, we just need to get their id from database and verify
  // their email adress - you should not have to perform these steps when using the REST API.
  const { results: [{ _id }] } = await databaseClient.list('users');
  await databaseClient.update('users', _id, { _verifiedAt: new Date() });

  // Context is required for any CRUD operation.
  const context = await engine.generateContext(_id);

  // Now, let's play :)

  // Creating a new galaxy...
  const newGalaxy = await engine.create('galaxies', { name: 'The Milky Way' }, {}, context);

  // Updating this galaxy...
  await engine.update('galaxies', newGalaxy._id, { name: 'Milky Way' }, {}, context);

  // Fetching this galaxy...
  logger.info(await engine.view('galaxies', newGalaxy._id, { fields: new Set(['name', '_createdAt']) }, context));

  // Listing all galaxies...
  logger.info(await engine.list('galaxies', {}, context));

  // Searching for specific galaxies...
  logger.info(await engine.search('galaxies', { query: { on: new Set(['name']), text: 'way' }, filters: null }, {}, context));

  // Deleting this galaxy...
  await engine.delete('galaxies', newGalaxy._id, context);

  // Starting the ExpressJS server...
  const app = express();

  // Registering Perseid built-in endpoints...
  await controller.createEndpoints(app);

  app.listen(parseInt(String(process.env.BACKEND_PORT), 10), '0.0.0.0');

  logger.info('API Server listening.')
}

main();
