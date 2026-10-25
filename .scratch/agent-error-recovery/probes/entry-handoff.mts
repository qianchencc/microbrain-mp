// Public HTTP/model-input probe, in-process gateway only; no device control.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../../../../iot-agent-runtime/apps/runtime/src/app.js';
import { createProductionGatewayFixture } from '../../../../iot-agent-runtime/apps/runtime/test/support/production-gateway-fixture.js';
const directory = await mkdtemp(join(tmpdir(), 'agent-entry-handoff-audit-'));
const gateway = createProductionGatewayFixture();
const headers = { authorization: 'Bearer office-user-b', tenantcode: 'LOCAL' };
const goal = '明天下午六点关闭会议室照明';
let unavailable = true, calls = 0, originalGoalInModelInput = false;
const runtime = buildApp({
  ...gateway.runtimeOptions, databasePath: join(directory, 'runtime.sqlite'),
  taskCredentialKey: 'ab'.repeat(32), now: () => new Date('2026-09-27T02:00:00.000Z'),
  iotFetch: async (input, init) => {
    if (unavailable && new URL(String(input)).pathname === '/micro-api/api/office/office/member/my/office') throw new TypeError('fetch failed');
    return gateway.fetch(input, init);
  },
  runAgent: async input => {
    calls++;
    originalGoalInModelInput = JSON.stringify(input.messages).includes(goal) || input.content.includes(goal);
    return { assistantText: '已收到继续请求。' };
  },
});
try {
  const conversationId = (await runtime.inject({ method: 'POST', url: '/api/agent/conversations', headers })).json().id;
  const failed = await runtime.inject({ method: 'POST', url: `/api/agent/conversations/${conversationId}/messages`, headers, payload: { content: goal } });
  const events = failed.payload.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(failed.statusCode, 200);
  assert.ok(events.some(event => event.type === 'run.failed'));
  assert.equal(calls, 0, 'failure must precede the first model request');
  unavailable = false;
  const restored = (await runtime.inject({ method: 'GET', url: '/api/agent/conversations/current', headers })).json().conversation;
  assert.equal(restored.turns[0].content, goal, 'the UI does retain the original user request');
  const resumed = await runtime.inject({ method: 'POST', url: `/api/agent/conversations/${conversationId}/messages`, headers, payload: { content: '继续' } });
  assert.equal(resumed.statusCode, 200);
  console.log(JSON.stringify({ case: 'pre-model-catalog-failure', environment: 'controlled-public-http-model-input',
    failedTerminal: events.findLast(event => event.type.startsWith('run.'))?.type,
    originalGoalVisibleOnRestore: true, callsAfterExplicitContinue: calls, originalGoalInModelInput }, null, 2));
  assert.ok(originalGoalInModelInput, 'after pre-model failure, continuing must preserve the original business request in model input');
} finally {
  await runtime.close();
  await rm(directory, { recursive: true, force: true });
}
