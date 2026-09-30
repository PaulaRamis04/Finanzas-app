// Utilidades de vista compartidas: carga en botones, errores, formularios plegables, arrastrar para ordenar, cabecera, menú y selects comunes.

async function conCarga(btn, textoCarga, fn){
  if(!btn || btn.disabled) return;
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = textoCarga;
  try{
    await fn();
  } finally {
    if(document.body.contains(btn)){
      btn.disabled = false;
      btn.textContent = original;
    }
  }
}

let pendienteEnfoque = null;

function formAbierto(clave){ return clave in formsEstado ? formsEstado[clave] : (formsPorDefecto==="abiertos"); }

// Convierte las tarjetas de "añadir algo" en plegables (se toca el título para abrir o cerrar)

const ICONOS_PLEGABLE = {mov:["➕","var(--lav-soft)"], transferencia:["🔁","var(--accent-soft)"], deuda:["🤝","var(--peach-soft)"], cuenta:["👛","var(--mint-soft)"],
  inversion:["🌱","var(--mint-soft)"], grupo:["📁","var(--lav-soft)"], categoria:["🏷️","var(--peach-soft)"], presupuesto:["📊","var(--accent-soft)"], objetivo:["🎯","var(--mint-soft)"]};

function aplicarPlegables(){
  const defs = [["fMov","mov"],["fTransferencia","transferencia"],["fDeuda","deuda"],["fCuenta","cuenta"],["fInversion","inversion"],["fGrupo","grupo"],["fCategoria","categoria"],["fPresupuesto","presupuesto"],["fObjetivo","objetivo"]];
  defs.forEach(([id,clave])=>{
    const form = document.getElementById(id);
    const card = form ? form.closest(".card") : null;
    const h2 = card ? card.querySelector("h2") : null;
    if(!h2) return;
    const cuerpo = document.createElement("div");
    cuerpo.style.marginTop = "12px";
    [...card.children].filter(ch=>ch!==h2).forEach(ch=>cuerpo.appendChild(ch));
    const cab = document.createElement("div");
    cab.className = "pleg-cab";
    const [ico, fondo] = ICONOS_PLEGABLE[clave] || ["➕","var(--accent-soft)"];
    const circ = document.createElement("i");
    circ.textContent = ico; circ.style.background = fondo;
    const chev = document.createElement("span");
    chev.className = "chev";
    chev.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
    card.insertBefore(cab, card.firstChild);
    cab.appendChild(circ); cab.appendChild(h2); cab.appendChild(chev);
    card.appendChild(cuerpo);
    const pintar = ()=>{
      const ab = formAbierto(clave);
      cuerpo.style.display = ab ? "block" : "none";
      cab.classList.toggle("abierto", ab);
    };
    pintar();
    cab.onclick = ()=>{ formsEstado[clave] = !formAbierto(clave); pintar(); };
  });
}

function activarOrdenar(){
  document.querySelectorAll(".grip").forEach(g=>{
    g.onclick = e=>e.stopPropagation();
    g.onpointerdown = e=>{
      if(e.pointerType==="mouse" && e.button!==0) return;
      const item = g.closest(".sort-item");
      const cont = item ? item.parentElement : null;
      if(!cont || !cont.dataset.sortable || arrastrando) return;
      e.preventDefault(); e.stopPropagation();
      iniciarArrastre(e, g, item, cont);
    };
  });
}

