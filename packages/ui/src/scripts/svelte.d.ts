/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '@perseid/ui/svelte' {
  import { type SvelteComponent } from 'svelte';
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
  export class UIP extends SvelteComponent<UIPProps> { }

  /**
   * Basic icon.
   */
  export class UIIcon extends SvelteComponent<UIIconProps> { }

  /**
   * Title.
   */
  export class UITitle extends SvelteComponent<UITitleProps> { }

  /**
   * Hyperlink.
   */
  export class UILink extends SvelteComponent<UILinkProps> { }

  /**
   * Button.
   */
  export class UIButton extends SvelteComponent<UIButtonProps> { }

  /**
   * Tooltip wrapper, for accessibility.
   */
  export class UITooltip extends SvelteComponent<UITooltipProps> { }

  /**
   * Image.
   */
  export class UIImage extends SvelteComponent<UIImageProps> { }

  /**
   * Set of selectable options.
   */
  export class UIOptions extends SvelteComponent<UIOptionsProps> { }

  /**
   * Text field.
   */
  export class UITextfield extends SvelteComponent<UITextfieldProps> { }

  /**
   * Text area.
   */
  export class UITextarea extends SvelteComponent<UITextareaProps> { }

  /**
   * File picker.
   */
  export class UIFilePicker extends SvelteComponent<UIFilePickerProps> { }
}
