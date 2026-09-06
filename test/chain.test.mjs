import test from 'node:test';
import assert from 'node:assert/strict';
import { token, known } from './fixtures/context.mjs';
import { inspectChain } from '../dist/chain/inspect.js';
import { readFact } from '../dist/chain/facts.js';
test('RPC failure remains unknown and cannot silently become zero', async () => {
  const fact = await readFact(async () => { throw new Error('https://rpc.test/SECRET'); }, 'source');
  assert.equal(fact.status, 'unknown'); assert.equal('value' in fact, false); assert.equal(JSON.stringify(fact).includes('SECRET'), false);
  assert.deepEqual(await readFact(async () => 0, 'source'), { status: 'known', value: 0, source: 'source' });
});


test('wrong RPC network stops before any contract or block reads', async () => {
  let called = false;
  const report = await inspectChain(token, { getChainId: async () => 1, readContract: async () => { called = true; }, getBlockNumber: async () => { called = true; } });
  assert.equal(report.status, 'unavailable'); assert.match(report.error, /Wrong RPC network/); assert.equal(called, false);
});


test('all contract reads use one block and preserve a failed fee policy as unknown', async () => {
  const calls = [];
  const result = await inspectChain(token, {
    getChainId: async () => 4663, getBlockNumber: async () => 123n, getBlock: async ({ blockNumber }) => { assert.equal(blockNumber, 123n); return { timestamp: 1700000000n }; },
    readContract: async args => {
      calls.push(args); assert.equal(args.blockNumber, 123n);
      const data = { name: 'Test', symbol: 'T', totalSupply: 1000n, decimals: 18, launchedAt: 1700000000n, feeBps: 100n, snipeTaxStartBps: 9900n, snipeTaxSeconds: 3n, locker: token, isLocked: false, lockedTokenSupply: 0n };
      if (args.functionName === 'getLaunchedToken') return { exists: true, token, curve: token, deployer: token, creatorFeeRecipient: token, pairToken: token, creatorTaxBps: 0, buybackEnabled: false, phase: 2, graduationThreshold: 4200n };
      if (args.functionName === 'getLaunchFeePolicy') throw new Error('private RPC credential URL');
      return data[args.functionName];
    }
  });
  assert.equal(result.blockNumber, '123'); assert.equal(result.status, 'partial');
  assert.equal(result.fields.creatorTaxBps.value, 0); assert.equal(result.fields.isLocked.value, false);
  assert.equal(result.fields.hookFeeBps.status, 'unknown'); assert.ok(calls.length > 10);
});
