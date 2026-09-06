import { mkdir, readFile, readdir, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Report } from '../types.js';

const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
export class SnapshotStore {
  readonly directory: string;
  constructor(directory = process.env.RUMZO_DATA_DIR || '.rumzo') { this.directory = resolve(directory); }
  private path(id: string) { if (!validId(id)) throw new Error('Invalid snapshot ID.'); return join(this.directory, `${id}.json`); }
  async save(report: Report) {
    if (report.demo) throw new Error('Demo reports cannot be saved as live evidence.');
    const target = this.path(report.id); await mkdir(this.directory, { recursive: true });
    const temporary = join(this.directory, `.pending-${randomUUID()}`);
    try { await writeFile(temporary, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 }); await rename(temporary, target); }
    finally { await unlink(temporary).catch(() => {}); }
  }
  async get(id: string): Promise<Report> {
    const report = JSON.parse(await readFile(this.path(id), 'utf8')) as Report;
    if (report.schemaVersion !== 1 || report.id !== id) throw new Error('Unsupported or corrupt snapshot.');
    return report;
  }
  async list(): Promise<Report[]> {
    let files: string[]; try { files = await readdir(this.directory); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []; throw e; }
    const reports: Report[] = [];
    for (const file of files.filter(f => f.endsWith('.json') && validId(f.slice(0, -5)))) {
      try { reports.push(await this.get(file.slice(0, -5))); } catch { /* One damaged local file must not hide other snapshots. */ }
    }
    return reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
