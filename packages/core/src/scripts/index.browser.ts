/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import I18n from 'scripts/classes/I18n';
import Model from 'scripts/classes/Model';
import Id from 'scripts/classes/BrowserId';
import forEach from 'scripts/helpers/forEach';
import deepCopy from 'scripts/helpers/deepCopy';
import deepMerge from 'scripts/helpers/deepMerge';
import Telemetry from 'scripts/classes/Telemetry';
import HttpClient from 'scripts/classes/HttpClient';
import toSnakeCase from 'scripts/helpers/toSnakeCase';
import isPlainObject from 'scripts/helpers/isPlainObject';

// Exporting types...
export * from 'scripts/classes/I18n';
export * from 'scripts/classes/Model';
export * from 'scripts/classes/HttpClient';

export {
  Id,
  I18n,
  Model,
  forEach,
  deepCopy,
  deepMerge,
  Telemetry,
  HttpClient,
  toSnakeCase,
  isPlainObject,
};
