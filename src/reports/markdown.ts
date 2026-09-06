import type { Report, Fact } from '../types.js';

const escapeMd = (value: unknown) => String(value ?? '').replace(/[\\`*_{}\[\]<>|]/g, '\\$&').replace(/[\r\n]+/g, ' ');
export const factText = (fact?: Fact<string | number | boolean>) => !fact ? 'Unknown' : fact.status === 'known' ? String(fact.value) : `Unknown: ${fact.reason}`;
export function toMarkdown(report: Report): string {
  const g = report.github, c = report.chain;
  const lines = ['# RUMZO — builder receipts', '', `Observed: ${report.createdAt}`, `Snapshot: ${report.id}`, '', `Token: \`${report.input.token}\``, `Repository: ${g.url}`, '', '## GitHub', '', `Status: ${g.status}`, `Revision: ${g.sha || 'Unknown'}`, `Classification: ${g.classification || 'Unknown'}`, ''];
  if (g.error) lines.push(escapeMd(g.error), '');
  if (report.demo) lines.splice(2, 0, '> DEMO — synthetic data. No live inspection was performed.', '');
  if (g.counts) for (const [kind, count] of Object.entries(g.counts)) lines.push(`- ${kind}: ${count} observed files`);
  lines.push('', `README token reference: ${escapeMd(factText(g.readmeTokenReference))}`, '');
  for (const hint of g.launchHints || []) lines.push(`- [${escapeMd(hint.path)}](${hint.source}): ${escapeMd(hint.hint)}`);
  if (g.latestCommit) lines.push('', `Latest commit: ${escapeMd(g.latestCommit.message)}`, g.latestCommit.url);
  lines.push('', '## Robinhood Chain / pons v2', '', `Status: ${c.status}`, `Block: ${c.blockNumber || 'Unknown'}`, `Block time: ${c.blockTime || 'Unknown'}`, '');
  if (c.error) lines.push(escapeMd(c.error), '');
  for (const [field, fact] of Object.entries(c.fields)) lines.push(`- **${field}**: ${escapeMd(factText(fact))}${fact.status === 'known' ? ` ([source](${fact.source}))` : ''}`);
  lines.push('', '## Coverage and limits', '', ...[...g.warnings, ...c.warnings, ...report.limitations].map(w => `- ${escapeMd(w)}`));
  return lines.join('\n') + '\n';
}
