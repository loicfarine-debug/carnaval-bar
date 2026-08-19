const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const cats = [['softs','Softs'],['bieres','Bières'],['alcools','Alcools'],['shots','Shots'],['vins','Vins']];
let products = structuredClone(window.DEFAULT_PRODUCTS), cat='softs', items=[], returns={glass:0,large:0}, pending=null, actions=[];
const tapBursts=new Map();
const mixerList=()=>products.filter(p=>p.cat==='softs').map(p=>p.name).concat('Sans soft');
function money(n){const v=Math.round((Number(n)||0)*100)/100;return (Number.isInteger(v)?String(v):v.toFixed(2).replace(/0+$/,'').replace(/\.$/,''))+' CHF'}
function total(){return items.reduce((s,x)=>s+x.price+x.deposit,0)-returns.glass*2-returns.large*10}
function qty(id){return items.filter(x=>x.id===id).length}
function groupItems(){
 const g={};
 items.forEach(x=>{const k=x.id+'|'+(x.soft||'');if(!g[k])g[k]={...x,n:0};g[k].n++});
 const catOrder=Object.fromEntries(cats.map((c,i)=>[c[0],i]));
 return Object.entries(g).map(([key,val])=>({key,...val})).sort((a,b)=>{
   const ca=(catOrder[a.cat]??999)-(catOrder[b.cat]??999);if(ca)return ca;
   const na=a.name.localeCompare(b.name,'fr',{sensitivity:'base'});if(na)return na;
   return (a.soft||'').localeCompare(b.soft||'','fr',{sensitivity:'base'});
 });
}
function toastMsg(t,ms=900){const el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove('show'),ms)}
function snapshot(){return {items:structuredClone(items),returns:{...returns}}}
function remember(){actions.push(snapshot());if(actions.length>30)actions.shift()}
function undo(){if(!actions.length){toastMsg('Rien à annuler');return}const s=actions.pop();items=s.items;returns=s.returns;render();toastMsg('Dernière action annulée ↩')}

function burstFeedback(p,soft=''){
 const key=p.id+'|'+(soft||''),now=Date.now(),prev=tapBursts.get(key);
 const state=prev&&now-prev.last<480?prev:{count:0,last:0,timer:null};
 state.count++;state.last=now;clearTimeout(state.timer);
 tapBursts.set(key,state);
 const b=document.querySelector(`[data-id="${p.id}"]`);
 if(b){
   const plus=b.querySelector('.tap-plus');
   if(plus)plus.textContent='+'+state.count;
   b.classList.remove('just-added');void b.offsetWidth;b.classList.add('just-added');
 }
 const label=p.name+(soft?' · '+soft:'');
 toastMsg('+'+state.count+' '+label,520);
 state.timer=setTimeout(()=>tapBursts.delete(key),500);
}
function updateSummary(){
 $('#count').textContent=`${items.length} article${items.length!==1?'s':''}`;
 $('#total').textContent=money(total());
 $('#retGlassQty').textContent=returns.glass?`×${returns.glass}`:'';
 $('#retLargeQty').textContent=returns.large?`×${returns.large}`:'';
}
function updateProductQty(id){
 const b=document.querySelector(`[data-id="${id}"]`);if(!b)return;
 let q=b.querySelector('.qty'),n=qty(id);
 if(n){
   if(!q){q=document.createElement('span');q.className='qty';b.appendChild(q)}
   q.textContent='×'+n;
 }else if(q)q.remove();
}

