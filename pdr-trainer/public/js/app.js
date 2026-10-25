'use strict';
const QMAP={}; QB.forEach(x=>QMAP[x.id]=x);
const BYSEC={}; QB.forEach(x=>{(BYSEC[x.s]=BYSEC[x.s]||[]).push(x);});

/* ---------- стан і збереження ---------- */
const LS_KEY='zh-pdr-v1';
function defaults(){return {v:1,q:{},xp:0,streak:0,last:null,today:{d:null,n:0},fav:[],exams:{taken:0,passed:0,perfect:0,fast:0,best:0},game:{best:0,total:0},marathon:0,badges:{},sound:true,total:{a:0,c:0},bestCombo:0,updatedAt:0};}
function normalize(o){
  const d=defaults(); if(!o||typeof o!=='object') return d;
  const r=Object.assign(d,o);
  r.today=Object.assign(defaults().today,o.today||{});
  r.exams=Object.assign(defaults().exams,o.exams||{});
  r.game=Object.assign(defaults().game,o.game||{});
  r.total=Object.assign(defaults().total,o.total||{});
  r.q=Object.assign({},o.q||{}); r.badges=Object.assign({},o.badges||{});
  r.fav=Array.isArray(o.fav)?o.fav.filter(id=>QMAP[id]):[];
  return r;
}
let S=defaults();
try{const raw=localStorage.getItem(LS_KEY); if(raw) S=normalize(JSON.parse(raw));}catch(e){}

const userName=TG.firstName;
const secOf=id=>QMAP[id]&&QMAP[id].s;
let saveTimer=null, saving=false, dirty=false, cloudLast=null, cloudFails=0;
function save(){
  S.updatedAt=Date.now();
  try{localStorage.setItem(LS_KEY,JSON.stringify(S));}catch(e){}
  dirty=true; clearTimeout(saveTimer); saveTimer=setTimeout(flush,1500);
}
// пише в CloudStorage лише ключі, що змінились; zh_meta — останнім
async function flush(){
  if(!TG.cloud||!cloudLast||saving||!dirty) return;
  saving=true; dirty=false;
  const packed=csPack(S,secOf);
  try{
    for(const k of Object.keys(packed)){ if(k!==CS_META&&packed[k]!==cloudLast[k]){ await TG.cloud.setItem(k,packed[k]); cloudLast[k]=packed[k]; } }
    if(packed[CS_META]!==cloudLast[CS_META]){ await TG.cloud.setItem(CS_META,packed[CS_META]); cloudLast[CS_META]=packed[CS_META]; }
    const gone=Object.keys(cloudLast).filter(k=>!(k in packed));
    if(gone.length){ await TG.cloud.removeItems(gone); gone.forEach(k=>delete cloudLast[k]); }
    cloudFails=0;
  }catch(e){ dirty=true; cloudFails++; }
  saving=false;
  if(dirty){ clearTimeout(saveTimer); saveTimer=setTimeout(flush,cloudFails?Math.min(60000,3000*cloudFails):1500); }
}
// читає прогрес з CloudStorage і зливає з локальним за updatedAt
async function initCloud(){
  if(!TG.cloud) return;
  let remote=null; const got={};
  try{
    const meta=await TG.cloud.getItem(CS_META);
    if(meta){
      const keys=JSON.parse(meta).keys||[];
      Object.assign(got,keys.length?await TG.cloud.getItems(keys):{}); got[CS_META]=meta;
      try{ remote=normalize(csUnpack(k=>got[k])); }catch(e){ remote=null; }
    }
  }catch(e){ setTimeout(initCloud,10000); return; } // хмара недоступна — пробуємо пізніше, локальне не затираємо
  cloudLast={}; Object.keys(got).forEach(k=>{ if(got[k]) cloudLast[k]=got[k]; });
  if(remote&&(remote.updatedAt||0)>(S.updatedAt||0)){
    S=remote; try{localStorage.setItem(LS_KEY,JSON.stringify(S));}catch(e){}
    if(view==='home'||view==='topics'||view==='ach') render();
  } else if(!remote||(S.updatedAt||0)>(remote.updatedAt||0)) dirty=true;
  flush();
}
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden') flush(); });

// раз на день після першої відповіді повідомляє боту про активність (для нагадувань)
let pinging=false;
function pingActivity(){
  if(!TG.inTg||pinging) return;
  const t=todayStr(); try{ if(localStorage.getItem('zh-ping')===t) return; }catch(e){}
  pinging=true;
  fetch('api/activity',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,
    body:JSON.stringify({initData:TG.initData,streak:displayStreak(),day:t})})
    .then(r=>{ if(r.ok) try{localStorage.setItem('zh-ping',t);}catch(e){} })
    .catch(()=>{}).finally(()=>{ pinging=false; });
}

