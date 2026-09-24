import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function arg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] || fallback) : fallback;
}

const chrome = arg('--chrome');
const output = path.resolve(arg('--output', 'ui-review'));
const siteUrl = arg('--site-url', 'http://127.0.0.1:4321/');
const appUrl = arg('--app-url', 'http://127.0.0.1:3100/app');
if (!chrome) throw new Error('Missing --chrome');

fs.mkdirSync(output, { recursive: true });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'veylo-ui-review-'));
const browser = spawn(chrome, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--remote-allow-origins=*',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userData}`,
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getWsUrl() {
  const activePortFile = path.join(userData, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      if (!fs.existsSync(activePortFile)) {
        await sleep(100);
        continue;
      }
      const [portLine] = fs.readFileSync(activePortFile, 'utf8').trim().split(/\r?\n/);
      const debugPort = Number(portLine);
      if (!Number.isInteger(debugPort) || debugPort <= 0) throw new Error('Invalid Chrome debug port');
      const pages = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) => response.json());
      const page = pages.find((item) => item.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(100);
  }
  throw new Error('Chrome DevTools endpoint did not become ready');
}

let ws;
let sequence = 0;
const pending = new Map();

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject, method });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function connect() {
  ws = new WebSocket(await getWsUrl());
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const item = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) item.reject(new Error(`${item.method}: ${message.error.message}`));
    else item.resolve(message.result || {});
  });
  await send('Page.enable');
  await send('Runtime.enable');
}

async function setViewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 500,
  });
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
}

async function navigate(url, settleMs = 1200) {
  await send('Page.navigate', { url });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await sleep(100);
    const state = await send('Runtime.evaluate', {
      expression: 'document.readyState',
      returnByValue: true,
    });
    if (state.result?.value === 'complete') break;
  }
  await sleep(settleMs);
}

async function screenshot(name) {
  const { data } = await send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  fs.writeFileSync(path.join(output, name), Buffer.from(data, 'base64'));
}

async function installProfileSeed() {
  const profile = JSON.stringify({
    name: 'Review User',
    countryCode: 'ID',
    countryName: 'Indonesia',
    preferredLanguage: 'id',
  });
  const origin = new URL(appUrl).origin;
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `if (location.origin === ${JSON.stringify(origin)}) { try { localStorage.setItem('veylo.profile.v1', ${JSON.stringify(profile)}); } catch {} }`,
  });
}

try {
  await connect();

  await setViewport(1440, 1000);
  await navigate(siteUrl);
  await screenshot('site-desktop.png');

  await setViewport(390, 844);
  await navigate(siteUrl);
  await screenshot('site-mobile.png');

  await installProfileSeed();

  await setViewport(1440, 1000);
  await navigate(appUrl);
  await screenshot('app-home-desktop.png');

  await setViewport(390, 844);
  await navigate(appUrl);
  await screenshot('app-home-mobile.png');

  await setViewport(1440, 1000);
  await navigate(`${appUrl}/face-to-face`);
  await screenshot('face-to-face-desktop.png');

  await navigate(`${appUrl}/simulation`);
  await screenshot('simulation-desktop.png');

  console.log('UI screenshots captured with hydrated test profile.');
} finally {
  try { ws?.close(); } catch {}
  browser.kill('SIGTERM');
  await sleep(300);
  try { fs.rmSync(userData, { recursive: true, force: true }); } catch {}
}
