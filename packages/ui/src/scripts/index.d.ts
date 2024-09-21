/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '*.svelte' {
  import { SvelteComponent } from 'svelte';

  export default SvelteComponent;
}

declare module '*.vue' {
  import Vue from 'vue';

  export default Vue;
}

/**
 * UIP component props.
 */
interface UIPProps {
  /** `id` HTML attribute to set to the element. */
  id?: string;

  /** Paragraph content. Supports light markdown. */
  label: string;

  /** `itemprop` HTML attribute to set to the element. */
  itemProp?: string;

  /** List of modifiers to apply to the element. Defaults to `""`. */
  modifiers?: string;
}

/**
 * UIIcon component props.
 */
interface UIIconProps {
  /** `id` HTML attribute to set to the element. */
  id?: string;

  /** Icon's name. */
  name: string;

  /** List of modifiers to apply to the element. Defaults to `""`. */
  modifiers?: string;
}

/**
 * UITitle component props.
 */
interface UITitleProps {
  /** `id` HTML attribute to set to the element. */
  id?: string;

  /** Heading's content. Supports light markdown. */
  label: string;

  /** `itemprop` HTML attribute to set to the element. */
  itemProp?: string;

  /** List of modifiers to apply to the element. Defaults to `""`. */
  modifiers?: string;

  /** Heading HTML level (1 to 6). This will determine which HTML tag to use. Defaults to "1". */
  level?: '1' | '2' | '3' | '4' | '5' | '6';
}

/**
 * UILink component props.
 */
interface UILinkProps {
  /** `id` HTML attribute to set to the element. */
  id?: string;

  /** Hyperlink's content. Supports light markdown. */
  label: string;

  /** `rel` HTML attribute to set to the element. */
  rel?: string;

  /** `target` HTML attribute to set to the element. */
  target?: string;

  /** `href` HTML attribute to set to the element. */
  href: string;

  /** List of modifiers to apply to the element. Defaults to `""`. */
  modifiers?: string;

  /** `itemProp` HTML attribute to set to the element. */
  itemProp?: string;

  /**
   * When element is disabled, a special `disabled` modifier is automatically added, and all its
   * user interactions are disabled. Defaults to `false`.
   */
  disabled?: boolean;

  /**
   * `click` event handler.
   *
   * @param event `click` DOM event.
   */
  onClick?: (event: MouseEvent) => void;
}

/**
 * UIButton component props.
 */
interface UIButtonProps {
  /** `id` HTML attribute to set to the element. */
  id?: string;

  /** Button's content. */
  label?: string;

  /** Name of the icon to set to the element. */
  icon?: string;

  /** `type` HTML attribute to set to the element. Defaults to "button". */
  type?: 'button' | 'submit';

  /** Position of the icon relatively to the label. Defaults to "left". */
  iconPosition?: 'left' | 'right';

  /** List of modifiers to apply to the element. Defaults to `""`. */
  modifiers?: string;

  /**
   * When element is disabled, a special `disabled` modifier is automatically added, and all its
   * user interactions are disabled. Defaults to `false`.
   */
  disabled?: boolean;

  /**
   * `click` event handler.
   *
   * @param event `click` DOM event.
   */
  onClick?: (event: MouseEvent) => void;

  /**
   * `focus` event handler.
   *
   * @param event `focus` DOM event.
   */
  onFocus?: (event: FocusEvent) => void;
}

/**
 * UITooltip component props.
 */
interface UITooltipProps {
  /** `id` HTML attribute to set to the element. */
  id?: string;

  /** `aria-label` HTML attribute to set to the element. */
  label?: string;

  /**
   * Description to display instead of the label (toggletip mode). In this mode, the label prop
   * will still be displayed on hover/focus, but this time, as soon as the user clicks or presses
   * a key on the tooltip children, label will be replaced by the description prop.
   * See https://inclusive-components.design/tooltips-toggletips/
   */
  description?: string;

  /** List of modifiers to apply to the element. Defaults to `"top"`. */
  modifiers?: string;
}

/**
 * UIImage component props.
 */
interface UIImageProps {
  /** Aspect ratio to apply to the image. */
  ratio: string;

