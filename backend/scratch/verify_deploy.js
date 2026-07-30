/**
 * Boots dist/main.js the way the deployment does (a listening server) and checks
 * the three outcomes that matter:
 *
 *   healthy         - app serves requests and answers CORS preflight for the web origin
 *   missing-config  - absent env vars are reported as JSON, not a dead port
 *   bad-credentials - a truncated FIREBASE_PRIVATE_KEY is reported as JSON
 *
 * A startup crash must never leave the port unbound, because the platform can then
 * only show a generic invocation error with no cause.
 *
 * Usage: node scratch/verify_deploy.js
 */
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const ORIGIN = 'https://cares.nabhilabs.com';
const CONFIG_KEYS = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'BOOTSTRAP_SECRET',
  'CORS_ORIGINS',
  'ALLOW_DEMO_MODE',
  'ALLOW_MOCK_AUTH',
];

const SCENARIOS = {
  healthy: {
    ALLOW_DEMO_MODE: 'true',
    CORS_ORIGINS: ORIGIN,
  },
  'missing-config': {},
  'bad-credentials': {
    FIREBASE_PROJECT_ID: 'test-project',
    FIREBASE_CLIENT_EMAIL: 'test@test-project.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nTRUNCATED\n-----END PRIVATE KEY-----\n',
    BOOTSTRAP_SECRET: '0123456789abcdef0123',
    CORS_ORIGINS: ORIGIN,
  },
};

function startServer(scenario, port) {
  const env = { ...process.env, VERCEL: '1', VERCEL_ENV: 'production', PORT: String(port) };
  for (const key of CONFIG_KEYS) delete env[key];
  Object.assign(env, SCENARIOS[scenario]);

  const child = spawn(process.execPath, [path.join(__dirname, '..', 'dist', 'main.js')], {
    env,
    // main.ts calls dotenv.config(), which reads .env relative to cwd — run outside
    // the project so the local .env cannot refill the vars this scenario cleared.
    cwd: os.tmpdir(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const forward = (buf) => {
    if (process.env.VERBOSE) process.stdout.write(`  [${scenario}] ${buf}`);
  };
  child.stdout.on('data', forward);
  child.stderr.on('data', forward);
  return child;
}

async function waitForPort(port, child) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`process exited early (${child.exitCode})`);
    try {
      await fetch(`http://127.0.0.1:${port}/api/v1/health/ping`, { method: 'GET' });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error('server never bound the port');
}

async function run(scenario, port, expect) {
  const child = startServer(scenario, port);
  const results = [];
  try {
    await waitForPort(port, child);

    const get = await fetch(`http://127.0.0.1:${port}/api/v1/health/ping`, {
      headers: { Origin: ORIGIN, Authorization: 'Bearer mock-patient' },
    });
    const body = await get.text();
    results.push([`GET status ${get.status} (want ${expect.status})`, get.status === expect.status]);

    if (expect.detail) {
      results.push([`body names the cause`, body.includes(expect.detail)]);
    }

    if (expect.preflight) {
      const pre = await fetch(`http://127.0.0.1:${port}/api/v1/appointments`, {
        method: 'OPTIONS',
        headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'GET' },
      });
      const acao = pre.headers.get('access-control-allow-origin');
      results.push([`preflight ${pre.status} ACAO=${acao}`, pre.status === 204 && acao === ORIGIN]);
    }
  } finally {
    child.kill();
  }
  return results;
}

(async () => {
  const cases = [
    ['healthy', 4311, { status: 200, preflight: true }],
    ['missing-config', 4312, { status: 500, detail: 'Missing: FIREBASE_PROJECT_ID' }],
    ['bad-credentials', 4313, { status: 500, detail: 'invalid or truncated' }],
  ];

  let failures = 0;
  for (const [scenario, port, expect] of cases) {
    try {
      for (const [label, ok] of await run(scenario, port, expect)) {
        if (!ok) failures++;
        console.log(`${ok ? 'PASS' : 'FAIL'} [${scenario}] ${label}`);
      }
    } catch (err) {
      failures++;
      console.log(`FAIL [${scenario}] ${err.message}`);
    }
  }

  console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
})();
