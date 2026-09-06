import { emptyCounts, type Report, type Comparison } from '../types.js';

export function compareReports(before: Report, after: Report): Comparison {
  if (before.schemaVersion !== 1 || after.schemaVersion !== 1) throw new Error('Unsupported report schema.');
  if (Boolean(before.demo) !== Boolean(after.demo)) throw new Error('Demo data cannot be compared with live evidence.');
  if (before.input.token.toLowerCase() !== after.input.token.toLowerCase() || before.input.repository.toLowerCase() !== after.input.repository.toLowerCase()) throw new Error('Compare snapshots of the same token and repository.');
  if (before.createdAt > after.createdAt) throw new Error('The baseline must be older than the new snapshot.');
  const out: Comparison = { before: before.id, after: after.id, from: before.createdAt, to: after.createdAt, code: { status: 'unknown', changed: [], counts: emptyCounts() }, chain: [], warnings: [] };
  if (before.demo && after.demo) out.demo = true;
  if (before.github.status === 'unavailable' || after.github.status === 'unavailable' || !before.github.files || !after.github.files) out.code.reason = 'Both snapshots need readable file trees. Missing data is not an empty repository.';
  else {
    const complete = Boolean(before.github.treeComplete && after.github.treeComplete);
    out.code.status = complete ? 'complete' : 'partial';
    const old = new Map(before.github.files.map(f => [f.path, f]));
    const current = new Map(after.github.files.map(f => [f.path, f]));
    for (const [path, file] of current) {
      const prior = old.get(path);
      if (prior && (prior.sha !== file.sha || prior.mode !== file.mode)) out.code.changed.push({ path, kind: file.kind, change: 'modified' });
      else if (!prior && before.github.treeComplete) out.code.changed.push({ path, kind: file.kind, change: 'added' });
    }
    if (after.github.treeComplete) for (const [path, file] of old) if (!current.has(path)) out.code.changed.push({ path, kind: file.kind, change: 'removed' });
    for (const file of out.code.changed) out.code.counts[file.kind]++;
    if (!complete) out.warnings.push('Incomplete trees: additions/removals are reported only when the corresponding absence is established by a complete tree.');
  }
  for (const field of new Set([...Object.keys(before.chain.fields), ...Object.keys(after.chain.fields)])) {
    const a = before.chain.fields[field] || { status: 'unknown' as const, reason: 'Not available in baseline.' };
    const b = after.chain.fields[field] || { status: 'unknown' as const, reason: 'Not available in current snapshot.' };
    if (a.status !== 'known' || b.status !== 'known') { if (a.status !== b.status) out.warnings.push(`${field}: data availability changed; this is not proof of an on-chain value change.`); continue; }
    if (a.value !== b.value) out.chain.push({ field, before: a, after: b });
  }
  return out;
}
