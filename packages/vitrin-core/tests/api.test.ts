import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  ApiService,
  authHeaders,
  extractErrorMessage,
  redactHeaders,
  type TokenProvider,
  type ZidCredentials,
} from '../src/index.js';

interface Seen {
  method: string;
  url: string;
  headers: IncomingMessage['headers'];
  body: string;
}

let server: Server;
let baseURL: string;
const seen: Seen[] = [];
// Status codes to answer with, in order; 200 once the queue is empty.
let statuses: number[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      seen.push({
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body,
      });
      const status = statuses.shift() ?? 200;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify(
          status === 200
            ? { status: 'object', payload: [], id: 'theme-1' }
            : { message: { description: `status ${status}` } }
        )
      );
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));

beforeEach(() => {
  seen.length = 0;
  statuses = [];
});

function client(
  credentials: ZidCredentials | null,
  onUnauthorized?: TokenProvider['onUnauthorized']
) {
  let current = credentials;
  const provider: TokenProvider = {
    getCredentials: vi.fn(async () => current),
  };
  if (onUnauthorized) provider.onUnauthorized = vi.fn(onUnauthorized);
  const api = new ApiService({
    tokenProvider: provider,
    baseURL: () => baseURL,
    userAgent: 'vitrin-core-test',
  });
  return {
    api,
    provider,
    setCredentials: (next: ZidCredentials | null) => (current = next),
  };
}

describe('credentials', () => {
  it('sends a partner token, plus Bearer on /v2', async () => {
    const { api } = client({ kind: 'partner', token: 'p-token' });
    await api.getDevStores();
    await api.getThemes();

    expect(seen[0]!.headers['x-partner-token']).toBe('p-token');
    expect(seen[0]!.headers['authorization']).toBeUndefined();
    expect(seen[1]!.url).toBe('/v2/themes/');
    expect(seen[1]!.headers['authorization']).toBe('Bearer p-token');
    expect(seen[1]!.headers['user-agent']).toBe('vitrin-core-test');
  });

  it('sends a manager token as the dashboard does', async () => {
    const { api } = client({
      kind: 'manager',
      token: 'm-token',
      storeId: '3107131',
    });
    await api.getThemes();

    const headers = seen[0]!.headers;
    expect(headers['x-manager-token']).toBe('m-token');
    expect(headers['role']).toBe('Manager');
    expect(headers['store-id']).toBe('3107131');
    expect(headers['x-partner-token']).toBeUndefined();
    expect(headers['authorization']).toBeUndefined();
  });

  it('keeps a per-request store-id over the default one', async () => {
    const { api } = client({ kind: 'manager', token: 'm', storeId: '1' });
    await api.activateTheme('2', 'inst-1');
    expect(seen[0]!.headers['store-id']).toBe('2');
  });

  it('sends no credentials when there are none', async () => {
    const { api } = client(null);
    await api.getThemes();
    expect(seen[0]!.headers['x-partner-token']).toBeUndefined();
    expect(seen[0]!.headers['x-manager-token']).toBeUndefined();
  });
});

describe('401 handling', () => {
  it('retries once with fresh credentials when the host asks', async () => {
    const { api, provider, setCredentials } = client(
      { kind: 'partner', token: 'old' },
      async () => {
        setCredentials({ kind: 'partner', token: 'new' });
        return 'retry';
      }
    );
    statuses = [401];

    await expect(api.getThemes()).resolves.toBeTruthy();
    expect(seen.map(s => s.headers['x-partner-token'])).toEqual(['old', 'new']);
    expect(seen[1]!.headers['authorization']).toBe('Bearer new');
    expect(provider.onUnauthorized).toHaveBeenCalledOnce();
  });

  it('does not ask again when the retry also gets 401', async () => {
    const { api, provider } = client(
      { kind: 'partner', token: 't' },
      async () => 'retry'
    );
    statuses = [401, 401];

    await expect(api.getThemes()).rejects.toThrow(
      'Authentication failed: status 401'
    );
    expect(seen).toHaveLength(2);
    expect(provider.onUnauthorized).toHaveBeenCalledOnce();
  });

  it("throws the host's error", async () => {
    const { api } = client(
      { kind: 'partner', token: 't' },
      async detail => new Error(`custom: ${detail}`)
    );
    statuses = [401];
    await expect(api.getThemes()).rejects.toThrow('custom: status 401');
  });

  it('maps other statuses to readable errors', async () => {
    const { api } = client({ kind: 'partner', token: 't' });
    statuses = [403];
    await expect(api.getThemes()).rejects.toThrow('Access denied: status 403');
    statuses = [500];
    await expect(api.getThemes()).rejects.toThrow(
      'Server error (500): status 500'
    );
  });
});

describe('merchant custom themes', () => {
  let dir: string;
  let zip: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'vitrin-core-api-'));
    zip = join(dir, 'theme.zip');
    writeFileSync(zip, 'PK-fake-zip');
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('uploads a new custom theme as multipart with the zip', async () => {
    const { api } = client({ kind: 'manager', token: 'm', storeId: '9' });
    await api.createCustomTheme({
      name: 'متجري',
      zipPath: zip,
      description: 'AI',
    });

    const req = seen[0]!;
    expect(req.method).toBe('POST');
    expect(req.url).toBe('/v2/themes/custom/');
    expect(req.headers['content-type']).toMatch(
      /^multipart\/form-data; boundary=/
    );
    expect(req.headers['store-id']).toBe('9');
    expect(req.body).toContain('name="name"');
    expect(req.body).toContain('متجري');
    expect(req.body).toContain('name="file"; filename="theme.zip"');
    expect(req.body).toContain('Content-Type: application/zip');
    expect(req.body).toContain('PK-fake-zip');
  });

  it('re-uploads to an existing custom theme', async () => {
    const { api } = client({ kind: 'manager', token: 'm', storeId: '9' });
    await api.updateCustomTheme('t-1', { zipPath: zip });
    expect(seen[0]!.url).toBe('/v2/themes/t-1/custom/');
    expect(seen[0]!.body).toContain('PK-fake-zip');
  });
});

describe('helpers', () => {
  it('redacts credentials from logged headers', () => {
    expect(
      redactHeaders({
        Authorization: 'Bearer x',
        'X-Manager-Token': 'm',
        'x-partner-token': 'p',
        'Access-Token': 'a',
        'store-id': '1',
      })
    ).toEqual({
      Authorization: '[redacted]',
      'X-Manager-Token': '[redacted]',
      'x-partner-token': '[redacted]',
      'Access-Token': '[redacted]',
      'store-id': '1',
    });
  });

  it('builds headers per credential kind', () => {
    expect(
      authHeaders({ kind: 'partner', token: 'p' }, '/v1/market/partner')
    ).toEqual({
      'x-partner-token': 'p',
    });
    expect(
      authHeaders({ kind: 'manager', token: 'm', storeId: '5' }, '/v2/themes/')
    ).toEqual({
      'X-Manager-Token': 'm',
      role: 'Manager',
      'store-id': '5',
    });
  });

  it.each([
    [{ message: 'plain' }, 'plain'],
    [{ message: { description: 'described' } }, 'described'],
    [{ detail: 'detailed' }, 'detailed'],
    [{ errors: { name: ['name is required'] } }, 'name is required'],
    [{ non_field_errors: ['bad'] }, 'bad'],
    [null, null],
  ])('extracts an error message from %j', (data, expected) => {
    expect(extractErrorMessage(data)).toBe(expected);
  });
});
