// node --test tests/ — перевірка Worker без мережі: підпис initData, webhook, активність, нагадування
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import { verifyInitData, kyivNow, prevDay, reminderText } from '../src/lib.js';
import { signInitData } from './helpers.mjs';

const TOKEN = '123456:TEST-token';
const OWNER = 777001;

const initFor = (id, authDate = Math.floor(Date.now() / 1000)) =>
  signInitData(TOKEN, { auth_date: String(authDate), query_id: 'AAE', user: JSON.stringify({ id, first_name: 'Тест' }) });

function makeEnv(extra = {}) {
  const store = new Map();
  return {
    BOT_TOKEN: TOKEN, WEBHOOK_SECRET: 'whsec', ALLOWED_USER_ID: String(OWNER), TG_API: 'https://tg.test',
    KV: { get: async k => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); } },
    ASSETS: { fetch: async () => new Response('asset') },
    store, ...extra
  };
}
let sent = [];
globalThis.fetch = async (url, init) => {
  sent.push({ url: String(url), body: JSON.parse(init.body) });
  return new Response(JSON.stringify({ ok: true, result: {} }));
};
const post = (path, body, headers = {}) => new Request('https://app.test' + path, {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body)
});
const msg = (fromId, text) => ({ update_id: 1, message: { message_id: 1, from: { id: fromId }, chat: { id: fromId, type: 'private' }, text } });

test('initData: правильний підпис приймається, підроблений і застарілий — ні', async () => {
  const ok = await verifyInitData(initFor(OWNER), TOKEN, 3600);
  assert.equal(ok.user.id, OWNER);
  assert.equal(await verifyInitData(initFor(OWNER), 'other:token', 3600), null);
  const tampered = initFor(OWNER).replace('777001', '777002');
  assert.equal(await verifyInitData(tampered, TOKEN, 3600), null);
  const old = initFor(OWNER, Math.floor(Date.now() / 1000) - 7200);
  assert.equal(await verifyInitData(old, TOKEN, 3600), null);
  assert.equal(await verifyInitData('', TOKEN, 3600), null);
});

test('webhook: без правильного secret_token — 403', async () => {
  const env = makeEnv(); sent = [];
  assert.equal((await worker.fetch(post('/webhook', msg(OWNER, '/start')), env)).status, 403);
  assert.equal((await worker.fetch(post('/webhook', msg(OWNER, '/start'), { 'X-Telegram-Bot-Api-Secret-Token': 'wrong' }), env)).status, 403);
  assert.equal(sent.length, 0);
});

test('webhook: режим налаштування показує id на /start', async () => {
  const env = makeEnv({ ALLOWED_USER_ID: '' }); sent = [];
  const r = await worker.fetch(post('/webhook', msg(555, '/start'), { 'X-Telegram-Bot-Api-Secret-Token': 'whsec' }), env);
  assert.equal(r.status, 200);
  assert.equal(sent.length, 1);
  assert.match(sent[0].body.text, /555/);
  assert.equal(sent[0].body.reply_markup, undefined);
});

test('webhook: власниці — привітання з кнопкою Mini App, чужим — лише їхній id на /start', async () => {
  const env = makeEnv(); sent = [];
  await worker.fetch(post('/webhook', msg(OWNER, '/start'), { 'X-Telegram-Bot-Api-Secret-Token': 'whsec' }), env);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, `https://tg.test/bot${TOKEN}/sendAnimation`);
  assert.equal(sent[0].body.animation, 'https://app.test/bot/welcome.mp4');
  assert.match(sent[0].body.caption, /Зелена хвиля/);
  assert.equal(sent[0].body.reply_markup.inline_keyboard[0][0].web_app.url, 'https://app.test/');
  sent = [];
  await worker.fetch(post('/webhook', msg(OWNER, 'привіт'), { 'X-Telegram-Bot-Api-Secret-Token': 'whsec' }), env);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, `https://tg.test/bot${TOKEN}/sendMessage`);
  assert.equal(sent[0].body.reply_markup.inline_keyboard[0][0].web_app.url, 'https://app.test/');
  sent = [];
  await worker.fetch(post('/webhook', msg(999, '/start'), { 'X-Telegram-Bot-Api-Secret-Token': 'whsec' }), env);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, `https://tg.test/bot${TOKEN}/sendMessage`);
  assert.match(sent[0].body.text, /id: 999$/);
  assert.equal(sent[0].body.reply_markup, undefined);
  sent = [];
  await worker.fetch(post('/webhook', msg(999, 'привіт'), { 'X-Telegram-Bot-Api-Secret-Token': 'whsec' }), env);
  assert.equal(sent.length, 0);
});

