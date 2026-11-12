import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, request, Server } from 'node:http';
import { networkInterfaces } from 'node:os';
import { mock, test } from 'node:test';

// Build first; run with Node.js 22.3+:
// node --experimental-test-module-mocks --test tests/security/auth-listener.test.mjs
mock.module('open', { defaultExport: async () => undefined });
mock.module('../../dist/utils/logger.js', {
  defaultExport: { info() {}, warn() {}, success() {}, error() {} },
});
const { AuthManager } = await import('../../dist/core/auth.js');

function send(host, port, path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ ...options, host, port, path, agent: false }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(2000, () => req.destroy(new Error('Request timeout')));
    req.end(options.body);
  });
}

async function startLogin(
  t,
  { port = 0, useDefault = false, save = true } = {}
) {
  const auth = AuthManager.getInstance();
  const saveToken = t.mock.method(auth, 'setToken', async () => save);
  const originalListen = Server.prototype.listen;
  const originalSetTimeout = globalThis.setTimeout;
  let server, timer, expire;
  t.mock.method(Server.prototype, 'listen', function (...args) {
    server = this;
    return Reflect.apply(originalListen, this, args);
  });
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    const handle = originalSetTimeout(callback, delay, ...args);
    if (delay === 600000) {
      timer = handle;
      expire = callback;
    }
    return handle;
  });
  t.after(() => {
    clearTimeout(timer);
    server?.closeAllConnections();
    server?.close();
  });
  // Handle rejection immediately, including bind errors and timeout paths.
  const completion = (useDefault ? auth.login() : auth.login(port)).then(
    () => null,
    error => error
  );
  await once(server, 'listening');
  return {
    server,
    address: server.address(),
    completion,
    saveToken,
    expire: () => expire(),
  };
}

const callbacks = [
  { name: 'GET query', path: '?token=test-token' },
  {
    name: 'POST JSON',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'test-token' }),
  },
  {
    name: 'POST form',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'token=test-token',
  },
  { name: 'POST query', method: 'POST', path: '?token=test-token' },
];
for (const callback of callbacks) {
  test(`${callback.name} completes local login and closes the listener`, async t => {
    const { address, server, completion, saveToken } = await startLogin(t);
    assert.equal(address.address, '127.0.0.1');
    assert.equal(address.family, 'IPv4');
    const closed = once(server, 'close');
    const response = await send(
      '127.0.0.1',
      address.port,
      `/auth/callback${callback.path || ''}`,
      callback
    );
    assert.equal(response.status, 200);
    assert.match(response.body, /Authentication Successful/);
    assert.equal(await completion, null);
    assert.equal(saveToken.mock.callCount(), 1);
    assert.deepEqual(saveToken.mock.calls[0].arguments, ['test-token']);
    await closed;
    assert.equal(server.listening, false);
  });
}

test('default port 4444 accepts the existing localhost callback URL', async t => {
  const { address, completion } = await startLogin(t, { useDefault: true });
  assert.equal(address.port, 4444);
  const response = await send(
    'localhost',
    4444,
    '/auth/callback?token=test-token'
  );
  assert.match(response.body, /Authentication Successful/);
  assert.equal(await completion, null);
});

test('explicit custom port remains loopback-only', async t => {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const { address, completion } = await startLogin(t, { port });
  assert.equal(address.port, port);
  assert.equal(address.address, '127.0.0.1');
  await send('127.0.0.1', port, '/auth/callback?token=test-token');
  assert.equal(await completion, null);
});

const networkAddresses = [
  ...new Set(
    Object.values(networkInterfaces())
      .flat()
      .filter(entry => entry && entry.family === 'IPv4' && !entry.internal)
      .map(entry => entry.address)
  ),
];
test('network checks have a non-loopback IPv4 interface', t => {
  if (!networkAddresses.length)
    t.skip('No network interface available; network rejection untested');
});
for (const host of networkAddresses) {
  test(`network callback is refused on ${host} while local login still works`, async t => {
    // Positive control distinguishes isolation from an unreachable interface.
    const control = createServer((_req, res) => res.end('reachable'));
    t.after(() => {
      control.closeAllConnections();
      control.close();
    });
    control.listen(0, host);
    await once(control, 'listening');
    assert.equal(
      (await send(host, control.address().port, '/')).body,
      'reachable'
    );
    await new Promise(resolve => control.close(resolve));
    const { address, completion, saveToken } = await startLogin(t);
    for (const method of ['GET', 'POST']) {
      await assert.rejects(
        send(host, address.port, '/auth/callback?token=attacker-token', {
          method,
        }),
        { code: 'ECONNREFUSED' }
      );
    }
    assert.equal(saveToken.mock.callCount(), 0);
    await send('127.0.0.1', address.port, '/auth/callback?token=test-token');
    assert.equal(await completion, null);
    assert.deepEqual(saveToken.mock.calls[0].arguments, ['test-token']);
  });
}

for (const method of ['GET', 'POST']) {
  test(`${method} missing token rejects login without saving credentials`, async t => {
    const { address, completion, saveToken } = await startLogin(t);
    const response = await send('127.0.0.1', address.port, '/auth/callback', {
      method,
    });
    assert.match(response.body, /Invalid or missing authentication token/);
    assert.match((await completion).message, /Invalid authentication token/);
    assert.equal(saveToken.mock.callCount(), 0);
  });
  test(`${method} persistence failure rejects login`, async t => {
    const { address, completion } = await startLogin(t, { save: false });
    const response = await send(
      '127.0.0.1',
      address.port,
      '/auth/callback?token=test-token',
      { method }
    );
    assert.match(response.body, /Failed to save authentication token/);
    assert.match((await completion).message, /Failed to save token/);
  });
}

test('CORS preflight allows a subsequent callback', async t => {
  const { address, server, completion, saveToken } = await startLogin(t);
  const response = await send('127.0.0.1', address.port, '/auth/callback', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://partner.zid.sa',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type',
    },
  });
  assert.equal(response.status, 204);
  assert.equal(server.listening, true);
  assert.equal(saveToken.mock.callCount(), 0);
  await send('127.0.0.1', address.port, '/auth/callback?token=test-token');
  assert.equal(await completion, null);
});

test('authentication timeout closes the listener and rejects login', async t => {
  const { server, completion, expire, saveToken } = await startLogin(t);
  expire();
  assert.match((await completion).message, /Authentication timeout/);
  assert.equal(server.listening, false);
  assert.equal(saveToken.mock.callCount(), 0);
});

test('occupied loopback port rejects login', async t => {
  const occupied = createServer();
  t.after(() => occupied.close());
  occupied.listen(0, '127.0.0.1');
  await once(occupied, 'listening');
  await assert.rejects(startLogin(t, { port: occupied.address().port }), {
    code: 'EADDRINUSE',
  });
});
