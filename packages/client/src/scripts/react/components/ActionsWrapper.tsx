/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { UIButton, buildClass } from '@perseid/ui/react';
import { type AuthState } from 'scripts/core/services/Store';
import { toSnakeCase, Id, type DefaultDataModel } from '@perseid/core';
import { type RoutingContext } from '@perseid/store/extensions/router';

/**
 * Actions wrapper props.
 */
export interface ActionsWrapperProps<
  DataModel extends DefaultDataModel
> extends ReactCommonProps<DataModel> {
  /** Name of the resource collection. */
  collection: keyof DataModel;

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
 * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/ActionsWrapper.tsx
 */
function ActionsWrapper<DataModel extends DefaultDataModel = DefaultDataModel>({
  services,
  collection,
  moreButtonProps = defaultComponentProps,
  deleteButtonProps = defaultComponentProps,
  updateButtonProps = defaultComponentProps,
}: ActionsWrapperProps<DataModel>): JSX.Element {
  const actionsRef = React.useRef<HTMLDivElement>(null);
  const snakeCasedCollection = toSnakeCase(String(collection));
  const router = services.store.useSubscription<RoutingContext>('router');
  const [displayActions, setDisplayActions] = React.useState(false);
  const collectionUpdateRoute = services.store.getRoute(`${String(collection)}.update`);
  const permissions = services.store.useSubscription('auth', (newState: AuthState) => newState.user?._permissions);
  const canUserDeleteResource = permissions?.has(`${snakeCasedCollection}_DELETE`) === true;
  const canUserUpdateResource = permissions?.has(`${snakeCasedCollection}_UPDATE`) && collectionUpdateRoute !== null;

  const handleBlur = React.useCallback((event: MouseEvent): void => {
    if (actionsRef.current !== null && !actionsRef.current.contains(event.target as HTMLElement)) {
      setDisplayActions(false);
    }
  }, []);

  const toggleActions = React.useCallback((): void => {
    setDisplayActions((previousState) => !previousState);
  }, []);

  const deleteResource = React.useCallback(async () => {
    const collectionListRoute = services.store.getRoute(`${String(collection)}.list`);
    await services.store.delete(collection, new Id(router.params.id));
    services.store.notify('NOTIFICATIONS.DELETED_RESOURCE');
    services.store.navigate(collectionListRoute ?? services.store.getFallbackPageRoute())();
  }, [collection, services, router.params.id]);

  const confirmDeletion = React.useCallback(() => {
    services.store.confirm({
      onConfirm: deleteResource as () => void,
      title: `CONFIRM.DELETE.${snakeCasedCollection}.TITLE`,
      subTitle: `CONFIRM.DELETE.${snakeCasedCollection}.SUBTITLE`,
      confirm: `CONFIRM.DELETE.${snakeCasedCollection}.CONFIRM`,
      cancel: `CONFIRM.DELETE.${snakeCasedCollection}.CANCEL`,
    });
  }, [deleteResource, services, snakeCasedCollection]);

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
            onClick={services.store.navigate(collectionUpdateRoute.replace(':id', router.params.id))}
            {...updateButtonProps}
          />
        )}
      </div>
    </div>
  );
}

export default React.memo(ActionsWrapper) as ReactActionsWrapperComponent;
