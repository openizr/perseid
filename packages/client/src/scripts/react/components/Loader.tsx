/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { type DefaultDataModel } from '@perseid/core';

/**
 * App loader.
 *
 * @linkcode https://github.com/openizr/perseid/blob/main/client/src/scripts/react/components/Loader.tsx
 */
function Loader<DataModel extends DefaultDataModel = DefaultDataModel>({
  services,
}: ReactCommonProps<DataModel>): JSX.Element {
  return (
    <div className="loader">
      {services.i18n.t('LOADER.LABEL')}
    </div>
  );
}

export default React.memo(Loader) as ReactLoaderComponent;
