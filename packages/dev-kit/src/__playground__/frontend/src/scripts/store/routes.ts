export default {
  '/': () => import('scripts/pages/Home'),
  '/vue': () => import('scripts/pages/HomePage.vue'),
  '/svelte': () => import('scripts/pages/Home.svelte'),
  '/js': () => import('scripts/pages/HomeJS'),
} as Record<string, () => Promise<unknown>>;
