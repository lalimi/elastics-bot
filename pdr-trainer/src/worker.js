// «Зелена хвиля» — Cloudflare Worker: роздає Mini App (public/), приймає webhook бота,
// записує активність з Mini App і щовечора нагадує про заняття.
//
// Секрети (лише `wrangler secret put`, ніколи у файлах):
//   BOT_TOKEN        — токен від @BotFather
//   WEBHOOK_SECRET   — той самий secret_token, що переданий у setWebhook
//   ALLOWED_USER_ID  — Telegram user id тих, кому відкрито бота, через кому (першим — власниця);
//                      поки не заданий, бот лише показує id на /start
// KV:  activity:<id> = {day, streak, at}, reminded:<id> = дата останнього нагадування, origin = адреса застосунку
//      (activity і reminded без id — ключі з часів, коли користувачка була одна; читаються для першого id)
//      upload:last = {file_id, file_name, file_size, from, at} — останній файл, надісланий боту (для імпорту матеріалів)
//      upload:part:<n>, upload:file = {name, size, parts, from, at} — файл, завантажений частинами через /upload.html

import { verifyInitData, kyivNow, reminderText, REMIND_FROM, REMIND_UNTIL } from './lib.js';

const INIT_DATA_MAX_AGE = 48 * 3600;
const BOT_FILE_LIMIT = 20 * 1024 * 1024;
const UPLOAD_PART = 8 * 1024 * 1024;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/webhook') return req.method === 'POST' ? webhook(req, env, url) : status(405);
    if (url.pathname === '/api/activity') return req.method === 'POST' ? activity(req, env, url) : status(405);
    if (url.pathname === '/api/upload') return req.method === 'POST' ? upload(req, env) : status(405);
    return env.ASSETS.fetch(req);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(remind(env, new Date(event.scheduledTime)).then(r => console.log('remind:', r)));
  }
};

const status = (code) => new Response(null, { status: code });
const allowedIds = (env) => String(env.ALLOWED_USER_ID || '').split(/[\s,]+/).filter(Boolean);
// стан користувача в KV; для першого id — запасний ключ без id (до появи кількох користувачів)
async function userKV(env, key, id) {
  const v = await env.KV.get(`${key}:${id}`);
  return v !== null || id !== allowedIds(env)[0] ? v : env.KV.get(key);
}
const json = (obj, code = 200) => new Response(JSON.stringify(obj), { status: code, headers: { 'content-type': 'application/json' } });