function iniciarArrastre(e, handle, item, cont){
  arrastrando = true;
  const rpcNombre = cont.dataset.sortable;
  const els = [...cont.children].filter(x=>x.dataset && x.dataset.sortId);
  const i0 = els.indexOf(item);
  const scroll0 = window.scrollY;
  const tops = els.map(el=>{ const r = el.getBoundingClientRect(); return {top:r.top+scroll0, h:r.height}; });
  const hDrag = tops[i0].h;
  const hueco = els.length>1 ? Math.max(0, i0+1<els.length ? tops[i0+1].top-(tops[i0].top+tops[i0].h) : tops[i0].top-(tops[i0-1].top+tops[i0-1].h)) : 0;
  const rect = item.getBoundingClientRect();
  const ghost = item.cloneNode(true);
  ghost.querySelectorAll("[id]").forEach(n=>n.removeAttribute("id"));
  ghost.classList.add("sort-ghost");
  ghost.style.width = rect.width+"px"; ghost.style.left = rect.left+"px"; ghost.style.top = rect.top+"px";
  document.body.appendChild(ghost);
  document.body.style.userSelect = "none";
  item.classList.add("sort-arrastrando");
  els.forEach(el=>{ if(el!==item) el.style.transition = "transform .15s ease"; });
  const offsetY = e.clientY - rect.top;
  let y = e.clientY, activo = true, raf = 0, destino = i0;
  try{ handle.setPointerCapture(e.pointerId); }catch(_){}
  const actualizar = ()=>{
    if(!activo) return;
    ghost.style.top = (y - offsetY) + "px";
    const yPag = y + window.scrollY;
    let t = 0;
    els.forEach((el,j)=>{ if(j!==i0 && (tops[j].top + tops[j].h/2) < yPag) t++; });
    destino = t;
    els.forEach((el,j)=>{
      if(j===i0) return;
      let dy = 0;
      if(destino>i0 && j>i0 && j<=destino) dy = -(hDrag+hueco);
      else if(destino<i0 && j>=destino && j<i0) dy = (hDrag+hueco);
      el.style.transform = dy ? `translateY(${dy}px)` : "";
    });
    const cab = document.querySelector("header");
    const limite = (cab ? cab.getBoundingClientRect().bottom : 0) + 70;
    if(y < limite) window.scrollBy(0, -14);
    else if(y > window.innerHeight - 80) window.scrollBy(0, 14);
    raf = requestAnimationFrame(actualizar);
  };
  const onMove = ev=>{ if(ev.pointerId===e.pointerId) y = ev.clientY; };
  const fin = async ev=>{
    if(!activo || (ev && ev.pointerId!==e.pointerId)) return;
    activo = false; cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", fin);
    window.removeEventListener("pointercancel", fin);
    ghost.remove(); document.body.style.userSelect = "";
    item.classList.remove("sort-arrastrando");
    els.forEach(el=>{ el.style.transform = ""; el.style.transition = ""; });
    if((ev && ev.type==="pointercancel") || destino===i0){ arrastrando = false; return; }
    const ids = els.map(x=>x.dataset.sortId);
    const [movido] = ids.splice(i0, 1);
    ids.splice(destino, 0, movido);
    ids.forEach(id=>{ const el = els.find(x=>x.dataset.sortId===id); if(el) cont.appendChild(el); });
    arrastrando = false;
    const {error} = await sb.rpc(rpcNombre, {p_ids: ids});
    if(error) showError("No se pudo cambiar el orden: "+error.message); else hideError();
    await recargar();
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", fin);
  window.addEventListener("pointercancel", fin);
  raf = requestAnimationFrame(actualizar);
}

function showError(msg){
  const bar = document.getElementById("errBar");
  document.getElementById("errMsg").textContent = msg;
  bar.classList.add("show");
  document.getElementById("errRetry").onclick = ()=>{ hideError(); fetchAll(); };
  document.getElementById("errClose").onclick = hideError;
}

function hideError(){ document.getElementById("errBar").classList.remove("show"); }

function renderPeriodo(){
  const years = Array.from(new Set([...movimientos.map(m=>Number((m.fecha||"").slice(0,4))), ...movResumen.map(r=>Number(r.mes.slice(0,4))), periodoAnio].filter(Boolean))).sort((a,b)=>b-a);
  document.getElementById("periodoBox").innerHTML = `
    <span class="pill-sel"><select id="selMes">
      <option value="todos" ${periodoMes==="todos"?"selected":""}>Total del año</option>
      ${MESES.map((m,i)=>`<option value="${i+1}" ${periodoMes===String(i+1)?"selected":""}>${m}</option>`).join("")}
    </select></span>
    <span class="pill-sel"><select id="selAnio">${years.map(y=>`<option value="${y}" ${y===periodoAnio?"selected":""}>${y}</option>`).join("")}</select></span>
  `;
  document.getElementById("selMes").onchange = e=>{periodoMes=e.target.value; render();};
  document.getElementById("selAnio").onchange = e=>{periodoAnio=Number(e.target.value); if(!asegurarMovimientosDesde(`${periodoAnio}-01-01`)) render();};
}

function closeMenu(){
  document.getElementById("menuPanel")?.classList.remove("open");
  document.getElementById("menuOverlay")?.classList.remove("open");
}

const TITULOS_TAB = {"Resumen del mes":"Análisis"};

function renderTabs(){
  document.getElementById("tabActual").textContent = TITULOS_TAB[tab] || tab;
  document.getElementById("menuPanel").innerHTML =
    `<button class="menu-item ${tab==="Inicio"?"active":""}" data-tab="Inicio" style="margin-bottom:16px">🏠 Inicio</button>` +
    GRUPOS_MENU.map(g=>`
    <div class="menu-group-title">${g.nombre}</div>
    ${g.tabs.map(t=>`<button class="menu-item ${t===tab?'active':''}" data-tab="${t}">${t}${t==="Importar" && pendientes.length? ` (${pendientes.length})` : ""}</button>`).join("")}
  `).join("") +
    `<button class="menu-item" id="menuLogout" style="margin-top:18px;color:var(--neg)">Cerrar sesión</button>`;
  document.querySelectorAll(".menu-item[data-tab]").forEach(b=>b.onclick=()=>{ tab=b.dataset.tab; closeMenu(); render(); });
  document.getElementById("menuLogout").onclick = ()=> sb.auth.signOut();
  document.querySelectorAll("[data-nav]").forEach(b=>{
    b.classList.toggle("active", b.dataset.nav===tab);
    b.onclick = ()=>{ tab = b.dataset.nav; closeMenu(); render(); window.scrollTo(0,0); };
  });
  const enNav = [...document.querySelectorAll("[data-nav]")].some(b=>b.dataset.nav===tab);
  document.getElementById("navMas").classList.toggle("active", !enNav);
  const menuBtn = document.getElementById("menuBtn");
  const overlay = document.getElementById("menuOverlay");
  const abrirMenu = ()=>{
    document.getElementById("menuPanel").classList.add("open");
    overlay.classList.add("open");
  };
  if(menuBtn) menuBtn.onclick = abrirMenu;
  document.getElementById("navMas").onclick = abrirMenu;
  if(overlay) overlay.onclick = closeMenu;
  const rb = document.getElementById("btnRefrescar");
  if(rb) rb.onclick = async ()=>{
    if(rb.disabled) return;
    rb.disabled = true; rb.classList.add("girando");
    try{ await fetchAll(); } finally { rb.disabled = false; rb.classList.remove("girando"); }
  };
}

function renderBalance(){
  const enP = movimientosEfectivos();
  const ingresos = enP.filter(m=>m.tipo==="ingreso").reduce((s,m)=>sumarDinero(s, m.importe),0);
  const ahorro = enP.filter(m=>m.tipo==="gasto" && m.categoria==="Inversión").reduce((s,m)=>sumarDinero(s, m.importe),0);
  const gastado = enP.filter(m=>m.tipo==="gasto" && m.categoria!=="Inversión").reduce((s,m)=>sumarDinero(s, m.importe),0);
  const disponible = restarDinero(restarDinero(ingresos, ahorro), gastado);
  const meDeben = deudas.filter(d=>d.direccion==="me_deben" && d.estado==="pendiente").reduce((s,d)=>sumarDinero(s, d.importe),0);
  const debo = deudas.filter(d=>d.direccion==="debo" && d.estado==="pendiente").reduce((s,d)=>sumarDinero(s, d.importe),0);
  const totalCuentas = cuentas.reduce((s,c)=>sumarDinero(s, saldoCuenta(c)),0);
  const totalInversiones = inversiones.filter(i=>i.estado==="activa").reduce((s,i)=>sumarDinero(s, i.valorActual),0);
  const patrimonioNeto = restarDinero(sumarDinero(totalCuentas, totalInversiones, meDeben), debo);
  const lbl = periodoMes==="todos" ? `Año ${periodoAnio}` : `${MESES[Number(periodoMes)-1]} ${periodoAnio}`;
  document.getElementById("balanceBox").innerHTML = `
    <div><b class="${patrimonioNeto>=0?'':'neg'}">${eur(patrimonioNeto)}</b><span>Patrimonio</span></div>
    <div><b class="pos">${eur(ingresos)}</b><span>Ingresos · ${lbl}</span></div>
    <div><b class="${disponible>=0?'':'neg'}">${eur(disponible)}</b><span>Disponible</span></div>
    <div><b class="pos">${eur(meDeben)}</b><span>Me deben</span></div>
    <div><b class="neg">${eur(debo)}</b><span>Debo</span></div>
  `;
}

function opcionesCuentas(selectedId, sinDefecto){
  const sel = selectedId || (sinDefecto ? "" : cuentaPorDefecto());
  return cuentas.filter(c=>!c.archivada || c.id===sel).map(c=>`<option value="${c.id}"${c.id===sel?" selected":""}>${esc(c.nombre)}</option>`).join("");
}

function opcionesCategoriaPend(tipo, sel){
  const base = `<option value="">Elegir categoría…</option>`;
  if(tipo==="gasto"){
    const porPadre = {};
    categorias.filter(c=>c.tipo==="gasto").forEach(c=>{ const p=c.padre||"Otros"; (porPadre[p]=porPadre[p]||[]).push(c); });
    return base + Object.entries(porPadre).map(([p,cs])=>`<optgroup label="${esc(p)}">${cs.map(c=>`<option value="${esc(c.nombre)}"${c.nombre===sel?" selected":""}>${esc(c.nombre)}</option>`).join("")}</optgroup>`).join("");
  }
  return base + categorias.filter(c=>c.tipo==="ingreso").map(c=>`<option value="${esc(c.nombre)}"${c.nombre===sel?" selected":""}>${esc(c.nombre)}</option>`).join("");
}

function opcionesMovimientosGasto(selectedId){
  const lista = movimientos.filter(m=>m.tipo==="gasto" && !m.reembolsoDe && m.categoria!=="Ajuste" && m.categoria!=="Inversión")
    .sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,60);
  if(selectedId && !lista.some(m=>m.id===selectedId)){ const m = movimientos.find(x=>x.id===selectedId); if(m) lista.push(m); }
  return lista.map(m=>`<option value="${m.id}"${m.id===selectedId?" selected":""}>${esc(m.fecha)} · ${esc(m.nota||m.categoria)} · ${eur(m.importe)}</option>`).join("");
}

