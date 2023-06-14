/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { type Document } from 'mongodb';
import schema from 'scripts/services/__mocks__/schema';

/** `services/Model` mock. */

export default class Model {
  protected defaultCollection = { fields: {} };

  public static email = vi.fn(() => ({ type: 'string' }));

  public static password = vi.fn(() => ({ type: 'string' }));

  public static tinyText = vi.fn(() => ({ type: 'string' }));

  public static shortText = vi.fn(() => ({ type: 'string' }));

  public static mediumText = vi.fn(() => ({ type: 'string' }));

  public static longText = vi.fn(() => ({ type: 'string' }));

  public static hugeText = vi.fn(() => ({ type: 'string' }));

  public static token = vi.fn(() => ({ type: 'string' }));

  public static credentials = vi.fn(() => ({ type: 'string' }));

  public getCollections = vi.fn(() => ['users', 'roles', 'test', 'externalRelation', 'otherExternalRelation']);

  public getPublicSchema = vi.fn(() => ({}));

  public getCollection(collection: string): CollectionDataModel<Document> {
    return ((schema as Document)[collection]) ?? this.defaultCollection;
  }
}
