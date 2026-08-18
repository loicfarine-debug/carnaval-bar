const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const cats = [['softs','Softs'],['bieres','Bières'],['alcools','Alcools'],['shots','Shots'],['vins','Vins']];
const catNames = Object.fromEntries(cats);
let products = loadProducts();
let cat = 'softs';
let items = [];
let returns = {glass:0,large:0};
let pending = null;
let loginForced = false;

function mixerList(){return products.filter(p=>p.cat==='softs').map(p=>p.name).concat('Sans soft')}
function loadProducts(){
  const saved = JSON.parse(localStorage.getItem('cg_products_v3') || 'null');
  const base = structuredClone(window.DEFAULT_PRODUCTS);
  if(!saved) return base;
  return base.map(p => ({...p, price: saved[p.id] ?? p.price}));
}
function saveProductPrices(){const data={};products.forEach(p=>data[p.id]=p.price);localStorage.setItem('cg_products_v3',JSON.stringify(data));}
function money(n){const v=Math.round((Number(n)||0)*100)/100;return (Number.isInteger(v)?String(v):v.toFixed(2).replace(/0+$/,'').replace(/\.$/,'')) + '.–';}
function currentUser(){return JSON.parse(localStorage.getItem('cg_user')||'null')}
function knownUsers(){return JSON.parse(localStorage.getItem('cg_known_users')||'[]')}
function isKnownUser(u){const key=(u.first+' '+u.last).trim().toLowerCase();return knownUsers().some(x=>(x.first+' '+x.last).trim().toLowerCase()===key)}
function saveKnownUser(u){let users=knownUsers();if(!isKnownUser(u))users.push(u);localStorage.setItem('cg_known_users',JSON.stringify(users));}
function total(){return items.reduce((s,x)=>s+x.price+x.deposit,0)-returns.glass*2-returns.large*10}
function qty(id){return items.filter(x=>x.id===id).length}
function groupItems(){const groups={};items.forEach((x,i)=>{const k=x.id+'|'+(x.soft||'');if(!groups[k])groups[k]={...x,n:0,indexes:[]};groups[k].n++;groups[k].indexes.push(i);});return Object.entries(groups).map(([key,val])=>({key,...val}));}
function toastMsg(t,ms=1200){const el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove('show'),ms);}

