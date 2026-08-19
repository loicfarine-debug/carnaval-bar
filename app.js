
const VERSION = "3.3.0";
const CATEGORY_ORDER = ["soft","beer","alcohol","shot","wine"];
const CATEGORY_LABELS = {
  soft:"Softs", beer:"Bières", alcohol:"Alcools", shot:"Shots", wine:"Vins"
};
const MIXERS = ["Coca","Thé froid pêche","Limonade","Jus d’orange","Grapefruit","Eau gazeuse","Eau plate","Tonic","Maté","Sans soft"];

const products = [
  {id:"coca", name:"Coca", cat:"soft", price:3, deposit:2},
  {id:"eau_gaz", name:"Eau gazeuse", cat:"soft", price:3, deposit:2},
  {id:"eau_plate", name:"Eau plate", cat:"soft", price:3, deposit:2},
  {id:"grapefruit", name:"Grapefruit", cat:"soft", price:3, deposit:2},
  {id:"jus_orange", name:"Jus d’orange", cat:"soft", price:3, deposit:2},
  {id:"limonade", name:"Limonade", cat:"soft", price:3, deposit:2},
  {id:"mate", name:"Maté", cat:"soft", price:3, deposit:2},
  {id:"the_froid", name:"Thé froid pêche", cat:"soft", price:3, deposit:2},
  {id:"tonic", name:"Tonic", cat:"soft", price:3, deposit:2},

  {id:"biere_blanche", name:"Bière blanche", cat:"beer", price:5, deposit:2},
  {id:"biere_blonde", name:"Bière blonde", cat:"beer", price:4, deposit:2},
  {id:"pichet_blanche", name:"Pichet blanche", cat:"beer", price:23, deposit:10},
  {id:"pichet_blonde", name:"Pichet blonde", cat:"beer", price:18, deposit:10},

  {id:"baby", name:"Baby", cat:"alcohol", price:6, deposit:2, mixer:true},
  {id:"gin", name:"Gin", cat:"alcohol", price:7, deposit:2, mixer:true},
  {id:"jager", name:"Jäger", cat:"alcohol", price:7, deposit:2, mixer:true},
  {id:"martini", name:"Martini", cat:"alcohol", price:7, deposit:2, mixer:true},
  {id:"rhum", name:"Rhum blanc", cat:"alcohol", price:7, deposit:2, mixer:true},
  {id:"suze", name:"Suze", cat:"alcohol", price:5, deposit:2, mixer:true},
  {id:"vodka", name:"Vodka", cat:"alcohol", price:7, deposit:2, mixer:true},
  {id:"whisky", name:"Whisky", cat:"alcohol", price:7, deposit:2, mixer:true},

  {id:"autre", name:"Autre", cat:"shot", price:5, deposit:2},
  {id:"berliner", name:"Berliner", cat:"shot", price:5, deposit:2},
  {id:"tequila", name:"Tequila", cat:"shot", price:5, deposit:2},
  {id:"xuxu", name:"Xuxu", cat:"shot", price:5, deposit:2},
  {id:"zekilla", name:"Zekilla", cat:"shot", price:5, deposit:2},
  {id:"plateau10", name:"Plateau 10 shots", cat:"shot", price:40, deposit:30},

  {id:"vin_bouteille", name:"Bouteille 5 dl", cat:"wine", price:18, deposit:0},
  {id:"vin_verre", name:"Vin 1 dl", cat:"wine", price:4, deposit:2},
];

let activeCat = "soft";
let order = [];
let returns = {glass:0,big:0};
let history = JSON.parse(localStorage.getItem("carnaval_history_v33") || "[]");
let actionStack = [];
let pendingMixerProduct = null;
let tapBuckets = new Map();

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function money(v){
  const n = Math.round(v * 100) / 100;
  return `${Number.isInteger(n) ? n : n.toFixed(2)} CHF`;
}

function total(){
  const items = order.reduce((sum,l)=>sum + (l.price + l.deposit) * l.qty,0);
  return items - returns.glass*2 - returns.big*10;
}

function totalArticles(){
  return order.reduce((s,l)=>s+l.qty,0);
}