function opcionesCategoriasGasto(){
  const porPadre = {};
  categorias.filter(c=>c.tipo==="gasto").forEach(c=>{ const p=c.padre||"Otros"; (porPadre[p]=porPadre[p]||[]).push(c); });
  return Object.entries(porPadre).map(([p,cs])=>`<optgroup label="${esc(p)}">${cs.map(c=>`<option value="${esc(c.nombre)}">${esc(c.nombre)}</option>`).join("")}</optgroup>`).join("");
}

// Fila de movimiento tipo tarjeta (icono, concepto, categoría, importe). extra = texto de la línea de detalle.
function fechaCorta(f){ return `${Number(f.slice(8,10))} ${MESES[Number(f.slice(5,7))-1].slice(0,3).toLowerCase()}`; }

function etiquetaDia(f){
  const d = new Date(f+"T00:00:00"), hoy = new Date(); hoy.setHours(0,0,0,0);
  const dif = Math.round((hoy-d)/86400000);
  if(dif===0) return "Hoy";
  if(dif===1) return "Ayer";
  const dia = ["dom","lun","mar","mié","jue","vie","sáb"][d.getDay()];
  return `${dia} ${fechaCorta(f)}${d.getFullYear()!==hoy.getFullYear() ? " "+d.getFullYear() : ""}`;
}

