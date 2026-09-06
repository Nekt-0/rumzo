import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { token, snapshot, cleanup } from './fixtures/context.mjs';
import { SnapshotStore } from '../dist/storage/snapshots.js';
import { createApp } from '../dist/server/app.js';
test('local HTTP flow scans, saves, exports, compares and rejects cross-origin or invalid requests', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rumzo-http-')); let inspections = 0;
  const server = createApp({ store: new SnapshotStore(directory), inspector: async input => { inspections++; return snapshot({ input, createdAt: `2026-09-06T10:00:0${inspections}.000Z` }); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body, headers = {}) => fetch(`${base}/api/inspect`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try {
    const denied = await post({ token, repository: 'owner/repo' }, { Origin: 'https://evil.test' }); assert.equal(denied.status, 403);
    assert.equal((await post({ token: '0x0', repository: 'owner/repo' })).status, 400); assert.equal(inspections, 0);
    const first = await (await post({ token, repository: 'owner/repo' })).json(); assert.equal(first.comparison, null);
    const second = await (await post({ token, repository: 'owner/repo' })).json(); assert.equal(second.comparison.before, first.report.id);
    const list = await (await fetch(`${base}/api/reports`)).json(); assert.equal(list.length, 2);
    const markdown = await fetch(`${base}/api/reports/${first.report.id}.md`); assert.match(markdown.headers.get('content-type'), /markdown/); assert.match(await markdown.text(), /RUMZO/);
    const home = await fetch(base); assert.equal(home.status, 200); assert.match(home.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    const badHost = await new Promise((resolve, reject) => { const req = request(`${base}/api/health`, { headers: { Host: 'evil.test' } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); req.end(); }); assert.equal(badHost, 403);
  } finally { await new Promise(resolve => server.close(resolve)); await cleanup(directory); }
});
