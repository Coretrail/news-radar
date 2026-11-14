import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocketServer, WebSocket } from 'ws';
import { once } from 'node:events';
import { JetstreamConnection, restoreCursor } from '../server/jetstream.js';
test('última conta desativada fecha stream e alterações de fonte renovam metadados', async () => {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await once(server, 'listening');
  const address = server.address() as any;
  const urls: string[] = [];
  let seen: any;
  const manager = new JetstreamConnection({
    connect: (url) => {
      urls.push(url);
      return new WebSocket('ws://127.0.0.1:' + address.port);
    },
    onRecord: async (source) => {
      seen = source;
    },
    onStatus: async () => {},
  });
  try {
    const source = { id: 1, enabled: true, priority: 'info', official: false, category: 'mundo' };
    const accounts = [
      {
        did: 'did:plc:test',
        handle: 'example.org',
        priority: 'priority',
        category: 'mundo',
        terms: [],
        official: false,
      },
    ];
    let connection = once(server, 'connection');
    manager.reconcile(source, accounts);
    let [socket] = await connection;
    await once(manager.socket!, 'open');
    connection = once(server, 'connection');
    manager.reconcile({ ...source, official: true, priority: 'urgent' }, accounts);
    [socket] = await connection;
    await once(manager.socket!, 'open');
    socket.send(
      JSON.stringify({
        kind: 'commit',
        did: 'did:plc:test',
        time_us: Date.now() * 1000,
        commit: {
          operation: 'create',
          collection: 'app.bsky.feed.post',
          rkey: 'abc',
          record: { text: 'Real protocol fixture', createdAt: new Date().toISOString() },
        },
      }),
    );
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(seen.official, true);
    assert.equal(seen.priority, 'urgent');
    const closed = once(socket, 'close');
    manager.reconcile(source, []);
    await closed;
    assert.equal(manager.connected, false);
    assert.equal(manager.socket, undefined);
    assert.equal(urls.length, 2);
    assert.ok(
      Number(new URL(urls[0]).searchParams.get('cursor')) > Date.now() * 1000 - 16 * 60000 * 1000,
      'primeiro arranque recupera histórico recente',
    );
  } finally {
    manager.close();
    server.close();
  }
});
test('restaura cursor persistido para recuperar falha sem aceitar valores inválidos', () => {
  assert.equal(restoreCursor({ cursor: 1794617000000000 }), 1794617000000000);
  assert.equal(restoreCursor({ cursor: -1 }), undefined);
  assert.equal(restoreCursor({ cursor: 'bad' }), undefined);
});

test('falhas transitórias na resolução preservam conta e aplicam backoff', async () => {
  const { resolutionFailure } = await import('../server/jetstream.js');
  assert.deepEqual(resolutionFailure(503, 1), { disable: false, retrySeconds: 120 });
  assert.equal(resolutionFailure(400, 0).disable, true);
  assert.equal(resolutionFailure(0, 10).retrySeconds, 3600);
});
