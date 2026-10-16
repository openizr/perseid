/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import defaultExport from 'scripts/fastify-connector';

describe('fastify', () => {
  vi.mock('scripts/connectors/fastify/services/FastifyController');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('correctly exports library', () => {
    expect(defaultExport).toBeDefined();
  });
});
