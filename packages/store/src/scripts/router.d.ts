/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

declare module '@perseid/store/extensions/router' {
  import { type Module } from '@perseid/store';

  /** Route data. */
  export interface RoutingContext {
    /** Current URL full path (excluding host, port and protocol). */
    path: string;

    /** Current URL host. */
    host: string;

    /** Registered route that matched with current URL. */
    route: string | null;

    /** Current URL protocol. */
    protocol: string;

    /** Parsed query string for current URL. */
    query: Record<string, string>;

    /** Parsed route params for current URL. */
    params: Record<string, string>;
  }

  /**
   * Initializes a new module handling routing for the given configuration.
   *
   * @param routes List of routes the router will serve.
   *
   * @return Initialized routing module.
   */
  export default function router(routes: string[]): Module<RoutingContext>;
}
