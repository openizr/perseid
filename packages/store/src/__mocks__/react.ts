/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

export function useState(callback: () => string): (string | (() => null))[] {
  return [callback(), (): null => null];
}

export function useEffect(effect: () => () => void): () => void {
  // Simulates both component mounting and unmounting.
  const callback = effect();
  callback();
  return callback;
}
