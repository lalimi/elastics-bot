// Налаштування бота через Bot API: webhook із secret_token, кнопка меню «Тренажер», команда /start.
// Усі значення беруться зі змінних середовища, у файли нічого не пишеться:
//   BOT_TOKEN, WEBHOOK_SECRET, APP_URL (https://…workers.dev/), ALLOWED_USER_ID (необов'язково; кілька id — через кому)
const { BOT_TOKEN, WEBHOOK_SECRET, ALLOWED_USER_ID } = process.env;
let APP_URL = process.env.APP_URL || '';
if (!BOT_TOKEN || !WEBHOOK_SECRET || !APP_URL) {
  console.error('Потрібні змінні середовища BOT_TOKEN, WEBHOOK_SECRET і APP_URL.');
  process.exit(1);
}
if (!/^https:\/\//.test(APP_URL)) { console.error('APP_URL має починатися з https://'); process.exit(1); }
if (!APP_URL.endsWith('/')) APP_URL += '/';

async function call(method, payload) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload || {})
  });
  const j = await r.json();
  console.log(`${method}: ${j.ok ? 'ok' : 'помилка — ' + j.description}`);
  if (!j.ok) process.exitCode = 1;
  return j;
}

const me = await call('getMe');
if (me.ok) console.log(`  бот: @${me.result.username}`);
await call('setWebhook', {
  url: APP_URL + 'webhook',
  secret_token: WEBHOOK_SECRET,
  allowed_updates: ['message'],
  drop_pending_updates: true
});
await call('setMyCommands', { commands: [{ command: 'start', description: 'Відкрити тренажер' }] });
await call('setMyDescription', { description: '«Зелена хвиля» — особистий тренажер ПДР України: 850 питань за чинними правилами, пробний іспит на 20 хвилин, анімовані схеми до питань, гра на перехрестях і нагадування щовечора.' });
await call('setMyShortDescription', { short_description: 'Тренажер ПДР: 850 питань, пробний іспит і анімовані схеми 🚦' });
const menu = { type: 'web_app', text: 'Тренажер', web_app: { url: APP_URL } };
const ids = String(ALLOWED_USER_ID || '').split(/[\s,]+/).filter(Boolean);
if (ids.length) for (const id of ids) await call('setChatMenuButton', { chat_id: Number(id), menu_button: menu });
else console.log('setChatMenuButton: пропущено — спершу задай ALLOWED_USER_ID (id прийде на /start)');
const info = await call('getWebhookInfo');
if (info.ok) console.log(`  webhook: ${info.result.url}, очікує оновлень: ${info.result.pending_update_count}${info.result.last_error_message ? ', остання помилка: ' + info.result.last_error_message : ''}`);
