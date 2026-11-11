import test from 'node:test';
import assert from 'node:assert/strict';
import { isObservationKind, regionDeviceGroups } from '../pages/agent/lib/region.mjs';
import { applyEvent, createTurn, restoreTurns } from '../pages/agent/lib/conversation.mjs';
import {
  acInspectionMeta,
  acReadbackText,
  energyStale,
  videoViewLabel,
  environmentCells,
  fmtShanghaiDateTime,
  stateObservationLabel,
} from '../pages/agent/lib/observations.mjs';

const videoDevice = {
  id: 'video-1',
  kind: 'video',
  name: '视频监控-26楼走廊',
  location: '26楼运营走廊',
};
const envDevice = { id: 'env-1', kind: 'environment', name: '环境传感器-26楼', location: '26楼' };
const energyDevice = { id: 'meter-1', kind: 'energy', name: '26楼运营部电表', location: '26楼' };
const safetyDevice = {
  id: 'fire-1',
  kind: 'safety',
  name: '27楼茶水间燃气感应器',
  location: '27楼茶水间',
};
const lightDevice = {
  id: 'light-1',
  kind: 'lighting',
  name: '照明开关-会议室',
  location: '会议室',
};

const readings = {
  'video-1': { state: true },
  'env-1': { state: { temp: 26, humidity: 57, pm25: 34, source: 'device' } },
  'meter-1': {
    state: {
      readTime: '2024-09-11T00:30:00.000Z',
      ia: 1.25,
      ib: 1.1,
      ic: 1.2,
      totalActivePower: 2.5,
    },
  },
  'fire-1': { state: null },
  'light-1': { state: true },
};

const devices = [videoDevice, envDevice, energyDevice, safetyDevice, lightDevice];
const all = (groups) => groups.flatMap((group) => group.items);
const itemOf = (groups, id) => all(groups).find((item) => item.id === id);

test('无状态设备不显示状态与采样占位，也不归入未知状态组', () => {
  const door = { id: 'door-1', kind: 'access', name: '测试门禁', location: '测试区域' };
  const snapshot = { status: 'partial', state: null, missingDeviceIds: [door.id, safetyDevice.id] };
  const groups = regionDeviceGroups(
    [door, safetyDevice],
    { [door.id]: snapshot, [safetyDevice.id]: snapshot },
    'status',
    ''
  );
  assert.equal(
    groups.some((group) => group.label === '状态未知'),
    false
  );
  for (const device of all(groups)) {
    assert.equal(device.detail, '');
    assert.equal(device.stateNote, '');
    assert.equal(device.status, null, '无状态能力不绘制状态色点');
  }
  assert.equal(itemOf(groups, door.id).name, door.name);
});

test('草案缺测汇总排除无状态设备，真实缺测和不可用仍可见', () => {
  const door = { kind: 'access', deviceId: 'door-1' };
  const light = { kind: 'lighting', deviceId: 'light-1' };
  const snapshot = { status: 'partial', missingDeviceIds: [door.deviceId] };
  assert.equal(stateObservationLabel(snapshot, undefined, [door]), '');
  assert.equal(stateObservationLabel(snapshot, undefined, [door, light]), '');
  assert.equal(
    stateObservationLabel({ ...snapshot, missingDeviceIds: [light.deviceId] }, undefined, [
      door,
      light,
    ]),
    '状态信息不完整'
  );
  assert.equal(
    stateObservationLabel({ status: 'unavailable' }, undefined, [door, light]),
    '状态暂不可用'
  );
});

test('缺读数不重复顶部占位，零值和真实离线事实仍保留', () => {
  for (const kind of ['lighting', 'ac', 'video', 'environment', 'energy']) {
    const device = { id: `missing-${kind}`, kind, name: '测试设备', location: '测试区域' };
    const groups = regionDeviceGroups(
      [device],
      {
        [device.id]: { status: 'partial', state: null, missingDeviceIds: [device.id] },
      },
      'kind',
      ''
    );
    assert.equal(itemOf(groups, device.id).detail, '');
    assert.equal(itemOf(groups, device.id).stateNote, '');
  }
  const zeroReadings = {
    'env-1': { state: { temp: 0, humidity: 0 } },
    'meter-1': { state: { totalActivePower: 0 } },
    'video-1': { state: false },
    'light-1': { state: false },
  };
  const groups = regionDeviceGroups(devices, zeroReadings, 'kind', '');
  assert.match(itemOf(groups, 'env-1').detail, /温度: 0°C.*湿度: 0%/);
  assert.match(itemOf(groups, 'meter-1').detail, /^0 kW/);
  assert.equal(itemOf(groups, 'video-1').status, 'off');
  assert.equal(itemOf(groups, 'light-1').status, 'off');
});