async function tg(env, method, payload) {
  const api = env.TG_API || 'https://api.telegram.org';
  try {
    const r = await fetch(`${api}/bot${env.BOT_TOKEN}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
    });
    return await r.json();
  } catch (e) {
    return { ok: false, description: String(e) };
  }
}

// Адреса застосунку: APP_URL з налаштувань або origin, з якого приходили запити
async function appUrl(env, url) {
  if (env.APP_URL) return env.APP_URL;
  if (url) {
    const origin = url.origin + '/';
    if ((await env.KV.get('origin')) !== origin) await env.KV.put('origin', origin);
    return origin;
  }
  return env.KV.get('origin');
}

const openButton = (url) => ({ inline_keyboard: [[{ text: 'Відкрити тренажер', web_app: { url } }]] });

async function webhook(req, env, url) {
  if (!env.WEBHOOK_SECRET || req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) return status(403);
  const upd = await req.json().catch(() => null);
  const msg = upd && upd.message;
  if (!msg || !msg.from || !msg.chat || msg.chat.type !== 'private') return status(200);
  const text = String(msg.text || '').trim();
  const isStart = /^\/start(\s|@|$)/.test(text);

  // Режим налаштування: власницю ще не закріплено — показуємо id і нічого більше
  const ids = allowedIds(env);
  if (!ids.length) {
    if (isStart) await tg(env, 'sendMessage', { chat_id: msg.chat.id, text: `Твій Telegram id: ${msg.from.id}\n\nНадішли це число Claude, щоб закріпити бота за тобою.` });
    return status(200);
  }
  // Чужим — лише id на /start, щоб власниця могла відкрити доступ; на інше не відповідаємо
  if (!ids.includes(String(msg.from.id))) {
    if (isStart) await tg(env, 'sendMessage', { chat_id: msg.chat.id, text: `Це особистий тренажер ПДР. Щоб отримати доступ, передай власниці бота свій Telegram id: ${msg.from.id}` });
    return status(200);
  }

  // Файл від користувача (напр. PDF з офіційними питаннями) — запам’ятовуємо, щоб забрати через getFile
  if (msg.document) {
    const d = msg.document;
    await env.KV.put('upload:last', JSON.stringify({ file_id: d.file_id, file_name: d.file_name || '', file_size: d.file_size || 0, from: msg.from.id, at: Date.now() }));
    const mb = ((d.file_size || 0) / 1048576).toFixed(1);
    // Bot API віддає боту файли лише до 20 МБ — більші пропонуємо завантажити сторінкою частинами
    if ((d.file_size || 0) > BOT_FILE_LIMIT) {
      const app = await appUrl(env, url);
      await tg(env, 'sendMessage', { chat_id: msg.chat.id, text: `Файл ${d.file_name || 'без назви'} (${mb} МБ) завеликий, щоб бот міг його забрати. Завантаж його кнопкою нижче — сторінка передасть його частинами.`, reply_markup: { inline_keyboard: [[{ text: 'Завантажити файл', web_app: { url: app + 'upload.html' } }]] } });
      return status(200);
    }
    await tg(env, 'sendMessage', { chat_id: msg.chat.id, text: `Файл отримано: ${d.file_name || 'без назви'} (${mb} МБ).` });
    return status(200);
  }
  const app = await appUrl(env, url);
  const welcome = 'Привіт! Це «Зелена хвиля» — тренажер ПДР. Тисни кнопку, щоб почати. Щовечора о 19:00 нагадаю, якщо день ще без практики.';
  // На /start — анімація з public/bot/welcome.mp4; якщо Telegram не зміг її взяти, просто текст
  if (isStart) {
    const r = await tg(env, 'sendAnimation', { chat_id: msg.chat.id, animation: app + 'bot/welcome.mp4', caption: welcome, reply_markup: openButton(app) });
    if (r.ok) return status(200);
  }
  await tg(env, 'sendMessage', {
    chat_id: msg.chat.id,
    text: isStart ? welcome : 'Тренажер відкривається кнопкою нижче або «Тренажер» біля поля вводу.',
    reply_markup: openButton(app)
  });
  return status(200);
}

// Великий файл частинами (до UPLOAD_PART байт кожна) зі сторінки upload.html; доступ — за initData дозволених користувачів
async function upload(req, env) {
  const v = await verifyInitData(req.headers.get('X-Init-Data') || '', env.BOT_TOKEN, INIT_DATA_MAX_AGE);
  if (!v) return json({ ok: false }, 401);
  if (!allowedIds(env).includes(String(v.user.id))) return json({ ok: false }, 403);
  const part = parseInt(req.headers.get('X-Part'), 10), parts = parseInt(req.headers.get('X-Parts'), 10);
  if (!(part >= 0 && parts > 0 && part < parts && parts <= 50)) return json({ ok: false }, 400);
  const body = await req.arrayBuffer();
  if (!body.byteLength || body.byteLength > UPLOAD_PART) return json({ ok: false }, 413);
  await env.KV.put(`upload:part:${part}`, body, { expirationTtl: 7 * 86400 });
  if (part === parts - 1) {
    const name = decodeURIComponent(req.headers.get('X-Name') || '').slice(0, 200);
    const size = parseInt(req.headers.get('X-Size'), 10) || 0;
    await env.KV.put('upload:file', JSON.stringify({ name, size, parts, from: v.user.id, at: Date.now() }), { expirationTtl: 7 * 86400 });
  }
  return json({ ok: true });
}

async function activity(req, env, url) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.initData !== 'string') return json({ ok: false }, 400);
  const v = await verifyInitData(body.initData, env.BOT_TOKEN, INIT_DATA_MAX_AGE);
  if (!v) return json({ ok: false }, 401);
  if (!allowedIds(env).includes(String(v.user.id))) return json({ ok: false }, 403);
  const streak = Math.max(0, Math.min(100000, parseInt(body.streak, 10) || 0));
  const { date } = kyivNow(new Date());
  await env.KV.put(`activity:${v.user.id}`, JSON.stringify({ day: date, streak, at: Date.now() }));
  await appUrl(env, url);
  return json({ ok: true });
}

// Cron щогодини (UTC). Нагадування — о 19:00 за Києвом; якщо не вдалося — наступними запусками до 22:00.
// Кожному з ALLOWED_USER_ID — окремо, за його власною активністю.
async function remind(env, now) {
  const ids = allowedIds(env);
  if (!env.BOT_TOKEN || !ids.length) return 'not-configured';
  const { date, hour } = kyivNow(now);
  if (hour < REMIND_FROM || hour >= REMIND_UNTIL) return 'not-time';
  const app = await appUrl(env);
  const res = [];
  for (const id of ids) res.push(`${id}:${await remindOne(env, id, date, app)}`);
  return res.join(' ');
}
async function remindOne(env, id, date, app) {
  if ((await userKV(env, 'reminded', id)) === date) return 'already';
  const act = JSON.parse((await userKV(env, 'activity', id)) || 'null');
  const text = reminderText(act, date);
  if (!text) return 'active-today';
  const r = await tg(env, 'sendMessage', { chat_id: id, text, ...(app ? { reply_markup: openButton(app) } : {}) });
  if (!r.ok) return 'send-failed';
  await env.KV.put(`reminded:${id}`, date, { expirationTtl: 3 * 86400 });
  return 'sent';
}