test('webhook: кілька користувачів через кому — кожному привітання з кнопкою', async () => {
  const env = makeEnv({ ALLOWED_USER_ID: `${OWNER}, 888002` }); sent = [];
  for (const id of [OWNER, 888002]) await worker.fetch(post('/webhook', msg(id, '/start'), { 'X-Telegram-Bot-Api-Secret-Token': 'whsec' }), env);
  assert.deepEqual(sent.map(x => [x.url.split('/').pop(), x.body.chat_id]), [['sendAnimation', OWNER], ['sendAnimation', 888002]]);
});

test('webhook: файл від користувача запам’ятовується в KV, від чужих — ні', async () => {
  const env = makeEnv(); sent = [];
  const doc = (from) => ({ update_id: 2, message: { message_id: 2, from: { id: from }, chat: { id: from, type: 'private' }, document: { file_id: 'F1', file_name: 'q.pdf', file_size: 3145728 } } });
  await worker.fetch(post('/webhook', doc(999), { 'X-Telegram-Bot-Api-Secret-Token': 'whsec' }), env);
  assert.equal(env.store.get('upload:last'), undefined);
  await worker.fetch(post('/webhook', doc(OWNER), { 'X-Telegram-Bot-Api-Secret-Token': 'whsec' }), env);
  const u = JSON.parse(env.store.get('upload:last'));
  assert.deepEqual([u.file_id, u.file_name, u.file_size, u.from], ['F1', 'q.pdf', 3145728, OWNER]);
  assert.equal(sent.at(-1).body.text, 'Файл отримано: q.pdf (3.0 МБ).');
});

test('webhook: на файл понад 20 МБ бот дає кнопку сторінки завантаження', async () => {
  const env = makeEnv(); sent = [];
  const big = { update_id: 3, message: { message_id: 3, from: { id: OWNER }, chat: { id: OWNER, type: 'private' }, document: { file_id: 'F2', file_name: 'big.pdf', file_size: 41 * 1048576 } } };
  await worker.fetch(post('/webhook', big, { 'X-Telegram-Bot-Api-Secret-Token': 'whsec' }), env);
  assert.match(sent.at(-1).body.text, /завеликий/);
  assert.equal(sent.at(-1).body.reply_markup.inline_keyboard[0][0].web_app.url, 'https://app.test/upload.html');
});

test('upload: частини лише від дозволених, з перевіркою розміру; остання частина записує опис файлу', async () => {
  const env = makeEnv();
  const up = (initData, part, parts, bytes, extra = {}) => worker.fetch(new Request('https://app.test/api/upload', {
    method: 'POST', body: new Uint8Array(bytes).fill(7),
    headers: { 'X-Init-Data': initData, 'X-Part': String(part), 'X-Parts': String(parts), 'X-Name': encodeURIComponent('питання.pdf'), 'X-Size': '15', ...extra } }), env);
  assert.equal((await up('', 0, 2, 10)).status, 401);
  assert.equal((await up(initFor(999), 0, 2, 10)).status, 403);
  assert.equal((await up(initFor(OWNER), 2, 2, 10)).status, 400);
  assert.equal((await up(initFor(OWNER), 0, 2, 8 * 1048576 + 1)).status, 413);
  assert.equal((await up(initFor(OWNER), 0, 2, 10)).status, 200);
  assert.equal(env.store.get('upload:file'), undefined);
  assert.equal((await up(initFor(OWNER), 1, 2, 5)).status, 200);
  assert.equal(env.store.get('upload:part:0').byteLength, 10);
  assert.deepEqual(JSON.parse(env.store.get('upload:file')), { ...JSON.parse(env.store.get('upload:file')), name: 'питання.pdf', size: 15, parts: 2, from: OWNER });
});

