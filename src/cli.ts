#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { inspect } from './reports/inspect.js';
import { compareReports } from './reports/compare.js';
import { toMarkdown } from './reports/markdown.js';
import { SnapshotStore } from './storage/snapshots.js';
import { startServer } from './server/app.js';

const HELP = `RUMZO 0.1 — Show the receipts.

  pnpm start
  node dist/cli.js serve [--port 4317]
  node dist/cli.js inspect --token 0x... --repo owner/repository [--format json|markdown] [--output report.json]
  node dist/cli.js diff --before old.json --after new.json

Inspect reads public GitHub and Robinhood Chain (4663 / pons v2).
Snapshots are saved in .rumzo (override with RUMZO_DATA_DIR).
Optional environment variables: GITHUB_TOKEN, RUMZO_RPC_URL.
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
async function main() {
  const command = process.argv[2] || '--help';
  if (command === '--help' || command === '-h' || command === 'help') { process.stdout.write(HELP); return; }
  const options = args(process.argv.slice(3));
  const allowed = command === 'serve' ? ['port'] : command === 'inspect' ? ['token', 'repo', 'format', 'output'] : command === 'diff' ? ['before', 'after'] : [];
  for (const key of Object.keys(options)) if (!allowed.includes(key)) throw new Error(`Unknown option --${key}.`);
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
