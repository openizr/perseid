/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import I18n from 'scripts/classes/I18n';

describe('services/I18n', () => {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    close: vi.fn(),
  };

  const i18n = new I18n(logger, {
    TEST: {
      SUBTEST: {
        LABEL: 'Hello {{value}}!',
      },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('[t] invalid label', () => {
    expect(i18n.t('TEST.INVALID.LABEL')).toEqual('TEST.INVALID.LABEL');
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('Missing translation for label "TEST.INVALID.LABEL".');
  });

  test('[t] valid label', () => {
    expect(i18n.t('TEST.SUBTEST.LABEL', { value: 'Test' })).toBe('Hello Test!');
    expect(logger.error).not.toHaveBeenCalled();
  });
});
