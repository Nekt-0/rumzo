#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { inspect } from './reports/inspect.js';
import { compareReports } from './reports/compare.js';
import { toMarkdown } from './reports/markdown.js';
import { SnapshotStore } from './storage/snapshots.js';
import { startServer } from './server/app.js';
import { MonitoringService } from './monitoring/service.js';

const HELP = `RUMZO 0.3 — Watch the evidence.

  pnpm start
  node dist/cli.js serve [--port 4317]
  node dist/cli.js inspect --token 0x... --repo owner/repository [--format json|markdown] [--output report.json]
  node dist/cli.js diff --before old.json --after new.json
  node dist/cli.js watch add --token 0x... --repo owner/repository [--every 15]
  node dist/cli.js watch list
  node dist/cli.js watch run --id WATCH_ID
  node dist/cli.js watch pause|resume|remove --id WATCH_ID
  node dist/cli.js watch start [--poll 60]

Inspect reads public GitHub and Robinhood Chain (4663 / pons v2).
Watchlists, receipts and monitoring events are saved in .rumzo.
Allowed watch intervals: 5, 15, 30, 60, 360 or 1440 minutes.
Set RUMZO_TELEGRAM_BOT_TOKEN and RUMZO_TELEGRAM_CHAT_ID for change alerts.
Optional environment variables: GITHUB_TOKEN, RUMZO_RPC_URL, RUMZO_DATA_DIR.
No wallets, signatures, trades, or execution of inspected repository code.
`;

function args(items: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < items.length; i += 2) {
    const key = items[i], value = items[i + 1];
    if (!key?.startsWith('--') || !value || value.startsWith('--') || out[key.slice(2)] !== undefined) throw new Error('Options use --name value pairs. Run --help for usage.');
    out[key.slice(2)] = value;
  }
  return out;
}

function allowed(options: Record<string, string>, names: string[]) {
  for (const key of Object.keys(options)) if (!names.includes(key)) throw new Error(`Unknown option --${key}.`);
}

async function watchCommand(action: string, options: Record<string, string>) {
  const service = new MonitoringService();
  if (action === 'add') {
    allowed(options, ['token', 'repo', 'every']);
    const watch = await service.add({ token: options.token, repository: options.repo }, options.every || '15');
    process.stdout.write(`Watch added: ${watch.id}\nCapturing baseline…\n`);
    const event = await service.run(watch.id);
    process.stdout.write(`${event.type}: ${event.summary}\n`);
    return;
  }
  if (action === 'list') {
    allowed(options, []);
    const watches = await service.store.listWatches();
    if (!watches.length) { process.stdout.write('Watchlist is empty.\n'); return; }
    for (const watch of watches) process.stdout.write(`${watch.enabled ? 'ON ' : 'OFF'} ${watch.id}  ${watch.repository}  every ${watch.intervalMinutes}m  next ${watch.nextRunAt}${watch.lastEvent ? `  ${watch.lastEvent}` : ''}\n`);
    return;
  }
  if (['run', 'pause', 'resume', 'remove'].includes(action)) {
    allowed(options, ['id']);
    if (!options.id) throw new Error(`watch ${action} requires --id.`);
    if (action === 'run') {
      const event = await service.run(options.id);
      process.stdout.write(`${event.type}: ${event.summary}\n`);
    } else if (action === 'pause' || action === 'resume') {
      const watch = await service.setEnabled(options.id, action === 'resume');
      process.stdout.write(`Watch ${watch.enabled ? 'resumed' : 'paused'}: ${watch.id}\n`);
    } else {
      await service.remove(options.id);
      process.stdout.write(`Watch removed: ${options.id}\n`);
    }
    return;
  }
  if (action === 'start') {
    allowed(options, ['poll']);
    const poll = Number(options.poll || 60);
    if (!Number.isInteger(poll) || poll < 10 || poll > 300) throw new Error('Poll must be between 10 and 300 seconds.');
    let running = false;
    const sweep = async () => {
      if (running) return;
      running = true;
      try {
        const events = await service.runDue();
        for (const event of events) process.stdout.write(`${event.createdAt} ${event.type}: ${event.summary}\n`);
      } finally { running = false; }
    };
    process.stdout.write(`RUMZO monitor is running. Polling due watches every ${poll}s.${service.notifier.configured ? ' Telegram alerts enabled.' : ''}\n`);
    await sweep();
    const timer = setInterval(() => void sweep().catch(error => process.stderr.write(`RUMZO monitor: ${error instanceof Error ? error.message : 'Sweep failed.'}\n`)), poll * 1000);
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { clearInterval(timer); process.exit(0); });
    return;
  }
  throw new Error('Unknown watch action. Use add, list, run, pause, resume, remove, or start.');
}

async function main() {
  const command = process.argv[2] || '--help';
  if (command === '--help' || command === '-h' || command === 'help') { process.stdout.write(HELP); return; }
  if (command === 'watch') { await watchCommand(process.argv[3] || 'list', args(process.argv.slice(4))); return; }
  const options = args(process.argv.slice(3));
  allowed(options, command === 'serve' ? ['port'] : command === 'inspect' ? ['token', 'repo', 'format', 'output'] : command === 'diff' ? ['before', 'after'] : []);
  if (command === 'serve') {
    const port = Number(options.port || process.env.PORT || 4317);
    const server = await startServer(port);
    process.stdout.write(`RUMZO is ready: http://127.0.0.1:${port}\n`);
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => server.close(() => process.exit(0)));
  } else if (command === 'inspect') {
    const format = options.format || 'markdown';
    if (!['json', 'markdown'].includes(format)) throw new Error('Format must be json or markdown.');
    const report = await inspect({ token: options.token, repository: options.repo });
    await new SnapshotStore().save(report);
    const output = format === 'json' ? JSON.stringify(report, null, 2) + '\n' : toMarkdown(report);
    if (options.output) await writeFile(options.output, output, { encoding: 'utf8', flag: 'wx' });
    else process.stdout.write(output);
    process.stderr.write(`Snapshot saved: ${report.id}\n`);
    if (report.github.status === 'unavailable' && report.chain.status === 'unavailable') process.exitCode = 2;
  } else if (command === 'diff') {
    if (!options.before || !options.after) throw new Error('Specify --before and --after snapshot JSON files.');
    const before = JSON.parse(await readFile(options.before, 'utf8'));
    const after = JSON.parse(await readFile(options.after, 'utf8'));
    process.stdout.write(JSON.stringify(compareReports(before, after), null, 2) + '\n');
  } else throw new Error(`Unknown command ${command}. Run --help.`);
}

main().catch(error => { process.stderr.write(`RUMZO: ${error instanceof Error ? error.message : 'Operation failed.'}\n`); process.exitCode = 1; });
