import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, basename, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { GitHubClient } from '../../dist/github/client.js';

const token = '0x1111111111111111111111111111111111111111';
const sha = 'a'.repeat(40);
function snapshot(overrides = {}) {
  return { schemaVersion: 1, id: randomUUID(), createdAt: '2026-09-06T10:00:00.000Z', input: { token, repository: 'owner/repo' },
    github: { status: 'ok', repository: 'owner/repo', url: 'https://github.com/owner/repo', observedAt: '2026-09-06T10:00:00.000Z', sha, treeComplete: true, files: [], warnings: [] },
    chain: { status: 'ok', chainId: 4663, token, factory: '0x123', observedAt: '2026-09-06T10:00:00.000Z', fields: {}, warnings: [] }, limitations: [], ...overrides };
}
const known = value => ({ status: 'known', value, source: 'https://example.com/evidence' });
async function cleanup(directory) {
  if (dirname(resolve(directory)) !== resolve(tmpdir()) || !basename(directory).startsWith('rumzo-')) throw new Error('Refusing cleanup outside the test temporary directory.');
  await rm(directory, { recursive: true, force: true });
}

function githubFixture({ truncated = false, failReadme = false, privateRepo = false } = {}) {
  const requests = [];
  const data = {
    '/repos/owner/repo': { private: privateRepo, default_branch: 'main', description: 'Test', size: 12 },
    '/repos/owner/repo/commits/main?per_page=100': { sha, commit: { message: 'Add instructions', committer: { date: '2026-09-06T09:00:00Z' } }, files: [{ filename: 'README.md', status: 'modified' }] },
    [`/repos/owner/repo/git/trees/${sha}?recursive=1`]: { truncated, tree: [{ path: 'README.md', type: 'blob', sha: 'b'.repeat(40), size: 100, mode: '100644' }, { path: 'LICENSE', type: 'blob', sha: 'c'.repeat(40), size: 50 }] },
    [`/repos/owner/repo/commits?sha=${sha}&per_page=20`]: [{ sha, commit: { message: 'Add instructions', committer: { date: '2026-09-06T09:00:00Z' } } }],
    [`/repos/owner/repo/git/blobs/${'b'.repeat(40)}`]: { encoding: 'base64', content: Buffer.from(`Token: ${token}`).toString('base64') }
  };
  return { requests, client: new GitHubClient('test-secret', async (url, options) => {
    assert.equal(new URL(url).origin, 'https://api.github.com'); assert.equal(options.redirect, 'manual'); requests.push(url);
    const path = new URL(url).pathname + new URL(url).search;
    if (failReadme && path.includes('/git/blobs/')) return new Response('{}', { status: 429 });
    assert.ok(path in data, path); return new Response(JSON.stringify(data[path]), { status: 200 });
  }) };
}


export { token, sha, snapshot, known, cleanup, githubFixture };
