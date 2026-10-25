// Наскрізна перевірка Mini App у Chromium (Playwright): звичайний браузер та імітація Telegram.
// Запуск: npm run test:e2e
// Якщо telegram.org недоступний, вкажи локальну копію скрипта: TG_SDK=/шлях/telegram-web-app.js
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import worker from '../src/worker.js';
import { signInitData } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'public');
const TG_SDK = process.env.TG_SDK || '';
if (TG_SDK && !fs.existsSync(TG_SDK)) throw new Error('TG_SDK: файл не знайдено — ' + TG_SDK);
const TOKEN = '123456:E2E-token', OWNER = 777001;
const DARK = { bg_color: '#17212b', text_color: '#f5f5f5', hint_color: '#708499', button_color: '#5288c1', button_text_color: '#ffffff', secondary_bg_color: '#232e3c' };
const LIGHT = { bg_color: '#ffffff', text_color: '#000000', hint_color: '#999999', button_color: '#2481cc', button_text_color: '#ffffff', secondary_bg_color: '#efeff3' };

/* ---------- сервер: статичні файли + справжній Worker (як у Cloudflare) ---------- */
const kv = new Map();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
function serveStatic(p) {
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, path.normalize(decodeURIComponent(p)));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return new Response('not found', { status: 404 });
  return new Response(fs.readFileSync(f), { headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } });
}
const env = {
  BOT_TOKEN: TOKEN, WEBHOOK_SECRET: 'whsec', ALLOWED_USER_ID: String(OWNER),
  KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, v); } },
  ASSETS: { fetch: async req => serveStatic(new URL(req.url).pathname) }
};
const server = http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const headers = {}; if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
  const r = await worker.fetch(new Request('http://localhost' + req.url, {
    method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks)
  }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
});

/* ---------- імітація Telegram CloudStorage з реальними лімітами ---------- */
function makeCloud() { return { data: new Map(), calls: [], violations: [] }; }
function cloudOp(c, method, params) {
  c.calls.push(method + (params.key ? ':' + params.key : ''));
  const keyOk = k => typeof k === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(k);
  if (method === 'saveStorageValue') {
    if (!keyOk(params.key)) { c.violations.push('key ' + params.key); return { error: 'KEY_INVALID' }; }
    if (params.value.length > 4096) { c.violations.push(`value ${params.key} ${params.value.length}`); return { error: 'VALUE_TOO_LONG' }; }
    if (!c.data.has(params.key) && c.data.size >= 1024) { c.violations.push('too many keys'); return { error: 'STORAGE_KEYS_LIMIT' }; }
    c.data.set(params.key, params.value); return { result: true };
  }
  if (method === 'getStorageValues') return { result: Object.fromEntries(params.keys.map(k => [k, c.data.get(k) || ''])) };
  if (method === 'deleteStorageValues') { params.keys.forEach(k => c.data.delete(k)); return { result: true }; }
  if (method === 'getStorageKeys') return { result: [...c.data.keys()] };
  return { error: 'UNKNOWN_METHOD' };
}

/* ---------- браузер ---------- */
let browser, base;
const IGNORE = [/Failed to load resource/, /fonts\.g(oogleapis|static)/];
async function open({ tg = false, cloud = null, theme = DARK, sdk = true, storage = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !IGNORE.some(r => r.test(m.text()))) errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.route(/telegram\.org\/js\/telegram-web-app\.js/, r =>
    !sdk ? r.abort() : TG_SDK ? r.fulfill({ path: TG_SDK, contentType: 'text/javascript' }) : r.continue());
  if (storage) await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)); } }, storage);
  let url = base;
  if (tg) {
    await page.exposeFunction('__cloud', (method, params) => cloudOp(cloud, method, params));
    await page.addInitScript(() => {
      window.__tg = [];
      window.TelegramWebviewProxy = {
        postEvent(type, data) {
          const d = data ? JSON.parse(data) : null;
          window.__tg.push([type, d]);
          if (type === 'web_app_invoke_custom_method')
            window.__cloud(d.method, d.params).then(r => window.Telegram.WebView.receiveEvent('custom_method_invoked', { req_id: d.req_id, ...r }));
        }
      };
    });
    const initData = signInitData(TOKEN, { auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'AAE-test', user: JSON.stringify({ id: OWNER, first_name: 'Тест', language_code: 'uk' }) });
    url += '#' + new URLSearchParams({ tgWebAppData: initData, tgWebAppVersion: '8.0', tgWebAppPlatform: 'ios', tgWebAppThemeParams: JSON.stringify(theme) });
  }
  await page.goto(url);
  await page.waitForSelector('.tile.exam');
  return { page, context, errors };
}

