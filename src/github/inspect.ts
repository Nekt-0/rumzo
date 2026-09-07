import { parseRepository } from '../input.js';
import { emptyCounts, type GitHubSnapshot, type Entry } from '../types.js';
import { classifyPath, classifyRepository } from './classify.js';
import { GitHubClient } from './client.js';

const blobLink = (repo: string, sha: string, path: string) => `https://github.com/${repo}/blob/${sha}/${path.split('/').map(encodeURIComponent).join('/')}`;

function decodeBase64Text(value: string): string {
  const binary = atob(value.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

export async function inspectGitHub(repository: string, token: string, client = new GitHubClient()): Promise<GitHubSnapshot> {
  const { fullName } = parseRepository(repository);
  const base = `/repos/${fullName}`;
  const result: GitHubSnapshot = { status: 'unavailable', repository: fullName, url: `https://github.com/${fullName}`, observedAt: new Date().toISOString(), warnings: [] };
  try {
    const { data: metadata } = await client.get(base);
    if (metadata.private) throw new Error('RUMZO v0.2 inspects public repositories only.');
    result.description = metadata.description || '';
    result.defaultBranch = metadata.default_branch;
    result.archived = Boolean(metadata.archived);
    result.license = metadata.license?.spdx_id || 'Not identified by GitHub';
    if (metadata.fork && metadata.parent?.full_name) result.forkOf = metadata.parent.full_name;
    if (metadata.size === 0) {
      // size can lag uploads; do not treat metadata alone as proof of an empty tree.
      result.warnings.push('GitHub reports repository size 0; revision lookup remains authoritative.');
    }
    const { data: head, link: commitLinks } = await client.get(`${base}/commits/${encodeURIComponent(metadata.default_branch)}?per_page=100`);
    if (typeof head.sha !== 'string' || !/^[0-9a-f]{40}$/i.test(head.sha)) throw new Error('GitHub did not provide a valid revision.');
    result.sha = head.sha;
    const { data: tree } = await client.get(`${base}/git/trees/${head.sha}?recursive=1`);
    if (!Array.isArray(tree.tree)) throw new Error('GitHub did not provide a file tree.');
    const all = tree.tree.filter((f: any) => f.type === 'blob' || f.type === 'commit');
    result.treeComplete = !tree.truncated && all.length <= 30000;
    result.files = all.slice(0, 30000).map((f: any): Entry => ({ path: f.path, sha: f.sha, kind: f.type === 'commit' ? 'other' : classifyPath(f.path), size: f.size, mode: f.mode }));
    result.counts = emptyCounts();
    for (const f of result.files!) result.counts[f.kind]++;
    result.classification = classifyRepository(result.files!, result.treeComplete);
    result.latestCommit = {
      message: String(head.commit?.message || '').split('\n')[0]!, date: head.commit?.committer?.date || '', url: `https://github.com/${fullName}/commit/${head.sha}`,
      files: (head.files || []).map((f: any) => ({ path: f.filename, kind: classifyPath(f.filename), change: f.status })), complete: !commitLinks.includes('rel="next"')
    };
    result.status = result.treeComplete ? 'ok' : 'partial';
    if (!result.treeComplete) result.warnings.push('File tree is incomplete. Counts cover returned entries only; absence cannot be established.');
    if (result.files!.some(f => f.mode === '160000')) result.warnings.push('Git submodules are listed but their contents are not inspected.');
    const optional = async (task: () => Promise<void>, warning: string) => { try { await task(); } catch { result.status = 'partial'; result.warnings.push(warning); } };
    await optional(async () => {
      const { data: commits } = await client.get(`${base}/commits?sha=${head.sha}&per_page=20`);
      result.recentCommits = commits.map((c: any) => ({ sha: c.sha, message: String(c.commit.message).split('\n')[0], date: c.commit.committer.date, url: `https://github.com/${fullName}/commit/${c.sha}` }));
    }, 'Recent commit sample unavailable. No total commit count is inferred.');
    const readText = async (file: Entry) => {
      if (file.mode === '120000' || file.mode === '160000' || (file.size || 0) > 128000) throw new Error('File outside inspection limits.');
      const { data } = await client.get(`${base}/git/blobs/${file.sha}`);
      if (data.encoding !== 'base64') throw new Error('Unsupported blob encoding.');
      return decodeBase64Text(data.content);
    };
    result.launchHints = [];
    for (const file of result.files!.filter(f => /(^|\/)(package\.json|pyproject\.toml|cargo\.toml|go\.mod)$/i.test(f.path) && f.kind !== 'generated').slice(0, 6)) {
      await optional(async () => {
        const text = await readText(file);
        let hint = 'Manifest present; execution not tested.';
        if (file.path.endsWith('package.json')) { const data = JSON.parse(text); const scripts = Object.keys(data.scripts || {}).slice(0, 12); hint = scripts.length ? `Declared scripts: ${scripts.join(', ')}. Not executed.` : 'Package manifest present; no scripts declared.'; }
        result.launchHints!.push({ path: file.path, hint, source: blobLink(fullName, head.sha, file.path) });
      }, `Could not inspect manifest ${file.path}.`);
    }
    const readme = result.files!.find(f => /^readme(?:\.md|\.rst|\.txt)?$/i.test(f.path));
    result.readmeTokenReference = { status: 'unknown', reason: 'No root README inspected. The repository link was supplied by the user.' };
    if (readme) await optional(async () => {
      const text = await readText(readme);
      const addresses = text.match(/0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g) || [];
      result.readmeTokenReference = { status: 'known', value: addresses.some(a => a.toLowerCase() === token.toLowerCase()), source: blobLink(fullName, head.sha, readme.path) };
    }, 'Root README unavailable; token association is unverified.');
    result.warnings.push('File classification is based on paths and manifests. Source presence does not prove functionality; test files were not executed.');
    result.warnings.push('A README mentioning a token is a repository claim, not independent proof of ownership or endorsement.');
  } catch (error) { result.status = 'unavailable'; result.error = error instanceof Error ? error.message : 'GitHub inspection failed.'; }
  return result;
}
