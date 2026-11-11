import test from 'node:test';
import assert from 'node:assert/strict';
import * as dashboard from '../pages/agent/lib/dashboard.mjs';

const devices = [
  { id: 'light-a', kind: 'lighting', name: '测试照明A', location: '测试一区' },
  { id: 'meter-a', kind: 'energy', name: '测试电表A', location: '测试二区' },
  { id: 'gas-a', kind: 'safety', subtype: 'gas', name: '测试燃气探测器', location: '测试一区' },
  { id: 'meter-b', kind: 'energy', name: '电表-测试三区-计量点', location: '' },
];
const ids = (groups) => groups.flatMap((group) => group.items.map((device) => device.id));

test('同一目录提前生成位置和类型分组，保留来源顺序与真实分类', () => {
  const before = structuredClone(devices);
  const directory = dashboard.prepareCompanyDeviceDirectory(devices);
  assert.deepEqual(
    directory.groups.location.map((group) => [group.label, group.items.map((device) => device.id)]),
    [
      ['测试一区', ['light-a', 'gas-a']],
      ['测试二区', ['meter-a']],
      ['测试三区', ['meter-b']],
    ]
  );
  assert.deepEqual(
    directory.groups.kind.map((group) => [group.label, group.items.map((device) => device.id)]),
    [
      ['照明', ['light-a']],
      ['电表', ['meter-a', 'meter-b']],
      ['燃气', ['gas-a']],
    ]
  );
  assert.equal(directory.items.find((device) => device.id === 'meter-b').location, '测试三区');
  assert.deepEqual(devices, before, '展示准备不能改写后端目录事实');
});

test('名称位置类型均可检索，切换分组保持命中，单类目录不越过原范围', () => {
  const directory = dashboard.prepareCompanyDeviceDirectory(devices);
  for (const [query, expected] of [
    ['  电表a  ', ['meter-a']],
    ['测试一区', ['light-a', 'gas-a']],
    ['燃气', ['gas-a']],
    ['消防安全', ['gas-a']],
  ]) {
    const view = dashboard.filterCompanyDeviceDirectory(directory, { kind: 'catalog', query });
    assert.deepEqual(ids(view.groups.location), expected);
    assert.deepEqual(ids(view.groups.kind), expected);
  }
  const meters = dashboard.filterCompanyDeviceDirectory(directory, {
    kind: 'energy',
    query: '测试',
  });
  assert.deepEqual(ids(meters.groups.location), ['meter-a', 'meter-b']);
  assert.deepEqual(ids(meters.groups.kind), ['meter-a', 'meter-b']);
  assert.deepEqual(
    dashboard.filterCompanyDeviceDirectory(directory, { kind: 'energy', query: '照明' }),
    { items: [], groups: { location: [], kind: [] } }
  );
});

test('预分组数据经过属性传输复制后，搜索不会丢失分组中的命中设备', () => {
  const directory = JSON.parse(JSON.stringify(dashboard.prepareCompanyDeviceDirectory(devices)));
  const view = dashboard.filterCompanyDeviceDirectory(directory, { kind: 'energy', query: '电表' });
  assert.deepEqual(ids(view.groups.location), ['meter-a', 'meter-b']);
  assert.deepEqual(ids(view.groups.kind), ['meter-a', 'meter-b']);
});
