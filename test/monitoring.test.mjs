import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { snapshot, token, known, cleanup } from './fixtures/context.mjs';
import { SnapshotStore } from '../dist/storage/snapshots.js';
import { MonitoringStore } from '../dist/monitoring/store.js';
import { MonitoringService, validateInterval } from '../dist/monitoring/service.js';
import { TelegramNotifier } from '../dist/monitoring/telegram.js';

test('monitoring persists watches, compares scheduled receipts, and sends change alerts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rumzo-monitor-'));
  let now = new Date('2026-09-09T10:00:00.000Z');
  let reads = 0;
  const telegram = [];
  const notifier = new TelegramNotifier({ token: 'test-token', chatId: 'test-chat', fetcher: async (url, options) => {
    telegram.push({ url, body: JSON.parse(options.body) });
    return new Response('{}', { status: 200 });
  } });
  const inspector = async input => {
    reads++;
    const report = snapshot({ createdAt: new Date(now.getTime() + reads).toISOString(), input });
    report.github.files = [{ path: 'src/index.ts', kind: 'source', sha: reads === 1 ? 'a' : 'b' }];
    report.chain.fields.creatorTaxBps = known(reads === 1 ? 100 : 200);
    return report;
  };
  const store = new MonitoringStore(directory);
  const service = new MonitoringService({ store, snapshots: new SnapshotStore(directory), inspector, notifier, now: () => now });
  try {
    const watch = await service.add({ token, repository: 'owner/repo' }, 5);
    const baseline = await service.run(watch.id);
    assert.equal(baseline.type, 'baseline');
    assert.equal(telegram.length, 0);
    assert.equal((await store.listWatches())[0].lastReportId, baseline.reportId);

    now = new Date('2026-09-09T10:05:00.000Z');
    const [changed] = await service.runDue();
    assert.equal(changed.type, 'code-and-contract-change');
    assert.equal(changed.comparison.code.counts.source, 1);
    assert.equal(changed.comparison.chain.length, 1);
    assert.equal(telegram.length, 1);
    assert.equal(telegram[0].body.chat_id, 'test-chat');
    assert.match(telegram[0].body.text, /OWNER\/REPO/i);

    assert.equal((await store.listEvents(watch.id)).length, 2);
    await service.setEnabled(watch.id, false);
    now = new Date('2026-09-09T11:00:00.000Z');
    assert.deepEqual(await service.runDue(), []);
    await service.remove(watch.id);
    assert.deepEqual(await store.listWatches(), []);
  } finally { await cleanup(directory); }
});

test('monitoring validates the finite schedule set', () => {
  assert.equal(validateInterval('15'), 15);
  for (const value of [0, 10, 61, 'soon']) assert.throws(() => validateInterval(value), /Interval/);
});
