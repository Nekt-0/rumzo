import { randomUUID } from 'node:crypto';
import { validateInput } from '../input.js';
import { inspectGitHub } from '../github/inspect.js';
import { inspectChain } from '../chain/inspect.js';
import type { Report } from '../types.js';

export async function inspect(input: unknown): Promise<Report> {
  const normalized = validateInput(input);
  const [github, chain] = await Promise.all([inspectGitHub(normalized.repository, normalized.token), inspectChain(normalized.token)]);
  return { schemaVersion: 1, id: randomUUID(), createdAt: new Date().toISOString(), input: normalized, github, chain, limitations: [
    'Read-only evidence snapshot, not a security audit or a buy/sell recommendation.',
    'Repository files are inspected as data. No repository code, installation scripts, agents or tests are executed.',
    'No ownership verification, profit score, fee-income attribution or automatic buyback tracking in v0.1.',
    'Git dates can be imported or rewritten. Snapshot observation time is separate from commit time.',
    'Local snapshots cover explicit scans only; there is no background monitoring.'
  ] };
}
