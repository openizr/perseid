/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type Model from 'scripts/services/Model';
import type Logger from 'scripts/services/Logger';
import type Engine from 'scripts/services/Engine';
import { type ControllerSettings } from 'scripts/services/Controller';

/**
 * `services/Controller` mock.
 */

export default class <DataModel> {
  protected model: Model;

  protected logger: Logger;

  protected engine: Engine<DataModel>;

  protected settings: ControllerSettings<DataModel>;

  protected endpoints = {
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
        list: { path: '/users', maximumDepth: 6 },
        create: { path: '/users' },
        view: { path: '/users/:id' },
        update: { path: '/users/:id' },
        search: { path: '/users/:id' },
        delete: { path: '/users/:id' },
      },
    },
  };

  protected rbac = vi.fn();

  protected toSnakeCase = vi.fn(() => 'TEST_COLLECTION');

  protected formatOutput = vi.fn((output: unknown) => output);

  protected parseQuery = vi.fn(() => ({ parsed: true }));

  protected parseSearchBody = vi.fn(() => ({ filters: {} }));

  protected generateFieldsTreeFrom = vi.fn(() => ({}));

  protected catchErrors = vi.fn((callback: () => unknown) => callback());

  public constructor(
    model: Model,
    logger: Logger,
    engine: Engine<DataModel>,
    settings: ControllerSettings<DataModel>,
  ) {
    this.model = model;
    this.logger = logger;
    this.engine = engine;
    this.settings = settings;
  }
}
