import { mkdir, writeFile } from 'node:fs/promises';
import { demoSession } from '../dist/demo/session.js';
import { toMarkdown } from '../dist/reports/markdown.js';
const { before, report, comparison } = demoSession();
const directory = new URL('../examples/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const [name, value] of Object.entries({ 'demo-before.json': before, 'demo-after.json': report, 'demo-comparison.json': comparison })) {
  await writeFile(new URL(name, directory), JSON.stringify(value, null, 2) + '\n');
}
await writeFile(new URL('demo-receipt.md', directory), toMarkdown(report));
process.stdout.write('Synthetic demo examples exported. No provider requests performed.\n');
