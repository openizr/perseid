/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import buildClass from 'scripts/core/buildClass';

/**
 * Tooltip wrapper, for accessibility.
 */
function Tooltip(props: UITooltipProps & {
  /** Tooltip content. */
  children: React.ReactNode;
}): JSX.Element {
  const { label, children } = props;
  const { id, description, modifiers = 'top' } = props;

  const [isDescriptionVisible, setIsDescriptionVisible] = React.useState(false);
  const className = buildClass('ui-tooltip', [modifiers, isDescriptionVisible ? 'described' : ''].join(' '));

  const displayDescription = React.useCallback(() => {
    setIsDescriptionVisible(true);
  }, []);

  const hideDescription = React.useCallback(() => {
    setIsDescriptionVisible(false);
  }, []);

  return (
    <div
      id={id}
      role="tooltip"
      aria-label={label}
      className={className}
      onBlur={hideDescription}
      onFocus={displayDescription}
      onKeyUp={displayDescription}
    >
      {children}
      {(isDescriptionVisible && description !== undefined) && (
        <span className="ui-tooltip__description" role="status">{description}</span>
      )}
    </div>
  );
}

export default React.memo(Tooltip);
