/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import UIIcon from 'scripts/react/Icon';
import buildClass from 'scripts/core/buildClass';

/**
 * Button.
 */
function UIButton(props: UIButtonProps): JSX.Element {
  const { id, onClick, onFocus } = props;
  const { label, icon, iconPosition = 'left' } = props;
  const { type = 'button', modifiers = '', disabled = false } = props;
  const iconModifier = (icon !== undefined && label === undefined) ? ' icon' : '';
  const className = buildClass('ui-button', `${modifiers}${iconModifier}${disabled ? ' disabled' : ''}`);

  // -----------------------------------------------------------------------------------------------
  // CALLBACKS DECLARATION.
  // -----------------------------------------------------------------------------------------------

  const handleFocus = (event: React.FocusEvent<HTMLButtonElement>): void => {
    if (onFocus !== undefined && !disabled) {
      onFocus(event as unknown as FocusEvent);
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
    if (onClick !== undefined && !disabled) {
      onClick(event as unknown as MouseEvent);
    }
  };

  // -----------------------------------------------------------------------------------------------
  // COMPONENT RENDERING.
  // -----------------------------------------------------------------------------------------------

  const children = [
    (icon !== undefined) ? <UIIcon key="icon" name={icon} /> : null,
    (label !== undefined) ? <span key="label" className="ui-button__label">{label}</span> : null,
  ];

  return (
    <button
      id={id}
      onFocus={handleFocus}
      onClick={handleClick}
      tabIndex={disabled ? -1 : 0}
      type={(type === 'submit') ? 'submit' : 'button'}
      className={className}
    >
      {(iconPosition === 'left') ? children : children.reverse()}
    </button>
  );
}

export default React.memo(UIButton);
