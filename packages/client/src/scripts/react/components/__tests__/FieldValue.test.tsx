/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import { type Id } from '@perseid/core';
import { render } from '@testing-library/react';
import FieldValue from 'scripts/react/components/FieldValue';

type Services = CommonProps['services'];

describe('react/components/FieldValue', () => {
  vi.mock('@perseid/core');
  vi.mock('@perseid/ui/react');

  const components = {};
  const createServices = (): Services => ({
    apiClient: {},
    model: {},
    i18n: {
      numeric: vi.fn(() => 1),
      dateTime: vi.fn(() => '2023/01/01'),
      t: vi.fn((label: string) => label),
    },
    store: {
      getValue: vi.fn((_, __, field) => {
        if (field === 'null') {
          return null;
        }
        if (field === 'number') {
          return 300;
        }
        if (field === 'date') {
          return new Date();
        }
        if (field === 'object') {
          return { test: 'value' };
        }
        if (field === 'binary') {
          return new Uint8Array();
        }
        return 'test';
      }),
    },
  }) as unknown as Services;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - classic value', () => {
    const { container } = render(
      <FieldValue
        loading
        page="LIST"
        field="string"
        resource="users"
        components={components}
        services={createServices()}
        registry={{ roles: {}, users: {} }}
        id={'000000000000000000000011' as unknown as Id}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - `null` value, loading', () => {
    const { container } = render(
      <FieldValue
        loading
        field="null"
        page="LIST"
        resource="users"
        components={components}
        services={createServices()}
        registry={{ roles: {}, users: {} }}
        id={'000000000000000000000011' as unknown as Id}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - `null` value, loaded', () => {
    const { container } = render(
      <FieldValue
        field="null"
        page="LIST"
        loading={false}
        resource="users"
        components={components}
        services={createServices()}
        registry={{ roles: {}, users: {} }}
        id={'000000000000000000000011' as unknown as Id}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - numeric value', () => {
    const { container } = render(
      <FieldValue
        field="number"
        page="LIST"
        loading={false}
        resource="users"
        components={components}
        services={createServices()}
        registry={{ roles: {}, users: {} }}
        id={'000000000000000000000011' as unknown as Id}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - date value', () => {
    const { container } = render(
      <FieldValue
        field="date"
        page="LIST"
        loading={false}
        resource="users"
        components={components}
        services={createServices()}
        registry={{ roles: {}, users: {} }}
        id={'000000000000000000000011' as unknown as Id}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - object value', () => {
    const { container } = render(
      <FieldValue
        page="LIST"
        field="object"
        loading={false}
        resource="users"
        components={components}
        services={createServices()}
        registry={{ roles: {}, users: {} }}
        id={'000000000000000000000011' as unknown as Id}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - binary value', () => {
    const { container } = render(
      <FieldValue
        page="LIST"
        field="binary"
        loading={false}
        resource="users"
        components={components}
        services={createServices()}
        registry={{ roles: {}, users: {} }}
        id={'000000000000000000000011' as unknown as Id}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
