/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * @perseid/store/connectors/react mock.
 */
export default function useStore(): unknown {
  return vi.fn(() => ({
    steps: [{ id: 'start' }, { id: 'end' }],
    loading: process.env.LOADING === 'true',
  }));
}
