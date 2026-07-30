// Entry point for the serverless deployment.
//
// Plain JS on purpose: it must not be compiled by the platform's esbuild step,
// which cannot emit the decorator metadata Nest needs for dependency injection.
// `npm run build` (tsc) produces dist/ with that metadata intact.
module.exports = require('../dist/main').default;
