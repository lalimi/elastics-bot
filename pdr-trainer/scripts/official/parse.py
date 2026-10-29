# questions.pdf (pdftohtml -xml, 1px = 1pt) → питання, варіанти, ділянки з малюнками (сторінка + рамка)
import re, json, sys, html
import xml.etree.ElementTree as ET
src, out = sys.argv[1], sys.argv[2]
root = ET.parse(src).getroot()
def txt(el): return html.unescape(''.join(el.itertext())).replace(' ', ' ')
UP, LOW = re.compile(r"[А-ЯІЇЄҐA-Z]"), re.compile(r"[а-яіїєґa-z]")
upper = lambda t: len(UP.findall(t)) >= 4 and len(UP.findall(t)) > 3 * max(1, len(LOW.findall(t)))
secs, cur_sec, q, qs, orph = [], None, None, [], []
def new_sec(sid, title, pno):
    global cur_sec, q
    cur_sec = {'id': sid, 'title': title, 'page': pno}; secs.append(cur_sec); q = None
for page in root.iter('page'):
    pno = int(page.get('number'))
    els = []
    for el in page:
        if el.tag not in ('text', 'image'): continue
        top, left, w, h = (int(el.get(k)) for k in ('top', 'left', 'width', 'height'))
        if el.tag == 'image': els.append({'k': 'img', 'top': top, 'left': left, 'w': w, 'h': h, 'src': el.get('src')}); continue
        t = txt(el).strip()
        if not t or (re.fullmatch(r'\d{1,3}', t) and top < 50): continue   # номер сторінки
        els.append({'k': 't', 'top': top, 'left': left, 'w': w, 'h': h, 't': t, 'b': el.find('b') is not None})
    # рядки: елементи з різницею top ≤ 4 — один рядок, у ньому зліва направо
    els.sort(key=lambda e: e['top']); line, cur = 0, None
    for e in els:
        if cur is None or e['top'] - cur > 4: line += 1; cur = e['top']
        e['line'] = line
    els.sort(key=lambda e: (e['line'], e['left']))
    for e in els:
        box = {'page': pno, 'x0': e['left'], 'y0': e['top'], 'x1': e['left'] + e['w'], 'y1': e['top'] + e['h']}
        if e['k'] == 'img':
            if q is not None and not q['opts']: q['fig'].append(box)
            elif q is not None: q['late_fig'].append(box)
            else: orph.append(('img', pno, e['src']))
            continue
        t, b, left = e['t'], e['b'], e['left']
        m_sec = re.match(r'^(\d+(?:\.\d+)?)\.?\s*([А-ЯІЇЄҐA-Z].+)$', t)
        if b and m_sec and upper(t): new_sec(m_sec.group(1), m_sec.group(2).strip(), pno); continue
        if b and upper(t) and q is None and cur_sec: cur_sec['title'] += ' ' + t; continue
        if b and upper(t) and q is not None and not q['q'].strip() and not q['opts']:   # «53.» окремо від заголовка
            qs.pop(); new_sec(str(q['n']), t, pno); continue
        m_q = re.match(r'^(\d+)\.(?!\d)\s*(.*)$', t)
        prev_n = q['n'] if q is not None else (qs[-1]['n'] if qs and qs[-1]['sec'] == (cur_sec or {}).get('id') else 0)
        if m_q and left <= 95 and (b or (not m_q.group(2) and int(m_q.group(1)) == prev_n + 1)):
            q = {'sec': cur_sec['id'] if cur_sec else None, 'n': int(m_q.group(1)), 'q': (m_q.group(2) or '').strip(), 'opts': [], 'fig': [], 'late_fig': [], 'page': pno, 'qbox': [box], 'obox': []}
            qs.append(q); continue
        if q is None: orph.append(('text', pno, t)); continue
        m_o = re.match(r'^(\d)[).](?:\s+(.*)|$)', t)
        if m_o and left <= 120 and (not b or q['q']) and int(m_o.group(1)) == len(q['opts']) + 1:
            q['opts'].append((m_o.group(2) or '').strip()); q['obox'].append(box); continue
        if left > 95 and not q['opts'] and (re.fullmatch(r'[\d.,A-ZА-ЯІЇЄ\s«»"]{1,12}', t) or q['fig']):  # підписи в малюнку
            q['fig'].append(box); continue
        if q['opts']: q['opts'][-1] = (q['opts'][-1] + ' ' + t).strip(); q['obox'].append(box)
        else: q['q'] = (q['q'] + ' ' + t).strip(); q['qbox'].append(box)
norm = lambda s: re.sub(r'\s+', ' ', s).strip()
for q in qs:
    q['q'] = norm(q['q']); q['opts'] = [norm(o) for o in q['opts']]
json.dump({'sections': secs, 'questions': qs, 'orphans': orph}, open(out, 'w'), ensure_ascii=False, indent=0)
print('sections', len(secs), 'questions', len(qs), 'orphans', len(orph))
