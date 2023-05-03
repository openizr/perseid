/**
 * @vitest-environment jsdom
 */

import generateJsId from 'scripts/core/generateJsId';

describe('generateId', () => {
  let windowSpy = vi.spyOn(global, 'window', 'get');

  beforeEach(() => {
    windowSpy.mockClear();
  });

  test('should generate a unique id - node environment', () => {
    windowSpy = vi.spyOn(global, 'window', 'get');
    windowSpy.mockImplementation(() => undefined);
    expect(generateJsId().length).toBe(40);
  });

  test('should generate a unique id - browser environment', () => {
    windowSpy = vi.spyOn(global, 'window', 'get');
    windowSpy.mockImplementation(() => ({
      crypto: {
        getRandomValues: () => [15616516, 4651848654, 549875987, 87897985],
      },
    }));
    expect(generateJsId().length).toBe(40);
  });
});
