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
import Grid from 'scripts/react/components/Grid';

describe('react/components/Grid', () => {
  vi.mock('@perseid/ui/react');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly', () => {
    vi.spyOn(window, 'addEventListener').mockImplementation((_: string, callback: unknown) => {
      (callback as (event: Event) => void)({ key: 'm', ctrlKey: true } as unknown as Event);
    });
    const { container } = render(
      <Grid
        columns={{ desktop: 12, mobile: 4, tablet: 8 }}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