/* ---------- утиліти ---------- */
const reduced=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function pick(a){return a[Math.floor(Math.random()*a.length)];}
function dstr(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function todayStr(){return dstr(new Date());}
function yesterdayStr(){const d=new Date();d.setDate(d.getDate()-1);return dstr(d);}
function plural(n,a,b,c){const m10=n%10,m100=n%100;if(m10===1&&m100!==11)return a;if(m10>=2&&m10<=4&&(m100<12||m100>14))return b;return c;}
function fmt(sec){sec=Math.max(0,sec);return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');}
function fmtMin(sec){const m=Math.floor(sec/60),s=sec%60;return m?`${m} хв ${s} с`:`${s} с`;}
function readiness(list){list=list||QB;if(!list.length)return 0;let t=0;list.forEach(x=>{const st=S.q[x.id];t+=st?Math.min(st.s,2):0;});return t/(2*list.length);}
function mistakesList(){return QB.filter(x=>{const st=S.q[x.id];return st&&st.w>0&&st.s<2;});}
function displayStreak(){return (S.last===todayStr()||S.last===yesterdayStr())?S.streak:0;}
function todayCount(){return S.today.d===todayStr()?S.today.n:0;}
const LEVELS=[[0,'Пішохід'],[100,'Велосипедист'],[250,'Учень автошколи'],[500,'Новачок за кермом'],[900,'Водій'],[1400,'Впевнений водій'],[2000,'Ас дороги'],[3000,'Інструктор']];
function level(){let i=0;LEVELS.forEach((l,k)=>{if(S.xp>=l[0])i=k;});const next=LEVELS[i+1];return {n:i+1,name:LEVELS[i][1],next:next?next[0]:null};}
function hello(){const h=new Date().getHours();const g=h<5?'Доброї ночі':h<12?'Доброго ранку':h<18?'Добрий день':h<23?'Добрий вечір':'Доброї ночі';return userName?`${g}, ${esc(userName)}!`:`${g}!`;}

/* ---------- звук ---------- */
let AC=null;
function sfx(kind){
  if(!S.sound) return;
  try{
    AC=AC||new (window.AudioContext||window.webkitAudioContext)();
    const seq={ok:[[660,0,.09],[880,.08,.13]],bad:[[200,0,.16],[160,.12,.2]],win:[[523,0,.11],[659,.1,.11],[784,.2,.11],[1047,.3,.3]],badge:[[784,0,.08],[988,.08,.08],[1319,.16,.22]]}[kind];
    const t=AC.currentTime;
    seq.forEach(([f,d,len])=>{const o=AC.createOscillator(),g=AC.createGain();o.type=kind==='bad'?'square':'triangle';o.frequency.value=f;g.gain.setValueAtTime(0.0001,t+d);g.gain.exponentialRampToValueAtTime(kind==='bad'?0.05:0.13,t+d+0.012);g.gain.exponentialRampToValueAtTime(0.0001,t+d+len);o.connect(g);g.connect(AC.destination);o.start(t+d);o.stop(t+d+len+0.03);});
  }catch(e){}
}
// вібрація: у Telegram — HapticFeedback (navigator.vibrate на iPhone не працює), поза ним — як було
function buzz(){ if(TG.haptic('error')) return; try{navigator.vibrate&&navigator.vibrate(70);}catch(e){} }

/* ---------- іконки ---------- */
const ICON={
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chev:'<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  star:'<svg viewBox="0 0 24 24"><path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 16.6l-5.3 2.9 1.1-5.9L3.4 9.5l6-.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  soundOn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/></svg>',
  soundOff:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  heart:'<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.4.7-1.2 2.2-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z"/></svg>'
};
function logoSvg(){return '<svg width="22" height="36" viewBox="0 0 22 36" aria-hidden="true"><rect x="1" y="1" width="20" height="34" rx="6" fill="#23272D" stroke="#6B737D" stroke-width="1"/><circle cx="11" cy="9" r="4" fill="#5B2626"/><circle cx="11" cy="18" r="4" fill="#5A4A1C"/><circle cx="11" cy="27" r="4.6" fill="#2BD46F"/></svg>';}
function signIcon(ic){
  const k=ic[0],g=ic[1]||'';const W='class="ico" viewBox="0 0 40 40" aria-hidden="true"';
  const F='font-family="Fira Sans Extra Condensed,Fira Sans,sans-serif" font-weight="800" text-anchor="middle"';
  switch(k){
    case 'sq':return `<svg ${W}><rect x="2" y="2" width="36" height="36" rx="7" fill="#1D5DBF"/><rect x="5" y="5" width="30" height="30" rx="4.5" fill="none" stroke="#fff" stroke-width="1.6"/><text x="20" y="26.5" ${F} font-size="18" fill="#fff">${g}</text></svg>`;
    case 'tri':return `<svg ${W}><path d="M20 4.5L37 34.5H3z" fill="#fff" stroke="#D7262E" stroke-width="3.6" stroke-linejoin="round"/><text x="20" y="31" ${F} font-size="16" fill="#1D2128">${g}</text></svg>`;
    case 'circ':return `<svg ${W}><circle cx="20" cy="20" r="16.5" fill="#fff" stroke="#D7262E" stroke-width="4"/><text x="20" y="25.5" ${F} font-size="15" fill="#1D2128">${g}</text></svg>`;
    case 'blue':return `<svg ${W}><circle cx="20" cy="20" r="18" fill="#1D5DBF"/><text x="20" y="26.5" ${F} font-size="18" fill="#fff">${g}</text></svg>`;
    case 'nostop':return `<svg ${W}><circle cx="20" cy="20" r="16.5" fill="#1D5DBF" stroke="#D7262E" stroke-width="4"/><path d="M10 10l20 20M30 10L10 30" stroke="#D7262E" stroke-width="3.6"/></svg>`;
    case 'dia':return `<svg ${W}><path d="M20 2L38 20 20 38 2 20z" fill="#fff" stroke="#2A2A2A" stroke-width="1.2"/><path d="M20 9l11 11-11 11L9 20z" fill="#F2B705"/></svg>`;
    case 'mark':return `<svg ${W}><rect x="2" y="2" width="36" height="36" rx="7" fill="#454A52"/><path d="M12 4v32" stroke="#F5F5F0" stroke-width="2.6"/><path d="M26 6v6M26 17v6M26 28v6" stroke="#F5F5F0" stroke-width="2.6"/></svg>`;
    case 'light':return `<svg ${W}><rect x="11" y="2" width="18" height="36" rx="6" fill="#23272D"/><circle cx="20" cy="10" r="4" fill="#5B2626"/><circle cx="20" cy="20" r="4" fill="#5A4A1C"/><circle cx="20" cy="30" r="4.4" fill="#2BD46F"/></svg>`;
    case 'aid':return `<svg ${W}><rect x="2" y="2" width="36" height="36" rx="7" fill="#1D5DBF"/><rect x="8" y="8" width="24" height="24" rx="2" fill="#fff"/><path d="M17 12h6v5h5v6h-5v5h-6v-5h-5v-6h5z" fill="#D7262E"/></svg>`;
    case 'ped':return `<svg ${W}><rect x="2" y="2" width="36" height="36" rx="7" fill="#1D5DBF"/><path d="M20 6L35 33H5z" fill="#fff"/><circle cx="21" cy="15" r="2.4" fill="#1D2128"/><path d="M20.5 18l-2.5 6 3 2-1.5 5M20.5 18l2 5.5 3 1M18 24l-3 3" stroke="#1D2128" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'game':return `<svg ${W}><rect x="2" y="2" width="36" height="36" rx="7" fill="#454A52"/><path d="M20 2v36M2 20h36" stroke="#F5F5F0" stroke-width="1.6" stroke-dasharray="3 3"/><rect x="22" y="23" width="7" height="11" rx="2" fill="#2F6FE4"/><rect x="5" y="10" width="11" height="7" rx="2" fill="#E8590C"/></svg>`;
    case 'cup':return `<svg ${W}><rect x="2" y="2" width="36" height="36" rx="7" fill="#F2B705"/><path d="M13 10h14v6a7 7 0 01-14 0zM13 12H9a4 4 0 004 5M27 12h4a4 4 0 01-4 5M20 23v5M15 31h10" stroke="#2B2100" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'route':return `<svg ${W}><rect x="2" y="2" width="36" height="36" rx="7" fill="#137A47"/><rect x="5" y="5" width="30" height="30" rx="4.5" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M20 30V18m0 0l-6-6m6 6l6-6M14 12v4M14 12h4M26 12v4M26 12h-4" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'redo':return `<svg ${W}><circle cx="20" cy="20" r="18" fill="#C23131"/><path d="M27 15a8 8 0 10.8 8" stroke="#fff" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M28 9v6h-6" stroke="#fff" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'fav':return `<svg ${W}><circle cx="20" cy="20" r="18" fill="#F2B705"/><path d="M20 9.5l3 6.3 6.9.9-5 4.7 1.3 6.8L20 25l-6.2 3.2 1.3-6.8-5-4.7 6.9-.9z" fill="#fff"/></svg>`;
    case 'bolt':return `<svg ${W}><circle cx="20" cy="20" r="18" fill="#1D5DBF"/><path d="M22 7l-9 15h6l-2 11 9-15h-6z" fill="#fff"/></svg>`;
    case 'motorway':return `<svg ${W}><rect x="2" y="2" width="36" height="36" rx="7" fill="#137A47"/><rect x="5" y="5" width="30" height="30" rx="4.5" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M13 32l4-18M27 32l-4-18M9 19h22" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>`;
    case 'truck':return `<svg ${W}><rect x="2" y="2" width="36" height="36" rx="7" fill="#1D5DBF"/><rect x="7" y="13" width="17" height="12" rx="1.5" fill="#fff"/><path d="M25 17h5l3.5 4.5V25H25z" fill="#fff"/><circle cx="12" cy="28" r="3" fill="#fff" stroke="#1D5DBF" stroke-width="1.4"/><circle cx="29" cy="28" r="3" fill="#fff" stroke="#1D5DBF" stroke-width="1.4"/></svg>`;
    case 'tire':return `<svg ${W}><rect x="2" y="2" width="36" height="36" rx="7" fill="#454A52"/><circle cx="20" cy="20" r="11.5" fill="none" stroke="#fff" stroke-width="5"/><circle cx="20" cy="20" r="3.2" fill="#fff"/><path d="M20 4.5v4M20 31.5v4M4.5 20h4M31.5 20h4" stroke="#454A52" stroke-width="2.4"/></svg>`;
    case 'bike':return `<svg ${W}><circle cx="20" cy="20" r="18" fill="#1D5DBF"/><g fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="24" r="5"/><circle cx="28" cy="24" r="5"/><path d="M12 24l5-9h8l3 9M17 15l3 9h-8M21 12h4"/></g></svg>`;
  }
  return '';
}
function signSvg(k){
  const W='width="128" height="128" viewBox="0 0 100 100" role="img"';
  const R='#D7262E',B='#1D5DBF',Y='#F2B705',K='#1D2128';
  // заготовки: заборонний круг, наказовий круг, попереджувальний трикутник, інформаційний квадрат
  const PRO=(lbl,inner)=>`<svg ${W} aria-label="Знак: ${lbl}"><circle cx="50" cy="50" r="42" fill="#fff" stroke="${R}" stroke-width="10"/>${inner}</svg>`;
  const MAN=(lbl,inner)=>`<svg ${W} aria-label="Знак: ${lbl}"><circle cx="50" cy="50" r="46" fill="${B}"/><g fill="none" stroke="#fff" stroke-width="10" stroke-linejoin="round">${inner}</g></svg>`;
  const TRI=(lbl,inner)=>`<svg ${W} aria-label="Знак: ${lbl}"><path d="M50 9L93 85H7Z" fill="#fff" stroke="${R}" stroke-width="8" stroke-linejoin="round"/>${inner}</svg>`;
  const INF=(lbl,inner)=>`<svg ${W} aria-label="Знак: ${lbl}"><rect x="8" y="8" width="84" height="84" rx="8" fill="${B}"/><rect x="12" y="12" width="76" height="76" rx="5" fill="none" stroke="#fff" stroke-width="2"/>${inner}</svg>`;
  const END=(lbl,id,inner)=>`<svg ${W} aria-label="Знак: ${lbl}"><defs><clipPath id="${id}"><circle cx="50" cy="50" r="45"/></clipPath></defs><circle cx="50" cy="50" r="46" fill="#fff" stroke="#2A2A2A" stroke-width="1.5"/>${inner}<g clip-path="url(#${id})" stroke="#2A2A2A" stroke-width="2.4">${[-14,-7,0,7,14].map(o=>`<line x1="${50+o+45}" y1="${50+o-45}" x2="${50+o-45}" y2="${50+o+45}"/>`).join('')}</g></svg>`;
  const SLASH=`<path d="M21 21L79 79" stroke="${R}" stroke-width="9"/>`;
  const HEAD={u:(x,y)=>`${x},${y} ${x+13},${y+16} ${x-13},${y+16}`,d:(x,y)=>`${x},${y} ${x-13},${y-16} ${x+13},${y-16}`,r:(x,y)=>`${x},${y} ${x-16},${y-13} ${x-16},${y+13}`,l:(x,y)=>`${x},${y} ${x+16},${y-13} ${x+16},${y+13}`,dr:(x,y)=>`${x},${y} ${x-2.1},${y-20.5} ${x-20.5},${y-2.1}`,dl:(x,y)=>`${x},${y} ${x+2.1},${y-20.5} ${x+20.5},${y-2.1}`};
  const head=(dir,x,y,c)=>`<polygon points="${HEAD[dir](x,y)}" fill="${c}" stroke="none"/>`;
  const num=(n,c)=>`<text x="50" y="${n>=100?61:63}" text-anchor="middle" font-family="Fira Sans,sans-serif" font-weight="700" font-size="${n>=100?30:n<10?44:38}" fill="${c}">${n}</text>`;
  const car=(cx,c)=>`<g fill="${c}"><path d="M${cx-11} 52L${cx-8} 41H${cx+8}L${cx+11} 52Z"/><rect x="${cx-13}" y="51" width="26" height="12" rx="3"/><rect x="${cx-11}" y="62" width="6" height="6" rx="1.5"/><rect x="${cx+5}" y="62" width="6" height="6" rx="1.5"/></g>`;
  const cross=`<g fill="#fff" stroke="${R}" stroke-width="6"><rect x="42" y="2" width="16" height="96" transform="rotate(40 50 50)"/><rect x="42" y="2" width="16" height="96" transform="rotate(-40 50 50)"/></g><g fill="#fff"><rect x="42" y="2" width="16" height="96" transform="rotate(40 50 50)"/><rect x="42" y="2" width="16" height="96" transform="rotate(-40 50 50)"/></g>`;
  let m=/^(end)?speed(\d+)$/.exec(k);
  if(m) return m[1]
    ? END(`біле коло з сірим числом ${m[2]}, перекреслене чорними лініями`,'cl-es',num(+m[2],'#8A8F96'))
    : PRO(`біле коло з червоною облямівкою і числом ${m[2]}`,num(+m[2],K));
  switch(k){
    case 'endall':return END('біле коло, перекреслене чорними діагональними лініями','cl-ea','');
    case 'noovertake':return PRO('біле коло з червоною облямівкою, червоне і чорне авто поруч',car(37,R)+car(63,K));
    case 'endnoovertake':return END('біле коло з сірими авто, перекреслене чорними лініями','cl-eo',car(37,'#8A8F96')+car(63,'#8A8F96'));
    case 'noright':return PRO('біле коло з червоною облямівкою, чорна стрілка праворуч, перекреслена червоною смугою',`<path d="M42 80V52Q42 40 54 40H58" fill="none" stroke="${K}" stroke-width="9"/>${head('r',74,40,K)}${SLASH}`);
    case 'noleft':return PRO('біле коло з червоною облямівкою, чорна стрілка ліворуч, перекреслена червоною смугою',`<path d="M58 80V52Q58 40 46 40H42" fill="none" stroke="${K}" stroke-width="9"/>${head('l',26,40,K)}${SLASH}`);
    case 'nouturn':return PRO('біле коло з червоною облямівкою, чорна стрілка розвороту, перекреслена червоною смугою',`<path d="M60 80V46A13 13 0 0 0 34 46V58" fill="none" stroke="${K}" stroke-width="9"/>${head('d',34,74,K)}${SLASH}`);
    case 'right':return MAN('синє коло з білою стрілкою, що повертає праворуч',`<path d="M42 84V54Q42 40 56 40H62"/>${head('r',78,40,'#fff')}`);
    case 'left':return MAN('синє коло з білою стрілкою, що повертає ліворуч',`<path d="M58 84V54Q58 40 44 40H38"/>${head('l',22,40,'#fff')}`);
    case 'straightright':return MAN('синє коло з білими стрілками прямо і праворуч',`<path d="M44 84V34M44 68Q44 54 58 54H62"/>${head('u',44,18,'#fff')}${head('r',78,54,'#fff')}`);
    case 'straightleft':return MAN('синє коло з білими стрілками прямо і ліворуч',`<path d="M56 84V34M56 68Q56 54 42 54H38"/>${head('u',56,18,'#fff')}${head('l',22,54,'#fff')}`);
    case 'rightleft':return MAN('синє коло з білими стрілками праворуч і ліворуч',`<path d="M50 84V60Q50 46 62 46H64M50 60Q50 46 38 46H36"/>${head('r',80,46,'#fff')}${head('l',20,46,'#fff')}`);
    case 'keepright':return MAN('синє коло з білою стрілкою навскіс униз праворуч',`<path d="M30 30L61 61"/>${head('dr',72,72,'#fff')}`);
    case 'keepleft':return MAN('синє коло з білою стрілкою навскіс униз ліворуч',`<path d="M70 30L39 61"/>${head('dl',28,72,'#fff')}`);
    case 'oneway':return INF('синій квадрат з білою стрілкою вгору','<path d="M50 20L68 42H57V82H43V42H32Z" fill="#fff"/>');
    case 'endoneway':return INF('синій квадрат з білою стрілкою вгору, перекреслений червоною смугою',`<path d="M50 20L68 42H57V82H43V42H32Z" fill="#fff"/><path d="M82 18L18 82" stroke="${R}" stroke-width="7"/>`);
    case 'parking':return INF('синій квадрат з білою літерою P','<text x="50" y="72" text-anchor="middle" font-family="Fira Sans,sans-serif" font-weight="700" font-size="62" fill="#fff">P</text>');
    case 'danger':return TRI('трикутник з червоною облямівкою і знаком оклику',`<rect x="45.5" y="36" width="9" height="28" rx="2" fill="${K}"/><circle cx="50" cy="73" r="5" fill="${K}"/>`);
    case 'crossroads':return TRI('трикутник з червоною облямівкою і чорним косим хрестом',`<path d="M37 45L63 77M63 45L37 77" stroke="${K}" stroke-width="7"/>`);
    case 'trafficlight':return TRI('трикутник з червоною облямівкою і світлофором',`<rect x="41" y="34" width="18" height="45" rx="5" fill="${K}"/><circle cx="50" cy="43" r="4.6" fill="#E0303A"/><circle cx="50" cy="56.5" r="4.6" fill="${Y}"/><circle cx="50" cy="70" r="4.6" fill="#2BD46F"/>`);
    case 'rail1':return `<svg ${W} aria-label="Знак: білий косий хрест з червоною облямівкою">${cross}</svg>`;
    case 'railmulti':return `<svg ${W} aria-label="Знак: білий косий хрест з червоною облямівкою і додатковою галочкою знизу"><g transform="translate(11 0) scale(.78)">${cross}</g><path d="M33 97L50 82L67 97" fill="none" stroke="${R}" stroke-width="13" stroke-linejoin="miter"/><path d="M33 97L50 82L67 97" fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="miter"/></svg>`;
    case 'giveway':return `<svg ${W} aria-label="Знак: трикутник вершиною вниз з червоною облямівкою"><polygon points="50,90 7,15 93,15" fill="#fff" stroke="${R}" stroke-width="9" stroke-linejoin="round"/></svg>`;
    case 'stop':return `<svg ${W} aria-label="Знак: червоний восьмикутник з написом STOP"><polygon points="32.4,4 67.6,4 96,32.4 96,67.6 67.6,96 32.4,96 4,67.6 4,32.4" fill="${R}" stroke="#fff" stroke-width="3"/><polygon points="34,9 66,9 91,34 91,66 66,91 34,91 9,66 9,34" fill="none" stroke="#fff" stroke-width="2"/><text x="50" y="59" text-anchor="middle" font-family="Fira Sans,sans-serif" font-weight="700" font-size="25" fill="#fff">STOP</text></svg>`;
    case 'main':return `<svg ${W} aria-label="Знак: жовтий ромб у білій рамці"><polygon points="50,3 97,50 50,97 3,50" fill="#fff" stroke="#2A2A2A" stroke-width="1.5"/><polygon points="50,19 81,50 50,81 19,50" fill="${Y}" stroke="#2A2A2A" stroke-width="1.2"/></svg>`;
    case 'endmain':return `<svg ${W} aria-label="Знак: жовтий ромб, перекреслений чорними смугами"><defs><clipPath id="dclip"><polygon points="50,3 97,50 50,97 3,50"/></clipPath></defs><polygon points="50,3 97,50 50,97 3,50" fill="#fff" stroke="#2A2A2A" stroke-width="1.5"/><polygon points="50,19 81,50 50,81 19,50" fill="${Y}" stroke="#2A2A2A" stroke-width="1.2"/><g clip-path="url(#dclip)" stroke="#2A2A2A" stroke-width="2.4">${[-14,-7,0,7,14].map(o=>`<line x1="${50+o+45}" y1="${50+o-45}" x2="${50+o-45}" y2="${50+o+45}"/>`).join('')}</g></svg>`;
    case 'noentry':return `<svg ${W} aria-label="Знак: червоне коло з білою горизонтальною смугою"><circle cx="50" cy="50" r="46" fill="${R}" stroke="#fff" stroke-width="2"/><rect x="17" y="41" width="66" height="18" fill="#fff"/></svg>`;
    case 'notraffic':return `<svg ${W} aria-label="Знак: біле коло з червоною облямівкою"><circle cx="50" cy="50" r="42" fill="#fff" stroke="${R}" stroke-width="10"/></svg>`;
    case 'speed40':return `<svg ${W} aria-label="Знак: біле коло з червоною облямівкою і числом 40"><circle cx="50" cy="50" r="42" fill="#fff" stroke="${R}" stroke-width="10"/><text x="50" y="63" text-anchor="middle" font-family="Fira Sans,sans-serif" font-weight="700" font-size="38" fill="#1D2128">40</text></svg>`;
    case 'nostopping':return `<svg ${W} aria-label="Знак: синє коло з червоною облямівкою, перехрещене двома червоними смугами"><circle cx="50" cy="50" r="42" fill="${B}" stroke="${R}" stroke-width="10"/><path d="M24 24L76 76M76 24L24 76" stroke="${R}" stroke-width="9"/></svg>`;
    case 'noparking':return `<svg ${W} aria-label="Знак: синє коло з червоною облямівкою і однією червоною смугою"><circle cx="50" cy="50" r="42" fill="${B}" stroke="${R}" stroke-width="10"/><path d="M24 24L76 76" stroke="${R}" stroke-width="9"/></svg>`;
    case 'straight':return `<svg ${W} aria-label="Знак: синє коло з білою стрілкою вгору"><circle cx="50" cy="50" r="46" fill="${B}"/><path d="M50 18L71 43H58V82H42V43H29Z" fill="#fff"/></svg>`;
  }
  return '';
}
function roadBar(pct){
  const p=Math.max(0,Math.min(100,pct));
  return `<div class="road" role="img" aria-label="Пройдено ${p}% шляху до прав"><span class="trail" style="width:calc(16px + (100% - 52px) * ${p/100})"></span><span class="car" style="left:calc(16px + (100% - 52px) * ${p/100})"><svg width="32" height="20" viewBox="0 0 32 20" aria-hidden="true"><rect x="1" y="3" width="30" height="14" rx="5" fill="#F2B705"/><rect x="18" y="5" width="7" height="10" rx="2" fill="#2D3137"/><rect x="4" y="6" width="4" height="8" rx="1.5" fill="#2D3137"/><circle cx="30" cy="5.5" r="1.5" fill="#fff"/><circle cx="30" cy="14.5" r="1.5" fill="#fff"/></svg></span><span class="finish"></span></div>`;
}

/* ---------- досягнення ---------- */
const BADGES=[
 {id:'first',e:'🚦',t:'Перший рух',d:'Дати першу відповідь',ok:()=>S.total.a>=1},
 {id:'a100',e:'💯',t:'Сотня',d:'100 відповідей',ok:()=>S.total.a>=100},
 {id:'a500',e:'🛣️',t:'Довга траса',d:'500 відповідей',ok:()=>S.total.a>=500},
 {id:'combo10',e:'🟢',t:'Зелена хвиля',d:'10 правильних поспіль',ok:()=>S.bestCombo>=10},
 {id:'streak3',e:'🔥',t:'Три дні поспіль',d:'Займатися 3 дні без перерви',ok:()=>S.streak>=3},
 {id:'streak7',e:'📅',t:'Тиждень за кермом',d:'7 днів поспіль',ok:()=>S.streak>=7},
 {id:'exam1',e:'🎓',t:'Іспит складено',d:'Скласти пробний іспит',ok:()=>S.exams.passed>=1},
 {id:'exam5',e:'🏁',t:'П’ять іспитів',d:'Скласти іспит 5 разів',ok:()=>S.exams.passed>=5},
 {id:'perfect',e:'⭐',t:'Без жодної помилки',d:'Іспит 20 з 20',ok:()=>S.exams.perfect>=1},
 {id:'fast',e:'⏱️',t:'Швидкий старт',d:'Скласти іспит менш ніж за 10 хвилин',ok:()=>S.exams.fast>=1},
 {id:'cross10',e:'🚗',t:'Регулювальник',d:'10 перехресть за одну гру',ok:()=>S.game.best>=10},
 {id:'ready',e:'🪪',t:'Права в кишені',d:'Готовність 100%',ok:()=>readiness()>=1}
];
function checkBadges(){
  const fresh=[];
  BADGES.forEach(b=>{ if(!S.badges[b.id]&&b.ok()){ S.badges[b.id]=todayStr(); fresh.push(b);} });
  if(fresh.length){ save(); fresh.forEach((b,i)=>setTimeout(()=>{sfx('badge');toast(`${b.e} Нове досягнення: ${b.t}`);},400+i*1400)); }
}

/* ---------- облік відповідей ---------- */
function recordAnswer(id,ok){
  const st=S.q[id]||(S.q[id]={c:0,w:0,s:0});
  if(ok){st.c++;st.s++;}else{st.w++;st.s=0;}
  S.total.a++; if(ok) S.total.c++;
  const t=todayStr();
  if(S.today.d!==t) S.today={d:t,n:0};
  S.today.n++;
  if(S.last!==t){ S.streak=(S.last===yesterdayStr())?S.streak+1:1; S.last=t; }
}

/* ---------- навігація ---------- */
const app=document.getElementById('app');
let view='home', Z=null, LAST=null, G=null;
function go(v){ if(Z&&Z.timer&&v!=='quiz'){clearInterval(Z.timer);} if(v!=='quiz') Z=null; if(v!=='game'&&G){G.alive=false;G=null;} view=v; render(); window.scrollTo(0,0); }
function render(){
  const V={home:vHome,examIntro:vExamIntro,topics:vTopics,quiz:vQuiz,result:vResult,ach:vAch,game:vGame}[view]||vHome;
  app.innerHTML=V();
  if(view==='game') afterGameRender();
  syncTg();
}
// кнопка «назад», підтвердження закриття і свайпи Telegram відповідно до екрана
function syncTg(){
  TG.back(view==='home'?null:tgBack);
  TG.closingConfirm(view==='quiz'&&!!Z&&Z.mode==='exam');
  TG.verticalSwipes(view!=='game');
}
function tgBack(){
  const sheet=document.querySelector('.backdrop'); if(sheet){ sheet.remove(); return; } // як «Скасувати»
  if(view==='quiz') ACT.quitQuiz(); else go('home');
}

/* ---------- головна ---------- */
function vHome(){
  const pct=Math.round(readiness()*100), lv=level(), st=displayStreak(), tn=todayCount(), goal=20;
  const mis=mistakesList().length, fav=S.fav.length, got=Object.keys(S.badges).length;
  const mar=Math.min(S.marathon,QB.length);
  const streakTxt=st?`🔥 ${st} ${plural(st,'день','дні','днів')} поспіль`:'🔥 Почни серію сьогодні';
  const nextTxt=lv.next?`${S.xp} / ${lv.next} XP`:`${S.xp} XP`;
  return `
  <header class="topbar">
    <div class="brand">${logoSvg()}<span>Зелена хвиля</span></div>
    <button class="iconbtn" data-act="sound" aria-label="${S.sound?'Вимкнути звук':'Увімкнути звук'}">${S.sound?ICON.soundOn:ICON.soundOff}</button>
  </header>
  <section class="sign-panel"><div class="inner">
    <p class="hello">${hello()}</p>
    <div class="ready"><span class="big">${pct}%</span><span class="lbl">готовність до іспиту</span></div>
    ${roadBar(pct)}
    <div class="chips"><span class="chip">${streakTxt}</span><span class="chip">${lv.name}</span><span class="chip">${nextTxt}</span></div>
  </div></section>
  <div class="goal"><div class="goal-top"><span>${tn>=goal?'Ціль на сьогодні виконано':'Ціль на сьогодні'}</span><b>${Math.min(tn,goal)} з ${goal} питань</b></div><div class="bar"><i style="width:${Math.min(100,tn/goal*100)}%"></i></div></div>
  <div class="stack">
    <button class="tile exam" data-act="examIntro"><span class="wrap">${signIcon(['bolt'])}<span class="tx"><span class="t">Пробний іспит</span><span class="d">20 питань, 20 хвилин, не більше 2 помилок</span></span>${ICON.chev}</span></button>
    <button class="tile" data-act="train">${signIcon(['route'])}<span class="tx"><span class="t">Тренування</span><span class="d">10 питань, спершу ті, що даються важче</span></span>${ICON.chev}</button>
    <div class="grid2">
      <button class="tile col" data-act="topics">${signIcon(['sq','і'])}<span><span class="t">Розділи</span><span class="d">${SEC_LIST.length} тем</span></span></button>
      <button class="tile col" data-act="marathon">${signIcon(['blue','∞'])}<span><span class="t">Марафон</span><span class="d">${mar?`${mar} з ${QB.length}, продовжити`:`Усі ${QB.length} питань`}</span></span></button>
      <button class="tile col" data-act="mistakes">${signIcon(['redo'])}<span><span class="t">Помилки</span><span class="d">${mis?`${mis} ${plural(mis,'питання','питання','питань')} на розбір`:'Поки чисто'}</span></span></button>
      <button class="tile col" data-act="favs">${signIcon(['fav'])}<span><span class="t">Обране</span><span class="d">${fav?`${fav} ${plural(fav,'питання','питання','питань')}`:'Познач зірочкою'}</span></span></button>
    </div>
    <button class="tile" data-act="game">${signIcon(['game'])}<span class="tx"><span class="t">Хто проїде першим?</span><span class="d">Гра на перехрестях${S.game.best?`. Рекорд: ${S.game.best}`:''}</span></span>${ICON.chev}</button>
    <button class="tile" data-act="ach">${signIcon(['cup'])}<span class="tx"><span class="t">Досягнення і статистика</span><span class="d">Відкрито ${got} з ${BADGES.length}</span></span>${ICON.chev}</button>
  </div>
  <p class="note">Питання складені за чинними ПДР України (Постанова КМУ №1306). Це не офіційна база ГСЦ МВС, тож перед іспитом пройдись і офіційними тестами.</p>`;
}

/* ---------- іспит: вступ ---------- */
function vExamIntro(){
  return `<div class="qtop"><button class="iconbtn" data-act="home" aria-label="На головну">${ICON.back}</button><div class="gtitle">Пробний іспит</div></div>
  <div class="rules">
    <div class="rule"><span class="num">20</span><span><b>20 питань</b><span>з усіх розділів, у випадковому порядку</span></span></div>
    <div class="rule"><span class="num">20′</span><span><b>20 хвилин</b><span>таймер іде з першого питання</span></span></div>
    <div class="rule"><span class="num">2</span><span><b>Не більше 2 помилок</b><span>третя завершує іспит</span></span></div>
  </div>
  ${S.exams.taken?`<p class="note" style="margin-top:0">Складено ${S.exams.passed} з ${S.exams.taken}. Найкращий результат: ${S.exams.best} з 20.</p>`:''}
  <button class="btn" data-act="startExam">Почати іспит</button>`;
}

/* ---------- розділи ---------- */
function vTopics(){
  const rows=SEC_LIST.map(s=>{const list=BYSEC[s.id]||[];const p=Math.round(readiness(list)*100);
    return `<button class="row" data-act="topic" data-arg="${s.id}">${signIcon(s.ic)}<span class="rt"><b>${esc(s.t)}</b><small>${list.length} ${plural(list.length,'питання','питання','питань')}</small><span class="bar"><i style="width:${p}%"></i></span></span><span class="pct">${p}%</span></button>`;}).join('');
  return `<div class="qtop"><button class="iconbtn" data-act="home" aria-label="На головну">${ICON.back}</button><div class="gtitle">Розділи</div></div><div class="rows">${rows}</div>`;
}

/* ---------- квіз ---------- */
const MODE_T={exam:'Іспит',marathon:'Марафон',mistakes:'Робота над помилками',favs:'Обране',train:'Тренування'};
function modeTitleOf(m,sec){return m==='topic'?(SEC[sec]?SEC[sec].sh:'Розділ'):MODE_T[m]||'';}
function startQuiz(mode,list,opts){
  opts=opts||{};
  if(!list.length){ toast(mode==='mistakes'?'Тут з’являться питання, в яких була помилка.':mode==='favs'?'Познач питання зірочкою, і воно з’явиться тут.':'Немає питань.'); return; }
  if(Z&&Z.timer) clearInterval(Z.timer);
  Z={mode,list,i:opts.startAt||0,picked:null,order:null,combo:0,correct:0,mistakes:0,wrong:[],start:Date.now(),limit:mode==='exam'?20*60:0,xp:0,sec:opts.sec||null,timer:null};
  view='quiz'; render(); window.scrollTo(0,0);
  if(mode==='exam') Z.timer=setInterval(tickExam,1000);
}
function remaining(){return Z?Math.max(0,Z.limit-Math.floor((Date.now()-Z.start)/1000)):0;}
function tickExam(){
  if(!Z||Z.mode!=='exam'){return;}
  const r=remaining(); const el=document.getElementById('timer');
  if(el){el.textContent=fmt(r); el.classList.toggle('low',r<=120);}
  if(r<=0) finishQuiz('time');
}
function vQuiz(){
  const qq=Z.list[Z.i]; if(!Z.order) Z.order=shuffle(qq.o.map((_,i)=>i));
  const total=Z.list.length, answered=Z.picked!==null, isFav=S.fav.includes(qq.id);
  let hud='';
  if(Z.mode==='exam'){ const r=remaining(); hud=`<span class="chip-s ${r<=120?'low':''}" id="timer" aria-label="Залишилось часу">${fmt(r)}</span><span class="marks" aria-label="Помилок: ${Z.mistakes} з 2 дозволених">${[0,1].map(i=>`<i class="${i<Z.mistakes?'on':''}"></i>`).join('')}</span>`; }
  else if(Z.combo>=3){ hud=`<span class="chip-s combo" aria-label="Серія правильних відповідей">🔥 ${Z.combo}</span>`; }
  const opts=Z.order.map((oi,k)=>{let cls='opt';if(answered){if(oi===0)cls+=' correct';else if(k===Z.picked)cls+=' wrong';else cls+=' dim';}
    return `<button class="${cls}" data-act="ans" data-arg="${k}" ${answered?'disabled':''}><span class="n">${k+1}</span><span>${esc(qq.o[oi])}</span></button>`;}).join('');
  let fb='';
  if(answered){
    const ok=Z.order[Z.picked]===0, failNow=Z.mode==='exam'&&Z.mistakes>=3;
    const last=Z.i+1>=total;
    const label=failNow?'До результатів':last?'Завершити':'Далі';
    fb=`<div class="feedback ${ok?'ok':'bad'}" role="status"><b>${ok?'Правильно':'Неправильно'}</b>${qq.e?`<p>${esc(qq.e)}</p>`:''}${failNow?'<p class="warnline">Це третя помилка — іспит зупинено.</p>':''}</div><button class="btn" data-act="next" id="nextBtn">${label}</button>`;
  }
  const num=Z.i+1;
  return `<div class="qtop"><button class="iconbtn" data-act="quitQuiz" aria-label="Вийти">${ICON.close}</button>
    <div class="qprog"><div class="qmeta"><span>${esc(modeTitleOf(Z.mode,Z.sec))}</span><span>${num} з ${total}</span></div><div class="bar"><i style="width:${(Z.i+(answered?1:0))/total*100}%"></i></div></div>
    ${hud?`<div class="hud">${hud}</div>`:''}</div>
  <article class="qcard">
    <div class="qcard-top"><span class="tag">${esc(SEC[qq.s].sh)}</span><button class="star ${isFav?'on':''}" data-act="fav" aria-label="${isFav?'Прибрати з обраного':'Додати в обране'}" aria-pressed="${isFav}">${ICON.star}</button></div>
    ${qq.sign?`<div class="signbox">${signSvg(qq.sign)}</div>`:''}
    <h2 class="qtext">${esc(qq.q)}</h2>
    <div class="opts">${opts}</div>
    ${fb}
  </article>`;
}
function answer(k){
  if(!Z||Z.picked!==null) return;
  const qq=Z.list[Z.i]; if(k<0||k>=qq.o.length) return;
  Z.picked=k; const ok=Z.order[k]===0;
  recordAnswer(qq.id,ok);
  if(ok){ Z.combo++; Z.correct++; const gain=10+Math.min(10,(Z.combo-1)*2); S.xp+=gain; Z.xp+=gain; S.bestCombo=Math.max(S.bestCombo,Z.combo); sfx('ok'); TG.haptic('success'); xpFloat('+'+gain+' XP'); }
  else { Z.combo=0; Z.mistakes++; Z.wrong.push({q:qq,picked:qq.o[Z.order[k]]}); sfx('bad'); buzz(); }
  if(Z.mode==='marathon') S.marathon=(Z.i+1>=QB.length)?0:Z.i+1;
  save(); checkBadges(); render(); pingActivity();
  const nb=document.getElementById('nextBtn');
  if(nb){ nb.scrollIntoView({behavior:reduced?'auto':'smooth',block:'nearest'}); }
}
function nextQ(){
  if(!Z) return;
  if(Z.mode==='exam'&&Z.mistakes>=3) return finishQuiz('mistakes');
  if(Z.i+1>=Z.list.length) return finishQuiz('end');
  Z.i++; Z.picked=null; Z.order=null; render(); window.scrollTo(0,0);
}
function finishQuiz(reason){
  if(!Z) return;
  if(Z.timer){clearInterval(Z.timer);Z.timer=null;}
  const answeredN=Z.i+(Z.picked!==null?1:0);
  const R={mode:Z.mode,sec:Z.sec,total:Z.list.length,answered:answeredN,correct:Z.correct,mistakes:Z.mistakes,wrong:Z.wrong,time:Math.round((Date.now()-Z.start)/1000),reason,xp:Z.xp,passed:false};
  if(Z.mode==='exam'){
    R.passed=reason==='end'&&Z.mistakes<=2;
    S.exams.taken++; S.exams.best=Math.max(S.exams.best||0,Z.correct);
    if(R.passed){ S.exams.passed++; S.xp+=100; R.xp+=100; if(Z.mistakes===0) S.exams.perfect++; if(R.time<600) S.exams.fast++; }
  }
  if(Z.mode==='marathon'&&reason==='end') S.marathon=0;
  save(); LAST=R; Z=null; view='result'; render(); window.scrollTo(0,0);
  checkBadges();
  if(R.passed){ sfx('win'); confetti(); }
}
function vResult(){
  const R=LAST; if(!R) return vHome();
  let head;
  if(R.mode==='exam'){
    const why=R.passed?`${R.correct} з 20 правильно за ${fmtMin(R.time)}. +100 XP за складений іспит.`:R.reason==='time'?`Час вийшов. Правильних відповідей: ${R.correct}.`:R.reason==='mistakes'?`Три помилки — іспит зупинено на ${R.answered}-му питанні.`:`Правильних: ${R.correct} з 20.`;
    head=`<section class="plate ${R.passed?'pass':'fail'}"><div class="inner"><p class="plate-k">Пробний іспит</p><h1 class="plate-t">${R.passed?'Складено':'Не складено'}</h1><p>${why}</p></div></section>`;
  } else {
    head=`<section class="plate neutral"><div class="inner"><p class="plate-k">${esc(modeTitleOf(R.mode,R.sec))}</p><h1 class="plate-t">${R.correct} з ${R.answered}</h1><p>правильних відповідей${R.xp?`, +${R.xp} XP`:''}</p></div></section>`;
  }
  const wrong=R.wrong.length?`<h2 class="h2">Де були помилки</h2>`+R.wrong.map(w=>`<div class="wcard"><p class="wq">${esc(w.q.q)}</p>${w.q.sign?`<div class="signbox" style="justify-content:flex-start;margin:4px 0">${signSvg(w.q.sign).replace('width="128" height="128"','width="64" height="64"')}</div>`:''}<p class="wa bad">Твоя відповідь: ${esc(w.picked)}</p><p class="wa ok">Правильно: ${esc(w.q.o[0])}</p></div>`).join(''):'';
  return `<div class="qtop"><button class="iconbtn" data-act="home" aria-label="На головну">${ICON.back}</button><div class="gtitle">Результат</div></div>
  ${head}${wrong}
  <div class="stack" style="margin-top:18px">
    ${R.mode==='exam'?'<button class="btn" data-act="startExam">Ще один іспит</button>':''}
    ${mistakesList().length?'<button class="btn secondary" data-act="mistakes">Розібрати помилки</button>':''}
    <button class="btn secondary" data-act="home">На головну</button>
  </div>`;
}

/* ---------- досягнення ---------- */
function vAch(){
  const acc=S.total.a?Math.round(S.total.c/S.total.a*100):0, lv=level();
  const badges=BADGES.map(b=>{const got=!!S.badges[b.id];return `<div class="badge ${got?'got':'locked'}"><div class="e" aria-hidden="true">${b.e}</div><b>${esc(b.t)}</b><span>${esc(b.d)}</span></div>`;}).join('');
  return `<div class="qtop"><button class="iconbtn" data-act="home" aria-label="На головну">${ICON.back}</button><div class="gtitle">Досягнення</div></div>
  <section class="sign-panel"><div class="inner"><p class="hello">Рівень ${lv.n}</p><div class="ready"><span class="big" style="font-size:44px">${lv.name}</span></div><p class="hello" style="margin-top:6px">${S.xp} XP${lv.next?`, до наступного рівня ще ${lv.next-S.xp}`:', це максимальний рівень'}</p></div></section>
  <h2 class="h2">Статистика</h2>
  <div class="stats">
    <div class="stat"><b>${S.total.a}</b><span>відповідей</span></div>
    <div class="stat"><b>${acc}%</b><span>точність</span></div>
    <div class="stat"><b>${S.exams.passed} з ${S.exams.taken}</b><span>іспитів складено</span></div>
    <div class="stat"><b>${S.game.best}</b><span>рекорд на перехрестях</span></div>
  </div>
  <h2 class="h2">Нагороди</h2>
  <div class="badges">${badges}</div>
  <h2 class="h2">Налаштування</h2>
  <div class="setrow"><span>Звуки</span><button class="switch" role="switch" aria-checked="${S.sound}" aria-label="Звуки" data-act="sound"></button></div>
  <button class="btn secondary" data-act="reset" style="margin-top:12px">Скинути весь прогрес</button>`;
}

/* ---------- гра «Хто проїде першим?» ---------- */
const LET=['А','Б','В'];
const CAR_COLORS=['#2F6FE4','#E8590C','#0F9D7A'];
const MVTXT={s:'прямо',l:'ліворуч',r:'праворуч'};
const PATHS={
  s:{drive:[['M',180,258],['L',180,-60]],arrow:[['M',180,233],['L',180,100]]},
  r:{drive:[['M',180,258],['L',180,222],['Q',180,180,222,180],['L',360,180]],arrow:[['M',180,233],['L',180,222],['Q',180,180,222,180],['L',254,180]]},
  l:{drive:[['M',180,258],['L',180,204],['Q',180,120,96,120],['L',-60,120]],arrow:[['M',180,233],['L',180,204],['Q',180,120,96,120],['L',68,120]]}
};
function rot(x,y,k){let dx=x-150,dy=y-150;for(let i=0;i<k;i++){const t=dx;dx=dy;dy=-t;}return [150+dx,150+dy];}
function pathStr(segs,k){return segs.map(seg=>{let out=seg[0];for(let i=1;i<seg.length;i+=2){const p=rot(seg[i],seg[i+1],k);out+=' '+p[0].toFixed(1)+' '+p[1].toFixed(1);}return out;}).join(' ');}
function relOf(a,b){return (b.dir-a.dir+4)%4;} // 1: b справа від a, 2: зустрічний, 3: b зліва
function conflict(a,b){
  const rel=relOf(a,b);
  if(rel===2) return (a.mv==='l')!==(b.mv==='l');
  const X=rel===1?a:b, Y=rel===1?b:a; // Y — праворуч від X
  if(X.mv==='r') return false;
  if(Y.mv==='r') return X.mv==='s';
  return true;
}
function yieldsTo(a,b,sc){ // чи має a поступитися b (за умови конфлікту)
  if(sc.main){ const am=sc.mainDirs.includes(a.dir), bm=sc.mainDirs.includes(b.dir); if(am!==bm) return !am; }
  const rel=relOf(a,b);
  if(rel===2) return a.mv==='l'&&b.mv!=='l';
  return rel===1;
}
function layersOf(sc,goneSet){
  const left=sc.cars.map((_,i)=>i).filter(i=>!goneSet||!goneSet.has(i));
  const done=new Set(goneSet?[...goneSet]:[]); const layers=[];
  let guard=0;
  while(left.some(i=>!done.has(i))&&guard++<10){
    const ready=left.filter(i=>!done.has(i)&&[...sc.deps[i]].every(j=>done.has(j)));
    if(!ready.length) return null;
    layers.push(ready); ready.forEach(i=>done.add(i));
  }
  return layers;
}
function genScenario(score){
  for(let tries=0;tries<400;tries++){
    const main=score>=3&&Math.random()<0.5;
    const n=score<2?2:(Math.random()<0.65?3:2);
    const dirs=shuffle([0,1,2,3]).slice(0,n);
    const cars=dirs.map(d=>({dir:d,mv:pick(['s','s','l','l','r'])}));
    const sc={main,mainDirs:Math.random()<0.5?[0,2]:[1,3],cars,deps:cars.map(()=>new Set())};
    let bad=false;
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){ if(relOf(cars[i],cars[j])===2&&cars[i].mv==='l'&&cars[j].mv==='l') bad=true; }
    if(bad) continue;
    if(main){ const m=cars.filter(c=>sc.mainDirs.includes(c.dir)).length; if(m===0||m===n) continue; }
    let edges=0;
    for(let i=0;i<n;i++)for(let j=0;j<n;j++){ if(i!==j&&conflict(cars[i],cars[j])&&yieldsTo(cars[i],cars[j],sc)){ sc.deps[i].add(j); edges++; } }
    if(!edges) continue;
    if(!layersOf(sc,null)) continue; // взаємне блокування — пропускаємо
    return sc;
  }
  return {main:false,mainDirs:[0,2],cars:[{dir:0,mv:'s'},{dir:1,mv:'s'}],deps:[new Set([1]),new Set()]};
}
function startGame(){ if(G) G.alive=false; G={lives:3,score:0,sc:null,gone:new Set(),anim:0,busy:false,over:false,alive:true}; G.sc=genScenario(0); view='game'; render(); window.scrollTo(0,0); }
function carG(c,i){
  const p=rot(180,258,c.dir), ang=-90*c.dir, col=CAR_COLORS[i];
  const bl=c.mv==='l'?[[-10.5,-19],[-10.5,19]]:c.mv==='r'?[[10.5,-19],[10.5,19]]:[];
  return `<g class="car" id="car${i}" data-act="car" data-arg="${i}" transform="translate(${p[0]} ${p[1]}) rotate(${ang})" role="button" tabindex="0" aria-label="Авто ${LET[i]}, їде ${MVTXT[c.mv]}">
    <circle r="31" fill="transparent"/>
    <circle class="ring" r="28" fill="none" stroke="#F2B705" stroke-width="3"/>
    <g class="body"><rect x="-13" y="-22" width="26" height="44" rx="7" fill="${col}" stroke="rgba(0,0,0,.35)" stroke-width="1"/>
    <rect x="-10" y="-14" width="20" height="9" rx="3" fill="rgba(12,20,32,.75)"/>
    <rect x="-10" y="9" width="20" height="6" rx="2.5" fill="rgba(12,20,32,.55)"/>
    <rect x="-11" y="-22" width="5" height="2.5" rx="1" fill="#FFF6C8"/><rect x="6" y="-22" width="5" height="2.5" rx="1" fill="#FFF6C8"/>
    ${bl.map(b=>`<circle class="blink" cx="${b[0]}" cy="${b[1]}" r="3.3" fill="#FFB020"/>`).join('')}
    <g class="lbl" transform="rotate(${-ang})"><circle r="9.5" fill="#fff" stroke="#1D2128" stroke-width="1.5"/><text y="4.6" text-anchor="middle" font-size="13" font-weight="700" fill="#1D2128" font-family="Fira Sans,sans-serif">${LET[i]}</text></g></g>
  </g>`;
}
function drawScenario(){
  const sc=G.sc;
  let s=`<svg viewBox="0 0 300 300" class="xsvg" id="xsvg" role="group" aria-label="Перехрестя з ${sc.cars.length} авто"><defs>${CAR_COLORS.map((c,i)=>`<marker id="mk${i}" viewBox="0 0 10 10" refX="4" refY="5" markerWidth="3.6" markerHeight="3.6" orient="auto"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`).join('')}</defs>`;
  s+=`<rect width="300" height="300" style="fill:var(--verge)"/>`;
  s+=`<rect x="83" y="0" width="134" height="300" style="fill:var(--curb)"/><rect x="0" y="83" width="300" height="134" style="fill:var(--curb)"/>`;
  s+=`<rect x="89" y="0" width="122" height="300" style="fill:var(--asphalt)"/><rect x="0" y="89" width="300" height="122" style="fill:var(--asphalt)"/>`;
  const dash='style="stroke:var(--mark)" stroke-width="2.5" stroke-dasharray="12 10"';
  s+=`<line x1="150" y1="0" x2="150" y2="80" ${dash}/><line x1="150" y1="220" x2="150" y2="300" ${dash}/><line x1="0" y1="150" x2="80" y2="150" ${dash}/><line x1="220" y1="150" x2="300" y2="150" ${dash}/>`;
  if(sc.main){
    for(let k=0;k<4;k++){ const p=rot(238,240,k);
      s+=sc.mainDirs.includes(k)
        ?`<g transform="translate(${p[0]} ${p[1]})"><polygon points="0,-12 12,0 0,12 -12,0" fill="#fff" stroke="#2A2A2A" stroke-width="1"/><polygon points="0,-7 7,0 0,7 -7,0" fill="#F2B705"/></g>`
        :`<g transform="translate(${p[0]} ${p[1]})"><polygon points="0,10 -12,-10 12,-10" fill="#fff" stroke="#D7262E" stroke-width="3.2" stroke-linejoin="round"/></g>`;
    }
  }
  sc.cars.forEach((c,i)=>{ if(!G.gone.has(i)) s+=`<path id="arr${i}" class="arrow" d="${pathStr(PATHS[c.mv].arrow,c.dir)}" fill="none" stroke="${CAR_COLORS[i]}" stroke-width="4" stroke-dasharray="7 6" stroke-linecap="round" marker-end="url(#mk${i})"/>`; });
  sc.cars.forEach((c,i)=>{ if(!G.gone.has(i)) s+=carG(c,i); });
  return s+'</svg>';
}
function vGame(){
  const hearts=[0,1,2].map(i=>`<span class="heart ${i<G.lives?'':'lost'}">${ICON.heart}</span>`).join('');
  return `<div class="qtop"><button class="iconbtn" data-act="home" aria-label="На головну">${ICON.back}</button><div class="gtitle">Хто проїде першим?</div><div class="hearts" aria-label="Життів: ${G.lives}">${hearts}</div></div>
  <div class="gscore"><span>Перехресть: <b id="gScore">${G.score}</b></span><span>Рекорд: <b>${S.game.best}</b></span></div>
  <div class="xwrap" id="xwrap">${drawScenario()}</div>
  <p class="gmode">${G.sc.main?'Нерівнозначні дороги: ромб — головна, трикутник — другорядна.':'Рівнозначні дороги, знаків пріоритету немає.'}</p>
  <div id="gfb">${G.over?gameOverHtml():'<p class="ghint">Натискай на авто в тому порядку, в якому вони мають проїхати. Поворотник і пунктир показують, куди їде кожне.</p>'}</div>`;
}
function afterGameRender(){
  const svg=document.getElementById('xsvg'); if(!svg) return;
  svg.querySelectorAll('.car').forEach(g=>g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tapCar(+g.dataset.arg);}}));
}
function driveCar(i,done){
  const c=G.sc.cars[i]; const g=document.getElementById('car'+i), ar=document.getElementById('arr'+i), svg=document.getElementById('xsvg');
  if(ar) ar.style.opacity='0';
  if(!g||!svg){done();return;}
  if(reduced){ g.style.display='none'; done(); return; }
  const p=document.createElementNS('http://www.w3.org/2000/svg','path');
  p.setAttribute('d',pathStr(PATHS[c.mv].drive,c.dir)); p.setAttribute('fill','none'); p.setAttribute('stroke','none');
  svg.appendChild(p);
  const L=p.getTotalLength(), T=1150, t0=performance.now(), lbl=g.querySelector('.lbl');
  const myG=G;
  function step(now){
    if(!myG.alive){p.remove();return;}
    const u=Math.min(1,(now-t0)/T), e=u*u*0.55+u*0.45, d=e*L;
    const a=p.getPointAtLength(Math.max(0,d-0.6)), b=p.getPointAtLength(Math.min(L,d+0.6));
    const ang=Math.atan2(b.x-a.x,-(b.y-a.y))*180/Math.PI;
    const pt=p.getPointAtLength(d);
    g.setAttribute('transform',`translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)}) rotate(${ang.toFixed(1)})`);
    if(lbl) lbl.setAttribute('transform',`rotate(${(-ang).toFixed(1)})`);
    if(u<1) requestAnimationFrame(step); else { g.style.display='none'; p.remove(); done(); }
  }
  requestAnimationFrame(step);
}
function tapCar(i){
  if(!G||G.busy||G.over||G.gone.has(i)) return;
  const sc=G.sc;
  const blockers=[...sc.deps[i]].filter(j=>!G.gone.has(j));
  if(!blockers.length){
    G.gone.add(i); G.anim++; sfx('ok'); TG.haptic('success');
    const g=document.getElementById('car'+i); if(g) g.classList.remove('blocker');
    const myG=G;
    driveCar(i,()=>{ if(!myG.alive) return; myG.anim--; if(myG.gone.size===sc.cars.length&&myG.anim===0&&!myG.busy) cleared(); });
  } else {
    wrongTap(i,blockers[0]);
  }
}
function cleared(){
  G.score++; S.game.total++; S.xp+=15;
  if(G.score>S.game.best) S.game.best=G.score;
  save(); checkBadges(); xpFloat('+15 XP');
  const myG=G;
  setTimeout(()=>{ if(!myG.alive||G!==myG) return; G.sc=genScenario(G.score); G.gone=new Set(); render(); },380);
}
function reasonText(c,b,ci,bi){
  const sc=G.sc, A=`${LET[ci]}`, B=`${LET[bi]}`;
  if(sc.main&&sc.mainDirs.includes(c.dir)!==sc.mainDirs.includes(b.dir)) return `${A} їде другорядною дорогою, тому пропускає ${B} на головній, куди б воно не прямувало (п. 16.11).`;
  if(relOf(c,b)===2) return `${A} повертає ліворуч, тому пропускає зустрічне ${B}, що їде ${MVTXT[b.mv]} (п. 16.13).`;
  return `На рівнозначних дорогах ${A} пропускає ${B}, бо воно наближається справа (п. 16.12).`;
}
function orderText(sc){
  const layers=layersOf(sc,null)||[];
  return layers.map(l=>l.map(i=>LET[i]).join(' і ')+(l.length>1?' одночасно':'')).join(', потім ');
}
function wrongTap(i,b){
  G.busy=true; G.lives--; sfx('bad'); buzz();
  const sc=G.sc;
  const g=document.getElementById('car'+i); if(g){ g.classList.remove('miss'); void g.getBoundingClientRect(); g.classList.add('miss'); }
  const bg=document.getElementById('car'+b); if(bg) bg.classList.add('blocker');
  document.querySelectorAll('.heart').forEach((h,k)=>h.classList.toggle('lost',k>=G.lives));
  const fb=document.getElementById('gfb');
  if(fb) fb.innerHTML=`<div class="feedback bad" role="status"><b>Спершу ${LET[b]}</b><p>${reasonText(sc.cars[i],sc.cars[b],i,b)}</p><p>Черговість: ${orderText(sc)}.</p></div><button class="btn" data-act="gNext">${G.lives>0?'Показати і їхати далі':'Показати і завершити'}</button>`;
  const nb=fb&&fb.querySelector('.btn'); if(nb) nb.scrollIntoView({behavior:reduced?'auto':'smooth',block:'nearest'});
}
function gNext(){
  if(!G) return;
  const sc=G.sc, myG=G;
  const btn=document.querySelector('[data-act="gNext"]'); if(btn) btn.disabled=true;
  document.querySelectorAll('.car.blocker').forEach(x=>x.classList.remove('blocker'));
  const layers=layersOf(sc,G.gone)||[];
  let k=0;
  const finish=()=>{ if(!myG.alive||G!==myG) return; if(G.lives<=0){ G.over=true; if(G.score>S.game.best) S.game.best=G.score; save(); checkBadges(); render(); } else { G.busy=false; G.sc=genScenario(G.score); G.gone=new Set(); render(); } };
  const runLayer=()=>{
    if(!myG.alive||G!==myG) return;
    if(k>=layers.length){ setTimeout(finish,250); return; }
    const l=layers[k++]; let left=l.length;
    l.forEach(i=>{ G.gone.add(i); driveCar(i,()=>{ if(--left===0) setTimeout(runLayer,120); }); });
  };
  runLayer();
}
function gameOverHtml(){
  return `<div class="over"><p class="ghint">Перехресть пройдено</p><div class="big">${G.score}</div><p class="gmode" style="margin-top:4px">${G.score>=S.game.best&&G.score>0?'Новий рекорд!':`Рекорд: ${S.game.best}`}</p><div class="stack"><button class="btn" data-act="game">Грати знову</button><button class="btn secondary" data-act="home">На головну</button></div></div>`;
}