test('计量历史的日期按上海时区，不受手机所在时区影响', () => {
  assert.equal(fmtShanghaiDateTime('2025-05-26T23:00:33Z'), '2025-05-27 07:00');
  assert.equal(fmtShanghaiDateTime('2025-05-27T07:00:33+08:00'), '2025-05-27 07:00');
});

test('实时原始 PM 字段按客户定义显示并带浓度单位与舒适度，历史原值不会被标签修正重写', () => {
  const reading = { pm101: 20, pm10: 4, pm25: 7 };
  assert.deepEqual(
    environmentCells(reading).map((cell) => [cell.label, cell.value]),
    [
      ['PM2.5:', '7µg/m³ · 优'],
      ['PM10:', '20µg/m³'],
      ['PM1.0:', '4µg/m³'],
    ]
  );
  assert.deepEqual(reading, { pm101: 20, pm10: 4, pm25: 7 });
});

test('观察设备状态语义：视频在线/离线不冒充开-关，四类观察只读呈现', () => {
  const groups = regionDeviceGroups(devices, readings, 'kind', '');
  assert.equal(itemOf(groups, 'video-1').detail, '在线');
  assert.equal(itemOf(groups, 'video-1').status, 'on');
  assert.equal(
    itemOf(groups, 'env-1').detail,
    '温度: 26°C · 湿度: 57% · 舒适 · PM2.5: 34µg/m³ · 优'
  );
  assert.equal(itemOf(groups, 'env-1').status, 'observe');
  assert.match(itemOf(groups, 'meter-1').detail, /2\.5 kW · 读于 09-11/);
  assert.equal(itemOf(groups, 'light-1').detail, '开启');

  const offline = regionDeviceGroups([videoDevice], { 'video-1': { state: false } }, 'kind', '');
  assert.equal(itemOf(offline, 'video-1').detail, '离线');
  assert.equal(itemOf(offline, 'video-1').status, 'off');
});

test('状态分组观察类并入"仅观察"，影子读数如实标注来源', () => {
  const groups = regionDeviceGroups(devices, readings, 'status', '');
  const labels = groups.map((group) => group.label);
  assert.ok(labels.includes('仅观察'));
  assert.ok(!labels.includes('状态未知'));
  assert.deepEqual(
    groups
      .find((group) => group.label === '仅观察')
      .items.map((item) => item.id)
      .sort(),
    ['env-1', 'fire-1', 'meter-1', 'video-1']
  );
  assert.deepEqual(
    groups.find((group) => group.label === '运行中').items.map((item) => item.id),
    ['light-1']
  );

  const shadow = regionDeviceGroups(
    [envDevice],
    { 'env-1': { state: { temp: 26, source: 'shadow' } } },
    'kind',
    ''
  );
  assert.equal(itemOf(shadow, 'env-1').detail, '温度: 26°C · 平台影子');
});

test('observation.reported 事件进入轮次并随恢复重建，不产生草案', () => {
  const turn = createTurn('t1', '摄像头在线吗');
  applyEvent(turn, {
    type: 'observation.reported',
    observedAt: '2026-09-28T03:00:00.000Z',
    blocks: [
      {
        type: 'video',
        devices: [{ deviceId: 'video-1', name: '摄像头', location: '26楼', online: true }],
      },
      {
        type: 'alerts',
        windowDays: 365,
        total: 0,
        latest: {
          time: '2024-04-20T07:10:01.000Z',
          deviceName: '燃气感应器',
          type: 'gas',
          report: false,
        },
        records: [],
      },
    ],
  });
  assert.equal(turn.observations.length, 1);
  assert.equal(turn.observations[0].blocks[1].type, 'alerts');
  assert.equal(turn.draft, null);

  const [restored] = restoreTurns([
    {
      id: 't1',
      content: '摄像头在线吗',
      events: [
        {
          type: 'observation.reported',
          blocks: [
            {
              type: 'safety',
              devices: [
                { deviceId: 'fire-1', name: '燃气感应器', location: '27楼', subtype: 'gas' },
              ],
            },
          ],
        },
      ],
    },
  ]);
  assert.equal(restored.observations.length, 1);
  assert.equal(restored.observations[0].blocks[0].devices[0].subtype, 'gas');
});

