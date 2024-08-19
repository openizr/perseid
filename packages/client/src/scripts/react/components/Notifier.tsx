/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { type DefaultDataModel } from '@perseid/core';
import { UIP, UIButton, buildClass } from '@perseid/ui/react';
import { type NotifierState } from 'scripts/core/services/Store';

/**
 * Single notification.
 */
function Notification<DataModel extends DefaultDataModel = DefaultDataModel>(
  props: ReactCommonProps<DataModel> & { notification: NotifierState[0]; },
): JSX.Element {
  const { notification, services: { store, i18n } } = props;
  const [isClosed, setIsClosed] = React.useState(false);
  const className = buildClass('notification', `${String(notification.modifiers)}${isClosed ? ' closed' : ''}`);

  const close = React.useCallback(() => {
    setIsClosed(true);
    setTimeout(() => {
      store.mutate('notifier', 'REMOVE', notification.id);
    }, notification.timer.duration);
  }, [notification, store]);

  const pauseTimer = React.useCallback(() => {
    store.mutate('notifier', 'PAUSE', notification.id);
  }, [notification, store]);

  const resumeTimer = React.useCallback(() => {
    store.mutate('notifier', 'RESUME', notification.id);
  }, [notification, store]);

  return (
    <div
      className={className}
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
    >
      <UIP label={i18n.t(notification.message)} />
      {notification.closable
        ? <UIButton icon="close" onClick={close} />
        : null}
    </div>
  );
}

const MemoizedNotification = React.memo(Notification);

/**
 * Displays UI notifications.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/Notifier.tsx
 */
function Notifier<DataModel extends DefaultDataModel = DefaultDataModel>({
  services,
  components,
}: ReactCommonProps<DataModel>): JSX.Element | null {
  const notifications = services.store.useSubscription<NotifierState>('notifier');

  return (notifications.length === 0)
    ? null
    : (
      <div className="notifier">
        {(notifications.map((notification) => (
          <MemoizedNotification
            key={notification.id}
            notification={notification}
            components={components as unknown as ReactCustomComponents<DefaultDataModel>}
            services={services as unknown as ReactCommonProps<DefaultDataModel>['services']}
          />
        )))}
      </div>
    );
}

export default React.memo(Notifier) as ReactNotifierComponent;
