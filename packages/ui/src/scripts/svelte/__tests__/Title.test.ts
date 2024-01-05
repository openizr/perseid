/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import UITitle from 'scripts/svelte/Title.svelte';
import { render } from '@testing-library/svelte';

describe('svelte/UITitle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - level 1', () => {
    const { container } = render(UITitle, { props: { label: 'Test', modifiers: 'large' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - level 2', () => {
    const { container } = render(UITitle, { props: { label: 'Test', level: '2' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - level 3', () => {
    const { container } = render(UITitle, { props: { label: 'Test', level: '3' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - level 4', () => {
    const { container } = render(UITitle, { props: { label: 'Test', level: '4' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - level 5', () => {
    const { container } = render(UITitle, { props: { label: 'Test', level: '5' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - level 6', () => {
    const { container } = render(UITitle, { props: { label: 'Test', level: '6' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - modifier different than level', () => {
    const { container } = render(UITitle, { props: { label: 'Test', level: '1', modifiers: '5 large' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with id', () => {
    const { container } = render(UITitle, { props: { label: 'Test', id: 'test' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with itemprop', () => {
    const { container } = render(UITitle, { props: { label: '*Test*', itemProp: 'name' } });
    expect(container.firstChild).toMatchSnapshot();
  });
});
