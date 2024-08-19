/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { type AuthState } from 'scripts/core/services/Store';
import type BaseStore from 'scripts/core/services/Store';
import type BaseModel from 'scripts/core/services/Model';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import { type DefaultDataModel, type I18n as BaseI18n } from '@perseid/core';

/**
 * Permissions wrapper props.
 */
export interface PermissionsWrapper<
  DataModel extends DefaultDataModel = DefaultDataModel,
  I18n extends BaseI18n = BaseI18n,
  Store extends BaseStore<DataModel> = BaseStore<DataModel>,
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,
  ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
> extends ReactCommonProps<DataModel, I18n, Store, Model, ApiClient> {
  /** Permissions that are required to display content. */
  requiredPermissions: string[];

  /** Content to display if user has required permissions. */
  children: React.ReactNode;
}

/**
 * Displays its children if user has proper permissions.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/PermissionsWrapper.tsx
 */
export default function PermissionsWrapper({
  children,
  services,
  requiredPermissions,
}: PermissionsWrapper): JSX.Element {
  const { user } = services.store.useSubscription<AuthState>('auth');
  return (requiredPermissions.every((permission) => (
    user?._permissions.has(permission)
  )) && children) as JSX.Element;
}
