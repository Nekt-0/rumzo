import { getAddress, isAddress } from 'viem';

export function parseRepository(input: unknown): { owner: string; repo: string; fullName: string } {
  if (typeof input !== 'string' || input.length > 300) throw new Error('Enter a GitHub URL or owner/repository.');
  let text = input.trim();
  if (text.startsWith('https://')) {
    const url = new URL(text);
    if (url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash) throw new Error('Use a public github.com repository URL without query parameters.');
    text = url.pathname.replace(/^\//, '').replace(/\/$/, '');
  }
  text = text.replace(/\.git$/, '');
  const match = /^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38}))\/([a-zA-Z0-9_.-]{1,100})$/.exec(text);
  if (!match || /^\.{1,2}$/.test(match[2]!)) throw new Error('Use owner/repository, for example owner/repository.');
  return { owner: match[1]!, repo: match[2]!, fullName: `${match[1]}/${match[2]}` };
}

export function parseToken(input: unknown): string {
  if (typeof input !== 'string' || !isAddress(input.trim(), { strict: false })) throw new Error('Enter a valid 0x token contract address (40 hexadecimal characters).');
  return getAddress(input.trim().toLowerCase());
}

export function validateInput(input: unknown) {
  if (!input || typeof input !== 'object') throw new Error('A token address and GitHub repository are required.');
  const item = input as Record<string, unknown>;
  return { token: parseToken(item.token), repository: parseRepository(item.repository).fullName };
}
