/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import state from 'scripts/core/state';

describe('core/state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('UPDATE', () => {
    expect(state.mutations.UPDATE?.({
      state: {
        steps: [],
        variables: {},
        loading: true,
        userInputs: { full: {}, partial: {} },
      },
      id: 'state',
    }, {
      steps: [1],
      userInputs: { test: 'test' },
      variables: { var1: 'test1' },
      loading: false,
    })).toEqual({
      steps: [1],
      userInputs: { test: 'test' },
      variables: { var1: 'test1' },
      loading: false,
    });
  });

  test('SET_LOADER', () => {
    expect(state.mutations.SET_LOADER?.({
      state: {
        steps: [],
        variables: {},
        loading: true,
        userInputs: { full: {}, partial: {} },
      },
      id: 'state',
    }, false)).toEqual({
      steps: [],
      variables: {},
      loading: false,
      userInputs: { full: {}, partial: {} },
    });
  });
});
