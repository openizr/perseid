/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import type Engine from '@perseid/form';
import { render } from '@testing-library/react';
import { type DefaultDataModel } from '@perseid/core';
import FormField from 'scripts/react/components/FormField';

type Services = CommonProps<DefaultDataModel>['services'];

function SubField(): JSX.Element {
  return <div id="field" />;
}

describe('scripts/react/components/FormField', () => {
  vi.mock('biuty/react');
  vi.mock('@perseid/core');
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
        active={false}
        required={false}
        status="initial"
        Field={SubField}
        useSubscription={vi.fn}
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
        active={false}
        required={false}
        status="initial"
        Field={SubField}
        useSubscription={vi.fn}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - Textfield, update on change', () => {
    const Field = FormField({
      'root.0.field': {
        component: 'Textfield',
        componentProps: {
          modifiers: 'test',
          updateOnBlur: false,
        },
      },
    }, context);
    const { container } = render(
      <Field
        active
        required
        type="null"
        error={null}
        value={null}
        status="initial"
        engine={engine}
        Field={SubField}
        path="root.0.field"
        useSubscription={vi.fn}
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
        active
        required
        type="null"
        error={null}
        value={null}
        status="initial"
        engine={engine}
        Field={SubField}
        path="root.0.field"
        useSubscription={vi.fn}
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
        active
        engine={engine}
        path="root.0.field"
        type="null"
        error={null}
        value={null}
        required={false}
        status="initial"
        Field={SubField}
        useSubscription={vi.fn}
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
        active
        required
        type="null"
        error={null}
        status="initial"
        engine={engine}
        Field={SubField}
        path="root.0.field"
        useSubscription={vi.fn}
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
        active
        required
        type="null"
        error={null}
        value={null}
        status="initial"
        engine={engine}
        Field={SubField}
        path="root.0.field"
        useSubscription={vi.fn}
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
        active
        required
        type="null"
        error={null}
        value={null}
        status="initial"
        engine={engine}
        Field={SubField}
        path="root.0.field"
        useSubscription={vi.fn}
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
        active
        required
        type="null"
        error={null}
        value={null}
        status="initial"
        engine={engine}
        Field={SubField}
        path="root.0.field"
        useSubscription={vi.fn}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
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
        active
        required
        type="null"
        error={null}
        value={null}
        status="initial"
        engine={engine}
        Field={SubField}
        path="root.0.field"
        useSubscription={vi.fn}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - Object, required', () => {
    const Field = FormField({
      'root.0.field': {
        component: 'Object',
        componentProps: { modifiers: 'test' },
      },
    }, context);
    const { container } = render(
      <Field
        active
        required
        type="null"
        error={null}
        value={null}
        status="initial"
        engine={engine}
        Field={SubField}
        path="root.0.field"
        useSubscription={vi.fn}
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
        active
        type="null"
        error={null}
        value={null}
        status="initial"
        engine={engine}
        Field={SubField}
        required={false}
        path="root.0.field"
        useSubscription={vi.fn}
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
        active
        required
        type="null"
        error={null}
        value={null}
        status="initial"
        engine={engine}
        Field={SubField}
        path="root.0.field"
        useSubscription={vi.fn}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
