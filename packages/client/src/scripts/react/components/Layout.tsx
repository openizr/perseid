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
import { type DefaultDataModel } from '@perseid/core';
import DefaultNotifier from 'scripts/react/components/Notifier';

/**
 * Layout props.
 */
export interface LayoutProps<
  DataModel extends DefaultDataModel
> extends ReactCommonProps<DataModel> {
  /** Whether to display layout itself, or only its children. Defaults to `true`. */
  display?: boolean;

  /** Layout children. */
  children: React.ReactNode;
}

/**
 * Application layout.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/Layout.tsx
 */
export default function Layout<DataModel extends DefaultDataModel = DefaultDataModel>({
  children,
  services,
  components,
  display = true,
}: LayoutProps<DataModel>): JSX.Element {
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
