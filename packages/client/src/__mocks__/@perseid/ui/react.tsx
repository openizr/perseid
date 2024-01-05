/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';

/**
 * `@perseid/ui/react` mock.
 */

interface ComponentProps {
  [key: string]: unknown;
  onClick?: (event: Event) => void;
  onBlur?: (value: string) => void;
  onFocus?: (value: string) => void;
  onChange?: (newValue: string) => void;
  onKeyDown?: (value: string, event: KeyboardEvent) => void;
  columns: { component: React.ReactNode; path: string; }[];
}

function Component(type: string): (props: ComponentProps) => JSX.Element {
  return function RealComponent({
    onBlur,
    onClick,
    onFocus,
    onChange,
    onKeyDown,
    ...props
  }) {
    React.useEffect(() => {
      // Covers `onChange` handler.
      if (onChange !== undefined) {
        onChange((props.value === '2023-01-01T00:00:00.000Z')
          ? '2023-01-02T00:00:00.000Z'
          : process.env.VALUE ?? 'test');
      }
      // Covers `onBlur` handler.
      if (onBlur !== undefined) {
        onBlur('test');
      }
      // Covers `onKeyDown` handler.
      if (onKeyDown !== undefined) {
        onKeyDown('test', { key: 'ArrowDown' } as KeyboardEvent);
      }
      // Covers `onFocus` handler.
      if (onFocus !== undefined) {
        onFocus('test');
      }
      // Covers `onClick` handler.
      if (onClick !== undefined) {
        onClick({ preventDefault: vi.fn() } as unknown as Event);
      }
    }, []);
    if (type === 'ui-options') {
      return (
        <div id={type}>
          {JSON.stringify(props)}
          <span>
            <span />
            <span>
              <span />
            </span>
          </span>
        </div>
      );
    }
    if (type === 'ui-textfield') {
      return (
        <div id={type} onFocus={onFocus as unknown as React.FocusEventHandler}>
          {JSON.stringify(props)}
          <span className="ui-textfield__wrapper__field" />
        </div>
      );
    }
    return <div id={type}>{JSON.stringify(props)}</div>;
  };
}

export const UIP = Component('ui-p');
export const UILink = Component('ui-link');
export const UIImage = Component('ui-image');
export const UITitle = Component('ui-title');
export const UIButton = Component('ui-button');
export const UIOptions = Component('ui-options');
export const UITextarea = Component('ui-textarea');
export const UITextfield = Component('ui-textfield');
export const UIFilePicker = Component('ui-file-picker');
export const generateRandomId = vi.fn(() => '18972182');
export const buildClass = vi.fn((...values: string[]): string => values.join(' '));
export const markdown = vi.fn((label: string, lightMode: boolean) => `MARKDOWN FOR ${label}, ${lightMode}`);
