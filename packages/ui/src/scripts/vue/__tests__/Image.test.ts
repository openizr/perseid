/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import UIImage from 'scripts/vue/UIImage.vue';
import { render } from '@testing-library/vue';

describe('vue/UIImage', () => {
  vi.mock('scripts/core/index');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(UIImage, {
      props: {
        alt: 'test', ratio: 'square', src: 'https://test.com/a.jpg', modifiers: 'large',
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - no lazy', () => {
    const { container } = render(UIImage, {
      props: {
        alt: 'test',
        lazy: false,
        ratio: 'square',
        modifiers: 'large',
        src: 'https://test.com/a.jpg',
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - custom ratio', () => {
    const { container } = render(UIImage, { props: { alt: 'test', ratio: '25x32', src: 'https://test.com/a.jpg' } });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with id', () => {
    const { container } = render(UIImage, {
      props: {
        id: 'test', alt: 'test', ratio: 'portrait', src: 'https://test.com/a.jpg',
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - standard ratio with itemprop', () => {
    const { container } = render(UIImage, {
      props: {
        itemProp: 'image', alt: 'test', ratio: 'landscape', src: 'https://test.com/a.jpg',
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - custom ratio with itemprop', () => {
    const { container } = render(UIImage, {
      props: {
        itemProp: 'image', alt: 'test', ratio: '1x5', src: 'https://test.com/a.jpg',
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - no lazy custom ratio', () => {
    const { container } = render(UIImage, {
      props: {
        alt: 'test',
        lazy: false,
        ratio: '1x5',
        modifiers: 'large',
        src: 'https://test.com/a.jpg',
      },
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - with panoramic ratio', () => {
    const { container } = render(UIImage, { props: { alt: 'test', ratio: 'panoramic', src: 'https://test.com/a.jpg' } });
    expect(container.firstChild).toMatchSnapshot();
  });
});
