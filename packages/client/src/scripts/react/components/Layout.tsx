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
import DefaultNotifier from 'scripts/react/components/Notifier';

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
}: React.LayoutProps): JSX.Element {
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
