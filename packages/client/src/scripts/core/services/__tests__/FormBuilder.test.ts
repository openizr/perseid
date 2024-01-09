/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import {
  Id,
  type User,
  type FieldSchema,
  type DefaultDataModel,
} from '@perseid/core';
import Model from 'scripts/core/services/Model';
import Logger from 'scripts/core/services/Logger';
import type Store from 'scripts/core/services/Store';
import FormBuilder from 'scripts/core/services/FormBuilder';
import Engine, { type StringConfiguration } from '@perseid/form';

type TestFormBuilder = FormBuilder & {
  FORMATTERS: FormBuilder['FORMATTERS'];
  filterModel: FormBuilder['filterModel'];
};

describe('core/services/FormBuilder', () => {
  vi.mock('@perseid/core');
  vi.mock('scripts/core/services/Model');
  vi.mock('scripts/core/services/Logger');

  const model = new Model();
  let formBuilder: TestFormBuilder;
  const logger = new Logger({ logLevel: 'debug' });
  const store = {
    search: vi.fn(() => null),
    canAccessField: vi.fn((_, path) => {
      if (path === 'forbidden') {
        return false;
      }
      return true;
    }),
    getValue: vi.fn((_, __, key) => (key === '_id' ? null : 'test')),
    list: vi.fn(() => ({ results: [{ _id: '123456789012345678901234' }] })),
  } as unknown as Store;

  beforeEach(() => {
    vi.clearAllMocks();
    formBuilder = new FormBuilder(model, logger) as TestFormBuilder;
  });

  test('[FORMATTERS] - null', () => {
    const configuration = formBuilder.FORMATTERS.null({ type: 'null' }, 'root.0.field', {}, store);
    expect(configuration).toEqual({
      configuration: { type: 'null' },
      fieldProps: { 'root.0.field': { component: 'Null', componentProps: {} } },
    });
  });

  test('[FORMATTERS] - id, no enumeration, no relation', () => {
    const configuration = formBuilder.FORMATTERS.id({ type: 'id' }, 'root.0.field', {}, store);
    expect((configuration.configuration as StringConfiguration).validation?.('', {}, {})).toBe('PATTERN_VIOLATION');
    expect((configuration.configuration as StringConfiguration).validation?.('123456789012345678901234', {}, {})).toBeNull();
    expect(configuration).toEqual({
      configuration: {
        type: 'string',
        validation: expect.any(Function) as () => void,
      },
      fieldProps: {
        'root.0.field': {
          component: 'Textfield',
          componentProps: {},
        },
      },
    });
  });

  test('[FORMATTERS] - id, enumeration, no relation', () => {
    const id = new Id('123456789012345678901234');
    expect(formBuilder.FORMATTERS.id({
      type: 'id',
      required: true,
      enum: [id],
    }, 'root.0.field', {}, store)).toEqual({
      configuration: {
        type: 'string',
        required: true,
        defaultValue: id,
      },
      fieldProps: {
        'root.0.field': {
          component: 'Options',
          componentProps: {
            select: true,
            options: [{
              type: 'option',
              value: 'null',
              label: 'PLACEHOLDER',
            }, {
              type: 'option',
              value: '123456789012345678901234',
              label: '123456789012345678901234',
            }],
          },
        },
      },
    });
    expect(formBuilder.FORMATTERS.id({
      type: 'id',
      enum: [id],
    }, 'root.0.field', {}, store)).toEqual({
      configuration: {
        type: 'string',
      },
      fieldProps: {
        'root.0.field': {
          component: 'Options',
          componentProps: {
            select: true,
            options: [{
              type: 'option',
              value: 'null',
              label: 'PLACEHOLDER',
            }, {
              type: 'option',
              value: '123456789012345678901234',
              label: '123456789012345678901234',
            }],
          },
        },
      },
    });
  });

  test('[FORMATTERS] - id, no enumeration, relation', async () => {
    let configuration = formBuilder.FORMATTERS.id({ type: 'id', relation: 'users' }, 'root.0.field', {}, store);
    expect(configuration).toEqual({
      configuration: { type: 'string' },
      fieldProps: {
        'root.0.field': {
          component: 'LazyOptions',
          componentProps: {
            collection: 'users',
            labelFn: expect.any(Function) as () => void,
            loadResults: expect.any(Function) as () => void,
          },
        },
      },
    });
    let { componentProps } = configuration.fieldProps['root.0.field'];
    expect(await (componentProps.labelFn as (resource: unknown) => Promise<string>)(null)).toBe('');
    expect(await (componentProps.loadResults as (resource: unknown) => Promise<unknown[]>)('')).toEqual([{
      label: '',
      type: 'option',
      value: '123456789012345678901234',
    }]);
    expect(await (componentProps.loadResults as (resource: unknown) => Promise<unknown[]>)('test')).toEqual([]);
    configuration = formBuilder.FORMATTERS.id({ type: 'id', relation: 'users' }, 'root.0.field', { email: 'email' }, store);
    expect(configuration).toEqual({
      configuration: { type: 'string' },
      fieldProps: {
        'root.0.field': {
          component: 'LazyOptions',
          componentProps: {
            collection: 'users',
            labelFn: expect.any(Function) as () => void,
            loadResults: expect.any(Function) as () => void,
          },
        },
      },
    });
    componentProps = configuration.fieldProps['root.0.field'].componentProps;
    expect(await (componentProps.labelFn as (resource: unknown) => Promise<string>)(null)).toBe('test');
    expect(await (componentProps.loadResults as (resource: unknown) => Promise<unknown[]>)('test')).toEqual([]);
  });

  test('[FORMATTERS] - binary', () => {
    const configuration = formBuilder.FORMATTERS.binary({ type: 'binary' }, 'root.0.field', {}, store);
    expect(configuration).toEqual({
      configuration: { type: 'binary' },
      fieldProps: {
        'root.0.field': {
          component: 'FilePicker',
          componentProps: {},
        },
      },
    });
  });

  test('[FORMATTERS] - boolean', () => {
    expect(formBuilder.FORMATTERS.boolean({ type: 'boolean' }, 'root.0.field', {}, store)).toEqual({
      configuration: { type: 'boolean' },
      fieldProps: {
        'root.0.field': {
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
    });
    expect(formBuilder.FORMATTERS.boolean({ type: 'boolean', required: true }, 'root.0.field', {}, store)).toEqual({
      configuration: { type: 'boolean', required: true },
      fieldProps: {
        'root.0.field': {
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
    });
  });

  test('[FORMATTERS] - date, no enumeration', () => {
    const configuration = formBuilder.FORMATTERS.date({ type: 'date' }, 'root.0.field', {}, store);
    const { validation } = configuration.configuration as StringConfiguration;
    expect(validation?.('', {}, {})).toBe('PATTERN_VIOLATION');
    expect(validation?.(new Date() as unknown as string, {}, {})).toBeNull();
    expect(validation?.('2023-01-01T00:00:00.000Z', {}, {})).toBeNull();
    expect(configuration).toEqual({
      configuration: { type: 'date', validation: expect.any(Function) as () => void },
      fieldProps: {
        'root.0.field': {
          component: 'DatePicker',
          componentProps: {},
        },
      },
    });
    expect(formBuilder.FORMATTERS.date({ type: 'date', required: true }, 'root.0.field', {}, store)).toEqual({
      configuration: { type: 'date', required: true, validation: expect.any(Function) as () => void },
      fieldProps: {
        'root.0.field': {
          component: 'DatePicker',
          componentProps: {},
        },
      },
    });
  });

  test('[FORMATTERS] - date, enumeration', () => {
    expect(formBuilder.FORMATTERS.date({
      type: 'date',
      enum: [new Date('2023/01/01')],
    }, 'root.0.field', {}, store)).toEqual({
      configuration: { type: 'date' },
      fieldProps: {
        'root.0.field': {
          component: 'Options',
          componentProps: {
            select: true,
            options: [{
              type: 'option',
              value: 'null',
              label: 'PLACEHOLDER',
            }, {
              type: 'option',
              value: 'Sun Jan 01 2023 00:00:00 GMT+0000 (Coordinated Universal Time)',
              label: 'SUN JAN 01 2023 00:00:00 GMT+0000 (COORDINATED UNIVERSAL TIME)',
            }],
          },
        },
      },
    });
    const date = new Date('2023/01/01');
    expect(formBuilder.FORMATTERS.date({
      type: 'date',
      required: true,
      enum: [date],
    }, 'root.0.field', {}, store)).toEqual({
      configuration: { type: 'date', required: true, defaultValue: date },
      fieldProps: {
        'root.0.field': {
          component: 'Options',
          componentProps: {
            select: true,
            options: [{
              type: 'option',
              value: 'null',
              label: 'PLACEHOLDER',
            }, {
              type: 'option',
              value: 'Sun Jan 01 2023 00:00:00 GMT+0000 (Coordinated Universal Time)',
              label: 'SUN JAN 01 2023 00:00:00 GMT+0000 (COORDINATED UNIVERSAL TIME)',
            }],
          },
        },
      },
    });
  });

  test('[FORMATTERS] - integer, no enumeration', () => {
    let configuration = formBuilder.FORMATTERS.integer({
      type: 'integer',
      maximum: 10,
      minimum: 1,
      multipleOf: 1,
    }, 'root.0.field', {}, store);
    let { validation } = configuration.configuration as StringConfiguration;
    expect(validation?.(NaN as unknown as string, {}, {})).toBe('NOT_A_NUMBER');
    expect(validation?.(0 as unknown as string, {}, {})).toBe('BELOW_MINIMUM');
    expect(validation?.(11 as unknown as string, {}, {})).toBe('ABOVE_MAXIMUM');
    expect(validation?.(5 as unknown as string, {}, {})).toBeNull();
    expect(configuration).toEqual({
      configuration: { type: 'integer', validation: expect.any(Function) as () => void },
      fieldProps: {
        'root.0.field': {
          component: 'Textfield',
          componentProps: {
            type: 'number',
            steps: 1,
            min: 1,
            max: 10,
          },
        },
      },
    });
    configuration = formBuilder.FORMATTERS.integer({
      type: 'integer',
      exclusiveMaximum: 10,
      exclusiveMinimum: 1,
    }, 'root.0.field', {}, store);
    validation = (configuration.configuration as StringConfiguration).validation;
    expect(validation?.(0 as unknown as string, {}, {})).toBe('BELOW_STRICT_MINIMUM');
    expect(validation?.(11 as unknown as string, {}, {})).toBe('ABOVE_STRICT_MAXIMUM');
    expect(configuration).toEqual({
      configuration: { type: 'integer', validation: expect.any(Function) as () => void },
      fieldProps: {
        'root.0.field': {
          component: 'Textfield',
          componentProps: {
            type: 'number',
            min: 1,
            max: 10,
          },
        },
      },
    });
  });

  test('[FORMATTERS] - integer, enumeration', () => {
    expect(formBuilder.FORMATTERS.integer({
      type: 'integer',
      enum: [1],
    }, 'root.0.field', {}, store)).toEqual({
      configuration: { type: 'integer' },
      fieldProps: {
        'root.0.field': {
          component: 'Options',
          componentProps: {
            select: true,
            options: [{
              type: 'option',
              value: 'null',
              label: 'PLACEHOLDER',
            }, {
              type: 'option',
              value: '1',
              label: '1',
            }],
          },
        },
      },
    });
    expect(formBuilder.FORMATTERS.integer({
      type: 'integer',
      enum: [1],
      required: true,
    }, 'root.0.field', {}, store)).toEqual({
      configuration: { type: 'integer', required: true, defaultValue: 1 },
      fieldProps: {
        'root.0.field': {
          component: 'Options',
          componentProps: {
            select: true,
            options: [{
              type: 'option',
              value: 'null',
              label: 'PLACEHOLDER',
            }, {
              type: 'option',
              value: '1',
              label: '1',
            }],
          },
        },
      },
    });
  });

  test('[FORMATTERS] - float, no enumeration', () => {
    let configuration = formBuilder.FORMATTERS.float({
      type: 'float',
      maximum: 10,
      minimum: 1,
      multipleOf: 1,
    }, 'root.0.field', {}, store);
    let { validation } = configuration.configuration as StringConfiguration;
    expect(validation?.(NaN as unknown as string, {}, {})).toBe('NOT_A_NUMBER');
    expect(validation?.(0 as unknown as string, {}, {})).toBe('BELOW_MINIMUM');
    expect(validation?.(11 as unknown as string, {}, {})).toBe('ABOVE_MAXIMUM');
    expect(validation?.(5 as unknown as string, {}, {})).toBeNull();
    expect(configuration).toEqual({
      configuration: { type: 'float', validation: expect.any(Function) as () => void },
      fieldProps: {
        'root.0.field': {
          component: 'Textfield',
          componentProps: {
            type: 'number',
            steps: 1,
            min: 1,
            max: 10,
          },
        },
      },
    });
    configuration = formBuilder.FORMATTERS.float({
      type: 'float',
      exclusiveMaximum: 10,
      exclusiveMinimum: 1,
    }, 'root.0.field', {}, store);
    validation = (configuration.configuration as StringConfiguration).validation;
    expect(validation?.(0 as unknown as string, {}, {})).toBe('BELOW_STRICT_MINIMUM');
    expect(validation?.(11 as unknown as string, {}, {})).toBe('ABOVE_STRICT_MAXIMUM');
    expect(configuration).toEqual({
      configuration: { type: 'float', validation: expect.any(Function) as () => void },
      fieldProps: {
        'root.0.field': {
          component: 'Textfield',
          componentProps: {
            type: 'number',
            min: 1,
            max: 10,
          },
        },
      },
    });
  });

  test('[FORMATTERS] - float, enumeration', () => {
    expect(formBuilder.FORMATTERS.float({
      type: 'float',
      enum: [1],
    }, 'root.0.field', {}, store)).toEqual({
      configuration: { type: 'float' },
      fieldProps: {
        'root.0.field': {
          component: 'Options',
          componentProps: {
            select: true,
            options: [{
              type: 'option',
              value: 'null',
              label: 'PLACEHOLDER',
            }, {
              type: 'option',
              value: '1',
              label: '1',
            }],
          },
        },
      },
    });
    expect(formBuilder.FORMATTERS.float({
      type: 'float',
      enum: [1],
      required: true,
    }, 'root.0.field', {}, store)).toEqual({
      configuration: { type: 'float', required: true, defaultValue: 1 },
      fieldProps: {
        'root.0.field': {
          component: 'Options',
          componentProps: {
            select: true,
            options: [{
              type: 'option',
              value: 'null',
              label: 'PLACEHOLDER',
            }, {
              type: 'option',
              value: '1',
              label: '1',
            }],
          },
        },
      },
    });
  });

  test('[FORMATTERS] - string, no enumeration', () => {
    const configuration = formBuilder.FORMATTERS.string({
      type: 'string',
      minLength: 5,
      maxLength: 10,
      pattern: /TEST/.source,
    }, 'root.0.field', {}, store);
    const { validation } = configuration.configuration as StringConfiguration;
    expect(validation?.('TEST', {}, {})).toBe('VALUE_TOO_SHORT');
    expect(validation?.('TESTTESTTEST', {}, {})).toBe('VALUE_TOO_LONG');
    expect(validation?.('testtest', {}, {})).toBe('PATTERN_VIOLATION');
    expect(validation?.('TEST1', {}, {})).toBeNull();
    expect(configuration).toEqual({
      configuration: { type: 'string', validation: expect.any(Function) as () => void },
      fieldProps: {
        'root.0.field': {
          component: 'Textfield',
          componentProps: {
            maxLength: 10,
          },
        },
      },
    });
    expect(formBuilder.FORMATTERS.string({ type: 'string' }, 'root.0.field', {}, store)).toEqual({
      configuration: { type: 'string', validation: expect.any(Function) as () => void },
      fieldProps: {
        'root.0.field': {
          component: 'Textarea',
          componentProps: {},
        },
      },
    });
  });

  test('[FORMATTERS] - string, enumeration', () => {
    expect(formBuilder.FORMATTERS.string({
      type: 'string',
      enum: ['test'],
    }, 'root.0.field', {}, store)).toEqual({
      configuration: { type: 'string' },
      fieldProps: {
        'root.0.field': {
          component: 'Options',
          componentProps: {
            select: true,
            options: [{
              type: 'option',
              value: 'null',
              label: 'PLACEHOLDER',
            }, {
              type: 'option',
              value: 'test',
              label: 'TEST',
            }],
          },
        },
      },
    });
    expect(formBuilder.FORMATTERS.string({
      type: 'string',
      enum: ['test'],
      required: true,
    }, 'root.0.field', {}, store)).toEqual({
      configuration: { type: 'string', required: true, defaultValue: 'test' },
      fieldProps: {
        'root.0.field': {
          component: 'Options',
          componentProps: {
            select: true,
            options: [{
              type: 'option',
              value: 'null',
              label: 'PLACEHOLDER',
            }, {
              type: 'option',
              value: 'test',
              label: 'TEST',
            }],
          },
        },
      },
    });
  });

  test('[FORMATTERS] - object', () => {
    expect(formBuilder.FORMATTERS.object({
      type: 'object',
      fields: { key: { type: 'string' } },
    }, '', {}, store)).toEqual({
      configuration: {
        type: 'object',
        fields: { key: { type: 'string', validation: expect.any(Function) as () => void } },
      },
      fieldProps: {
        'root.0.key': {
          component: 'Textarea',
          componentProps: {},
        },
      },
    });
    expect(formBuilder.FORMATTERS.object({
      type: 'object',
      fields: { key: { type: 'string' } },
    }, 'root.0.field', {}, store)).toEqual({
      configuration: {
        type: 'object',
        fields: { key: { type: 'string', validation: expect.any(Function) as () => void } },
      },
      fieldProps: {
        'root.0.field': {
          component: 'Object',
          componentProps: {},
        },
        'root.0.field.key': {
          component: 'Textarea',
          componentProps: {},
        },
      },
    });
  });

  test('[FORMATTERS] - array', () => {
    const configuration = formBuilder.FORMATTERS.array({
      type: 'array',
      uniqueItems: true,
      maxItems: 2,
      minItems: 1,
      fields: { type: 'string' },
    }, 'root.0.field', {}, store);
    const { validation } = configuration.configuration as StringConfiguration;
    expect(validation?.([1, 1] as unknown as string, {}, {})).toBe('DUPLICATE_ITEMS');
    expect(validation?.([] as unknown as string, {}, {})).toBe('TOO_FEW_ITEMS');
    expect(validation?.([1, 2, 3] as unknown as string, {}, {})).toBe('TOO_MANY_ITEMS');
    expect(validation?.([1, 2] as unknown as string, {}, {})).toBeNull();
    expect(configuration).toEqual({
      configuration: {
        type: 'array',
        fields: {
          type: 'string',
          validation: expect.any(Function) as () => void,
        },
        validation: expect.any(Function) as () => void,
      },
      fieldProps: {
        'root.0.field': {
          component: 'Array',
          componentProps: {
            minItems: 1,
            maxItems: 2,
          },
        },
        'root.0.field.$n': {
          component: 'Textarea',
          componentProps: {},
        },
      },
    });
  });

  test('[filterModel] - root path', () => {
    expect(formBuilder.filterModel('users', 'UPDATE', { type: 'null' }, '_', store)).toBeNull();
  });

  test('[filterModel] - non-root path, no access to the field', () => {
    expect(formBuilder.filterModel('users', 'UPDATE', { type: 'null' }, 'forbidden', store)).toBeNull();
  });

  test('[filterModel] - non-root path, access to the field', () => {
    expect(formBuilder.filterModel('users', 'UPDATE', { type: 'null' }, 'field', store)).toEqual({
      schema: { type: 'null' },
      fields: new Set(['field']),
      canUserCreateResource: true,
    });
  });

  test('[filterModel] - non-root path, array', () => {
    expect(formBuilder.filterModel('users', 'UPDATE', { type: 'array', fields: { type: 'null' } }, 'field', store)).toEqual({
      schema: { type: 'array', fields: { type: 'null' } },
      fields: new Set(['field']),
      canUserCreateResource: true,
    });
  });

  test('[filterModel] - root path, object', () => {
    expect(formBuilder.filterModel('users', 'UPDATE', {
      type: 'object',
      fields: { key: { type: 'null' } },
    }, '_', store)).toEqual({
      schema: { type: 'object', fields: { key: { type: 'null' } } },
      fields: new Set(['key']),
      canUserCreateResource: true,
    });
    expect(formBuilder.filterModel('users', 'UPDATE', {
      type: 'object',
      fields: { forbidden: { type: 'null' } },
    }, '_', store)).toEqual({
      schema: { type: 'object', fields: {} },
      fields: new Set(),
      canUserCreateResource: false,
    });
  });

  test('[filterModel] - non-root path, object', () => {
    expect(formBuilder.filterModel('users', 'UPDATE', {
      type: 'object',
      fields: { key: { type: 'null' } },
    }, 'field', store)).toEqual({
      schema: { type: 'object', fields: { key: { type: 'null' } } },
      fields: new Set(['field']),
      canUserCreateResource: true,
    });
  });

  test('[buildConfiguration] - create mode', () => {
    vi.spyOn(formBuilder, 'filterModel').mockImplementation(() => ({
      schema: { type: 'null' } as FieldSchema<DefaultDataModel>,
      fields: new Set<string>(),
      canUserCreateResource: true,
    }));
    formBuilder.buildConfiguration('users', null, new Set(), store);
    vi.spyOn(formBuilder, 'filterModel').mockImplementation(() => ({
      schema: { type: 'null' } as FieldSchema<DefaultDataModel>,
      fields: new Set<string>(),
      canUserCreateResource: false,
    }));
    const configuration = formBuilder.buildConfiguration('users', null, new Set(), store);
    expect(configuration).toEqual({
      configuration: {
        fields: {
          submit: {
            submit: true,
            type: 'null',
          },
        },
        root: 'root',
        steps: {
          root: {
            fields: ['submit'],
            submit: true,
          },
        },
        submitPartialUpdates: false,
      },
      fieldProps: {
        '': {
          component: 'Null',
          componentProps: {},
        },
        'root.0.submit': {
          component: 'Button',
          componentProps: {
            modifiers: 'primary',
            type: 'submit',
          },
        },
      },
      requestedFields: new Set(),
    });
  });

  test('[buildConfiguration] - update mode', () => {
    const configuration = formBuilder.buildConfiguration('users', new Id(), new Set(), store);
    expect(configuration).toEqual({
      configuration: {
        fields: {
          submit: {
            submit: true,
            type: 'null',
          },
        },
        root: 'root',
        steps: {
          root: {
            fields: ['submit'],
            submit: true,
          },
        },
        submitPartialUpdates: true,
      },
      fieldProps: {
        'root.0.submit': {
          component: 'Button',
          componentProps: {
            modifiers: 'primary',
            type: 'submit',
          },
        },
      },
      requestedFields: new Set(),
    });
  });

  test('[getSignUpConfiguration]', () => {
    const configuration = formBuilder.getSignUpConfiguration(vi.fn());
    const { fields } = configuration.configuration;
    (configuration.fieldProps['root.0.email']?.componentProps?.transform as (value: string) => void)('');
    expect((fields.email as StringConfiguration).validation?.('', {}, {})).toBe('PATTERN_VIOLATION');
    expect((fields.email as StringConfiguration).validation?.('test@test.test', {}, {})).toBeNull();
    expect((fields.password as StringConfiguration).validation?.('', {}, {})).toBe('PATTERN_VIOLATION');
    expect((fields.password as StringConfiguration).validation?.('Hello123!', {}, {})).toBeNull();
    expect((fields.passwordConfirmation as StringConfiguration).validation?.('', {}, {})).toBe('PATTERN_VIOLATION');
    expect((fields.passwordConfirmation as StringConfiguration).validation?.('Hello123!', { password: '' }, {})).toBe('PASSWORDS_MISMATCH');
    expect((fields.passwordConfirmation as StringConfiguration).validation?.('Hello123!', { password: null }, {})).toBeNull();
    expect(configuration).toEqual({
      requestedFields: new Set(),
      configuration: {
        root: 'root',
        fields: {
          email: {
            type: 'string',
            required: true,
            validation: expect.any(Function) as () => void,
          },
          password: {
            type: 'string',
            required: true,
            validation: expect.any(Function) as () => void,
          },
          passwordConfirmation: {
            type: 'string',
            required: true,
            validation: expect.any(Function) as () => void,
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
        onSubmit: expect.any(Function) as () => void,
      },
      fieldProps: {
        'root.0.submit': {
          component: 'Button',
          componentProps: { type: 'submit', modifiers: 'primary' },
        },
        'root.0.email': {
          component: 'Textfield',
          componentProps: {
            maxlength: 50,
            autofocus: true,
            transform: expect.any(Function) as () => void,
          },
        },
        'root.0.password': {
          component: 'Textfield',
          componentProps: { maxlength: 50, type: 'password' },
        },
        'root.0.passwordConfirmation': {
          component: 'Textfield',
          componentProps: { maxlength: 50, type: 'password' },
        },
      },
    });
  });

  test('[getSignInConfiguration]', () => {
    const configuration = formBuilder.getSignInConfiguration(vi.fn());
    (configuration.fieldProps['root.0.email']?.componentProps?.transform as (value: string) => void)('');
    expect(configuration).toEqual({
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
        onSubmit: expect.any(Function) as () => void,
      },
      fieldProps: {
        'root.0.submit': {
          component: 'Button',
          componentProps: { type: 'submit', modifiers: 'primary' },
        },
        'root.0.email': {
          component: 'Textfield',
          componentProps: {
            maxlength: 50,
            autofocus: true,
            transform: expect.any(Function) as () => void,
          },
        },
        'root.0.password': {
          component: 'Textfield',
          componentProps: { maxlength: 50, type: 'password' },
        },
      },
    });
  });

  test('[getUpdateUserConfiguration]', () => {
    const configuration = formBuilder.getUpdateUserConfiguration({} as User, vi.fn(), vi.fn());
    const { fields } = configuration.configuration;
    (configuration.fieldProps['root.0.email']?.componentProps?.transform as (value: string) => void)('');
    expect((fields.email as StringConfiguration).validation?.('', {}, {})).toBe('PATTERN_VIOLATION');
    expect((fields.email as StringConfiguration).validation?.('test@test.test', {}, {})).toBeNull();
    configuration.configuration.plugins?.[0]({
      on: vi.fn((_, callback: (data: unknown, next: () => void) => void) => {
        callback({ path: 'root.0.resetPassword' }, vi.fn());
      }),
    } as unknown as Engine);
    expect(configuration).toEqual({
      requestedFields: new Set(),
      configuration: {
        root: 'root',
        initialValues: {},
        fields: {
          resetPassword: { type: 'null' },
          submit: { type: 'null', submit: true },
          email: {
            type: 'string',
            required: true,
            validation: expect.any(Function) as () => void,
          },
        },
        steps: {
          root: {
            submit: true,
            fields: ['email', 'resetPassword', 'submit'],
          },
        },
        onSubmit: expect.any(Function) as () => void,
        plugins: [expect.any(Function) as () => void],
      },
      fieldProps: {
        'root.0.email': {
          component: 'Textfield',
          componentProps: {
            maxlength: 50,
            autofocus: true,
            transform: expect.any(Function) as () => void,
          },
        },
        'root.0.submit': {
          component: 'Button',
          componentProps: { type: 'submit', modifiers: 'primary' },
        },
        'root.0.resetPassword': {
          component: 'Button',
          componentProps: { type: 'submit', modifiers: 'secondary outlined' },
        },
      },
    });
  });

  test('[getResetPasswordConfiguration] - null reset token', () => {
    const configuration = formBuilder.getResetPasswordConfiguration(null, vi.fn(), vi.fn());
    const { fields } = configuration.configuration;
    (configuration.fieldProps['root.0.email']?.componentProps?.transform as (value: string) => void)('');
    expect((fields.email as StringConfiguration).validation?.('', {}, {})).toBe('PATTERN_VIOLATION');
    expect((fields.email as StringConfiguration).validation?.('test@test.test', {}, {})).toBeNull();
    expect(configuration).toEqual({
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
            validation: expect.any(Function) as () => void,
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
        onSubmit: expect.any(Function) as () => void,
      },
      fieldProps: {
        'root.0.title': {
          component: 'Message',
          componentProps: {},
        },
        'root.0.successTitle': {
          component: 'Message',
          componentProps: {},
        },
        'root.0.successMessage': {
          component: 'Message',
          componentProps: {},
        },
        'root.0.email': {
          component: 'Textfield',
          componentProps: {
            maxlength: 50,
            autofocus: true,
            transform: expect.any(Function) as () => void,
          },
        },
        'root.0.submit': {
          component: 'Button',
          componentProps: { type: 'submit', modifiers: 'primary' },
        },
      },
    });
  });

  test('[getResetPasswordConfiguration] - non-null reset token', () => {
    const configuration = formBuilder.getResetPasswordConfiguration('resetToken', vi.fn(), vi.fn());
    const { fields } = configuration.configuration;
    (configuration.fieldProps['root.0.email']?.componentProps?.transform as (value: string) => void)('');
    expect((fields.email as StringConfiguration).validation?.('', {}, {})).toBe('PATTERN_VIOLATION');
    expect((fields.email as StringConfiguration).validation?.('test@test.test', {}, {})).toBeNull();
    expect((fields.password as StringConfiguration).validation?.('', {}, {})).toBe('PATTERN_VIOLATION');
    expect((fields.password as StringConfiguration).validation?.('Hello123!', {}, {})).toBeNull();
    expect((fields.passwordConfirmation as StringConfiguration).validation?.('', {}, {})).toBe('PATTERN_VIOLATION');
    expect((fields.passwordConfirmation as StringConfiguration).validation?.('Hello123!', { password: '' }, {})).toBe('PASSWORDS_MISMATCH');
    expect((fields.passwordConfirmation as StringConfiguration).validation?.('Hello123!', { password: null }, {})).toBeNull();
    expect(configuration).toEqual({
      requestedFields: new Set(),
      configuration: {
        root: 'root',
        fields: {
          title: { type: 'null' },
          email: {
            type: 'string',
            required: true,
            validation: expect.any(Function) as () => void,
          },
          password: {
            type: 'string',
            required: true,
            validation: expect.any(Function) as () => void,
          },
          passwordConfirmation: {
            type: 'string',
            required: true,
            validation: expect.any(Function) as () => void,
          },
          submit: {
            type: 'null',
            submit: true,
          },
        },
        steps: {
          root: {
            submit: true,
            fields: ['title', 'email', 'password', 'passwordConfirmation', 'submit'],
          },
        },
        onSubmit: expect.any(Function) as () => void,
      },
      fieldProps: {
        'root.0.title': {
          component: 'Message',
          componentProps: {},
        },
        'root.0.email': {
          component: 'Textfield',
          componentProps: {
            maxlength: 50,
            autofocus: true,
            transform: expect.any(Function) as () => void,
          },
        },
        'root.0.password': {
          component: 'Textfield',
          componentProps: { maxlength: 50, type: 'password' },
        },
        'root.0.passwordConfirmation': {
          component: 'Textfield',
          componentProps: { maxlength: 50, type: 'password' },
        },
        'root.0.submit': {
          component: 'Button',
          componentProps: { type: 'submit', modifiers: 'primary' },
        },
      },
    });
  });
});
