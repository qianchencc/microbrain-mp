import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/app.js';
import { mixedGateway } from './support/company-night-closure-fixture.js';

for (const scenario of ['clock_skew', 'batch_elapsed'] as const) test(`audit only: generic close ${scenario}`, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'close-audit-db-'));
  let now = new Date('2026-10-19T09:00:00+08:00');
  const gateway = mixedGateway('normal', () => now.getTime());
  const changed = new Map<string, number>();
  const app = buildApp({ ...gateway.runtimeOptions, databasePath: join(dir, 'runtime.sqlite'),
    taskCredentialKey: 'ab'.repeat(32), readbackWaitMs: 0, now: () => now,
    iotFetch: async (input, init) => {
      const url = String(input);
      const response = await gateway.fetch(input, init);
      const control = /interactive\/(batch-ac-\d+)\/control\/down$/.exec(url);
      if (control) {
        if (scenario === 'batch_elapsed') now = new Date(now.getTime() + 1000);
        changed.set(control[1]!, now.getTime());
      }
      const detail = /interactive\/(batch-ac-\d+)\/detail\/down$/.exec(url);
      if (detail && changed.has(detail[1]!)) {
        const outer = await response.json() as { content: string };
        const panel = JSON.parse(outer.content);
        panel.data.O.valts = scenario === 'clock_skew' ? now.getTime() - 35000 : changed.get(detail[1]!);
        return Response.json({ code: 200, content: JSON.stringify(panel) });
      }
      return response;
    },
    runAgent: async input => {
      const prepared = await input.prepareCompanyControlTask({ label: 'audit close', phases: [{
        at: '2026-10-19T20:00:00+08:00', targets: [{ kind: 'ac', allAuthorized: true, command: { power: 'off' } }],
      }] });
      assert.equal(prepared.status, 'ready');
      return { assistantText: 'confirm', ...(prepared.status === 'ready' ? { taskProposal: prepared.proposal } : {}) };
    },
  });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const headers = { authorization: 'Bearer isolated-audit', tenantcode: 'XSJ' };
  const conv = (await app.inject({ method: 'POST', url: '/api/agent/conversations', headers, payload: { source: 'company' } })).json().id;
  const stream = await app.inject({ method: 'POST', url: `/api/agent/conversations/${conv}/messages?source=company`, headers, payload: { content: 'prepare close all' } });
  const proposal = stream.payload.trim().split('\n').map(s => JSON.parse(s)).find(e => e.type === 'task.proposed');
  assert.ok(proposal, stream.payload);
  const confirm = await app.inject({ method: 'POST', url: `/api/agent/tasks/${proposal.taskId}/confirm?source=company`, headers, payload: { version: 1 } });
  assert.equal(confirm.statusCode, 201, confirm.payload);
  now = new Date('2026-10-19T20:00:00+08:00');
  await app.scanDueTasks();
  const response = await app.inject({ method: 'GET', url: `/api/agent/tasks/${proposal.taskId}?source=company`, headers });
  assert.equal(response.statusCode, 200, response.payload);
  const task = response.json().task;
  const counts: Record<string, number> = {};
  for (const d of task.phases[0].devices) counts[d.outcome] = (counts[d.outcome] ?? 0) + 1;
  assert.equal([...gateway.acPower.values()].every(v => v === 0), true);
  assert.equal(gateway.acWrites.length, 30);
  assert.equal(task.status, 'unconfirmed');
  assert.ok(counts.unconfirmed > 0);
  await app.scanDueTasks();
  assert.equal(gateway.acWrites.length, 30);
  console.log(JSON.stringify({ scenario, taskStatus: task.status, allPanelPowerOff: true, counts, writesAfterRescan: gateway.acWrites.length }));
});
