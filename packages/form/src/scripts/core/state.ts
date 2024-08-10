/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { type Module } from '@perseid/store';

/**
 * Form state data.
 */
export interface FormState {
  /** All generated form steps. */
  steps: Step[];

  /** Whether next step is being loaded. */
  loading: boolean;

  /** User-defined variables that can be accessed at any point in the form. */
  variables: Variables;

  /** List of both full and partial user inputs for all displayed fields. */
  userInputs: { full: UserInputs; partial: UserInputs; };
}

/**
 * Handles state lifecycle in form.
 */
export default {
  state: {
    steps: [],
    loading: true,
    variables: {},
    userInputs: { full: {}, partial: {} },
  },
  mutations: {
    UPDATE(_, mutation: FormState) {
      return {
        steps: mutation.steps,
        loading: mutation.loading,
        variables: mutation.variables,
        userInputs: mutation.userInputs,
      };
    },
    SET_LOADER({ state }, loading: boolean) {
      return { ...state, loading };
    },
  },
} as Module<FormState>;
