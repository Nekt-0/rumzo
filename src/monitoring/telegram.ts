import type { MonitorEvent, Watch } from '../types.js';

export type TelegramOptions = { token?: string; chatId?: string; fetcher?: typeof fetch };

export class TelegramNotifier {
  private readonly token?: string;
  private readonly chatId?: string;
  private readonly fetcher: typeof fetch;

  constructor(options: TelegramOptions = {}) {
    this.token = options.token ?? process.env.RUMZO_TELEGRAM_BOT_TOKEN;
    this.chatId = options.chatId ?? process.env.RUMZO_TELEGRAM_CHAT_ID;
    this.fetcher = options.fetcher ?? fetch;
  }

  get configured() { return Boolean(this.token && this.chatId); }

  async send(watch: Watch, event: MonitorEvent): Promise<void> {
    if (!this.configured || event.type === 'unchanged' || event.type === 'baseline') return;
    const response = await this.fetcher(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.chatId,
        disable_web_page_preview: true,
        text: `RUMZO ${event.type.replaceAll('-', ' ').toUpperCase()}\n${watch.repository}\n${watch.token}\n\n${event.summary}`
      }),
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error(`Telegram notification failed (${response.status}).`);
  }
}
