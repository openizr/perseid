/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { toSnakeCase } from '@perseid/core';
import { type AuthState } from 'scripts/core/services/Store';
import { UILink, UIButton, buildClass } from '@perseid/ui/react';
import { type RoutingContext } from '@perseid/store/extensions/router';

/**
 * App menu.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/Menu.tsx
 */
function Menu({
  services,
}: ReactCommonProps): JSX.Element {
  const { store, i18n } = services;
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
    (event: MouseEvent): void => {
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
            label={i18n.t('MENU.UPDATE_USER')}
          />
        </li>,
      );
    }
    // Do not use the `condition && <Component .../>` expression here, as if condition is not met,
    // `menuItems` will be filled with `false`, which will break burger menu display condition.
    store.getResourceRoutes().forEach((resourceRoute) => {
      const isCurrentRoute = route === resourceRoute.route;
      const itemModifiers = buildClass('menu__panel__items__item', isCurrentRoute ? 'active' : '');
      if (user._permissions.has(`LIST_${toSnakeCase(resourceRoute.resource)}`)) {
        menuItems.push(
          <li className={itemModifiers} tabIndex={-1} role="menuitem" key={resourceRoute.resource}>
            <UILink
              href={resourceRoute.route}
              onClick={onClick(resourceRoute.route)}
              label={i18n.t(`MENU.${toSnakeCase(resourceRoute.resource)}`)}
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
          <span className="menu__panel__title">{i18n.t('MENU.ITEMS.TITLE')}</span>
          <ul className="menu__panel__items">
            {menuItems}
          </ul>
          {user !== null && (
            <UIButton
              icon="signOut"
              label={i18n.t('MENU.SIGN_OUT')}
              modifiers="outlined secondary"
              onClick={signOut as () => void}
            />
          )}
        </div>
      )}
    </nav>
  );
}

export default React.memo(Menu);
