/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import { render } from '@testing-library/react';
import { type DefaultDataModel } from '@perseid/core';
import Pagination from 'scripts/react/components/Pagination';

type Services = CommonProps<DefaultDataModel>['services'];

describe('react/components/Pagination', () => {
  vi.mock('biuty/react');
  vi.mock('@perseid/core');

  const components = {};
  const createServices = (): Services => ({
    model: {},
    store: {},
    apiClient: {},
    i18n: { t: vi.fn((label: string) => label) },
  }) as unknown as Services;

  test('renders correctly - multiple pages', () => {
    const onClick = vi.fn();
    const { container } = render(
      <Pagination
        total={50}
        currentPage={1}
        itemsPerPage={10}
        onClick={onClick}
        components={components}
        services={createServices()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - one page', () => {
    const onClick = vi.fn();
    const { container } = render(
      <Pagination
        total={10}
        currentPage={1}
        itemsPerPage={10}
        onClick={onClick}
        components={components}
        services={createServices()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - last page selected', () => {
    const onClick = vi.fn();
    const { container } = render(
      <Pagination
        total={50}
        currentPage={5}
        itemsPerPage={10}
        onClick={onClick}
        components={components}
        services={createServices()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
