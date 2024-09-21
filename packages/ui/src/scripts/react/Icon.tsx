/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { buildClass } from 'scripts/core/index';

/**
 * Basic icon.
 */
function UIIcon(props: UIIconProps): JSX.Element {
  const { name } = props;
  const { id, modifiers = '' } = props;

  const className = buildClass('ui-icon', `${name} ${modifiers}`);
  return (
    <i
      id={id}
      className={className}
    />
  );
}

export default React.memo(UIIcon);
