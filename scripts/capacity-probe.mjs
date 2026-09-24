import process from 'node:process';

const HELP = `
Veylo safe HTTP capacity probe

Usage:
  pnpm capacity:probe -- --url https://veylo.example.com [options]

Options:
  --url <url>             Public Veylo site origin (required)
  --base-path <path>      Next.js base path (default: /app)
  --path <path>           Probe path. Repeatable. Defaults to / and <base-path>/
  --requests <n>          Total requests across all paths (default: 120, max: 5000)
  --concurrency <n>       Parallel workers (default: 8, max: 100)
  --timeout-ms <n>        Per-request timeout (default: 10000)
  --max-p95-ms <n>        Fail when p95 exceeds this threshold (default: 1500)
  --max-error-rate <n>    Fail when error rate exceeds percent (default: 1)
  --allow-http            Permit http:// for local/staging checks
  --json                  Print machine-readable JSON
  --help                  Show this help

The default probe only performs GET requests to public HTML routes. It does not call
OpenRouter, create LiveKit rooms, or send conversation content.
`.trim();

function parseIntArg(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseFloatArg(value, fallback, min, max) {
  const parsed = Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseArgs(argv) {
  const options = {
    url: '',
    basePath: '/app',
    paths: [],
    requests: 120,
    concurrency: 8,
    timeoutMs: 10_000,
    maxP95Ms: 1_500,
    maxErrorRate: 1,
    allowHttp: false,
    json: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '--url') options.url = argv[++i] || '';
    else if (arg === '--base-path') options.basePath = argv[++i] || '';
    else if (arg === '--path') options.paths.push(argv[++i] || '');
    else if (arg === '--requests') options.requests = parseIntArg(argv[++i], 120, 1, 5_000);
    else if (arg === '--concurrency') options.concurrency = parseIntArg(argv[++i], 8, 1, 100);
    else if (arg === '--timeout-ms') options.timeoutMs = parseIntArg(argv[++i], 10_000, 500, 60_000);
    else if (arg === '--max-p95-ms') options.maxP95Ms = parseIntArg(argv[++i], 1_500, 1, 120_000);
    else if (arg === '--max-error-rate') options.maxErrorRate = parseFloatArg(argv[++i], 1, 0, 100);
    else if (arg === '--allow-http') options.allowHttp = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function normalizeBasePath(value) {
  const clean = String(value || '/app').trim();
  if (!clean || clean === '/') return '';
  return `/${clean.replace(/^\/+|\/+$/g, '')}`;
}

function normalizePath(value) {
  const clean = String(value || '/').trim();
  if (!clean) return '/';
  return clean.startsWith('/') ? clean : `/${clean}`;
}

function percentile(values, percent) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percent / 100) * sorted.length) - 1));
  return sorted[index];
}

function round(value) {
  return Math.round(value * 100) / 100;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(HELP);
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    console.log(HELP);
    return;
  }
  if (!options.url) {
    console.error('Missing required --url.');
    console.error(HELP);
    process.exitCode = 2;
    return;
  }

  let target;
  try {
    target = new URL(options.url);
  } catch {
    console.error(`Invalid --url: ${options.url}`);
    process.exitCode = 2;
    return;
  }
  if (!['http:', 'https:'].includes(target.protocol)) {
    console.error('Target URL must use http:// or https://.');
    process.exitCode = 2;
    return;
  }
  if (target.protocol !== 'https:' && !options.allowHttp) {
    console.error('Capacity probe requires HTTPS. Use --allow-http only for local/staging checks.');
    process.exitCode = 2;
    return;
  }

  const basePath = normalizeBasePath(options.basePath);
  const paths = (options.paths.length ? options.paths : ['/', `${basePath || ''}/`])
    .map(normalizePath)
    .filter((path, index, all) => all.indexOf(path) === index);
  const urls = paths.map((path) => new URL(path, target.origin).toString());

  const timings = [];
  const statuses = new Map();
  const errors = [];
  let nextIndex = 0;
  let completed = 0;
  const startedAtMs = performance.now();
  const startedAt = new Date().toISOString();

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= options.requests) return;
      const url = urls[index % urls.length];
      const started = performance.now();
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'text/html,application/xhtml+xml' },
          redirect: 'follow',
          cache: 'no-store',
          signal: AbortSignal.timeout(options.timeoutMs),
        });
        // Drain the body so keep-alive/socket behaviour is representative.
        await response.arrayBuffer();
        const elapsed = performance.now() - started;
        timings.push(elapsed);
        statuses.set(response.status, (statuses.get(response.status) || 0) + 1);
        if (!response.ok) errors.push({ url, status: response.status, detail: `HTTP ${response.status}` });
      } catch (error) {
        const elapsed = performance.now() - started;
        timings.push(elapsed);
        errors.push({ url, status: 0, detail: error instanceof Error ? error.message : String(error) });
      } finally {
        completed += 1;
      }
    }
  }

  const workerCount = Math.min(options.concurrency, options.requests);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const durationMs = performance.now() - startedAtMs;
  const errorRate = completed ? (errors.length / completed) * 100 : 100;
  const p50 = percentile(timings, 50);
  const p95 = percentile(timings, 95);
  const p99 = percentile(timings, 99);
  const rps = durationMs > 0 ? (completed / durationMs) * 1000 : 0;
  const thresholdPass = errorRate <= options.maxErrorRate && (p95 ?? Infinity) <= options.maxP95Ms;

  const summary = {
    target: target.origin,
    paths,
    startedAt,
    finishedAt: new Date().toISOString(),
    requests: completed,
    concurrency: workerCount,
    durationMs: round(durationMs),
    requestsPerSecond: round(rps),
    latencyMs: {
      min: timings.length ? round(Math.min(...timings)) : null,
      p50: p50 === null ? null : round(p50),
      p95: p95 === null ? null : round(p95),
      p99: p99 === null ? null : round(p99),
      max: timings.length ? round(Math.max(...timings)) : null,
    },
    errorCount: errors.length,
    errorRatePercent: round(errorRate),
    statusCounts: Object.fromEntries([...statuses.entries()].sort(([a], [b]) => a - b)),
    thresholds: {
      maxP95Ms: options.maxP95Ms,
      maxErrorRatePercent: options.maxErrorRate,
      pass: thresholdPass,
    },
    sampleErrors: errors.slice(0, 10),
  };

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`\nVeylo safe capacity probe: ${target.origin}`);
    console.log(`Paths: ${paths.join(', ')}`);
    console.log(`Requests: ${completed} · concurrency: ${workerCount} · duration: ${round(durationMs)} ms`);
    console.log(`Throughput: ${round(rps)} req/s`);
    console.log(`Latency: p50 ${round(p50 ?? 0)} ms · p95 ${round(p95 ?? 0)} ms · p99 ${round(p99 ?? 0)} ms`);
    console.log(`Errors: ${errors.length} (${round(errorRate)}%)`);
    console.log(`Thresholds: p95 <= ${options.maxP95Ms} ms; errors <= ${options.maxErrorRate}% — ${thresholdPass ? 'PASS' : 'FAIL'}`);
    if (errors.length) console.log(`Sample error: ${errors[0].detail} (${errors[0].url})`);
  }

  if (!thresholdPass) process.exitCode = 1;
}

await main();
