/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Id,
  type Model,
  type Logger,
  type IdSchema,
  type DateSchema,
  type NullSchema,
  type FieldSchema,
  type ArraySchema,
  type StringSchema,
  type NumberSchema,
  type ObjectSchema,
  type BinarySchema,
  type BooleanSchema,
  type ResourceSchema,
  type DefaultDataModel,
  type DataModelMetadata,
} from '@perseid/core';
import {
  type UserInputs,
  type DateConfiguration,
  type ArrayConfiguration,
  type FieldConfiguration,
  type FloatConfiguration,
  type ObjectConfiguration,
  type StringConfiguration,
  type IntegerConfiguration,
} from '@perseid/form';
import type Engine from '@perseid/form';
import { type Option } from '@perseid/ui';
import Store from 'scripts/core/services/Store';

/**
 * Filtered perseid data model, according to user permissions.
 */
export interface FilteredModel<DataModel extends DefaultDataModel> {
  fields: Set<string>,
  canUserCreateResource: boolean,
  schema: FieldSchema<DataModel>,
}

/**
 * Perseid data model to form configuration schema formatter.
 */
export type FormFormatter<DataModel extends DefaultDataModel> = (
  schema: FieldSchema<DataModel>,
  path: string,
  extraFieldsTree: Record<string, unknown>,
  store: Store<DataModel>,
) => {
  configuration: FieldConfiguration;
  fieldProps: Record<string, { component: string; componentProps: Record<string, unknown>; }>;
};

/**
 * Perseid store, extended with various methods and attributes to handle generic apps states.
 */
export default class FormBuilder<
  DataModel extends DefaultDataModel = DefaultDataModel
