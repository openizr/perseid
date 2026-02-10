/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import crypto from 'crypto';
import * as uuid from 'uuid/dist';
import Id from 'scripts/classes/NodeId';

describe('classes/NodeId', () => {
  vi.mock('uuid');
  vi.mock('crypto');

  beforeEach(() => {
    vi.clearAllMocks();
    Id.FORMAT = 'UUID';
  });

  describe('[constructor]', () => {
    test('UUID format - new id', () => {
      vi.spyOn(uuid, 'v7').mockReturnValue('00000000-0000-0000-0000-000000000000' as unknown as Buffer);
      expect(String(new Id())).toBe('00000000-0000-0000-0000-000000000000');
    });

    test('UUID format - existing valid id', () => {
      vi.spyOn(uuid, 'validate').mockReturnValue(true);
      const id = new Id('550e8400-e29b-41d4-a716-446655440000');
      expect(String(id)).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    test('SNOWFLAKE format - new id', () => {
      Id.FORMAT = 'SNOWFLAKE';
      vi.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('0000000000', 'hex') as never);
      expect(String(new Id())).toMatch(/^[a-f0-9]{23,24}$/);
    });

    test('SNOWFLAKE format - existing valid id', () => {
      Id.FORMAT = 'SNOWFLAKE';
      const id = new Id('645394d3894e3d9b43dc8825');
      expect(String(id)).toBe('645394d3894e3d9b43dc8825');
    });
  });

  test('[toString]', () => {
    const value = '550e8400-e29b-41d4-a716-446655440000';
    const id = new Id(value);
    expect(id.toString()).toBe(value);
  });

  test('[valueOf]', () => {
    const value = '550e8400-e29b-41d4-a716-446655440000';
    const id = new Id(value);
    expect(id.valueOf()).toBe(value);
  });

  test('[toJSON]', () => {
    const value = '550e8400-e29b-41d4-a716-446655440000';
    const id = new Id(value);
    expect(id.toJSON()).toBe(value);
  });
});