  /** `src` HTML attribute to set to the element. */
  src: string;

  /** `alt` HTML attribute to set to the element. */
  alt: string;

  /** `id` HTML attribute to set to the element. */
  id?: string;

  /** `itemProp` HTML attribute to set to the element. */
  itemProp?: string;

  /** List of modifiers to apply to the element. Defaults to `""`. */
  modifiers?: string;

  /** Whether to lazy-load image. Defaults to `true`. */
  lazy?: boolean;
}

/**
 * Selectable option.
 */
interface UIOptionsOption {
  type: 'option';

  /** Option's value (`value` HTML attribute). */
  value: string;

  /** Option's label. */
  label: string;

  /** Whether the option can be selected. Defaults to `false`. */
  disabled?: boolean;

  /** List of modifiers to pass to the option. */
  modifiers?: string;
}

interface UIOptionsHeader {
  type: 'header';

  /** Header's label. */
  label: string;

  /** List of modifiers to pass to the header. */
  modifiers?: string;
}

interface UIOptionsDivider {
  type: 'divider';

  /** List of modifiers to pass to the divider. */
  modifiers?: string;
}

type Option = UIOptionsDivider | UIOptionsOption | UIOptionsHeader;

/**
 * UIOptions component props.
 */
interface UIOptionsProps {
  /** `id` HTML attribute to set to the element. */
  id?: string;

  /** `name` HTML attribute to set to the element. */
  name: string;

  /** Element's label. Supports light markdown. */
  label?: string;

  /** Element's helper. Supports light markdown. */
  helper?: string;

  /** Whether to force drop-down displaying in select mode. Defaults to `false`. */
  expanded?: boolean;

  /** Whether to display options as a select (=drop-down). Defaults to `false`. */
  select?: boolean;

  /** List of options to display in the component. */
  options: Option[];

  /**
   * When element is disabled, a special `disabled` modifier is automatically added, and all its
   * user interactions are disabled. Defaults to `false`.
   */
  disabled?: boolean;

  /** Element's placeholder. */
  placeholder?: string;

  /**
   * Whether user can select several options. Determines how the component will be displayed.
   * `false` will display options as radio buttons, `true` will display them as check-boxes,
   * and `true` along with `select` set to `true` will display a multi-choices drop-down.
   * Defaults to `false`.
   * */
  multiple?: boolean;

  /** List of modifiers to apply to the element. Defaults to `""`. */
  modifiers?: string;

  /**
   * Initial value (pre-selected options).
   * Updating this prop with a new value will replace the current value by the one passed.
   * Defaults to `[]`.
   */
  value?: string | string[];

  /** Pass this prop if you want to force options list positionning in `select` mode. */
  selectPosition?: 'top' | 'bottom';

  /**
   * `focus` event handler.
   *
   * @param value Focused option's value.
   *
   * @param event `focus` DOM event.
   */
  onFocus?: (value: string, event: FocusEvent) => void;

  /**
   * `change` event handler.
   *
   * @param value Current options' value.
   *
   * @param event `input` DOM event.
   */
  onChange?: (value: string | string[], event: InputEvent) => void;
}

/**
 * UITextfield component props.
 */
interface UITextfieldProps {
  /** `id` HTML attribute to set to the element. */
  id?: string;

  /** `min` HTML attribute to set to the element. */
  min?: number;

  /** `max` HTML attribute to set to the element. */
  max?: number;

  /** `name` HTML attribute to set to the element. */
  name: string;

  /** `step` HTML attribute to set to the element. */
  step?: number;

  /** Name of the icon to set to the element. */
  icon?: string;

  /** `site` HTML attribute to set to the element. */
  size?: number;

  /**
   * When element is disabled, a special `disabled` modifier is automatically added, and all its
   * user interactions are disabled. Defaults to `false`.
   */
  disabled?: boolean;

  /**
   * Input's value. Updating this prop with a new value will replace the current value by
   * the one passed. Defaults to `""`.
   */
  value?: string | number;

  /** Element's label. Supports light markdown. */
  label?: string;