function render(){
  $('#tabs').innerHTML=cats.map(c=>`<button class="${c[0]===cat?'active':''}" data-cat="${c[0]}">${c[1]}</button>`).join('');
  $('#grid').innerHTML=products.filter(p=>p.cat===cat).map(p=>`<button class="product" data-cat="${p.cat}" data-id="${p.id}"><b>${p.name}</b><div class="price-row"><span class="price">${money(p.price)}</span>${p.deposit?`<span class="deposit-badge">+${money(p.deposit)}</span>`:''}</div>${p.note?`<small>${p.note}</small>`:''}${qty(p.id)?`<span class="qty">${qty(p.id)}</span>`:''}</button>`).join('');
  $('#count').textContent=`${items.length} article${items.length!==1?'s':''}`;$('#total').textContent=money(total());$('#retGlassQty').textContent=returns.glass||'';$('#retLargeQty').textContent=returns.large||'';const u=currentUser();$('#userBtn').textContent=u?`${u.first} ${u.last}`:'Utilisateur';
}
$('#tabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;cat=b.dataset.cat;render();};
$('#grid').onclick=e=>{const b=e.target.closest('.product');if(!b)return;const p=products.find(x=>x.id===b.dataset.id);if(!p)return;if(p.soft){pending=p;$('#softTitle').textContent=p.name+' · quel soft ?';$('#softs').innerHTML=mixerList().map(s=>`<button data-soft="${s}">${s}</button>`).join('');$('#softDlg').showModal();}else addItem(p);};
$('#softs').onclick=e=>{const b=e.target.closest('button');if(!b)return;addItem(pending,b.dataset.soft);$('#softDlg').close();};
function addItem(p,soft=''){items.push({...p,soft});render();toastMsg(p.name+(soft?' · '+soft:''),700);}
$$('[data-ret]').forEach(b=>b.onclick=()=>{returns[b.dataset.ret]++;render();toastMsg(b.dataset.ret==='glass'?'Retour verre ajouté':'Retour grand format ajouté',700);});

function cartRender(){
  const groups=groupItems();let html=groups.map(x=>`<div class="line" data-key="${encodeURIComponent(x.key)}"><div class="line-main"><b>${x.name}</b><small>${x.soft?x.soft+' · ':''}${x.deposit?`consigne ${money(x.deposit)} / unité`:''}</small></div><div class="line-actions"><button data-act="minus">−</button><b>${x.n}</b><button data-act="plus">+</button><button class="trash" data-act="trash">×</button></div><div class="line-total">${money(x.n*(x.price+x.deposit))}</div></div>`).join('');
  if(returns.glass)html+=returnLine('glass','Retour verres',returns.glass,2);
  if(returns.large)html+=returnLine('large','Retour plateau / arrosoir / pichet',returns.large,10);
  if(!groups.length&&!returns.glass&&!returns.large)html='<p class="muted">Commande vide.</p>';$('#lines').innerHTML=html;$('#cartTotal').textContent=money(total());
}
function returnLine(type,label,n,value){return `<div class="line return-line" data-return="${type}"><div class="line-main"><b>${label}</b><small>−${money(value)} / unité</small></div><div class="line-actions"><button data-retact="minus">−</button><b>${n}</b><button data-retact="plus">+</button><button class="trash" data-retact="trash">×</button></div><div class="line-total">−${money(n*value)}</div></div>`}
$('#cart').onclick=()=>{cartRender();$('#cartDlg').showModal();};
$('#lines').onclick=e=>{
  const rbtn=e.target.closest('button[data-retact]');if(rbtn){const row=rbtn.closest('[data-return]');const type=row.dataset.return;if(rbtn.dataset.retact==='plus')returns[type]++;if(rbtn.dataset.retact==='minus')returns[type]=Math.max(0,returns[type]-1);if(rbtn.dataset.retact==='trash')returns[type]=0;render();cartRender();return;}
  const btn=e.target.closest('button[data-act]');if(!btn)return;const row=btn.closest('[data-key]');if(!row)return;const key=decodeURIComponent(row.dataset.key);const g=groupItems().find(x=>x.key===key);if(!g)return;
  if(btn.dataset.act==='plus'){const p=products.find(x=>x.id===g.id);addItem(p,g.soft||'');}
  if(btn.dataset.act==='minus'){const idx=items.findLastIndex(x=>x.id===g.id&&(x.soft||'')===(g.soft||''));if(idx>=0)items.splice(idx,1);}
  if(btn.dataset.act==='trash'){items=items.filter(x=>!(x.id===g.id&&(x.soft||'')===(g.soft||'')));}
  render();cartRender();
};

$('#pay').onclick=()=>{$('#payTotal').innerHTML=`<span>À encaisser</span><b>${money(total())}</b>`;$('#cashBox').hidden=true;$('#confirmTwint').hidden=true;$('#given').value='';$('#change').textContent='';$('#payDlg').showModal();};
$('#cash').onclick=()=>{$('#cashBox').hidden=false;$('#confirmTwint').hidden=true;setTimeout(()=>$('#given').focus(),100);};
$('#twint').onclick=()=>{$('#cashBox').hidden=true;$('#confirmTwint').hidden=false;};
$('#given').oninput=()=>{const g=parseFloat($('#given').value.replace(',','.'));$('#change').textContent=isNaN(g)?'':g>=total()?`À rendre : ${money(g-total())}`:`Il manque : ${money(total()-g)}`;};
function finish(type){
  if(!items.length&&!returns.glass&&!returns.large){toastMsg('Commande vide');return;}
  const os=orders();const u=currentUser();const order={date:new Date().toISOString(),type,total:total(),user:u,items:items.map(x=>({id:x.id,name:x.name,cat:x.cat,soft:x.soft||'',price:x.price,deposit:x.deposit})),returns:{...returns}};os.push(order);localStorage.setItem('cg_orders_v3',JSON.stringify(os));
  items=[];returns={glass:0,large:0};$('#payDlg').close();render();$('#successText').textContent=`${type} · ${money(order.total)} · prêt pour la commande suivante`;$('#successDlg').showModal();setTimeout(()=>{if($('#successDlg').open)$('#successDlg').close();},1300);
}
$('#confirmCash').onclick=()=>finish('Cash');$('#confirmTwint').onclick=()=>finish('TWINT');
$$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());

