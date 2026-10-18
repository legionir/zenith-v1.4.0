#!/usr/bin/env node
// #154: real production-transport acceptance probe, never a mocked green test.
// The transport implementation has changed; this preserved assertion has NOT
// been rerun during the code-first phase. Run only at final validation after build.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import WebSocket, { WebSocketServer } from 'ws';
import { createRealtime } from '../../packages/http/dist/index.js';

const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
const received = [];
server.on('connection', (socket) => {
  socket.on('message', (data) => {
    received.push(data.toString());
    socket.send(data);
  });
});
await once(server, 'listening');
const { port } = server.address();
const url = `ws://127.0.0.1:${port}`;
let candidate;
let control;
try {
  // Prove that the real loopback server/transport works before testing Zenith.
  control = new WebSocket(url);
  await once(control, 'open');
  const echoed = once(control, 'message');
  control.send('control-frame');
  assert.equal((await echoed)[0].toString(), 'control-frame');
  const closed = once(control, 'close');
  control.close();
  await closed;
  received.length = 0;

  candidate = createRealtime({ url, transport: 'ws', autoConnect: false });
  candidate.open();
  candidate.send('zenith-transport-frame');
  await delay(300); // bounded diagnostic probe, not a timing-dependent unit gate
  console.log(
    JSON.stringify({
      issue: 154,
      controlEcho: true,
      status: candidate.status.get(),
      serverReceived: received,
    }),
  );
  assert.deepEqual(
    received,
    ['zenith-transport-frame'],
    '#154: status=open is not proof of a working transport; no frame reached the real WebSocket server',
  );
} finally {
  candidate?.dispose();
  control?.terminate();
  for (const client of server.clients) client.terminate();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
