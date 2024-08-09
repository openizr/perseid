/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `core/services/AbstractDatabaseClient` mock.
 */

export default class {
  protected cache: unknown;

  protected model: unknown;

  protected logger: unknown;

  protected database: unknown;

  protected isConnected: unknown;

  protected resourcesMetadata: unknown;

  protected readonly SPLITTING_TOKENS = /[ \-,.?=*\\/()'"`|+!:;[\]{}]/;

  protected readonly DEFAULT_OFFSET = 0;

  protected readonly DEFAULT_LIMIT = 20;

  protected readonly DEFAULT_MAXIMUM_DEPTH = 3;

  protected readonly DEFAULT_SEARCH_COMMAND_OPTIONS: SearchCommandOptions = {};

  protected readonly DEFAULT_LIST_COMMAND_OPTIONS: ListCommandOptions = {};

  protected readonly DEFAULT_VIEW_COMMAND_OPTIONS: ViewCommandOptions = {};

  protected VALIDATORS = {
    object: vi.fn(),
    array: vi.fn(),
    string: vi.fn(),
    float: vi.fn(),
    integer: vi.fn(),
    boolean: vi.fn(),
    id: vi.fn(),
    null: vi.fn(),
    date: vi.fn(),
    binary: vi.fn(),
  };

  public constructor(
    model: unknown,
    logger: unknown,
    cache: unknown,
  ) {
    this.cache = cache;
    this.model = model;
    this.logger = logger;
    this.database = 'test';
    this.isConnected = false;
    this.resourcesMetadata = {
      test: {
        constraints: [],
        subStructures: [],
        structure: 'test',
        subStructuresPerPath: {},
        indexes: [
          { path: '_isDeleted', unique: false },
          { path: 'indexedString', unique: false },
          { path: 'objectOne.optionalRelations', unique: false },
          { path: 'objectOne.objectTwo.optionalIndexedString', unique: true },
          { path: 'objectOne.objectTwo.optionalNestedArray.data.flatArray', unique: false },
          { path: 'objectOne.objectTwo.optionalNestedArray.data.optionalInteger', unique: false },
        ],
        invertedRelations: new Map([['otherTest', ['optionalRelation', 'data.optionalRelation']]]),
        fields: {},
      },
      otherTest: {
        indexes: [
          { path: 'optionalRelation', unique: false },
          { path: 'data.optionalRelation', unique: false },
          { path: 'data.optionalFlatArray', unique: true },
        ],
        constraints: [],
        subStructures: [],
        structure: 'otherTest',
        subStructuresPerPath: {},
        invertedRelations: new Map(),
        fields: {},
      },
    };
  }
}