function filaMov(m, {attrs="", extra="", signo=true, fecha=true, clase=""}={}){
  const trans = !!m.transferenciaId;
  const ingreso = m.tipo==="ingreso";
  const tag = attrs ? "button" : "div";
  const titulo = trans ? "Transferencia" : (m.nota || m.categoria);
  const sub = extra || (trans ? "Entre cuentas" : m.categoria);
  const importe = signo && !trans ? `${ingreso?"+":"-"}${eur(m.importe)}` : eur(m.importe);
  return `<${tag} class="fila ${clase}" ${attrs}>
    <div class="ico ${trans?"tr":ingreso?"ing":""}">${trans ? "🔁" : emojiCategoria(m.categoria, m.tipo)}</div>
    <div class="txt"><b>${esc(titulo)}</b><div class="meta">${esc(sub)}</div></div>
    <div class="der"><b class="${!trans && ingreso ? "pos" : ""}">${importe}</b>${fecha ? `<div class="meta">${fechaCorta(m.fecha)}</div>` : ""}</div>
  </${tag}>`;
}

// Agrupa por día (lista ya ordenada por fecha desc) y pinta con cabeceras «Hoy», «Ayer», «sáb 27 sep».
function listaPorDias(lista, pintar){
  let html = "", dia = null;
  lista.forEach(m=>{
    if(m.fecha!==dia){
      if(dia!==null) html += `</div>`;
      dia = m.fecha;
      html += `<div class="dia">${etiquetaDia(dia)}</div><div class="list">`;
    }
    html += pintar(m);
  });
  return dia===null ? "" : html + `</div>`;
}
