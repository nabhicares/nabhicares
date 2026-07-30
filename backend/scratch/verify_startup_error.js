/**
 * A serverless cold start that throws gives you an opaque platform error, so the
 * handler must turn every startup failure into a readable response instead.
 *
 * Usage: node scratch/verify_startup_error.js missing-config|bad-credentials
 */
const scenario = process.argv[2] ?? 'missing-config';

process.env.VERCEL = '1';
process.env.VERCEL_ENV = 'production';

const CONFIG_KEYS = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'BOOTSTRAP_SECRET',
  'CORS_ORIGINS',
  'ALLOW_DEMO_MODE',
  'ALLOW_MOCK_AUTH',
];
for (const key of CONFIG_KEYS) delete process.env[key];

if (scenario === 'bad-credentials') {
  // dotenv does not overwrite existing vars, so these survive main.ts's dotenv.config().
  process.env.FIREBASE_PROJECT_ID = 'test-project';
  process.env.FIREBASE_CLIENT_EMAIL = 'test@test-project.iam.gserviceaccount.com';
  process.env.FIREBASE_PRIVATE_KEY =
    '-----BEGIN PRIVATE KEY-----\nTRUNCATEDKEYDATA\n-----END PRIVATE KEY-----\n';
  process.env.BOOTSTRAP_SECRET = '0123456789abcdef0123';
  process.env.CORS_ORIGINS = 'https://cares.nabhilabs.com';
}

const handler = require('../dist/main').default;

let responded = false;
const res = {
  statusCode: 0,
  headersSent: false,
  headers: {},
  setHeader(k, v) {
    this.headers[k] = v;
  },
  end(body) {
    responded = true;
    console.log(`[${scenario}] status:`, this.statusCode);
    console.log(`[${scenario}] body:`, body);
  },
};

handler({ method: 'GET', url: '/api/v1/health/ping', headers: {} }, res)
  .then(() => {
    if (!responded) {
      console.log(`[${scenario}] no startup failure — request reached the app`);
      process.exit(0);
    }
    if (res.statusCode !== 500) {
      console.error(`[${scenario}] FAIL: expected 500, got ${res.statusCode}`);
      process.exit(1);
    }
    console.log(`[${scenario}] PASS: failure reported as JSON, not a crash`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(`[${scenario}] FAIL: handler rejected instead of responding:`, e.message);
    process.exit(1);
  });