function saveState(){
  localStorage.setItem("carnaval_current_v33", JSON.stringify({order,returns}));
}
function loadState(){
  try{
    const st = JSON.parse(localStorage.getItem("carnaval_current_v33")||"null");
    if(st){order = st.order||[]; returns = st.returns||{glass:0,big:0};}
  }catch{}
}

function renderTabs(){
  $("#tabs").innerHTML = CATEGORY_ORDER.map(cat =>
    `<button class="tab ${cat} ${cat===activeCat?'active':''}" data-cat="${cat}">${CATEGORY_LABELS[cat]}</button>`
  ).join("");
  $$(".tab").forEach(b=>b.onclick=()=>{activeCat=b.dataset.cat; renderTabs(); renderProducts();});
}

function lineKey(p,mixer){ return `${p.id}::${mixer||""}`; }

function getQtyForProduct(p){
  return order.filter(l=>l.productId===p.id).reduce((s,l)=>s+l.qty,0);
}

function renderProducts(){
  const list = products.filter(p=>p.cat===activeCat).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  $("#products").innerHTML = list.map(p=>{
    const qty = getQtyForProduct(p);
    return `<button class="product ${p.cat}" data-id="${p.id}">
      <div class="product-name">${p.name}</div>
      <div class="product-price-row">
        <span class="product-price">${money(p.price)}</span>
        ${p.deposit ? `<span class="deposit-badge">+${p.deposit}</span>` : ""}
      </div>
      ${qty?`<span class="qty-badge">×${qty}</span>`:""}
      <span class="plus-feedback"></span>
    </button>`
  }).join("");
  $$(".product").forEach(btn=>{
    btn.addEventListener("pointerdown", e=>{
      e.preventDefault();
      const p = products.find(x=>x.id===btn.dataset.id);
      btn.classList.remove("tap-pop"); void btn.offsetWidth; btn.classList.add("tap-pop");
      if(p.mixer){ openMixer(p); }
      else { addItem(p, null, btn); }
    }, {passive:false});
  });
}

function registerFeedback(btn, productId){
  const now = Date.now();
  let b = tapBuckets.get(productId) || {count:0,timer:null,last:0};
  b.count += 1; b.last = now;
  clearTimeout(b.timer);
  const el = btn?.querySelector(".plus-feedback");
  if(el){
    el.textContent = `+${b.count}`;
    el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
  }
  b.timer = setTimeout(()=>tapBuckets.delete(productId), 520);
  tapBuckets.set(productId,b);
}

function addItem(p,mixer=null,btn=null){
  const key = lineKey(p,mixer);
  let line = order.find(l=>l.key===key);
  if(line) line.qty++;
  else order.push({key,productId:p.id,baseName:p.name,name:mixer&&mixer!=="Sans soft"?`${p.name} ${mixer}`:p.name,mixer,cat:p.cat,price:p.price,deposit:p.deposit,qty:1});
  actionStack.push({type:"add",key});
  registerFeedback(btn || document.querySelector(`[data-id="${p.id}"]`), p.id);
  updateUI();
}

function removeOne(key){
  const line = order.find(l=>l.key===key); if(!line) return;
  line.qty--; if(line.qty<=0) order = order.filter(l=>l.key!==key);
  updateUI();
}
function addOne(key){
  const line = order.find(l=>l.key===key); if(!line) return;
  line.qty++;
  updateUI();
}
function deleteLine(key){
  order = order.filter(l=>l.key!==key); updateUI();
}

function changeReturn(type,delta){
  returns[type] = Math.max(0,(returns[type]||0)+delta);
  if(delta>0) actionStack.push({type:"return",returnType:type});
  updateUI();
}

function undo(){
  const a = actionStack.pop(); if(!a) return;
  if(a.type==="add") removeOne(a.key);
  if(a.type==="return") {returns[a.returnType]=Math.max(0,returns[a.returnType]-1); updateUI();}
}

