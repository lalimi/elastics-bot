// Перевірка бази питань перед деплоєм: формат, унікальні id, розділи, малюнки знаків.
// node scripts/check-questions.mjs
import fs from 'node:fs';
import vm from 'node:vm';

const EXPECTED = 850;
const file = new URL('../public/js/questions.js', import.meta.url);
const { SEC_LIST, QB } = vm.runInNewContext(fs.readFileSync(file, 'utf8') + '\n;({SEC_LIST,QB})');

const NS = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 130];
const SIGNS = new Set(['giveway', 'stop', 'main', 'endmain', 'notraffic', 'noentry', 'noright', 'noleft', 'nouturn', 'noovertake', 'endnoovertake', 'endall', 'nostopping', 'noparking', 'straight', 'right', 'left', 'straightright', 'straightleft', 'rightleft', 'keepright', 'keepleft', 'oneway', 'endoneway', 'parking', 'danger', 'crossroads', 'trafficlight', 'rail1', 'railmulti', 'speed40', ...NS.map(n => 'speed' + n), ...NS.map(n => 'endspeed' + n)]);

const errors = [];
const secs = new Set(SEC_LIST.map(s => s.id));
const ids = new Set(), texts = new Map(), count = {};
for (const x of QB) {
  const at = x.id;
  if (ids.has(x.id)) errors.push(`${at}: повтор id`); ids.add(x.id);
  if (!secs.has(x.s)) errors.push(`${at}: невідомий розділ ${x.s}`);
  count[x.s] = (count[x.s] || 0) + 1;
  if (!x.q || !x.q.trim()) errors.push(`${at}: порожнє питання`);
  if (!Array.isArray(x.o) || x.o.length < 2 || x.o.length > 4) errors.push(`${at}: має бути 2–4 варіанти`);
  else if (new Set(x.o.map(o => o.trim().toLowerCase())).size !== x.o.length) errors.push(`${at}: однакові варіанти`);
  if (!x.e || !x.e.trim()) errors.push(`${at}: немає пояснення`);
  if (x.sign && !SIGNS.has(x.sign)) errors.push(`${at}: немає малюнка для знака ${x.sign}`);
  const key = x.q.trim().toLowerCase() + '|' + (x.sign || '') + '|' + x.o[0].trim().toLowerCase();
  if (texts.has(key)) errors.push(`${at}: дублює ${texts.get(key)}`); texts.set(key, x.id);
}
SEC_LIST.forEach(s => { if (!count[s.id]) errors.push(`розділ ${s.id} порожній`); });
if (QB.length !== EXPECTED) errors.push(`питань ${QB.length}, очікувалось ${EXPECTED}`);

console.log(`Питань: ${QB.length}, розділів: ${SEC_LIST.length}`);
console.log(SEC_LIST.map(s => `  ${s.sh}: ${count[s.id] || 0}`).join('\n'));
if (errors.length) { console.error('\nПомилки:\n' + errors.map(e => '  ' + e).join('\n')); process.exit(1); }
console.log('OK');
