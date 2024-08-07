/* c8 ignore start */

import {
  Model,
  Logger,
  CacheClient,
  EmailClient,
  UsersEngine,
  FastifyController,
  MongoDatabaseClient,
} from 'scripts/main';
import { Id, deepMerge, isPlainObject } from '@perseid/core';
import schema, { type DataModel } from 'scripts/services/__mocks__/schema';
import fastify, { type FastifyBaseLogger } from 'fastify';

const model = new Model<DataModel>(deepMerge(Model.DEFAULT_MODEL, schema));

const logger = new Logger({ logLevel: 'info', prettyPrint: true });

const emailClient = new EmailClient(logger, { connectTimeout: 0 });

const cacheClient = new CacheClient({
  cachePath: '/var/www/html/node_modules/.cache',
  connectTimeout: 0,
});

const databaseClient = new MongoDatabaseClient<DataModel>(model, logger, cacheClient, {
  host: 'mongodb',
  port: 27017,
  user: null,
  password: null,
  protocol: 'mongodb:',
  database: 'test',
  // host: 'mysql',
  // port: 3306,
  // user: 'root',
  // password: 'Test123!',
  // protocol: 'mysql:',
  // database: 'test',
  // host: 'postgresql',
  // port: 5432,
  // user: 'root',
  // password: 'Test123!',
  // protocol: 'pg:',
  // database: 'test',
  connectTimeout: 2000,
  connectionLimit: 10,
});

const engine = new UsersEngine<DataModel>(
  model,
  logger,
  databaseClient,
  emailClient,
  cacheClient,
  {
    baseUrl: `http://localhost:${String(process.env.FRONTEND_EXAMPLES_PORT)}`,
    auth: {
      algorithm: 'RS256',
      clientId: 'example',
      issuer: 'example',
      privateKey: '-----BEGIN RSA PRIVATE KEY-----\n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\n-----END RSA PRIVATE KEY-----',
      publicKey: '-----BEGIN RSA PUBLIC KEY-----\nMIIBigKCAYEAi8OWC9kddk5KUKlSx2Zvz0vUhIR7oPHss+g8HdRnAUqsgXR82dNw\nedmhyF5cJWN11DmQ+XYkrlpgpiXPaKwGJjEBtVByXQhO3S9yMwoqI1i9tIZwwvJR\nyNf/ZW5MEQOI1bj+5sCmMLi+kWTgICnSErZa54a+/9brJfXBx+Ti0DoShgpQoLpG\no2qCjzWpBc7I2/evaF+kV3af+od4XHwhSTW4Sz4dfsmYHqSVUPBoNm//sMXbgBuS\nD4ceRUsb7+r4GnLP6rgktJnfKiPJZFgF5YJOasgHO/HZsxTW1uWBjwbXt/WkSwST\nheYV5clJQTdfLZl0uJILAHW4bAqPpORd2vkZXAotW6gFs41F5TRnm79pRFbCIz5n\noLnfumyJ+4N55wEaHAvcrfK9jRpu/bCtX5nvNSp2pQ4MLzSqXESFlCPsT3Wttx+u\n7BvGD5tSZ7p98v2MfC1OrOzwTmZ0tbgkxnyeXSoeaoRCM9aykHsF63eSdRQDE6cd\nel/8EpNLRqD9AgMBAAE=\n-----END RSA PUBLIC KEY-----',
    },
  },
);

const controller = new FastifyController<DataModel>(model, logger, engine, {
  version: '0.0.1',
  handleCORS: true,
  endpoints: {
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
    resources: {
      roles: {
        list: { path: '/roles', maximumDepth: 6 },
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
    },
  },
});

const decoder = new TextDecoder();
function deepEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 instanceof Id) {
    return String(obj1) === String(obj2);
  }
  if (obj1 instanceof Date) {
    return obj2 instanceof Date;
  }
  if (obj1 instanceof ArrayBuffer) {
    return obj2 instanceof ArrayBuffer && decoder.decode(obj1) === decoder.decode(obj2);
  }
  if (Array.isArray(obj1)) {
    if (
      !Array.isArray(obj2)
      || !obj1.every((value, index) => deepEqual(value, (obj2 as unknown[])[index]))
    ) {
      return false;
    }
    return true;
  }
  if (isPlainObject(obj1)) {
    if (!isPlainObject(obj2)) {
      return false;
    }
    const keys1 = Object.keys(obj1 as Record<string, unknown>);
    const keys2 = Object.keys(obj2 as Record<string, unknown>);
    if (keys1.length !== keys2.length) {
      return false;
    }
    for (let i = 0, { length } = keys1; i < length; i += 1) {
      const key = keys1[i];
      if (!deepEqual(
        (obj1 as Record<string, unknown>)[key],
        (obj2 as Record<string, unknown>)[key],
      )) {
        return false;
      }
    }
    return true;
  }
  return (obj1 === obj2);
}

