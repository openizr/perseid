/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `scripts/core/services/ApiClient` mock.
 */

export default class ApiClient {
  public signIn = vi.fn();

  public signUp = vi.fn();

  public viewMe = vi.fn(() => Promise.resolve({
    _id: '000000000000000000000001',
    roles: [{ permissions: [] }],
  }));

  public getModel = vi.fn();

  public verifyEmail = vi.fn();

  public resetPassword = vi.fn();

  public requestPasswordReset = vi.fn();

  public requestEmailVerification = vi.fn();

  public signOut = vi.fn(() => Promise.resolve());

  public buildQuery = vi.fn(() => 'BUILT_QUERY');

  public create = vi.fn(() => Promise.resolve({
    _id: '000000000000000000000001',
  }));

  public update = vi.fn((collection) => ((collection === 'users') ? Promise.resolve({
    _id: '000000000000000000000001',
    roles: [{ permissions: [] }],
  }) : Promise.resolve({
    _id: '000000000000000000000001',
  })));

  public view = vi.fn(() => Promise.resolve({
    _id: '000000000000000000000001',
  }));

  public delete = vi.fn(() => Promise.resolve());

  public list = vi.fn(() => Promise.resolve({
    total: 1,
    results: [{
      _id: '000000000000000000000001',
    }],
  }));

  public search = vi.fn(() => Promise.resolve({
    total: 1,
    results: [{
      _id: '000000000000000000000001',
    }],
  }));
}
