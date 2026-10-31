// Перевірка бази перед деплоєм: офіційні питання ГСЦ (public/js/official.js) — формат, унікальність,
// правильна відповідь серед варіантів, малюнки на місці; пояснення простими словами (public/js/explain.js) —
// є для кожного питання, без нових чисел і посилань на пункти.
// node scripts/check-questions.mjs
import fs from 'node:fs';
import vm from 'node:vm';

const EXPECTED = 1762;
const load = (name, key) => { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(new URL('../public/js/' + name, import.meta.url), 'utf8'), ctx); return ctx.window[key]; };
const OFF = load('official.js', 'OFFICIAL');
const EXPLAIN = load('explain.js', 'EXPLAIN') || {};

const errors = [];
const idOf = (s, n) => 'o' + s.replace('.', '_') + '-' + n;
const seen = new Set(), secs = new Set(OFF.secs.map(x => x[0])), count = {};
for (const [s, n, q, o, c, img] of OFF.q) {
  const at = `ГСЦ ${s}/${n}`;
  if (seen.has(idOf(s, n))) errors.push(`${at}: повтор`); seen.add(idOf(s, n));
  if (!secs.has(s)) errors.push(`${at}: невідомий розділ`);
  count[s] = (count[s] || 0) + 1;
  if (!q || !q.trim()) errors.push(`${at}: порожнє питання`);
  if (!Array.isArray(o) || o.length < 2 || o.some(x => !x || !x.trim())) errors.push(`${at}: погані варіанти`);
  if (!(Number.isInteger(c) && c >= 0 && c < o.length)) errors.push(`${at}: правильна відповідь поза варіантами`);
  if (img && !fs.existsSync(new URL('../public/off/' + img, import.meta.url))) errors.push(`${at}: немає малюнка ${img}`);
}
OFF.secs.forEach(([s]) => {
  const ns = OFF.q.filter(x => x[0] === s).map(x => x[1]);
  if (!ns.length) errors.push(`ГСЦ розділ ${s} порожній`);
  if (ns.some((n, i) => n !== i + 1)) errors.push(`ГСЦ розділ ${s}: нумерація з пропусками`);
});
if (OFF.q.length !== EXPECTED) errors.push(`офіційних питань ${OFF.q.length}, очікувалось ${EXPECTED}`);

// пояснення: [простими словами, як запам'ятати]; кожне число має бути в тексті питання чи варіантів
const nums = t => (t.match(/\d+(?:[.,]\d+)?/g) || []).map(d => d.replace(',', '.'));
for (const [s, n, q, o] of OFF.q) {
  const id = idOf(s, n), p = EXPLAIN[id];
  if (!Array.isArray(p) || p.length !== 2 || !p.every(t => typeof t === 'string' && t.trim())) { errors.push(`${id}: немає пояснення простими словами`); continue; }
  const allowed = new Set(nums([q, ...o].join(' ')));
  p.forEach((t, i) => {
    if (t.length > (i ? 150 : 260)) errors.push(`${id}: пояснення задовге`);
    if (/\bп\.\s*\d|пункт\w*\s*\d|ст\.\s*\d|стат\w*\s*\d/i.test(t)) errors.push(`${id}: у поясненні посилання на пункт чи статтю`);
    if (/[<>]/.test(t)) errors.push(`${id}: у поясненні символи < >`);
    nums(t).filter(d => !allowed.has(d)).forEach(d => errors.push(`${id}: у поясненні число ${d}, якого немає в питанні`));
  });
}
Object.keys(EXPLAIN).filter(id => !seen.has(id)).forEach(id => errors.push(`пояснення для неіснуючого питання ${id}`));

console.log(`Офіційних питань ГСЦ: ${OFF.q.length} у ${OFF.secs.length} розділах, з малюнками ${OFF.q.filter(x => x[5]).length}; пояснень: ${Object.keys(EXPLAIN).length}`);
if (errors.length) { console.error('\nПомилки:\n' + errors.slice(0, 60).map(e => '  ' + e).join('\n') + (errors.length > 60 ? `\n  …і ще ${errors.length - 60}` : '')); process.exit(1); }
console.log('OK');
