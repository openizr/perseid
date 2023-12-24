/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { UILink, UIButton, buildClass } from 'biuty/react';
import { type AuthState } from 'scripts/core/services/Store';
import { type DefaultDataModel, toSnakeCase } from '@perseid/core';
import { type RoutingContext } from '@perseid/store/extensions/router';

/**
 * App menu.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/Menu.tsx
 */
function Menu<DataModel extends DefaultDataModel = DefaultDataModel>({
  services,
}: ReactCommonProps<DataModel>): JSX.Element {
  const { store, i18n: { t } } = services;
  const [isDisplayed, setIsDisplayed] = React.useState(false);
  const { user } = services.store.useSubscription<AuthState>('auth');
  const className = buildClass('menu', isDisplayed ? 'visible' : '');
  const route = store.useSubscription('router', (newState: RoutingContext) => newState.route);

  const signOut = React.useCallback(async () => {
    await services.store.dispatch('auth', 'signOut');
  }, [services.store]);

  const toggleMenu = React.useCallback(() => {
    setIsDisplayed(!isDisplayed);
  }, [isDisplayed]);

  const onClick = React.useCallback((url: string) => (
    (event: MouseEvent) => {
      if (url === route) {
        event.preventDefault();
      } else {
        setIsDisplayed(false);
        store.navigate(url)(event);
      }
    }
  ), [store, route]);

  const updateUserRoute = store.getRoute('auth.updateUser');
  const menuItems: JSX.Element[] = [];
  if (user !== null) {
    if (updateUserRoute !== null) {
      menuItems.push(
        <li
          tabIndex={-1}
          key="updateUser"
          role="menuitem"
          className={buildClass('menu__panel__items__item', updateUserRoute === route ? 'active' : '')}
        >
          <UILink
            href={updateUserRoute}
            onClick={onClick(updateUserRoute)}
            label={t('MENU.UPDATE_USER')}
          />
        </li>,
      );
    }
    // Do not use the `condition && <Component .../>` expression here, as if condition is not met,
    // `menuItems` will be filled with `false`, which will break burger menu display condition.
    store.getCollectionRoutes().forEach((collectionRoute) => {
      const isCurrentRoute = route === collectionRoute.route;
      const itemModifiers = buildClass('menu__panel__items__item', isCurrentRoute ? 'active' : '');
      if (user._permissions.has(`${toSnakeCase(collectionRoute.collection)}_LIST`)) {
        menuItems.push(
          <li className={itemModifiers} tabIndex={-1} role="menuitem" key={collectionRoute.collection}>
            <UILink
              href={collectionRoute.route}
              onClick={onClick(collectionRoute.route)}
              label={t(`MENU.${toSnakeCase(collectionRoute.collection)}`)}
            />
          </li>,
        );
      }
    });
  }

  return (
    // role="menu" TODO
    <nav className={className}>

      {/* Burger menu. */}
      {(menuItems.length > 0 || user !== null) && (
        <div className="menu__top-bar">
          <UIButton
            icon="more"
            onClick={toggleMenu}
          />
        </div>
      )}

      {/* Menu panel. */}
      {(menuItems.length > 0 || user !== null) && (
        <div className="menu__panel">
          <UIButton
            icon="close"
            onClick={toggleMenu}
          />
          <span className="menu__panel__title">{t('MENU.ITEMS.TITLE')}</span>
          <ul className="menu__panel__items">
            {menuItems}
          </ul>
          {user !== null && (
            <UIButton
              icon="signOut"
              label={t('MENU.SIGN_OUT')}
              modifiers="text accent-3-color"
              onClick={signOut as () => void}
            />
          )}
        </div>
      )}
    </nav>
  );
}

export default React.memo(Menu) as ReactMenuComponent;
