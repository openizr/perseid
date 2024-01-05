/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '@perseid/ui/vue' {
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
  import type { DefineComponent } from 'vue';

  export * from '@perseid/ui';

  /**
   * Paragraph.
   */
  export const UIP: DefineComponent<UIPProps>;

  /**
   * Basic icon.
   */
  export const UIIcon: DefineComponent<UIIconProps>;

  /**
   * Title.
   */
  export const UITitle: DefineComponent<UITitleProps>;

  /**
  * Hyperlink.
  */
  export const UILink: DefineComponent<UILinkProps>;

  /**
   * Button.
   */
  export const UIButton: DefineComponent<UIButtonProps>;

  /**
   * Tooltip wrapper, for accessibility.
   */
  export const UITooltip: DefineComponent<UITooltipProps>;

  /**
   * Image.
   */
  export const UIImage: DefineComponent<UIImageProps>;

  /**
   * Set of selectable options.
   */
  export const UIOptions: DefineComponent<UIOptionsProps>;

  /**
   * Text field.
   */
  export const UITextfield: DefineComponent<UITextfieldProps>;

  /**
   * Text area.
   */
  export const UITextarea: DefineComponent<UITextareaProps>;

  /**
   * File picker.
   */
  export const UIFilePicker: DefineComponent<UIFilePickerProps>;
}
