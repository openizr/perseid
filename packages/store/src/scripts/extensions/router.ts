/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { match } from 'path-to-regexp';

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
 * Generates the routing context from current URL, gathering many useful informations such as host,
 * parameters, protocol, query string, ...
 *
 * @param routes List of routes the router will serve.
 *
 * @returns Generated routing context.
 */
function generateContext(routes: string[]): RoutingContext {
  const { location } = window;
  const path = location.pathname;
  const queryString = decodeURI(location.search.substring(1));
  // See https://stackoverflow.com/questions/8648892/how-to-convert-url-parameters-to-a-javascript-object.
  const formattedqueryString = queryString
    .replace(/"/g, '\\"')
    .replace(/&/g, '","')
    .replace(/=/g, '":"');

  let routeInfo;
  let routeIndex;
  for (routeIndex = 0; routeIndex < routes.length; routeIndex += 1) {
    const routeMatch = match(routes[routeIndex], { decode: decodeURIComponent });
    routeInfo = routeMatch(window.location.pathname);
    if (routeInfo !== false) {
      break;
    }
  }

  let parsedQueryString = {};
  try {
    if (formattedqueryString !== '') {
      parsedQueryString = JSON.parse(`{"${formattedqueryString}"}`) as Record<string, string>;
    }
  } catch (error) {
    const { warn } = console;
    warn(`Invalid query string "?${queryString}".`);
  }

  return {
    host: location.host,
    path: `${path}${location.search}`,
    protocol: location.protocol.replace(':', ''),
    route: routes[routeIndex] || null,
    params: ((routeInfo === false) ? {} : routeInfo?.params ?? {}) as Record<string, string>,
    query: parsedQueryString,
  };
}

/**
 * Initializes a new module handling routing for the given configuration.
 *
 * @param routes List of routes the router will serve.
 *
 * @return Initialized routing module.
 */
export default function router(routes: string[]): Module<RoutingContext> {
  return {
    state: generateContext(routes),
    setup: ({ id, mutate }) => {
      window.addEventListener('popstate', () => { mutate(id, 'POP_STATE'); });
    },
    mutations: {
      // Triggered when user goes back and forth through browser's history.
      POP_STATE() {
        return generateContext(routes);
      },
      // Triggers a new navigation to the given page.
      NAVIGATE({ state }, page: string) {
        if (typeof window !== 'undefined' && state.path !== page) {
          window.history.pushState({}, '', page);
          return generateContext(routes);
        }
        return state;
      },
    },
  } as Module<RoutingContext>;
}