const correctK = page => page.evaluate(() => Z.order.indexOf(0));
const wrongK = page => page.evaluate(() => Z.order.findIndex(i => i !== 0));
async function answer(page, ok) {
  const k = ok ? await correctK(page) : await wrongK(page);
  await page.click(`.opt[data-arg="${k}"]`);
  await page.waitForSelector('#nextBtn');
}
const next = page => page.click('#nextBtn');
const tgEvents = (page, type) => page.evaluate(t => window.__tg.filter(e => e[0] === t).map(e => e[1]), type);
const lastTg = async (page, type) => (await tgEvents(page, type)).pop();
const color = async (page, type) => ((await lastTg(page, type)) || {}).color?.toUpperCase();
const tgSend = (page, type, data) => page.evaluate(([t, d]) => window.Telegram.WebView.receiveEvent(t, d), [type, data]);
const sleep = ms => new Promise(r => setTimeout(r, ms));

test.before(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
});
test.after(async () => { await browser.close(); server.close(); });

/* =================== звичайний браузер =================== */
test('браузер: головна без Telegram і без помилок', async () => {
  const { page, context, errors } = await open();
  assert.equal(await page.evaluate(() => TG.inTg), false);
  assert.match(await page.locator('.hello').textContent(), /^(Доброго ранку|Добрий день|Добрий вечір|Доброї ночі)!$/);
  const total = await page.evaluate(() => QB.length);
  assert.match(await page.locator('[data-act="marathon"] .d').textContent(), new RegExp(`Усі ${total} питань`));
  assert.equal(await page.locator('[data-act="topics"] .d').textContent(), `${await page.evaluate(() => SEC_LIST.length)} тем`);
  assert.deepEqual(errors, []);
  await context.close();
});

test('браузер: застосунок працює, навіть якщо telegram-web-app.js не завантажився', async () => {
  const { page, context, errors } = await open({ sdk: false });
  assert.equal(await page.evaluate(() => typeof window.Telegram), 'undefined');
  await page.click('[data-act="train"]'); await answer(page, true);
  assert.equal(await page.locator('.feedback b').textContent(), 'Правильно');
  assert.deepEqual(errors, []);
  await context.close();
});

test('сцени: кожна анімована ілюстрація малюється в картці питання', async () => {
  const { page, context, errors } = await open();
  const ids = await page.evaluate(() => Object.keys(SCN.SCENES));
  assert.ok(ids.length > 100);
  for (const id of ids) {
    await page.evaluate(id => startQuiz('train', [QMAP[id]]), id);
    assert.equal(await page.locator('.qcard .stage.scene svg').count(), 1, id);
  }
  await page.evaluate(() => startQuiz('train', [QB.find(x => x.sign)]));
  assert.equal(await page.locator('.qcard .stage.sign svg').count(), 1);
  assert.deepEqual(errors, []);
  await context.close();
});

test('іспит: складений до кінця', async () => {
  const { page, context, errors } = await open();
  await page.click('[data-act="examIntro"]'); await page.click('[data-act="startExam"]');
  for (let i = 0; i < 20; i++) {
    assert.equal(await page.locator('.qmeta span').nth(1).textContent(), `${i + 1} з 20`);
    await answer(page, i % 9 !== 4); // дві помилки — ще складено
    await next(page);
  }
  assert.equal(await page.locator('.plate-t').textContent(), 'Складено');
  assert.match(await page.locator('.plate p').last().textContent(), /18 з 20 правильно/);
  const ex = await page.evaluate(() => S.exams);
  assert.equal(ex.taken, 1); assert.equal(ex.passed, 1);
  assert.deepEqual(errors, []);
  await context.close();
});

test('іспит: не складений — третя помилка зупиняє', async () => {
  const { page, context, errors } = await open();
  await page.click('[data-act="examIntro"]'); await page.click('[data-act="startExam"]');
  await answer(page, false); await next(page);
  await answer(page, true); await next(page);
  await answer(page, false); await next(page);
  await answer(page, false);
  assert.match(await page.locator('.feedback .warnline').textContent(), /третя помилка/);
  assert.equal(await page.locator('#nextBtn').textContent(), 'До результатів');
  await next(page);
  assert.equal(await page.locator('.plate-t').textContent(), 'Не складено');
  assert.match(await page.locator('.plate p').last().textContent(), /Три помилки/);
  assert.equal(await page.locator('.wcard').count(), 3);
  assert.deepEqual(errors, []);
  await context.close();
});

