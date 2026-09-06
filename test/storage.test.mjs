import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { snapshot, cleanup } from './fixtures/context.mjs';
import { SnapshotStore } from '../dist/storage/snapshots.js';
test('local storage roundtrips reports and rejects traversal IDs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rumzo-store-')); const store = new SnapshotStore(directory);
  try { const r = snapshot(); await store.save(r); assert.deepEqual(await store.get(r.id), r); assert.equal((await store.list()).length, 1); await assert.rejects(store.get('../secrets'), /Invalid/); await writeFile(join(directory, `${randomUUID()}.json`), '{broken'); assert.equal((await store.list()).length, 1); }
  finally { await cleanup(directory); }
});
