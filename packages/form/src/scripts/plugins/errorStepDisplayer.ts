/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `errorStepDisplayer` plugin options.
 */
export interface ErrorStepDisplayerOptions {
  /** Id of the error step in the configuration. */
  stepId: string;

  /** Callback used to set active form step to the error step. */
  setActiveStep: (stepId: string) => void;
}

/**
 * Gracefully handles errors by displaying a generic error step.
 *
 * @param options Plugin options.
 *
 * @returns The actual plugin.
 */
export default function errorStepDisplayer(options: ErrorStepDisplayerOptions): FormPlugin {
  return (engine): void => {
    engine.on('error', async (error, next) => {
      await engine.createStep(options.stepId);
      options.setActiveStep(options.stepId);
      return next(error);
    });
  };
}
