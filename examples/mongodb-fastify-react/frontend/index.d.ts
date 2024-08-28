import type { Authors, DefaultDataModel, Deletion, Id, Ids, Timestamps } from "@perseid/core";

declare global {
  export interface DataModel extends DefaultDataModel {
    galaxies: Ids & Authors & Deletion & Timestamps & {
      name: string;
    };
    celestialBodies: Ids & {
      type: 'ASTEROID' | 'PLANET' | 'BLACK_HOLE' | 'STAR';
      name: string;
      discoveredIn: number;
      galaxy: Id | DataModel['galaxies'];
      isLifePossible: boolean;
      coordinates: {
        x: number;
        y: number;
      };
      composition: {
        element: string;
        percentage: number;
      }[] | null;
    };
  }
}