function askLogin(force=false){
  loginForced=force;const u=currentUser();$('#loginClose').hidden=!force;if(force&&u){$('#firstName').value=u.first;$('#lastName').value=u.last;}else{$('#firstName').value='';$('#lastName').value='';}if(!force&&u)return;$('#loginDlg').showModal();
}
$('#loginClose').onclick=()=>{if(loginForced)$('#loginDlg').close();};
$('#loginOk').onclick=()=>{const first=$('#firstName').value.trim(),last=$('#lastName').value.trim();if(!first||!last){toastMsg('Entre prénom et nom');return;}const u={first,last};const known=isKnownUser(u);localStorage.setItem('cg_user',JSON.stringify(u));saveKnownUser(u);$('#loginDlg').close();render();toastMsg(known?`Re-bonjour ${first} ${last} 👋`:`Bienvenue ${first} ${last} 👋`,1800);};
$('#userBtn').onclick=()=>askLogin(true);

function orders(){return JSON.parse(localStorage.getItem('cg_orders_v3')||'[]')}
function renderHistory(){const os=orders().slice().reverse().slice(0,20);$('#historyList').innerHTML=os.length?os.map((o,i)=>{const d=new Date(o.date);const time=d.toLocaleString('fr-CH',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});return `<button class="history-card" data-order-index="${orders().length-1-i}"><span><b>${time}</b><small>${o.type} · ${o.items.length} article(s)</small></span><strong>${money(o.total)}</strong></button>`}).join(''):'<p class="muted">Aucune commande enregistrée.</p>';}
$('#historyBtn').onclick=()=>{renderHistory();$('#historyDlg').showModal();};
$('#historyList').onclick=e=>{const b=e.target.closest('[data-order-index]');if(!b)return;const o=orders()[Number(b.dataset.orderIndex)];if(!o)return;const lines={};o.items.forEach(i=>{const k=i.name+'|'+(i.soft||'');if(!lines[k])lines[k]={...i,n:0};lines[k].n++;});let html=`<div class="order-meta"><b>${new Date(o.date).toLocaleString('fr-CH')}</b><span>${o.type} · ${money(o.total)}</span></div>`;html+=Object.values(lines).map(i=>`<div class="detail-row"><span>${i.n}× ${i.name}${i.soft?' · '+i.soft:''}</span><b>${money(i.n*(i.price+i.deposit))}</b></div>`).join('');if(o.returns?.glass)html+=`<div class="detail-row"><span>Retour verres ×${o.returns.glass}</span><b>−${money(o.returns.glass*2)}</b></div>`;if(o.returns?.large)html+=`<div class="detail-row"><span>Retour grands formats ×${o.returns.large}</span><b>−${money(o.returns.large*10)}</b></div>`;$('#orderDetail').innerHTML=html;$('#orderDetailDlg').showModal();};

