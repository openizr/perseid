/**
  * Generates a no-collision, 40-chars, unique identifier.
  *
  * @returns {string} Generated identifier.
  */
export default function generateId() {
  // NodeJS environment...
  if (typeof window === 'undefined') {
    const crypto = require('crypto'); // eslint-disable-line
    return `${Date.now().toString(16).slice(0, 10)}${crypto.randomBytes(15).toString('hex')}`;
  }
  // Browser environment...
  return `${Date.now().toString(16).slice(0, 10)}${Array.prototype.map.call(window.crypto.getRandomValues(new Uint32Array(4)), (uint) => uint.toString(16)).join('')}`.slice(0, 40);
}
