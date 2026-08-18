/* global AbortSignal, Bun, Buffer, URL, WebSocket, console, fetch, process */
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const APP_PORT = 1421;
const DEBUG_PORT = 9333;
const APP_URL = `http://127.0.0.1:${APP_PORT}/`;
const API_HOST = 'business.wel.my.id';
const IMAGE_HOST = 'ihlv1.xyz';
const currentChapter = 4;
const currentPage = 4;
const pageCount = 10;
const errors = [];
let scenario = { chapterCount: 10, collectionChapterCount: 0, failChapters: false };

const manga = (chapterCount) => ({
  id: 7,
  name: '全体進捗テスト',
  slug: '',
  authors: '作者',
  transGroup: '',
  artists: '',
  released: 2026,
  otherName: '',
  genres: '',
  description: '',
  mStatus: 2,
  lastUpdate: '',
  post: '',
  cover: `https://${IMAGE_HOST}/cover.webp`,
  lastChapter: String(chapterCount),
  views: 0,
  submitter: 0,
  groupUploader: 0,
  hidden: 0,
  magazines: '',
});

const chapters = (chapterCount) =>
  Array.from({ length: chapterCount }, (_, index) => ({
    mid: 7,
    name: '全体進捗テスト',
    chapter: index + 1,
    content: Array.from(
      { length: index + 1 === currentChapter ? pageCount : 1 },
      (_, page) => `https://${IMAGE_HOST}/${index + 1}-${page + 1}.webp`,
    ),
    time: '',
    views: 0,
  }));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    process.platform === 'win32'
      ? `${process.env.PROGRAMFILES ?? 'C:\\Program Files'}\\Google\\Chrome\\Application\\chrome.exe`
      : undefined,
    process.platform === 'win32'
      ? `${process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)'}\\Google\\Chrome\\Application\\chrome.exe`
      : undefined,
    process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : undefined,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const executable = candidates.find(existsSync);
  if (!executable) throw new Error('Chrome/Chromium executable was not found');
  return executable;
}

async function waitFor(check, message, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await Bun.sleep(50);
  }
  throw new Error(message);
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.onopen = resolve;
      this.socket.onerror = reject;
    });
    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
        else pending.resolve(message.result);
        return;
      }
      const listeners = this.listeners.get(message.method) ?? [];
      for (const listener of listeners) void listener(message.params);
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    this.listeners.set(method, [...(this.listeners.get(method) ?? []), listener]);
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression) {
  const response = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(
      response.exceptionDetails.exception?.description ?? response.exceptionDetails.text,
    );
  }
  return response.result.value;
}

async function waitForSelector(client, selector, timeout = 10_000) {
  await waitFor(
    async () => evaluate(client, `Boolean(document.querySelector(${JSON.stringify(selector)}))`),
    `Timed out waiting for ${selector}`,
    timeout,
  );
}

async function click(client, selector) {
  await waitForSelector(client, selector);
  const point = await evaluate(
    client,
    `(()=>{const element=document.querySelector(${JSON.stringify(selector)});const rect=element.getBoundingClientRect();return {x:rect.left+rect.width/2,y:rect.top+rect.height/2}})()`,
  );
  await client.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: point.x,
    y: point.y,
    button: 'left',
    clickCount: 1,
  });
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: point.x,
    y: point.y,
    button: 'left',
    clickCount: 1,
  });
}

function responseBody(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64');
}

async function handleRequest(client, request) {
  const url = new URL(request.request.url);
  if (url.hostname === IMAGE_HOST) {
    await client.send('Fetch.fulfillRequest', {
      requestId: request.requestId,
      responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: 'image/png' }],
      body: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    });
    return;
  }
  if (url.hostname !== API_HOST) {
    await client.send('Fetch.continueRequest', { requestId: request.requestId });
    return;
  }

  const corsHeaders = [
    { name: 'Access-Control-Allow-Origin', value: '*' },
    { name: 'Access-Control-Allow-Headers', value: '*' },
    { name: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
  ];
  if (request.request.method === 'OPTIONS') {
    await client.send('Fetch.fulfillRequest', {
      requestId: request.requestId,
      responseCode: 204,
      responseHeaders: corsHeaders,
    });
    return;
  }

  let code = 200;
  let body;
  if (url.pathname === '/manga/collection') {
    body = scenario.collectionChapterCount > 0 ? [manga(scenario.collectionChapterCount)] : [];
  } else if (url.pathname === '/manga/7') {
    body = manga(scenario.chapterCount);
  } else if (url.pathname === '/chapter/7' && scenario.failChapters) {
    code = 500;
    body = { error: 'temporary failure' };
  } else if (url.pathname === '/chapter/7') {
    body = chapters(scenario.chapterCount);
  } else {
    body = [];
  }
  await client.send('Fetch.fulfillRequest', {
    requestId: request.requestId,
    responseCode: code,
    responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, ...corsHeaders],
    body: responseBody(body),
  });
}

