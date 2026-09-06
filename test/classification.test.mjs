import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPath, classifyRepository } from '../dist/github/classify.js';
test('file inventory distinguishes dependency files, test files and documentation', () => {
  assert.equal(classifyPath('src/engine.ts'), 'source');
  assert.equal(classifyPath('test/engine.test.ts'), 'tests');
  assert.equal(classifyPath('tests/README.md'), 'docs');
  assert.equal(classifyPath('pnpm-lock.yaml'), 'generated');
  assert.equal(classifyPath('node_modules/widget/index.js'), 'generated');
  assert.equal(classifyPath('requirements.txt'), 'config');
  assert.equal(classifyRepository([{ path: 'README.md', kind: 'docs' }], true), 'Documentation / configuration kit');
  assert.match(classifyRepository([{ path: 'README.md', kind: 'docs' }], false), /Unknown/);
});
