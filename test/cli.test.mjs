import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 10000 });

test('CLI help explains local use and exits successfully without provider access', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Show the receipts/);
  assert.match(result.stdout, /--before/);
});

test('CLI rejects malformed arguments and invalid commands before provider access', () => {
  for (const args of [['unknown'], ['serve', '--port', '0'], ['inspect', '--format', 'csv'], ['inspect', '--repo'], ['inspect', '--repo', 'a/b', '--repo', 'c/d'], ['diff']]) {
    const result = run(args);
    assert.equal(result.status, 1, args.join(' '));
    assert.match(result.stderr, /RUMZO:/);
  }
});
