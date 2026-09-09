import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { inspect } from '../reports/inspect.js';
import { compareReports } from '../reports/compare.js';
import { toMarkdown } from '../reports/markdown.js';
import { demoSession } from '../demo/session.js';
import { SnapshotStore } from '../storage/snapshots.js';
import { validateInput } from '../input.js';

const staticFiles: Record<string, [string, string]> = {
  '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8']
};
const assetFiles: Record<string, string> = { 'avatar.png': 'image/png', 'avatar-background.png': 'image/png', 'empty-receipts.png': 'image/png', 'receipt.svg': 'image/svg+xml', 'compare.svg': 'image/svg+xml', 'mark.svg': 'image/svg+xml' };
function json(res: ServerResponse, status: number, body: unknown) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
async function readBody(req: IncomingMessage): Promise<unknown> {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('Send application/json.');
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of req) { size += chunk.length; if (size > 4096) throw new Error('Request exceeds 4 KB.'); chunks.push(Buffer.from(chunk)); }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new Error('Invalid JSON request.'); }
}

export function createApp(options: { store?: SnapshotStore; inspector?: typeof inspect } = {}) {
  const store = options.store || new SnapshotStore();
  const inspector = options.inspector || inspect;
  let active = 0;
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const address = req.socket.localAddress;
    const port = req.socket.localPort;
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (!hosts.includes(req.headers.host || '') || !['127.0.0.1', '::ffff:127.0.0.1'].includes(address || '')) { json(res, 403, { error: 'Local access only.' }); return; }
    const origin = `http://${req.headers.host}`;
    if (req.headers.origin && req.headers.origin !== origin) { json(res, 403, { error: 'Cross-origin requests are not allowed.' }); return; }
    const url = new URL(req.url || '/', origin);
    try {
      if (req.method === 'GET' && url.pathname === '/api/health') { json(res, 200, { name: 'rumzo', version: '0.3.0', chainId: 4663, monitoring: 'local-runner' }); return; }
      if (req.method === 'GET' && url.pathname === '/api/demo') { json(res, 200, demoSession()); return; }
      if (req.method === 'GET' && url.pathname === '/api/demo.md') {
        res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': 'attachment; filename="rumzo-demo.md"' });
        res.end(toMarkdown(demoSession().report)); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/reports') {
        json(res, 200, (await store.list()).slice(0, 100).map(r => ({ id: r.id, createdAt: r.createdAt, input: r.input, github: r.github.status, chain: r.chain.status }))); return;
      }
      const match = /^\/api\/reports\/([0-9a-f-]+)(\.md)?$/.exec(url.pathname);
      if (req.method === 'GET' && match) {
        const report = await store.get(match[1]!);
        if (match[2]) { res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="rumzo-${report.id}.md"` }); res.end(toMarkdown(report)); }
        else json(res, 200, report);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/compare') {
        const before = await store.get(url.searchParams.get('before') || '');
        const after = await store.get(url.searchParams.get('after') || '');
        json(res, 200, compareReports(before, after)); return;
      }
      if (req.method === 'POST' && url.pathname === '/api/inspect') {
        const input = validateInput(await readBody(req));
        if (active >= 2) { json(res, 429, { error: 'Two inspections are already running. Wait for one to finish.' }); return; }
        active++;
        try {
          const previous = (await store.list()).find(r => r.input.token.toLowerCase() === input.token.toLowerCase() && r.input.repository.toLowerCase() === input.repository.toLowerCase());
          const report = await inspector(input); await store.save(report);
          const comparison = previous ? compareReports(previous, report) : null;
          json(res, 200, { report, comparison });
        } finally { active--; }
        return;
      }
      if (req.method === 'GET' && staticFiles[url.pathname]) {
        const [file, type] = staticFiles[url.pathname]!;
        const body = await readFile(new URL(`../../web/${file}`, import.meta.url));
        res.writeHead(200, { 'Content-Type': type }); res.end(body); return;
      }
      const asset = url.pathname.startsWith('/assets/') ? url.pathname.slice(8) : '';
      if (req.method === 'GET' && Object.hasOwn(assetFiles, asset)) {
        const body = await readFile(new URL(`../../assets/${asset}`, import.meta.url));
        res.writeHead(200, { 'Content-Type': assetFiles[asset]! }); res.end(body); return;
      }
      json(res, 404, { error: 'Not found.' });
    } catch (error) {
      if (!res.headersSent) json(res, 400, { error: error instanceof Error ? error.message : 'Request failed.' });
      else res.end();
    }
  });
}

export async function startServer(port = Number(process.env.PORT || 4317)) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
  const server = createApp();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => resolve()); });
  return server;
}
