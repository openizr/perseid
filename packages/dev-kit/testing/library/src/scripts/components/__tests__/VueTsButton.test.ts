/**
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/vue';
import VueTsButton from 'scripts/components/VueTsButton.vue';

describe('vue/VueTsButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly - basic', () => {
    const { container } = render(VueTsButton, {
      props: { label: 'Test' },
    });
    expect(container.firstChild).toMatchSnapshot();
  });
});
