// «Зелена хвиля» — Cloudflare Worker: роздає Mini App (public/), приймає webhook бота,
// записує активність з Mini App і щовечора нагадує про заняття.
//
// Секрети (лише `wrangler secret put`, ніколи у файлах):
//   BOT_TOKEN        — токен від @BotFather
//   WEBHOOK_SECRET   — той самий secret_token, що переданий у setWebhook
//   ALLOWED_USER_ID  — Telegram user id власниці; поки не заданий, бот лише показує id на /start
// KV:  activity = {day, streak, at}, reminded = дата останнього нагадування, origin = адреса застосунку

import { verifyInitData, kyivNow, reminderText, REMIND_FROM, REMIND_UNTIL } from './lib.js';

const INIT_DATA_MAX_AGE = 48 * 3600;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/webhook') return req.method === 'POST' ? webhook(req, env, url) : status(405);
    if (url.pathname === '/api/activity') return req.method === 'POST' ? activity(req, env, url) : status(405);
    return env.ASSETS.fetch(req);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(remind(env, new Date(event.scheduledTime)).then(r => console.log('remind:', r)));
  }
};

const status = (code) => new Response(null, { status: code });
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
  if (!env.ALLOWED_USER_ID) {
    if (isStart) await tg(env, 'sendMessage', { chat_id: msg.chat.id, text: `Твій Telegram id: ${msg.from.id}\n\nНадішли це число Claude, щоб закріпити бота за тобою.` });
    return status(200);
  }
  if (String(msg.from.id) !== String(env.ALLOWED_USER_ID)) return status(200); // чужим не відповідаємо

  const app = await appUrl(env, url);
  await tg(env, 'sendMessage', {
    chat_id: msg.chat.id,
    text: isStart
      ? 'Привіт! Це «Зелена хвиля» — тренажер ПДР. Тисни кнопку, щоб почати. Щовечора о 19:00 нагадаю, якщо день ще без практики.'
      : 'Тренажер відкривається кнопкою нижче або «Тренажер» біля поля вводу.',
    reply_markup: openButton(app)
  });
  return status(200);
}

async function activity(req, env, url) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.initData !== 'string') return json({ ok: false }, 400);
  const v = await verifyInitData(body.initData, env.BOT_TOKEN, INIT_DATA_MAX_AGE);
  if (!v) return json({ ok: false }, 401);
  if (!env.ALLOWED_USER_ID || String(v.user.id) !== String(env.ALLOWED_USER_ID)) return json({ ok: false }, 403);
  const streak = Math.max(0, Math.min(100000, parseInt(body.streak, 10) || 0));
  const { date } = kyivNow(new Date());
  await env.KV.put('activity', JSON.stringify({ day: date, streak, at: Date.now() }));
  await appUrl(env, url);
  return json({ ok: true });
}

// Cron щогодини (UTC). Нагадування — о 19:00 за Києвом; якщо не вдалося — наступними запусками до 22:00.
async function remind(env, now) {
  if (!env.BOT_TOKEN || !env.ALLOWED_USER_ID) return 'not-configured';
  const { date, hour } = kyivNow(now);
  if (hour < REMIND_FROM || hour >= REMIND_UNTIL) return 'not-time';
  if ((await env.KV.get('reminded')) === date) return 'already';
  const act = JSON.parse((await env.KV.get('activity')) || 'null');
  const text = reminderText(act, date);
  if (!text) return 'active-today';
  const app = await appUrl(env);
  const r = await tg(env, 'sendMessage', { chat_id: env.ALLOWED_USER_ID, text, ...(app ? { reply_markup: openButton(app) } : {}) });
  if (!r.ok) return 'send-failed';
  await env.KV.put('reminded', date, { expirationTtl: 3 * 86400 });
  return 'sent';
}