function render(){
 $('#tabs').innerHTML=cats.map(c=>`<button class="${c[0]===cat?'active':''}" data-cat="${c[0]}">${c[1]}</button>`).join('');
 $('#grid').innerHTML=products.filter(p=>p.cat===cat).sort((a,b)=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'})).map(p=>`<button class="product" data-cat="${p.cat}" data-id="${p.id}"><b>${p.name}</b><div class="price-row"><span class="price">${money(p.price)}</span>${p.deposit?`<span class="deposit-badge">+${money(p.deposit)}</span>`:''}</div>${p.note?`<small>${p.note}</small>`:''}${qty(p.id)?`<span class="qty">×${qty(p.id)}</span>`:''}<span class="tap-plus">+1</span></button>`).join('');
 $('#count').textContent=`${items.length} article${items.length!==1?'s':''}`;$('#total').textContent=money(total());$('#retGlassQty').textContent=returns.glass?`×${returns.glass}`:'';$('#retLargeQty').textContent=returns.large?`×${returns.large}`:'';
}
$('#tabs').onclick=e=>{const b=e.target.closest('button');if(b){cat=b.dataset.cat;render()}};
$('#grid').onclick=e=>{const b=e.target.closest('.product');if(!b)return;const p=products.find(x=>x.id===b.dataset.id);if(!p)return;if(p.soft){pending=p;$('#softTitle').textContent=p.name+' · quel soft ?';$('#softs').innerHTML=mixerList().map(s=>`<button data-soft="${s}">${s}</button>`).join('');$('#softDlg').showModal()}else addItem(p,b)};
$('#softs').onclick=e=>{const b=e.target.closest('button');if(!b)return;addItem(pending,null,b.dataset.soft);$('#softDlg').close()};
function addItem(p,button=null,soft=''){remember();items.push({...p,soft});updateSummary();updateProductQty(p.id);burstFeedback(p,soft)}
$$('[data-ret]').forEach(b=>b.onclick=()=>{remember();returns[b.dataset.ret]++;render();toastMsg(b.dataset.ret==='glass'?'−2 CHF · verre rendu':'−10 CHF · consigne rendue',650)});
$('#undoBtn').onclick=undo;
function cartRender(){
 const groups=groupItems();let lastCat='';
 let html=groups.map(x=>{
   const catLabel=cats.find(c=>c[0]===x.cat)?.[1]||x.cat;
   const catHead=x.cat!==lastCat?`<div class="prep-cat-title">${catLabel.toUpperCase()}</div>`:'';
   lastCat=x.cat;
   const fullName=x.soft?`${x.name} <span class="prep-soft">→ ${x.soft}</span>`:x.name;
   return `${catHead}<div class="prep-line" data-key="${encodeURIComponent(x.key)}"><div class="prep-qty">×${x.n}</div><div class="prep-name"><b>${fullName}</b></div><div class="line-actions"><button data-act="minus">−</button><button data-act="plus">+</button><button class="trash" data-act="trash">×</button></div></div>`;
 }).join('');
 if(returns.glass||returns.large)html+=`<div class="prep-return-title">↩ RETOURS CONSIGNES</div>`;
 if(returns.glass)html+=returnLine('glass','Verres',returns.glass);if(returns.large)html+=returnLine('large','Plateau · arrosoir · pichet',returns.large);
 if(!groups.length&&!returns.glass&&!returns.large)html='<p class="muted">Commande vide.</p>';$('#lines').innerHTML=html;
}
function returnLine(type,label,n){return `<div class="prep-line prep-return" data-return="${type}"><div class="prep-qty">×${n}</div><div class="prep-name"><b>${label}</b></div><div class="line-actions"><button data-retact="minus">−</button><button data-retact="plus">+</button><button class="trash" data-retact="trash">×</button></div></div>`}
$('#cart').onclick=()=>{cartRender();$('#cartDlg').showModal()};
$('#lines').onclick=e=>{const rb=e.target.closest('button[data-retact]');if(rb){remember();const type=rb.closest('[data-return]').dataset.return;if(rb.dataset.retact==='plus')returns[type]++;if(rb.dataset.retact==='minus')returns[type]=Math.max(0,returns[type]-1);if(rb.dataset.retact==='trash')returns[type]=0;render();cartRender();return}const btn=e.target.closest('button[data-act]');if(!btn)return;const key=decodeURIComponent(btn.closest('[data-key]').dataset.key),g=groupItems().find(x=>x.key===key);if(!g)return;remember();if(btn.dataset.act==='plus'){const p=products.find(x=>x.id===g.id);items.push({...p,soft:g.soft||''})}if(btn.dataset.act==='minus'){const idx=items.findLastIndex(x=>x.id===g.id&&(x.soft||'')===(g.soft||''));if(idx>=0)items.splice(idx,1)}if(btn.dataset.act==='trash')items=items.filter(x=>!(x.id===g.id&&(x.soft||'')===(g.soft||'')));render();cartRender()};
$('#pay').onclick=()=>{$('#payTotal').innerHTML=`<span>À ENCAISSER</span><b>${money(total())}</b>`;$('#cashBox').hidden=true;$('#twintBox').hidden=true;$('#given').value='';$('#change').textContent='';$('#payDlg').showModal()};
$('#cash').onclick=()=>{$('#cashBox').hidden=false;$('#twintBox').hidden=true;setTimeout(()=>$('#given').focus(),80)};
$('#twint').onclick=()=>{$('#cashBox').hidden=true;$('#twintBox').hidden=false};
$$('[data-given]').forEach(b=>b.onclick=()=>{const cur=parseFloat(($('#given').value||'').replace(',','.'))||0;$('#given').value=cur+Number(b.dataset.given);calcChange()});
function calcChange(){const g=parseFloat($('#given').value.replace(',','.'));$('#change').textContent=isNaN(g)?'':g>=total()?`À RENDRE : ${money(g-total())}`:`IL MANQUE : ${money(total()-g)}`}
$('#given').oninput=calcChange;
function orders(){return JSON.parse(localStorage.getItem('cg_orders_v3')||'[]')}
function finish(type){if(!items.length&&!returns.glass&&!returns.large){toastMsg('Commande vide');return}const os=orders(),order={date:new Date().toISOString(),type,total:total(),items:items.map(x=>({id:x.id,name:x.name,cat:x.cat,soft:x.soft||'',price:x.price,deposit:x.deposit})),returns:{...returns}};os.push(order);localStorage.setItem('cg_orders_v3',JSON.stringify(os));items=[];returns={glass:0,large:0};actions=[];$('#payDlg').close();render();$('#successText').textContent=`${money(order.total)} · ${type}`;$('#successDlg').showModal();setTimeout(()=>{if($('#successDlg').open)$('#successDlg').close()},1200)}
$('#confirmCash').onclick=()=>finish('CASH');$('#confirmTwint').onclick=()=>finish('TWINT');
$$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());
function renderHistory(){const all=orders(),os=all.slice().reverse().slice(0,20);$('#historyList').innerHTML=os.length?os.map((o,i)=>{const d=new Date(o.date),time=d.toLocaleString('fr-CH',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});return `<button class="history-card" data-order-index="${all.length-1-i}"><span><b>${time}</b><small>${o.type} · ${o.items.length} article(s)</small></span><strong>${money(o.total)}</strong></button>`}).join(''):'<p class="muted">Aucune commande enregistrée.</p>'}
$('#historyBtn').onclick=()=>{renderHistory();$('#historyDlg').showModal()};
$('#historyList').onclick=e=>{const b=e.target.closest('[data-order-index]');if(!b)return;const o=orders()[Number(b.dataset.orderIndex)];if(!o)return;const lines={};o.items.forEach(i=>{const k=i.name+'|'+(i.soft||'');if(!lines[k])lines[k]={...i,n:0};lines[k].n++});let html=`<div class="order-meta"><b>${new Date(o.date).toLocaleString('fr-CH')}</b><span>${o.type} · ${money(o.total)}</span></div>`;html+=Object.values(lines).map(i=>`<div class="detail-row"><span>${i.n}× ${i.name}${i.soft?' → '+i.soft:''}</span><b>${money(i.n*(i.price+i.deposit))}</b></div>`).join('');if(o.returns?.glass)html+=`<div class="detail-row"><span>Retour verres ×${o.returns.glass}</span><b>−${money(o.returns.glass*2)}</b></div>`;if(o.returns?.large)html+=`<div class="detail-row"><span>Retour grands formats ×${o.returns.large}</span><b>−${money(o.returns.large*10)}</b></div>`;$('#orderDetail').innerHTML=html;$('#orderDetailDlg').showModal()};
// Evite le zoom iOS lors des taps rapides.
let lastTouchEnd=0;document.addEventListener('touchend',e=>{if(!e.target.closest('button'))return;const now=Date.now();if(now-lastTouchEnd<=300)e.preventDefault();lastTouchEnd=now},{passive:false});
// Mise à jour PWA contrôlée : jamais de recharge forcée en pleine commande.
let swReg=null;function offerUpdate(reg){swReg=reg;$('#updateBar').hidden=false}if('serviceWorker'in navigator){navigator.serviceWorker.register('sw.js').then(reg=>{swReg=reg;if(reg.waiting)offerUpdate(reg);reg.addEventListener('updatefound',()=>{const nw=reg.installing;nw?.addEventListener('statechange',()=>{if(nw.state==='installed'&&navigator.serviceWorker.controller)offerUpdate(reg)})});setInterval(()=>reg.update(),5*60*1000)});navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload())}
$('#updateBtn').onclick=()=>{if(items.length||returns.glass||returns.large){toastMsg('Termine la commande avant la mise à jour',1800);return}if(swReg?.waiting){$('#updateBtn').textContent='MISE À JOUR…';swReg.waiting.postMessage({type:'SKIP_WAITING'})}else location.reload()};
render();
