# Офіційна база ГСЦ МВС (наказ від 29.10.2025 № 225) → public/js/official.js і public/off/*.webp.
# Вхід: parsed.json (parse.py з PDF питань), figs.json + малюнки (figs.py), answers.json — перевірена таблиця
# відповідей {"розділ": "номери відповідей підряд"} (два незалежні читання скану збіглися повністю).
# Тексти — дослівно з PDF; виправлено лише технічне: пробіли перед розділовими знаками, апострофи,
# хвости «».» після тексту, злиті слова в 33/39, варіанти без номерів у 45/16.
import json, re, sys, os, shutil
parsed, figs_json, figs_dir, answers, out_js, out_img = sys.argv[1:7]
SECS = [str(i) for i in range(1, 8)] + ['8.1', '8.2'] + [str(i) for i in range(9, 16)] + ['16.1', '16.2'] + [str(i) for i in range(17, 40)] + [str(i) for i in range(44, 48)]
d = json.load(open(parsed)); figs = json.load(open(figs_json)); ans = {s: v.replace(' ', '') for s, v in json.load(open(answers)).items()}
FIX = {('45', 16): {'q': 'Наведений індикатор червоного кольору інформує про:', 'opts': ['Відчинені двері автомобіля.', 'Блокування дверей автомобіля.', 'Відчинені двері багажника.']}}
GLUED = {'триколіснихтранспортнихзасобів': 'триколісних транспортних засобів', 'спеціальновідведенійсмузі': 'спеціально відведеній смузі', 'розташованійзправогобокупроїзноїчастини': 'розташованій з правого боку проїзної частини'}
def clean(t):
    for a, b in GLUED.items(): t = t.replace(a, b)
    t = re.sub(r'\s*[’\']\s*(?=[а-яіїєґ])', '’', t)
    t = re.sub(r'\s+([.,;:!?)])', r'\1', t)
    t = re.sub(r'([.!?])\s*»\.$', r'\1', t)
    return re.sub(r'\s+', ' ', t).strip()
def title(t):
    t = t.strip().lower(); t = t[0].upper() + t[1:]
    return re.sub(r'\bв1, в\b', 'В1, В', t)
titles = {s['id']: title(s['title']) for s in d['sections']}
os.makedirs(out_img, exist_ok=True)
rows, problems = [], []
for q in d['questions']:
    s, n = q['sec'], q['n']
    if s not in SECS: continue
    f = FIX.get((s, n), {})
    text, opts = clean(f.get('q', q['q'])), [clean(o) for o in f.get('opts', q['opts'])]
    a = int(ans[s][n - 1]) - 1
    if not (0 <= a < len(opts)) or len(opts) < 2 or not text: problems.append((s, n))
    fig = figs.get(f'{s}/{n}')
    if fig: shutil.copy(os.path.join(figs_dir, fig[0]), os.path.join(out_img, fig[0]))
    rows.append([s, n, text, opts, a] + ([fig[0], fig[1], fig[2]] if fig else []))
assert not problems, problems
data = {'src': 'Наказ ГСЦ МВС від 29.10.2025 № 225', 'secs': [[s, titles[s]] for s in SECS], 'q': rows}
with open(out_js, 'w') as fh:
    fh.write("'use strict';\n/* Офіційні тестові питання ГСЦ МВС для категорії B (розділи 1–39 і 44–47), наказ від 29.10.2025 № 225.\n   Згенеровано scripts/official/build.py; q: [розділ, номер, питання, [варіанти в офіційному порядку], індекс правильного, малюнок?, ширина?, висота?] */\n")
    fh.write('window.OFFICIAL=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('questions', len(rows), 'with images', sum(1 for r in rows if len(r) > 5), 'js KB', os.path.getsize(out_js) // 1024)