function version3Library() {
  return {
    version: 3,
    favorites: [],
    history: {
      7: {
        mangaId: 7,
        title: '全体進捗テスト',
        cover: `https://${IMAGE_HOST}/cover.webp`,
        chapter: currentChapter,
        page: currentPage,
        pageCount,
        latestChapter: 10,
        updatedAt: '2026-08-18T00:00:00.000Z',
      },
    },
  };
}

function version4Library() {
  return {
    version: 4,
    favorites: [],
    history: {
      7: {
        ...version3Library().history[7],
        chapterIndex: 3,
        chapterCount: 10,
      },
    },
  };
}

async function loadScenario(client, library) {
  await evaluate(
    client,
    `localStorage.setItem('n-mgram.library', ${JSON.stringify(JSON.stringify(library))})`,
  );
  await client.send('Page.reload', { ignoreCache: true });
  await waitForSelector(client, '[data-testid="library-tab-history"]');
  await click(client, '[data-testid="library-tab-history"]');
}

async function historyMeasurement(client) {
  return evaluate(
    client,
    `(()=>{const meta=document.querySelector('.history-meta');const bar=document.querySelector('.progress-track');const fill=bar?.firstElementChild;return {text:meta?.textContent?.replace(/\\s+/g,' ').trim(),ariaValue:bar?.getAttribute('aria-valuenow'),ratio:bar&&fill?fill.getBoundingClientRect().width/bar.getBoundingClientRect().width:undefined,horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth}})()`,
  );
}

async function runScenarios(client) {
  console.log('E2E: restoring version 3 history');
  scenario = { chapterCount: 10, collectionChapterCount: 0, failChapters: false };
  await loadScenario(client, version3Library());
  await waitFor(
    async () => (await historyMeasurement(client)).ariaValue === '35',
    'Migrated history did not show 35% whole-manga progress',
  );
  let measurement = await historyMeasurement(client);
  assert(measurement.text === '第4話 · 35% 読了', `Unexpected migrated text: ${measurement.text}`);
  assert(Math.abs(measurement.ratio - 0.35) < 0.001, 'Migrated progress width was not 35%');
  assert(!measurement.horizontalOverflow, '390px history layout overflowed horizontally');
  const migrated = await evaluate(client, `JSON.parse(localStorage.getItem('n-mgram.library'))`);
  assert(migrated.version === 4, 'Version 3 history was not migrated to version 4');
  assert(migrated.history[7].chapterIndex === 3, 'Migrated chapter index was not restored');
  assert(migrated.history[7].chapterCount === 10, 'Migrated chapter count was not restored');

  console.log('E2E: recalculating after new chapters');
  scenario = { chapterCount: 12, collectionChapterCount: 12, failChapters: false };
  await loadScenario(client, version4Library());
  await waitFor(
    async () => (await historyMeasurement(client)).ariaValue === '29',
    'New chapters did not recalculate whole-manga progress to 29%',
  );
  measurement = await historyMeasurement(client);
  assert(measurement.text === '第4話 · 29% 読了', `Unexpected updated text: ${measurement.text}`);
  const updated = await evaluate(client, `JSON.parse(localStorage.getItem('n-mgram.library'))`);
  assert(updated.history[7].latestChapter === '12', 'Latest chapter metadata was not updated');
  assert(updated.history[7].chapterCount === 12, 'New chapter count was not restored');

  console.log('E2E: retrying failed chapter restoration');
  scenario = { chapterCount: 10, collectionChapterCount: 0, failChapters: true };
  await loadScenario(client, version3Library());
  await waitForSelector(client, '.history-restore-error', 15_000);
  measurement = await historyMeasurement(client);
  assert(
    measurement.ariaValue === undefined,
    'Failed restoration showed a misleading progress bar',
  );
  assert(
    measurement.text === '第4話',
    `Failed restoration showed a percentage: ${measurement.text}`,
  );
  scenario.failChapters = false;
  await click(client, '.history-restore-error button');
  await waitFor(
    async () => (await historyMeasurement(client)).ariaValue === '35',
    'Retry did not restore whole-manga progress',
  );

  console.log('E2E: checking responsive layout and confirmed deletion');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
  });
  measurement = await historyMeasurement(client);
  assert(Math.abs(measurement.ratio - 0.35) < 0.001, 'Desktop progress width was not 35%');
  assert(!measurement.horizontalOverflow, 'Desktop history layout overflowed horizontally');

  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await click(client, '[data-testid="history-delete-7"]');
  await waitFor(
    async () =>
      !(await evaluate(
        client,
        `Boolean(document.querySelector('[data-testid="history-open-7"]'))`,
      )),
    'Confirmed history deletion did not remove the entry',
  );
  const deleted = await evaluate(client, `JSON.parse(localStorage.getItem('n-mgram.library'))`);
  assert(Object.keys(deleted.history).length === 0, 'Confirmed history deletion was not persisted');
}

