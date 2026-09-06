import type { Fact } from '../types.js';
type Value = string | number | boolean;

// RPC error strings may contain credential-bearing URLs. Never place them in reports.
export async function readFact<T extends Value>(operation: () => Promise<T>, source: string): Promise<Fact<T>> {
  try { return { status: 'known', value: await operation(), source }; }
  catch { return { status: 'unknown', reason: 'Contract read failed or the function is unavailable at this block.' }; }
}
