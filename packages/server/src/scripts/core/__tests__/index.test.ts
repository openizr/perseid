/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as exports from 'scripts/core/index';

describe('core', () => {
  vi.mock('scripts/core/services/Model');
  vi.mock('scripts/core/services/Logger');
  vi.mock('scripts/core/services/Engine');
  vi.mock('scripts/core/services/Profiler');
  vi.mock('scripts/core/services/Controller');
  vi.mock('scripts/core/services/CacheClient');
  vi.mock('scripts/core/services/UsersEngine');
  vi.mock('scripts/core/services/EmailClient');
  vi.mock('scripts/core/services/BucketClient');
  vi.mock('scripts/core/services/AbstractDatabaseClient');

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
      'AbstractDatabaseClient',
      'EmailClient',
      'CacheClient',
      'NotAcceptable',
      'TooManyRequests',
      'UnprocessableEntity',
    ]);
  });
});
