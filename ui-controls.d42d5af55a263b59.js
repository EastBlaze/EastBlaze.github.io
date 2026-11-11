(() => {
  const ICONS = {"moon": "<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M20.2 14.1A8.6 8.6 0 0 1 9.9 3.8a8.6 8.6 0 1 0 10.3 10.3Z\"/></svg>", "sun": "<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><circle cx=\"12\" cy=\"12\" r=\"3.8\"/><path d=\"M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4\"/></svg>"};
  const root=document.documentElement, theme=document.querySelector('.theme-toggle');
  const dark=matchMedia('(prefers-color-scheme: dark)');
  const feedback=document.querySelector('#ui-feedback'), tooltip=document.querySelector('#control-tooltip');
  let explicitTheme=null, toastTimer, hideTimer, currentTip=null, suppressed=null;
  const say=message=>{clearTimeout(toastTimer);feedback.textContent=message;toastTimer=setTimeout(()=>feedback.textContent='',2600);};
  const removeTipDescription=el=>{const ids=(el.getAttribute('aria-describedby')||'').split(' ').filter(x=>x&&x!=='control-tooltip');if(ids.length)el.setAttribute('aria-describedby',ids.join(' '));else el.removeAttribute('aria-describedby');};
  const hideTip=()=>{clearTimeout(hideTimer);tooltip.hidden=true;if(currentTip)removeTipDescription(currentTip);currentTip=null;};
  const hideUntriggeredTip=()=>{if(currentTip&&(currentTip.matches(':focus-visible')||currentTip.matches(':hover')||tooltip.matches(':hover')))return;hideTip();};
  const showTip=el=>{
    clearTimeout(hideTimer);if(suppressed===el)return;if(currentTip&&currentTip!==el)removeTipDescription(currentTip);
    currentTip=el;tooltip.textContent=el.dataset.tip;tooltip.hidden=false;
    const ids=new Set((el.getAttribute('aria-describedby')||'').split(' ').filter(Boolean));ids.add('control-tooltip');el.setAttribute('aria-describedby',[...ids].join(' '));
    const r=el.getBoundingClientRect(),t=tooltip.getBoundingClientRect();
    tooltip.style.left=Math.max(8,Math.min(innerWidth-t.width-8,r.left+(r.width-t.width)/2))+'px';
    tooltip.style.top=(r.bottom+t.height+10<innerHeight?r.bottom+6:Math.max(8,r.top-t.height-6))+'px';
  };
  const setTip=(el,text)=>{el.dataset.tip=text;if(currentTip===el)showTip(el);};
  const applyTheme=()=>{
    const current=explicitTheme||(dark.matches?'dark':'light');root.dataset.theme=current;
    theme.innerHTML='<span class="control-mark">'+(current==='dark'?ICONS.sun:ICONS.moon)+'</span>';theme.setAttribute('aria-label',(current==='dark'?'라이트':'다크')+' 모드로 전환');theme.setAttribute('aria-describedby','theme-state');theme.disabled=false;
    document.querySelector('#theme-state').textContent='현재 '+(current==='dark'?'다크':'라이트')+' 모드입니다.';setTip(theme,theme.getAttribute('aria-label'));
  };
  theme.addEventListener('click',()=>{explicitTheme=root.dataset.theme==='dark'?'light':'dark';applyTheme();say((explicitTheme==='dark'?'다크':'라이트')+' 모드로 전환했습니다.');});
  dark.addEventListener('change',applyTheme);applyTheme();
  document.querySelectorAll('[data-tip]').forEach(el=>{
    el.removeAttribute('title');
    el.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')showTip(el);});
    el.addEventListener('pointerleave',()=>{suppressed=null;hideTimer=setTimeout(hideUntriggeredTip,140);});
    el.addEventListener('focus',()=>{if(el.matches(':focus-visible'))showTip(el);});
    el.addEventListener('blur',()=>{suppressed=null;hideTimer=setTimeout(hideUntriggeredTip,140);});
  });
  tooltip.addEventListener('pointerenter',()=>clearTimeout(hideTimer));tooltip.addEventListener('pointerleave',()=>{hideTimer=setTimeout(hideUntriggeredTip,140);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!tooltip.hidden){suppressed=currentTip;hideTip();}});
  window.addEventListener('scroll',hideTip,{passive:true});window.addEventListener('resize',hideTip);
})();
