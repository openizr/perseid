/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import React from 'react';
import { buildClass } from '@perseid/ui/react';
import { type ModalState } from 'scripts/core/services/Store';

/**
 * App modal.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/packages/client/src/scripts/react/components/Modal.tsx
 */
function Modal({
  services,
  components,
}: ReactCommonProps): JSX.Element {
  const modal = services.store.useSubscription<ModalState>('modal');

  const closeModal = React.useCallback(() => {
    services.store.mutate('modal', 'HIDE');
  }, [services]);

  const currentContent = React.useMemo(() => {
    const Component = components[modal.component];
    return (Component === undefined) ? null : (
      <Component
        services={services}
        components={components}
        {...modal.componentProps}
      />
    );
  }, [modal, components, services]);

  // Handles special keys like Escape to control modal.
  React.useEffect(() => {
    const handleKeyUp = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && currentContent !== null) {
        closeModal();
      }
    };
    window.addEventListener('keyup', handleKeyUp);
    return (): void => {
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [closeModal, currentContent]);

  return (
    <div className={buildClass('modal', `${modal.modifiers} ${modal.show ? 'visible' : ''}`)}>
      <div className="modal__dimmer" onClick={closeModal} role="presentation" />
      <div className="modal__content">
        {currentContent}
      </div>
    </div>
  );
}

export default React.memo(Modal);
