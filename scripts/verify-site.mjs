import assert from 'node:assert/strict';

const worker = (await import('../dist/server/index.js')).default;
assert.equal(typeof worker?.fetch, 'function');

const assets = { fetch: async request => new Response(`asset:${new URL(request.url).pathname}`, { headers: { 'Content-Type': 'text/plain' } }) };
const health = await worker.fetch(new Request('https://rumzo.test/api/health'), { ASSETS: assets });
assert.equal(health.status, 200);
const healthBody = await health.json();
assert.equal(healthBody.version, '0.3.0');
assert.equal(healthBody.storage, 'browser');
assert.equal(healthBody.monitoring, 'while-open');

const demo = await worker.fetch(new Request('https://rumzo.test/api/demo'), { ASSETS: assets });
assert.equal(demo.status, 200);
assert.equal((await demo.json()).report.demo, true);

const denied = await worker.fetch(new Request('https://rumzo.test/api/inspect', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://elsewhere.test' }, body: '{}'
}), { ASSETS: assets });
assert.equal(denied.status, 403);

const home = await worker.fetch(new Request('https://rumzo.test/'), { ASSETS: assets });
assert.equal(home.status, 200);
assert.match(await home.text(), /asset:\//);
assert.match(home.headers.get('content-security-policy'), /frame-ancestors 'none'/);

console.log('Hosted Worker entry, API routes, origin check, and static asset handoff verified.');
