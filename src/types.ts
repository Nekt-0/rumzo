export type FileKind = 'source' | 'tests' | 'docs' | 'config' | 'generated' | 'other';
export type Fact<T> = { status: 'known'; value: T; source: string } | { status: 'unknown'; reason: string };
export type Entry = { path: string; sha: string; kind: FileKind; size?: number; mode?: string };
export type Counts = Record<FileKind, number>;
export type GitHubSnapshot = {
  status: 'ok' | 'partial' | 'unavailable';
  repository: string; url: string; observedAt: string;
  error?: string; sha?: string; defaultBranch?: string; description?: string;
  forkOf?: string; archived?: boolean; license?: string;
  classification?: string; counts?: Counts; files?: Entry[]; treeComplete?: boolean;
  launchHints?: { path: string; hint: string; source: string }[];
  latestCommit?: { message: string; date: string; url: string; files: { path: string; kind: FileKind; change: string }[]; complete: boolean };
  recentCommits?: { sha: string; message: string; date: string; url: string }[];
  readmeTokenReference?: Fact<boolean>;
  warnings: string[];
};
export type ChainSnapshot = {
  status: 'ok' | 'partial' | 'unsupported' | 'unavailable';
  chainId: 4663; token: string; observedAt: string; factory: string;
  blockNumber?: string; blockTime?: string; error?: string;
  fields: Record<string, Fact<string | number | boolean>>;
  warnings: string[];
};
export type Report = {
  schemaVersion: 1; id: string; createdAt: string;
  demo?: true;
  input: { token: string; repository: string };
  github: GitHubSnapshot; chain: ChainSnapshot;
  limitations: string[];
};
export type Comparison = {
  demo?: true;
  before: string; after: string; from: string; to: string;
  code: { status: 'complete' | 'partial' | 'unknown'; changed: { path: string; kind: FileKind; change: 'added' | 'modified' | 'removed' }[]; counts: Counts; reason?: string };
  chain: { field: string; before: Fact<string | number | boolean>; after: Fact<string | number | boolean> }[];
  warnings: string[];
};
export const emptyCounts = (): Counts => ({ source: 0, tests: 0, docs: 0, config: 0, generated: 0, other: 0 });
