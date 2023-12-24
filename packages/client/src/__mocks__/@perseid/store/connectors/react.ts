/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `@perseid/store/connectors/react` mock.
 */

export default vi.fn(() => vi.fn((module: string) => {
  if (module === 'router') {
    return (process.env.NOT_FOUND === 'true')
      ? { route: null }
      : { route: process.env.PAGE };
  }
  return (process.env.ERROR === 'true')
    ? new Error('test')
    : null;
}));
