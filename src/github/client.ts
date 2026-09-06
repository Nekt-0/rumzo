import { Buffer } from 'node:buffer';

export class GitHubClient {
  constructor(private token = process.env.GITHUB_TOKEN, private fetcher: typeof fetch = fetch) {}
  async get(path: string): Promise<{ data: any; link: string }> {
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'rumzo/0.1.0' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const response = await this.fetcher(`https://api.github.com${path}`, { headers, redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (!response.ok) {
      if (response.status === 403 || response.status === 429) throw new Error('GitHub access or rate limit reached. Retry later; optionally configure GITHUB_TOKEN locally.');
      if (response.status === 404) throw new Error('Public repository or revision not found. Check the URL and access.');
      throw new Error(`GitHub returned HTTP ${response.status}.`);
    }
    // GitHub recursive trees are capped upstream at 7 MB. Enforce our own response bound too.
    const reader = response.body?.getReader();
    if (!reader) throw new Error('GitHub returned an empty response.');
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 10 * 1024 * 1024) { await reader.cancel(); throw new Error('GitHub response exceeded the 10 MB inspection limit.'); } chunks.push(part.value); }
    return { data: JSON.parse(Buffer.concat(chunks).toString('utf8')), link: response.headers.get('link') || '' };
  }
}
