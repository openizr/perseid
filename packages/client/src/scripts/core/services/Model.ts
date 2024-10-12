/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Id,
  type FieldSchema,
  Model as BaseModel,
  type ResourceSchema,
  type DefaultDataModel,
} from '@perseid/core';

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
   * Deserializes `schema` received from the API.
   *
   * @param schema Serialized schema.
   *
   * @returns Data model field schema.
   */
  private deserializeSchema(schema: Record<string, unknown>): FieldSchema<DataModel> {
    const formattedSchema: Record<string, unknown> = { ...schema };
    const { fields } = formattedSchema;
    if (formattedSchema.pattern !== undefined) {
      formattedSchema.pattern = new RegExp(formattedSchema.pattern as string);
    }
    if (formattedSchema.enum !== undefined && formattedSchema.type === 'date') {
      formattedSchema.enum = (formattedSchema.enum as string[]).map((date) => new Date(date));
    } else if (formattedSchema.enum !== undefined && formattedSchema.type === 'id') {
      formattedSchema.enum = (formattedSchema.enum as string[]).map((id) => new Id(id));
    }
    if (formattedSchema.type === 'array') {
      formattedSchema.fields = this.deserializeSchema(fields as Record<string, unknown>);
    } else if (fields !== undefined) {
      const objectFields = fields as Record<string, unknown>;
      formattedSchema.fields = Object.keys(objectFields).reduce((subFields, key) => ({
        ...subFields,
        [key]: this.deserializeSchema(objectFields[key] as Record<string, unknown>),
      }), {});
    }
    return formattedSchema as unknown as FieldSchema<DataModel>;
  }

  /**
   * Updates data model with `schemaFragment`.
   *
   * @param schemaFragment Fragment of data model schema. Contains a subset of resources schemas.
   */
  public update(schemaFragment: Partial<DataModel>): void {
    const resources = (Object.keys(schemaFragment) as (keyof DataModel)[]);
    Object.assign(this.schema, resources.reduce((model, resource) => {
      const resourceDataModel = (schemaFragment)[resource] as ResourceSchema<DataModel>;
      return {
        ...model,
        [resource]: {
          ...resourceDataModel,
          fields: this.deserializeSchema(resourceDataModel.fields),
        },
      };
    }, {}));
  }
}
