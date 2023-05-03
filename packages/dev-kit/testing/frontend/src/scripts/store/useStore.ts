import store from 'scripts/store/index';
import {
  ref,
  onMounted,
  onUnmounted,
} from 'vue';

interface Store {
  modules: Record<string, { state: Any; }>;
  combiners: Record<string, { modulesHashes: string[]; reducer: (...args: string[]) => unknown; }>;
}

const privateStore = (store as unknown);
const getState = (moduleHash: string): Any => (privateStore as Store).modules[moduleHash].state;

export default (hash: string, reducer = (newState: Any): Any => newState): unknown => {
  const combiner = (privateStore as Store).combiners[hash] as Store['combiners'][0] | undefined;

  if (combiner !== undefined) {
    let subscriptionId: string;
    const state = ref<unknown>(reducer(combiner.reducer(
      ...(combiner.modulesHashes.map(getState) as string[]),
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
