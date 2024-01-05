/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import UILink from 'scripts/vue/UILink.vue';
import { render, fireEvent } from '@testing-library/vue';

describe('vue/UILink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(UILink, { props: { label: 'Test', href: 'https://test.com', modifiers: 'large' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - disabled', () => {
    const { container } = render(UILink, { props: { label: 'Test', href: 'https://test.com', disabled: true } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with id', () => {
    const { container } = render(UILink, { props: { label: 'Test', href: 'https://test.com', id: 'test' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with target', () => {
    const { container } = render(UILink, { props: { label: 'Test', href: 'https://test.com', target: '_blank' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with rel', () => {
    const { container } = render(UILink, { props: { label: 'Test', href: 'https://test.com', rel: 'no referrer' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with listener', async () => {
    const onClick = vi.fn();
    const { container } = render(UILink, { props: { label: 'Test', href: 'https://test.com', onClick } });
    const a = container.getElementsByTagName('a')[0];
    await fireEvent.click(a);
    expect(container.firstChild).toMatchSnapshot();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(expect.any(Object));
  });
});
