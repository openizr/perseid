/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type Id from 'scripts/classes/NodeId';

/**
 * Checks if two IDs are the same.
 *
 * @param id ID to compare with.
 *
 * @returns Function to check if an ID is the same as the given one.
 */
export default function isSameId(id: Id): (idToCompare: Id) => boolean {
  return (idToCompare: Id) => String(id) === String(idToCompare);
}