test('webhook: якщо анімація не надіслалась — привітання текстом', async () => {
  const env = makeEnv(); const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push(String(url).split('/').pop());
    return new Response(JSON.stringify({ ok: !String(url).endsWith('/sendAnimation') }));
  };
  try {
    await worker.fetch(post('/webhook', msg(OWNER, '/start'), { 'X-Telegram-Bot-Api-Secret-Token': 'whsec' }), env);
  } finally { globalThis.fetch = realFetch; }
  assert.deepEqual(calls, ['sendAnimation', 'sendMessage']);
});

test('activity: власниця з валідним initData — записує день і серію', async () => {
  const env = makeEnv();
  const r = await worker.fetch(post('/api/activity', { initData: initFor(OWNER), streak: 4 }), env);
  assert.equal(r.status, 200);
  const a = JSON.parse(env.store.get('activity:' + OWNER));
  assert.equal(a.streak, 4);
  assert.equal(a.day, kyivNow(new Date()).date);
  assert.equal((await worker.fetch(post('/api/activity', { initData: initFor(999), streak: 1 }), env)).status, 403);
  assert.equal((await worker.fetch(post('/api/activity', { initData: initFor(OWNER).replace(/hash=\w+/, 'hash=00'), streak: 1 }), env)).status, 401);
  assert.equal((await worker.fetch(post('/api/activity', { nope: 1 }), env)).status, 400);
});

test('інші шляхи віддаються зі статичних файлів', async () => {
  const r = await worker.fetch(new Request('https://app.test/index.html'), makeEnv());
  assert.equal(await r.text(), 'asset');
});

test('київський час: зимовий UTC+2 і літній UTC+3', () => {
  assert.deepEqual(kyivNow(new Date('2026-01-15T17:00:00Z')), { date: '2026-01-15', hour: 19 });
  assert.deepEqual(kyivNow(new Date('2026-07-15T16:00:00Z')), { date: '2026-07-15', hour: 19 });
  assert.deepEqual(kyivNow(new Date('2026-07-15T21:30:00Z')), { date: '2026-07-16', hour: 0 });
  assert.equal(prevDay('2026-03-01'), '2026-02-28');
});

test('текст нагадування', () => {
  assert.equal(reminderText({ day: '2026-07-14', streak: 3 }, '2026-07-15'), 'Серія 3 дні під загрозою. 10 хвилин на ПДР?');
  assert.equal(reminderText({ day: '2026-07-14', streak: 1 }, '2026-07-15'), 'Серія 1 день під загрозою. 10 хвилин на ПДР?');
  assert.equal(reminderText({ day: '2026-07-14', streak: 12 }, '2026-07-15'), 'Серія 12 днів під загрозою. 10 хвилин на ПДР?');
  assert.equal(reminderText({ day: '2026-07-15', streak: 3 }, '2026-07-15'), null);
  assert.equal(reminderText({ day: '2026-07-10', streak: 3 }, '2026-07-15'), 'Почнімо нову серію? 10 хвилин на ПДР.');
  assert.equal(reminderText(null, '2026-07-15'), 'Почнімо нову серію? 10 хвилин на ПДР.');
});

async function cron(env, iso) {
  let p; await worker.scheduled({ scheduledTime: Date.parse(iso) }, env, { waitUntil: x => { p = x; } }); await p;
}

