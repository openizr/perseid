/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Model from 'scripts/core/services/Model';
import { type DefaultDataModel, deepMerge } from '@perseid/core';

describe('core/services/Model', () => {
  vi.mock('@perseid/core');

  let model: Model;

  beforeEach(() => {
    vi.clearAllMocks();
    model = new Model();
  });

  test('[update]', () => {
    model.update({ users: { test: { type: 'string' } } } as unknown as Partial<DefaultDataModel>);
    expect(deepMerge).toHaveBeenCalledOnce();
    expect(deepMerge).toHaveBeenCalledWith(undefined, { users: { test: { type: 'string' } } });
  });
});
