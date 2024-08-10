/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Engine from 'scripts/core/Engine';

type TestEngine = Engine & {
  cache: Engine['cache'];
  store: Engine['store'];
  steps: Engine['steps'];
  coerce: Engine['coerce'];
  areEqual: Engine['areEqual'];
  variables: Engine['variables'];
  userInputs: Engine['userInputs'];
  toggleField: Engine['toggleField'];
  createField: Engine['createField'];
  toggleFields: Engine['toggleFields'];
  triggerHooks: Engine['triggerHooks'];
  initialValues: Engine['initialValues'];
  validateField: Engine['validateField'];
  configuration: Engine['configuration'];
  validateFields: Engine['validateFields'];
  userInputsQueue: Engine['userInputsQueue'];
  enqueueMutation: Engine['enqueueMutation'];
  handleUserAction: Engine['handleUserAction'];
  processUserInputs: Engine['processUserInputs'];
  discardedUserInputs: Engine['discardedUserInputs'];
};

describe('core/Engine', () => {
  vi.mock('@perseid/core');
  vi.mock('@perseid/store');

  let engine: TestEngine;

  const configuration: Configuration = {
    root: 'root',
    fields: {
      test: {
        type: 'string',
        required: true,
      },
      submit: {
        type: 'null',
        submit: true,
      },
    },
    steps: {
      root: {
        submit: true,
        fields: ['test'],
        nextStep() { return 'second'; },
      },
      second: {
        fields: ['submit'],
      },
    },
    onSubmit: vi.fn(),
  };

  const cache = {
    set: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
    get: vi.fn(() => Promise.resolve({
      userInputs: { full: { test: 'value' }, partial: {} },
      variables: { var1: 'test1', var2: 'test2' },
      discardedUserInputs: new Map(),
      steps: [{
        path: 'root.0',
        status: 'success',
        fields: [{
          value: null,
          error: null,
          type: 'string',
          required: true,
          status: 'success',
          path: 'root.0.field',
        }],
      }],
    })),
  };

  async function createEngine(
    configurationOverride: Configuration = configuration,
    flush = true,
  ): Promise<TestEngine> {
    engine = new Engine(configurationOverride) as TestEngine;
    await new Promise<void>((resolve) => {
      engine.on('afterStep', async (data, next) => {
        resolve();
        return next(data);
      });
    });
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        if (flush) {
          vi.clearAllMocks();
          vi.runAllTimers();
        }
        resolve();
      }, 50);
      vi.runAllTimers();
    });
    return engine;
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    await createEngine();
  });

  test('[isEmpty]', () => {
    expect(engine.isEmpty('', 'string')).toBe(true);
    expect(engine.isEmpty(null, 'string')).toBe(true);
    expect(engine.isEmpty(undefined, 'string')).toBe(true);
  });

  test('[areEqual]', () => {
    const date1 = new Date(1657816419059);
    const date2 = new Date(1657816419059);
    const binary1 = { size: 1982, name: 'test.png' };
    const binary2 = { size: 1982, name: 'test.png' };
    expect(engine.areEqual(1.0, 1.0, 'float')).toBe(true);
    expect(engine.areEqual(1.2, 1.0, 'float')).toBe(false);
    expect(engine.areEqual(NaN, NaN, 'float')).toBe(true);
    expect(engine.areEqual(date1, date2, 'date')).toBe(true);
    expect(engine.areEqual(NaN, NaN, 'integer')).toBe(true);
    expect(engine.areEqual('test', 'test', 'string')).toBe(true);
    expect(engine.areEqual(binary1, binary2, 'binary')).toBe(true);
    expect(engine.areEqual('test1', 'test2', 'string')).toBe(false);
  });

  test('[coerce]', () => {
    expect(engine.coerce('', 'string')).toBe(null);
    expect(engine.coerce('', 'boolean')).toBe(false);
    expect(engine.coerce('3.0', 'float')).toBe(3.0);
    expect(engine.coerce('_3_0', 'float')).toBe(null);
    expect(engine.coerce('3', 'integer')).toBe(3);
    expect(engine.coerce('_3', 'integer')).toBe(null);
    expect(engine.coerce('test', 'string')).toBe('test');
    expect(engine.coerce('2022-07-14T16:47:19.253Z', 'date')).toBeInstanceOf(Date);
    expect(() => engine.coerce('', 'array')).toThrow(new Error('Input is not an array.'));
    expect(() => engine.coerce('', 'object')).toThrow(new Error('Input is not a plain object.'));
  });

  describe('[createField]', () => {
    test('primitive', () => {
      expect(engine.createField('root.0.test', {
        type: 'string',
        required: true,
        defaultValue: 'test',
      })).toEqual({
        error: null,
        type: 'string',
        required: true,
        status: 'initial',
        value: undefined,
        path: 'root.0.test',
      });
    });

    test('primitive - display condition not met', () => {
      expect(engine.createField('root.0.test', {
        type: 'string',
        required: true,
        condition: () => false,
      })).toBeNull();
    });

    test('array', () => {
      expect(engine.createField('root.0.test', {
        type: 'array',
        required: true,
        fields: { type: 'string' },
      })).toEqual({
        fields: [],
        error: null,
        type: 'array',
        required: true,
        value: undefined,
        status: 'initial',
        path: 'root.0.test',
      });
    });

    test('object', () => {
      engine.discardedUserInputs.set('root.0.test', { test: { key: 'test' } });
      expect(engine.createField('root.0.test', {
        type: 'object',
        required: true,
        fields: { key: { type: 'string' } },
      })).toEqual({
        fields: [],
        error: null,
        type: 'object',
        required: true,
        value: undefined,
        status: 'initial',
        path: 'root.0.test',
      });
    });
  });

  test('[enqueueMutation]', async () => {
    const newCache = { set: vi.fn(), get: vi.fn(), delete: vi.fn() };
    await createEngine({ ...configuration, cache: newCache });
    vi.spyOn(global, 'clearTimeout');
    vi.spyOn(engine.store, 'mutate');
    engine.enqueueMutation('SET_LOADER', true);
    vi.runAllTimers();
    expect(newCache.set).toHaveBeenCalledOnce();
    expect(newCache.set).toHaveBeenCalledWith('form_cache', {
      steps: [{
        path: 'root.0',
        status: 'initial',
        fields: [{
          error: null,
          path: 'root.0.test',
          required: true,
          status: 'initial',
          type: 'string',
          value: undefined,
        }],
      }],
      variables: {},
      discardedUserInputs: new Map(),
      userInputs: { full: {}, partial: {} },
    });
    expect(global.clearTimeout).toHaveBeenCalledOnce();
    expect(engine.store.mutate).toHaveBeenCalledTimes(2);
    expect(engine.store.mutate).toHaveBeenCalledWith('state', 'UPDATE', {
      loading: true,
      steps: [{
        path: 'root.0',
        status: 'initial',
        fields: [{
          error: null,
          path: 'root.0.test',
          required: true,
          status: 'initial',
          type: 'string',
          value: undefined,
        }],
      }],
      variables: {},
      userInputs: { full: {}, partial: {} },
    });
  });

  describe('[toggleField]', () => {
    test('primitive - display condition not met', () => {
      const field: Field = {
        error: null,
        type: 'string',
        required: false,
        value: undefined,
        status: 'initial',
        path: 'root.0.field1',
      };
      const fieldConfiguration: FieldConfiguration = { type: 'string', condition: () => false };
      expect(engine.toggleField('root.0.field1', field, fieldConfiguration, null, null)).toBeNull();
      expect(engine.userInputsQueue.size).toBe(0);
      expect(engine.discardedUserInputs.get('root.0.field1')).toBeNull();
    });

    test('primitive - new field', () => {
      const fieldConfiguration: FieldConfiguration = { type: 'string' };
      expect(engine.toggleField('root.0.field1', null, fieldConfiguration, 'test', undefined)).toEqual({
        error: null,
        type: 'string',
        required: false,
        value: undefined,
        status: 'initial',
        path: 'root.0.field1',
      });
      expect(engine.userInputsQueue).toEqual(new Map([['root.0.field1', {
        data: 'test',
        configuration: fieldConfiguration,
      }]]));
    });

    test('primitive - existing field, new value', () => {
      const field: Field = {
        error: null,
        type: 'string',
        required: false,
        value: undefined,
        status: 'initial',
        path: 'root.0.field1',
      };
      const fieldConfiguration: FieldConfiguration = { type: 'string' };

      // First stage.
      expect(engine.toggleField('root.0.field1', field, fieldConfiguration, 'test', 'old')).toEqual({
        error: null,
        type: 'string',
        required: false,
        value: undefined,
        status: 'initial',
        path: 'root.0.field1',
      });
      expect(engine.userInputsQueue).toEqual(new Map([['root.0.field1', {
        data: 'test',
        configuration: fieldConfiguration,
      }]]));

      // Second stage.
      field.value = 'test';
      const userInputs = { full: undefined, partial: undefined };
      expect(engine.toggleField('root.0.field1', field, fieldConfiguration, 'test', 'old', userInputs)).toEqual({
        error: null,
        value: 'test',
        type: 'string',
        required: false,
        status: 'initial',
        path: 'root.0.field1',
      });
      expect(engine.userInputsQueue).toEqual(new Map([['root.0.field1', {
        data: 'test',
        configuration: fieldConfiguration,
      }]]));
      expect(userInputs.full).toBe('test');
      expect(userInputs.partial).toBe('test');
    });

    test('primitive - existing field, same value', () => {
      const field: Field = {
        error: null,
        value: 'test',
        type: 'string',
        required: false,
        status: 'initial',
        path: 'root.0.field1',
      };
      engine.initialValues = { field1: 'test' };
      const userInputs = { full: undefined, partial: undefined };
      const fieldConfiguration: FieldConfiguration = { type: 'string' };
      expect(engine.toggleField('root.0.field1', field, fieldConfiguration, 'test', 'test', userInputs)).toEqual({
        error: null,
        value: 'test',
        type: 'string',
        required: false,
        status: 'initial',
        path: 'root.0.field1',
      });
      expect(engine.userInputsQueue.size).toBe(0);
      expect(userInputs.full).toBe('test');
      expect(userInputs.partial).toBeUndefined();
    });

    test('optional array - new value is `[]`', () => {
      const field: Field = {
        error: null,
        type: 'array',
        required: false,
        value: undefined,
        status: 'success',
        path: 'root.0.field1',
        fields: [],
      };
      const fieldConfiguration: FieldConfiguration = { type: 'array', fields: { type: 'string' } };
      expect(engine.toggleField('root.0.field1', field, fieldConfiguration, [], [])).toEqual({
        error: null,
        value: [],
        type: 'array',
        required: false,
        status: 'success',
        path: 'root.0.field1',
        fields: [],
      });
      expect(engine.userInputsQueue).toEqual(new Map([['root.0.field1', {
        data: [],
        configuration: fieldConfiguration,
      }]]));
    });

    test('required array - new value is `null`', () => {
      const field: Field = {
        error: null,
        value: [],
        type: 'array',
        required: true,
        status: 'success',
        path: 'root.0.field1',
        fields: [],
      };
      const fieldConfiguration: FieldConfiguration = {
        type: 'array',
        required: true,
        fields: { type: 'string' },
      };

      // First stage.
      expect(engine.toggleField('root.0.field1', field, fieldConfiguration, null, null)).toEqual({
        error: null,
        value: [],
        type: 'array',
        required: true,
        status: 'success',
        path: 'root.0.field1',
        fields: [],
      });
      expect(engine.userInputsQueue).toEqual(new Map([['root.0.field1', {
        data: [],
        configuration: fieldConfiguration,
      }]]));

      // Second stage.
      const map = new Map([['root.0.field1', null]]);
      engine.userInputsQueue.delete('root.0.field1');
      expect(engine.toggleField('root.0.field1', field, fieldConfiguration, map, null)).toEqual({
        error: null,
        value: [],
        type: 'array',
        required: true,
        status: 'success',
        path: 'root.0.field1',
        fields: [],
      });
      expect(engine.userInputsQueue.size).toBe(0);
    });

    test('required array - default value', () => {
      const fieldConfiguration: FieldConfiguration = {
        type: 'array',
        fields: { type: 'string' },
      };
      expect(engine.toggleField('root.0.field1', null, fieldConfiguration, undefined, null)).toEqual({
        fields: [],
        error: null,
        type: 'array',
        value: undefined,
        required: false,
        status: 'initial',
        path: 'root.0.field1',
      });
      expect(engine.userInputsQueue).toEqual(new Map([
        ['root.0.field1', {
          configuration: {
            fields: { type: 'string' },
            type: 'array',
          },
          data: null,
        }],
      ]));
    });

    test('required array - default value', () => {
      const fieldConfiguration: FieldConfiguration = {
        type: 'array',
        required: true,
        fields: { type: 'string' },
      };
      expect(engine.toggleField('root.0.field1', null, fieldConfiguration, undefined, undefined)).toEqual({
        value: [],
        fields: [],
        error: null,
        type: 'array',
        required: true,
        status: 'initial',
        path: 'root.0.field1',
      });
      expect(engine.userInputsQueue).toEqual(new Map([['root.0.field1', {
        data: [],
        configuration: fieldConfiguration,
      }]]));
    });

    test('required array - new value is a non-empty array', () => {
      const field: Field = {
        error: null,
        value: [],
        type: 'array',
        required: true,
        status: 'success',
        path: 'root.0.field1',
        fields: [{
          error: null,
          value: null,
          type: 'string',
          required: false,
          status: 'initial',
          path: 'root.0.field1.0',
        }],
      };
      const fieldConfiguration: FieldConfiguration = {
        type: 'array',
        required: true,
        fields: { type: 'string' },
      };

      // First stage.
      expect(engine.toggleField('root.0.field1', field, fieldConfiguration, ['test', null], [])).toEqual({
        error: null,
        value: [null],
        type: 'array',
        required: true,
        status: 'success',
        path: 'root.0.field1',
        fields: [{
          error: null,
          value: null,
          type: 'string',
          required: false,
          status: 'initial',
          path: 'root.0.field1.0',
        }, {
          error: null,
          type: 'string',
          value: undefined,
          required: false,
          status: 'initial',
          path: 'root.0.field1.1',
        }],
      });
      expect(engine.userInputsQueue).toEqual(new Map<string, Data>([
        ['root.0.field1', { data: ['test', null], configuration: fieldConfiguration }],
        ['root.0.field1.0', { data: 'test', configuration: fieldConfiguration.fields }],
        ['root.0.field1.1', { data: null, configuration: fieldConfiguration.fields }],
      ]));

      // Second stage.
      const map = new Map<string, Data>([
        ['root.0.field1', ['test', null]],
        ['root.0.field1.0', 'test'],
        ['root.0.field1.1', null],
      ]);
      engine.userInputsQueue = new Map();
      expect(engine.toggleField('root.0.field1', field, fieldConfiguration, map, undefined, {
        full: undefined,
        partial: undefined,
      }, true)).toEqual({
        error: null,
        value: ['test', null],
        type: 'array',
        required: true,
        status: 'success',
        path: 'root.0.field1',
        fields: [{
          error: null,
          value: 'test',
          type: 'string',
          required: false,
          status: 'initial',
          path: 'root.0.field1.0',
        }, {
          error: null,
          value: null,
          type: 'string',
          required: false,
          status: 'initial',
          path: 'root.0.field1.1',
        }],
      });
      expect(engine.userInputsQueue.size).toBe(0);
    });

    test('required object - default value', () => {
      const fieldConfiguration: FieldConfiguration = {
        type: 'object',
        required: true,
        fields: { key: { type: 'string' } },
      };
      expect(engine.toggleField('root.0.field1', null, fieldConfiguration, undefined, undefined)).toEqual({
        error: null,
        value: {},
        type: 'object',
        required: true,
        status: 'initial',
        path: 'root.0.field1',
        fields: [{
          error: null,
          type: 'string',
          required: false,
          value: undefined,
          status: 'initial',
          path: 'root.0.field1.key',
        }],
      });
      expect(engine.userInputsQueue).toEqual(new Map([
        ['root.0.field1', {
          data: {},
          configuration: fieldConfiguration,
        }],
        ['root.0.field1.key', {
          data: null,
          configuration: { type: 'string' },
        }],
      ]));
    });

    test('required object, new value is `null`', () => {
      const field: Field = {
        error: null,
        value: {},
        type: 'object',
        required: true,
        status: 'success',
        path: 'root.0.field1',
        fields: [{
          error: null,
          value: null,
          type: 'string',
          required: false,
          status: 'initial',
          path: 'root.0.field1.key',
        }],
      };
      const fieldConfiguration: FieldConfiguration = {
        type: 'object',
        required: true,
        fields: { key: { type: 'string' } },
      };
      expect(engine.toggleField('root.0.field1', field, fieldConfiguration, null, undefined)).toEqual({
        value: { key: null },
        fields: [{
          error: null,
          path: 'root.0.field1.key',
          required: false,
          status: 'initial',
          type: 'string',
          value: null,
        }],
        error: null,
        type: 'object',
        required: true,
        status: 'success',
        path: 'root.0.field1',
      });
      expect(engine.userInputsQueue).toEqual(new Map([['root.0.field1', {
        data: {},
        configuration: fieldConfiguration,
      }]]));
    });
  });

  test('[toggleFields]', async () => {
    await createEngine({
      ...configuration,
      fields: {
        field1: { type: 'string' },
        field2: { type: 'string' },
      },
      steps: {
        root: { fields: ['field1', 'field2'] },
      },
    });
    const step: Step = {
      path: 'root.0',
      status: 'initial',
      fields: [{
        error: null,
        value: 'test1',
        type: 'string',
        required: false,
        status: 'initial',
        path: 'root.0.field1',
      }, {
        error: null,
        value: 'test2',
        type: 'string',
        required: false,
        status: 'initial',
        path: 'root.0.field2',
      }],
    };
    engine.initialValues = { field1: 'test1' };
    engine.toggleFields(step, new Map());
    expect(step).toEqual({
      path: 'root.0',
      status: 'initial',
      fields: [{
        error: null,
        value: 'test1',
        type: 'string',
        required: false,
        status: 'initial',
        path: 'root.0.field1',
      }, {
        error: null,
        value: 'test2',
        type: 'string',
        required: false,
        status: 'initial',
        path: 'root.0.field2',
      }],
    });
    expect(engine.userInputs).toEqual({
      full: { field1: 'test1', field2: 'test2' },
      partial: { field2: 'test2' },
    });
  });

  describe('[validateField]', () => {
    test('null field', () => {
      expect(engine.validateField(null, { type: 'string' }, false, [])).toBe('success');
    });

    test('primitive', () => {
      const field: Field = {
        error: null,
        value: 'test',
        type: 'string',
        required: false,
        status: 'initial',
        path: 'root.0.test',
      };
      expect(engine.validateField({ ...field, value: null }, { type: 'string' }, true, ['root.0.test2'])).toBe('success');
      expect(engine.validateField({ ...field, value: null }, { type: 'string', required: true }, true, ['root.0.test2'])).toBe('progress');
      expect(engine.validateField(field, { type: 'string' }, false, ['root.0.test'])).toBe('success');
      expect(field.error).toBeNull();
      expect(field.status).toBe('success');
    });

    test('primitive - field is empty', () => {
      const field: Field = {
        value: null,
        type: 'string',
        status: 'error',
        required: false,
        path: 'root.0.test',
        error: 'PATTERN_VIOLATION',
      };
      expect(engine.validateField(field, { type: 'string', required: true }, true, ['root.0.test'])).toBe('error');
      expect(field.status).toBe('error');
      expect(field.error).toBe('REQUIRED');
      expect(engine.validateField(field, { type: 'string' }, false, ['root.0.test'])).toBe('success');
      expect(field.status).toBe('initial');
      expect(engine.validateField(field, { type: 'string', required: true }, true, ['root.0.test'])).toBe('progress');
    });

    test('primitive - validation rule fails', () => {
      const field: Field = {
        value: 'test',
        type: 'string',
        status: 'error',
        required: false,
        path: 'root.0.test',
        error: 'PATTERN_VIOLATION',
      };
      expect(engine.validateField(field, { type: 'string', validation: () => 'INVALID' }, true, ['root.0.test'])).toBe('error');
      expect(field.status).toBe('error');
      expect(field.error).toBe('INVALID');
    });

    test('primitive - validation on submit', async () => {
      const field: Field = {
        value: 'test',
        type: 'string',
        status: 'error',
        required: false,
        error: 'REQUIRED',
        path: 'root.0.test',
      };
      await createEngine({ ...configuration, validateOnSubmit: true });
      expect(engine.validateField(field, { type: 'string' }, true, ['root.0.test'])).toBe('progress');
      expect(field.error).toBeNull();
      expect(field.status).toBe('progress');
    });

    test('array', () => {
      const field: Field = {
        error: null,
        value: [null],
        type: 'array',
        required: false,
        status: 'progress',
        path: 'root.0.field1',
        fields: [{
          error: null,
          value: null,
          type: 'string',
          required: true,
          status: 'progress',
          path: 'root.0.field1.0',
        }],
      };
      const fieldConfiguration: FieldConfiguration = { type: 'array', fields: { type: 'string', required: true } };
      expect(engine.validateField(field, fieldConfiguration, true, ['root.0.test.0'])).toBe('progress');
      expect(field.error).toBeNull();
      expect(field.status).toBe('initial');
    });

    test('object', () => {
      const field: Field = {
        error: null,
        type: 'object',
        required: false,
        value: { key: null },
        status: 'progress',
        path: 'root.0.field1',
        fields: [{
          error: null,
          value: null,
          type: 'string',
          required: true,
          status: 'progress',
          path: 'root.0.field1.key',
        }],
      };
      const fieldConfiguration: FieldConfiguration = { type: 'object', fields: { key: { type: 'string', required: true } } };
      expect(engine.validateField(field, fieldConfiguration, true, ['root.0.test.key'])).toBe('progress');
      expect(field.error).toBeNull();
      expect(field.status).toBe('initial');
    });

    test('object - error', () => {
      const field: Field = {
        error: null,
        value: { key: null },
        status: 'error',
        type: 'object',
        required: false,
        path: 'root.0.field1',
        fields: [{
          error: null,
          value: null,
          type: 'string',
          required: true,
          status: 'progress',
          path: 'root.0.field1.key',
        }],
      };
      const fieldConfiguration: FieldConfiguration = { type: 'object', fields: { key: { type: 'string', required: true } } };
      expect(engine.validateField(field, fieldConfiguration, false, ['root.0.test.key'])).toBe('error');
      expect(field.error).toBeNull();
      expect(field.status).toBe('error');
    });
  });

  test('[validateFields]', () => {
    engine.validateFields(['root.0.test2'], true);
    expect(engine.steps[0].status).toBe('progress');
    engine.validateFields(['root.0.test2'], false);
    expect(engine.steps[0].status).toBe('error');
    (engine.steps[0].fields[0] as unknown as { value: string; }).value = 'test';
    engine.validateFields(['root.0.test'], false);
    expect(engine.steps[0].status).toBe('success');
  });

  describe('[triggerHooks]', () => {
    test('error', async () => {
      let isCacheEnabled = false;
      try {
        await createEngine({
          ...configuration,
          cache,
          restartOnReload: true,
          plugins: [(api: Engine): void => {
            api.on('userAction', (data, next) => (data?.path === 'test'
              ? next(undefined as unknown as UserAction)
              : next(data)));
          }],
        });
        vi.spyOn(engine, 'clearCache').mockImplementation(() => {
          isCacheEnabled = (engine.cache !== null);
          return Promise.resolve();
        });
        await engine.triggerHooks('userAction', { path: 'test' });
      } catch (error) {
        expect(engine.cache).toBe(null);
        expect(isCacheEnabled).toBe(true);
        expect(error).toEqual(new Error(
          'Event "userAction": data passed to the next hook is "undefined". This usually means that'
          + ' you did not correctly resolved your hook Promise with proper data.',
        ));
      }
    });

    test('error with errors hook', async () => {
      const hook = vi.fn((data, next: (_: Data) => Promise<unknown>) => next(data));
      await createEngine({
        ...configuration,
        plugins: [(api: Engine): void => {
          api.on('userAction', (data, next) => (data !== null
            ? next(undefined as unknown as UserAction)
            : next(data)));
          api.on('error', hook as unknown as Hook<Data>);
        }],
      });
      expect(await engine.triggerHooks('userAction', {})).toBe(null);
      expect(hook).toHaveBeenCalledTimes(2);
      expect(hook).toHaveBeenCalledWith(new Error(
        'Event "userAction": data passed to the next hook is "undefined". This usually means that'
        + ' you did not correctly resolved your hook Promise with proper data.',
      ), expect.any(Function));
    });
  });

  test('[processUserInputs]', async () => {
    await createEngine({
      ...configuration,
      cache,
      restartOnReload: true,
      steps: { ...configuration.steps, root: { fields: ['test', 'conditional', 'submit'], submit: true } },
      plugins: [(api: Engine): void => {
        api.on('userAction', async (data) => {
          await Promise.resolve();
          return (data?.path === 'root.0.test') ? null : data;
        });
      }],
      fields: { ...configuration.fields, conditional: { type: 'string', defaultValue: 'test', condition: (values) => values.test === null } },
    });
    let isCacheEnabled = false;
    vi.spyOn(engine, 'clearCache').mockImplementation(() => {
      isCacheEnabled = (engine.cache !== null);
      return Promise.resolve();
    });
    vi.spyOn(engine, 'createStep').mockImplementation(() => Promise.resolve());
    vi.spyOn(engine, 'triggerHooks').mockImplementation((event: unknown, data: unknown) => {
      if (event === 'submit') {
        return Promise.resolve(data as HookData);
      }
      const path = (data as { path: string; } | null)?.path;
      const input = (data as { data: string; } | null)?.data;
      if (path === 'root.0.test') {
        return Promise.resolve(null);
      }
      if (path === 'root.0.submit') {
        return Promise.resolve({ path: 'root.0.submit', data: input, submit: true });
      }
      if (path === 'root.0.conditional') {
        return Promise.resolve({ path: 'root.0.conditional', data: input });
      }
      return Promise.resolve({ fields: ['field'], path: 'root.0' });
    });
    vi.spyOn(engine, 'validateFields').mockImplementation(() => { engine.steps[engine.steps.length - 1].status = 'success'; });
    engine.userInputsQueue = new Map([
      ['root.0.test', {
        data: 'test',
        configuration: { type: 'string' },
      }],
      ['root.0.submit', {
        data: null,
        configuration: { type: 'null', submit: true },
      }],
    ]);
    await engine.processUserInputs();
    expect(engine.cache).toBe(null);
    expect(isCacheEnabled).toBe(true);
    expect(engine.validateFields).toHaveBeenCalledTimes(2);
    expect(engine.validateFields).toHaveBeenCalledWith(['root.0.submit', 'root.0.conditional'], false);
    expect(engine.triggerHooks).toHaveBeenCalledTimes(9);
    expect(engine.triggerHooks).toHaveBeenCalledWith('submit', { conditional: 'test', test: null });
    expect(engine.createStep).toHaveBeenCalledWith(null);
    expect(engine.clearCache).toHaveBeenCalledOnce();
    expect(configuration.onSubmit).toHaveBeenCalledOnce();
    expect(configuration.onSubmit).toHaveBeenCalledWith({ conditional: 'test', test: null }, { var1: 'test1', var2: 'test2' });

    // Covers functionnal next step.
    await createEngine({
      ...configuration,
      submitPartialUpdates: false,
      steps: { ...configuration.steps, root: { fields: ['test', 'submit'], submit: true, nextStep: () => 'second' } },
      plugins: [(api: Engine): void => {
        api.on('userAction', async (data) => {
          await Promise.resolve();
          return (data?.path === 'root.0.test') ? null : data;
        });
      }],
    });
    vi.spyOn(engine, 'validateFields').mockImplementation(() => { engine.steps[engine.steps.length - 1].status = 'success'; });
    engine.userInputsQueue = new Map([
      ['root.0.submit', {
        data: null,
        configuration: { type: 'null', submit: true },
      }],
    ]);
    await engine.processUserInputs();
  });

  describe('[handleUserAction]', () => {
    test('field does not exist', async () => {
      engine.configuration.fields = { field: { type: 'string' } };
      vi.spyOn(engine, 'getField').mockImplementation(() => null);
      vi.spyOn(engine, 'getConfiguration').mockImplementation((path) => (
        (path === 'root.0') ? { fields: ['field'] } : { type: 'string' }
      ));
      await expect(async () => {
        await engine.handleUserAction({ path: 'root.0.field', data: 1, type: 'input' });
      }).rejects.toThrow(new Error('Field with path "root.0.field" does not exist.'));
    });

    test('non-null user input', async () => {
      engine.configuration.fields = { field: { type: 'string' } };
      vi.spyOn(engine, 'toggleField').mockImplementation(() => null);
      vi.spyOn(engine, 'processUserInputs').mockImplementation(() => Promise.resolve());
      vi.spyOn(engine, 'getConfiguration').mockImplementation((path) => (
        (path === 'root.0') ? { fields: ['field'] } : { type: 'string' }
      ));
      await engine.handleUserAction({ path: 'root.0.test', data: 'test', type: 'input' });
      expect(engine.toggleField).toHaveBeenCalledTimes(2);
      expect(engine.toggleField).toHaveBeenCalledWith('root.0.test', {
        error: null,
        path: 'root.0.test',
        required: true,
        status: 'initial',
        type: 'string',
        value: undefined,
      }, { type: 'string' }, 'test', null, { full: undefined, partial: undefined }, true);
      expect(engine.processUserInputs).toHaveBeenCalledOnce();
    });
  });

  describe('[constructor]', () => {
    test('cache is not enabled', () => {
      expect(engine.userInputs).toEqual({ full: {}, partial: {} });
      expect(engine.variables).toEqual({});
      expect(engine.steps).toEqual([{
        path: 'root.0',
        status: 'initial',
        fields: [{
          error: null,
          type: 'string',
          required: true,
          value: undefined,
          status: 'initial',
          path: 'root.0.test',
        }],
      }]);
    });

    test('cache is enabled and exists', async () => {
      const promise = new Promise<void>((resolve) => {
        createEngine({
          ...configuration,
          cache,
          plugins: [(api: Engine): void => {
            api.on('start', async () => {
              await Promise.resolve();
              resolve();
              return null;
            });
          }],
        }, false).catch(() => null);
      });
      await promise;
      expect(engine.userInputs).toEqual({ full: { test: 'value' }, partial: {} });
      expect(engine.variables).toEqual({ var1: 'test1', var2: 'test2' });
      expect(engine.steps).toEqual([{
        path: 'root.0',
        status: 'success',
        fields: [{
          error: null,
          value: null,
          type: 'string',
          required: true,
          status: 'success',
          path: 'root.0.field',
        }],
      }]);
    });
  });

  test('[createStep]', async () => {
    engine.configuration.fields = { field: { type: 'string' } };
    const step = { path: 'root.1', fields: ['field'], status: 'progress' };
    vi.spyOn(engine, 'toggleField').mockImplementation(() => null);
    vi.spyOn(engine, 'getConfiguration').mockImplementation((path) => (
      (path === 'root.0' || path === 'root.1') ? { fields: ['field'] } : { type: 'string' }
    ));
    vi.spyOn(engine, 'processUserInputs').mockImplementation(() => Promise.resolve());
    vi.spyOn(engine, 'triggerHooks').mockImplementation(() => Promise.resolve(step));
    await engine.createStep('root');
    expect(engine.triggerHooks).toHaveBeenCalledTimes(2);
    expect(engine.triggerHooks).toHaveBeenCalledWith('step', {
      path: 'root.1',
      status: 'initial',
      fields: [null],
    });
    expect(engine.triggerHooks).toHaveBeenCalledWith('afterStep', step);
    expect(engine.processUserInputs).toHaveBeenCalledOnce();
  });

  test('[toggleLoader]', () => {
    vi.spyOn(engine, 'enqueueMutation');
    engine.toggleLoader(true);
    expect(engine.enqueueMutation).toHaveBeenCalledOnce();
    expect(engine.enqueueMutation).toHaveBeenCalledWith('SET_LOADER', true);
  });

  test('[getStore]', () => {
    expect(engine.getStore()).toBe(engine.store);
  });

  test('[notifyUI]', () => {
    vi.spyOn(engine, 'enqueueMutation');
    engine.notifyUI();
    expect(engine.enqueueMutation).toHaveBeenCalledOnce();
  });

  test('[on]', async () => {
    const hook1 = vi.fn((_data, next: (_: unknown) => null) => next(null));
    engine.on('submit', hook1 as unknown as Hook<Data>);
    await engine.triggerHooks('submit', { test: 'value' });
    expect(hook1).toHaveBeenCalledOnce();
    expect(hook1).toHaveBeenCalledWith({ test: 'value' }, expect.any(Function));
  });

  test('[userAction]', () => {
    vi.clearAllMocks();
    const userAction = { path: 'path.to.field', data: 1, type: 'input' };
    engine.userAction(userAction);
    expect(engine.getStore().mutate).toHaveBeenCalledOnce();
    expect(engine.getStore().mutate).toHaveBeenCalledWith('userActions', 'ADD', userAction);
  });

  test('[getUserInputs]', () => {
    engine.userInputs.partial = {};
    engine.userInputs.full = { test: 'test' };
    expect(engine.getUserInputs(true)).toEqual({});
    expect(engine.getUserInputs(false)).toEqual({ test: 'test' });
  });

  describe('[getConfiguration]', () => {
    test('invalid path', async () => {
      const newConfiguration: Configuration = {
        ...configuration,
        fields: {
          array: { type: 'array', fields: { type: 'string' } },
          object: { type: 'object', fields: { key: { type: 'integer' } } },
        },
        steps: { root: { fields: ['array', 'object'] } },
      };
      await createEngine(newConfiguration);
      expect(() => {
        engine.getConfiguration('wrong.path.0');
      }).toThrow(new Error('Could not find configuration for path "wrong.path.0".'));
    });

    test('valid path', async () => {
      const newConfiguration: Configuration = {
        ...configuration,
        fields: {
          array: { type: 'array', fields: { type: 'string' } },
          object: { type: 'object', fields: { key: { type: 'integer' } } },
        },
        steps: { root: { fields: ['array', 'object'] } },
      };
      await createEngine(newConfiguration);
      expect(engine.getConfiguration()).toEqual(newConfiguration);
      expect(engine.getConfiguration('root.0.array.0')).toEqual({ type: 'string' });
      expect(engine.getConfiguration('root.0.object.key')).toEqual({ type: 'integer' });
    });
  });

  test('[getField]', () => {
    expect(engine.getField('invalid.path')).toBeNull();
    expect(engine.getField('root.0.test')).toBe(engine.steps[0].fields[0]);
  });

  test('[getSteps]', () => {
    expect(engine.getSteps()).toEqual([{
      path: 'root.0',
      status: 'initial',
      fields: [{
        error: null,
        type: 'string',
        required: true,
        value: undefined,
        status: 'initial',
        path: 'root.0.test',
      }],
    }]);
  });

  test('[getVariables]', () => {
    expect(engine.getVariables()).toBe(engine.variables);
  });

  test('[setVariables]', async () => {
    const promise = new Promise((resolve) => { setTimeout(resolve, 50); });
    vi.runAllTimers();
    await promise;
    vi.spyOn(engine, 'notifyUI').mockImplementation(() => null);
    vi.spyOn(engine, 'processUserInputs').mockImplementation(() => Promise.resolve());
    await engine.setVariables({ newTest: true });
    expect(engine.notifyUI).toHaveBeenCalledOnce();
    expect(engine.variables).toEqual({ newTest: true });
    expect(engine.processUserInputs).toHaveBeenCalledOnce();
  });

  test('[clearCache]', async () => {
    await createEngine({ ...configuration, cache, restartOnReload: true });
    await engine.clearCache();
    expect(cache.delete).toHaveBeenCalledOnce();
    expect(cache.delete).toHaveBeenCalledWith('form_cache');
  });

  test('[setInitialValues]', () => {
    engine.setInitialValues({ test: 'newTest' });
    expect(engine.initialValues).toEqual({ test: 'newTest' });
  });
});
