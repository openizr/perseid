/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import AbstractDatabaseClient, {
  type FormattedQuery,
  type StructuredPayload,
} from 'scripts/services/AbstractDatabaseClient';
import Model from 'scripts/services/Model';
import Logger from 'scripts/services/Logger';
import DatabaseError from 'scripts/errors/Database';
import CacheClient from 'scripts/services/CacheClient';
import { type DataModel } from 'scripts/services/__mocks__/schema';
import { Id, type ResourceSchema, type Results } from '@perseid/core';

class TestDatabaseClient extends AbstractDatabaseClient<DataModel> {
  protected isMocked = true;

  protected mock = (): Promise<boolean> => Promise.resolve(this.isMocked);

  protected generateResourceMetadata(): unknown {
    return this.mock;
  }

  protected async generateQuery(): Promise<unknown> {
    await this.mock();
    return true;
  }

  protected parseFields(): { projections: unknown; formattedQuery: FormattedQuery; } {
    this.mock();
    return { projections: {}, formattedQuery: {} as unknown as FormattedQuery };
  }

  protected structurePayload(): StructuredPayload {
    this.mock();
    return {};
  }

  protected formatResources<Resource extends keyof DataModel>(): DataModel[Resource][] {
    this.mock();
    return [];
  }

  public async dropDatabase(): Promise<void> {
    await this.mock();
  }

  public async createDatabase(): Promise<void> {
    await this.mock();
  }

  public async createMissingStructures(): Promise<void> {
    await this.mock();
  }

  protected async handleError<T>(callback: () => Promise<T>): Promise<T> {
    await this.mock();
    return callback();
  }

  public async reset(): Promise<void> {
    await this.mock();
  }

  public async checkForeignIds(): Promise<void> {
    await this.mock();
  }

  public async create(): Promise<void> {
    await this.mock();
  }

  public async update(): Promise<boolean> {
    await this.mock();
    return true;
  }

  public async view<Resource extends keyof DataModel>(): Promise<DataModel[Resource] | null> {
    await this.mock();
    return null;
  }

  public async delete(): Promise<boolean> {
    await this.mock();
    return true;
  }

  public async search<Resource extends keyof DataModel>(): Promise<Results<DataModel[Resource]>> {
    await this.mock();
    return { total: 0, results: [] };
  }

  public async list<Resource extends keyof DataModel>(): Promise<Results<DataModel[Resource]>> {
    await this.mock();
    return { total: 0, results: [] };
  }

  public getValidators(): AbstractDatabaseClient['VALIDATORS'] {
    return this.VALIDATORS;
  }
}

