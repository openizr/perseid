/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import UIIcon from 'scripts/vue/UIIcon.vue';
import { render } from '@testing-library/vue';

describe('vue/UIIcon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(UIIcon, { props: { name: 'star', modifiers: 'large' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with id', () => {
    const { container } = render(UIIcon, { props: { name: 'star', id: 'test' } });
    expect(container.firstChild).toMatchSnapshot();
  });
});
