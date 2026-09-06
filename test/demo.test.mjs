import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanup, snapshot } from './fixtures/context.mjs';
import { SnapshotStore } from '../dist/storage/snapshots.js';
import { createApp } from '../dist/server/app.js';
import { compareReports } from '../dist/reports/compare.js';
import { toMarkdown } from '../dist/reports/markdown.js';import { demoSession } from '../dist/demo/session.js';

test('demo receipts are deterministic, synthetic and have reproducible differences', () => {
  const a = demoSession(), b = demoSession();
  assert.deepEqual(a, b);
  assert.equal(a.report.demo, true);
  assert.equal(a.before.demo, true);
  assert.equal(a.comparison.demo, true);
  assert.equal(a.comparison.code.counts.source, 2);
  assert.equal(a.comparison.code.counts.tests, 1);
  assert.equal(a.comparison.chain[0].field, 'creatorTaxBps');
  assert.equal(a.comparison.chain[0].after.value, 50);
});

test('demo reports cannot enter the live snapshot store or be compared with live evidence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rumzo-demo-'));
  try {
    const { report } = demoSession();
    await assert.rejects(new SnapshotStore(directory).save(report), /Demo reports/);
    assert.deepEqual(await new SnapshotStore(directory).list(), []);
    const live = snapshot({ input: report.input });
    assert.throws(() => compareReports(live, report), /Demo data/);
    assert.match(toMarkdown(report), /DEMO — synthetic data/);
  } finally { await cleanup(directory); }
});

test('demo API uses no inspector and leaves stored reports untouched', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rumzo-demo-http-'));
  let calls = 0;
  const server = createApp({ store: new SnapshotStore(directory), inspector: async () => { calls++; throw new Error('unexpected inspection'); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await (await fetch(`${base}/api/demo`)).json()).report.demo, true);
    const markdown = await fetch(`${base}/api/demo.md`);
    assert.match(await markdown.text(), /DEMO — synthetic data/);
    assert.equal(calls, 0);
    assert.deepEqual(await (await fetch(`${base}/api/reports`)).json(), []);
    for (const asset of ['avatar.png', 'empty-receipts.png', 'mark.svg', 'receipt.svg', 'compare.svg']) {
      const response = await fetch(`${base}/assets/${asset}`);
      assert.equal(response.status, 200, asset);
      assert.match(response.headers.get('content-type'), /image\//);
    }
    assert.equal((await fetch(`${base}/assets/missing.png`)).status, 404);
    assert.equal((await fetch(`${base}/assets/%2e%2e/package.json`)).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); await cleanup(directory); }
});
