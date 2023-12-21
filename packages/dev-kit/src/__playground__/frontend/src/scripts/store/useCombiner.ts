/* eslint-disable */

import store from 'scripts/store';
import { readable, Readable } from 'svelte/store';

export default function useCombiner<T>(hash: string, reducer: Any): Readable<T> {
  return readable({} as Any, (set) => {
    const listener = store.subscribe(hash, (newState) => {
      set(reducer(newState));
    });
    return () => {
      store.unsubscribe(hash, listener);
    };
  });
}
