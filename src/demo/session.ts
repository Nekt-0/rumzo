import { emptyCounts, type Report, type Entry, type Fact } from '../types.js';
import { compareReports } from '../reports/compare.js';

const token = '0x1111111111111111111111111111111111111111';
const repository = 'demo/receipt-lab';
const source = 'https://example.invalid/rumzo-demo';
const known = (value: string | number | boolean): Fact<string | number | boolean> => ({ status: 'known', value, source });

/** Reproducible, synthetic product tour. Never contacts providers or writes to snapshot storage. */
export function demoSession() {
  const file = (path: string, kind: Entry['kind'], revision = 'a'): Entry => ({ path, kind, sha: revision.repeat(40), mode: '100644' });
  const before: Report = {
    schemaVersion: 1, demo: true, id: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-09-06T09:00:00.000Z', input: { token, repository },
    github: {
      status: 'ok', repository, url: source, observedAt: '2026-09-06T09:00:00.000Z', sha: 'a'.repeat(40),
      defaultBranch: 'main', classification: 'Source files present', treeComplete: true,
      files: [file('src/inspect.ts', 'source'), file('src/receipts.ts', 'source'), file('test/receipts.test.ts', 'tests'), file('README.md', 'docs'), file('package.json', 'config')],
      counts: emptyCounts(), readmeTokenReference: { status: 'known', value: true, source },
      launchHints: [{ path: 'package.json', hint: 'Declared scripts: build, test, start. Not executed.', source }],
      latestCommit: { message: 'Add receipt export', date: '2026-09-06T08:45:00.000Z', url: source, files: [{ path: 'src/receipts.ts', kind: 'source', change: 'added' }], complete: true },
      warnings: ['Synthetic repository and revisions, provided only to demonstrate the interface.']
    },
    chain: {
      status: 'ok', chainId: 4663, token, factory: token, observedAt: '2026-09-06T09:00:00.000Z',
      blockNumber: '100000', blockTime: '2026-09-06T09:00:00.000Z',
      fields: { name: known('Demo asset'), symbol: known('DEMO'), protocol: known('pons v2'), phase: known(0), creatorTaxBps: known(100), curveFeeBps: known(100), hookFeeBps: known(100), buybackEnabled: known(false), isLocked: known(false) },
      warnings: ['All contract values, addresses and block numbers in this tour are invented.']
    },
    limitations: ['DEMO — synthetic data. Not a live inspection, deployed token, or investment claim.']
  };
  for (const entry of before.github.files!) before.github.counts![entry.kind]++;
  const report = structuredClone(before);
  report.id = '22222222-2222-4222-8222-222222222222';
  report.createdAt = report.github.observedAt = report.chain.observedAt = '2026-09-06T11:00:00.000Z';
  report.chain.blockNumber = '100120'; report.chain.blockTime = report.createdAt;
  report.github.sha = 'b'.repeat(40);
  report.github.files = [file('src/inspect.ts', 'source'), file('src/receipts.ts', 'source', 'b'), file('src/compare.ts', 'source', 'b'), file('test/receipts.test.ts', 'tests', 'b'), file('README.md', 'docs', 'b'), file('package.json', 'config')];
  report.github.counts = emptyCounts();
  for (const entry of report.github.files) report.github.counts[entry.kind]++;
  report.github.latestCommit = { message: 'Add snapshot comparison and regression coverage', date: '2026-09-06T10:45:00.000Z', url: source, files: [{ path: 'src/compare.ts', kind: 'source', change: 'added' }, { path: 'test/receipts.test.ts', kind: 'tests', change: 'modified' }], complete: true };
  report.chain.fields.creatorTaxBps = known(50);
  return { before, report, comparison: compareReports(before, report) };
}
