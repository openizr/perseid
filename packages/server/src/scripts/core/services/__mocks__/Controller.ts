/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Id } from '@perseid/core';
import type Model from 'scripts/core/services/Model';
import type Logger from 'scripts/core/services/Logger';
import type Engine from 'scripts/core/services/Engine';
import { type DefaultDataModel } from '@perseid/core';
import { type ControllerSettings } from 'scripts/core/services/Controller';

/**
 * `core/services/Controller` mock.
 */

export default class <DataModel extends DefaultDataModel> {
  protected AJV_FORMATTERS: unknown;

  protected ajv: unknown;

  protected handleCORS: boolean;

  protected version: string;

  protected model: Model;

  protected logger: Logger;

  protected engine: Engine<DataModel>;

  protected settings: ControllerSettings<DataModel>;

  protected endpoints = {
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

  protected auth = vi.fn(() => Promise.resolve({ _id: new Id('000000000000000000000001') }));

  protected formatOutput = vi.fn((output: unknown) => output);

  protected formatError = vi.fn((_: string, type: string) => new Error(type));

  protected handleNotFound = vi.fn();

  protected parseQuery = vi.fn(() => ({ parsed: true }));

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
    this.handleCORS = true;
    this.version = '0.0.1';
    this.ajv = {
      compile: vi.fn((schema: { fields?: Record<string, unknown>; }) => {
        const validate = (): boolean => (
          schema.fields?.error === undefined && process.env.INVALID_SEARCH_BODY !== 'true'
        );
        (validate as unknown as { errors: string[]; }).errors = [];
        return validate;
      }),
    };
    this.AJV_FORMATTERS = {
      object: vi.fn((schema: unknown) => schema),
    };
  }
}
