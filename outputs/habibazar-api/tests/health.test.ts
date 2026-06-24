import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

// Set required env vars
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
process.env['ACCESS_TOKEN_SECRET'] = 'test_access_secret_min_32_chars_abcdef';
process.env['REFRESH_TOKEN_SECRET'] = 'test_refresh_secret_min_32_chars_abcdef';
process.env['ENCRYPTION_KEY'] = '0000000000000000000000000000000000000000000000000000000000000000';
process.env['OWNER_EMAIL'] = 'test@example.com';
process.env['SMTP_HOST'] = 'localhost';
process.env['SMTP_USER'] = 'test@example.com';
process.env['SMTP_PASS'] = 'password';
process.env['MAIL_FROM'] = 'noreply@example.com';
process.env['MAIL_NOTIFY_TO'] = 'admin@example.com';
process.env['CORS_ORIGINS'] = 'http://localhost:3000';

function makeRequest(
  server: http.Server,
  path: string,
  method = 'GET',
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const address = server.address();
    if (!address || typeof address !== 'object') {
      reject(new Error('Server not listening'));
      return;
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port: address.port,
        path,
        method,
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode ?? 0, body: data });
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('Health endpoints', async () => {
  let server: http.Server;

  // Mock prisma before importing app
  mock.module('../src/db/prisma', {
    namedExports: {},
    defaultExport: {
      $connect: async () => {},
      $disconnect: async () => {},
      $queryRaw: async () => [{ '?column?': 1n }],
    },
  });

  it('GET /health returns 200 with status ok', async () => {
    const { default: app } = await import('../src/app');
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    const response = await makeRequest(server, '/health');
    assert.equal(response.status, 200);
    assert.deepEqual((response.body as { data: { status: string } }).data?.status ?? (response.body as { status: string }).status, 'ok');

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /nonexistent returns 404', async () => {
    const { default: app } = await import('../src/app');
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    const response = await makeRequest(server, '/api/v1/nonexistent-route-xyz');
    assert.equal(response.status, 404);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
