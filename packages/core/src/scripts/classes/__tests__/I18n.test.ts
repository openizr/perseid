/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import I18n from 'scripts/classes/I18n';

describe('classes/I18n', () => {
  vi.mock('scripts/classes/Telemetry');
  vi.mock('scripts/helpers/deepMerge', () => ({
    default: vi.fn(() => ({
      TEST: {
        SUBTEST: {
          LABEL_2: 'Label 2',
          LABEL: 'Hello {{value}}!',
        },
      },
    })),
  }));

  const telemetry = {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    close: vi.fn(),
    span: vi.fn(),
    now: vi.fn(),
    duration: vi.fn(),
    measure: vi.fn(),
    createGauge: vi.fn(),
    waitForReady: vi.fn(),
    createCounter: vi.fn(),
    createHistogram: vi.fn(),
    createUpDownCounter: vi.fn(),
  };

  const i18n = new I18n(telemetry, {
    TEST: {
      SUBTEST: {
        LABEL: 'Hello {{value}}!',
      },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('[t]', () => {
    test('label exists', () => {
      expect(i18n.t('TEST.INVALID.LABEL')).toEqual('TEST.INVALID.LABEL');
      expect(telemetry.error).toHaveBeenCalledTimes(1);
      expect(telemetry.error).toHaveBeenCalledWith('Missing translation for label "TEST.INVALID.LABEL".');
    });

    test('label does not exist', () => {
      expect(i18n.t('TEST.SUBTEST.LABEL', { value: 'Test' })).toBe('Hello Test!');
      expect(telemetry.error).not.toHaveBeenCalled();
    });
  });

  test('[numeric]', () => {
    expect(i18n.numeric(1.22)).toBe('1.22');
  });

  test('[dateTime]', () => {
    expect(i18n.dateTime(new Date('2023-02-01'))).toBe('2023/02/01 00:00:00');
  });

  test('[addLabels]', () => {
    i18n.addLabels({
      TEST: {
        SUBTEST: {
          LABEL_2: 'Label 2',
        },
      },
    });
    expect(i18n.t('TEST.SUBTEST.LABEL_2')).toBe('Label 2');
  });

  test('[has]', () => {
    expect(i18n.has('TEST.SUBTEST.LABEL')).toBe(true);
    expect(i18n.has('TEST.INVALID.LABEL')).toBe(false);
  });
});
