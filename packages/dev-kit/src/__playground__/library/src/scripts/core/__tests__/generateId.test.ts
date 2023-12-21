/**
 * @vitest-environment jsdom
 */

import generateId from 'scripts/core/generateId';

describe('generateId', () => {
  let windowSpy = vi.spyOn(global, 'window', 'get');

  beforeEach(() => {
    windowSpy.mockClear();
  });

  test('should generate a unique id - node environment', () => {
    windowSpy = vi.spyOn(global, 'window', 'get');
    windowSpy.mockImplementation(() => undefined as unknown as Window & typeof globalThis);
    expect(generateId().length).toBe(40);
  });

  test('should generate a unique id - browser environment', () => {
    windowSpy.mockImplementation(() => ({
      crypto: {
        getRandomValues: <T>(): T => [15616516, 4651848654, 549875987, 87897985] as T,
      } as unknown as Crypto,
    }) as unknown as Window & typeof globalThis);
    expect(generateId().length).toBe(40);
  });
});