/* ---------- добір питань ---------- */
function pickExam(){
  // по кілька питань з кожного розділу, щоб іспит покривав усі теми
  const per=shuffle(SEC_LIST.map(s=>shuffle(BYSEC[s.id]||[])));
  const out=[]; let r=0;
  while(out.length<20&&r<20){ per.forEach(list=>{ if(out.length<20&&list[r]) out.push(list[r]); }); r++; }
  return shuffle(out);
}
function pickTrain(){
  const key=x=>{const st=S.q[x.id];if(!st)return 1;if(st.s===0)return 0;if(st.s===1)return 2;return 3;};
  return shuffle(QB.map(x=>({x,k:key(x)+Math.random()*0.9})).sort((a,b)=>a.k-b.k).slice(0,10).map(o=>o.x));
}

/* ---------- оверлеї ---------- */
function toast(msg){
  const t=document.createElement('div'); t.className='toast'; t.setAttribute('role','status'); t.textContent=msg; document.body.appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),350);},2600);
}
function xpFloat(txt){ const d=document.createElement('div'); d.className='xpfloat'; d.textContent=txt; document.body.appendChild(d); setTimeout(()=>d.remove(),1050); }
function confirmSheet(title,text,okLabel,onOk){
  const b=document.createElement('div'); b.className='backdrop';
  b.innerHTML=`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="shT"><h3 id="shT">${esc(title)}</h3><p>${esc(text)}</p><div class="sheet-btns"><button class="btn secondary" data-x="no">Скасувати</button><button class="btn danger" data-x="yes">${esc(okLabel)}</button></div></div>`;
  document.body.appendChild(b);
  b.addEventListener('click',e=>{ const x=e.target.closest('[data-x]'); if(e.target===b||(x&&x.dataset.x==='no')) b.remove(); else if(x&&x.dataset.x==='yes'){ b.remove(); onOk(); } });
  const no=b.querySelector('[data-x="no"]'); if(no) no.focus();
}
function confetti(){
  if(reduced) return;
  const c=document.createElement('canvas'); c.className='confetti'; document.body.appendChild(c);
  const dpr=Math.min(2,window.devicePixelRatio||1); const W=c.width=innerWidth*dpr, H=c.height=innerHeight*dpr; const ctx=c.getContext&&c.getContext('2d'); if(!ctx){c.remove();return;}
  const cols=['#F2B705','#1D5DBF','#16804A','#D7262E','#ffffff'];
  const P=Array.from({length:140},()=>({x:W/2+(Math.random()-.5)*W*0.3,y:H*0.35,vx:(Math.random()-.5)*14*dpr,vy:(-Math.random()*14-4)*dpr,w:(5+Math.random()*6)*dpr,h:(8+Math.random()*8)*dpr,r:Math.random()*6,vr:(Math.random()-.5)*.3,c:pick(cols)}));
  const t0=performance.now();
  (function f(now){ const el=now-t0; ctx.clearRect(0,0,W,H);
    P.forEach(p=>{p.vy+=0.45*dpr;p.vx*=0.99;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.fillStyle=p.c;ctx.globalAlpha=Math.max(0,1-el/2600);ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);ctx.restore();});
    if(el<2600) requestAnimationFrame(f); else c.remove(); })(t0);
}

