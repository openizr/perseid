/* c8 ignore start */

import * as React from 'react';
import { UIOptions } from 'scripts/react/index';

const { log } = console;

const onChange = (value: string | string[]): void => {
  log('Changed!', value);
};

const onFocus = (value: string): void => {
  log('Focused!', value);
};

const options: UIOptionsOption[] = [
  {
    label: '*Option 1*',
    value: 'option1',
    type: 'option',
  },
  {
    label: 'Option 2',
    value: 'option2',
    type: 'option',
  },
  {
    label: 'Option 3',
    value: 'option3',
    type: 'option',
  },
  {
    label: 'Option 4',
    value: 'option4',
    type: 'option',
    disabled: true,
  },
];

const selectOptions: Option[] = [
  {
    label: '*Group 1*',
    type: 'header',
  },
  {
    label: '^Option^ & 1',
    value: 'option1',
    disabled: false,
    type: 'option',
  },
  {
    label: 'Option 2',
    value: 'option2',
    disabled: true,
    type: 'option',
  },
  {
    type: 'divider',
  },
  {
    label: 'Option 4',
    value: 'option4',
    disabled: false,
    type: 'option',
  },
  {
    label: 'Option 5',
    value: 'option5',
    disabled: false,
    type: 'option',
  },
  {
    label: 'Option 6',
    value: 'option6',
    disabled: false,
    type: 'option',
  },
];
/**
 * Options page.
 */
export default function Options(): JSX.Element {
  const [newValue, setNewValue] = React.useState('option3');
  const [v, setV] = React.useState<Option[]>([
    {
      label: '*Option 1*',
      value: 'option1',
      type: 'option',
    },
    {
      label: 'Option 2',
      value: 'option2',
      type: 'option',
    },
    {
      label: 'Option 3',
      value: 'option3',
      type: 'option',
    },
    {
      label: 'Option 4',
      value: 'option4',
      type: 'option',
      disabled: true,
    },
  ]);

  React.useEffect(() => {
    setTimeout(() => {
      setNewValue('option1');
      setV([
        {
          label: '*Option 1*',
          value: 'option1',
          type: 'option',
        },
      ]);
    }, 3000);
  }, []);

  return (
    <div>
      <main className="grid cols-1 hgap-3 vgap-5">
        <a href="/react">GO BACK</a>
        {/* Single */}
        <UIOptions name="radio1" value="option3" options={options} />
        <UIOptions name="radio2" value="option3" label="*Radio*" options={options} />
        <UIOptions name="radio3" value={newValue} label="Radio with value" options={options} />
        <UIOptions name="radio4" value="option3" label="Radio with helper" helper="helper" options={options} />
        <UIOptions name="radio5" value="option3" label="Radio with listener" onChange={onChange} options={options} />
        <UIOptions name="radio6" value="option3" label="Radio disabled" options={v} modifiers="disabled" />
        <UIOptions name="radio7" value="option3" label="Radio with focus listener" onFocus={onFocus} options={options} />

        {/* Multiple */}
        <UIOptions name="checkbox6" options={options} multiple label="Checkboxes disabled" onFocus={onFocus} onChange={onChange} />
        <UIOptions name="checkbox1" multiple options={options} />
        <UIOptions name="checkbox2" multiple options={options} label="*Checkboxes*" />
        <UIOptions name="checkbox4" multiple options={options} label="Checkboxes with helper" helper="helper" />
        <UIOptions name="checkbox3" multiple options={options} label="Checkboxes with value" value={[newValue]} />
        <UIOptions name="checkbox5" multiple options={v} label="Checkboxes with listener" onChange={onChange} />
        <UIOptions name="checkbox7" multiple options={options} label="Checkboxes with focus listener" onFocus={onFocus} />

        {/* Selects */}
        <UIOptions name="dropdown1" select options={selectOptions} value={['option1']} label="*Select*" onChange={onChange} />
        <UIOptions name="dropdown2" select options={selectOptions} value={['option1']} label="Select disabled" />
        <UIOptions name="dropdown3" select options={selectOptions} value="option1" label="Select large" onFocus={onFocus} onChange={onChange} />
        <UIOptions name="dropdown4" select options={selectOptions} value={newValue} label="Select large" selectPosition="bottom" />
        <UIOptions name="dropdown5" select options={selectOptions} value={['option1']} label="Select" modifiers="disabled" />
        <UIOptions name="dropdown6" select options={selectOptions} value="option4" multiple label="Select with focus listener" onFocus={onFocus} onChange={onChange} />
        <UIOptions name="dropdown7" select options={selectOptions} label="Select with placeholder" placeholder="test" />
        <UIOptions name="dropdown8" select options={selectOptions} label="Select with no placeholder" />
        <UIOptions name="dropdown9" select options={selectOptions} value="option4" expanded label="Select expanded" />
      </main>
    </div>
  );
}

Options.displayName = 'Options';
