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
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/core/services/Model.ts
 */
export default class Model<
  /** Data model types definitions. */
  DataModel extends DefaultDataModel = DefaultDataModel,
> extends BaseModel<DataModel> {
  /**
   * Updates data model with `schemaFragment`.
   *
   * @param schemaFragment Fragment of data model schema. Contains a subset of resources schemas.
   */
  public update(schemaFragment: Partial<DataModel>): void {
    // TODO format stuff like pattern, enum, ...
    this.schema = deepMerge(this.schema, schemaFragment);
  }
}
