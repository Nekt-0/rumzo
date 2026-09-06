import type { Address, PublicClient } from 'viem';
import { parseToken } from '../input.js';
import type { ChainSnapshot } from '../types.js';
import { CHAIN_ID, FACTORY, EXPLORER } from './config.js';
import { tokenAbi, factoryAbi, curveAbi, lockerAbi } from './abi.js';
import { createChainClient } from './client.js';
import { readFact } from './facts.js';
type Value = string | number | boolean;

export async function inspectChain(tokenInput: string, client: PublicClient = createChainClient()): Promise<ChainSnapshot> {
  const token = parseToken(tokenInput) as Address;
  const out: ChainSnapshot = { status: 'unavailable', chainId: CHAIN_ID, token, factory: FACTORY, observedAt: new Date().toISOString(), fields: {}, warnings: [] };
  try {
    const chainId = await client.getChainId();
    if (chainId !== CHAIN_ID) { out.error = `Wrong RPC network: expected 4663, received ${chainId}. No token reads performed.`; return out; }
    const blockNumber = await client.getBlockNumber();
    const block = await client.getBlock({ blockNumber });
    out.blockNumber = blockNumber.toString();
    out.blockTime = new Date(Number(block.timestamp) * 1000).toISOString();
    const source = (address: Address, method: string) => `${EXPLORER}/address/${address}?tab=read_contract#${method}`;
    const safe = async (name: string, action: () => Promise<Value>, address: Address, method: string) => { out.fields[name] = await readFact(action, source(address, method)); };
    await Promise.all([
      safe('name', async () => (await client.readContract({ address: token, abi: tokenAbi, functionName: 'name', blockNumber })).slice(0, 160), token, 'name'),
      safe('symbol', async () => (await client.readContract({ address: token, abi: tokenAbi, functionName: 'symbol', blockNumber })).slice(0, 40), token, 'symbol'),
      safe('totalSupplyRaw', async () => (await client.readContract({ address: token, abi: tokenAbi, functionName: 'totalSupply', blockNumber })).toString(), token, 'totalSupply'),
      safe('decimals', async () => await client.readContract({ address: token, abi: tokenAbi, functionName: 'decimals', blockNumber }), token, 'decimals')
    ]);
    let record;
    try { record = await client.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'getLaunchedToken', args: [token], blockNumber }); }
    catch { out.status = 'partial'; out.error = 'Pons v2 factory read failed. Protocol membership and fee parameters remain unknown.'; return out; }
    if (!record.exists) { out.status = 'unsupported'; out.error = 'This address is not registered in the supported Pons v2 factory. This is not a verdict about the token.'; return out; }
    const known = (name: string, value: Value) => { out.fields[name] = { status: 'known', value, source: source(FACTORY, 'getLaunchedToken') }; };
    known('protocol', 'pons v2'); known('deployer', record.deployer); known('feeRecipient', record.creatorFeeRecipient);
    known('curve', record.curve); known('pairToken', record.pairToken); known('creatorTaxBps', record.creatorTaxBps);
    known('buybackEnabled', record.buybackEnabled); known('phase', record.phase);
    known('graduationThresholdRaw', record.graduationThreshold.toString());
    await Promise.all([
      safe('launchedAt', async () => new Date(Number(await client.readContract({ address: record.curve, abi: curveAbi, functionName: 'launchedAt', blockNumber })) * 1000).toISOString(), record.curve, 'launchedAt'),
      safe('curveFeeBps', async () => Number(await client.readContract({ address: record.curve, abi: curveAbi, functionName: 'feeBps', blockNumber })), record.curve, 'feeBps'),
      safe('factorySnipeTaxStartBps', async () => Number(await client.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'snipeTaxStartBps', blockNumber })), FACTORY, 'snipeTaxStartBps'),
      safe('factorySnipeTaxSeconds', async () => Number(await client.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'snipeTaxSeconds', blockNumber })), FACTORY, 'snipeTaxSeconds'),
      safe('locker', async () => await client.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'locker', blockNumber }), FACTORY, 'locker'),
      (async () => {
        try {
          const policy = await client.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'getLaunchFeePolicy', args: [token], blockNumber });
          for (const [key, value] of Object.entries({ hookFeeBps: policy.hookFeeBps, protocolFeeShareBps: policy.protocolFeeShareBps })) out.fields[key] = { status: 'known', value, source: source(FACTORY, 'getLaunchFeePolicy') };
        } catch { for (const key of ['hookFeeBps', 'protocolFeeShareBps']) out.fields[key] = { status: 'unknown', reason: 'Launch fee policy could not be read.' }; }
      })()
    ]);
    const locker = out.fields.locker;
    if (locker?.status === 'known') {
      const address = locker.value as Address;
      await Promise.all([
        safe('isLocked', async () => await client.readContract({ address, abi: lockerAbi, functionName: 'isLocked', args: [token], blockNumber }), address, 'isLocked'),
        safe('lockedTokenSupplyRaw', async () => (await client.readContract({ address, abi: lockerAbi, functionName: 'lockedTokenSupply', args: [token], blockNumber })).toString(), address, 'lockedTokenSupply')
      ]);
    } else { out.fields.isLocked = { status: 'unknown', reason: 'Locker address could not be read.' }; }
    out.status = Object.values(out.fields).some(v => v.status === 'unknown') ? 'partial' : 'ok';
    out.warnings.push('Contract state is pinned to the reported block, which may still be reorganized. Explorer links open current contract pages; use the saved block for reproduction.');
    out.warnings.push('Creator tax is an additional parameter. Zero does not mean there are no base fees or creator earnings. Factory opening-tax settings are not a current trade quote.');
    out.warnings.push('Locker state does not prove overall token safety. Built-in buyback being disabled does not rule out manual purchases.');
  } catch { out.error = 'Robinhood Chain RPC is unavailable or returned an invalid response. Check the endpoint and retry.'; }
  return out;
}
