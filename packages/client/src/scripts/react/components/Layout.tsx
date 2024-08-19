/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import Modal from 'scripts/react/components/Modal';
import DefaultMenu from 'scripts/react/components/Menu';
import type BaseStore from 'scripts/core/services/Store';
import type BaseModel from 'scripts/core/services/Model';
import DefaultNotifier from 'scripts/react/components/Notifier';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import { type DefaultDataModel, type I18n as BaseI18n } from '@perseid/core';

/**
 * Layout props.
 */
export interface LayoutProps<
  DataModel extends DefaultDataModel = DefaultDataModel,
  I18n extends BaseI18n = BaseI18n,
  Store extends BaseStore<DataModel> = BaseStore<DataModel>,
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,
  ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
> extends ReactCommonProps<DataModel, I18n, Store, Model, ApiClient> {
  /** Whether to display layout itself, or only its children. Defaults to `true`. */
  display?: boolean;

  /** Layout children. */
  children: React.ReactNode;
}

/**
 * Application layout.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/Layout.tsx
 */
function Layout({
  children,
  services,
  components,
  display = true,
}: LayoutProps): JSX.Element {
  const Menu = components.Menu ?? DefaultMenu;
  const Notifier = components.Notifier ?? DefaultNotifier;

  return (
    <div className="layout">
      <Modal services={services} components={components} />
      <Notifier services={services} components={components} />
      {display && <Menu services={services} components={components} />}
      <div className="layout__content">
        {children}
      </div>
    </div>
  );
}

export default React.memo(Layout);
