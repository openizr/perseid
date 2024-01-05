/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { UIButton, UITitle } from '@perseid/ui/react';
import { type DefaultDataModel } from '@perseid/core';

/**
 * Confirmation modal props.
 */
export type ConfirmationModalProps<
  DataModel extends DefaultDataModel
> = GenericConfirmationModalProps & ReactCommonProps<DataModel>;

/**
 * Confirmation modal.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/ConfirmationModal.tsx
 */
function ConfirmationModal<DataModel extends DefaultDataModel = DefaultDataModel>({
  title,
  cancel,
  confirm,
  services,
  subTitle,
  onConfirm: onConfirmProp,
}: ConfirmationModalProps<DataModel>): JSX.Element {
  const onCancel = React.useCallback(() => {
    services.store.mutate('modal', 'HIDE');
  }, [services]);

  const onConfirm = React.useCallback(() => {
    onConfirmProp?.();
    services.store.mutate('modal', 'HIDE');
  }, [onConfirmProp, services]);

  return (
    <div className="confirmation-modal">
      <UITitle level="3" modifiers="2" label={services.i18n.t(title)} />
      <UITitle level="4" modifiers="3" label={services.i18n.t(subTitle)} />
      <div className="confirmation-modal__ctas">
        <UIButton
          modifiers="text"
          onClick={onCancel}
          label={services.i18n.t(cancel)}
        />
        <UIButton
          modifiers="primary"
          onClick={onConfirm}
          label={services.i18n.t(confirm)}
        />
      </div>
    </div>
  );
}

export default React.memo(ConfirmationModal);
