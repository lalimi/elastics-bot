// Допоміжні функції бота: перевірка initData, київський час, тексти.

const enc = new TextEncoder();

async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? enc.encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
}

function sameHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// Перевірка підпису initData за документацією Telegram:
// secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token)
// hash = hex(HMAC_SHA256(key=secret_key, msg=data_check_string)),
// data_check_string — усі поля, крім hash, "key=value", відсортовані за ключем, через \n.
// Повертає {user, authDate} або null.
export async function verifyInitData(initData, botToken, maxAgeSec, nowMs = Date.now()) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  const pairs = [];
  for (const [k, v] of params) if (k !== 'hash') pairs.push([k, v]);
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const dataCheck = pairs.map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = await hmac('WebAppData', botToken);
  const sig = await hmac(secret, dataCheck);
  const hex = Array.from(sig, b => b.toString(16).padStart(2, '0')).join('');
  if (!sameHex(hex, hash)) return null;
  const authDate = Number(params.get('auth_date'));
  if (!authDate || nowMs / 1000 - authDate > maxAgeSec) return null;
  let user;
  try { user = JSON.parse(params.get('user')); } catch { return null; }
  if (!user || typeof user.id !== 'number') return null;
  return { user, authDate };
}

// Дата і година за Києвом (перехід на літній/зимовий час враховує сам Intl)
let kyivFmt;
function fmt() {
  if (kyivFmt) return kyivFmt;
  const opts = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' };
  try { kyivFmt = new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: 'Europe/Kyiv' }); }
  catch { kyivFmt = new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: 'Europe/Kiev' }); }
  return kyivFmt;
}
export function kyivNow(d) {
  const p = {};
  for (const x of fmt().formatToParts(d)) p[x.type] = x.value;
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}
export function prevDay(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

export function plural(n, a, b, c) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return a;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return b;
  return c;
}

export const REMIND_FROM = 19; // о 19:00 за Києвом
export const REMIND_UNTIL = 22; // якщо о 19:00 не вдалося надіслати — пробуємо до 22:00

// Текст нагадування або null, якщо сьогодні вже займалась
export function reminderText(activity, today) {
  if (activity && activity.day === today) return null;
  const n = activity && activity.day === prevDay(today) ? activity.streak | 0 : 0;
  if (n > 0) return `Серія ${n} ${plural(n, 'день', 'дні', 'днів')} під загрозою. 10 хвилин на ПДР?`;
  return 'Почнімо нову серію? 10 хвилин на ПДР.';
}
