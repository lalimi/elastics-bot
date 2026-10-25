'use strict';
/* ---------- Telegram Mini App: тонка обгортка над Telegram.WebApp ----------
   Поза Telegram telegram-web-app.js теж створює Telegram.WebApp (версія 6.0, порожній initData),
   тож «ми в Telegram» визначаємо за непорожнім initData, а кожен метод — ще й за версією. */
const TG=(()=>{
  const W=window.Telegram&&window.Telegram.WebApp;
  const inTg=!!(W&&W.initData);
  const ver=v=>{try{return inTg&&W.isVersionAtLeast(v);}catch(e){return false;}};
  const safe=fn=>{try{return fn();}catch(e){return undefined;}};
  let backFn=null, backBound=false;

  function cloudCall(method,...args){
    return new Promise((resolve,reject)=>{
      try{ W.CloudStorage[method](...args,(err,res)=>err?reject(err):resolve(res)); }catch(e){ reject(e); }
    });
  }

  return {
    inTg,
    initData: inTg?W.initData:'',
    firstName: inTg?safe(()=>String(W.initDataUnsafe.user.first_name||'').trim())||'':'',
    ready(){ if(!inTg) return; safe(()=>W.ready()); safe(()=>W.expand()); },
    on(ev,fn){ if(inTg) safe(()=>W.onEvent(ev,fn)); },

    // kind: 'success' | 'error' | 'light'. Повертає false, якщо Haptic недоступний (тоді працює запасний варіант).
    haptic(kind){
      if(!ver('6.1')||!W.HapticFeedback) return false;
      safe(()=>kind==='light'?W.HapticFeedback.impactOccurred('light'):W.HapticFeedback.notificationOccurred(kind));
      return true;
    },

    // fn — що робить «назад»; null ховає кнопку
    back(fn){
      if(!ver('6.1')||!W.BackButton) return;
      backFn=fn;
      if(!backBound){ backBound=true; safe(()=>W.BackButton.onClick(()=>{ if(backFn) backFn(); })); }
      safe(()=>fn?W.BackButton.show():W.BackButton.hide());
    },
    closingConfirm(on){
      if(!ver('6.2')) return;
      safe(()=>on?W.enableClosingConfirmation():W.disableClosingConfirmation());
    },
    verticalSwipes(on){
      if(!ver('7.7')) return;
      safe(()=>on?W.enableVerticalSwipes():W.disableVerticalSwipes());
    },

    // Тема: data-theme на <html> за colorScheme, кольори хедера/фону = --bg сторінки
    applyTheme(){
      if(!inTg) return;
      const root=document.documentElement;
      root.dataset.theme=W.colorScheme==='dark'?'dark':'light';
      const bg=getComputedStyle(root).getPropertyValue('--bg').trim();
      if(!/^#[0-9a-f]{6}$/i.test(bg)) return;
      if(ver('6.9')) safe(()=>W.setHeaderColor(bg));
      if(ver('6.1')) safe(()=>W.setBackgroundColor(bg));
      if(ver('7.10')) safe(()=>W.setBottomBarColor(bg));
    },

    // CloudStorage з промісами; null, якщо недоступно
    cloud: (inTg&&ver('6.9')&&W.CloudStorage)?{
      getItem:k=>cloudCall('getItem',k),
      getItems:ks=>cloudCall('getItems',ks),
      setItem:(k,v)=>cloudCall('setItem',k,v),
      removeItems:ks=>cloudCall('removeItems',ks)
    }:null
  };
})();
