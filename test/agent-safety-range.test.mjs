import test from 'node:test';
import assert from 'node:assert/strict';
import { safetyHistoryDateRange } from '../pages/agent/lib/observations.mjs';

test('台账默认覆盖最早记录到今天，重置不保留旧结束日期', () => {
  assert.deepEqual(safetyHistoryDateRange({}, 'reset', '', '2020-01-02', '2026-11-11'), {
    from: '2020-01-02',
    to: '2026-11-11',
  });
  assert.deepEqual(
    safetyHistoryDateRange(
      { from: '2026-10-01', to: '2026-10-03' },
      'reset',
      '',
      '2020-01-02',
      '2026-11-11'
    ),
    {
      from: '2020-01-02',
      to: '2026-11-11',
    }
  );
});

test('开始与结束日期均受台账下限、上海今天及起止顺序约束', () => {
  const range = { from: '2020-01-02', to: '2020-01-10' };
  assert.deepEqual(
    safetyHistoryDateRange(range, 'from', '1900-01-01', '2020-01-02', '2026-11-11'),
    range
  );
  assert.deepEqual(
    safetyHistoryDateRange(range, 'from', '2020-02-01', '2020-01-02', '2026-11-11'),
    { from: '2020-02-01', to: '2020-02-01' }
  );
  assert.deepEqual(safetyHistoryDateRange(range, 'end', '1999-01-01', '2020-01-02', '2026-11-11'), {
    from: '2020-01-02',
    to: '2020-01-02',
  });
  assert.deepEqual(safetyHistoryDateRange(range, 'end', '2027-01-01', '2020-01-02', '2026-11-11'), {
    from: '2020-01-02',
    to: '2026-11-11',
  });
});

test('切换到更晚开始的类别时纠正旧范围，没有边界则不构造无限历史', () => {
  assert.deepEqual(
    safetyHistoryDateRange(
      { from: '2020-01-02', to: '2020-01-10' },
      'current',
      '',
      '2024-03-30',
      '2026-11-11'
    ),
    { from: '2024-03-30', to: '2024-03-30' }
  );
  assert.deepEqual(safetyHistoryDateRange({}, 'reset', '', '', '2026-11-11'), {
    from: '',
    to: '2026-11-11',
  });
});
