import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MonitorEvent, MonitoringState, Watch } from '../types.js';

const emptyState = (): MonitoringState => ({ schemaVersion: 1, watches: [], events: [] });

export class MonitoringStore {
  readonly directory: string;
  readonly file: string;

  constructor(directory = process.env.RUMZO_DATA_DIR || '.rumzo') {
    this.directory = resolve(directory);
    this.file = join(this.directory, 'monitoring.json');
  }

  async read(): Promise<MonitoringState> {
    try {
      const state = JSON.parse(await readFile(this.file, 'utf8')) as MonitoringState;
      if (state.schemaVersion !== 1 || !Array.isArray(state.watches) || !Array.isArray(state.events)) throw new Error('Unsupported monitoring state.');
      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyState();
      throw error;
    }
  }

  async write(state: MonitoringState): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const temporary = join(this.directory, `.monitoring-${randomUUID()}.tmp`);
    const clean: MonitoringState = { schemaVersion: 1, watches: state.watches, events: state.events.slice(0, 500) };
    try {
      await writeFile(temporary, JSON.stringify(clean, null, 2) + '\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      await rename(temporary, this.file);
    } finally {
      await unlink(temporary).catch(() => {});
    }
  }

  async getWatch(id: string): Promise<Watch> {
    const watch = (await this.read()).watches.find(item => item.id === id);
    if (!watch) throw new Error('Watch not found.');
    return watch;
  }

  async listWatches(): Promise<Watch[]> { return (await this.read()).watches; }
  async listEvents(watchId?: string): Promise<MonitorEvent[]> {
    const events = (await this.read()).events;
    return watchId ? events.filter(event => event.watchId === watchId) : events;
  }
}
