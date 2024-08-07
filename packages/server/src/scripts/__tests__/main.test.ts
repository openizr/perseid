/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as exports from 'scripts/main';

describe('main', () => {
  vi.mock('fastify');
  vi.mock('@perseid/core');
  vi.mock('scripts/services/Model');
  vi.mock('scripts/services/Logger');
  vi.mock('scripts/services/Engine');
  vi.mock('scripts/services/Profiler');
  vi.mock('scripts/services/Controller');
  vi.mock('scripts/services/CacheClient');
  vi.mock('scripts/services/UsersEngine');
  vi.mock('scripts/services/EmailClient');
  vi.mock('scripts/services/BucketClient');
  vi.mock('scripts/services/FastifyController');
  vi.mock('scripts/services/ExpressController');
  vi.mock('scripts/services/MongoDatabaseClient');
  vi.mock('scripts/services/MySQLDatabaseClient');
  vi.mock('scripts/services/AbstractDatabaseClient');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('correctly exports library', () => {
    expect(Object.keys(exports)).toEqual([
      'Model',
      'Logger',
      'Engine',
      'Profiler',
      'Controller',
      'UsersEngine',
      'BucketClient',
      'RequestEntityTooLarge',
      'BadRequest',
      'Gone',
      'Conflict',
      'EngineError',
      'DatabaseError',
      'NotFound',
      'Forbidden',
      'Unauthorized',
      'FastifyController',
      'ExpressController',
      'AbstractDatabaseClient',
      'EmailClient',
      'CacheClient',
      'NotAcceptable',
      'TooManyRequests',
      'UnprocessableEntity',
      'MySQLDatabaseClient',
      'PostgreSQLDatabaseClient',
      'MongoDatabaseClient',
    ]);
  });
});
