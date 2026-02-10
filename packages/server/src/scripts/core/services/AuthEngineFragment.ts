/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {
  Payload,
  CreatePayload,
  CommandContext,
  UpdatePayload,
  UserCommandContext,
} from 'scripts/core/types';
import bcrypt from 'bcrypt';
import Model from 'scripts/core/services/Model';
import type { UserDataModel } from '@perseid/core';
import Telemetry from 'scripts/core/services/Telemetry';
import EngineFragment from 'scripts/core/services/EngineFragment';
import type BaseEmailClient from 'scripts/core/services/EmailClient';
import type BaseCacheClient from 'scripts/core/services/CacheClient';
import type { UsersEngineSettings } from 'scripts/core/services/AuthEngine';
import type AbstractDatabaseClient from 'scripts/core/services/AbstractDatabaseClient';

/**
 * Contains the main logic of the Perseid Auth Engine, providing authentication features.
 * This class is meant to be used by other engine fragments to implement their own logic.
 * Engine fragments are useful to split large codebases into smaller, more manageable pieces, each
 * responsible for a specific part of the engine.
 */
export default class AuthEngineFragment<
  /**
   * Data model type definition.
   */
  DataModel extends UserDataModel,

  /**
   * Database client type definition.
   */
  DatabaseClient extends AbstractDatabaseClient<DataModel> = AbstractDatabaseClient<DataModel>,

  /**
   * Email client type definition.
   */
  EmailClient extends BaseEmailClient = BaseEmailClient,

  /**
   * Cache client type definition.
   */
  CacheClient extends BaseCacheClient = BaseCacheClient,
> extends EngineFragment<DataModel, DatabaseClient> {
  /**
   * EmailClient instance to use.
   */
  protected emailClient: EmailClient;

  /**
   * CacheClient instance to use.
   */
  protected cacheClient: CacheClient;

  /**
   * Application base URL.
   */
  protected baseUrl: UsersEngineSettings['baseUrl'];

  /**
   * In addition to the base `prepareCreatePayload` method, handles payload preparation for
   * `users` resource.
   */
  protected async prepareCreatePayload<Resource extends keyof DataModel>(
    resource: Resource,
    payload: CreatePayload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<DataModel[Resource]> {
    const fullPayload = await super.prepareCreatePayload(resource, payload, context);

    if (resource === 'users') {
      const userPayload = this.defineFullPayload<'users'>(fullPayload);

      userPayload._devices = [];
      userPayload._verifiedAt = new Date();
      userPayload.password = await bcrypt.hash(userPayload.password, 10);
    }

    return fullPayload;
  }

  /**
   * In addition to the base `prepareUpdatePayload` method, handles payload preparation for
   * `users` resource.
   */
  protected async prepareUpdatePayload<Resource extends keyof DataModel>(
    resource: Resource,
    payload: UpdatePayload<DataModel[Resource]>,
    context: UserCommandContext<DataModel>,
  ): Promise<Payload<DataModel[Resource]>> {
    const fullPayload = await super.prepareUpdatePayload(resource, payload, context);

    if (resource === 'users') {
      const userPayload = fullPayload as Payload<UserDataModel['users']>;
      if (userPayload.email !== undefined) {
        userPayload._verifiedAt = null;
      }

      // Whenever users change their password, we automatically sign them out of all their
      // devices, as a security measure. Successfully resetting users password also means verifying
      // their email at the same time.
      if (userPayload.password !== undefined) {
        userPayload._devices = [];
        userPayload._verifiedAt = context.session.user._verifiedAt ?? new Date();
        userPayload.password = await bcrypt.hash(userPayload.password, 10);
      }
    }

    return fullPayload;
  }

  /**
   * Class constructor.
   *
   * @param model Data model to use.
   *
   * @param telemetry Telemetry system to use.
   *
   * @param databaseClient Database client to use.
   */
  constructor(
    model: Model<DataModel>,
    telemetry: Telemetry,
    databaseClient: DatabaseClient,
    emailClient: EmailClient,
    cacheClient: CacheClient,
    settings: UsersEngineSettings,
  ) {
    super(model, telemetry, databaseClient);
    this.emailClient = emailClient;
    this.cacheClient = cacheClient;
    this.baseUrl = settings.baseUrl;
  }

  /**
   * In addition to the base `create` method, sends an invite email to the user if they are being
   * created.
   */
  public async create<Result = unknown, Resource extends keyof DataModel = keyof DataModel>(
    resource: Resource,
    payload: CreatePayload<DataModel[Resource]>,
    context: CommandContext<DataModel>,
  ): Promise<Result> {
    const result = await super.create<Result>(resource, payload, context);

    if (resource === 'users') {
      const { email, password } = this.defineCreatePayload<'users'>(payload);
      await this.emailClient.sendInviteEmail(email, `${this.baseUrl}/sign-in`, password);
    }

    return result;
  }
}
