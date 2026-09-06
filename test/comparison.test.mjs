import test from 'node:test';
import assert from 'node:assert/strict';
import { token, sha, snapshot, known } from './fixtures/context.mjs';
import { compareReports } from '../dist/reports/compare.js';
test('complete snapshots establish additions, removals, and executable-mode changes', () => {
  const before = snapshot(), after = snapshot({ createdAt: '2026-09-06T11:00:00.000Z' });
  before.github.files = [{ path: 'src/run.sh', kind: 'source', sha: 'a', mode: '100644' }, { path: 'old.md', kind: 'docs', sha: 'b' }];
  after.github.files = [{ path: 'src/run.sh', kind: 'source', sha: 'a', mode: '100755' }, { path: 'test/new.test.ts', kind: 'tests', sha: 'c' }];
  assert.deepEqual(compareReports(before, after).code.changed.map(f => [f.path, f.change]), [['src/run.sh', 'modified'], ['test/new.test.ts', 'added'], ['old.md', 'removed']]);
});

test('comparison rejects reverse chronology and unsupported report versions', () => {
  const before = snapshot(), after = snapshot({ createdAt: '2026-09-06T09:00:00.000Z' });
  assert.throws(() => compareReports(before, after), /baseline must be older/);
  before.schemaVersion = 99;
  assert.throws(() => compareReports(before, after), /Unsupported/);
});

test('snapshot comparison separates docs and code and does not promote unknown on-chain data to a change', () => {
  const before = snapshot(), after = snapshot({ createdAt: '2026-09-06T11:00:00.000Z' });
  before.github.files = [{ path: 'README.md', sha: 'a', kind: 'docs' }, { path: 'src/app.ts', sha: 'a', kind: 'source' }];
  after.github.files = [{ path: 'README.md', sha: 'b', kind: 'docs' }, { path: 'src/app.ts', sha: 'a', kind: 'source' }];
  before.chain.fields.creatorTaxBps = { status: 'unknown', reason: 'RPC unavailable' }; after.chain.fields.creatorTaxBps = known(0);
  before.chain.fields.buybackEnabled = known(false); after.chain.fields.buybackEnabled = known(true);
  const diff = compareReports(before, after);
  assert.equal(diff.code.counts.docs, 1); assert.equal(diff.code.counts.source, 0); assert.equal(diff.chain.length, 1); assert.equal(diff.chain[0].field, 'buybackEnabled'); assert.equal(diff.warnings.length, 1);
});


test('truncated trees do not fabricate deletions or additions from unobserved files', () => {
  const before = snapshot(), after = snapshot({ createdAt: '2026-09-06T11:00:00.000Z' });
  before.github.treeComplete = false; after.github.treeComplete = false;
  before.github.files = [{ path: 'src/a.ts', sha: 'a', kind: 'source' }]; after.github.files = [{ path: 'src/b.ts', sha: 'b', kind: 'source' }];
  const diff = compareReports(before, after); assert.equal(diff.code.status, 'partial'); assert.equal(diff.code.changed.length, 0);
});


test('unavailable GitHub data cannot be compared as an empty tree', () => {
  const before = snapshot(), after = snapshot(); before.github.status = 'unavailable';
  assert.equal(compareReports(before, after).code.status, 'unknown');
  after.input = { token, repository: 'different/repo' }; assert.throws(() => compareReports(before, after), /same token/);
});
