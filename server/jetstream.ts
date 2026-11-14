import WebSocket from 'ws';
import { fold } from './domain.js';
export const restoreCursor = (saved: any): number | undefined =>
  Number.isSafeInteger(saved?.cursor) && saved.cursor > 0 ? saved.cursor : undefined;
type Options = {
  connect?: (url: string) => WebSocket;
  onRecord: (source: any, account: any, event: any) => Promise<void>;
  onStatus: (status: string, error?: string) => Promise<void>;
};
export class JetstreamConnection {
  socket: WebSocket | undefined;
  cursor: number | undefined;
  private key = '';
  private lastEvent = 0;
  private failures = 0;
  private retryAt = 0;
  private busy = 0;
  constructor(
    private options: Options,
    saved?: any,
  ) {
    this.cursor = restoreCursor(saved) ?? (Date.now() - 15 * 60000) * 1000;
  }
  get connected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }
  close() {
    this.socket?.removeAllListeners();
    this.socket?.terminate();
    this.socket = undefined;
    this.key = '';
  }
  reconcile(source: any, accounts: any[]) {
    const valid = accounts.filter((a) => a.enabled !== false && a.did);
    if (!source?.enabled || !valid.length) {
      this.close();
      return;
    }
    const key = JSON.stringify({
      source: [source.id, source.category, source.priority, source.official],
      accounts: valid.map((a) => [a.did, a.handle, a.terms, a.priority, a.category, a.official]),
    });
    if (this.socket && this.key === key && Date.now() - this.lastEvent < 90000) return;
    if (!this.socket && Date.now() < this.retryAt && this.key === key) return;
    this.close();
    this.key = key;
    this.lastEvent = Date.now();
    const url = new URL('wss://jetstream2.us-east.bsky.network/subscribe');
    url.searchParams.append('wantedCollections', 'app.bsky.feed.post');
    for (const a of valid) url.searchParams.append('wantedDids', a.did);
    if (this.cursor)
      url.searchParams.set(
        'cursor',
        String(Math.max(this.cursor - 1000000, (Date.now() - 24 * 3600000) * 1000)),
      );
    const ws = this.options.connect
      ? this.options.connect(url.toString())
      : new WebSocket(url, {
          handshakeTimeout: 15000,
          maxPayload: 512000,
          perMessageDeflate: false,
        });
    this.socket = ws;
    const status = (s: string, error?: string) =>
      this.options.onStatus(s, error).catch((e) => console.error('jetstream status', e.message));
    ws.on('open', () => {
      this.failures = 0;
      void status('live');
    });
    ws.on('ping', () => {
      this.lastEvent = Date.now();
    });
    ws.on('message', async (raw) => {
      this.lastEvent = Date.now();
      try {
        const event = JSON.parse(raw.toString());
        if (event.time_us) this.cursor = event.time_us;
        if (
          event.kind !== 'commit' ||
          event.commit?.operation !== 'create' ||
          event.commit?.collection !== 'app.bsky.feed.post'
        )
          return;
        const account = valid.find((a) => a.did === event.did);
        const text = event.commit?.record?.text;
        if (!account || !text) return;
        if (
          account.terms.length &&
          !account.terms.some((term: string) => fold(text).includes(fold(term)))
        )
          return;
        if (this.busy >= 8) {
          this.retryAt = Date.now() + 1000;
          ws.close();
          return;
        }
        this.busy++;
        try {
          await this.options.onRecord(source, account, event);
        } finally {
          this.busy--;
        }
      } catch (e: any) {
        console.error('jetstream record', e.message);
      }
    });
    ws.on('error', (e) => console.error('jetstream', e.message));
    ws.on('close', () => {
      if (this.socket !== ws) return;
      this.socket = undefined;
      this.failures++;
      this.retryAt = Date.now() + Math.min(60000, 1000 * 2 ** Math.min(this.failures, 6));
      void status('error', 'Ligação interrompida; reconexão automática');
    });
  }
}

export const resolutionFailure = (status: number, failures: number) => ({
  disable: status === 400 || status === 404,
  retrySeconds: Math.min(3600, 60 * 2 ** Math.min(failures, 6)),
});
