/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `core/services/CacheClient` mock.
 */

export default class {
  public set = vi.fn();

  public get = vi.fn(() => 'test');

  public delete = vi.fn();
}
