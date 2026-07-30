/**
 * The deployment serves api/index.js, which must load the tsc-compiled dist/ and
 * boot Nest. esbuild-compiled sources silently lose decorator metadata and break
 * dependency injection, so this drives the real entry point end to end.
 *
 * Boots in demo mode so no Firebase credentials are required.
 */
process.env.VERCEL = '1';
process.env.VERCEL_ENV = 'production';
process.env.ALLOW_DEMO_MODE = 'true';
process.env.CORS_ORIGINS = 'https://cares.nabhilabs.com';

const http = require('http');
const handler = require('../api/index');

if (typeof handler !== 'function') {
  console.error('FAIL: entry point did not export a handler, got', typeof handler);
  process.exit(1);
}

const server = http.createServer((req, res) => handler(req, res));

server.listen(0, async () => {
  const { port } = server.address();
  const origin = 'https://cares.nabhilabs.com';
  let failures = 0;

  const check = async (name, path, method, expectStatus) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        Origin: origin,
        ...(method === 'OPTIONS'
          ? { 'Access-Control-Request-Method': 'GET' }
          : { Authorization: 'Bearer mock-patient' }),
      },
    });
    const acao = res.headers.get('access-control-allow-origin');
    const ok = res.status === expectStatus;
    if (!ok) failures++;
    console.log(
      `${ok ? 'PASS' : 'FAIL'} ${name}: status=${res.status} (want ${expectStatus}) ACAO=${acao}`,
    );
    return { res, acao };
  };

  try {
    await check('health', '/api/v1/health/ping', 'GET', 200);

    const { acao } = await check('preflight', '/api/v1/appointments', 'OPTIONS', 204);
    if (acao !== origin) {
      console.error(`FAIL preflight: expected ACAO ${origin}, got ${acao}`);
      failures++;
    }
  } catch (err) {
    console.error('FAIL: request threw:', err.message);
    failures++;
  }

  server.close();
  console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
});
