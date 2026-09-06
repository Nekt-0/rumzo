import { createPublicClient, http, type PublicClient } from 'viem';
import { DEFAULT_RPC } from './config.js';

export function createChainClient(rpc = process.env.RUMZO_RPC_URL || DEFAULT_RPC): PublicClient {
  const url = new URL(rpc);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('RUMZO_RPC_URL must be an HTTP(S) endpoint.');
  return createPublicClient({ transport: http(rpc, { timeout: 15000, retryCount: 1 }) });
}
