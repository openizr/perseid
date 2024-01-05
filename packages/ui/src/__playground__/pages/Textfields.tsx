/* c8 ignore start */

import * as React from 'react';
import { UITextfield } from 'scripts/react/index';

const { log } = console;

const onChange = (value: string): void => {
  log('Changed!', value);
};

const onBlur = (value: string): void => {
  log('Blurred!', value);
};

const onFocus = (): void => {
  log('Focused!');
};

const onIconClick = (): void => {
  log('Clicked!');
};

const onKeyDown = (_: string, event: KeyboardEvent): void => {
  log('onKeyDown!', event.shiftKey);
};

/**
 * Textfields page.
 */
export default function Textfields(): JSX.Element {
  const [newValue, setNewValue] = React.useState('test');

  React.useEffect(() => {
    setTimeout(() => {
      setNewValue('new test');
    }, 3000);
  }, []);

  return (
    <div className="vgap-5">
      <main className="grid cols-1 hgap-3 vgap-5">
        <a href="/react" className="cols-l-3">GO BACK</a>
        <UITextfield name="textfield1" />
        <UITextfield name="textfield2" label="*ui-textfield*" />
        <UITextfield name="textfield3" label="ui-textfield readonly" readonly />
        <UITextfield name="textfield3" label="ui-textfield with autofocus" autofocus />
        <UITextfield name="textfield4" label="ui-textfield with value" value={newValue} />
        <UITextfield name="textfield5" label="ui-textfield with helper" helper="helper" />
        <UITextfield name="textfield6" label="ui-textfield with listener" onChange={onChange} />
        <UITextfield name="textfield7" label="ui-textfield with blur listener" onBlur={onBlur} />
        <UITextfield name="textfield8" label="ui-textfield with maxlength" maxlength={10} />
        <UITextfield name="textfield9" label="ui-textfield with placeholder" placeholder="placeholder" />
        <UITextfield name="textfield10" label="ui-textfield with password type" type="password" size={10} />
        <UITextfield name="textfield11" label="ui-textfield disabled" modifiers="disabled" />
        <UITextfield name="textfield12" label="ui-textfield icon left" icon="star" />
        <UITextfield name="textfield13" label="ui-textfield icon right" icon="star" iconPosition="right" />
        <UITextfield name="textfield14" label="ui-textfield icon with listener" icon="star" onIconClick={onIconClick} />
        <UITextfield name="textfield15" label="ui-textfield with focus listener" onFocus={onFocus} />
        <UITextfield name="textfield17" label="ui-textfield with debounce" onChange={onChange} debounceTimeout={250} />
        <UITextfield name="textfield18" label="ui-textfield with type number" type="number" min={0} max={30} step={5} />
        <UITextfield
          name="textfield18"
          label="ui-textfield with type onKeyDown"
          onKeyDown={onKeyDown}
          allowedKeys={{ default: /[0-9()-]| / }}
          maxlength={14}
          transform={(value, start): [string, number?] => {
            const stripedValue = value.replace(/(\(|\)|-| )/ig, '');
            const { length } = stripedValue;
            if (length >= 7) {
              let e;
              if (!(length === 7 && !value.includes('-')) && start !== 10) {
                e = start;
              }
              return [`(${stripedValue.slice(0, 3)}) ${stripedValue.slice(3, 6)}-${stripedValue.slice(6, 10)}`, e];
            }
            if (length >= 4) {
              return [`(${stripedValue.slice(0, 3)}) ${stripedValue.slice(3)}`, start];
            }
            if (length >= 3 && value.length < 4) {
              return [`(${stripedValue.slice(0, 3)}) `, 6];
            }
            return [stripedValue, start];
          }}
        />
      </main>
    </div>
  );
}

Textfields.displayName = 'Textfields';
