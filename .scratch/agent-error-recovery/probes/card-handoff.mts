// Public HTTP audit only. Uses an in-process gateway; never contacts customer devices.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../../../../iot-agent-runtime/apps/runtime/src/app.js';
import { createProductionGatewayFixture } from '../../../../iot-agent-runtime/apps/runtime/test/support/production-gateway-fixture.js';

const directory = await mkdtemp(join(tmpdir(), 'agent-card-handoff-audit-'));
const gateway = createProductionGatewayFixture();
const headers = { authorization: 'Bearer office-user-b', tenantcode: 'LOCAL' };
let unavailable = false;
let modelCalls = 0;
let failedReads = 0;
const runtime = buildApp({
  ...gateway.runtimeOptions, databasePath: join(directory, 'runtime.sqlite'),
  taskCredentialKey: 'ab'.repeat(32), now: () => new Date('2026-09-27T02:00:00.000Z'),
  readbackWaitMs: 0,
  iotFetch: async (input, init) => {
    if (unavailable && new URL(String(input)).pathname === '/micro-api/api/office/office/member/my/office') {
      failedReads++; throw new TypeError('fetch failed');
    }
    return gateway.fetch(input, init);
  },
  runAgent: async input => {
    modelCalls++;
    const set = await input.findDeviceCandidates({ kind: 'lighting', scopeText: '26楼会议室' });
    const deviceId = set.devices[0]!.id;
    await input.inspectDeviceCapabilities({ candidateSets: [{ candidateSetId: set.candidateSetId, deviceIds: [deviceId] }] });
    return { assistantText: '任务待确认。', taskProposal: { label: '卡片恢复核对', candidateSetIds: [set.candidateSetId],
      phases: [{ at: '2026-09-28T06:00:00.000Z', actions: [{ kind: 'lighting', deviceId, command: { closeOrOpen: 1 } }] }] } };
  },
});
const eventsOf = (body: string) => body.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
try {
  const conversationId = (await runtime.inject({ method: 'POST', url: '/api/agent/conversations', headers })).json().id;
  const response = await runtime.inject({ method: 'POST', url: `/api/agent/conversations/${conversationId}/messages`, headers, payload: { content: '明天给会议室创建照明任务' } });
  const proposed = eventsOf(response.payload).find(event => event.type === 'task.proposed');
  assert.ok(proposed, 'setup must produce a real persisted proposal');
  const before = (await runtime.inject({ method: 'GET', url: '/api/agent/conversations/current', headers })).json().conversation;
  assert.equal(before?.id, conversationId, 'restore must resolve this conversation');
  unavailable = true;
  const confirmation = await runtime.inject({ method: 'POST', url: `/api/agent/tasks/${proposed.taskId}/confirm`, headers, payload: { version: 1 } });
  // The current client replays eligible confirmation POSTs once. Include that path.
  const replay = await runtime.inject({ method: 'POST', url: `/api/agent/tasks/${proposed.taskId}/confirm`, headers, payload: { version: 1 } });
  unavailable = false;
  const restored = (await runtime.inject({ method: 'GET', url: '/api/agent/conversations/current', headers })).json().conversation;
  assert.equal(confirmation.json().code, 'AUTHORIZED_SCOPE_UNAVAILABLE', 'fault must reach the confirmation catalog, not identity preflight');
  assert.equal(restored?.id, conversationId);
  const summary = {
    case: 'card-confirmation-failure-handoff', source: 'local-public-http-controlled-gateway',
    confirmationHttp: confirmation.statusCode, clientReplayHttp: replay.statusCode, code: confirmation.json().code,
    recovery: confirmation.json().recovery, failedReads, modelCalls,
    phase: restored.phase, turnsBefore: before.turns?.length, turnsAfter: restored.turns?.length,
    newPublicEvents: restored.turns?.flatMap((turn: { events?: unknown[] }, index: number) =>
      (turn.events ?? []).slice(before.turns?.[index]?.events?.length ?? 0)),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (process.argv.includes('--expect-agent-handoff')) {
    assert.ok(summary.newPublicEvents?.length, 'confirmation failure should be durably handed back to the agent without another user message');
  }
} finally {
  await runtime.close();
  await rm(directory, { recursive: true, force: true });
}