test('іспит: час вийшов', async () => {
  const { page, context, errors } = await open();
  await page.click('[data-act="examIntro"]'); await page.click('[data-act="startExam"]');
  await answer(page, true);
  await page.evaluate(() => { Z.start -= 20 * 60 * 1000; });
  await page.waitForSelector('.plate.fail', { timeout: 3000 });
  assert.match(await page.locator('.plate p').last().textContent(), /Час вийшов/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('тренування: 10 питань до результату', async () => {
  const { page, context, errors } = await open();
  await page.click('[data-act="train"]');
  for (let i = 0; i < 10; i++) { await answer(page, i % 3 !== 0); await next(page); }
  assert.equal(await page.locator('.plate-t').textContent(), '6 з 10');
  assert.deepEqual(errors, []);
  await context.close();
});

test('розділи: кожен розділ має питання, один проходимо повністю', async () => {
  const { page, context, errors } = await open();
  await page.click('[data-act="topics"]');
  const rows = await page.locator('.row small').allTextContents();
  assert.equal(rows.length, await page.evaluate(() => SEC_LIST.length));
  rows.forEach(t => assert.doesNotMatch(t, /^0 /, 'порожній розділ'));
  const n = await page.evaluate(() => BYSEC.bikes.length);
  await page.click('.row[data-arg="bikes"]');
  for (let i = 0; i < n; i++) { await answer(page, true); await next(page); }
  assert.equal(await page.locator('.plate-t').textContent(), `${n} з ${n}`);
  await page.click('.qtop [data-act="home"]'); await page.click('[data-act="topics"]');
  assert.equal(await page.locator('.row[data-arg="bikes"] .pct').textContent(), '50%');
  assert.deepEqual(errors, []);
  await context.close();
});

test('марафон: прогрес зберігається і продовжується', async () => {
  const { page, context, errors } = await open();
  const total = await page.evaluate(() => QB.length);
  await page.click('[data-act="marathon"]');
  for (let i = 0; i < 3; i++) { await answer(page, true); await next(page); }
  await page.click('[data-act="quitQuiz"]');
  assert.equal(await page.locator('[data-act="marathon"] .d').textContent(), `3 з ${total}, продовжити`);
  await page.reload(); await page.waitForSelector('.tile.exam');
  await page.click('[data-act="marathon"]');
  assert.equal(await page.locator('.qmeta span').nth(1).textContent(), `4 з ${total}`);
  assert.deepEqual(errors, []);
  await context.close();
});

test('помилки та обране', async () => {
  const { page, context, errors } = await open();
  await page.click('[data-act="mistakes"]');
  assert.equal(await page.locator('.toast').last().textContent(), 'Тут з’являться питання, в яких була помилка.');
  await page.click('[data-act="train"]');
  await answer(page, false); await page.click('[data-act="fav"]');
  assert.equal(await page.locator('.toast').last().textContent(), 'Додано в обране');
  await next(page); await answer(page, false);
  await page.click('[data-act="quitQuiz"]');
  assert.equal(await page.locator('[data-act="mistakes"] .d').textContent(), '2 питання на розбір');
  assert.equal(await page.locator('[data-act="favs"] .d').textContent(), '1 питання');
  await page.click('[data-act="mistakes"]');
  assert.equal(await page.locator('.qmeta span').nth(1).textContent(), '1 з 2');
  await answer(page, true); await next(page); await answer(page, true); await next(page);
  assert.equal(await page.locator('.plate-t').textContent(), '2 з 2');
  await page.click('.stack [data-act="home"]');
  await page.click('[data-act="favs"]');
  assert.equal(await page.locator('.qmeta span').nth(1).textContent(), '1 з 1');
  assert.equal(await page.locator('.star.on').count(), 1);
  assert.deepEqual(errors, []);
  await context.close();
});

async function gameState(page) {
  return page.evaluate(() => {
    const free = G.sc.cars.map((_, i) => i).filter(i => !G.gone.has(i) && [...G.sc.deps[i]].every(j => G.gone.has(j)));
    const blocked = G.sc.cars.map((_, i) => i).filter(i => !G.gone.has(i) && !free.includes(i));
    return { free, blocked, lives: G.lives, score: G.score, over: G.over, busy: G.busy };
  });
}
test('гра: правильний тап, неправильний тап, кінець гри', async () => {
  const { page, context, errors } = await open();
  await page.click('[data-act="game"]');
  // правильні тапи до першого пройденого перехрестя
  let st = await gameState(page);
  while (st.score === 0) {
    if (st.free.length) await page.locator(`#car${st.free[0]}`).click();
    await sleep(300); st = await gameState(page);
  }
  await page.waitForFunction(() => document.getElementById('gScore').textContent === '1');
  // неправильні тапи, поки не скінчаться життя
  for (let lives = 3; lives > 0; lives--) {
    await page.waitForFunction(() => G && !G.busy && G.gone.size === 0);
    st = await gameState(page);
    await page.locator(`#car${st.blocked[0]}`).click();
    await page.waitForSelector('#gfb .feedback.bad');
    assert.match(await page.locator('#gfb .feedback b').textContent(), /^Спершу [АБВ]$/);
    assert.equal(await page.locator('.heart.lost').count(), 4 - lives);
    await page.click('[data-act="gNext"]');
  }
  await page.waitForSelector('.over', { timeout: 10000 });
  assert.equal(await page.locator('.over .big').textContent(), '1');
  assert.equal(await page.evaluate(() => S.game.best), 1);
  await page.click('.over [data-act="game"]');
  assert.equal(await page.locator('.heart.lost').count(), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test('скидання прогресу', async () => {
  const { page, context, errors } = await open();
  await page.click('[data-act="train"]'); await answer(page, true); await page.click('[data-act="quitQuiz"]');
  assert.equal(await page.evaluate(() => S.total.a), 1);
  await page.click('[data-act="ach"]'); await page.click('[data-act="reset"]');
  await page.click('.backdrop [data-x="yes"]');
  assert.equal(await page.locator('.toast').last().textContent(), 'Прогрес скинуто');
  assert.equal(await page.evaluate(() => S.total.a), 0);
  await page.reload(); await page.waitForSelector('.tile.exam');
  assert.equal(await page.evaluate(() => S.total.a + S.xp), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

/* =================== імітація Telegram =================== */
test('Telegram: ready/expand, ім’я, тема, кольори, безпечні зони', async () => {
  const { page, context, errors } = await open({ tg: true, cloud: makeCloud() });
  assert.equal(await page.evaluate(() => TG.inTg), true);
  assert.equal((await tgEvents(page, 'web_app_ready')).length, 1);
  assert.equal((await tgEvents(page, 'web_app_expand')).length, 1);
  assert.match(await page.locator('.hello').textContent(), /, Тест!$/);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  assert.equal(await color(page, 'web_app_set_header_color'), '#0B1210');
  assert.equal(await color(page, 'web_app_set_background_color'), '#0B1210');
  assert.equal(await color(page, 'web_app_set_bottom_bar_color'), '#0B1210');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(11, 18, 16)');
  await tgSend(page, 'theme_changed', { theme_params: LIGHT });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  assert.equal(await color(page, 'web_app_set_header_color'), '#EEF2F0');
  await tgSend(page, 'safe_area_changed', { top: 47, bottom: 34, left: 0, right: 0 });
  await tgSend(page, 'content_safe_area_changed', { top: 46, bottom: 0, left: 0, right: 0 });
  const pad = await page.evaluate(() => { const s = getComputedStyle(document.documentElement); return [s.paddingTop, s.paddingBottom]; });
  assert.deepEqual(pad, ['93px', '34px']);
  assert.deepEqual(errors, []);
  await context.close();
});

test('Telegram: BackButton, підтвердження закриття на іспиті, свайпи в грі, вібрація', async () => {
  const { page, context, errors } = await open({ tg: true, cloud: makeCloud() });
  assert.equal((await lastTg(page, 'web_app_setup_back_button')).is_visible, false);
  await page.click('[data-act="topics"]');
  assert.equal((await lastTg(page, 'web_app_setup_back_button')).is_visible, true);
  assert.deepEqual(await lastTg(page, 'web_app_trigger_haptic_feedback'), { type: 'impact', impact_style: 'light' });
  await tgSend(page, 'back_button_pressed');
  assert.equal(await page.evaluate(() => view), 'home');
  assert.equal((await lastTg(page, 'web_app_setup_back_button')).is_visible, false);

  await page.click('[data-act="examIntro"]'); await page.click('[data-act="startExam"]');
  assert.equal((await lastTg(page, 'web_app_setup_closing_behavior')).need_confirmation, true);
  await answer(page, true);
  assert.deepEqual(await lastTg(page, 'web_app_trigger_haptic_feedback'), { type: 'notification', notification_type: 'success' });
  await next(page); await answer(page, false);
  assert.deepEqual(await lastTg(page, 'web_app_trigger_haptic_feedback'), { type: 'notification', notification_type: 'error' });
  await tgSend(page, 'back_button_pressed');
  assert.equal(await page.locator('.backdrop').count(), 1, 'на іспиті «назад» питає підтвердження');
  await tgSend(page, 'back_button_pressed');
  assert.equal(await page.locator('.backdrop').count(), 0, 'повторне «назад» закриває діалог');
  assert.equal(await page.evaluate(() => view), 'quiz');
  await tgSend(page, 'back_button_pressed'); await page.click('.backdrop [data-x="yes"]');
  assert.equal(await page.evaluate(() => view), 'home');
  assert.equal((await lastTg(page, 'web_app_setup_closing_behavior')).need_confirmation, false);

  await page.click('[data-act="game"]');
  assert.equal((await lastTg(page, 'web_app_setup_swipe_behavior')).allow_vertical_swipe, false);
  const st = await gameState(page);
  await page.locator(`#car${st.free[0]}`).click();
  assert.deepEqual(await lastTg(page, 'web_app_trigger_haptic_feedback'), { type: 'notification', notification_type: 'success' });
  await tgSend(page, 'back_button_pressed');
  assert.equal(await page.evaluate(() => view), 'home');
  assert.equal((await lastTg(page, 'web_app_setup_swipe_behavior')).allow_vertical_swipe, true);

  await page.click('[data-act="train"]'); await tgSend(page, 'back_button_pressed');
  assert.equal(await page.evaluate(() => view), 'home', 'поза іспитом «назад» виходить одразу');
  assert.deepEqual(errors, []);
  await context.close();
});

test('Telegram: CloudStorage — ліміти, запис лише змінених ключів, синхронізація між пристроями, скидання', async () => {
  const cloud = makeCloud();
  const a = await open({ tg: true, cloud });
  await a.page.click('[data-act="train"]'); await answer(a.page, true);
  await sleep(2500);
  assert.ok(cloud.data.has('zh_meta'));
  const sec = await a.page.evaluate(() => Z.list[Z.i].s);
  assert.ok(cloud.data.has('zh_q_' + sec));
  // друга відповідь — пишуться лише ключ розділу і zh_meta
  await next(a.page);
  const sec2 = await a.page.evaluate(() => Z.list[Z.i].s);
  const before = cloud.calls.length;
  await answer(a.page, false); await sleep(2500);
  const writes = cloud.calls.slice(before).filter(c => c.startsWith('saveStorageValue'));
  assert.deepEqual(writes.sort(), [...new Set(['saveStorageValue:zh_meta', 'saveStorageValue:zh_q_' + sec2])].sort());
  // запит активності дійшов до Worker і записав серію
  const act = JSON.parse(kv.get('activity'));
  assert.equal(act.streak, 1);
  assert.equal(await a.page.evaluate(() => localStorage.getItem('zh-ping')), await a.page.evaluate(() => todayStr()));

  // максимальний стан: усі питання з великими лічильниками і все в обраному
  await a.page.evaluate(() => { QB.forEach(x => { S.q[x.id] = { c: 123456, w: 654321, s: 99999 }; }); S.fav = QB.map(x => x.id); S.xp = 999999; save(); });
  await sleep(3500);
  assert.deepEqual(cloud.violations, []);
  const lens = [...cloud.data.values()].map(v => v.length);
  assert.ok(Math.max(...lens) <= 4096, 'значення ≤ 4096');
  if (await a.page.evaluate(() => JSON.stringify(S.fav).length > 4000)) assert.ok(cloud.data.has('zh_fav_1'), 'обране розбито на частини');
  const total = await a.page.evaluate(() => QB.length);

  // інший пристрій: порожній localStorage, той самий CloudStorage
  const b = await open({ tg: true, cloud });
  await b.page.waitForFunction(n => Object.keys(S.q).length === n, total);
  assert.equal(await b.page.evaluate(() => S.fav.length), total);
  assert.equal(await b.page.evaluate(() => S.xp), 999999);
  assert.match(await b.page.locator('.big').first().textContent(), /^100%$/);

  // старіший локальний стан не перезаписує новіший хмарний
  const c = await open({ tg: true, cloud, storage: { 'zh-pdr-v1': JSON.stringify({ v: 1, xp: 5, updatedAt: 1 }) } });
  await c.page.waitForFunction(() => S.xp === 999999);

  // скидання прогресу чистить хмару
  await b.page.click('[data-act="ach"]'); await b.page.click('[data-act="reset"]'); await b.page.click('.backdrop [data-x="yes"]');
  await sleep(2500);
  assert.deepEqual([...cloud.data.keys()], ['zh_meta']);
  assert.deepEqual(JSON.parse(cloud.data.get('zh_meta')).keys, []);
  for (const x of [a, b, c]) { assert.deepEqual(x.errors, []); await x.context.close(); }
});
