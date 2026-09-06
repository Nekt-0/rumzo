import test from 'node:test';
import assert from 'node:assert/strict';
import { token } from './fixtures/context.mjs';
import { parseRepository, validateInput } from '../dist/input.js';
test('input parser accepts repository paths and rejects alternate hosts, credentials and traversal', () => {
  assert.equal(parseRepository('https://github.com/sample/receipt-lab.git').fullName, 'sample/receipt-lab');
  assert.equal(parseRepository('sample/-receipt-lab').repo, '-receipt-lab');
  for (const bad of ['https://evil.test/owner/repo', 'https://github.com.evil.test/a/b', 'https://me:secret@github.com/a/b', 'http://127.0.0.1/a/b', 'owner/..', '../repo', 'owner/repo/tree/main', 'https://github.com/a/b?token=secret', 'owner/%2e%2e']) assert.throws(() => parseRepository(bad), bad);
  assert.throws(() => validateInput({ repository: 'a/b', token: '0x1234' }));
});
