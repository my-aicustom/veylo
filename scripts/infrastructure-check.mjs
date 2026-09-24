import fs from 'node:fs';
import process from 'node:process';

const HELP = `
Veylo infrastructure configuration check

Usage:
  pnpm infra:check -- --livekit /path/livekit.yaml --nginx /path/veylo.conf
  pnpm infra:check:template

Options:
  --livekit <path>   LiveKit YAML/config path
  --nginx <path>     Nginx Veylo TLS edge config path
  --template         Allow example domains/placeholder credentials but validate structure
  --json             Print machine-readable JSON
  --help             Show this help

This is a static safety gate. It does not prove DNS, certificate trust, firewall/NAT,
TURN reachability, or WebRTC media behavior on the real network.
`.trim();

function parseArgs(argv) {
  const out = { livekit: '', nginx: '', template: false, json: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '--livekit') out.livekit = argv[++i] || '';
    else if (arg === '--nginx') out.nginx = argv[++i] || '';
    else if (arg === '--template') out.template = true;
    else if (arg === '--json') out.json = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

function read(path) {
  if (!path) throw new Error('Missing configuration path.');
  if (!fs.existsSync(path)) throw new Error(`File not found: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function lineValue(source, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`^\\s*${escaped}\\s*:\\s*([^#\\r\\n]+)`, 'mi'));
  return match?.[1]?.trim() || '';
}

function isPlaceholder(value) {
  return /example\.com|change_me|replace-me|your[-_. ]|changeme|placeholder/i.test(value || '');
}

function main() {
  let options;
  try { options = parseArgs(process.argv.slice(2)); }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(HELP);
    process.exitCode = 2;
    return;
  }

  if (options.help) { console.log(HELP); return; }
  if (options.template) {
    options.livekit ||= 'deploy/production/livekit.yaml.example';
    options.nginx ||= 'deploy/production/nginx-tls.conf.example';
  }
  if (!options.livekit || !options.nginx) {
    console.error('Both --livekit and --nginx are required unless --template is used.');
    console.error(HELP);
    process.exitCode = 2;
    return;
  }

  const checks = [];
  const record = (area, name, ok, detail = '', level = 'fail') => checks.push({
    area, name, status: ok ? 'PASS' : level === 'warn' ? 'WARN' : 'FAIL', detail,
  });

  let livekit = '';
  let nginx = '';
  try { livekit = read(options.livekit); }
  catch (error) { record('livekit', 'Configuration file readable', false, error.message); }
  try { nginx = read(options.nginx); }
  catch (error) { record('nginx', 'Configuration file readable', false, error.message); }

  if (livekit) {
    record('livekit', 'Public IP advertisement', /use_external_ip\s*:\s*true/i.test(livekit), lineValue(livekit, 'use_external_ip') || 'missing');
    record('livekit', 'WebRTC TCP fallback port', /^\s*tcp_port\s*:\s*\d+/mi.test(livekit), lineValue(livekit, 'tcp_port') || 'missing');
    record('livekit', 'WebRTC UDP range start', /^\s*port_range_start\s*:\s*\d+/mi.test(livekit), lineValue(livekit, 'port_range_start') || 'missing');
    record('livekit', 'WebRTC UDP range end', /^\s*port_range_end\s*:\s*\d+/mi.test(livekit), lineValue(livekit, 'port_range_end') || 'missing');
    record('livekit', 'TURN enabled', /\bturn\s*:[\s\S]*?\benabled\s*:\s*true/i.test(livekit), lineValue(livekit, 'enabled') || 'missing');
    const turnDomain = lineValue(livekit, 'domain');
    record('livekit', 'TURN domain configured', Boolean(turnDomain) && (options.template || !isPlaceholder(turnDomain)), turnDomain || 'missing');
    const tlsPort = lineValue(livekit, 'tls_port');
    record('livekit', 'TURN TLS port configured', /^\d+$/.test(tlsPort), tlsPort || 'missing');
    const cert = lineValue(livekit, 'cert_file');
    const key = lineValue(livekit, 'key_file');
    record('livekit', 'TURN certificate configured', Boolean(cert), cert || 'missing');
    record('livekit', 'TURN private key configured', Boolean(key), key || 'missing');
    record('livekit', 'Prometheus metrics enabled', /^\s*prometheus_port\s*:\s*\d+/mi.test(livekit), lineValue(livekit, 'prometheus_port') || 'missing', 'warn');
    if (!options.template) {
      record('livekit', 'No placeholder credentials/domains', !isPlaceholder(livekit), isPlaceholder(livekit) ? 'placeholder text found' : 'clean');
    }
  }

  if (nginx) {
    record('nginx', 'HTTPS listener', /listen\s+443\s+ssl/i.test(nginx), 'listen 443 ssl');
    record('nginx', 'TLS 1.2 and 1.3', /ssl_protocols[^;]*TLSv1\.2[^;]*TLSv1\.3/i.test(nginx), 'ssl_protocols');
    record('nginx', 'Server tokens disabled', /server_tokens\s+off\s*;/i.test(nginx), 'server_tokens off');
    record('nginx', 'Certificate configured', /ssl_certificate\s+[^;]+;/i.test(nginx), 'ssl_certificate');
    record('nginx', 'Private key configured', /ssl_certificate_key\s+[^;]+;/i.test(nginx), 'ssl_certificate_key');
    record('nginx', 'App proxy location', /location\s+\/app\b/i.test(nginx), 'location /app');
    record('nginx', 'WebSocket upgrade forwarding', /proxy_set_header\s+Upgrade\s+\$http_upgrade/i.test(nginx), 'Upgrade header');
    record('nginx', 'Forwarded HTTPS protocol', /proxy_set_header\s+X-Forwarded-Proto\s+https/i.test(nginx), 'X-Forwarded-Proto https');
    record('nginx', 'Real IP overwritten from socket peer', /proxy_set_header\s+X-Real-IP\s+\$remote_addr/i.test(nginx), 'X-Real-IP $remote_addr');
    for (const header of ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy']) {
      record('nginx', `Security header: ${header}`, new RegExp(`add_header\\s+${header}\\b`, 'i').test(nginx), header);
    }
    if (!options.template) {
      record('nginx', 'No example domain remains', !/example\.com/i.test(nginx), /example\.com/i.test(nginx) ? 'example.com found' : 'clean');
    }
  }

  const summary = {
    livekit: options.livekit,
    nginx: options.nginx,
    template: options.template,
    pass: checks.filter((item) => item.status === 'PASS').length,
    warn: checks.filter((item) => item.status === 'WARN').length,
    fail: checks.filter((item) => item.status === 'FAIL').length,
    checks,
  };

  if (options.json) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(`\nVeylo infrastructure check${options.template ? ' (template)' : ''}`);
    for (const item of checks) console.log(`[${item.status}] ${item.area}: ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
    console.log(`\nSummary: ${summary.pass} passed, ${summary.warn} warnings, ${summary.fail} failed.`);
  }

  if (summary.fail) process.exitCode = 1;
}

main();
