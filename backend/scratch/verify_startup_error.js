/** Simulates a Vercel production cold start with missing config. */
process.env.VERCEL = '1';
process.env.VERCEL_ENV = 'production';
for (const key of [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'BOOTSTRAP_SECRET',
  'CORS_ORIGINS',
  'ALLOW_DEMO_MODE',
  'ALLOW_MOCK_AUTH',
]) {
  delete process.env[key];
}

const handler = require('../dist/main').default;

const res = {
  statusCode: 0,
  headers: {},
  setHeader(k, v) {
    this.headers[k] = v;
  },
  end(body) {
    console.log('status:', this.statusCode);
    console.log('content-type:', this.headers['Content-Type']);
    console.log('cors:', this.headers['Access-Control-Allow-Origin']);
    console.log(body);
  },
};

handler({ method: 'GET', url: '/api/v1/health/ping', headers: {} }, res).catch((e) => {
  console.error('handler threw:', e.message);
  process.exit(1);
});
