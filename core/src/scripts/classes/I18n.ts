/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type Logger from 'scripts/classes/Logger';

/** List of labels translations, grouped by key and category. */
export type Labels = {
  [key: string]: string | Labels;
};

/**
 * Handles internationalization and localization (translations, conversions, formatting and such).
 */
export default class I18n {
  /** Logging system. */
  protected logger: Logger;

  /** List of labels translations, grouped by key and category. */
  protected labels: Labels;

  /**
   * Class constructor.
   *
   * @param logger Logging system to use.
   *
   * @param labels List of available labels for translation.
   */
  public constructor(logger: Logger, labels: Labels) {
    this.logger = logger;
    this.labels = labels;
  }

  /**
   * Translates `label` injecting values from `variables` if necessary.
   *
   * @param label Label to translate.
   *
   * @param values Optional list of values to inject in the translated label. Defaults to `{}`.
   */
  public t(label: string, values: Record<string, unknown> = {}): string {
    let translation = this.labels;
    const splittedLabel = label.split('.');
    while (splittedLabel.length > 0 && translation !== undefined) {
      translation = translation[splittedLabel.shift() as string] as Labels;
    }

    if (translation === undefined) {
      this.logger.error(`Missing translation for label "${label}".`);
      return label;
    }

    const variableKeys = Object.keys(values);
    let finalTranslation = translation as unknown as string;
    for (let index = 0, { length } = variableKeys; index < length; index += 1) {
      const key = variableKeys[index];
      finalTranslation = finalTranslation.replace(new RegExp(`{{${key}}}`, 'g'), values[key] as string);
    }
    return finalTranslation;
  }
}
