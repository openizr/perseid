/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import markdown from 'scripts/core/markdown';
import buildClass from 'scripts/core/buildClass';

/**
 * Paragraph.
 */
function UIP(props: UIPProps): JSX.Element {
  const { label } = props;
  const { itemProp, id, modifiers = '' } = props;

  const className = buildClass('ui-p', modifiers);
  return (
    <p
      id={id}
      itemProp={itemProp}
      className={className}
      dangerouslySetInnerHTML={{ __html: markdown(label) }}
    />
  );
}

export default React.memo(UIP);