/* ---------- дії ---------- */
const ACT={
  home:()=>go('home'),
  sound:()=>{S.sound=!S.sound;save();render();if(S.sound)sfx('ok');},
  examIntro:()=>go('examIntro'),
  startExam:()=>startQuiz('exam',pickExam()),
  train:()=>startQuiz('train',pickTrain()),
  topics:()=>go('topics'),
  topic:a=>startQuiz('topic',shuffle(BYSEC[a]||[]),{sec:a}),
  marathon:()=>startQuiz('marathon',QB,{startAt:S.marathon<QB.length?S.marathon:0}),
  mistakes:()=>startQuiz('mistakes',shuffle(mistakesList())),
  favs:()=>startQuiz('favs',shuffle(QB.filter(x=>S.fav.includes(x.id)))),
  game:()=>startGame(),
  ach:()=>go('ach'),
  ans:a=>answer(+a),
  next:()=>nextQ(),
  fav:()=>{ if(!Z) return; const id=Z.list[Z.i].id; const k=S.fav.indexOf(id); if(k>=0)S.fav.splice(k,1); else S.fav.push(id); save();
    const b=document.querySelector('.star'); if(b){const on=k<0;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);b.setAttribute('aria-label',on?'Прибрати з обраного':'Додати в обране');} toast(k<0?'Додано в обране':'Прибрано з обраного'); },
  quitQuiz:()=>{ if(!Z) return go('home');
    if(Z.mode==='exam') confirmSheet('Вийти з іспиту?','Результат цього іспиту не зарахується. Уже дані відповіді залишаться в статистиці.','Вийти',()=>go('home'));
    else go('home'); },
  car:a=>tapCar(+a),
  gNext:()=>gNext(),
  reset:()=>confirmSheet('Скинути весь прогрес?','Зникнуть відповіді, XP, серія днів, рекорди й досягнення. Це не можна скасувати.','Скинути',()=>{const snd=S.sound;S=defaults();S.sound=snd;save();go('home');toast('Прогрес скинуто');})
};
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-act]'); if(!el) return;
  if(el.closest('.backdrop')) return;
  const f=ACT[el.dataset.act]; if(!f) return;
  if(el.dataset.act!=='ans'&&el.dataset.act!=='car') TG.haptic('light');
  f(el.dataset.arg,el);
});
document.addEventListener('keydown',e=>{
  if(document.querySelector('.backdrop')) return;
  if(view==='quiz'&&Z){
    if(Z.picked===null&&/^[1-4]$/.test(e.key)) answer(+e.key-1);
    else if(Z.picked!==null&&e.key==='Enter'&&!(e.target&&e.target.closest&&e.target.closest('button'))) nextQ();
  }
});

TG.ready();
TG.applyTheme();
TG.on('themeChanged',()=>TG.applyTheme());
TG.on('deactivated',()=>flush());
render();
checkBadges();
initCloud();
