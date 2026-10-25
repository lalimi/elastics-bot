'use strict';
/* ---------- розкладка прогресу по ключах Telegram CloudStorage ----------
   Ліміти: значення ≤ 4096 символів, ключ ≤ 128, до 1024 ключів на користувача.
   zh_meta            — загальні дані (XP, серія, іспити, гра, досягнення…) + перелік решти ключів
   zh_fav[_N]         — обране
   zh_q_<розділ>[_N]  — статистика питань розділу: {"id":[правильних, помилок, серія]}
   Значення, що не влазить у ліміт, ділиться на частини _1, _2…
   zh_meta пишеться останнім, тож перелік у ньому завжди вказує на вже записані частини. */
const CS_LIMIT=4000, CS_META='zh_meta';

function csSplit(base,value){
  const isArr=Array.isArray(value), items=isArr?value:Object.entries(value);
  const out={}; let part=[], len=2, n=0;
  const close=()=>{ out[n?base+'_'+n:base]=JSON.stringify(isArr?part:Object.fromEntries(part)); n++; part=[]; len=2; };
  for(const it of items){
    const l=(isArr?JSON.stringify(it).length:JSON.stringify({[it[0]]:it[1]}).length-2)+1;
    if(part.length&&len+l>CS_LIMIT) close();
    part.push(it); len+=l;
  }
  if(part.length||!n) close();
  return out;
}

function csPack(S,secOf){
  const out={}, keys=[];
  const add=o=>{ Object.assign(out,o); keys.push(...Object.keys(o)); };
  if(S.fav.length) add(csSplit('zh_fav',S.fav));
  const bySec={};
  Object.keys(S.q).sort().forEach(id=>{ const st=S.q[id], s=secOf(id)||'x'; (bySec[s]=bySec[s]||{})[id]=[st.c,st.w,st.s]; });
  Object.keys(bySec).sort().forEach(s=>add(csSplit('zh_q_'+s,bySec[s])));
  const meta={}; Object.keys(S).forEach(k=>{ if(k!=='q'&&k!=='fav') meta[k]=S[k]; });
  meta.keys=keys;
  out[CS_META]=JSON.stringify(meta);
  return out;
}

// get(key) → рядок або ''/undefined. Кидає помилку, якщо якоїсь частини бракує.
function csUnpack(get){
  const meta=JSON.parse(get(CS_META));
  const o=Object.assign({},meta); delete o.keys; o.q={}; o.fav=[];
  (meta.keys||[]).forEach(k=>{
    const raw=get(k); if(!raw) throw new Error('missing '+k);
    const v=JSON.parse(raw);
    if(k.startsWith('zh_fav')) o.fav.push(...v);
    else if(k.startsWith('zh_q_')) Object.keys(v).forEach(id=>{ const a=v[id]; o.q[id]={c:a[0]|0,w:a[1]|0,s:a[2]|0}; });
  });
  return o;
}

if(typeof module!=='undefined') module.exports={csSplit,csPack,csUnpack,CS_LIMIT,CS_META};