function updateUI(){
  $("#totalDue").textContent = money(total());
  const n = totalArticles();
  $("#articleCount").textContent = `${n} article${n!==1?'s':''}`;
  $("#retGlassQty").textContent = returns.glass?`×${returns.glass}`:"";
  $("#retBigQty").textContent = returns.big?`×${returns.big}`:"";
  saveState();
  renderProducts();
}

function openModal(id){
  $("#modalBackdrop").classList.remove("hidden");
  $("#"+id).classList.remove("hidden");
}
function closeModal(id){
  $("#"+id).classList.add("hidden");
  if($$(".modal:not(.hidden)").length===0) $("#modalBackdrop").classList.add("hidden");
}
$$("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
$("#modalBackdrop").onclick=()=>{$$(".modal:not(.hidden)").forEach(m=>m.classList.add("hidden"));$("#modalBackdrop").classList.add("hidden")};

function openMixer(p){
  pendingMixerProduct = p;
  $("#mixerTitle").textContent = p.name;
  $("#mixerGrid").innerHTML = MIXERS.map(m=>`<button data-mixer="${m}">${m}</button>`).join("");
  $$("#mixerGrid button").forEach(b=>b.onclick=()=>{
    closeModal("mixerModal");
    addItem(p,b.dataset.mixer,document.querySelector(`[data-id="${p.id}"]`));
  });
  openModal("mixerModal");
}

function groupedOrder(){
  const groups = {};
  CATEGORY_ORDER.forEach(c=>groups[c]=[]);
  order.forEach(l=>groups[l.cat].push(l));
  CATEGORY_ORDER.forEach(c=>groups[c].sort((a,b)=>{
    const base = a.baseName.localeCompare(b.baseName,'fr');
    if(base!==0) return base;
    return (a.mixer||"").localeCompare(b.mixer||"",'fr');
  }));
  return groups;
}

function renderOrderModal(){
  const groups = groupedOrder();
  $("#orderLines").innerHTML = CATEGORY_ORDER.map(cat=>{
    if(!groups[cat].length) return "";
    return `<div class="prep-group">
      <div class="prep-cat">${CATEGORY_LABELS[cat].toUpperCase()}</div>
      ${groups[cat].map(l=>`<div class="order-line">
        <div class="order-main">
          <div class="order-qty">×${l.qty}</div>
          <div class="order-name">${l.name}</div>
        </div>
        <div class="line-actions">
          <button data-minus="${l.key}">−</button>
          <button data-plus="${l.key}">+</button>
          <button data-del="${l.key}">🗑</button>
        </div>
      </div>`).join("")}
    </div>`
  }).join("") || `<div class="history-meta">Aucun article.</div>`;

  let r = "";
  if(returns.glass || returns.big){
    r += `<div class="prep-cat">RETOURS CONSIGNES</div>`;
    if(returns.glass) r += `<div class="return-line"><strong>Verre ×${returns.glass}</strong><div class="line-actions"><button data-rminus="glass">−</button><button data-rplus="glass">+</button><button data-rdel="glass">🗑</button></div></div>`;
    if(returns.big) r += `<div class="return-line"><strong>Plateau • arrosoir • pichet ×${returns.big}</strong><div class="line-actions"><button data-rminus="big">−</button><button data-rplus="big">+</button><button data-rdel="big">🗑</button></div></div>`;
  }
  $("#returnLines").innerHTML = r;
  $$("[data-minus]").forEach(b=>b.onclick=()=>{removeOne(b.dataset.minus);renderOrderModal()});
  $$("[data-plus]").forEach(b=>b.onclick=()=>{addOne(b.dataset.plus);renderOrderModal()});
  $$("[data-del]").forEach(b=>b.onclick=()=>{deleteLine(b.dataset.del);renderOrderModal()});
  $$("[data-rminus]").forEach(b=>b.onclick=()=>{changeReturn(b.dataset.rminus,-1);renderOrderModal()});
  $$("[data-rplus]").forEach(b=>b.onclick=()=>{changeReturn(b.dataset.rplus,1);renderOrderModal()});
  $$("[data-rdel]").forEach(b=>b.onclick=()=>{returns[b.dataset.rdel]=0;updateUI();renderOrderModal()});
}

$("#orderBtn").onclick=()=>{renderOrderModal();openModal("orderModal")};
$("#undoBtn").onclick=undo;
$$(".return-btn").forEach(b=>b.addEventListener("pointerdown",e=>{e.preventDefault();changeReturn(b.dataset.return,1)},{passive:false}));

function updateChange(){
  const given = parseFloat(($("#cashInput").value||"").replace(",", ".")) || 0;
  const change = Math.max(0,given-total());
  $("#changeDue").textContent = money(change);
}
$("#cashInput").addEventListener("input",updateChange);

$$("[data-cash]").forEach(b=>b.onclick=()=>{
  const add = Number(b.dataset.cash);
  const current = parseFloat(($("#cashInput").value||"").replace(",", ".")) || 0;
  $("#cashInput").value = current + add;
  updateChange();
});

$("#payBtn").onclick=()=>{
  $("#payAmount").textContent = money(total());
  $("#cashInput").value="";
  $("#changeDue").textContent="0 CHF";
  showPayPanel("cash");
  openModal("payModal");
  setTimeout(()=>$("#cashInput").focus(),200);
};
function showPayPanel(type){
  const cash = type==="cash";
  $("#cashTab").classList.toggle("active",cash);
  $("#twintTab").classList.toggle("active",!cash);
  $("#cashPanel").classList.toggle("hidden",!cash);
  $("#twintPanel").classList.toggle("hidden",cash);
}
$("#cashTab").onclick=()=>showPayPanel("cash");
$("#twintTab").onclick=()=>showPayPanel("twint");

function finalizePayment(method){
  const snapshot = {
    at:new Date().toISOString(),
    method,
    total:total(),
    order:JSON.parse(JSON.stringify(order)),
    returns:{...returns}
  };
  history.unshift(snapshot);
  history = history.slice(0,30);
  localStorage.setItem("carnaval_history_v33",JSON.stringify(history));
  closeModal("payModal");
  showToast(`✓ PAYÉ · ${money(snapshot.total)} · ${method}`);
  order=[]; returns={glass:0,big:0}; actionStack=[]; updateUI();
}
$("#validateCash").onclick=()=>finalizePayment("CASH");
$("#validateTwint").onclick=()=>finalizePayment("TWINT");

function showToast(msg){
  const t=$("#toast"); t.textContent=msg; t.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer=setTimeout(()=>t.classList.add("hidden"),1300);
}

function renderHistory(){
  if(!history.length){$("#historyList").innerHTML='<div class="history-meta">Aucune commande enregistrée.</div>';return;}
  $("#historyList").innerHTML=history.map(h=>{
    const d=new Date(h.at);
    const time=d.toLocaleTimeString("fr-CH",{hour:"2-digit",minute:"2-digit"});
    const detail=h.order.map(l=>`${l.qty}× ${l.name}`).join("\n");
    return `<div class="history-item">
      <div class="history-head"><span>${time} · ${h.method}</span><span>${money(h.total)}</span></div>
      <div class="history-detail">${detail || "Retours consignes uniquement"}</div>
    </div>`;
  }).join("");
}
$("#historyBtn").onclick=()=>{renderHistory();openModal("historyModal")};

let newWorker = null;
if("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js").then(reg=>{
    if(reg.waiting){ newWorker=reg.waiting; $("#updateBtn").classList.remove("hidden"); }
    reg.addEventListener("updatefound",()=>{
      const w=reg.installing;
      w.addEventListener("statechange",()=>{
        if(w.state==="installed" && navigator.serviceWorker.controller){
          newWorker=w; $("#updateBtn").classList.remove("hidden");
        }
      });
    });
  });
  navigator.serviceWorker.addEventListener("controllerchange",()=>location.reload());
}
$("#updateBtn").onclick=()=>{
  if(totalArticles()>0 || returns.glass || returns.big){
    showToast("Termine la commande avant la mise à jour");
    return;
  }
  if(newWorker) newWorker.postMessage({type:"SKIP_WAITING"});
  else location.reload();
};

loadState();
renderTabs();
updateUI();
