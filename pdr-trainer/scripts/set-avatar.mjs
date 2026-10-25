// Анімована аватарка бота: завантажує assets/avatar.mp4 через setMyProfilePhoto.
// Токен — лише зі змінної середовища: BOT_TOKEN=… npm run set-avatar
// Перегенерувати відео: npm run media
import fs from 'node:fs';

const { BOT_TOKEN } = process.env;
if (!BOT_TOKEN) { console.error('Потрібна змінна середовища BOT_TOKEN.'); process.exit(1); }

const video = new URL('../assets/avatar.mp4', import.meta.url);
const form = new FormData();
form.append('photo', JSON.stringify({ type: 'animated', animation: 'attach://avatar', main_frame_timestamp: 2.6 }));
form.append('avatar', new Blob([fs.readFileSync(video)], { type: 'video/mp4' }), 'avatar.mp4');

const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyProfilePhoto`, { method: 'POST', body: form });
const j = await r.json();
console.log(`setMyProfilePhoto: ${j.ok ? 'ok' : 'помилка — ' + j.description}`);
if (!j.ok) process.exitCode = 1;
