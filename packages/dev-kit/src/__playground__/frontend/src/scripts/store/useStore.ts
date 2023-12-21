import store from 'scripts/store/index';
import {
  ref,
  onMounted,
  onUnmounted,
} from 'vue';

interface Store {
  modules: Record<string, { state: Any; }>;
  combinedModules: Record<string, {
    moduleIds: string[];
    reducer: (...args: string[]) => unknown;
  }>;
}

const privateStore = (store as unknown as Store);
const getState = (moduleHash: string): Any => privateStore.modules[moduleHash].state;

export default (hash: string, reducer = (newState: Any): Any => newState): unknown => {
  const combiner = privateStore.combinedModules[hash] as Store['combinedModules'][0] | undefined;

  if (combiner !== undefined) {
    let subscriptionId: string;
    const state = ref<unknown>(reducer(combiner.reducer(
      ...(combiner.moduleIds.map(getState) as string[]),
    )));
    // Subscribing to the given combiner at component creation...
    onMounted(() => {
      subscriptionId = store.subscribe<Any>(hash, (newState) => {
        state.value = reducer(newState);
      });
    });
    onUnmounted(() => {
      store.unsubscribe(hash, subscriptionId);
    });
    return state;
  }
  throw new Error(`Could not use combiner "${hash}": combiner does not exist.`);
};
