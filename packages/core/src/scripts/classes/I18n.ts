/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import deepMerge from 'scripts/helpers/deepMerge';
import type Telemetry from 'scripts/classes/Telemetry';

/**
 * List of labels translations, grouped by key and category.
 */
export interface Labels {
  [key: string]: string | Labels;
}

/**
 * Handles internationalization and localization (translations, conversions, formatting and such).
 */
export default class I18n {
  /**
   * Telemetry system.
   */
  protected telemetry: Telemetry;

  /**
   * List of labels translations, grouped by key and category.
   */
  protected labels: Labels;

  /**
   * Ugly trick to bypass linter :(. */
  protected specialChar: string;

  /**
   * Gets the translation for `label`.
   *
   * @param label Label to get the translation for.
   *
   * @returns Translation for `label` if it exists, `null` otherwise.
   */
  protected getTranslation(label: string): string | null {
    let translation = this.labels as Labels | undefined;
    const splittedLabel = label.split('.');
    while (splittedLabel.length > 0 && translation !== undefined) {
      translation = translation[String(splittedLabel.shift())] as Labels | undefined;
    }
    return (typeof translation === 'string') ? translation : null;
  }

  /**
   * Class constructor.
   *
   * @param telemetry Telemetry system to use.
   *
   * @param labels List of available labels for translation.
   */
  public constructor(telemetry: Telemetry, labels: Labels) {
    this.labels = labels;
    this.specialChar = '';
    this.telemetry = telemetry;
    this.t = this.t.bind(this);
    this.numeric = this.numeric.bind(this);
    this.dateTime = this.dateTime.bind(this);
  }

  /**
   * Adds new `labels` to the existing ones.
   *
   * @param labels Labels to add.
   */
  public addLabels(labels: Labels): void {
    this.labels = deepMerge(this.labels, labels);
  }

  /**
   * Checks if `label` exists in labels.
   *
   * @param label Label to check.
   *
   * @returns `true` if `label` exists, `false` otherwise.
   */
  public has(label: string): boolean {
    return (this.getTranslation(label) !== null);
  }

  /**
   * Translates `label` injecting values from `variables` if necessary.
   *
   * @param label Label to translate.
   *
   * @param values Optional list of values to inject in the translated label. Defaults to `{}`.
   *
   * @returns Translated label.
   */
  public t(label: string, values: Record<string, unknown> = {}): string {
    const translation = this.getTranslation(label);

    if (translation === null) {
      this.telemetry.error(`Missing translation for label "${label}".`);
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

  /**
   * Translates numeric `value`.
   *
   * @param value Value to translate.
   *
   * @returns Translated value.
   */
  public numeric(value: number): string {
    return `${this.specialChar}${String(value)}`;
  }

  /**
   * Translates date `value`.
   *
   * @param value Value to translate.
   *
   * @returns Translated value.
   */
  public dateTime(value: Date): string {
    const splittedValue = value.toISOString().split('T');
    return `${this.specialChar}${splittedValue[0].replace(/-/g, '/')} ${splittedValue[1].slice(0, 8)}`;
  }
}