const profile = await mkdtemp(join(tmpdir(), 'n-mgram-e2e-'));
const nodeExecutable = Bun.which('node');
assert(nodeExecutable, 'Node.js executable was not found');
const vite = Bun.spawn(
  [
    nodeExecutable,
    'node_modules/vite/bin/vite.js',
    '--host',
    '127.0.0.1',
    '--port',
    String(APP_PORT),
    '--strictPort',
  ],
  { cwd: process.cwd(), stdout: 'pipe', stderr: 'pipe' },
);
let chrome;
let client;

try {
  await waitFor(async () => {
    if (vite.exitCode !== null) throw new Error(`Vite exited with code ${vite.exitCode}`);
    try {
      return (await fetch(APP_URL, { signal: AbortSignal.timeout(500) })).ok;
    } catch {
      return false;
    }
  }, 'Vite test server did not start');

  chrome = Bun.spawn(
    [
      findChrome(),
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${profile}`,
      '--window-size=390,844',
      APP_URL,
    ],
    { stdout: 'pipe', stderr: 'pipe' },
  );
  await waitFor(async () => {
    if (chrome.exitCode !== null) throw new Error(`Chrome exited with code ${chrome.exitCode}`);
    try {
      return (
        await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`, {
          signal: AbortSignal.timeout(500),
        })
      ).ok;
    } catch {
      return false;
    }
  }, 'Chrome DevTools endpoint did not start');

  const targets = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`).then((response) =>
    response.json(),
  );
  const page = targets.find((target) => target.type === 'page');
  assert(page, 'Chrome page target was not found');
  client = new CdpClient(page.webSocketDebuggerUrl);
  await client.connect();
  client.on('Runtime.exceptionThrown', (event) => errors.push(event.exceptionDetails.text));
  client.on('Fetch.requestPaused', async (request) => {
    try {
      await handleRequest(client, request);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      if (!message.includes('Invalid InterceptionId')) errors.push(message);
    }
  });
  client.on('Page.javascriptDialogOpening', () =>
    client.send('Page.handleJavaScriptDialog', { accept: true }),
  );
  await client.send('Runtime.enable');
  await client.send('Page.enable');
  await client.send('Fetch.enable', {
    patterns: [{ urlPattern: `https://${API_HOST}/*` }, { urlPattern: `https://${IMAGE_HOST}/*` }],
  });
  await client.send('Emulation.setLocaleOverride', { locale: 'ja-JP' });
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await client.send('Page.navigate', { url: APP_URL });
  await waitForSelector(client, '[data-testid="library-tab-history"]');

  await runScenarios(client);
  assert(errors.length === 0, `Browser exceptions occurred: ${errors.join('; ')}`);
  console.log('History progress E2E passed: migration, new chapters, retry, delete, responsive UI');
} finally {
  client?.close();
  chrome?.kill();
  vite.kill();
  await Promise.race([Promise.allSettled([chrome?.exited, vite.exited]), Bun.sleep(2_000)]);
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
