'use strict';
/* ---------- анімовані сцени до питань ----------
   Сцена малює лише ситуацію з умови (сигнал світлофора, розмітку, переїзд, перехрестя, спецавто…)
   і ніколи не підказує відповідь. Які питання мають сцену — у SCENES внизу файлу.
   Три види: tl — світлофор зблизька, road — ділянка дороги згори, x — перехрестя згори. */
const SCN=(()=>{
const RM=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
const C={me:'#FFC23D',blue:'#3B82F6',red:'#E5484D',green:'#16A34A',gray:'#94A3B8',white:'#EEF2F5',violet:'#8B5CF6',tram:'#E0473A',orange:'#F97316'};
const MK=['me','blue','red','green','gray','violet','tram'];
const f1=n=>Math.round(n*10)/10;

const glowGrad=(id,c)=>`<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity=".8"/><stop offset=".45" stop-color="${c}" stop-opacity=".28"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
const lensGrad=(id,hi,c)=>`<radialGradient id="${id}" cx=".42" cy=".38" r=".65"><stop offset="0" stop-color="${hi}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity=".9"/></radialGradient>`;
const DEFS=`<defs>${glowGrad('sgR','#FF3B30')}${glowGrad('sgY','#FFC400')}${glowGrad('sgG','#1EE07A')}${glowGrad('sgW','#DCE8FF')}${glowGrad('sgB','#3B8BFF')}${glowGrad('sgO','#FF9F1C')}
${lensGrad('slR','#FFC2BD','#FF3B30')}${lensGrad('slY','#FFF4C2','#FFC400')}${lensGrad('slG','#C9FFE2','#1EE07A')}${lensGrad('slW','#FFFFFF','#D9E6FF')}
<linearGradient id="sgNight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#08140F"/><stop offset="1" stop-color="#153F32"/></linearGradient>
<linearGradient id="sgBeam" x1="0" x2="1"><stop offset="0" stop-color="#FFF6C8" stop-opacity=".9"/><stop offset="1" stop-color="#FFF6C8" stop-opacity="0"/></linearGradient>
<linearGradient id="sgWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3FA7D6"/><stop offset="1" stop-color="#1D6FA3"/></linearGradient>
<filter id="sfBlur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="8"/></filter>
<filter id="sfSoft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.4"/></filter>
${MK.map(k=>`<marker id="sm-${k}" viewBox="0 0 10 10" refX="4" refY="5" markerWidth="3.4" markerHeight="3.4" orient="auto"><path d="M0 0L10 5L0 10z" fill="${C[k]}"/></marker>`).join('')}
</defs>`;
const svg=(vb,body,label)=>`<svg viewBox="${vb}" role="img" aria-label="${label}">${DEFS}${body}</svg>`;

/* ================= світлофори зблизька ================= */
const LAMP={r:['slR','sgR','#3A1514'],y:['slY','sgY','#3A3112'],g:['slG','sgG','#0F2E1F'],w:['slW','sgW','#272C35']};
// st: 0 — вимкнено, 1 — горить, 2 — блимає; cls — свій клас блимання (для поперемінних)
function lamp(x,y,r,col,st,cls,inner){
  const [lens,glow,off]=LAMP[col];
  let s=`<circle cx="${x}" cy="${y}" r="${r}" fill="${off}"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="2"/>`;
  if(st){
    const c=cls||(st===2?'sc-blink':'');
    s+=`<g class="${c}"><circle cx="${x}" cy="${y}" r="${r*2.3}" fill="url(#${glow})"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#${lens})"/>${inner||''}</g>`;
  } else if(inner) s+=`<g opacity=".35">${inner}</g>`;
  return s;
}
const visor=(x,y,r)=>`<path d="M${x-r-4} ${y-r+2} Q${x} ${y-r-12} ${x+r+4} ${y-r+2} L${x+r+1} ${y-r+6} Q${x} ${y-r-4} ${x-r-1} ${y-r+6}Z" fill="#05090B"/>`;
const ARR={ // стрілки в лінзі, центр (0,0), напрям — праворуч
  fill:'<path d="M-11 -3.6H1.5V-9.5L11.5 0 1.5 9.5V3.6H-11Z"/>',
  line:'<path d="M-11 -3.6H1.5V-9.5L11.5 0 1.5 9.5V3.6H-11Z" fill="none" stroke-width="2.6" stroke-linejoin="round"/>'
};
const rotA=(a,x,y,deg,attrs)=>`<g transform="translate(${x} ${y}) rotate(${deg})" ${attrs}>${a}</g>`;
function backdrop(tint){
  return `<rect width="320" height="180" fill="url(#sgNight)"/>
  <g filter="url(#sfBlur)" opacity=".55"><circle cx="34" cy="40" r="16" fill="#1E6F5C"/><circle cx="286" cy="30" r="12" fill="#C9A227" opacity=".6"/><circle cx="262" cy="150" r="20" fill="#0E9F8E" opacity=".5"/><circle cx="60" cy="150" r="14" fill="#3B5BDB" opacity=".45"/></g>
  ${tint?`<ellipse cx="160" cy="176" rx="150" ry="22" fill="url(#${tint})" opacity=".7"/>`:''}`;
}
const housing=(x,y,w,h,rx)=>`<rect x="${x+3}" y="${y+5}" width="${w}" height="${h}" rx="${rx}" fill="rgba(0,0,0,.35)"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="#11171B" stroke="#2C363D" stroke-width="2"/>`;
const ped=(walk,col)=>walk
  ?`<g fill="${col}"><circle cx="1" cy="-10" r="3.3"/><path d="M-1.5-5.5h4.5l3 7-2.4 1-2.1-4.6-1 4.8 3.4 4.5L3.8 18 1.2 18l-2.6-6-2.6 6h-2.8l3.2-8.8.8-6.8-2.4 3.6-2.6-.8z"/></g>`
  :`<g fill="${col}"><circle cx="0" cy="-11" r="3.3"/><path d="M-4-6.5h8v11.5h-2v13h-1.8v-11h-.4v11H-2V5h-2z"/></g>`;

function tl(sp){
  let b='', tint=null, label='Світлофор';
  const v=sp.v||'std';
  if(v==='std'){
    const x=160, ys={r:40,y:90,g:140}, R=19, st={r:sp.r||0,y:sp.y||0,g:sp.g||0};
    tint=st.g?'sgG':st.y&&!st.r?'sgY':st.r?'sgR':null;
    b+=`<rect x="157" y="166" width="6" height="14" fill="#1A2227"/>`;
    if(sp.ar) b+=housing(184,116,50,48,12);
    b+=housing(131,13,58,154,16);
    if(sp.plate) { const px=sp.plate==='r'?196:76; b+=`<rect x="${px}" y="22" width="48" height="36" rx="5" fill="#F4F6F8" stroke="#C9D1D8" stroke-width="2"/>`+rotA(ARR.fill,px+24,40,sp.plate==='r'?0:180,'fill="#17A34A"'); }
    ['r','y','g'].forEach(k=>{
      let inner='';
      if(k==='g'&&sp.gA) inner=`<circle cx="${x}" cy="${ys.g}" r="${R}" fill="#071009"/>`+rotA(ARR.fill,x,ys.g,sp.gA==='l'?180:0,'fill="#3CFF9A"');
      if(k==='g'&&sp.gc) inner=rotA(ARR.line,x,ys.g,-90,'stroke="#06100B"');
      if(k==='r'&&sp.rc) inner=rotA(ARR.line,x,ys.r,-90,'stroke="#140606"');
      b+=visor(x,ys[k],R)+lamp(x,ys[k],R,k,st[k],null,inner);
    });
    if(sp.ar){ const on=sp.ar>0; b+=`<circle cx="209" cy="140" r="16" fill="#071009" stroke="rgba(0,0,0,.5)" stroke-width="2"/>`+(on?`<circle cx="209" cy="140" r="34" fill="url(#sgG)"/>`:'')+rotA(ARR.fill,209,140,0,`fill="${on?'#3CFF9A':'#16301F'}"`); }
    const nm={r:'червоний',y:'жовтий',g:'зелений'};
    const parts=['r','y','g'].filter(k=>st[k]).map(k=>(st[k]===2?'миготливий ':'')+nm[k]);
    label=`Світлофор: ${parts.length?'горить '+parts.join(' і '):'сигнали вимкнені'}${sp.ar>0?', увімкнена додаткова секція зі стрілкою праворуч':sp.ar<0?', додаткова секція праворуч не світиться':''}${sp.plate?`, біля червоного — табличка із зеленою стрілкою ${sp.plate==='r'?'праворуч':'ліворуч'}`:''}`;
  } else if(v==='single'){
    tint='sgY'; b+=`<rect x="157" y="122" width="6" height="58" fill="#1A2227"/>`+housing(128,58,64,64,16)+visor(160,90,20)+lamp(160,90,20,'y',2);
    label='Світлофор над переходом: миготливий жовтий';
  } else if(v==='twoy'){
    tint='sgY'; b+=`<rect x="157" y="122" width="6" height="58" fill="#1A2227"/>`+housing(92,58,136,64,18)+visor(126,90,20)+visor(194,90,20)+lamp(126,90,20,'y',1,'sc-alt1')+lamp(194,90,20,'y',1,'sc-alt2');
    label='Над переходом поперемінно блимають два жовтих сигнали';
  } else if(v==='ped'){
    tint='sgG'; b+=`<rect x="157" y="156" width="6" height="24" fill="#1A2227"/>`+housing(126,22,68,136,14);
    b+=`<rect x="134" y="30" width="52" height="56" rx="8" fill="#1C0D0D"/><g transform="translate(160 62)" opacity=".4">${ped(false,'#7A2A26')}</g>`;
    b+=`<rect x="134" y="94" width="52" height="56" rx="8" fill="#071009"/><circle cx="160" cy="122" r="46" fill="url(#sgG)" class="sc-glow"/><g transform="translate(160 126) scale(1.25)">${ped(true,'#3CFF9A')}</g>`;
    label='Пішохідний світлофор: горить зелений чоловічок';
  } else if(v==='lane'){
    const on=sp.lane!=='off', col=sp.lane==='dr'?'#FFC400':'#FF3B30';
    tint=sp.lane==='dr'?'sgY':sp.lane==='x'?'sgR':null;
    b+=`<rect x="0" y="0" width="320" height="8" fill="#1A2227"/><rect x="157" y="0" width="6" height="30" fill="#1A2227"/>`+housing(100,28,120,120,18)+`<rect x="110" y="38" width="100" height="100" rx="12" fill="#070B0D"/>`;
    if(sp.lane==='dr') b+=`<circle cx="160" cy="88" r="70" fill="url(#sgY)"/>`+rotA('<path d="M-30 -9H8V-26L34 0 8 26V9H-30Z"/>',160,88,45,`fill="${col}"`);
    else b+=`${on?'<circle cx="160" cy="88" r="70" fill="url(#sgR)"/>':''}<path d="M130 58 190 118M190 58 130 118" stroke="${on?col:'#2A1414'}" stroke-width="15" stroke-linecap="round"/>`;
    label=sp.lane==='x'?'Над смугою горить червоний X-подібний сигнал':sp.lane==='dr'?'Над смугою горить жовта стрілка вниз праворуч':'Реверсивний світлофор над смугою вимкнений';
  } else if(v==='tram'){
    const lit=sp.lit||[]; tint='sgW';
    b+=`<rect x="157" y="140" width="6" height="40" fill="#1A2227"/>`+housing(96,24,128,60,16)+housing(134,76,52,64,14);
    [[124,54],[160,54],[196,54],[160,110]].forEach(([x,y],i)=>{ b+=lamp(x,y,14,'w',lit.includes(i)?1:0); });
    label='Трамвайний світлофор: чотири біло-місячні сигнали буквою «Т»';
  } else if(v==='rail'){
    tint=sp.rail==='red'?'sgR':'sgW';
    b+=`<rect x="156" y="20" width="8" height="160" fill="#2A3238"/>`;
    b+=`<g transform="translate(160 38)">${[32,-32].map(a=>`<g transform="rotate(${a})"><rect x="-48" y="-8" width="96" height="16" rx="3" fill="#E5484D"/><rect x="-44.5" y="-4.6" width="89" height="9.2" rx="2" fill="#fff"/></g>`).join('')}</g>`;
    b+=housing(98,76,124,44,22)+lamp(129,98,16,'r',sp.rail==='red'?1:0,'sc-alt1')+lamp(191,98,16,'r',sp.rail==='red'?1:0,'sc-alt2');
    b+=housing(140,126,40,40,13)+lamp(160,146,13,'w',sp.rail==='moon'?2:0);
    label=sp.rail==='red'?'Світлофор на переїзді: поперемінно блимають два червоних':'Світлофор на переїзді: блимає біло-місячний сигнал';
  }
  return svg('0 0 320 180',backdrop(tint)+b,label);
}

/* ================= транспорт згори (капотом праворуч) ================= */
const lampDot=(x,y,col,cls,r)=>`<g class="${cls||''}"><circle cx="${x}" cy="${y}" r="${(r||3)*3.2}" fill="url(#${col})"/><circle cx="${x}" cy="${y}" r="${r||3}" fill="${{sgO:'#FFB020',sgB:'#3B8BFF',sgR:'#FF3B30',sgW:'#FFFFFF',sgY:'#FFC400'}[col]}"/></g>`;
// частини: b — кузов, l — вогні (поверх нічної темряви), t — підписи
function veh(o){
  const k=o.k||'car';
  const L={car:40,me:40,amb:46,police:44,truck:56,service:56,bus:66,kidsbus:66,tram:64,tractor:32}[k]||40, W=k==='car'||k==='me'||k==='police'?20:22, h=L/2, w=W/2;
  const c=o.c||{me:C.me,amb:'#F4F6F8',police:'#F4F6F8',truck:'#CBD5E1',service:'#F97316',bus:'#F59E0B',kidsbus:'#FACC15',tram:C.tram,tractor:'#22A35A'}[k]||C.blue;
  let b=`<rect x="${-h+2}" y="${-w+3}" width="${L}" height="${W}" rx="7" fill="rgba(0,0,0,.2)"/>`, l='';
  if(k==='truck'||k==='service'){
    b+=`<rect x="${-h}" y="${-w}" width="${L-16}" height="${W}" rx="3" fill="${k==='service'?'#E8E1D6':c}" stroke="rgba(0,0,0,.35)"/><rect x="${h-17}" y="${-w+1}" width="17" height="${W-2}" rx="5" fill="${k==='service'?c:'#475569'}" stroke="rgba(0,0,0,.35)"/><rect x="${h-7}" y="${-w+3}" width="5" height="${W-6}" rx="2" fill="rgba(12,20,32,.75)"/>`;
    if(k==='service') b+=`<path d="M${-h+4} ${-w+3}l8 0-8 8zM${-h+16} ${-w+3}l8 0-16 16v-8zM${-h+28} ${-w+3}l8 0-16 16h-8z" fill="${c}" opacity=".85"/>`;
  } else if(k==='bus'||k==='kidsbus'){
    b+=`<rect x="${-h}" y="${-w}" width="${L}" height="${W}" rx="5" fill="${c}" stroke="rgba(0,0,0,.35)"/><rect x="${-h+5}" y="${-w+3}" width="${L-14}" height="${W-6}" rx="3" fill="rgba(255,255,255,.22)"/><rect x="${h-7}" y="${-w+2}" width="5" height="${W-4}" rx="2" fill="rgba(12,20,32,.78)"/>`;
    if(k==='kidsbus') b+=`<rect x="${-h+2}" y="-6" width="12" height="12" rx="1.5" fill="#FDE047" stroke="#111" stroke-width="1.6"/><circle cx="${-h+6}" cy="-1" r="1.4" fill="#111"/><circle cx="${-h+10}" cy="-1" r="1.4" fill="#111"/><path d="M${-h+5} 3h2M${-h+9} 3h2" stroke="#111" stroke-width="1.6"/>`;
  } else if(k==='tram'){
    b+=`<rect x="${-h}" y="${-w}" width="${L}" height="${W}" rx="8" fill="${c}" stroke="rgba(0,0,0,.35)"/><rect x="${-h+6}" y="${-w+5}" width="${L-12}" height="${W-10}" rx="3" fill="#F4E7D2"/><path d="M${-h+20} ${-w+5}v${W-10}M${h-20} ${-w+5}v${W-10}" stroke="${c}" stroke-width="2"/><path d="M-9 0 0 -4.6 9 0 0 4.6z" fill="none" stroke="#334155" stroke-width="1.6"/><rect x="${h-6}" y="${-w+3}" width="4" height="${W-6}" rx="2" fill="rgba(12,20,32,.78)"/><rect x="${-h+2}" y="${-w+3}" width="4" height="${W-6}" rx="2" fill="rgba(12,20,32,.78)"/>`;
  } else if(k==='tractor'){
    b+=`<rect x="${-h+1}" y="${-w-3}" width="13" height="7" rx="2" fill="#1F2937"/><rect x="${-h+1}" y="${w-4}" width="13" height="7" rx="2" fill="#1F2937"/><rect x="${h-9}" y="${-w}" width="8" height="5" rx="1.5" fill="#1F2937"/><rect x="${h-9}" y="${w-5}" width="8" height="5" rx="1.5" fill="#1F2937"/><rect x="${-h+2}" y="${-w+3}" width="${L-4}" height="${W-6}" rx="4" fill="${c}" stroke="rgba(0,0,0,.35)"/><rect x="${-h+3}" y="-6" width="11" height="12" rx="2" fill="rgba(12,20,32,.7)"/>`;
  } else {
    b+=`<rect x="${-h}" y="${-w}" width="${L}" height="${W}" rx="6.5" fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width="1"/><rect x="${h-15}" y="${-w+2.5}" width="8" height="${W-5}" rx="2.5" fill="rgba(12,20,32,.78)"/><rect x="${-h+4}" y="${-w+3}" width="5" height="${W-6}" rx="2" fill="rgba(12,20,32,.6)"/><rect x="${-h+11}" y="${-w+3.5}" width="${L-27}" height="${W-7}" rx="3" fill="rgba(255,255,255,.16)"/>`;
    if(k==='amb') b+=`<rect x="${-h+11}" y="-2.5" width="${L-27}" height="5" fill="#E5484D"/><path d="M${-h+18} -5v10M${-h+13} 0h10" stroke="#E5484D" stroke-width="3.4"/>`;
    if(k==='police') b+=`<rect x="${-h}" y="${-w}" width="${L}" height="4" fill="#1D4ED8"/><rect x="${-h}" y="${w-4}" width="${L}" height="4" fill="#1D4ED8"/>`;
  }
  // фари й ліхтарі
  if(k!=='tram'&&k!=='tractor') b+=`<rect x="${h-2.4}" y="${-w+1.6}" width="2.4" height="4" rx="1" fill="#FFF3C4"/><rect x="${h-2.4}" y="${w-5.6}" width="2.4" height="4" rx="1" fill="#FFF3C4"/><rect x="${-h}" y="${-w+1.6}" width="2" height="4" rx="1" fill="#B91C1C"/><rect x="${-h}" y="${w-5.6}" width="2" height="4" rx="1" fill="#B91C1C"/>`;
  if(o.beam){ const long=o.beam==='high'; l+=`<path d="M${h} ${-w+3} L${h+(long?150:72)} ${-w-(long?20:6)} L${h+(long?150:72)} ${w+(long?18:16)} L${h} ${w-3}Z" fill="url(#sgBeam)" opacity="${long?.75:.6}"/>`; }
  if(o.glare) l+=`<g class="sc-flare"><circle cx="${h+2}" cy="0" r="46" fill="url(#sgW)"/><circle cx="${h+2}" cy="0" r="22" fill="url(#sgW)"/><path d="M${h-60} 0H${h+64}M${h+2} -44V44" stroke="#FFFFFF" stroke-width="2" opacity=".55"/></g>`;
  if(o.beam||o.glare||o.night) l+=`<circle cx="${h-1}" cy="${-w+3.6}" r="2.2" fill="#FFFBE6"/><circle cx="${h-1}" cy="${w-3.6}" r="2.2" fill="#FFFBE6"/>`;
  if(o.night||o.brake) l+=lampDot(-h+1,-w+3.6,'sgR','',o.brake?2.4:1.6)+lampDot(-h+1,w-3.6,'sgR','',o.brake?2.4:1.6);
  const sides=o.blink==='h'?['l','r']:o.blink?[o.blink]:[];
  sides.forEach(sd=>{ const y=sd==='l'?-w+1:w-1; l+=lampDot(h-3,y,'sgO','sc-blink',2.6)+lampDot(-h+3,y,'sgO','sc-blink',2.6); });
  if(o.beacon){
    const [c1,c2]={b:['sgB','sgB'],br:['sgB','sgR'],r:['sgR','sgR'],o:['sgO','sgO']}[o.beacon];
    const bx=k==='truck'||k==='service'?h-9:-2;
    b+=`<rect x="${bx-3}" y="-7.5" width="6" height="15" rx="2" fill="#1F2937"/>`;
    l+=lampDot(bx,-4,c1,'sc-alt1',3.2)+lampDot(bx,4,c2,'sc-alt2',3.2);
  }
  if(o.siren) l+=[0,1].map(i=>`<g class="${i?'sc-waves2':'sc-waves'}"><path d="M${h+8} -14 Q${h+20} 0 ${h+8} 14M${h+16} -22 Q${h+33} 0 ${h+16} 22" fill="none" stroke="#3B8BFF" stroke-width="3" stroke-linecap="round"/></g>`).join('');
  if(o.speaker) l+=[0,1].map(i=>`<g class="${i?'sc-waves2':'sc-waves'}"><path d="M${h+8} -12 Q${h+20} 0 ${h+8} 12M${h+16} -20 Q${h+33} 0 ${h+16} 20" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/></g>`).join('');
  // підпис і табличка швидкості — завжди прямо
  let t='';
  const pill=(txt,bg,fg,dy)=>{ const tw=txt.length*6.4+14; return `<g transform="translate(0 ${dy})"><rect x="${-tw/2}" y="-8" width="${tw}" height="16" rx="8" fill="${bg}" stroke="rgba(255,255,255,.85)" stroke-width="1.5"/><text y="4.2" text-anchor="middle" font-family="Manrope,system-ui,sans-serif" font-weight="800" font-size="10.5" fill="${fg}">${txt}</text></g>`; };
  const up=Math.abs(Math.sin((o.rot||0)*Math.PI/180))>.5?h+12:w+13;
  if(o.label) t+=pill(o.label,'#11201A','#FFD45C',-up);
  if(o.tag) t+=pill(o.tag,'#FFFFFF','#11201A',o.label?up:-up);
  const wrapA=`transform="translate(${f1(o.x)} ${f1(o.y)})"`, mv=o.cls?`class="${o.cls}"`:'', st=o.style?`style="${o.style}"`:'';
  const rot=`transform="rotate(${o.rot||0})"`;
  return {
    b:`<g ${wrapA}><g ${mv} ${st}><g ${rot}>${b}</g></g></g>`,
    l:l?`<g ${wrapA}><g ${mv} ${st}><g ${rot}>${l}</g></g></g>`:'',
    t:t?`<g ${wrapA}><g ${mv} ${st}>${t}</g></g>`:''
  };
}
function person(x,y,o){
  o=o||{}; const s=o.kid?1.15:1.5, col=o.c||'#7C3AED';
  const cane=o.cane?`<path d="M3 -3 L12 -24" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M10.6 -20.5 L12 -24" stroke="#E5484D" stroke-width="2.4" stroke-linecap="round"/>`:'';
  const body=`<g class="sc-step"><ellipse cx="0" cy="1" rx="7.5" ry="4.6" fill="rgba(0,0,0,.18)"/><ellipse cx="0" cy="0" rx="7" ry="4.2" fill="${col}"/>${cane}<circle cx="0" cy="-0.5" r="3.7" fill="#F1C7A1"/><path d="M-3.7 -0.5a3.7 3.7 0 0 1 7.4 0z" fill="#3B2A20"/></g>`;
  const inner=o.walk?`<g class="sc-walk" style="--walk:${o.walk}px;animation-delay:${o.delay||0}s">${body}</g>`:body;
  return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${o.rot||0}) scale(${s})">${inner}</g>`;
}
const tree=(x,y,r)=>`<g transform="translate(${x} ${y})"><circle cx="3" cy="4" r="${r}" fill="rgba(0,0,0,.16)"/><circle r="${r}" style="fill:var(--tree1)"/><circle cx="${-r*.28}" cy="${-r*.28}" r="${r*.6}" style="fill:var(--tree2)"/></g>`;
// дерева на узбіччях там, де нічого немає
function trees(sp,lay){
  if(sp.bridge) return '';
  const u=sp.urban?16:0, tx=sp.cross, busy=[];
  if(tx){ busy.push(tx.x); if(tx.k==='rail') busy.push(tx.x-58,tx.x-26); }
  if(sp.light) busy.push(sp.light.x);
  if(sp.edge==='zigzag') busy.push(205); if(sp.edge==='blue') busy.push(70);
  (sp.a||[]).forEach(a=>{ if(a.y!=null) busy.push(a.x); });
  const free=x=>busy.every(b=>Math.abs(b-x)>34);
  let o='';
  const topH=lay.top-u-4, botY=lay.bot+u+(sp.shoulder?18:0)+4, botH=180-botY;
  if(topH>=24) [26,98,172,250,300].filter(free).forEach((x,i)=>{ o+=tree(x,f1(topH/2),Math.min(13,topH/2-2)-(i%2)*2); });
  if(botH>=24) [54,132,212,292].filter(free).forEach((x,i)=>{ o+=tree(x,f1(botY+botH/2),Math.min(13,botH/2-2)-(i%2?0:2)); });
  return o;
}
const cone=(x,y)=>`<g transform="translate(${x} ${y})"><circle r="6" fill="#F97316" stroke="rgba(0,0,0,.3)"/><circle r="3.2" fill="#fff"/><circle r="1.6" fill="#F97316"/></g>`;
const arrowPath=(d,k)=>`<path d="${d}" fill="none" stroke="${C[k]}" stroke-width="4" stroke-dasharray="7 6" stroke-linecap="round" marker-end="url(#sm-${k})" class="sc-flow" opacity=".95"/>`;

/* ================= ділянка дороги згори ================= */
const LAY={
  '1':{top:52,bot:128,c:90,ln:{r:109,o:71}},
  '2':{top:22,bot:158,c:90,ln:{r:141,l:107,o:73,o2:39}},
  'tram':{top:30,bot:150,c:90,ln:{r:132,o:48,tr:104,to:76}}
};
function hline(y,kind,x0,x1){
  x0=x0||0; x1=x1||320;
  const W='style="stroke:var(--mark)"', ln=(yy,extra)=>`<line x1="${x0}" y1="${yy}" x2="${x1}" y2="${yy}" ${W} stroke-width="2.6" ${extra||''}/>`;
  switch(kind){
    case '1.1': return ln(y);
    case '1.3': return ln(y-3)+ln(y+3);
    case '1.5': return ln(y,'stroke-dasharray="12 30"');
    case '1.6': return ln(y,'stroke-dasharray="30 10"');
    case '1.8': return `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" ${W} stroke-width="5" stroke-dasharray="10 10"/>`;
    case '1.9': return ln(y-3,'stroke-dasharray="12 12"')+ln(y+3,'stroke-dasharray="12 12"');
    case '1.11s': return ln(y-3)+ln(y+3,'stroke-dasharray="12 12"');
    case '1.11d': return ln(y-3,'stroke-dasharray="12 12"')+ln(y+3);
  }
  return '';
}
function road(sp){
  const lay=LAY[sp.lay||'1'], {top,bot,c}=lay, urban=!!sp.urban;
  let base=`<rect width="320" height="180" style="fill:var(--verge)"/>`;
  if(sp.bridge) base+=`<rect width="320" height="180" fill="url(#sgWater)"/>${[18,40,150,168].map((y,i)=>`<path d="M0 ${y} q10 -4 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.6" stroke-dasharray="14 10" class="sc-water" style="animation-delay:-${i*.6}s"/>`).join('')}`;
  else if(urban) base+=`<rect x="0" y="${top-16}" width="320" height="16" style="fill:var(--side)"/><rect x="0" y="${bot}" width="320" height="16" style="fill:var(--side)"/><path d="M0 ${top-8}H320M0 ${bot+8}H320" stroke="rgba(0,0,0,.08)" stroke-width="1" stroke-dasharray="1 15"/>`;
  if(sp.shoulder) base+=`<rect x="0" y="${bot}" width="320" height="18" fill="#B9AE98"/>`;
  base+=trees(sp,lay)+`<rect x="0" y="${top}" width="320" height="${bot-top}" style="fill:var(--asphalt)"/><rect x="0" y="${top-2}" width="320" height="2" style="fill:var(--curb)"/><rect x="0" y="${bot}" width="320" height="2" style="fill:var(--curb)"/>`;
  if(sp.bridge) base+=[top-6,bot+2].map(y=>`<rect x="0" y="${y}" width="320" height="4" fill="#9AA5B1"/>${Array.from({length:17},(_,i)=>`<rect x="${i*20+4}" y="${y-1}" width="3" height="6" fill="#64748B"/>`).join('')}`).join('');
  if(sp.ice) base+=`<rect x="0" y="${top}" width="320" height="${bot-top}" fill="#BFE6FF" opacity=".38"/>${[[40,70],[120,110],[210,64],[270,116],[160,84]].map(([x,y])=>`<path d="M${x-5} ${y}h10M${x} ${y-5}v10" stroke="#fff" stroke-width="1.6" opacity=".8"/>`).join('')}`;
  // осьова і крайові лінії
  if(sp.center==='median') base+=`<rect x="0" y="${c-9}" width="320" height="18" style="fill:var(--verge)"/><rect x="0" y="${c-9}" width="320" height="2" style="fill:var(--curb)"/><rect x="0" y="${c+7}" width="320" height="2" style="fill:var(--curb)"/>`;
  else if(sp.lay==='tram') base+=[lay.ln.to,lay.ln.tr].map(y=>`<path d="M0 ${y-6}H320M0 ${y+6}H320" stroke="#7B848D" stroke-width="2.2"/>`).join('')+`<line x1="0" y1="${top+34}" x2="320" y2="${top+34}" style="stroke:var(--mark)" stroke-width="2.4"/><line x1="0" y1="${bot-34}" x2="320" y2="${bot-34}" style="stroke:var(--mark)" stroke-width="2.4"/>`;
  else base+=hline(c,sp.center||'1.5');
  if(sp.lay==='2'){ base+=hline(lay.ln.r-17,sp.between||'1.5')+hline(lay.ln.o-17,'1.5'); }
  const eY=bot-4;
  if(sp.edge==='1.2') base+=`<line x1="0" y1="${eY}" x2="320" y2="${eY}" style="stroke:var(--mark)" stroke-width="5"/>`;
  if(sp.edge==='1.4') base+=`<line x1="0" y1="${eY}" x2="320" y2="${eY}" stroke="#FACC15" stroke-width="3"/>`;
  if(sp.edge==='1.10') base+=`<line x1="0" y1="${eY}" x2="320" y2="${eY}" stroke="#FACC15" stroke-width="3" stroke-dasharray="14 10"/>`;
  if(sp.edge==='blue') base+=`<line x1="0" y1="${eY}" x2="320" y2="${eY}" stroke="#3B82F6" stroke-width="3"/><g transform="translate(70 ${eY-12})"><rect x="-8" y="-8" width="16" height="16" rx="2" fill="#1D5DBF"/><text y="5" text-anchor="middle" font-family="Fira Sans,sans-serif" font-weight="700" font-size="13" fill="#fff">P</text></g>`;
  if(sp.edge==='zigzag'){ let d=`M110 ${eY}H150`; for(let i=0;i<10;i++) d+=` L${157+i*10} ${i%2?eY:eY-14}`; base+=`<path d="${d} L270 ${eY}" fill="none" stroke="#FACC15" stroke-width="2.6" stroke-linejoin="round"/><g transform="translate(205 ${bot+9})"><rect x="-9" y="-7" width="18" height="14" rx="2" fill="#1D5DBF"/><text y="4" text-anchor="middle" font-family="Fira Sans,sans-serif" font-weight="700" font-size="10" fill="#fff">A</text></g>`; }
  // поперечні елементи
  const tx=sp.cross, rT=c, rB=bot;
  if(tx){
    const x=tx.x;
    if(tx.k==='zebra'||tx.k==='zebra-rw'){ for(let y=top+4,i=0;y<bot-4;y+=10,i++) base+=`<rect x="${x-14}" y="${y}" width="28" height="6" fill="${tx.k==='zebra-rw'&&i%2?'#E5484D':'#F5F5F0'}"/>`; if(tx.island) base+=`<rect x="${x-18}" y="${c-8}" width="36" height="16" rx="5" style="fill:var(--side)" stroke="var(--curb)" stroke-width="2"/>`; }
    if(tx.k==='stop') base+=`<rect x="${x}" y="${rT+3}" width="6" height="${rB-rT-5}" style="fill:var(--mark)"/>`;
    if(tx.k==='teeth') for(let y=rT+4;y<rB-8;y+=12) base+=`<path d="M${x+9} ${y} L${x+9} ${y+10} L${x-7} ${y+5}Z" style="fill:var(--mark)"/>`;
    if(tx.k==='STOP') base+=`<text transform="translate(${x} ${(rT+rB)/2}) rotate(90)" text-anchor="middle" y="9" font-family="Fira Sans Extra Condensed,Fira Sans,sans-serif" font-weight="800" font-size="27" letter-spacing="1" style="fill:var(--mark)">STOP</text>`;
    if(tx.k==='yellow') for(let i=0;i<4;i++) base+=`<rect x="${x+i*22}" y="${rT+4}" width="9" height="${rB-rT-8}" fill="#FACC15"/>`;
    if(tx.k==='rail'||tx.k==='tramx'){
      if(tx.k==='rail'){ for(let y=-4;y<184;y+=9) base+=`<rect x="${x-15}" y="${y}" width="30" height="4" rx="1" fill="#7A6A58"/>`; base+=`<rect x="${x-18}" y="${top}" width="36" height="${bot-top}" fill="#5B636B"/>`; }
      base+=`<path d="M${x-6} 0V180M${x+6} 0V180" stroke="#8B949C" stroke-width="2.6"/>`;
    }
  }
  if(sp.light) base+=trafficIcon(sp.light.x,bot+6,sp.light.s);
  // учасники
  const parts=(sp.a||[]).map(a=>{
    const y=a.y!=null?a.y:lay.ln[a.ln||'r'];
    if(a.k==='ped') return {b:person(a.x,y,a),l:'',t:''};
    if(a.k==='cone') return {b:cone(a.x,y),l:'',t:''};
    const o=Object.assign({},a,{y,rot:a.rot!=null?a.rot:(a.ln==='o'||a.ln==='o2'||a.ln==='to')?180:0,night:sp.night});
    if(a.k==='me'){ o.label='Ти'; if(a.drive&&!RM) o.cls='sc-drive'; }
    if(a.pass&&!RM) o.cls=a.pass==='r'?'sc-passr':'sc-pass';
    return veh(o);
  });
  const rail=tx&&(tx.k==='rail'||tx.k==='tramx')?railBits(sp,tx,lay):{b0:'',b1:'',l:''};
  const arrows=(sp.arrows||[]).map(a=>arrowPath(a.d,a.c||'me')).join('');
  const night=sp.night?`<rect width="320" height="180" fill="#020806" opacity=".62"/>`:'';
  const fog=sp.fog?`<g opacity="${sp.night?.55:.82}"><rect width="320" height="180" fill="#E8EEF0" opacity=".42"/><g filter="url(#sfBlur)" fill="#F2F5F6"><g class="sc-fog"><ellipse cx="60" cy="70" rx="80" ry="34"/><ellipse cx="250" cy="120" rx="90" ry="30"/></g><g class="sc-fog2"><ellipse cx="170" cy="40" rx="90" ry="26"/><ellipse cx="140" cy="150" rx="100" ry="26"/></g></g></g>`:'';
  const snow=sp.ice?`<g fill="#fff">${[[30,0],[90,-40],[150,-10],[210,-60],[270,-25],[60,-80],[180,-100],[300,-70]].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${1.4+i%3*.5}" class="sc-snow" style="animation-delay:-${i*.5}s"/>`).join('')}</g>`:'';
  return svg('0 0 320 180',base+rail.b0+parts.map(p=>p.b).join('')+rail.b1+night+arrows+parts.map(p=>p.l).join('')+rail.l+fog+snow+parts.map(p=>p.t).join(''),sp.alt||'Схема ситуації з питання');
}
function trafficIcon(x,y,s){ // маленький світлофор біля дороги: s — 'g' | 'r'
  return `<g transform="translate(${x} ${y})"><rect x="-1.5" y="10" width="3" height="12" fill="#475569"/><rect x="-7" y="-14" width="14" height="28" rx="4" fill="#11171B"/><circle cy="-7" r="3.6" fill="${s==='r'?'#FF3B30':'#3A1514'}"/><circle cy="0" r="3.6" fill="#3A3112"/><circle cy="7" r="3.6" fill="${s==='g'?'#1EE07A':'#0F2E1F'}"/>${s==='g'?'<circle cy="7" r="10" fill="url(#sgG)"/>':s==='r'?'<circle cy="-7" r="10" fill="url(#sgR)"/>':''}</g>`;
}
function railBits(sp,tx,lay){
  const x=tx.x, {top,bot}=lay; let b0='', b1='', l='';
  // поїзд або трамвай наближається згори
  if(tx.train){
    const tram=tx.k==='tramx', len=tram?64:58;
    const unit=(dy,col,loco)=>`<rect x="-12" y="${dy-len}" width="24" height="${len-3}" rx="${tram?8:4}" fill="${col}" stroke="rgba(0,0,0,.35)"/><rect x="-8" y="${dy-len+5}" width="16" height="${len-13}" rx="3" fill="${tram?'#F5E9D8':'rgba(255,255,255,.18)'}"/>${loco?`<rect x="-9" y="${dy-9}" width="18" height="5" rx="2" fill="rgba(12,20,32,.8)"/>`:''}`;
    const body=tram?unit(0,C.tram,true):unit(0,'#B91C1C',true)+unit(-len,'#475569')+unit(-2*len,'#475569')+unit(-3*len,'#475569');
    b1+=`<g transform="translate(${x} ${top-10})"><g class="${RM?'':'sc-trainin'}">${body}</g></g>`;
    l+=`<g transform="translate(${x} ${top-10})"><g class="${RM?'':'sc-trainin'}"><circle cy="-2" r="16" fill="url(#sgW)"/></g></g>`;
  }
  // шлагбаум на твоєму боці: опора біля правого краю, стріла через твою смугу
  if(tx.bar){
    const px=x-26, py=bot+5, len=bot-lay.c-4;
    const arm=`<rect x="-3" y="${-len}" width="6" height="${len}" rx="2" fill="#fff" stroke="#9CA3AF" stroke-width="1"/>${Array.from({length:Math.floor(len/12)},(_,i)=>`<rect x="-3" y="${-len+3+i*12}" width="6" height="6" fill="#E5484D"/>`).join('')}`;
    const cls=tx.bar==='lowering'&&!RM?'class="sc-barrier"':'', rot=tx.bar==='up'?-82:0;
    b1+=`<g transform="translate(${px} ${py})"><g ${cls} transform="rotate(${tx.bar==='lowering'&&RM?0:rot})">${arm}</g><rect x="-6" y="-6" width="12" height="12" rx="3" fill="#374151"/></g>`;
  }
  // світлофор переїзду (вид спереду) біля правого узбіччя
  if(tx.lights&&tx.lights!=='none'){
    const sx=x-58, sy=178;
    const red=tx.lights==='red', moon=tx.lights==='moon';
    b1+=`<g transform="translate(${sx} ${sy}) scale(.72)"><rect x="-2" y="-58" width="4" height="58" fill="#4B5563"/>${[35,-35].map(a=>`<g transform="translate(0 -62) rotate(${a})"><rect x="-17" y="-3.5" width="34" height="7" rx="1.5" fill="#E5484D"/><rect x="-15.5" y="-2" width="31" height="4" fill="#fff"/></g>`).join('')}<rect x="-20" y="-50" width="40" height="17" rx="8.5" fill="#11171B"/><circle cx="-10" cy="-41.5" r="5.6" fill="#3A1514"/><circle cx="10" cy="-41.5" r="5.6" fill="#3A1514"/><rect x="-7" y="-31" width="14" height="13" rx="5" fill="#11171B"/><circle cy="-24.5" r="4.4" fill="#272C35"/></g>`;
    if(red) l+=`<g transform="translate(${sx} ${sy}) scale(.72)"><g class="sc-alt1"><circle cx="-10" cy="-41.5" r="16" fill="url(#sgR)"/><circle cx="-10" cy="-41.5" r="5.6" fill="#FF3B30"/></g><g class="sc-alt2"><circle cx="10" cy="-41.5" r="16" fill="url(#sgR)"/><circle cx="10" cy="-41.5" r="5.6" fill="#FF3B30"/></g></g>`;
    if(moon) l+=`<g transform="translate(${sx} ${sy}) scale(.72)"><g class="sc-blink"><circle cy="-24.5" r="14" fill="url(#sgW)"/><circle cy="-24.5" r="4.4" fill="#fff"/></g></g>`;
    if(tx.sound) l+=[0,1].map(i=>`<g class="${i?'sc-waves2':'sc-waves'}"><path d="M${sx+18} ${sy-44} q8 8 0 16M${sx+25} ${sy-49} q12 13 0 26" fill="none" stroke="#FFD45C" stroke-width="2.4" stroke-linecap="round"/></g>`).join('');
  }
  return {b0,b1,l};
}

/* ================= перехрестя згори ================= */
const X0=160, Y0=110, HW=40;
function rot(x,y,k){ let dx=x-X0, dy=y-Y0; for(let i=0;i<k;i++){ const t=dx; dx=-dy; dy=t; } return [X0+dx,Y0+dy]; }
function pathOf(segs,k){ return segs.map(s=>{ if(s[0]==='A'){ const p=rot(s[6],s[7],k); return `A${s[1]} ${s[2]} 0 0 ${s[5]} ${f1(p[0])} ${f1(p[1])}`; } let o=s[0]; for(let i=1;i<s.length;i+=2){ const p=rot(s[i],s[i+1],k); o+=` ${f1(p[0])} ${f1(p[1])}`; } return o; }).join(' '); }
// маршрут з півдня з бічним зсувом o від осі; ext — наскільки продовжити за перехрестя
function route(mv,o,start,ext){
  const x=X0+o;
  switch(mv){
    case 's': return [['M',x,Y0+start],['L',x,Y0-ext]];
    case 'r': { const R=HW-o; return [['M',x,Y0+start],['L',x,Y0+o+R],['Q',x,Y0+o,x+R,Y0+o],['L',X0+ext,Y0+o]]; }
    case 'l': { const R=HW+o; return [['M',x,Y0+start],['L',x,Y0-o+R],['Q',x,Y0-o,x-R,Y0-o],['L',X0-ext,Y0-o]]; }
    case 'u': return [['M',x,Y0+start],['L',x,Y0+4],['A',o,o,0,0,0,X0-o,Y0+4],['L',X0-o,Y0+ext]];
  }
}
const KOF={s:0,w:1,n:2,e:3};
function xing(sp){
  let base=`<rect width="320" height="220" style="fill:var(--verge)"/>`+tree(40,34,14)+tree(84,18,9)+tree(282,32,13)+tree(36,188,13)+tree(290,196,12);
  base+=`<rect x="${X0-HW-2}" y="0" width="${2*HW+4}" height="220" style="fill:var(--curb)"/><rect x="0" y="${Y0-HW-2}" width="320" height="${2*HW+4}" style="fill:var(--curb)"/>`;
  base+=`<rect x="${X0-HW}" y="0" width="${2*HW}" height="220" style="fill:var(--asphalt)"/><rect x="0" y="${Y0-HW}" width="320" height="${2*HW}" style="fill:var(--asphalt)"/>`;
  if(sp.round){
    base+=`<circle cx="${X0}" cy="${Y0}" r="80" style="fill:var(--curb)"/><circle cx="${X0}" cy="${Y0}" r="78" style="fill:var(--asphalt)"/><circle cx="${X0}" cy="${Y0}" r="34" style="fill:var(--verge);stroke:var(--curb)" stroke-width="3"/><circle cx="${X0}" cy="${Y0}" r="56" fill="none" style="stroke:var(--mark)" stroke-width="2" stroke-dasharray="10 12" opacity=".7"/>`;
    base+=`<g transform="translate(${X0} ${Y0})"><circle r="15" fill="#1D5DBF" stroke="#fff" stroke-width="2"/>${[0,120,240].map(a=>`<g transform="rotate(${a})"><path d="M-2 -9.5a9.5 9.5 0 0 1 9 3.5" fill="none" stroke="#fff" stroke-width="2.6"/><path d="M8.6 -9.2 8.2 -3.6 3.2 -6z" fill="#fff"/></g>`).join('')}</g>`;
  } else {
    const d='style="stroke:var(--mark)" stroke-width="2.4" stroke-dasharray="12 10"';
    base+=`<line x1="${X0}" y1="0" x2="${X0}" y2="${Y0-HW-4}" ${d}/><line x1="${X0}" y1="${Y0+HW+4}" x2="${X0}" y2="220" ${d}/><line x1="0" y1="${Y0}" x2="${X0-HW-4}" y2="${Y0}" ${d}/><line x1="${X0+HW+4}" y1="${Y0}" x2="320" y2="${Y0}" ${d}/>`;
  }
  if(sp.box){ let g=''; for(let i=-80;i<=80;i+=16) g+=`<path d="M${X0-HW+i} ${Y0-HW}l${2*HW} ${2*HW}M${X0+HW-i} ${Y0-HW}l${-2*HW} ${2*HW}"/>`; base+=`<defs><clipPath id="scBox"><rect x="${X0-HW}" y="${Y0-HW}" width="${2*HW}" height="${2*HW}"/></clipPath></defs><rect x="${X0-HW+2}" y="${Y0-HW+2}" width="${2*HW-4}" height="${2*HW-4}" fill="none" stroke="#FACC15" stroke-width="3"/><g clip-path="url(#scBox)" stroke="#FACC15" stroke-width="2.2">${g}</g>`; }
  if(sp.main){ for(let k=0;k<4;k++){ const p=rot(X0+HW+16,Y0+HW+18,k), main=sp.main.includes('swne'[k]);
    base+=main?`<g transform="translate(${p[0]} ${p[1]})"><polygon points="0,-12 12,0 0,12 -12,0" fill="#fff" stroke="#2A2A2A" stroke-width="1"/><polygon points="0,-7 7,0 0,7 -7,0" fill="#FACC15"/></g>`:`<g transform="translate(${p[0]} ${p[1]})"><polygon points="0,10 -12,-10 12,-10" fill="#fff" stroke="#D7262E" stroke-width="3.2" stroke-linejoin="round"/></g>`; } }
  if(sp.light) base+=trafficIcon(X0+HW+16,Y0+HW+24,sp.light);
  let rails='', arrows='', bodies='', lights='', tags='';
  if(sp.jam) [[X0+20,46],[X0+20,2]].forEach(([x,y])=>{ const v=veh({k:'car',x,y,rot:-90,c:C.gray,brake:1}); bodies+=v.b; lights+=v.l; });
  (sp.a||[]).forEach(a=>{
    const k=KOF[a.from||'s'], tram=a.k==='tram', o=a.o!=null?a.o:tram?7:20, col=a.k==='me'?'me':tram?'tram':(a.c||'blue');
    const dist=tram?100:90;
    if(a.at){ // стоїть усередині перехрестя
      const v=veh({k:'me',x:a.at[0],y:a.at[1],rot:-90,label:'Ти',blink:a.blink});
      bodies+=v.b; lights+=v.l; tags+=v.t;
      if(a.arrow) arrows+=arrowPath(a.arrow,'me');
      return;
    }
    if(tram) rails+=`<path d="${pathOf(route(a.mv,o,140,200),k)}" fill="none" stroke="#8B949C" stroke-width="14" stroke-linejoin="round"/><path d="${pathOf(route(a.mv,o,140,200),k)}" fill="none" style="stroke:var(--asphalt)" stroke-width="9.4" stroke-linejoin="round"/>`;
    if(!sp.round||a.k==='me') arrows+=arrowPath(sp.round&&a.k==='me'?a.path:pathOf(route(a.mv,o,dist-24,62),k),col);
    const p=rot(X0+o,Y0+dist,k);
    const v=veh({k:a.k==='me'?'me':tram?'tram':'car',x:p[0],y:p[1],rot:-90+90*k,c:a.k==='me'?null:C[a.c||'blue'],label:a.k==='me'?'Ти':null,blink:a.mv==='l'||a.mv==='u'?'l':a.mv==='r'?'r':null});
    bodies+=v.b; lights+=v.l; tags+=v.t;
  });
  if(sp.round&&sp.ring){ // авто, що вже їде по колу (проти годинникової стрілки)
    const v=veh({k:'car',x:0,y:0,rot:60,c:C.blue});
    bodies+=`<g transform="translate(${X0} ${Y0})"><g class="${RM?'':'sc-orbit'}" style="animation-delay:-1s"><g transform="translate(-48.5 28)">${v.b}</g></g></g>`;
    if(RM) arrows+=`<path d="M${X0-56} ${Y0} A56 56 0 0 0 ${f1(X0-28)} ${f1(Y0+48.5)}" fill="none" stroke="${C.blue}" stroke-width="4" stroke-dasharray="7 6" marker-end="url(#sm-blue)" class="sc-flow" opacity=".8"/>`;
  }
  return svg('0 0 320 220',base+rails+arrows+bodies+lights+tags,sp.alt||'Схема перехрестя з питання');
}

/* ================= питання → сцени ================= */
const R1=LAY['1'].ln, R2=LAY['2'].ln;
const me=(x,extra)=>Object.assign({k:'me',x,drive:1},extra||{});
const rail=(extra,actors)=>({t:'road',cross:Object.assign({k:'rail',x:200},extra),a:actors||[me(110)]});
const zebra=(extra,actors,more)=>Object.assign({t:'road',urban:1,cross:Object.assign({k:'zebra',x:210},extra),a:actors},more||{});
const tow=(o)=>{ o=o||{}; const a=[{k:'car',x:196,c:C.blue,label:o.front?'Ти':null},{k:'car',x:132,c:C.gray,label:o.back?'Ти':null}];
  return {t:'road',ice:o.ice,a,extra:'<g class="sc-tow"><path d="M153 109 C160 114 168 114 176 109" fill="none" stroke="#F97316" stroke-width="2.4"/></g>'}; };
const night=(extra)=>Object.assign({t:'road',night:1},extra);
const SCENES={
  /* світлофори */
  g1:{t:'tl',y:1}, g2:{t:'tl',y:2}, g3:{t:'tl',g:2}, g4:{t:'tl',r:1,ar:1}, g20:{t:'tl',g:1,gA:'r'}, g22:{t:'tl',g:1,ar:1},
  g24:{t:'tl',g:1,gc:1}, g26:{t:'tl',r:2}, g27:{t:'tl',r:1,plate:'r'}, g28:{t:'tl',r:1,plate:'l'}, g29:{t:'tl',r:1,y:1},
  g30:{t:'tl',r:1,rc:'s'}, g31:{t:'tl',r:1,ar:-1}, g54:{t:'tl',y:1}, r39:{t:'tl',v:'single'}, g25:{t:'tl',v:'twoy'},
  g39:{t:'tl',v:'ped'}, g32:{t:'tl',v:'lane',lane:'x'}, g33:{t:'tl',v:'lane',lane:'dr'}, g34:{t:'tl',v:'lane',lane:'off'},
  g36:{t:'tl',v:'tram',lit:[0,1,2]}, g37:{t:'tl',v:'tram',lit:[2,3]}, g38:{t:'tl',v:'rail',rail:'moon'}, r5:{t:'tl',v:'rail',rail:'red'},
  /* залізничні переїзди */
  r4:rail({lights:'red'}), r47:rail({bar:'up',lights:'off'}), r48:rail({train:1}), r56:rail({train:1}),
  r49:rail({bar:'down'}), r53:rail({bar:'lowering',lights:'red'},[me(140)]), r54:rail({bar:'up',lights:'red',sound:1}),
  r55:rail({lights:'off'},[me(120),{k:'car',x:250,c:C.gray,brake:1},{k:'car',x:298,c:C.blue,brake:1}]),
  r58:rail({bar:'down',lights:'red'},[me(54),{k:'car',x:104,c:C.gray,brake:1},{k:'car',x:150,c:C.blue,brake:1}]),
  r59:rail({lights:'off'},[me(200,{drive:0,blink:'h'})]), r62:rail({lights:'red',train:1},[me(200,{drive:0,blink:'h'})]),
  c67:{t:'road',urban:1,cross:{k:'tramx',x:210,train:1},a:[me(120)]},
  /* пішоходи, зупинки */
  r1:zebra({},[me(100),{k:'ped',x:206,y:142,walk:-60}]),
  r2:{t:'road',a:[me(90),{k:'ped',x:220,y:132,cane:1,walk:-70}]},
  r3:{t:'road',urban:1,a:[me(60),{k:'kidsbus',x:220,blink:'h'},{k:'ped',x:190,y:136,kid:1,c:'#EC4899'},{k:'ped',x:204,y:140,kid:1,c:'#0EA5E9'}]},
  r40:zebra({},[me(166,{drive:0}),{k:'ped',x:206,y:90,walk:-44},{k:'ped',x:214,y:110,walk:-44,delay:-1.5,c:'#0EA5E9'}],{light:{x:188,s:'g'}}),
  r41:zebra({island:1},[me(70),{k:'ped',x:204,y:86,c:'#0EA5E9'},{k:'ped',x:217,y:93}]),
  r42:zebra({},[me(80,{ln:'r'}),{k:'car',x:170,ln:'l',c:C.blue,brake:1}],{lay:'2'}),
  r43:zebra({},[me(110),{k:'car',x:250,c:C.gray,brake:1},{k:'car',x:298,c:C.blue,brake:1}]),
  r45:{t:'road',lay:'tram',urban:1,a:[me(60),{k:'tram',x:220,ln:'tr'},{k:'ped',x:206,y:162,walk:-46},{k:'ped',x:226,y:118,walk:-44,rot:180,c:'#0EA5E9'}]},
  r46:{t:'road',lay:'tram',urban:1,a:[me(80,{drive:0}),{k:'tram',x:220,ln:'tr'},{k:'ped',x:214,y:162,walk:-46}]},
  r34:{t:'road',lay:'tram',urban:1,a:[{k:'tram',x:180,ln:'tr'},{k:'ped',x:176,y:118,walk:-44,rot:180,c:'#0EA5E9'}]},
  c69:{t:'road',urban:1,edge:'zigzag',a:[me(80),{k:'bus',x:214,y:118,rot:-8,blink:'l'}]},
  /* спецтранспорт */
  r6:{t:'road',a:[me(200),{k:'amb',x:70,beacon:'b',siren:1}]},
  r20:{t:'road',a:[me(200),{k:'amb',x:70,beacon:'b'}]},
  g51:{t:'road',a:[me(200),{k:'police',x:80,beacon:'br',speaker:1}]},
  r10:{t:'road',a:[me(90),{k:'police',x:230,ln:'o',beacon:'br',pass:1}]},
  r11:{t:'road',center:'median',lay:'2',a:[me(90),{k:'police',x:230,ln:'o',beacon:'br',pass:1}]},
  r17:{t:'road',shoulder:1,a:[me(80),{k:'amb',x:230,y:136,beacon:'b'}]},
  r7:{t:'road',a:[me(70),{k:'service',x:236,beacon:'o'},{k:'cone',x:190,y:102},{k:'cone',x:180,y:116}]},
  r19:{t:'road',a:[me(70),{k:'service',x:236,beacon:'o'},{k:'cone',x:190,y:102},{k:'cone',x:180,y:116}]},
  /* буксирування */
  l5:tow(), l6:tow({ice:1}), l7:tow(), l23:tow({front:1}), l28:tow({back:1}), l44:tow(), l45:tow(), l46:tow(), l50:tow(), l52:tow(),
  /* світло, ніч, туман */
  l2:night({a:[me(70,{beam:'high'}),{k:'car',x:260,ln:'o',beam:'low',pass:1}]}),
  l3:night({a:[me(90,{beam:'low'}),{k:'car',x:240,ln:'o',glare:1}]}),
  l34:night({a:[me(100,{drive:0,blink:'h',y:116}),{k:'car',x:250,ln:'o',glare:1}]}),
  l33:night({a:[me(70,{beam:'high'}),{k:'car',x:230,c:C.blue}]}),
  f51:night({fog:1,a:[me(90,{beam:'high'})]}),
  f52:night({a:[me(90,{beam:'low'}),{k:'car',x:240,ln:'o',glare:1}]}),
  l22:{t:'road',fog:1,a:[me(110)]}, l31:{t:'road',fog:1,a:[me(110)]}, p11:{t:'road',fog:1,a:[me(110)]}, v34:{t:'road',fog:1,a:[me(150)]},
  l32:night({fog:1,a:[me(110,{beam:'low'})]}),
  p59:{t:'road',fog:1,a:[me(80),{k:'truck',x:200}]},
  /* розмітка */
  m1:{t:'road',center:'1.1',a:[me(70),{k:'car',x:210,c:C.blue,tag:'60 км/год'}]},
  m2:{t:'road',center:'1.11s',a:[me(110)]}, m3:{t:'road',lay:'2',center:'1.3',a:[me(110,{ln:'l'})]},
  m4:{t:'road',cross:{k:'stop',x:230},a:[me(120)]}, m6:{t:'road',center:'1.5',a:[me(110)]},
  m7:{t:'road',urban:1,edge:'1.4',a:[me(110)]}, m8:{t:'road',urban:1,edge:'1.10',a:[me(110)]}, m10:{t:'road',urban:1,edge:'blue',a:[me(150)]},
  m12:zebra({k:'zebra-rw'},[me(100)]), m16:{t:'road',urban:1,edge:'zigzag',a:[me(70)]},
  m18:{t:'road',center:'1.1',a:[me(80),{k:'truck',x:220,blink:'h'}]},
  m19:{t:'road',center:'1.1',a:[me(80),{k:'tractor',x:210}]},
  m20:{t:'road',center:'1.1',a:[me(44),{k:'truck',x:130},{k:'truck',x:198},{k:'truck',x:266,tag:'20 км/год'}]},
  m21:{t:'road',edge:'1.2',a:[me(110)]}, m23:{t:'road',center:'1.6',a:[me(110)]},
  m25:{t:'road',lay:'2',center:'1.1',between:'1.8',a:[me(110)]}, m27:{t:'road',center:'1.9',a:[me(110)]},
  m29:{t:'road',center:'1.11s',a:[{k:'car',x:120,c:C.blue},me(210,{ln:'o',rot:0,drive:0,blink:'r'})],arrows:[{d:'M232 71 C256 71 262 109 292 109'}]},
  m30:{t:'road',cross:{k:'teeth',x:226},a:[me(120)]}, m31:{t:'road',cross:{k:'STOP',x:220},a:[me(110)]},
  m40:{t:'road',cross:{k:'yellow',x:176},a:[me(100)]},
  /* обгін і маневри */
  p7:{t:'road',a:[me(190),{k:'car',x:96,c:C.blue,blink:'l'}],arrows:[{d:'M118 109 C140 109 146 71 172 71 L262 71',c:'blue'}]},
  p47:{t:'road',a:[me(110,{blink:'l'}),{k:'truck',x:220},{k:'car',x:120,ln:'o',rot:0,c:C.blue}],arrows:[{d:'M142 71 L222 71',c:'blue'}]},
  p48:{t:'road',a:[me(90),{k:'car',x:200,c:C.blue,blink:'l'}]},
  p52:{t:'road',a:[{k:'car',x:120,c:C.blue},{k:'car',x:180,c:C.gray},me(70,{drive:0,blink:'l'})],arrows:[{d:'M92 109 C112 109 118 71 140 71 L250 71'}]},
  p55:{t:'road',cross:{k:'zebra',x:282},a:[me(70),{k:'car',x:170,c:C.blue}]},
  p57:{t:'road',bridge:1,a:[me(80),{k:'truck',x:210}]},
  p60:{t:'road',a:[me(70),{k:'truck',x:220},{k:'car',x:200,ln:'o',rot:0,c:C.blue,blink:'r'}]},
  p63:{t:'road',lay:'2',center:'1.3',a:[{k:'truck',x:200,ln:'r'},me(140,{ln:'l'})]},
  v40:{t:'road',a:[{k:'cone',x:176,y:100},{k:'cone',x:188,y:114},{k:'cone',x:200,y:104},me(110,{drive:0,blink:'l'}),{k:'car',x:280,ln:'o',c:C.blue,pass:1}],arrows:[{d:'M132 109 C150 109 152 74 176 74 L208 74'}]},
  v41:{t:'road',lay:'2',center:'1.3',a:[me(110,{ln:'l',drive:0}),{k:'car',x:170,ln:'l',c:C.gray,brake:1},{k:'car',x:230,ln:'l',c:C.blue,brake:1},{k:'truck',x:150,ln:'r',brake:1},{k:'car',x:226,ln:'r',c:C.green,brake:1}]},
  v20:{t:'road',lay:'tram',urban:1,a:[me(190,{blink:'l',drive:0}),{k:'tram',x:70,ln:'tr'}],arrows:[{d:'M212 132 C236 132 240 104 252 88 L262 60'}]},
  /* перехрестя */
  c1:{t:'x',a:[{k:'me',mv:'s'},{k:'car',from:'e',mv:'s',c:'blue'},{k:'car',from:'w',mv:'s',c:'red'}]},
  c6:{t:'x',light:'g',jam:1,a:[{k:'me',mv:'s'}]},
  c19:{t:'x',main:'sn',jam:1,a:[{k:'me',mv:'s'}]},
  c23:{t:'x',a:[{k:'me',mv:'s'},{k:'tram',from:'n',mv:'l'}]},
  c24:{t:'x',light:'g',a:[{k:'me',mv:'u'},{k:'car',from:'n',mv:'r',c:'blue'}]},
  c25:{t:'x',light:'g',a:[{k:'me',mv:'l',o:28},{k:'tram',mv:'s',o:4}]},
  c26:{t:'x',light:'g',a:[{k:'me',mv:'s'},{k:'car',from:'n',mv:'l',c:'blue'}]},
  c27:{t:'x',light:'g',a:[{k:'tram',mv:'l'},{k:'tram',from:'n',mv:'s'}]},
  c28:{t:'x',light:'g',a:[{k:'me',mv:'s',o:28},{k:'tram',mv:'r',o:4}]},
  c43:{t:'x',main:'sn',a:[{k:'me',mv:'s'},{k:'tram',from:'e',mv:'s'}]},
  c45:{t:'x',a:[{k:'me',mv:'s'},{k:'tram',from:'e',mv:'s'},{k:'car',from:'w',mv:'s',c:'red'}]},
  c46:{t:'x',a:[{k:'tram',mv:'s'},{k:'tram',from:'e',mv:'s'}]},
  c47:{t:'x',round:1,ring:1,a:[{k:'me',mv:'s',path:'M180 178 L180 170 Q180 160 191 155 A56 56 0 0 0 208.5 82'}]},
  c52:{t:'x',a:[{k:'me',mv:'l',o:28},{k:'tram',mv:'s',o:4}]},
  c53:{t:'x',a:[{k:'me',mv:'l'},{k:'car',from:'n',mv:'r',c:'blue'}]},
  c32:{t:'x',light:'r',a:[{k:'me',at:[176,120],blink:'l',arrow:'M176 97 Q176 90 166 90 L102 90'},{k:'car',from:'n',mv:'s',c:'blue'}]},
  m13:{t:'x',box:1,jam:1,a:[{k:'me',mv:'s'}]}
};
function html(id){
  const sp=SCENES[id]; if(!sp) return '';
  let s=sp.t==='tl'?tl(sp):sp.t==='x'?xing(sp):road(sp);
  if(sp.extra) s=s.replace('</svg>',sp.extra+'</svg>');
  return `<div class="stage scene">${s}</div>`;
}
return {html,SCENES};
})();
function sceneHtml(id){ return SCN.html(id); }
