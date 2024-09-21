/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { markdown, buildClass } from 'scripts/core/index';

/**
 * Title.
 */
function UITitle(props: UITitleProps): JSX.Element {
  const { label } = props;
  const { id, itemProp } = props;
  const { level = '1', modifiers = '' } = props;

  let fullModifiers = modifiers;
  // Checks if any of the given modifiers corresponds to a valid level (1, 2, ...).
  // By default, if no level is specified in modifiers, we set it to the `level` prop.
  if (!/(^|\s)([1-6])($|\s)/i.test(modifiers)) {
    fullModifiers += ` ${level}`;
  }

  return React.createElement(`h${level}`, {
    id,
    itemProp,
    dangerouslySetInnerHTML: { __html: markdown(label) },
    className: buildClass('ui-title', fullModifiers),
  });
}

export default React.memo(UITitle);
