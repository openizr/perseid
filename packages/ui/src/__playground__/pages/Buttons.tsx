/* c8 ignore start */

import * as React from 'react';
import { UIButton } from 'scripts/react/index';

const { log } = console;

const onClick = (): void => {
  log('Clicked!');
};

const onFocus = (): void => {
  log('Focused!');
};

export default function Buttons(): JSX.Element {
  return (
    <div>
      <main className="grid cols-1 hgap-3 vgap-5">
        <a href="/react">GO BACK</a>
        <UIButton label="ui-button" />
        <UIButton label="ui-button icon left" icon="star" />
        <UIButton label="ui-button icon right" icon="star" iconPosition="right" />
        <UIButton label="ui-button disabled" modifiers="disabled" />
        <UIButton label="ui-button with listener" onClick={onClick} />
        <UIButton label="ui-button with type submit" type="submit" />
        <UIButton label="ui-button with focus listener" onFocus={onFocus} />
        <UIButton icon="star" onFocus={onFocus} />
        <UIButton label="ui-button test1" modifiers="test1" />
        <UIButton label="ui-button test2" modifiers="test2" />
        <UIButton label="ui-button test1 test2" modifiers="test1 test2" />
      </main>
    </div>
  );
}
