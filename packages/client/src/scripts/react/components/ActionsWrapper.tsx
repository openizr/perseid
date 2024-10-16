/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  Id,
  toSnakeCase,
  I18n as BaseI18n,
  type DefaultDataModel,
} from '@perseid/core';
import * as React from 'react';
import { UIButton, buildClass } from '@perseid/ui/react';
import type BaseStore from 'scripts/core/services/Store';
import type BaseModel from 'scripts/core/services/Model';
import { type AuthState } from 'scripts/core/services/Store';
import type BaseApiClient from 'scripts/core/services/ApiClient';
import { type RoutingContext } from '@perseid/store/extensions/router';

/**
 * Actions wrapper props.
 */
export interface ActionsWrapperProps<
  DataModel extends DefaultDataModel = DefaultDataModel,
  I18n extends BaseI18n = BaseI18n,
  Store extends BaseStore<DataModel> = BaseStore<DataModel>,
  Model extends BaseModel<DataModel> = BaseModel<DataModel>,
  ApiClient extends BaseApiClient<DataModel> = BaseApiClient<DataModel>,
> extends ReactCommonProps<DataModel, I18n, Store, Model, ApiClient> {
  /** Name of the resource resource. */
  resource: keyof DataModel & string;

  /** "More" button props. */
  moreButtonProps?: ComponentProps;

  /** "Delete" button props. */
  deleteButtonProps?: ComponentProps;

  /** "Edit" button props. */
  updateButtonProps?: ComponentProps;
}

const defaultComponentProps = {};

/**
 * Actions wrapper.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/ActionsWrapper.tsx
 */
function ActionsWrapper({
  services,
  resource,
  moreButtonProps = defaultComponentProps,
  deleteButtonProps = defaultComponentProps,
  updateButtonProps = defaultComponentProps,
}: ActionsWrapperProps): JSX.Element {
  const actionsRef = React.useRef<HTMLDivElement>(null);
  const snakeCasedResource = toSnakeCase(String(resource));
  const router = services.store.useSubscription<RoutingContext>('router');
  const [displayActions, setDisplayActions] = React.useState(false);
  const resourceUpdateRoute = services.store.getRoute(`${String(resource)}.update`);
  const permissions = services.store.useSubscription('auth', (newState: AuthState) => newState.user?._permissions);
  const canUserDeleteResource = permissions?.has(`DELETE_${snakeCasedResource}`) === true;
  const canUserUpdateResource = permissions?.has(`UPDATE_${snakeCasedResource}`) && resourceUpdateRoute !== null;

  const handleBlur = React.useCallback((event: MouseEvent): void => {
    if (actionsRef.current !== null && !actionsRef.current.contains(event.target as HTMLElement)) {
      setDisplayActions(false);
    }
  }, []);

  const toggleActions = React.useCallback((): void => {
    setDisplayActions((previousState) => !previousState);
  }, []);

  const deleteResource = React.useCallback(async () => {
    const resourceListRoute = services.store.getRoute(`${String(resource)}.list`);
    await services.store.delete(resource, new Id(router.params.id));
    services.store.notify('NOTIFICATIONS.DELETED_RESOURCE');
    services.store.navigate(resourceListRoute ?? services.store.getFallbackPageRoute())();
  }, [resource, services, router.params.id]);

  const confirmDeletion = React.useCallback(() => {
    services.store.confirm({
      onConfirm: deleteResource as () => void,
      title: `CONFIRM.DELETE.${snakeCasedResource}.TITLE`,
      subTitle: `CONFIRM.DELETE.${snakeCasedResource}.SUBTITLE`,
      confirm: `CONFIRM.DELETE.${snakeCasedResource}.CONFIRM`,
      cancel: `CONFIRM.DELETE.${snakeCasedResource}.CANCEL`,
    });
  }, [deleteResource, services, snakeCasedResource]);

  React.useEffect(() => {
    if (displayActions) {
      window.addEventListener('click', handleBlur);
    } else {
      window.removeEventListener('click', handleBlur);
    }
  }, [displayActions, handleBlur]);

  return (
    <div ref={actionsRef} className="actions-wrapper">
      {(canUserDeleteResource || canUserUpdateResource) && (
        <UIButton
          icon="more"
          modifiers="floating primary"
          onClick={toggleActions}
          {...moreButtonProps}
        />
      )}
      <div className={buildClass('actions-wrapper__actions', displayActions ? 'visible' : '')}>
        {canUserDeleteResource && (
          <UIButton
            icon="delete"
            onClick={confirmDeletion}
            {...deleteButtonProps}
          />
        )}
        {canUserUpdateResource && (
          <UIButton
            icon="edit"
            onClick={services.store.navigate(resourceUpdateRoute.replace(':id', router.params.id))}
            {...updateButtonProps}
          />
        )}
      </div>
    </div>
  );
}

export default React.memo(ActionsWrapper);
