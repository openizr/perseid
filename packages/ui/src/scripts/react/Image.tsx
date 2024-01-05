/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import buildClass from 'scripts/core/buildClass';

const getDimensions = (ratio: string): { width: number; height: number; } => {
  let dimensions;
  switch (ratio) {
    case 'square':
      return { width: 1, height: 1 };
    case 'portrait':
      return { width: 2, height: 3 };
    case 'landscape':
      return { width: 3, height: 2 };
    case 'panoramic':
      return { width: 16, height: 9 };
    default:
      dimensions = ratio.split('x').map((value) => parseInt(value, 10));
      return { width: dimensions[0], height: dimensions[1] };
  }
};

/**
 * Image.
 */
function UIImage(props: UIImageProps): JSX.Element {
  const { lazy = true } = props;
  const { src, alt, ratio } = props;
  const { id, modifiers = '', itemProp } = props;
  const dimensions = getDimensions(ratio);
  const className = buildClass('ui-image', `${ratio} ${modifiers}`);

  // Custom aspect ratio...
  if (/^([0-9]+)x([0-9]+)$/i.test(ratio)) {
    return (
      <img
        id={id}
        src={src}
        alt={alt}
        itemProp={itemProp}
        className={className}
        width={dimensions.width}
        height={dimensions.height}
        loading={lazy ? 'lazy' : undefined}
      />
    );
  }

  // Standard aspect ratio...
  return (
    <div id={id} className={className}>
      <img
        src={src}
        alt={alt}
        itemProp={itemProp}
        width={dimensions.width}
        height={dimensions.height}
        loading={lazy ? 'lazy' : undefined}
      />
    </div>
  );
}

export default React.memo(UIImage);
