import type { Entry, FileKind } from '../types.js';

export function classifyPath(path: string): FileKind {
  const p = path.toLowerCase();
  if (/(^|\/)(node_modules|vendor|dist|build|coverage|\.next|\.git)(\/|$)/.test(p) || /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|poetry\.lock|cargo\.lock)$/.test(p) || /\.min\.(js|css)$|\.map$|\.generated\./.test(p)) return 'generated';
  if (/\.mdx?$|\.rst$/.test(p) || /(^|\/)licen[cs]e(?:\.[^/]*)?$/.test(p)) return 'docs';
  if (/(^|\/)(__tests__|tests?|spec)(\/|$)/.test(p) || /[._-](test|spec)\.[cm]?[jt]sx?$|(^|\/)test_[^/]+\.py$/.test(p)) return 'tests';
  if (/(^|\/)(package\.json|pyproject\.toml|requirements[^/]*\.txt|cargo\.toml|go\.mod|dockerfile|makefile)$/.test(p) || /\.(json|ya?ml|toml|ini|cfg)$/.test(p) || p.startsWith('.github/')) return 'config';
  if (/\.txt$/.test(p)) return 'docs';
  if (/\.(?:[cm]?[jt]sx?|py|rs|go|sol|java|kt|c|cc|cpp|h|cs|rb|php|swift|vue|svelte|sh|ps1|html|css|scss|sql|ex|exs)$/.test(p)) return 'source';
  return 'other';
}

export function classifyRepository(files: Entry[], complete: boolean): string {
  const source = files.filter(f => f.kind === 'source').length;
  if (source) return 'Source files present';
  if (!complete) return 'Unknown — incomplete file tree';
  if (files.length && files.every(f => f.kind === 'docs' || f.kind === 'config')) return 'Documentation / configuration kit';
  if (!files.length) return 'Empty repository';
  return 'Other files — inspect sources';
}
