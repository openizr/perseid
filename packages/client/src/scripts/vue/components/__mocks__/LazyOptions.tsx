// /**
//  * Copyright (c) Openizr. All Rights Reserved.
//  *
//  * This source code is licensed under the MIT license found in the
//  * LICENSE file in the root directory of this source tree.
//  *
//  */

// /**
//  * `scripts/react/components/LazyOptions` mock.
//  */

// import * as React from 'react';

// interface LazyOptionsProps {
//   [key: string]: unknown;
//   onChange?: (value: unknown) => void;
// }

// export default function LazyOptions({ onChange, ...props }: LazyOptionsProps): JSX.Element {
//   React.useEffect(() => {
//     // Covers `onChange` handler.
//     if (onChange !== undefined) {
//       onChange(null);
//       onChange({ value: '000000000000000000000011' });
//     }
//   }, []);
//   return (
//     <div id="lazy-options">{JSON.stringify(props)}</div>
//   );
// }