  /** Element's helper. Supports light markdown. */
  helper?: string;

  /** `readonly` HTML attribute to set to the element. Defaults to `false`. */
  readonly?: boolean;

  /** `maxlength` HTML attribute to set to the element. */
  maxlength?: number;

  /** List of modifiers to apply to the element. Defaults to `""`. */
  modifiers?: string;

  /** `autofocus` HTML attribute to set to the element. Defaults to `false`. */
  autofocus?: boolean;

  /** `placeholder` HTML attribute to set to the element. */
  placeholder?: string;

  /** `autocomplete` HTML attribute to set to the element. Defaults to `off`. */
  autocomplete?: 'on' | 'off';

  /** Position of the icon relatively to the label. Defaults to `"left"`. */
  iconPosition?: 'left' | 'right';

  /**
   * List of RegExp patterns used to filter user inputs and keep only authorized characters.
   * Useful for purpose-specific inputs, like phone numbers (you only want to allow digits).
   * `default` is used to filter all inputs, and the others keys are used to allow specific
   * patterns when holding special keys, like `Ctrl`.
   */
  allowedKeys?: {
    altKey?: RegExp;
    metaKey?: RegExp;
    ctrlKey?: RegExp;
    default?: RegExp;
    shiftKey?: RegExp;
  };

  /**
   * Number of milliseconds to wait before triggering the `change` event. If user changes the
   * input value during that time, the timeout is reset. This is especially useful to limit the
   * number of triggers, if you want to use this component as an autocomplete performing HTTP
   * requests on user inputs, for instance. Defaults to `50`.
   */
  debounceTimeout?: number;

  /** `type` HTML attribute to set to the element. Defaults to `text`. */
  type?: 'text' | 'email' | 'number' | 'password' | 'search' | 'tel' | 'url';

  /**
   * Transformation function that will format input value.
   * This is especially useful for purpose-specific inputs, like phone numbers (you want to format
   * the number to something like (XXX) XXX-XXXX).
   *
   * @param value Input value to transform.
   *
   * @param selectionStart Current cursor position in the input.
   *
   * @returns An array of at least the formatted value, and optionally the new cursor position
   * after formatting.
   */
  transform?: (value: string, selectionStart: number) => [string, number?];

  /**
   * `focus` event handler.
   *
   * @param value Current textfield's value.
   *
   * @param event `focus` DOM event.
   */
  onFocus?: (value: string, event: FocusEvent) => void;

  /**
   * `blur` event handler.
   *
   * @param value Current textfield's value.
   *
   * @param event `blur` DOM event.
   */
  onBlur?: (value: string, event: FocusEvent) => void;

  /**
   * `paste` event handler.
   *
   * @param value Current textfield's value.
   *
   * @param event `clipboard` DOM event.
   */
  onPaste?: (value: string, event: ClipboardEvent) => void;

  /**
   * `change` event handler.
   *
   * @param value Current textfield's value.
   *
   * @param event `input` DOM event.
   */
  onChange?: (value: string, event: InputEvent) => void;

  /**
   * `keyDown` event handler.
   *
   * @param value Current textfield's value.
   *
   * @param event `keyDown` DOM event.
   */
  onKeyDown?: (value: string, event: KeyboardEvent) => void;

  /**
   * `iconKeyDown` event handler.
   *
   * @param event `keyDown` DOM event.
   */
  onIconKeyDown?: (event: KeyboardEvent) => void;

  /**
   * `iconClick` event handler.
   *
   * @param event `click` DOM event.
   */
  onIconClick?: (event: MouseEvent) => void;
}

/**
 * UITextarea component props.
 */
interface UITextareaProps {
  /** `id` HTML attribute to set to the element. */
  id?: string;

  /** `cols` HTML attribute to set to the element. */
  cols?: number;

  /** `rows` HTML attribute to set to the element. */
  rows?: number;

  /** `name` HTML attribute to set to the element. */
  name: string;

  /**
   * When element is disabled, a special `disabled` modifier is automatically added, and all its
   * user interactions are disabled. Defaults to `false`.
   */
  disabled?: boolean;

