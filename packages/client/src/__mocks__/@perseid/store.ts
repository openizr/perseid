/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `@perseid/store` mock.
 */

export default class Store {
  public register = vi.fn();

  public mutate = vi.fn();

  public subscribe = vi.fn();

  public combine = vi.fn();

  public dispatch = vi.fn();
}
