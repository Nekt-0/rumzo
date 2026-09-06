import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubClient } from '../dist/github/client.js';

test('GitHub rate limits and missing resources produce actionable messages', async () => {
  for (const status of [403, 429, 404, 502]) {
    const client = new GitHubClient(undefined, async () => new Response('{}', { status }));
    await assert.rejects(client.get('/repos/demo/receipt-lab'), status === 404 ? /not found/ : status === 502 ? /502/ : /rate limit/);
  }
});

test('GitHub client refuses oversized responses before parsing their contents', async () => {
  const client = new GitHubClient(undefined, async () => new Response('x'.repeat(10 * 1024 * 1024 + 1)));
  await assert.rejects(client.get('/repos/demo/receipt-lab'), /10 MB/);
});

test('GitHub transport refuses redirects and malformed JSON', async () => {
  const client = new GitHubClient('test-credential', async (url, options) => {
    assert.equal(new URL(url).hostname, 'api.github.com');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer test-credential');
    return new Response('{incomplete');
  });
  await assert.rejects(client.get('/repos/demo/receipt-lab'), SyntaxError);
});