test('能耗陈旧如实标注、查看画面按钮三态分层', () => {
  assert.equal(energyStale({ readTime: '2024-09-11T00:30:00.000Z' }), true, '一年前的读数是陈旧的');
  assert.equal(energyStale({ readTime: new Date(Date.now() - 3600e3).toISOString() }), false);
  assert.equal(energyStale(null), true, '缺读数也算陈旧/未知');

  // 播放页未部署 → 置灰接入中；已部署 → 在线可播；取流中/离线/未知各自独立文案，失败不冒称离线。
  assert.equal(videoViewLabel(true, false, false), '播放页接入中');
  assert.equal(videoViewLabel(true, true, false), '查看画面');
  assert.equal(videoViewLabel(true, true, true), '正在取流…');
  assert.equal(videoViewLabel(false, true, false), '已离线');
  assert.equal(isObservationKind('video'), true);
  assert.equal(isObservationKind('lighting'), false);
});

for (const type of ['energy_comparison', 'company_energy', 'energy_report'])
  test(`${type}进度与解读原位更新，实时与恢复只保留一张报告`, () => {
    const event = (status) => ({
      type: 'observation.reported',
      blocks: [
        { type, report: { reportId: 'report-1', weeks: [{ usage: 20 }], explanation: { status } } },
      ],
    });
    const first = createTurn('t1', '比较最近四周'),
      second = createTurn('t2', '重新解读');
    applyEvent(first, event('pending'), [first, second]);
    applyEvent(first, event('failed'), [first, second]);
    applyEvent(second, event('ready'), [first, second]);
    assert.equal(first.observations.length, 1);
    assert.equal(first.observations[0].blocks[0].report.explanation.status, 'ready');
    assert.equal(second.observations.length, 0);
    const restored = restoreTurns([
      { id: 't1', content: '比较', events: [event('pending'), event('failed')] },
      { id: 't2', content: '解读', events: [event('ready')] },
    ]);
    assert.equal(restored.flatMap((t) => t.observations).length, 1);
    assert.equal(restored[0].observations[0].blocks[0].report.explanation.status, 'ready');
  });

test('空调巡检行分开展示调前读数与平台回读，指令目标不冒充设备实际结果', () => {
  const block = { mode: 'adjust_to_26', criteria: { setpoint: { value: 26 } } };
  const adjusted = {
    name: '空调-机房前',
    power: 'on',
    mode: 'cool',
    setpoint: 25,
    disposition: 'adjusted',
    afterSetpoint: 26,
  };
  assert.equal(
    acInspectionMeta(adjusted, block),
    '已下发调到26℃ · 检查前：开机 · 制冷 · 25℃ · 平台回读 26℃'
  );
  const legacy = { ...adjusted, afterSetpoint: undefined };
  assert.equal(
    acInspectionMeta(legacy, block),
    '已下发调到26℃ · 检查前：开机 · 制冷 · 25℃',
    '旧记录没有回读事实时不补写温度'
  );
  const fractional = {
    name: '空调-机房前',
    power: 'on',
    mode: 'cool',
    setpoint: 25.5,
    disposition: 'adjusted',
    afterSetpoint: 26,
  };
  assert.match(
    acInspectionMeta(fractional, block),
    /25\.5℃ · 平台回读 26℃/,
    '分数度调前读数按原值展示'
  );
  const unconfirmed = {
    power: 'on',
    mode: 'cool',
    setpoint: 25,
    disposition: 'unknown',
    afterSetpoint: 25,
  };
  assert.match(
    acInspectionMeta(unconfirmed, block),
    /已下发 · 检查前：开机 · 制冷 · 25℃ · 平台回读 25℃/
  );
  const skipped = { power: 'off', mode: 'cool', setpoint: 26, disposition: 'not_dispatched' };
  assert.equal(acReadbackText(skipped), '', '未下发的设备没有回读事实');
  assert.equal(acInspectionMeta(skipped, block), '这次未调整 · 检查前：关机 · 制冷 · 26℃');
  assert.equal(
    acInspectionMeta(
      { power: 'on', mode: 'cool', setpoint: 26, disposition: 'not_needed' },
      { mode: 'inspect' }
    ),
    '已检查 · 开机 · 制冷 · 26℃',
    '只读巡检未下发指令，标注为已检查'
  );
  assert.equal(
    acInspectionMeta(
      { power: 'on', mode: 'cool', setpoint: 26, disposition: 'satisfied' },
      { mode: 'adjust_to_26' }
    ),
    '已下发 · 检查前：开机 · 制冷 · 26℃',
    '已下发但无需调整不显示无需调整文案'
  );
  const target27 = { mode: 'adjust_to_26', criteria: { setpoint: { value: 27 } } };
  assert.equal(
    acInspectionMeta(adjusted, target27),
    '已下发调到27℃ · 检查前：开机 · 制冷 · 25℃ · 平台回读 26℃',
    '调温目标按检查点 criteria 展示'
  );
});

