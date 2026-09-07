import { setTimeout as pause } from 'node:timers/promises';
import { demoSession } from '../dist/demo/session.js';

// A finite, offline tour of the same fixtures used by the web demo.
const flags = process.argv.slice(2);
if (flags.some(flag => flag !== '--instant' && flag !== '--color')) {
  process.stderr.write('Usage: pnpm demo:terminal [--instant] [--color]\n');
  process.exitCode = 1;
} else {
  const color = flags.includes('--color') || (process.stdout.isTTY && !process.env.NO_COLOR);
  const tint = (code, text) => color ? `\x1b[${code}m${text}\x1b[0m` : text;
  const green = text => tint('92', text);
  const muted = text => tint('90', text);
  const paper = text => tint('97', text);
  const amber = text => tint('93', text);
  const { before, report, comparison } = demoSession();
  const rule = muted('─'.repeat(96));
  const logo = [
    '█████  ██  ██  █   █  ██████   ████ ',
    '██  ██ ██  ██  ██ ██      ██  ██  ██',
    '█████  ██  ██  █ █ █    ██    ██  ██',
    '██  ██ ██  ██  █   █  ██      ██  ██',
    '██  ██  ████   █   █  ██████   ████ '
  ].map(green).join('\n');
  const fmt = fact => fact?.status === 'known' ? String(fact.value) : 'Unknown';
  const percent = fact => fact?.status === 'known' ? `${Number(fact.value) / 100}%` : 'Unknown';
  const fixed = (label, value) => `${label.padEnd(19)}${value}`;
  const cell = (left, right) => `${left.padEnd(51)}${right}`;
  const frames = [
    { title:'01 / BASELINE', value:before, logs:[['FIXTURE', 'Load the first synthetic receipt. No network requests.']], hold:2200 },
    { title:'01 / BASELINE', value:before, logs:[['GITHUB', 'Pin the repository revision and classify its files.'], ['CHAIN', 'Keep contract settings together with their read block.']], hold:3500 },
    { title:'02 / NEXT RECEIPT', value:report, logs:[['FIXTURE', 'Load the second synthetic receipt, two hours later.'], ['REVISION', `${before.github.sha.slice(0,12)} → ${report.github.sha.slice(0,12)}`]], hold:3500 },
    { title:'03 / COMPARE', value:report, changes:true, reveal:2, logs:[['COMPARE', 'Compare source, tests and documentation separately.']], hold:3000 },
    { title:'03 / COMPARE', value:report, changes:true, reveal:comparison.code.changed.length, logs:[['COMPARE', 'Only compare contract fields known in both receipts.']], hold:3500 },
    { title:'04 / RECEIPTS', value:report, changes:true, reveal:comparison.code.changed.length, done:true, logs:[['DONE', 'Two receipts. A clear record of what changed.'], ['EXPORT', 'JSON + Markdown exports are available in the web demo.']], hold:4300 }
  ];
  function render(frame) {
    const r = frame.value;
    const c = r.github.counts;
    const lines = [logo, muted('SHOW THE RECEIPTS.  /  GitHub evidence. Robinhood Chain snapshots.'), '',
      `${green('RUMZO')}  ${amber('DEMO · SYNTHETIC DATA')}  ${muted('read only · chain 4663 · no signer')}`,
      rule, `${paper(frame.title)}  ${muted(r.createdAt.replace('T',' ').replace('.000Z',' UTC'))}`, '',
      paper(cell('GITHUB EVIDENCE', 'ROBINHOOD CHAIN / pons v2')),
      cell(fixed('repository', r.github.repository), fixed('asset', fmt(r.chain.fields.name))),
      cell(fixed('revision', r.github.sha.slice(0,12)), fixed('block', r.chain.blockNumber)),
      cell(fixed('files', `${c.source} source · ${c.tests} test · ${c.docs} docs`), fixed('creator tax', percent(r.chain.fields.creatorTaxBps))),
      cell(fixed('tree', r.github.treeComplete ? 'complete' : 'partial'), fixed('base curve fee', percent(r.chain.fields.curveFeeBps))),
      cell(fixed('README address', 'mentioned · a claim'), fixed('pool hook fee', percent(r.chain.fields.hookFeeBps))),
      muted('Tests are counted by file path, not executed. All example values above are invented.'),
      rule, paper('WHAT CHANGED?')
    ];
    if (frame.changes) {
      for (const f of comparison.code.changed.slice(0,frame.reveal)) lines.push(`${green(f.change === 'added' ? '+ ADD ' : '~ EDIT')}  ${f.kind.padEnd(8)}  ${f.path}`);
      if (frame.reveal === comparison.code.changed.length) {
        for (const change of comparison.chain) lines.push(`${amber('~ SET ')}  chain     creator tax: ${percent(change.before)} → ${percent(change.after)}`);
      }
    } else lines.push(muted(frame.value === before ? 'Waiting for the second receipt in this offline tour.' : 'Second receipt loaded. Comparing the two snapshots…'));
    while (lines.join('\n').split('\n').length < 27) lines.push('');
    lines.push(rule);
    for (const [tag,message] of frame.logs) lines.push(`${green(tag.padEnd(9))}${message}`);
    while (lines.join('\n').split('\n').length < 31) lines.push('');
    lines.push(frame.done ? paper('github.com/Nekt-0/rumzo  ·  Show the receipts.') : muted('Offline demo · explicit snapshots · no live monitoring or trading'));
    return lines.join('\n')+'\n';
  }
  for (const frame of frames) {
    if (color) process.stdout.write('\x1b[2J\x1b[H');
    process.stdout.write(render(frame));
    if (!flags.includes('--instant')) await pause(frame.hold);
  }
}