> {
  /** Logging system to use. */
  protected logger: Logger;

  /** Perseid model to use. */
  protected model: Model<DataModel>;

  /** Password pattern regexp. */
  protected readonly PASSWORD_REGEXP = /^(?=.*[A-Z])(?=.*[!@#$&*])(?=.*[0-9])(?=.*[a-z]).{8,}$/;

  /** Email pattern regexp. */
  protected readonly EMAIL_REGEXP = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

  /** List of formatters, used to format a perseid data model into its form equivalent. */
  protected readonly FORMATTERS: Record<FieldSchema<DataModel>['type'], FormFormatter<DataModel>> = {
    null(_, path) {
      return {
        configuration: { type: 'null' },
        fieldProps: { [path]: { component: 'Null', componentProps: {} } },
      };
    },
    id: (schema, path, extraFieldsTree, store) => {
      const {
        isRequired,
        enum: enumerations,
      } = schema as IdSchema<DataModel>;
      const relation = (schema as IdSchema<DataModel>).relation as (
        undefined | keyof DataModel & string
      );
      if (enumerations !== undefined) {
        return {
          configuration: { type: 'string', required: isRequired },
          fieldProps: {
            [path]: {
              component: 'Options',
              componentProps: {
                select: true,
                options: [{
                  type: 'option',
                  value: 'null',
                  label: 'PLACEHOLDER',
                }].concat(enumerations.map((option) => ({
                  type: 'option',
                  value: String(option),
                  // Don't snakecase here, otherwise options like "TOTO" become "T_O_T_O"
                  label: String(option).toUpperCase(),
                }))),
              },
            },
          },
        };
      }
      if (relation !== undefined) {
        const keys = Object.keys(extraFieldsTree);
        const fields = keys.length === 0 ? ['_id'] : keys;
        const labelFn = (resource: Record<string, unknown> | null): string => {
          const id = new Id();
          const registry = { [relation]: { [String(id)]: resource } } as Registry<DataModel>;
          const value = store.getValue(relation, id, fields[0], registry);
          return value ? String(value) : '';
        };
        return {
          configuration: { type: 'string', isRequired },
          fieldProps: {
            [path]: {
              component: 'LazyOptions',
              componentProps: {
                resource: relation,
                labelFn,
                loadResults: async (newValue: string | null): Promise<unknown[]> => {
                  // We can't perform a full text search on ids.
                  const searchBody = (newValue === null || newValue.trim() === '') ? null : {
                    query: (keys.length === 0) ? null : { on: fields, text: newValue },
                    filters: (keys.length === 0) ? { _id: newValue } : null,
                  };
                  const response = (searchBody === null)
                    ? await store.list(relation, { fields, limit: 10 })
                    : await store.search(relation, searchBody, { fields, limit: 10 });
                  return response?.results.map((resource: unknown) => ({
                    type: 'option',
                    label: labelFn(resource as Record<string, unknown>),
                    value: String((resource as Record<string, unknown>)._id),
                  })) ?? [];
                },
              },
            },
          },
        };
      }
      const idRegExp = /^[0-9a-fA-F]{24}$/;
      return {
        configuration: {
          type: 'string',
          required: isRequired,
          validation(newValue): string | null {
            return !idRegExp.test(newValue) ? 'PATTERN_VIOLATION' : null;
          },
        },
        fieldProps: {
          [path]: {
            component: 'Textfield',
            componentProps: {},
          },
        },
      };
    },
    binary(schema, path) {
      const { type, isRequired } = schema as BinarySchema;
      return {
        configuration: { type, required: isRequired },
        fieldProps: { [path]: { component: 'FilePicker', componentProps: {} } },
      };
    },
    boolean(schema, path) {
      const { type, isRequired } = schema as BooleanSchema;
      return {
        configuration: { type, required: isRequired },
        fieldProps: {
          [path]: {
            component: 'Options',
            componentProps: {
              multiple: true,
              options: [{
                type: 'option',
                value: 'true',
                label: 'TRUE',
              }],
            },
          },
        },
      };
    },
    date(schema, path) {
      const {
        type,
        isRequired,
        enum: enumerations,
      } = schema as DateSchema;
      if (enumerations !== undefined) {
        return {
          configuration: { type, required: isRequired },
          fieldProps: {
            [path]: {
              component: 'Options',
              componentProps: {
                select: true,
                options: [{
                  type: 'option',
                  value: 'null',
                  label: 'PLACEHOLDER',
                }].concat(enumerations.map((option) => ({
                  type: 'option',
                  value: String(option),
                  // Don't snakecase here, otherwise options like "TOTO" become "T_O_T_O"
                  label: String(option).toUpperCase(),
                }))),
              },
            },
          },
        };
      }
      const dateRegExp = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;
      return {
        configuration: {
          type,
          required: isRequired,
          validation(newValue) {
            return !dateRegExp.test((newValue instanceof Date ? newValue.toISOString() : newValue))
              ? 'PATTERN_VIOLATION'
              : null;
          },
        } as DateConfiguration,
        fieldProps: {
          [path]: {
            component: 'DatePicker',
            componentProps: {},
          },
        },
      };
    },
    float(schema, path) {
      const {
        type,
        minimum,
        maximum,
        isRequired,
        multipleOf,
        exclusiveMinimum,
        exclusiveMaximum,
        enum: enumerations,
      } = schema as NumberSchema;
      if (enumerations !== undefined) {
        return {
          configuration: { type, required: isRequired },
          fieldProps: {
            [path]: {
              component: 'Options',
              componentProps: {
                select: true,
                options: [{
                  type: 'option',
                  value: 'null',
                  label: 'PLACEHOLDER',
                } as Option].concat(enumerations.map((option) => ({
                  type: 'option',
                  value: String(option),
                  // Don't snakecase here, otherwise options like "TOTO" become "T_O_T_O"
                  label: String(option).toUpperCase(),
                }))),
              },
            },
          },
        };
      }
      return {
        configuration: {
          type,
          required: isRequired,
          validation(newValue) {
            if (Number.isNaN(newValue)) {
              return 'NOT_A_NUMBER';
            }
            if (minimum !== undefined && newValue < minimum) {
              return 'BELOW_MINIMUM';
            }
            if (exclusiveMinimum !== undefined && newValue <= exclusiveMinimum) {
              return 'BELOW_STRICT_MINIMUM';
            }
            if (maximum !== undefined && newValue > maximum) {
              return 'ABOVE_MAXIMUM';
            }
            if (exclusiveMaximum !== undefined && newValue >= exclusiveMaximum) {
              return 'ABOVE_STRICT_MAXIMUM';
            }
            return null;
          },
        } as FloatConfiguration,
        fieldProps: {
          [path]: {
            component: 'Textfield',
            componentProps: {
              type: 'number',
              steps: multipleOf,
              min: minimum ?? exclusiveMinimum,
              max: maximum ?? exclusiveMaximum,
            },
          },
        },
      };
    },
    integer(schema, path) {
      const {
        type,
        minimum,
        maximum,
        isRequired,
        multipleOf,
        exclusiveMinimum,
        exclusiveMaximum,
        enum: enumerations,
      } = schema as NumberSchema;
      if (enumerations !== undefined) {
        return {
          configuration: { type, required: isRequired },
          fieldProps: {
            [path]: {
              component: 'Options',
              componentProps: {
                select: true,
                options: [{
                  type: 'option',
                  value: 'null',
                  label: 'PLACEHOLDER',
                } as Option].concat(enumerations.map((option) => ({
                  type: 'option',
                  value: String(option),
                  // Don't snakecase here, otherwise options like "TOTO" become "T_O_T_O"
                  label: String(option).toUpperCase(),
                }))),
              },
            },
          },
        };
      }
      return {
        configuration: {
          type,
          required: isRequired,
          validation(newValue) {
            if (Number.isNaN(newValue)) {
              return 'NOT_A_NUMBER';
            }
            if (minimum !== undefined && newValue < minimum) {
              return 'BELOW_MINIMUM';
            }
            if (exclusiveMinimum !== undefined && newValue <= exclusiveMinimum) {
              return 'BELOW_STRICT_MINIMUM';
            }
            if (maximum !== undefined && newValue > maximum) {
              return 'ABOVE_MAXIMUM';
            }
            if (exclusiveMaximum !== undefined && newValue >= exclusiveMaximum) {
              return 'ABOVE_STRICT_MAXIMUM';
            }
            return null;
          },
        } as IntegerConfiguration,
        fieldProps: {
          [path]: {
            component: 'Textfield',
            componentProps: {
              type: 'number',
              steps: multipleOf,
              min: minimum ?? exclusiveMinimum,
              max: maximum ?? exclusiveMaximum,
            },
          },
        },
      };
    },
    string(schema, path) {
      const {
        type,
        pattern,
        maxLength,
        minLength,
        isRequired,
        enum: enumerations,
      } = schema as StringSchema;
      if (enumerations !== undefined) {
        return {
          configuration: { type, required: isRequired },
          fieldProps: {
            [path]: {
              component: 'Options',
              componentProps: {
                select: true,
                options: [{
                  type: 'option',
                  value: 'null',
                  label: 'PLACEHOLDER',
                }].concat(enumerations.map((option) => ({
                  type: 'option',
                  value: String(option),
                  // Don't snakecase here, otherwise options like "TOTO" become "T_O_T_O"
                  label: String(option).toUpperCase(),
                }))),
              },
            },
          },
        };
      }
      return {
        configuration: {
          type,
          required: isRequired,
          validation(newValue) {
            if (pattern !== undefined && !(new RegExp(pattern)).test(newValue)) {
              return 'PATTERN_VIOLATION';
            }
            if (minLength !== undefined && newValue.trim().length < minLength) {
              return 'VALUE_TOO_SHORT';
            }
            if (maxLength !== undefined && newValue.trim().length > maxLength) {
              return 'VALUE_TOO_LONG';
            }
            return null;
          },
        } as StringConfiguration,
        fieldProps: {
          [path]: {
            component: (pattern === undefined && (maxLength ?? 101) > 100) ? 'Textarea' : 'Textfield',
            componentProps: { maxLength },
          },
        },
      };
    },
    object: (schema, path, extraFieldsTree, store) => {
      const { type, fields, isRequired } = schema as ObjectSchema<DataModel>;
      const configuration: ObjectConfiguration = { type, required: isRequired, fields: {} };
      const fieldProps = (path === '') ? {} : {
        [path]: {
          component: 'Object',
          componentProps: {},
        },
      };
      Object.keys(fields).forEach((key) => {
        if (!key.startsWith('_')) {
          const fieldPath = (path === '') ? key : `${path}.${key}`;
          const extraSubfieldsTree = (extraFieldsTree[key] ?? {}) as Record<string, unknown>;
          const formatter = this.FORMATTERS[fields[key].type];
          const formattedField = formatter(fields[key], fieldPath, extraSubfieldsTree, store);
          configuration.fields[key] = formattedField.configuration;
          Object.assign(fieldProps, formattedField.fieldProps);
        }
      });
      return { configuration, fieldProps };
    },
    array: (schema, path, extraFieldsTree, store) => {
      const {
        type,
        fields,
        maxItems,
        minItems,
        isRequired,
        uniqueItems,
      } = schema as ArraySchema<DataModel>;
      const formatter = this.FORMATTERS[fields.type];
      const formattedFields = formatter(fields, `${path}.$n`, extraFieldsTree, store);
      return {
        configuration: {
          type,
          required: isRequired,
          fields: formattedFields.configuration as ObjectConfiguration,
          validation(newValue) {
            if (uniqueItems !== undefined) {
              const duplicates = newValue.filter((item, index) => (
                newValue.indexOf(item) !== index
              ));
              if (duplicates.length > 0) {
                return 'DUPLICATE_ITEMS';
              }
            }
            if (minItems !== undefined && newValue.length < minItems) {
              return 'TOO_FEW_ITEMS';
            }
            if (maxItems !== undefined && newValue.length > maxItems) {
              return 'TOO_MANY_ITEMS';
            }
            return null;
          },
        } as ArrayConfiguration,
        fieldProps: {
          ...formattedFields.fieldProps,
          [path]: {
            component: 'Array',
            componentProps: {
              maxItems, minItems,
            },
          },
        },
      };
    },
  };

  /**
   * Generates fields tree from `fields`. Used to fetch nested relations fields in formatters.
   *
   * @param fields List of fields to generate tree from.
   *
   * @returns Generated fields tree.
   */
  protected generateFieldsTree(fields: Set<string>): Record<string, unknown> {
    const fieldsTree: Record<string, unknown> = {};
    fields.forEach((field) => {
      let currentFieldsTree = fieldsTree;
      const splitted = field.split('.');
      while (splitted.length > 0) {
        const subPath = String(splitted.shift());
        currentFieldsTree[subPath] ??= (splitted.length === 0) ? field : {};
        currentFieldsTree = currentFieldsTree[subPath] as Record<string, unknown>;
      }
    });
    return fieldsTree;
  }

  /**
   * Filters `resource` data model schema and removes all fields for which user has no permission.
   *
   * @param resource Resource data model to filter.
   *
   * @param mode Edition mode (update / create).
   *
   * @param schema Current schema in data model schema.
   *
   * @param path Current path in data model.
   *
   * @param store Store instance that provides useful methods.
   *
   * @returns `null` if user has no access to the field, filtered data model otherwise.
   */
  protected filterModel<Resource extends keyof DataModel & string>(
    resource: Resource,
    mode: 'UPDATE' | 'CREATE',
    schema: FieldSchema<DataModel>,
    path: string,
    store: Store<DataModel>,
  ): null | FilteredModel<DataModel>;

  protected filterModel<T extends FilteredModel<DataModel>>(
    resource: keyof DataModel & string,
    mode: 'UPDATE' | 'CREATE',
    schema: FieldSchema<DataModel>,
    path: string,
    store: Store<DataModel>,
  ): T;

  protected filterModel<Resource extends keyof DataModel & string>(
    resource: Resource,
    mode: 'UPDATE' | 'CREATE',
    schema: FieldSchema<DataModel>,
    path: string,
    store: Store<DataModel>,
  ): null | FilteredModel<DataModel> {
    if (path !== '_' && !store.canAccessField(resource, path, mode)) {
      return null;
    }
    if (schema.type === 'array') {
      const { fields } = schema;
      const subModel = this.filterModel<FilteredModel<DataModel>>(
        resource,
        mode,
        fields,
        path,
        store,
      );
      return {
        fields: subModel.fields,
        canUserCreateResource: subModel.canUserCreateResource,
        schema: { ...schema, fields: subModel.schema as NullSchema },
      };
    }
    if (schema.type === 'object') {
      let canUserCreateResource = true;
      let fetchWholeObject = true as boolean;
      const fieldsToFetch: string[] = [];
      const filteredSchema: ObjectSchema<DataModel> = { ...schema, type: 'object', fields: {} };
      const updatableFields = Object.keys(schema.fields).filter((key) => !key.startsWith('_'));
      updatableFields.forEach((key) => {
        const fieldSchema = schema.fields[key];
        const fullPath = (path === '_') ? key : `${path}.${key}`;
        const filteredModel = this.filterModel(resource, mode, fieldSchema, fullPath, store);
        if (filteredModel === null) {
          fetchWholeObject = false;
          canUserCreateResource = false;
        } else {
          filteredSchema.fields[key] = filteredModel.schema;
          fieldsToFetch.push(...filteredModel.fields);
          canUserCreateResource = canUserCreateResource && filteredModel.canUserCreateResource;
        }
      });
      return {
        canUserCreateResource,
        schema: filteredSchema,
        fields: (fetchWholeObject && path !== '_') ? new Set([path]) : new Set(fieldsToFetch),
      };
    }
    return (path === '_') ? null : {
      schema,
      fields: new Set([path]),
      canUserCreateResource: true,
    };
  }

  /**
   * Class constructor.
   *
   * @param model Data model instance to use.
   *
   * @param logger Logging system to use.
   */
  constructor(
    model: Model<DataModel>,
    logger: Logger,
  ) {
    this.model = model;
    this.logger = logger;
  }

  /**
   * Generates the form configuration for the resource update / creation UI of `resource`.
   *
   * @param resource Resource resource.
   *
   * @param id Id of the resource to update, if applicable. Defaults to `null`.
   *
   * @param extraFields Additional fields to request when fetching resource, if applicable.
   * This is especially useful if you need to use a different field than `_id` to display relations.
   * Defaults to `new Set()`.
   *
   * @param store Store instance that provides useful methods.
   *
   * @returns Generated form configuration.
   */
  public buildConfiguration<Resource extends keyof DataModel & string>(
    resource: Resource,
    id: Id | null,
    extraFields: Set<string>,
    store: Store<DataModel>,
  ): FormDefinition {
    const mode = (id !== null) ? 'UPDATE' : 'CREATE';
    const extraFieldsTree = this.generateFieldsTree(extraFields);
    const { schema } = this.model.get(resource) as DataModelMetadata<ResourceSchema<DataModel>>;
    const subSchema: ObjectSchema<DataModel> = { type: 'object', fields: schema.fields };
    const model = this.filterModel<FilteredModel<DataModel>>(resource, mode, subSchema, '_', store);
    const { schema: filteredSchema, fields, canUserCreateResource } = model;
    const formatter = this.FORMATTERS[filteredSchema.type];
    const { configuration, fieldProps } = formatter(filteredSchema, '', extraFieldsTree, store);
    return {
      requestedFields: (mode === 'UPDATE' || canUserCreateResource) ? fields : new Set<string>(),
      fieldProps: {
        ...fieldProps,
        submit: {
          component: 'Button',
          componentProps: {
            type: 'submit',
            modifiers: 'primary',
          },
        },
      },
      configuration: {
        root: 'root',
        submitPartialUpdates: mode === 'UPDATE',
        fields: {
          ...(configuration as ObjectConfiguration).fields,
          submit: { type: 'null', submit: true },
        },
        steps: {
          root: {
            fields: [...fields, 'submit'],
            submit: true,
          },
        },
      },
    };
  }

  /**
   * Returns sign-up page form configuration.
   *
   * @param signIn Submit callback to execute to sign user up.
   *
   * @returns Form configuration.
   */
  public getSignUpConfiguration(signUp: (data: UserInputs) => Promise<void>): FormDefinition {
    return {
      requestedFields: new Set(),
      configuration: {
        root: 'root',
        fields: {
          email: {
            type: 'string',
            required: true,
            validation: (newValue) => (
              this.EMAIL_REGEXP.test(newValue) ? null : 'PATTERN_VIOLATION'
            ),
          },
          password: {
            type: 'string',
            required: true,
            validation: (newValue) => (
              this.PASSWORD_REGEXP.test(newValue) ? null : 'PATTERN_VIOLATION'
            ),
          },
          passwordConfirmation: {
            type: 'string',
            required: true,
            validation: (newValue, inputs): string | null => {
              if (!this.PASSWORD_REGEXP.test(newValue)) {
                return 'PATTERN_VIOLATION';
              }
              if (inputs.password !== null && inputs.password !== newValue) {
                return 'PASSWORDS_MISMATCH';
              }
              return null;
            },
          },
          submit: {
            type: 'null',
            submit: true,
          },
        },
        steps: {
          root: {
            submit: true,
            fields: ['email', 'password', 'passwordConfirmation', 'submit'],
          },
        },
        onSubmit: signUp,
      },
      fieldProps: {
        submit: {
          component: 'Button',
          componentProps: { type: 'submit', modifiers: 'primary' },
        },
        email: {
          component: 'Textfield',
          componentProps: {
            maxlength: 50,
            autofocus: true,
            transform: (value: string): [string] => [value.toLowerCase()],
          },
        },
        password: {
          component: 'Textfield',
          componentProps: { maxlength: 50, type: 'password' },
        },
        passwordConfirmation: {
          component: 'Textfield',
          componentProps: { maxlength: 50, type: 'password' },
        },
      },
    };
  }

  /**
   * Returns sign-in page form configuration.
   *
   * @param signIn Submit callback to execute to sign user in.
   *
   * @returns Form configuration.
   */
  public getSignInConfiguration(signIn: (data: UserInputs) => Promise<void>): FormDefinition {
    return {
      requestedFields: new Set(),
      configuration: {
        root: 'root',
        validateOnSubmit: true,
        steps: {
          root: {
            submit: true,
            fields: ['email', 'password', 'submit'],
          },
        },
        fields: {
          email: { type: 'string', required: true },
          password: { type: 'string', required: true },
          submit: { type: 'null', submit: true },
        },
        onSubmit: signIn,
      },
      fieldProps: {
        submit: {
          component: 'Button',
          componentProps: { type: 'submit', modifiers: 'primary' },
        },
        email: {
          component: 'Textfield',
          componentProps: {
            maxlength: 50,
            autofocus: true,
            transform: (value: string): [string] => [value.toLowerCase()],
          },
        },
        password: {
          component: 'Textfield',
          componentProps: { maxlength: 50, type: 'password' },
        },
      },
    };
  }

  /**
   * Returns user update page form configuration.
   *
   * @param user Currently signed-in user.
   *
   * @param updateUser Submit callback to execute to update user info.
   *
   * @param resetPassword Callback to execute to request user password reset.
   *
   * @returns Form configuration.
   */
  public getUpdateUserConfiguration(
    user: DataModel['users'],
    updateUser: (data: UserInputs) => Promise<void>,
    resetPassword: () => Promise<void>,
  ): FormDefinition {
    return {
      requestedFields: new Set(),
      configuration: {
        root: 'root',
        initialValues: { email: user.email },
        fields: {
          resetPassword: { type: 'null' },
          submit: { type: 'null', submit: true },
          email: {
            type: 'string',
            required: true,
            validation: (newValue) => (
              this.EMAIL_REGEXP.test(newValue) ? null : 'PATTERN_VIOLATION'
            ),
          },
        },
        steps: {
          root: {
            submit: true,
            fields: ['email', 'resetPassword', 'submit'],
          },
        },
        onSubmit: updateUser,
        plugins: [
          (engine: Engine): void => {
            engine.on('userAction', async (data, next) => {
              if (data?.path === 'root.0.resetPassword') {
                await resetPassword();
              }
              return next(data);
            });
          },
        ],
      },
      fieldProps: {
        email: {
          component: 'Textfield',
          componentProps: {
            maxlength: 50,
            autofocus: true,
            transform: (value: string): [string] => [value.toLowerCase()],
          },
        },
        submit: {
          component: 'Button',
          componentProps: { type: 'submit', modifiers: 'primary' },
        },
        resetPassword: {
          component: 'Button',
          componentProps: { type: 'submit', modifiers: 'secondary outlined' },
        },
      },
    };
  }

  /**
   * Returns password reset page form configuration.
   *
   * @param resetToken Password reset token.
   *
   * @param resetPassword Submit callback to execute to reset user password.
   *
   * @param requestPasswordReset Submit callback to execute to request user password reset.
   *
   * @returns Form configuration.
   */
  public getResetPasswordConfiguration(
    resetToken: string | null,
    resetPassword: (data: UserInputs) => Promise<void>,
    requestPasswordReset: (data: UserInputs) => Promise<void>,
  ): FormDefinition {
    if (resetToken !== null) {
      return {
        requestedFields: new Set(),
        configuration: {
          root: 'root',
          fields: {
            title: { type: 'null' },
            password: {
              type: 'string',
              required: true,
              validation: (newValue) => (
                this.PASSWORD_REGEXP.test(newValue) ? null : 'PATTERN_VIOLATION'
              ),
            },
            passwordConfirmation: {
              type: 'string',
              required: true,
              validation: (newValue, inputs): string | null => {
                if (!this.PASSWORD_REGEXP.test(newValue)) {
                  return 'PATTERN_VIOLATION';
                }
                if (inputs.password !== null && inputs.password !== newValue) {
                  return 'PASSWORDS_MISMATCH';
                }
                return null;
              },
            },
            submit: {
              type: 'null',
              submit: true,
            },
          },
          steps: {
            root: {
              submit: true,
              fields: ['title', 'password', 'passwordConfirmation', 'submit'],
            },
          },
          onSubmit: resetPassword,
        },
        fieldProps: {
          title: {
            component: 'Message',
            componentProps: {},
          },
          password: {
            component: 'Textfield',
            componentProps: { maxlength: 50, type: 'password' },
          },
          passwordConfirmation: {
            component: 'Textfield',
            componentProps: { maxlength: 50, type: 'password' },
          },
          submit: {
            component: 'Button',
            componentProps: { type: 'submit', modifiers: 'primary' },
          },
        },
      };
    }
    return {
      requestedFields: new Set(),
      configuration: {
        root: 'root',
        fields: {
          title: { type: 'null' },
          successTitle: { type: 'null' },
          successMessage: { type: 'null' },
          submit: { type: 'null', submit: true },
          email: {
            type: 'string',
            required: true,
            validation: (newValue) => (
              this.EMAIL_REGEXP.test(newValue) ? null : 'PATTERN_VIOLATION'
            ),
          },
        },
        steps: {
          root: {
            submit: true,
            nextStep: 'success',
            fields: ['title', 'email', 'submit'],
          },
          success: {
            fields: ['successTitle', 'successMessage'],
          },
        },
        onSubmit: requestPasswordReset,
      },
      fieldProps: {
        title: {
          component: 'Message',
          componentProps: {},
        },
        successTitle: {
          component: 'Message',
          componentProps: {},
        },
        successMessage: {
          component: 'Message',
          componentProps: {},
        },
        email: {
          component: 'Textfield',
          componentProps: {
            maxlength: 50,
            autofocus: true,
            transform: (value: string): [string] => [value.toLowerCase()],
          },
        },
        submit: {
          component: 'Button',
          componentProps: { type: 'submit', modifiers: 'primary' },
        },
      },
    };
  }
}