test('报告附件按保存 id 去重：重放/跨轮同一链接只更新，run.failed 不丢附件', () => {
  const artifact = (id, status) => ({
    type: 'report_artifact',
    report: { id, title: '用电报告', status, generatedAt: '2026-10-13T02:00:00.000Z' },
  });
  const first = createTurn('t1', '生成昨日用电报告'),
    second = createTurn('t2', '再看一次');
  const turns = [first, second];
  applyEvent(
    first,
    {
      type: 'observation.reported',
      observedAt: '2026-10-13T02:00:00.000Z',
      blocks: [artifact('r1', 'partial')],
    },
    turns
  );
  applyEvent(
    first,
    {
      type: 'observation.reported',
      observedAt: '2026-10-13T02:00:01.000Z',
      blocks: [artifact('r1', 'completed')],
    },
    turns
  );
  assert.equal(
    first.observations
      .flatMap((obs) => obs.blocks)
      .filter((block) => block.type === 'report_artifact').length,
    1,
    '同一附件重放不重复'
  );
  assert.equal(
    first.observations.flatMap((obs) => obs.blocks)[0].report.status,
    'completed',
    '重复事件更新原块'
  );
  applyEvent(
    second,
    {
      type: 'observation.reported',
      observedAt: '2026-10-13T02:01:00.000Z',
      blocks: [artifact('r1', 'completed')],
    },
    turns
  );
  applyEvent(
    second,
    {
      type: 'observation.reported',
      observedAt: '2026-10-13T02:01:01.000Z',
      blocks: [artifact('r2', 'completed')],
    },
    turns
  );
  assert.equal(
    second.observations
      .flatMap((obs) => obs.blocks)
      .filter((block) => block.type === 'report_artifact').length,
    1,
    '跨轮同 id 不另成卡'
  );
  assert.equal(first.observations.flatMap((obs) => obs.blocks)[0].report.id, 'r1');
  assert.equal(
    second.observations.flatMap((obs) => obs.blocks)[0].report.id,
    'r2',
    '不同附件保留独立链接'
  );
  applyEvent(second, { type: 'run.failed', message: '模型未返回可展示的消息' }, turns);
  assert.equal(second.running, false);
  assert.equal(
    second.observations
      .flatMap((obs) => obs.blocks)
      .filter((block) => block.type === 'report_artifact').length,
    1,
    '答复失败不丢已保存附件'
  );
  assert.equal(second.draft, null);
  assert.equal(second.tasks.length, 0);
  const restored = restoreTurns([
    {
      id: 't1',
      content: '生成昨日用电报告',
      events: [
        { type: 'observation.reported', blocks: [artifact('r1', 'partial')] },
        { type: 'observation.reported', blocks: [artifact('r1', 'completed')] },
      ],
    },
    {
      id: 't2',
      content: '再看一次',
      events: [
        { type: 'observation.reported', blocks: [artifact('r2', 'completed')] },
        { type: 'run.failed', message: 'x' },
      ],
    },
  ]);
  assert.equal(
    restored
      .flatMap((turn) => turn.observations)
      .flatMap((obs) => obs.blocks)
      .filter((block) => block.type === 'report_artifact').length,
    2,
    '恢复保留两个不同附件'
  );
  assert.equal(restored[0].observations[0].blocks[0].report.status, 'completed');
});
