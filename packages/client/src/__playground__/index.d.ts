import {
  type Id,
  type Ids,
  type Authors,
  type Version,
  type Deletion,
  type Timestamps,
  type DefaultDataModel,
} from '@perseid/core';

declare global {
  interface DataModel extends DefaultDataModel {
    test: Ids & Deletion & Version & Authors & Timestamps & {
      indexedString: string;
      objectOne: {
        boolean: boolean;
        optionalRelations: (Id | DataModel['otherTest'] | null)[] | null;
        objectTwo: {
          optionalIndexedString: string | null;
          optionalNestedArray: ({
            data: {
              optionalInteger: number | null;
              flatArray: (string | null)[];
              nestedArray: {
                optionalRelation: Id | DataModel['otherTest'] | null;
                key: string;
              }[];
            };
          } | null)[] | null;
        };
      };
    };
    otherTest: Ids & {
      _createdAt: Date;
      binary: ArrayBuffer;
      enum: 'ONE' | 'TWO' | 'THREE';
      optionalRelation: Id | DataModel['test'] | null;
      data: {
        optionalRelation: Id | DataModel['test'] | null;
        optionalFlatArray: string[] | null;
      };
    };
  }
}
