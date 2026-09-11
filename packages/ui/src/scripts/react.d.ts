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

/**
 * Adds native autocomplete for `data-layout` attribute to all React elements.
 */
declare namespace React {
  /**
   * Perseid built-in breakpoint.
   */
  type Breakpoint = 'xxs' | 'xs' | 's' | 'm' | 'l' | 'xl';

  /**
   * Perseid built-in shorthand.
   */
  type Shorthand = (
    'grid'
    | 'flex'
    | 'none'
    | 'block'
    | 'inline'
    | 'inline-flex'
    | 'inline-grid'
    | 'flex-wrap'
    | 'flex-nowrap'
    | 'flex-wrap-rev'
    | 'flex-row'
    | 'flex-col'
    | 'flex-col-rev'
    | 'flex-row-rev'
    | 'grid-row'
    | 'grid-col'
    | 'grid-dense'
    | 'flex-none'
    | 'flex-auto'
    | 'justify-between'
    | 'justify-start'
    | 'justify-end'
    | 'justify-stretch'
    | 'justify-center'
    | 'items-center'
    | 'items-start'
    | 'items-end'
    | 'items-stretch'
    | 'self-center'
    | 'self-start'
    | 'self-end'
    | 'self-stretch'
    | 'text-left'
    | 'text-right'
    | 'text-center'
    | 'text-justify'
    | 'w-full'
    | 'h-full'
    | 'col-1'
    | 'col-2'
    | 'col-3'
    | 'col-4'
    | 'col-5'
    | 'col-6'
    | 'col-7'
    | 'col-8'
    | 'col-9'
    | 'col-10'
    | 'col-11'
    | 'col-12'
    | 'cols-1'
    | 'cols-2'
    | 'cols-3'
    | 'cols-4'
    | 'cols-5'
    | 'cols-6'
    | 'cols-7'
    | 'cols-8'
    | 'cols-9'
    | 'cols-10'
    | 'cols-11'
    | 'cols-12'
    | 'vgap-0'
    | 'vgap-1'
    | 'vgap-2'
    | 'vgap-3'
    | 'vgap-4'
    | 'vgap-5'
    | 'vgap-6'
    | 'vgap-7'
    | 'hgap-0'
    | 'hgap-1'
    | 'hgap-2'
    | 'hgap-3'
    | 'hgap-4'
    | 'hgap-5'
    | 'hgap-6'
    | 'hgap-7'
  );

  /**
   * Adds native autocomplete for `data-layout` attribute to all React elements.
   */
  interface HTMLAttributes<T> extends React.AriaAttributes, React.DOMAttributes<T> {
    'data-layout'?: Shorthand | `${Breakpoint}:${Shorthand}` | (string & Record<never, never>);
  }
}
