/* c8 ignore start */

import Store from '@perseid/store';
import router from '@perseid/store/extensions/router';

const store = new Store();
const routes = {
  '/sass': () => import('__playground__/pages/Sass'),
  '/react': () => import('__playground__/pages/Home'),
  '/react/images': () => import('__playground__/pages/Images'),
  '/react/buttons': () => import('__playground__/pages/Buttons'),
  '/react/options': () => import('__playground__/pages/Options'),
  '/react/tooltips': () => import('__playground__/pages/Tooltips'),
  '/react/textareas': () => import('__playground__/pages/Textareas'),
  '/react/typography': () => import('__playground__/pages/Typography'),
  '/react/textfields': () => import('__playground__/pages/Textfields'),
  '/react/file-pickers': () => import('__playground__/pages/FilePickers'),
  '/svelte': () => import('__playground__/pages/Home.svelte'),
  '/svelte/images': () => import('__playground__/pages/Images.svelte'),
  '/svelte/buttons': () => import('__playground__/pages/Buttons.svelte'),
  '/svelte/options': () => import('__playground__/pages/Options.svelte'),
  '/svelte/tooltips': () => import('__playground__/pages/Tooltips.svelte'),
  '/svelte/textareas': () => import('__playground__/pages/Textareas.svelte'),
  '/svelte/typography': () => import('__playground__/pages/Typography.svelte'),
  '/svelte/textfields': () => import('__playground__/pages/Textfields.svelte'),
  '/svelte/file-pickers': () => import('__playground__/pages/FilePickers.svelte'),
  '/vue': () => import('__playground__/pages/HomePage.vue'),
  '/vue/images': () => import('__playground__/pages/ImagesPage.vue'),
  '/vue/buttons': () => import('__playground__/pages/ButtonsPage.vue'),
  '/vue/options': () => import('__playground__/pages/OptionsPage.vue'),
  '/vue/tooltips': () => import('__playground__/pages/TooltipsPage.vue'),
  '/vue/textareas': () => import('__playground__/pages/TextareasPage.vue'),
  '/vue/typography': () => import('__playground__/pages/TypographyPage.vue'),
  '/vue/textfields': () => import('__playground__/pages/TextfieldsPage.vue'),
  '/vue/file-pickers': () => import('__playground__/pages/FilePickersPage.vue'),
} as Record<string, () => Promise<unknown>>;

store.register('router', router(Object.keys(routes)));

export { Store, store, routes };
