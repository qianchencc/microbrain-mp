// Controlled model + production runner + public HTTP. No customer network or confirmation.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../../../../iot-agent-runtime/apps/runtime/src/app.js';
import { createPiAgentRunner } from '../../../../iot-agent-runtime/apps/runtime/src/agent/pi-runner.js';
import { createProductionGatewayFixture } from '../../../../iot-agent-runtime/apps/runtime/test/support/production-gateway-fixture.js';
import { fauxProvider, fauxToolCall, fauxAssistantMessage } from '../../../../iot-agent-runtime/node_modules/@earendil-works/pi-ai/dist/providers/faux.js';

const directory = await mkdtemp(join(tmpdir(), 'agent-progress-exit-audit-'));
const count = process.argv.includes('--four') ? 4 : 5;
const scopes = ['26楼甲会议室', '26楼乙会议室', '26楼丙会议室', '26楼丁会议室', '26楼戊会议室'].slice(0, count);
const gateway = createProductionGatewayFixture();
const faux = fauxProvider();
let availableAfterDiscovery: string[] = [];
faux.setResponses([
  fauxAssistantMessage(scopes.map(scopeText => fauxToolCall('find_device_candidates', { kind: 'lighting', scopeText })), { stopReason: 'toolUse' }),
  context => {
    availableAfterDiscovery = (context.tools ?? []).map(tool => tool.name);
    if (!availableAfterDiscovery.length) return fauxAssistantMessage('范围已经查到，但本轮无法继续准备任务。');
    return fauxAssistantMessage(fauxToolCall('propose_task', {
      label: '五个明确会议室照明任务', phases: [{ at: '2026-10-10T10:00:00.000Z',
        targets: [{ kind: 'lighting', scopeTexts: scopes, command: { closeOrOpen: 0 } }] }],
    }), { stopReason: 'toolUse' });
  },
  fauxAssistantMessage('待确认。'),
]);
const runner = createPiAgentRunner({ model: faux.getModel(), streamFn: faux.provider.streamSimple.bind(faux.provider), onModelTiming: () => {} });
const runtime = buildApp({
  ...gateway.runtimeOptions, databasePath: join(directory, 'runtime.sqlite'), taskCredentialKey: 'ab'.repeat(32),
  now: () => new Date('2026-10-09T09:00:00.000Z'), readbackWaitMs: 0, runAgent: runner,
  iotFetch: async (input, init) => {
    const url = new URL(String(input));
    const json = (content: unknown, code = 200) => new Response(JSON.stringify({ code, content, message: 'ok' }));
    if (url.pathname.endsWith('/lighting/myAreaList')) {
      const parent = url.searchParams.get('parentId');
      if (parent && parent !== 'root') return json(null, 204);
      return json(parent ? scopes.map((name, i) => ({ id: `room-${i}`, parentId: 'root', fullCode: `1-${i}`, name }))
        : [{ id: 'root', fullCode: '1', name: '测试楼层' }]);
    }
    if (url.pathname.endsWith('/lighting/devicePage')) {
      const index = Number(url.searchParams.get('areaFullCode')?.split('-')[1]);
      return json([{ id: `light-${index}`, hubDeviceId: `hub-${index}`, name: `照明开关-${scopes[index]}`, switchStatus: true, netStatus: 'ON_LINE' }]);
    }
    return gateway.fetch(input, init);
  },
});
const headers = { authorization: 'Bearer progress-audit', tenantcode: 'XSJ' };
try {
  const conversationId = (await runtime.inject({ method: 'POST', url: '/api/agent/conversations', headers, payload: { source: 'company' } })).json().id;
  const response = await runtime.inject({ method: 'POST', url: `/api/agent/conversations/${conversationId}/messages?source=company`, headers,
    payload: { content: `明天下午六点关闭${scopes.join('、')}的照明，准备一份任务让我确认。` } });
  assert.equal(response.statusCode, 200);
  const events = response.payload.trim().split('\n').map(line => JSON.parse(line));
  const found = events.filter(event => event.type === 'tool.completed' && event.tool === 'find_device_candidates');
  assert.equal(found.length, count);
  assert.ok(found.every(event => event.status === 'completed' && event.details?.candidates?.length === 1), 'every search must produce a distinct nonempty result');
  const proposed = events.some(event => event.type === 'task.proposed');
  console.log(JSON.stringify({ case: 'distinct-successful-searches', environment: 'controlled-model-public-http', count,
    foundCounts: found.map(event => event.details.candidates.length), toolsAvailableAfterDiscovery: availableAfterDiscovery.length,
    proposed, terminal: events.findLast(event => event.type.startsWith('run.')), confirmed: false }, null, 2));
  assert.ok(proposed, 'new evidence within the global budget must still allow the task proposal');
} finally {
  await runtime.close();
  await rm(directory, { recursive: true, force: true });
}
