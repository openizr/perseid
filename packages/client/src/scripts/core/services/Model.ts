/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { deepMerge, type DefaultDataModel, Model as BaseModel } from '@perseid/core';

/**
 * Data model.
 */
export default class Model<
  /** Data model types definitions. */
  DataModel = DefaultDataModel,
> extends BaseModel<DataModel> {
  /**
   * Updates data model with `schemaFragment`.
   *
   * @param schemaFragment Fragment of data model schema. Contains a subset of collections schemas.
   */
  public update(schemaFragment: Partial<DataModel>): void {
    this.schema = deepMerge(this.schema, schemaFragment);
  }
}
