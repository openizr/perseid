/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import type Engine from '@perseid/form';
import { render } from '@testing-library/react';
import FormField from 'scripts/react/components/FormField';

type Services = ReactCommonProps['services'];

function SubField(): JSX.Element {
  return <div id="field" />;
}

describe('scripts/react/components/FormField', () => {
  vi.mock('@perseid/core');
  vi.mock('@perseid/ui/react');
  vi.mock('scripts/react/components/LazyOptions');
  vi.mock('scripts/react/components/NestedFields');
  vi.mock('scripts/react/components/OptionalField');

  const engine = { userAction: vi.fn() } as unknown as Engine;
  const context = {
    prefix: 'TEST_PREFIX',
    services: {
      store: {},
      i18n: { t: vi.fn((label: string) => label) },
    } as unknown as Services,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - unknown', () => {
    const Field = FormField({
      'root.0.field': {
        component: 'Unknown',
        componentProps: {
          placeholder: 'test',
        },
      },
    }, context);
    const { container } = render(
      <Field
        engine={engine}
        path="root.0.field"
        type="null"
        value={null}
        error="TEST"
        isActive={false}
        isRequired={false}
        status="initial"
        Field={SubField}
        setActiveStep={vi.fn()}
        useSubscription={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - Button', () => {
    const Field = FormField({ 'root.0.field': { component: 'Button' } }, context);
    const { container } = render(
      <Field
        engine={engine}
        path="root.0.field"
        type="null"
        error={null}
        value={null}
        isActive={false}
        isRequired={false}
        status="initial"
        Field={SubField}
        setActiveStep={vi.fn()}
        useSubscription={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - Textfield, update on change', () => {
    const Field = FormField({
      'root.0.field': {
        component: 'Textfield',
        componentProps: { modifiers: 'test' },
      },
    }, context);
    const { container } = render(
      <Field
        isActive
        isRequired
        type="null"
        error={null}
        value={null}
        status="initial"
        engine={engine}
        Field={SubField}
        path="root.0.field"
        setActiveStep={vi.fn()}
        useSubscription={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - Textfield, update on blur', () => {
    const Field = FormField({
      'root.0.field': {
        component: 'Textfield',
        componentProps: {
          modifiers: 'test',
        },
      },
    }, context);
    const { container } = render(
      <Field
        isActive
        isRequired
        type="null"
        error={null}
        value={null}
        status="initial"
        engine={engine}
        Field={SubField}
        path="root.0.field"
        setActiveStep={vi.fn()}
        useSubscription={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - Textarea', () => {
    const Field = FormField({
      'root.0.field': {
        component: 'Textarea',
        componentProps: {
          readOnly: true,
        },
      },
    }, context);
    const { container } = render(
      <Field
        isActive
        engine={engine}
        path="root.0.field"
        type="null"
        error={null}
        value={null}
        isRequired={false}
        status="initial"
        Field={SubField}
        setActiveStep={vi.fn()}
        useSubscription={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - DatePicker, value is a date', () => {
    const Field = FormField({
      'root.0.field': {
        component: 'DatePicker',
        componentProps: { modifiers: 'test' },
      },
    }, context);
    const { container } = render(
      <Field
        isActive
        isRequired
        type="null"
        error={null}
        status="initial"
        engine={engine}
        Field={SubField}
        path="root.0.field"
        setActiveStep={vi.fn()}
        useSubscription={vi.fn()}
        value={new Date('2023/01/01')}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - DatePicker, value is not a date', () => {
    const Field = FormField({
      'root.0.field': {
        component: 'DatePicker',
        componentProps: { modifiers: 'test' },
      },
    }, context);
    const { container } = render(
      <Field
        isActive
        isRequired
        type="null"
        error={null}
        value={null}
        status="initial"
        engine={engine}
        Field={SubField}
        path="root.0.field"
        setActiveStep={vi.fn()}
        useSubscription={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - FilePicker', () => {
    const Field = FormField({
      'root.0.field': {
        component: 'FilePicker',
        componentProps: { modifiers: 'test' },
      },
    }, context);
    const { container } = render(
      <Field
        isActive
        isRequired
        type="null"
        error={null}
        value={null}
        status="initial"
        engine={engine}
        Field={SubField}
        path="root.0.field"
        setActiveStep={vi.fn()}
        useSubscription={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - Options', () => {
    const Field = FormField({
      'root.0.field': {
        component: 'Options',
        componentProps: { modifiers: 'test', options: [{ type: 'option', value: 'test' }] },
      },
    }, context);
    const { container } = render(
      <Field
        isActive
        isRequired
        error={null}
        value={null}
        type="boolean"
        status="initial"
        engine={engine}
        Field={SubField}
        path="root.0.field"
        setActiveStep={vi.fn()}
        useSubscription={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
    expect(engine.userAction).toHaveBeenCalledTimes(2);
    expect(engine.userAction).toHaveBeenCalledWith({ data: false, path: 'root.0.field', type: 'input' });
    expect(engine.userAction).toHaveBeenCalledWith({ data: 'test', path: 'root.0.field', type: 'input' });
  });

  test('renders correctly - Message', () => {
    const Field = FormField({
      'root.0.field': {
        component: 'Message',
        componentProps: { modifiers: 'test' },
      },
    }, context);
    const { container } = render(
      <Field
        isActive
        isRequired
        type="null"
        error={null}
        value={null}
        status="initial"
        engine={engine}
        Field={SubField}
        path="root.0.field"
        setActiveStep={vi.fn()}
        useSubscription={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - Object, isRequired', () => {
    const Field = FormField({
      'root.0.field': {
        component: 'Object',
        componentProps: { modifiers: 'test' },
      },
    }, context);
    const { container } = render(
      <Field
        isActive
        isRequired
        type="null"
        error={null}
        value={null}
        status="initial"
        engine={engine}
        Field={SubField}
        path="root.0.field"
        setActiveStep={vi.fn()}
        useSubscription={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - Object, optional', () => {
    const Field = FormField({
      'root.0.field': {
        component: 'Object',
        componentProps: { modifiers: 'test' },
      },
    }, context);
    const { container } = render(
      <Field
        isActive
        type="null"
        error={null}
        value={null}
        status="initial"
        engine={engine}
        Field={SubField}
        isRequired={false}
        path="root.0.field"
        setActiveStep={vi.fn()}
        useSubscription={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - LazyOptions', () => {
    const Field = FormField({
      'root.0.field': {
        component: 'LazyOptions',
        componentProps: { modifiers: 'test' },
      },
    }, context);
    const { container } = render(
      <Field
        isActive
        isRequired
        type="null"
        error={null}
        value={null}
        status="initial"
        engine={engine}
        Field={SubField}
        path="root.0.field"
        setActiveStep={vi.fn()}
        useSubscription={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
