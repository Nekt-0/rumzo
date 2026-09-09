const $ = id => document.getElementById(id);
let current = null, saved = [], demo = null, watches = [], alerts = [];
const STORAGE_KEY = 'rumzo-receipts-v1';
const WATCH_KEY = 'rumzo-watchlist-v1';
const ALERT_KEY = 'rumzo-monitor-events-v1';
const monitoring = new Set();
const el = (tag, text, className) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; };
function link(label, href) { if (current?.demo) return el('span', label); const a = el('a', label); a.href = href; a.target = '_blank'; a.rel = 'noreferrer'; return a; }
function row(label, value, source, mono = false) {
  const r = el('div', undefined, 'data-row'); r.append(el('div', label, 'data-label'));
  const v = el('div', undefined, `data-value${mono ? ' mono' : ''}`);
  v.append(source ? link(String(value), source) : String(value)); r.append(v); return r;
}
function note(text) { return el('p', text, 'note'); }
const time = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? 'Unknown date' : d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC'; };
const emptyCounts = () => ({ source: 0, tests: 0, docs: 0, config: 0, generated: 0, other: 0 });
function loadReports() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter(report => report?.schemaVersion === 1 && !report.demo).slice(0, 12) : [];
  } catch { return []; }
}
function saveReport(report) {
  const reports = [report, ...loadReports().filter(item => item.id !== report.id)].slice(0, 12);
  while (reports.length) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(reports)); saved = reports; return true; }
    catch { reports.pop(); }
  }
  return false;
}
function loadArray(key, limit) {
  try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value.slice(0, limit) : []; }
  catch { return []; }
}
function saveArray(key, value, limit) {
  const copy = value.slice(0, limit);
  while (copy.length) {
    try { localStorage.setItem(key, JSON.stringify(copy)); return copy; }
    catch { copy.pop(); }
  }
  try { localStorage.setItem(key, '[]'); } catch { /* Storage may be unavailable. */ }
  return [];
}
function normalizedRepository(value) {
  const input = String(value || '').trim().replace(/\/+$/, '');
  const match = /^(?:https:\/\/github\.com\/)?([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/.exec(input);
  if (!match || match[1].includes('..')) throw new Error('Use owner/repository or a public github.com repository URL.');
  return match[1];
}
function normalizedToken(value) {
  const input = String(value || '').trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(input)) throw new Error('Use a 42-character 0x token address.');
  return input;
}
function saveWatches() { watches = saveArray(WATCH_KEY, watches, 24); }
function saveAlerts() { alerts = saveArray(ALERT_KEY, alerts, 100); }
function compareReports(before, after) {
  if (!before || !after || before.schemaVersion !== 1 || after.schemaVersion !== 1) throw new Error('Unsupported report schema.');
  if (Boolean(before.demo) !== Boolean(after.demo)) throw new Error('Demo data cannot be compared with live evidence.');
  if (before.input.token.toLowerCase() !== after.input.token.toLowerCase() || before.input.repository.toLowerCase() !== after.input.repository.toLowerCase()) throw new Error('Compare receipts for the same token and repository.');
  const out = { before: before.id, after: after.id, from: before.createdAt, to: after.createdAt, code: { status: 'unknown', changed: [], counts: emptyCounts() }, chain: [], warnings: [] };
  if (before.demo && after.demo) out.demo = true;
  if (before.github.status === 'unavailable' || after.github.status === 'unavailable' || !before.github.files || !after.github.files) out.code.reason = 'Both receipts need readable file trees. Missing data is not an empty repository.';
  else {
    const complete = Boolean(before.github.treeComplete && after.github.treeComplete); out.code.status = complete ? 'complete' : 'partial';
    const old = new Map(before.github.files.map(file => [file.path, file])); const next = new Map(after.github.files.map(file => [file.path, file]));
    for (const [path, file] of next) { const prior = old.get(path); if (prior && (prior.sha !== file.sha || prior.mode !== file.mode)) out.code.changed.push({ path, kind: file.kind, change: 'modified' }); else if (!prior && before.github.treeComplete) out.code.changed.push({ path, kind: file.kind, change: 'added' }); }
    if (after.github.treeComplete) for (const [path, file] of old) if (!next.has(path)) out.code.changed.push({ path, kind: file.kind, change: 'removed' });
    for (const file of out.code.changed) out.code.counts[file.kind]++;
    if (!complete) out.warnings.push('Incomplete trees: additions and removals appear only when the corresponding absence is established.');
  }
  for (const field of new Set([...Object.keys(before.chain.fields), ...Object.keys(after.chain.fields)])) {
    const a = before.chain.fields[field] || { status: 'unknown' }, b = after.chain.fields[field] || { status: 'unknown' };
    if (a.status !== 'known' || b.status !== 'known') { if (a.status !== b.status) out.warnings.push(`${field}: availability changed; this is not proof of a value change.`); continue; }
    if (a.value !== b.value) out.chain.push({ field, before: a, after: b });
  }
  return out;
}
const mdEscape = value => String(value ?? '').replace(/[\\`*_{}\[\]<>|]/g, '\\$&').replace(/[\r\n]+/g, ' ');
const factText = fact => !fact ? 'Unknown' : fact.status === 'known' ? String(fact.value) : `Unknown: ${fact.reason}`;
function toMarkdown(report) {
  const g = report.github, c = report.chain;
  const lines = ['# RUMZO — builder receipts', '', `Observed: ${report.createdAt}`, `Snapshot: ${report.id}`, '', `Token: \`${report.input.token}\``, `Repository: ${g.url}`, '', '## GitHub', '', `Status: ${g.status}`, `Revision: ${g.sha || 'Unknown'}`, `Classification: ${g.classification || 'Unknown'}`, ''];
  if (g.error) lines.push(mdEscape(g.error), ''); if (report.demo) lines.splice(2, 0, '> DEMO — synthetic data. No live inspection was performed.', '');
  if (g.counts) for (const [kind, count] of Object.entries(g.counts)) lines.push(`- ${kind}: ${count} observed files`);
  lines.push('', `README token reference: ${mdEscape(factText(g.readmeTokenReference))}`, '');
  for (const hint of g.launchHints || []) lines.push(`- [${mdEscape(hint.path)}](${hint.source}): ${mdEscape(hint.hint)}`);
  if (g.latestCommit) lines.push('', `Latest commit: ${mdEscape(g.latestCommit.message)}`, g.latestCommit.url);
  lines.push('', '## Robinhood Chain / pons v2', '', `Status: ${c.status}`, `Block: ${c.blockNumber || 'Unknown'}`, `Block time: ${c.blockTime || 'Unknown'}`, '');
  if (c.error) lines.push(mdEscape(c.error), '');
  for (const [field, fact] of Object.entries(c.fields)) lines.push(`- **${field}**: ${mdEscape(factText(fact))}${fact.status === 'known' ? ` ([source](${fact.source}))` : ''}`);
  lines.push('', '## Coverage and limits', '', ...[...g.warnings, ...c.warnings, ...report.limitations].map(warning => `- ${mdEscape(warning)}`));
  return lines.join('\n') + '\n';
}
function download(name, contents, type) { const url = URL.createObjectURL(new Blob([contents], { type })); const a = el('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
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
  renderGitHub(report.github); renderChain(report.chain); renderComparison(comparison); renderBaseline();
  if (comparison) $('baseline').value = comparison.before;
  $('limits').replaceChildren(...[...report.github.warnings, ...report.chain.warnings, ...report.limitations].map(w => el('li', w)));
}
function refreshHistory() {
  saved = loadReports(); const root = $('history-list'); root.replaceChildren();
  if (!saved.length) { const empty = el('div', undefined, 'empty-history'); const image = el('img'); image.src = '/assets/empty-receipts.png'; image.alt = ''; image.width = 92; image.height = 92; empty.append(image, el('p', 'No receipts yet. Start an inspection or explore the demo.', 'muted')); root.append(empty); }
  for (const r of saved.slice(0, 12)) {
    const container = el('div', undefined, 'history-row'); const text = el('div'); text.append(el('p', r.input.repository), el('small', `${time(r.createdAt)} · GitHub ${r.github.status} / chain ${r.chain.status}`));
    const button = el('button', 'Open'); button.type = 'button'; button.addEventListener('click', () => { message(''); renderReport(r); }); container.append(text, button); root.append(container);
  }
  renderBaseline();
}
const eventState = type => type === 'unchanged' || type === 'baseline' ? 'stable' : type === 'coverage-change' ? 'coverage' : type === 'error' ? 'error' : 'change';
const intervalLabel = minutes => minutes < 60 ? `${minutes}m` : minutes === 60 ? '1h' : minutes === 360 ? '6h' : '24h';
function eventFor(watch, report, comparison) {
  let type = 'baseline', summary = 'Baseline receipt captured. Future checks will compare against it.';
  if (comparison) {
    const code = comparison.code.changed.length, contract = comparison.chain.length;
    if (code && contract) { type = 'code-and-contract-change'; summary = `${code} repository file change${code === 1 ? '' : 's'} and ${contract} contract field change${contract === 1 ? '' : 's'} established.`; }
    else if (code) { type = 'code-change'; summary = `${code} repository file change${code === 1 ? '' : 's'} established. Known contract values stayed stable.`; }
    else if (contract) { type = 'contract-change'; summary = `${contract} contract field change${contract === 1 ? '' : 's'} established. No repository file change was established.`; }
    else if (comparison.warnings.length || comparison.code.status !== 'complete') { type = 'coverage-change'; summary = 'No value change was established, but evidence coverage or availability changed.'; }
    else { type = 'unchanged'; summary = 'No repository or known contract value change was established.'; }
  }
  return { id: crypto.randomUUID(), watchId: watch.id, repository: watch.repository, token: watch.token, reportId: report.id, previousReportId: comparison?.before, createdAt: report.createdAt, type, summary };
}
function renderAlerts() {
  const root = $('alert-list'); root.replaceChildren();
  if (!alerts.length) { root.append(el('p', 'No monitoring events yet. Add a project to capture its baseline.', 'alert-empty')); return; }
  for (const event of alerts.slice(0, 40)) {
    const item = el('article', undefined, 'alert-item'); item.dataset.state = eventState(event.type);
    const body = el('div'); body.append(el('p', event.type.replaceAll('-', ' '), 'alert-type'), el('p', event.repository || 'Watched project', 'watch-meta'), el('p', event.summary, 'alert-summary'), el('time', time(event.createdAt), 'alert-time'));
    item.append(el('i', undefined, 'alert-dot'), body); root.append(item);
  }
}
function renderWatches() {
  const root = $('watch-list'); root.replaceChildren();
  $('watch-count').textContent = `${watches.filter(watch => watch.enabled).length} ACTIVE`;
  if (!watches.length) { root.append(el('p', 'The watchlist is empty. Add a contract and repository above.', 'watch-empty')); return; }
  for (const watch of watches) {
    const container = el('article', undefined, `watch-row${watch.enabled ? '' : ' paused'}`);
    const copy = el('div'); const title = el('p', undefined, 'watch-title'); title.append(el('i'), watch.repository);
    copy.append(title, el('p', `${watch.token.slice(0, 8)}…${watch.token.slice(-6)} · every ${intervalLabel(watch.intervalMinutes)}`, 'watch-meta'));
    const next = watch.enabled ? `Next check ${time(watch.nextRunAt)}` : 'Schedule paused';
    copy.append(el('p', `${watch.lastEvent ? watch.lastEvent.replaceAll('-', ' ') + ' · ' : ''}${next}`, 'watch-next'));
    const actions = el('div', undefined, 'watch-actions');
    const run = el('button', monitoring.has(watch.id) ? 'Checking…' : 'Check now'); run.type = 'button'; run.disabled = monitoring.has(watch.id); run.addEventListener('click', () => void runWatch(watch.id, true));
    const toggle = el('button', watch.enabled ? 'Pause' : 'Resume'); toggle.type = 'button'; toggle.addEventListener('click', () => { watch.enabled = !watch.enabled; if (watch.enabled) watch.nextRunAt = new Date().toISOString(); saveWatches(); renderWatches(); });
    const remove = el('button', 'Remove', 'remove-watch'); remove.type = 'button'; remove.addEventListener('click', () => { watches = watches.filter(item => item.id !== watch.id); alerts = alerts.filter(item => item.watchId !== watch.id); saveWatches(); saveAlerts(); renderWatches(); renderAlerts(); $('monitor-status').textContent = 'Watch removed. Saved receipts remain in your browser.'; });
    actions.append(run, toggle, remove); container.append(copy, actions); root.append(container);
  }
}
async function runWatch(id, reveal = false) {
  const watch = watches.find(item => item.id === id);
  if (!watch || monitoring.has(id)) return;
  monitoring.add(id); renderWatches(); $('monitor-status').textContent = `Reading ${watch.repository} and Robinhood Chain…`;
  try {
    const previous = saved.find(report => report.input.token.toLowerCase() === watch.token.toLowerCase() && report.input.repository.toLowerCase() === watch.repository.toLowerCase());
    const { report } = await api('/api/inspect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: watch.token, repository: watch.repository }) });
    const comparison = previous ? compareReports(previous, report) : null;
    const stored = saveReport(report); refreshHistory();
    const event = eventFor(watch, report, comparison); alerts.unshift(event); saveAlerts();
    watch.lastRunAt = report.createdAt; watch.lastReportId = report.id; watch.lastEvent = event.type; watch.lastError = '';
    watch.nextRunAt = new Date(Date.now() + watch.intervalMinutes * 60_000).toISOString(); saveWatches();
    $('monitor-status').textContent = `${event.summary}${stored ? '' : ' Receipt storage is full; export reports you need to keep.'}`;
    renderAlerts();
    if (reveal) { renderReport(report, comparison); $('results').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  } catch (error) {
    const summary = error.name === 'TimeoutError' ? 'The scheduled check timed out.' : error.message;
    const event = { id: crypto.randomUUID(), watchId: watch.id, repository: watch.repository, token: watch.token, createdAt: new Date().toISOString(), type: 'error', summary };
    alerts.unshift(event); saveAlerts(); watch.lastRunAt = event.createdAt; watch.lastEvent = 'error'; watch.lastError = summary; watch.nextRunAt = new Date(Date.now() + watch.intervalMinutes * 60_000).toISOString(); saveWatches();
    $('monitor-status').textContent = `${watch.repository}: ${summary}`; renderAlerts();
  } finally { monitoring.delete(id); renderWatches(); }
}
async function runDueWatches() {
  const due = watches.filter(watch => watch.enabled && Date.parse(watch.nextRunAt) <= Date.now());
  for (const watch of due) await runWatch(watch.id, false);
}
$('watch-form').addEventListener('submit', async event => {
  event.preventDefault(); message('');
  try {
    const token = normalizedToken($('watch-token').value), repository = normalizedRepository($('watch-repository').value), intervalMinutes = Number($('watch-interval').value);
    if (watches.some(watch => watch.token.toLowerCase() === token.toLowerCase() && watch.repository.toLowerCase() === repository.toLowerCase())) throw new Error('This project is already on your watchlist.');
    const now = new Date().toISOString(); const watch = { id: crypto.randomUUID(), token, repository, intervalMinutes, enabled: true, createdAt: now, nextRunAt: now };
    watches.unshift(watch); saveWatches(); renderWatches(); await runWatch(watch.id, false);
  } catch (error) { $('monitor-status').textContent = error.message; }
});
$('clear-alerts').addEventListener('click', () => { alerts = []; saveAlerts(); renderAlerts(); $('monitor-status').textContent = 'Monitoring timeline cleared. Saved receipts remain available.'; });
$('token').addEventListener('change', () => { if (!$('watch-token').value) $('watch-token').value = $('token').value; });
$('repository').addEventListener('change', () => { if (!$('watch-repository').value) $('watch-repository').value = $('repository').value; });
$('demo-button').addEventListener('click', async () => { try { message(''); demo = await api('/api/demo'); renderReport(demo.report, demo.comparison); $('status').textContent = 'Demo loaded. All displayed values are synthetic; your saved receipts are unchanged.'; $('results').scrollIntoView({ behavior: 'instant', block: 'start' }); } catch (error) { message(error.message); } });
$('inspect-form').addEventListener('submit', async event => {
  event.preventDefault(); message(''); const button = $('scan-button'); button.disabled = true; button.textContent = 'Reading sources…'; $('status').textContent = 'Reading GitHub and Robinhood Chain. A scan can take up to a minute.';
  try {
    const { report } = await api('/api/inspect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: $('token').value, repository: $('repository').value }) });
    const previous = saved.find(r => r.input.token.toLowerCase() === report.input.token.toLowerCase() && r.input.repository.toLowerCase() === report.input.repository.toLowerCase());
    const comparison = previous ? compareReports(previous, report) : null; const stored = saveReport(report); refreshHistory(); renderReport(report, comparison);
    const complete = report.github.status === 'ok' && report.chain.status === 'ok';
    $('status').textContent = `${complete ? 'Receipt ready. Every finding has its source.' : 'Receipt ready with coverage limits.'}${stored ? ' Saved in this browser.' : ' Browser storage is full; download it to keep a copy.'}`;
  } catch (error) { message(error.name === 'TimeoutError' ? 'The scan timed out. Retry in a moment.' : error.message); $('status').textContent = ''; }
  finally { button.disabled = false; button.textContent = 'Get receipts ↗'; }
});
$('baseline').addEventListener('change', () => { try { message(''); const id = $('baseline').value; const before = current?.demo ? demo?.before : saved.find(report => report.id === id); renderComparison(id ? compareReports(before, current) : null); } catch(e) { message(e.message); } });
$('export-json').addEventListener('click', () => { if (current) download(`rumzo-${current.id}.json`, JSON.stringify(current, null, 2) + '\n', 'application/json'); });
$('export-md').addEventListener('click', () => { if (current) download(`rumzo-${current.id}.md`, toMarkdown(current), 'text/markdown'); });
$('refresh-history').addEventListener('click', refreshHistory);
refreshHistory();
watches = loadArray(WATCH_KEY, 24).filter(watch => watch?.id && watch?.token && watch?.repository && [5, 15, 30, 60, 360, 1440].includes(watch.intervalMinutes));
alerts = loadArray(ALERT_KEY, 100).filter(event => event?.id && event?.watchId && event?.type);
renderWatches(); renderAlerts();
void runDueWatches();
setInterval(() => void runDueWatches(), 30_000);

const navLinks = [...document.querySelectorAll('.nav-link')];
const navSections = navLinks.map(anchor => document.querySelector(anchor.getAttribute('href'))).filter(Boolean);
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    for (const anchor of navLinks) {
      const currentSection = anchor.getAttribute('href') === `#${visible.target.id}`;
      if (currentSection) anchor.setAttribute('aria-current', 'true'); else anchor.removeAttribute('aria-current');
    }
  }, { rootMargin: '-18% 0px -65% 0px', threshold: [0, .2, .5] });
  for (const section of navSections) observer.observe(section);
}
