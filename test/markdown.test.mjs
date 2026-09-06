import test from 'node:test';
import assert from 'node:assert/strict';
import { sha, snapshot } from './fixtures/context.mjs';
import { toMarkdown } from '../dist/reports/markdown.js';
test('Markdown exports include source limitations and escape markup from upstream metadata', () => {
  const r = snapshot(); r.github.latestCommit = { message: '<script>alert(1)</script> [bad](javascript:evil)', url: 'https://github.com/owner/repo/commit/' + sha };
  const output = toMarkdown(r); assert.equal(output.includes('<script>'), false); assert.ok(output.includes('\\<script\\>')); assert.ok(output.includes('## Coverage and limits'));
});