test('cron: о 19:00 за Києвом узимку і влітку, один раз на день, не після заняття', async () => {
  for (const [at19, at18] of [['2026-01-15T17:00:00Z', '2026-01-15T16:00:00Z'], ['2026-07-15T16:00:00Z', '2026-07-15T15:00:00Z']]) {
    const day = at19.slice(0, 10);
    const env = makeEnv(); env.store.set('origin', 'https://app.test/');
    env.store.set('activity:' + OWNER, JSON.stringify({ day: prevDay(day), streak: 5 }));
    sent = []; await cron(env, at18); assert.equal(sent.length, 0, '18:00 — ще рано');
    await cron(env, at19); assert.equal(sent.length, 1, '19:00 — нагадування');
    assert.equal(sent[0].body.text, 'Серія 5 днів під загрозою. 10 хвилин на ПДР?');
    assert.equal(sent[0].body.chat_id, String(OWNER));
    assert.equal(sent[0].body.reply_markup.inline_keyboard[0][0].web_app.url, 'https://app.test/');
    await cron(env, new Date(Date.parse(at19) + 3600e3).toISOString()); assert.equal(sent.length, 1, 'вдруге того ж дня не шле');
  }
  const env = makeEnv(); env.store.set('activity:' + OWNER, JSON.stringify({ day: '2026-07-15', streak: 2 }));
  sent = []; await cron(env, '2026-07-15T16:00:00Z'); assert.equal(sent.length, 0, 'сьогодні вже займалась');
});

test('cron: якщо о 19:00 не вдалося надіслати — пробує о 20:00', async () => {
  const env = makeEnv();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false }));
  await cron(env, '2026-07-15T16:00:00Z');
  assert.equal(env.store.get('reminded:' + OWNER), undefined);
  globalThis.fetch = realFetch; sent = [];
  await cron(env, '2026-07-15T17:00:00Z');
  assert.equal(sent.length, 1);
  assert.equal(env.store.get('reminded:' + OWNER), '2026-07-15');
});

test('кілька користувачів: активність і нагадування в кожного свої', async () => {
  const env = makeEnv({ ALLOWED_USER_ID: `${OWNER},888002` });
  const r = await worker.fetch(post('/api/activity', { initData: initFor(888002), streak: 2 }), env);
  assert.equal(r.status, 200);
  assert.equal(JSON.parse(env.store.get('activity:888002')).streak, 2);
  assert.equal((await worker.fetch(post('/api/activity', { initData: initFor(999), streak: 1 }), env)).status, 403);
  // 888002 сьогодні займався, власниця — ні: нагадування лише їй, і один раз
  env.store.set('activity:888002', JSON.stringify({ day: '2026-07-15', streak: 2 }));
  sent = []; await cron(env, '2026-07-15T16:00:00Z');
  assert.deepEqual(sent.map(x => x.body.chat_id), [String(OWNER)]);
  await cron(env, '2026-07-15T17:00:00Z');
  assert.equal(sent.length, 1);
});

test('ключі з часів однієї користувачки читаються для першого id', async () => {
  const env = makeEnv({ ALLOWED_USER_ID: `${OWNER},888002` });
  env.store.set('activity', JSON.stringify({ day: '2026-07-14', streak: 7 }));
  env.store.set('reminded', '2026-07-15');
  sent = []; await cron(env, '2026-07-15T16:00:00Z');
  assert.deepEqual(sent.map(x => x.body.chat_id), ['888002'], 'власниці сьогодні вже нагадували');
  env.store.delete('reminded');
  sent = []; await cron(env, '2026-07-15T17:00:00Z');
  assert.deepEqual(sent.map(x => [x.body.chat_id, x.body.text]), [[String(OWNER), 'Серія 7 днів під загрозою. 10 хвилин на ПДР?']]);
});
