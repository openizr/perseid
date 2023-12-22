/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module 'perseid/form/plugins' {
  import { FormPlugin } from '@perseid/form';

  interface GreCaptcha { grecaptcha: Client; }
  interface Client {
    ready: (callback: () => void) => void;
    execute: (...args: (string | Record<string, string>)[]) => Promise<string>;
  }

  /**
   * `reCaptchaHandler` plugin options.
   */
  export interface ReCaptchaHandlerOptions {
    /** Google's reCAPTCHA v3 site key. */
    siteKey: string;
  }

  /**
   * Automatically handles a reCAPTCHA challenge for current form.
   *
   * @param options Plugin's options.
   *
   * @returns The actual plugin.
   */
  export function reCaptchaHandler(options: ReCaptchaHandlerOptions): FormPlugin;

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
  export function errorStepDisplayer(options: ErrorStepDisplayerOptions): FormPlugin;

  /**
   * `loaderDisplayer` plugin options.
   */
  export interface LoaderDisplayerOptions {
    /** Minimum time during which loader should be displayed. */
    timeout?: number;
  }

  /**
   * Displays a loader each time a new step is being loaded, for better UX.
   *
   * @param options Plugin's options. Defaults to `{}`.
   *
   * @returns The actual plugin.
   */
  export function loaderDisplayer(options?: LoaderDisplayerOptions): FormPlugin;
}
