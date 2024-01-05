/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '@perseid/ui/react' {
  import * as React from 'react';
  import type {
    UIPProps,
    UILinkProps,
    UIIconProps,
    UITitleProps,
    UIImageProps,
    UIButtonProps,
    UITooltipProps,
    UIOptionsProps,
    UITextareaProps,
    UITextfieldProps,
    UIFilePickerProps,
  } from '@perseid/ui';

  export * from '@perseid/ui';

  /**
   * Paragraph.
   */
  export function UIP(props: UIPProps): JSX.Element;

  /**
   * Basic icon.
   */
  export function UIIcon(props: UIIconProps): JSX.Element;

  /**
   * Title.
   */
  export function UITitle(props: UITitleProps): JSX.Element;

  /**
   * Hyperlink.
   */
  export function UILink(props: UILinkProps): JSX.Element;

  /**
   * Button.
   */
  export function UIButton(props: UIButtonProps): JSX.Element;

  /**
   * Tooltip wrapper, for accessibility.
   */
  export function UITooltip(props: UITooltipProps & {
    /** Tooltip content. */
    children: React.ReactNode;
  }): JSX.Element;

  /**
   * Image.
   */
  export function UIImage(props: UIImageProps): JSX.Element;

  /**
   * Set of selectable options.
   */
  export function UIOptions(props: UIOptionsProps): JSX.Element;

  /**
   * Text field.
   */
  export function UITextfield(props: UITextfieldProps): JSX.Element;

  /**
   * Text area.
   */
  export function UITextarea(props: UITextareaProps): JSX.Element;

  /**
   * File picker.
   */
  export function UIFilePicker(props: UIFilePickerProps): JSX.Element;
}