$('#settings').onclick=()=>{$('#pin').value='';$('#pinDlg').showModal();};
$('#pinOk').onclick=()=>{const code=localStorage.getItem('cg_pin')||'2026';if($('#pin').value===code){$('#pinDlg').close();showSettings();}else toastMsg('PIN incorrect');};
function statData(){const os=orders();const revenue=os.reduce((s,o)=>s+(o.total||0),0),cash=os.filter(o=>o.type==='Cash').reduce((s,o)=>s+(o.total||0),0),twint=os.filter(o=>o.type==='TWINT').reduce((s,o)=>s+(o.total||0),0);const product={};let units=0;os.forEach(o=>o.items.forEach(i=>{units++;const key=i.name+(i.soft?' · '+i.soft:'');product[key]=(product[key]||0)+1;}));const hourly={};os.forEach(o=>{const d=new Date(o.date),k=String(d.getHours()).padStart(2,'0')+'h–'+String((d.getHours()+1)%24).padStart(2,'0')+'h';if(!hourly[k])hourly[k]={orders:0,units:0,revenue:0};hourly[k].orders++;hourly[k].units+=o.items.length;hourly[k].revenue+=o.total||0;});return{os,revenue,cash,twint,product,units,hourly};}
function renderStats(){const s=statData(),payTotal=s.cash+s.twint,cashPct=payTotal?Math.round(s.cash/payTotal*100):0,twintPct=payTotal?100-cashPct:0;$('#statsSummary').innerHTML=`<div class="stat-card"><span>Entrées d’argent</span><b>${money(s.revenue)}</b></div><div class="stat-card"><span>Commandes</span><b>${s.os.length}</b></div><div class="stat-card"><span>Verres / articles vendus</span><b>${s.units}</b></div><div class="stat-card"><span>Cash</span><b>${money(s.cash)} · ${cashPct}%</b></div><div class="stat-card"><span>TWINT</span><b>${money(s.twint)} · ${twintPct}%</b></div>`;const hourRows=Object.entries(s.hourly).sort((a,b)=>a[0].localeCompare(b[0]));$('#hourlyStats').innerHTML=hourRows.length?hourRows.map(([h,v])=>`<div class="stats-row"><div><b>${h}</b><small>${v.orders} commande(s) · ${v.units} article(s)</small></div><b>${money(v.revenue)}</b></div>`).join(''):'<div class="stats-row"><span>Aucune vente</span><b>—</b></div>';const prodRows=Object.entries(s.product).sort((a,b)=>b[1]-a[1]);$('#productStats').innerHTML=prodRows.length?prodRows.map(([n,q])=>`<div class="stats-row"><span>${n}</span><b>${q}</b></div>`).join(''):'<div class="stats-row"><span>Aucune vente</span><b>—</b></div>';const us=knownUsers();$('#usersStats').innerHTML=us.length?us.map(u=>`<div class="stats-row"><span>${u.first} ${u.last}</span><b>✓</b></div>`).join(''):'<div class="stats-row"><span>Aucun utilisateur</span><b>—</b></div>';}
function renderPriceEditor(){let last='';$('#priceEditor').innerHTML=products.map(p=>{let head='';if(p.cat!==last){last=p.cat;head=`<div class="price-group">${catNames[p.cat]||p.cat}</div>`;}return head+`<div class="price-edit"><div><b>${p.name}</b><small>Consigne ${money(p.deposit)}</small></div><input data-price-id="${p.id}" inputmode="decimal" value="${p.price}"></div>`;}).join('');}
function showSettings(){renderStats();renderPriceEditor();$('#newPin').value=localStorage.getItem('cg_pin')||'2026';setSettingsTab('stats');$('#settingsDlg').showModal();}
function setSettingsTab(name){$$('[data-setting-tab]').forEach(b=>b.classList.toggle('active',b.dataset.settingTab===name));$$('.settings-panel').forEach(p=>p.classList.remove('active'));$('#settings'+name[0].toUpperCase()+name.slice(1)).classList.add('active');}
$$('[data-setting-tab]').forEach(b=>b.onclick=()=>setSettingsTab(b.dataset.settingTab));
$('#savePrices').onclick=()=>{$$('[data-price-id]').forEach(inp=>{const p=products.find(x=>x.id===inp.dataset.priceId),v=parseFloat(inp.value.replace(',','.'));if(p&&!isNaN(v)&&v>=0)p.price=v;});saveProductPrices();render();const btn=$('#savePrices');const old=btn.textContent;btn.textContent='✓ Prix enregistrés';btn.classList.add('saved');toastMsg('✓ Prix enregistrés',1600);setTimeout(()=>{btn.textContent=old;btn.classList.remove('saved');},1500);};
$('#resetPrices').onclick=()=>{if(!confirm('Remettre tous les prix par défaut ?'))return;localStorage.removeItem('cg_products_v3');products=loadProducts();renderPriceEditor();render();toastMsg('Prix par défaut restaurés');};
$('#savePin').onclick=()=>{const v=$('#newPin').value.trim();if(v.length<4){toastMsg('4 chiffres minimum');return;}localStorage.setItem('cg_pin',v);toastMsg('PIN enregistré');};
$('#switchUser').onclick=()=>{$('#settingsDlg').close();askLogin(true);};
$('#resetStats').onclick=()=>{if(!confirm('Effacer toutes les statistiques de ce téléphone ?'))return;localStorage.removeItem('cg_orders_v3');renderStats();toastMsg('Statistiques réinitialisées');};

// Empêche le double-tap iOS de zoomer sur les boutons : les taps restent des ajouts rapides.
let lastTouchEnd=0;document.addEventListener('touchend',e=>{if(!e.target.closest('button'))return;const now=Date.now();if(now-lastTouchEnd<=300)e.preventDefault();lastTouchEnd=now;},{passive:false});
render();askLogin(false);if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