  /**
   * Textarea's value. Updating this prop with a new value will replace the current value by
   * the one passed. Defaults to `""`.
   */
  value?: string | number;

  /** Element's label. Supports light markdown. */
  label?: string;

  /** Element's helper. Supports light markdown. */
  helper?: string;

  /** `readonly` HTML attribute to set to the element. Defaults to `false`. */
  readonly?: boolean;

  /** `maxlength` HTML attribute to set to the element. */
  maxlength?: number;

  /** List of modifiers to apply to the element. Defaults to `""`. */
  modifiers?: string;

  /** `autofocus` HTML attribute to set to the element. Defaults to `false`. */
  autofocus?: boolean;

  /** `placeholder` HTML attribute to set to the element. */
  placeholder?: string;

  /** `autocomplete` HTML attribute to set to the element. Defaults to `off`. */
  autocomplete?: 'on' | 'off';

  /**
   * Wether to automatically resize textarea's height when user puts line-breaks.
   * Defaults to `false`.
   */
  autoresize?: boolean;

  /**
   * Number of milliseconds to wait before triggering the `change` event. If user changes the
   * textarea value during that time, the timeout is reset. This is especially useful to limit the
   * number of triggers, if you want to use this component as an autocomplete performing HTTP
   * requests on user inputs, for instance. Defaults to `50`.
   */
  debounceTimeout?: number;

  /**
   * `focus` event handler.
   *
   * @param value Current textarea's value.
   *
   * @param event `focus` DOM event.
   */
  onFocus?: (value: string, event: FocusEvent) => void;

  /**
   * `blur` event handler.
   *
   * @param value Current textarea's value.
   *
   * @param event `blur` DOM event.
   */
  onBlur?: (value: string, event: FocusEvent) => void;

  /**
   * `paste` event handler.
   *
   * @param value Current textarea's value.
   *
   * @param event `clipboard` DOM event.
   */
  onPaste?: (value: string, event: ClipboardEvent) => void;

  /**
   * `change` event handler.
   *
   * @param value Current textarea's value.
   *
   * @param event `input` DOM event.
   */
  onChange?: (value: string, event: InputEvent) => void;

  /**
   * `keyDown` event handler.
   *
   * @param value Current textarea's value.
   *
   * @param event `keyDown` DOM event.
   */
  onKeyDown?: (value: string, event: KeyboardEvent) => void;
}

/**
 * UIFilePicker component props.
 */
interface UIFilePickerProps {
  /** `id` HTML attribute to set to the element. */
  id?: string;

  /** `name` HTML attribute to set to the element. */
  name: string;

  /** `accept` HTML attribute to set to the element. */
  accept?: string;

  /** Name of the icon to set to the element. */
  icon?: string;

  /** `multiple` HTML attribute to set to the element. Defaults to `false`. */
  multiple?: boolean;

  /** Position of the icon relatively to the label. Defaults to `"left"`. */
  iconPosition?: 'left' | 'right';

  /**
   * When element is disabled, a special `disabled` modifier is automatically added, and all its
   * user interactions are disabled. Defaults to `false`.
   */
  disabled?: boolean;

  /**
   * File picker's value. Updating this prop with a new value will replace the current value by
   * the one passed.
   */
  value?: File | File[];

  /** Element's label. Supports light markdown. */
  label?: string;

  /** Element's helper. Supports light markdown. */
  helper?: string;

  /** List of modifiers to apply to the element. Defaults to `""`. */
  modifiers?: string;

  /** Element's placeholder. */
  placeholder?: string;

  /**
   * `blur` event handler.
   *
   * @param value Current file picker's value.
   *
   * @param event `blur` DOM event.
   */
  onBlur?: (value: File | File[], event: FocusEvent) => void;

  /**
   * `focus` event handler.
   *
   * @param value Current file picker's value.
   *
   * @param event `focus` DOM event.
   */
  onFocus?: (value: File | File[], event: FocusEvent) => void;

  /**
   * `change` event handler.
   *
   * @param value Current file picker's value.
   *
   * @param event `input` DOM event.
   */
  onChange?: (value: File | File[], event: InputEvent) => void;
}
