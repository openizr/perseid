/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * `multiparty` mock.
 */

class Form {
  on(eventName: string, callback: (...args: Any[]) => void): void {
    if (process.env.MUTIPARTY_NO_FIELD === 'true') {
      callback(this);
    } else {
      setImmediate(() => {
        if (eventName === 'error' && process.env.MUTIPARTY_ERROR_FIELD_TOO_LARGE === 'true') {
          callback({ message: 'maxFieldsSize' });
        } else if (eventName === 'error' && process.env.MUTIPARTY_ERROR_TOO_MANY_FIELDS === 'true') {
          callback({ message: 'maxFields' });
        } else if (eventName === 'error' && process.env.MUTIPARTY_ERROR_MISSING_HEADER === 'true') {
          callback({ message: 'missing content-type header' });
        } else if (eventName === 'error' && process.env.MUTIPARTY_ERROR_OTHER === 'true') {
          callback(new Error('other error'));
        } else if (eventName === 'part') {
          callback({
            on: (partEventName: string, partCallback: (...args: Any[]) => void): void => {
              if (partEventName === 'data') {
                partCallback({ length: 100 });
              }
            },
            headers: { 'content-type': 'image/png' },
          });
        } else if (eventName === 'field') {
          callback();
        } else if (eventName !== 'error') {
          setTimeout(callback);
        }
      });
    }
  }

  parse(): this {
    return this;
  }
}
export default {
  Form,
};
