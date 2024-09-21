/* c8 ignore start */

<script lang="ts">
  import { onMount } from 'svelte';
  import { UIOptions } from 'scripts/svelte/index';

  const { log } = console;

  const onChange = (value: string | string[]): void => {
    log('Changed!', value);
  };

  const onFocus = (value: string): void => {
    log('Focused!', value);
  };

  let newValue = 'option3';
  const options: Option[] = [
    {
      type: 'option',
      label: '*Option 1*',
      value: 'option1',
    },
    {
      type: 'option',
      label: 'Option 2',
      value: 'option2',
    },
    {
      type: 'option',
      label: 'Option 3',
      value: 'option3',
    },
    {
      type: 'option',
      label: 'Option 4',
      value: 'option4',
      disabled: true,
    },
  ];

  const selectOptions: Option[] = [
    {
      label: '*Group 1*',
      type: 'header',
    },
    {
      label: '**Option** & 1',
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

  let v = selectOptions;
  onMount(() => {
    setTimeout(() => {
      newValue = 'option1';
      v = selectOptions.slice(0, 3);
    }, 3000);
  });
</script>

<div class="vgap-5">
  <main class="grid cols-1 hgap-3 vgap-5">
    <a href="/svelte" class="cols-l-3">GO BACK</a>
    <!-- Single -->
    <UIOptions name="radio1" {options} />
    <UIOptions name="radio2" value="option3" label="*Radio*" {options} />
    <UIOptions
      name="radio3"
      value={newValue}
      label="Radio with value"
      {options}
    />
    <UIOptions
      name="radio4"
      value="option3"
      label="Radio with helper"
      helper="helper"
      {options}
    />
    <UIOptions
      name="radio5"
      value="option3"
      label="Radio with listener"
      {options}
      onChange={onChange}
    />
    <UIOptions name="radio6" value="option3" label="Radio disabled" {options} />
    <UIOptions
      name="radio7"
      value="option3"
      label="Radio with focus listener"
      {options}
      onFocus={onFocus}
    />

    <!-- Multiple -->
    <UIOptions
      name="checkbox6"
      {options}
      multiple
      label="Checkboxes disabled"
      onFocus={onFocus}
      onChange={onChange}
    />
    <UIOptions name="checkbox1" multiple {options} />
    <UIOptions name="checkbox2" multiple {options} label="*Checkboxes*" />
    <UIOptions
      name="checkbox4"
      multiple
      options={v}
      label="Checkboxes with helper"
      helper="helper"
    />
    <UIOptions
      name="checkbox3"
      multiple
      {options}
      label="Checkboxes with value"
      value={newValue}
    />
    <UIOptions
      name="checkbox5"
      multiple
      {options}
      label="Checkboxes with listener"
      onChange={onChange}
    />
    <UIOptions
      name="checkbox7"
      multiple
      {options}
      label="Checkboxes with focus listener"
      onFocus={onFocus}
    />

    <!-- Selects -->
    <UIOptions
      name="dropdown1"
      select
      options={selectOptions}
      value={['option1']}
      label="*Select*"
      onChange={onChange}
    />
    <UIOptions
      name="dropdown2"
      select
      options={selectOptions}
      value={['option1']}
      label="Select disabled"
    />
    <UIOptions
      name="dropdown3"
      select
      options={selectOptions}
      value="option1"
      label="Select large"
      onFocus={onFocus}
      onChange={onChange}
    />
    <UIOptions
      name="dropdown4"
      select
      options={selectOptions}
      value={newValue}
      label="Select large"
      selectPosition="bottom"
    />
    <UIOptions
      name="dropdown5"
      select
      options={selectOptions}
      value={['option1']}
      label="Select"
      modifiers="disabled"
    />
    <UIOptions
      name="dropdown6"
      select
      options={selectOptions}
      value="option1"
      multiple
      label="Select with focus listener"
      onFocus={onFocus}
      onChange={onChange}
    />
    <UIOptions
      name="dropdown7"
      select
      options={selectOptions}
      placeholder="test"
      label="Select with placeholder"
    />
    <UIOptions
      name="dropdown8"
      select
      options={selectOptions}
      label="Select with no placeholder"
    />
    <UIOptions
      name="dropdown9"
      select
      options={selectOptions}
      value="option4"
      expanded
      label="Select expanded"
    />
  </main>
</div>
