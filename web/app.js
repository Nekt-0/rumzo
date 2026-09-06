const $ = id => document.getElementById(id);
let current = null, saved = [], demo = null;
const el = (tag, text, className) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; };
function link(label, href) { if (current?.demo) return el('span', label); const a = el('a', label); a.href = href; a.target = '_blank'; a.rel = 'noreferrer'; return a; }
function row(label, value, source, mono = false) {
  const r = el('div', undefined, 'data-row'); r.append(el('div', label, 'data-label'));
  const v = el('div', undefined, `data-value${mono ? ' mono' : ''}`);
  v.append(source ? link(String(value), source) : String(value)); r.append(v); return r;
}
function note(text) { return el('p', text, 'note'); }
const time = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? 'Unknown date' : d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC'; };
function message(text) { $('error').hidden = !text; $('error').textContent = text || ''; }
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, signal: options.signal || AbortSignal.timeout(120000) });
  const body = await response.json(); if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`); return body;
}
function fileList(files, repository, sha) {
  const list = el('ul', undefined, 'file-list');
  for (const file of files.slice(0, 30)) {
    const li = el('li'); li.append(el('span', `${file.change || file.kind} ·`));
    const target = `https://github.com/${repository}/blob/${sha}/${file.path.split('/').map(encodeURIComponent).join('/')}`;
    li.append(file.change === 'removed' ? file.path : link(file.path, target)); list.append(li);
  }
  if (files.length > 30) list.append(el('li', `${files.length - 30} more files in the JSON report.`));
  return list;
}
function renderGitHub(g) {
  const root = $('github-result'); root.replaceChildren(); $('github-status').textContent = g.status;
  if (g.error) root.append(note(g.error));
  root.append(row('Repository', g.repository, g.url));
  if (g.classification) root.append(row('Observed contents', g.classification));
  if (g.sha) root.append(row('Pinned revision', g.sha.slice(0, 12), `${g.url}/commit/${g.sha}`, true));
  if (g.counts) {
    root.append(row('File inventory', Object.entries(g.counts).map(([k, v]) => `${v} ${k}`).join(' · ')));
    root.append(note(`${g.treeComplete ? 'Complete returned tree.' : 'Incomplete tree.'} Tests are counted by file path, not run.`));
  }
  if (g.forkOf) root.append(row('Fork of', g.forkOf, `https://github.com/${g.forkOf}`));
  const reference = g.readmeTokenReference;
  root.append(row('CA in root README', !reference || reference.status === 'unknown' ? 'Unverified' : reference.value ? 'Mention found — repository claim' : 'Not found in inspected README', reference?.status === 'known' ? reference.source : undefined));
  for (const hint of g.launchHints || []) root.append(row(hint.path, hint.hint, hint.source));
  if (g.latestCommit) { root.append(row('Latest commit', g.latestCommit.message, g.latestCommit.url)); root.append(note(`${time(g.latestCommit.date)} · ${g.latestCommit.complete ? 'Changed files returned' : 'Partial changed-file list'}`)); root.append(fileList(g.latestCommit.files, g.repository, g.sha)); }
  if (g.recentCommits) root.append(note(`${g.recentCommits.length} recent commits sampled. This is not the repository’s total commit count.`));
}
const fieldLabels = {
  name: 'Token name', symbol: 'Symbol', protocol: 'Protocol', phase: 'Launch stage', launchedAt: 'Launch time',
  feeRecipient: 'Fee recipient', deployer: 'Deployer', creatorTaxBps: 'Additional creator tax', curveFeeBps: 'Base curve fee', hookFeeBps: 'Pool hook fee',
  protocolFeeShareBps: 'Protocol share of base fee', buybackEnabled: 'Built-in buyback', isLocked: 'Pons locker flag',
  factorySnipeTaxStartBps: 'Factory opening-tax setting', factorySnipeTaxSeconds: 'Factory opening-tax period'
};
function displayFact(key, fact) {
  if (!fact || fact.status !== 'known') return 'Unknown';
  const value = fact.value;
  if (key.endsWith('Bps')) return `${Number(value) / 100}%`;
  if (key === 'factorySnipeTaxSeconds') return `${value} seconds`;
  if (key === 'phase') return ({ 0: 'Curve', 1: 'Awaiting sweep', 2: 'Pool created' })[value] || `Phase ${value}`;
  if (key === 'launchedAt') return time(value);
  if (key === 'buybackEnabled') return value ? 'Enabled' : 'Disabled';
  if (key === 'isLocked') return value ? 'true' : 'false';
  return String(value);
}
function renderChain(c) {
  const root = $('chain-result'); root.replaceChildren(); $('chain-status').textContent = c.status;
  if (c.error) root.append(note(c.error));
  root.append(row('Contract', c.token, `https://robinhoodchain.blockscout.com/token/${c.token}`, true));
  if (c.blockNumber) root.append(row('Read at block', c.blockNumber, `https://robinhoodchain.blockscout.com/block/${c.blockNumber}`, true));
  if (c.blockTime) root.append(note(time(c.blockTime)));
  for (const [key, label] of Object.entries(fieldLabels)) {
    if (!c.fields[key]) continue;
    const fact = c.fields[key]; root.append(row(label, displayFact(key, fact), fact.status === 'known' ? fact.source : undefined, key === 'feeRecipient' || key === 'deployer'));
  }
  root.append(note('Settings are observations, not an execution quote. Contract links show current explorer pages; this receipt preserves the read block.'));
}
function renderComparison(comparison) {
  const root = $('comparison'); root.replaceChildren();
  if (current?.demo) root.append(el('p', 'DEMO · SYNTHETIC DATA', 'eyebrow demo-comparison-label'));
  if (!comparison) { root.append(el('p', current?.demo ? 'Choose the demo baseline above to view the sample changes.' : 'Save another snapshot of this project to see what changed. Scans run only when you request them.', 'muted')); return; }
  root.append(el('p', `${time(comparison.from)} → ${time(comparison.to)}`, 'muted'));
  if (comparison.code.status === 'unknown') root.append(el('p', comparison.code.reason, 'change-summary'));
  else {
    const counts = comparison.code.counts;
    const summary = el('p', undefined, 'change-summary'); summary.append(el('strong', `${counts.source} source · ${counts.tests} test · ${counts.docs} documentation files changed`)); root.append(summary);
    root.append(el('p', `${counts.config} configuration · ${counts.generated} generated/dependency · ${counts.other} other. Coverage: ${comparison.code.status}.`, 'muted'));
    if (!comparison.code.changed.length) root.append(el('p', comparison.code.status === 'complete' ? 'No file changes between these snapshots.' : 'No changes established within the available file coverage.', 'muted'));
    else root.append(fileList(comparison.code.changed, current.github.repository, current.github.sha));
  }
  for (const change of comparison.chain) root.append(el('p', `${fieldLabels[change.field] || change.field}: ${displayFact(change.field, change.before)} → ${displayFact(change.field, change.after)}`));
  if (!comparison.chain.length) root.append(el('p', 'No value changes established for contract fields known in both snapshots.', 'muted'));
  for (const warning of comparison.warnings) root.append(el('p', warning, 'muted'));
}
function renderBaseline() {
  const select = $('baseline'); const previous = select.value;
  const restore = () => { if ([...select.options].some(option => option.value === previous)) select.value = previous; };
  select.replaceChildren(el('option', 'Choose a saved snapshot')); select.firstChild.value = '';
  if (!current) return;
  if (current.demo && demo) { const option = el('option', time(demo.before.createdAt) + ' · demo baseline'); option.value = demo.before.id; select.append(option); restore(); return; }
  for (const r of saved.filter(r => r.id !== current.id && r.createdAt <= current.createdAt && r.input.token.toLowerCase() === current.input.token.toLowerCase() && r.input.repository.toLowerCase() === current.input.repository.toLowerCase())) {
    const option = el('option', time(r.createdAt)); option.value = r.id; select.append(option);
  }
  restore();
}
function renderReport(report, comparison = null) {
  current = report; $('results').hidden = false; $('demo-notice').hidden = !report.demo;
  $('result-name').textContent = report.github.repository;
  $('result-date').textContent = `Observed ${time(report.createdAt)} · ${report.id.slice(0, 8)}`;
  $('export-md').href = report.demo ? '/api/demo.md' : `/api/reports/${report.id}.md`;
  renderGitHub(report.github); renderChain(report.chain); renderComparison(comparison); renderBaseline();
  if (comparison) $('baseline').value = comparison.before;
  $('limits').replaceChildren(...[...report.github.warnings, ...report.chain.warnings, ...report.limitations].map(w => el('li', w)));
}
async function refreshHistory() {
  saved = await api('/api/reports'); const root = $('history-list'); root.replaceChildren();
  if (!saved.length) { const empty = el('div', undefined, 'empty-history'); const image = el('img'); image.src = '/assets/empty-receipts.png'; image.alt = ''; image.width = 92; image.height = 92; empty.append(image, el('p', 'No receipts yet. Start an inspection or explore the demo.', 'muted')); root.append(empty); }
  for (const r of saved.slice(0, 12)) {
    const container = el('div', undefined, 'history-row'); const text = el('div'); text.append(el('p', r.input.repository), el('small', `${time(r.createdAt)} · GitHub ${r.github} / chain ${r.chain}`));
    const button = el('button', 'Open'); button.type = 'button'; button.addEventListener('click', async () => { try { message(''); renderReport(await api(`/api/reports/${r.id}`)); } catch(e) { message(e.message); } }); container.append(text, button); root.append(container);
  }
  renderBaseline();
}
$('demo-button').addEventListener('click', async () => { try { message(''); demo = await api('/api/demo'); renderReport(demo.report, demo.comparison); $('status').textContent = 'Demo loaded. All displayed values are synthetic; your saved receipts are unchanged.'; $('results').scrollIntoView({ behavior: 'instant', block: 'start' }); } catch (error) { message(error.message); } });
$('inspect-form').addEventListener('submit', async event => {
  event.preventDefault(); message(''); const button = $('scan-button'); button.disabled = true; button.textContent = 'Reading sources…'; $('status').textContent = 'Reading GitHub and Robinhood Chain. A scan can take up to a minute.';
  try {
    const { report, comparison } = await api('/api/inspect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: $('token').value, repository: $('repository').value }) });
    await refreshHistory(); renderReport(report, comparison);
    $('status').textContent = report.github.status === 'ok' && report.chain.status === 'ok' ? 'Receipt saved. Every finding has its source.' : 'Receipt saved with coverage limits. Check the source statuses below.';
  } catch (error) { message(error.name === 'TimeoutError' ? 'The scan timed out. Refresh saved receipts before retrying; it may still complete on the server.' : error.message); $('status').textContent = ''; }
  finally { button.disabled = false; button.textContent = 'Get receipts ↗'; }
});
$('baseline').addEventListener('change', async () => { try { message(''); const id = $('baseline').value; renderComparison(id ? current.demo ? demo.comparison : await api(`/api/compare?before=${id}&after=${current.id}`) : null); } catch(e) { message(e.message); } });
$('export-json').addEventListener('click', () => { if (!current) return; const url = URL.createObjectURL(new Blob([JSON.stringify(current, null, 2) + '\n'], { type: 'application/json' })); const a = el('a'); a.href = url; a.download = `rumzo-${current.id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
$('refresh-history').addEventListener('click', () => refreshHistory().catch(e => message(e.message)));
refreshHistory().catch(e => message(e.message));
