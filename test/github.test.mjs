import test from 'node:test';
import assert from 'node:assert/strict';
import { token, sha, githubFixture } from './fixtures/context.mjs';
import { inspectGitHub } from '../dist/github/inspect.js';
test('GitHub inspection pins files and README to a commit and identifies a documentation kit', async () => {
  const fixture = githubFixture(); const report = await inspectGitHub('owner/repo', token, fixture.client);
  assert.equal(report.status, 'ok'); assert.equal(report.sha, sha); assert.equal(report.counts.docs, 2);
  assert.equal(report.classification, 'Documentation / configuration kit'); assert.equal(report.readmeTokenReference.value, true);
  assert.ok(report.readmeTokenReference.source.includes(sha)); assert.equal(report.recentCommits.length, 1);
});


test('incomplete GitHub tree and failed README read do not produce confident absence claims', async () => {
  const report = await inspectGitHub('owner/repo', token, githubFixture({ truncated: true, failReadme: true }).client);
  assert.equal(report.status, 'partial'); assert.equal(report.treeComplete, false);
  assert.match(report.classification, /Unknown/); assert.equal(report.readmeTokenReference.status, 'unknown');
});


test('GitHub client refuses private repository contents', async () => {
  const fixture = githubFixture({ privateRepo: true }); const report = await inspectGitHub('owner/repo', token, fixture.client);
  assert.equal(report.status, 'unavailable'); assert.equal(fixture.requests.length, 1);
});