async function main(): Promise<void> {
  if (process.argv.includes('--reset')) {
    await engine.reset('test@test.test', 'Hello123!');
    process.exit(0);
  } else {
    // For ExpressJS...
    // const app = express();

    // app.get('/hello', (_request, response) => {
    //   response.status(200).send('HELLO WORLD!');
    // });

    // app.post('/test', controller.createEndpoint({
    //   handler: async (_request, response) => {
    //     const a = (await controller.parseFormData(_request, {
    //       maxFields: 10,
    //       maxFileSize: 8000000, // 8Mb.
    //       maxTotalSize: 8000000, // 8Mb.
    //       allowedMimeTypes: [
    //         'image/jpeg',
    //         'image/png',
    //         'image/webp',
    //         'image/avif',
    //         'application/octet-stream',
    //       ],
    //     }));
    //     response.status(200).send('HELLO WORLD!');
    //   },
    // }).handler as unknown as () => void);

    // await controller.createEndpoints(app, { prefix: '/perseid' });

    // app.listen(parseInt(String(process.env.BACKEND_EXAMPLES_PORT), 10), '0.0.0.0');

    // For Fastify...
    const app = fastify({
      ignoreTrailingSlash: true,
      logger: logger.child() as FastifyBaseLogger,
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

    const results = await databaseClient.search('users', { filters: { email: 'test@test.test' }, query: null });
    const context = await engine.generateContext(results.results[0]._id);
    context.user._verifiedAt = new Date();
    const { user } = context;

    const newId = new Id('6672a3e15169f0ba5b26d421');

    const newTest1: DataModel['test'] = {
      _id: newId,
      _createdBy: user._id,
      _updatedBy: null,
      _createdAt: new Date(),
      _updatedAt: null,
      _isDeleted: false,
      _version: 1,
      indexedString: 'test',
      objectOne: {
        boolean: true,
        objectTwo: {
          optionalIndexedString: 'test1',
          optionalNestedArray: [
            null,
            {
              data: {
                flatArray: ['test2', null, 'test3'],
                optionalInteger: null,
                nestedArray: [
                  { key: 'test4', optionalRelation: new Id('6672a3e15169f0ba5b26d4e2') },
                  { key: 'test5', optionalRelation: null },
                  { key: 'test6', optionalRelation: new Id('6672a3e15169f0ba5b26d4e4') },
                ],
              },
            },
            {
              data: {
                flatArray: ['test6', null, 'test7'],
                optionalInteger: 1,
                nestedArray: [
                  { key: 'test8', optionalRelation: new Id('6672a3e15169f0ba5b26d4e3') },
                ],
              },
            },
            null,
          ],
        },
        optionalRelations: [null],
      },
    };

    const newTest2: DataModel['test'] = {
      _isDeleted: false,
      _createdBy: user._id,
      _updatedBy: null,
      _createdAt: new Date(),
      _updatedAt: null,
      _version: 1,
      _id: new Id('6672a3e15169f0ba5b26d422'),
      indexedString: 'test2',
      objectOne: {
        boolean: true,
        objectTwo: {
          optionalIndexedString: null,
          optionalNestedArray: [null],
        },
        optionalRelations: [],
      },
    };

    const newOtherTest1: DataModel['otherTest'] = {
      _id: new Id('6672a3e15169f0ba5b26d4e1'),
      _createdAt: new Date('2023-01-01'),
      binary: new ArrayBuffer(0),
      optionalRelation: null,
      data: {
        optionalFlatArray: null,
        optionalRelation: newTest1._id,
      },
    };

    const newOtherTest2: DataModel['otherTest'] = {
      _id: new Id('6672a3e15169f0ba5b26d4e2'),
      _createdAt: new Date('2023-01-01'),
      optionalRelation: null,
      binary: new ArrayBuffer(0),
      data: {
        optionalFlatArray: ['test1', 'test2'],
        optionalRelation: null,
      },
    };

    const newOtherTest3: DataModel['otherTest'] = {
      _id: new Id('6672a3e15169f0ba5b26d4e3'),
      _createdAt: new Date('2023-01-01'),
      optionalRelation: null,
      binary: new ArrayBuffer(0),
      data: {
        optionalFlatArray: ['test4'],
        optionalRelation: null,
      },
    };

    const newOtherTest4: DataModel['otherTest'] = {
      _id: new Id('6672a3e15169f0ba5b26d4e4'),
      _createdAt: new Date('2023-01-01'),
      optionalRelation: null,
      binary: new ArrayBuffer(0),
      data: {
        optionalFlatArray: ['test5'],
        optionalRelation: null,
      },
    };

    await databaseClient.update('otherTest', newOtherTest1._id, { optionalRelation: null, data: { optionalRelation: null } });
    await databaseClient.update('otherTest', newOtherTest4._id, { optionalRelation: null, data: { optionalRelation: null } });
    await databaseClient.delete('test', newTest1._id);
    await databaseClient.delete('test', newTest2._id);
    await databaseClient.delete('otherTest', newOtherTest1._id);
    await databaseClient.delete('otherTest', newOtherTest2._id);
    await databaseClient.delete('otherTest', newOtherTest3._id);
    await databaseClient.delete('otherTest', newOtherTest4._id);

    await databaseClient.create('otherTest', newOtherTest2);
    await databaseClient.create('otherTest', newOtherTest3);
    await databaseClient.create('otherTest', newOtherTest4);
    await databaseClient.create('test', newTest1);
    await databaseClient.create('test', newTest2);
    await databaseClient.create('otherTest', newOtherTest1);
    await databaseClient.update('otherTest', newOtherTest4._id, { data: { optionalRelation: newId } });

    let result: unknown = await engine.view('test', newTest1._id, {
      fields: new Set(['*']),
    }, context);
    logger.info('VIEW test.* works correctly:');
    logger.info(deepEqual(result, newTest1));

    result = await engine.view('test', newTest1._id, {
      fields: new Set([
        'objectOne.objectTwo.optionalNestedArray.data.nestedArray.key',
        'objectOne.objectTwo.optionalNestedArray.data.nestedArray.optionalRelation._id',
        'objectOne.objectTwo.optionalNestedArray.data.nestedArray.optionalRelation.data.optionalRelation.indexedString',
      ]),
    }, context);
    logger.info('VIEW test with specific fields works correctly:');
    logger.info(deepEqual(result, {
      _id: newId,
      objectOne: {
        objectTwo: {
          optionalNestedArray: [
            null,
            {
              data: {
                nestedArray: [
                  {
                    key: 'test4',
                    optionalRelation: {
                      _id: newOtherTest2._id,
                      data: {
                        optionalRelation: null,
                      },
                    },
                  },
                  {
                    key: 'test5',
                    optionalRelation: null,
                  },
                  {
                    key: 'test6',
                    optionalRelation: {
                      _id: newOtherTest4._id,
                      data: {
                        optionalRelation: {
                          _id: newId,
                          indexedString: 'test',
                        },
                      },
                    },
                  },
                ],
              },
            },
            {
              data: {
                nestedArray: [
                  {
                    key: 'test8',
                    optionalRelation: {
                      _id: newOtherTest3._id,
                      data: {
                        optionalRelation: null,
                      },
                    },
                  }],
              },
            },
            null,
          ],
        },
      },
    }));
    result = await databaseClient.view('users', user._id, {
      fields: new Set(['roles']),
    });
    logger.info('VIEW users with specific fields works correctly:');
    logger.info(deepEqual(result, { _id: user._id, roles: [(user.roles[0] as DataModel['roles'])._id] }));

    result = await databaseClient.view('users', user._id, {
      fields: new Set([
        '_id',
        '_apiKeys',
        'email',
        'roles',
        'roles._id',
        '_devices._id',
        'roles._createdBy',
        'roles._updatedBy',
        'roles._updatedBy._id',
        '_devices._userAgent',
        '_devices._expiration',
        '_devices._refreshToken',
        'roles._createdBy._id',
        'roles._createdBy.email',
        'roles._createdBy.roles',
        'roles._createdBy._apiKeys',
        'roles._createdBy._devices._id',
        'roles._createdBy._devices._userAgent',
        'roles._createdBy._devices._expiration',
        'roles._createdBy._devices._refreshToken',
      ]),
    });
    logger.info('VIEW users with specific fields works correctly:');
    logger.info(deepEqual(result, {
      _id: user._id,
      _apiKeys: [],
      email: 'test@test.test',
      roles: [
        {
          _id: (user.roles[0] as DataModel['roles'])._id,
          _updatedBy: null,
          _createdBy: {
            _id: user._id,
            email: 'test@test.test',
            roles: [
              (user.roles[0] as DataModel['roles'])._id,
            ],
            _apiKeys: [],
            _devices: user._devices,
          },
        },
      ],
      _devices: user._devices,
    }));
  }
}

main().catch((error: unknown) => {
  logger.fatal(error);
  process.exit(1);
});
