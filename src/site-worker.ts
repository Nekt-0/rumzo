import { inspect } from './reports/inspect.js';
import { demoSession } from './demo/session.js';
import { toMarkdown } from './reports/markdown.js';

type AssetBinding = { fetch(request: Request): Promise<Response> };
type Environment = { ASSETS?: AssetBinding; GITHUB_TOKEN?: string; RUMZO_RPC_URL?: string };

let activeInspections = 0;

const securityHeaders: Record<string, string> = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()'
};

function response(body: BodyInit | null, status = 200, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers: { ...securityHeaders, ...headers } });
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return response(JSON.stringify(body), status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
}

async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('Send application/json.');
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > 4096) throw new Error('Request exceeds 4 KB.');
  const text = await request.text();
  if (text.length > 4096) throw new Error('Request exceeds 4 KB.');
  try { return JSON.parse(text); } catch { throw new Error('Invalid JSON request.'); }
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

export default {
  async fetch(request: Request, env: Environment): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/api/health') return json({ name: 'rumzo', version: '0.3.0', chainId: 4663, storage: 'browser', monitoring: 'while-open' });
      if (request.method === 'GET' && url.pathname === '/api/demo') return json(demoSession());
      if (request.method === 'GET' && url.pathname === '/api/demo.md') {
        return response(toMarkdown(demoSession().report), 200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': 'attachment; filename="rumzo-demo.md"', 'Cache-Control': 'no-store' });
      }
      if (request.method === 'POST' && url.pathname === '/api/inspect') {
        if (!sameOrigin(request)) return json({ error: 'Cross-origin requests are not allowed.' }, 403);
        if (activeInspections >= 1) return json({ error: 'An inspection is already running. Try again in a moment.' }, 429, { 'Retry-After': '10' });
        const input = await readJson(request);
        activeInspections++;
        try {
          const report = await inspect(input, { githubToken: env.GITHUB_TOKEN, rpcUrl: env.RUMZO_RPC_URL });
          return json({ report });
        } finally { activeInspections--; }
      }
      if (url.pathname.startsWith('/api/')) return json({ error: 'Not found.' }, 404);
      if (!['GET', 'HEAD'].includes(request.method)) return response(null, 405, { Allow: 'GET, HEAD' });
      if (!env.ASSETS) return response('Static assets are unavailable.', 503, { 'Content-Type': 'text/plain; charset=utf-8' });
      const asset = await env.ASSETS.fetch(request);
      const headers = new Headers(asset.headers);
      for (const [key, value] of Object.entries(securityHeaders)) headers.set(key, value);
      if (url.pathname === '/' || url.pathname.endsWith('.html')) headers.set('Cache-Control', 'public, max-age=300');
      else headers.set('Cache-Control', 'public, max-age=86400');
      return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Request failed.' }, 400);
    }
  }
};
