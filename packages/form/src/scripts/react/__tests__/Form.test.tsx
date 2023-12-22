/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import Form from 'scripts/react/Form';
import type Engine from 'scripts/core/Engine';
import { type FormLayoutProps } from 'scripts/react/DefaultLayout';
import { render, fireEvent, createEvent } from '@testing-library/react';

function Loader(): null {
  return null;
}

function Step(props: unknown): JSX.Element {
  return <div id="step">{JSON.stringify(props)}</div>;
}

function Layout({ steps, ...props }: FormLayoutProps): JSX.Element {
  return (
    <div>
      {steps}
      {JSON.stringify(props)}
    </div>
  );
}

describe('react/Form', () => {
  vi.mock('scripts/core/Engine', () => ({ default: vi.fn() }));
  vi.mock('@perseid/store/connectors/react', () => ({
    default: vi.fn(() => (): unknown => ({
      steps: [{
        path: 'root.0',
        status: 'initial',
        fields: [{
        }],
      }],
    })),
  }));

  class CustomEngine {
    public getStore = vi.fn();
  }

  const configuration: Configuration = {
    id: 'test',
    root: 'start',
    fields: { test: { type: 'string' } },
    steps: { root: { fields: ['test'] } },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LOADING;
  });

  test('renders correctly - loading next step', () => {
    process.env.LOADING = 'true';
    const { container, rerender } = render(
      <Form
        Step={Step}
        Loader={Loader}
        Layout={Layout}
        configuration={configuration}
        engineClass={CustomEngine as unknown as typeof Engine}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
    // Covers React.memo checks.
    rerender(
      <Form
        Step={Step}
        Loader={Loader}
        Layout={Layout}
        configuration={configuration}
        engineClass={CustomEngine as unknown as typeof Engine}
      />,
    );
    rerender(
      <Form
        Step={Step}
        Loader={Loader}
        Layout={Layout}
        configuration={configuration}
        engineClass={CustomEngine as unknown as typeof Engine}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with active step', () => {
    const { container } = render(
      <Form
        Step={Step}
        Loader={Loader}
        Layout={Layout}
        activeStep="second.0"
        configuration={configuration}
        engineClass={CustomEngine as unknown as typeof Engine}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
    const step = container.querySelector('#step');
    fireEvent.focus(step as HTMLElement);
    expect(container.firstChild).toMatchSnapshot();
  });

  test('prevents native form submission', () => {
    const { container } = render(
      <Form
        Step={Step}
        Loader={Loader}
        Layout={Layout}
        configuration={configuration}
        engineClass={CustomEngine as unknown as typeof Engine}
      />,
    );
    const form = container.getElementsByTagName('form')[0];
    const event = createEvent.submit(form);
    event.preventDefault = vi.fn();
    fireEvent(form, event);
    expect(event.preventDefault).toHaveBeenCalled();
  });
});
