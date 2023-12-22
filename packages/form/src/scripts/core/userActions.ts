/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { Module } from '@perseid/store';

/**
 * Handles all user actions in form.
 */
export default {
  state: null,
  mutations: {
    ADD(_api, mutation: UserAction | null) {
      return mutation;
    },
  },
} as Module<UserAction | null>;