describe('services/AbstractDatabaseClient', () => {
  vi.mock('@perseid/core');
  vi.mock('scripts/services/Model');
  vi.mock('scripts/services/Logger');
  vi.mock('scripts/services/CacheClient');

  let databaseClient: TestDatabaseClient;
  const logger = new Logger({ logLevel: 'info', prettyPrint: false });
  const cacheClient = new CacheClient({ cachePath: '/.cache', connectTimeout: 0 });
  const model = new Model<DataModel>({} as Record<keyof DataModel, ResourceSchema<DataModel>>);

  beforeEach(() => {
    vi.clearAllMocks();
    databaseClient = new TestDatabaseClient(model, logger, cacheClient, {
      protocol: 'mongo+srv',
      host: 'localhost',
      port: 27018,
      user: 'test',
      password: 'test',
      database: 'test',
      connectTimeout: 0,
      connectionLimit: 0,
    });
  });

  describe('[VALIDATORS]', () => {
    test('null', () => {
      expect(() => {
        databaseClient.getValidators().null('test', 1, { type: 'null' });
      }).toThrow(new DatabaseError('INVALID_FIELD_TYPE', { path: 'test' }));
    });

    test('boolean', () => {
      expect(() => {
        databaseClient.getValidators().boolean('test', null, { type: 'boolean', isRequired: true });
      }).toThrow(new DatabaseError('INVALID_FIELD_TYPE', { path: 'test' }));
    });

    test('id', () => {
      expect(() => {
        databaseClient.getValidators().id('test', null, { type: 'id', isRequired: true });
      }).toThrow(new DatabaseError('INVALID_FIELD_TYPE', { path: 'test' }));
      expect(() => {
        databaseClient.getValidators().id('test', new Id('000000000000000000000001'), {
          type: 'id',
          isRequired: true,
          enum: [new Id('000000000000000000000002')],
        });
      }).toThrow(new DatabaseError('INVALID_FIELD_VALUE', { path: 'test' }));
    });

    test('date', () => {
      expect(() => {
        databaseClient.getValidators().date('test', null, { type: 'date', isRequired: true });
      }).toThrow(new DatabaseError('INVALID_FIELD_TYPE', { path: 'test' }));
      expect(() => {
        databaseClient.getValidators().date('test', new Date('2023-01-01'), {
          type: 'date',
          isRequired: true,
          enum: [new Date('2023-01-02')],
        });
      }).toThrow(new DatabaseError('INVALID_FIELD_VALUE', { path: 'test' }));
    });

    test('binary', () => {
      expect(() => {
        databaseClient.getValidators().binary('test', null, { type: 'binary', isRequired: true });
      }).toThrow(new DatabaseError('INVALID_FIELD_TYPE', { path: 'test' }));
    });

    test('float', () => {
      expect(() => {
        databaseClient.getValidators().float('test', null, { type: 'float', isRequired: true });
      }).toThrow(new DatabaseError('INVALID_FIELD_TYPE', { path: 'test' }));
      expect(() => {
        databaseClient.getValidators().float('test', 3.0, {
          type: 'float',
          isRequired: true,
          enum: [2.0],
        });
      }).toThrow(new DatabaseError('INVALID_FIELD_VALUE', { path: 'test' }));
      expect(() => {
        databaseClient.getValidators().float('test', 3.0, {
          type: 'float',
          maximum: 1.0,
          isRequired: true,
        });
      }).toThrow(new DatabaseError('FIELD_VALUE_ABOVE_MAXIMUM', { path: 'test' }));
      expect(() => {
        databaseClient.getValidators().float('test', 3.0, {
          type: 'float',
          isRequired: true,
          exclusiveMaximum: 3.0,
        });
      }).toThrow(new DatabaseError('FIELD_VALUE_ABOVE_STRICT_MAXIMUM', { path: 'test' }));
      expect(() => {
        databaseClient.getValidators().float('test', 3.0, {
          type: 'float',
          minimum: 4.0,
          isRequired: true,
        });
      }).toThrow(new DatabaseError('FIELD_VALUE_BELOW_MINIMUM', { path: 'test' }));
      expect(() => {
        databaseClient.getValidators().float('test', 3.0, {
          type: 'float',
          isRequired: true,
          exclusiveMinimum: 3.0,
        });
      }).toThrow(new DatabaseError('FIELD_VALUE_BELOW_STRICT_MINIMUM', { path: 'test' }));
      expect(() => {
        databaseClient.getValidators().float('test', 2.0, {
          type: 'float',
          multipleOf: 0.3,
          isRequired: true,
        });
      }).toThrow(new DatabaseError('INVALID_FIELD_VALUE', { path: 'test' }));
    });

    test('integer', () => {
      expect(() => {
        databaseClient.getValidators().integer('test', null, { type: 'integer', isRequired: true });
      }).toThrow(new DatabaseError('INVALID_FIELD_TYPE', { path: 'test' }));
      expect(() => {
        databaseClient.getValidators().integer('test', 3, {
          type: 'integer',
          isRequired: true,
          enum: [2],
        });
      }).toThrow(new DatabaseError('INVALID_FIELD_VALUE', { path: 'test' }));
      expect(() => {
        databaseClient.getValidators().integer('test', 3, {
          type: 'integer',
          maximum: 1,
          isRequired: true,
        });
      }).toThrow(new DatabaseError('FIELD_VALUE_ABOVE_MAXIMUM', { path: 'test' }));
      expect(() => {
        databaseClient.getValidators().integer('test', 3, {
          type: 'integer',
          isRequired: true,
          exclusiveMaximum: 3,
        });
      }).toThrow(new DatabaseError('FIELD_VALUE_ABOVE_STRICT_MAXIMUM', { path: 'test' }));
      expect(() => {
        databaseClient.getValidators().integer('test', 3, {
          type: 'integer',
          minimum: 4,
          isRequired: true,
        });
      }).toThrow(new DatabaseError('FIELD_VALUE_BELOW_MINIMUM', { path: 'test' }));
      expect(() => {
        databaseClient.getValidators().integer('test', 3, {
          type: 'integer',
          isRequired: true,
          exclusiveMinimum: 3,
        });
      }).toThrow(new DatabaseError('FIELD_VALUE_BELOW_STRICT_MINIMUM', { path: 'test' }));
      expect(() => {
        databaseClient.getValidators().integer('test', 2, {
          type: 'integer',
          multipleOf: 10,
          isRequired: true,
        });
      }).toThrow(new DatabaseError('INVALID_FIELD_VALUE', { path: 'test' }));
    });

    test('string', () => {
      expect(() => {
        databaseClient.getValidators().string('test', null, { type: 'string', isRequired: true });
      }).toThrow(new DatabaseError('INVALID_FIELD_TYPE', { path: 'test' }));
      expect(() => {
        databaseClient.getValidators().string('test', 'test', {
          type: 'string',
          isRequired: true,
          enum: ['test2'],
        });
      }).toThrow(new DatabaseError('INVALID_FIELD_VALUE', { path: 'test' }));
      expect(() => {
        databaseClient.getValidators().string('test', 'test', {
          type: 'string',
          maxLength: 1,
          isRequired: true,
        });
      }).toThrow(new DatabaseError('FIELD_VALUE_TOO_LONG', { path: 'test' }));
      expect(() => {
        databaseClient.getValidators().string('test', 'test', {
          type: 'string',
          isRequired: true,
          minLength: 10,
        });
      }).toThrow(new DatabaseError('FIELD_VALUE_TOO_SHORT', { path: 'test' }));
      expect(() => {
        databaseClient.getValidators().string('test', '', {
          type: 'string',
          isRequired: true,
        });
      }).toThrow(new DatabaseError('FIELD_VALUE_TOO_SHORT', { path: 'test' }));
      expect(() => {
        databaseClient.getValidators().string('test', 'test', {
          type: 'string',
          isRequired: true,
          pattern: /other/i,
        });
      }).toThrow(new DatabaseError('FIELD_VALUE_PATTERN_MISMATCH', { path: 'test' }));
    });

    test('array', () => {
      expect(() => {
        databaseClient.getValidators().array('test', null, {
          type: 'array',
          isRequired: true,
          fields: { type: 'string' },
        });
      }).toThrow(new DatabaseError('INVALID_FIELD_TYPE', { path: 'test' }));
      expect(() => {
        databaseClient.getValidators().array('test', ['test', 'test'], {
          type: 'array',
          maxItems: 1,
          isRequired: true,
          fields: { type: 'string' },
        });
      }).toThrow(new DatabaseError('FIELD_VALUE_ABOVE_MAXIMUM_ITEMS', { path: 'test' }));
      expect(() => {
        databaseClient.getValidators().array('test', [], {
          type: 'array',
          minItems: 1,
          isRequired: true,
          fields: { type: 'string' },
        });
      }).toThrow(new DatabaseError('FIELD_VALUE_BELOW_MINIMUM_ITEMS', { path: 'test' }));
      expect(() => {
        databaseClient.getValidators().array('test', ['test', 'test'], {
          type: 'array',
          isRequired: true,
          uniqueItems: true,
          fields: { type: 'string' },
        });
      }).toThrow(new DatabaseError('FIELD_VALUE_HAS_DUPLICATE_ITEMS', { path: 'test' }));
    });

    test('object', () => {
      expect(() => {
        databaseClient.getValidators().object('test', null, {
          type: 'object',
          isRequired: true,
          fields: {},
        });
      }).toThrow(new DatabaseError('INVALID_FIELD_TYPE', { path: 'test' }));
    });
  });
});
