import { randomUUID } from 'node:crypto';
import { inspect } from '../reports/inspect.js';
import { compareReports } from '../reports/compare.js';
import { validateInput } from '../input.js';
import { SnapshotStore } from '../storage/snapshots.js';
import { MonitoringStore } from './store.js';
import { TelegramNotifier } from './telegram.js';
import type { Comparison, MonitorEvent, MonitorEventType, Report, Watch } from '../types.js';

type Inspector = (input: unknown) => Promise<Report>;
type Clock = () => Date;
export type MonitoringServiceOptions = { store?: MonitoringStore; snapshots?: SnapshotStore; inspector?: Inspector; notifier?: TelegramNotifier; now?: Clock };

const intervals = new Set([5, 15, 30, 60, 360, 1440]);
export function validateInterval(value: unknown): number {
  const interval = Number(value);
  if (!Number.isInteger(interval) || !intervals.has(interval)) throw new Error('Interval must be 5, 15, 30, 60, 360, or 1440 minutes.');
  return interval;
}

function classify(comparison: Comparison | null): { type: MonitorEventType; summary: string } {
  if (!comparison) return { type: 'baseline', summary: 'Baseline receipt captured. Future observations will be compared with this one.' };
  const code = comparison.code.changed.length;
  const contract = comparison.chain.length;
  if (code && contract) return { type: 'code-and-contract-change', summary: `${code} repository file change${code === 1 ? '' : 's'} and ${contract} contract field change${contract === 1 ? '' : 's'} established.` };
  if (code) return { type: 'code-change', summary: `${code} repository file change${code === 1 ? '' : 's'} established; no known contract value changed.` };
  if (contract) return { type: 'contract-change', summary: `${contract} contract field change${contract === 1 ? '' : 's'} established; no repository file change was established.` };
  if (comparison.warnings.length || comparison.code.status !== 'complete') return { type: 'coverage-change', summary: 'No value change was established, but evidence coverage or availability changed.' };
  return { type: 'unchanged', summary: 'No repository or known contract value change was established.' };
}

export class MonitoringService {
  readonly store: MonitoringStore;
  readonly snapshots: SnapshotStore;
  readonly inspector: Inspector;
  readonly notifier: TelegramNotifier;
  readonly now: Clock;

  constructor(options: MonitoringServiceOptions = {}) {
    this.store = options.store ?? new MonitoringStore();
    this.snapshots = options.snapshots ?? new SnapshotStore();
    this.inspector = options.inspector ?? inspect;
    this.notifier = options.notifier ?? new TelegramNotifier();
    this.now = options.now ?? (() => new Date());
  }

  async add(input: unknown, intervalValue: unknown): Promise<Watch> {
    const normalized = validateInput(input);
    const intervalMinutes = validateInterval(intervalValue);
    const state = await this.store.read();
    const existing = state.watches.find(item => item.token.toLowerCase() === normalized.token.toLowerCase() && item.repository.toLowerCase() === normalized.repository.toLowerCase());
    if (existing) throw new Error('This project is already on the watchlist.');
    const createdAt = this.now().toISOString();
    const watch: Watch = { id: randomUUID(), ...normalized, intervalMinutes, enabled: true, createdAt, nextRunAt: createdAt };
    state.watches.unshift(watch);
    await this.store.write(state);
    return watch;
  }

  async setEnabled(id: string, enabled: boolean): Promise<Watch> {
    const state = await this.store.read();
    const watch = state.watches.find(item => item.id === id);
    if (!watch) throw new Error('Watch not found.');
    watch.enabled = enabled;
    if (enabled) watch.nextRunAt = this.now().toISOString();
    await this.store.write(state);
    return watch;
  }

  async remove(id: string): Promise<void> {
    const state = await this.store.read();
    if (!state.watches.some(item => item.id === id)) throw new Error('Watch not found.');
    state.watches = state.watches.filter(item => item.id !== id);
    state.events = state.events.filter(item => item.watchId !== id);
    await this.store.write(state);
  }

  async run(id: string): Promise<MonitorEvent> {
    const state = await this.store.read();
    const watch = state.watches.find(item => item.id === id);
    if (!watch) throw new Error('Watch not found.');
    const startedAt = this.now();
    try {
      let previous: Report | undefined;
      if (watch.lastReportId) previous = await this.snapshots.get(watch.lastReportId).catch(() => undefined);
      if (!previous) previous = (await this.snapshots.list()).find(report => report.input.token.toLowerCase() === watch.token.toLowerCase() && report.input.repository.toLowerCase() === watch.repository.toLowerCase());
      const report = await this.inspector({ token: watch.token, repository: watch.repository });
      await this.snapshots.save(report);
      const comparison = previous ? compareReports(previous, report) : null;
      const result = classify(comparison);
      const event: MonitorEvent = { id: randomUUID(), watchId: watch.id, createdAt: startedAt.toISOString(), type: result.type, summary: result.summary, reportId: report.id, previousReportId: previous?.id, ...(comparison ? { comparison } : {}) };
      watch.lastRunAt = event.createdAt;
      watch.lastReportId = report.id;
      watch.lastEvent = event.type;
      watch.lastError = undefined;
      watch.nextRunAt = new Date(startedAt.getTime() + watch.intervalMinutes * 60_000).toISOString();
      state.events.unshift(event);
      await this.store.write(state);
      await this.notifier.send(watch, event).catch(error => { watch.lastError = error instanceof Error ? error.message : 'Telegram notification failed.'; });
      if (watch.lastError) await this.store.write(state);
      return event;
    } catch (error) {
      const summary = error instanceof Error ? error.message : 'Monitoring run failed.';
      const event: MonitorEvent = { id: randomUUID(), watchId: watch.id, createdAt: startedAt.toISOString(), type: 'error', summary };
      watch.lastRunAt = event.createdAt;
      watch.lastEvent = 'error';
      watch.lastError = summary;
      watch.nextRunAt = new Date(startedAt.getTime() + watch.intervalMinutes * 60_000).toISOString();
      state.events.unshift(event);
      await this.store.write(state);
      await this.notifier.send(watch, event).catch(() => {});
      return event;
    }
  }

  async runDue(): Promise<MonitorEvent[]> {
    const now = this.now().getTime();
    const due = (await this.store.listWatches()).filter(watch => watch.enabled && Date.parse(watch.nextRunAt) <= now);
    const events: MonitorEvent[] = [];
    for (const watch of due) events.push(await this.run(watch.id));
    return events;
  }
}
