/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { type DefaultDataModel } from '@perseid/core';
import { type AuthState } from 'scripts/core/services/Store';

/**
 * Permissions wrapper props.
 */
export interface PermissionsWrapper<
  DataModel extends DefaultDataModel
> extends ReactCommonProps<DataModel> {
  /** Permissions that are required to display content. */
  requiredPermissions: string[];

  /** Content to display if user has required permissions. */
  children: React.ReactNode;
}

/**
 * Displays its children if user has proper permissions.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/PermissionsWrapper.tsx
 */
export default function PermissionsWrapper<DataModel extends DefaultDataModel = DefaultDataModel>({
  children,
  services,
  requiredPermissions,
}: PermissionsWrapper<DataModel>): JSX.Element {
  const { user } = services.store.useSubscription<AuthState>('auth');
  return (requiredPermissions.every((permission) => (
    user?._permissions.has(permission)
  )) && children) as JSX.Element;
}
