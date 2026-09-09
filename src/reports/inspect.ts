import { validateInput } from '../input.js';
import { inspectGitHub } from '../github/inspect.js';
import { GitHubClient } from '../github/client.js';
import { inspectChain } from '../chain/inspect.js';
import { createChainClient } from '../chain/client.js';
import type { Report } from '../types.js';

export type InspectOptions = { githubToken?: string; rpcUrl?: string };

export async function inspect(input: unknown, options: InspectOptions = {}): Promise<Report> {
  const normalized = validateInput(input);
  const githubToken = options.githubToken ?? (typeof process !== 'undefined' ? process.env.GITHUB_TOKEN : undefined);
  const rpcUrl = options.rpcUrl ?? (typeof process !== 'undefined' ? process.env.RUMZO_RPC_URL : undefined);
  const [github, chain] = await Promise.all([
    inspectGitHub(normalized.repository, normalized.token, new GitHubClient(githubToken)),
    inspectChain(normalized.token, createChainClient(rpcUrl))
  ]);
  return { schemaVersion: 1, id: crypto.randomUUID(), createdAt: new Date().toISOString(), input: normalized, github, chain, limitations: [
    'Read-only evidence snapshot, not a security audit or a buy/sell recommendation.',
    'Repository files are inspected as data. No repository code, installation scripts, agents or tests are executed.',
    'No ownership verification, profit score, fee-income attribution or automatic buyback tracking.',
    'Git dates can be imported or rewritten. Snapshot observation time is separate from commit time.',
    'Browser schedules run while the page is open. Unattended monitoring requires the local v0.3 monitor runner.'
  ] };
}
