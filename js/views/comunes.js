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

const TITULOS_TAB = {"Resumen del mes":"Análisis","Comunidad":"Comunidad & Feedback"};
const ICONOS_MENU = {"Inicio":"🏠","Gastos":"💸","Resumen del mes":"📊","Presupuestos":"🧮","Movimientos":"📒","Cuentas":"👛","Deudas":"🤝","Recurrentes":"📅",
  "Inversiones":"🌱","Objetivos":"🎯","Proyección":"🔮","Categorías":"🏷️","Preferencias":"⚙️","Personalización":"🎨","Comunidad":"🌸"};
const LOGO_HUCHA = `<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="36" rx="22" ry="17" fill="#f7b3ac"/><circle cx="54" cy="36" r="6" fill="#f39c93"/><circle cx="52.5" cy="35" r="1.2" fill="#b8615a"/><circle cx="55.5" cy="35" r="1.2" fill="#b8615a"/><path d="M20 22l-2-9 9 5z" fill="#f39c93"/><circle cx="44" cy="30" r="2" fill="#4a3b3b"/><rect x="26" y="19" width="12" height="3" rx="1.5" fill="#b8615a"/><rect x="18" y="48" width="6" height="8" rx="3" fill="#f39c93"/><rect x="38" y="48" width="6" height="8" rx="3" fill="#f39c93"/></svg>`;

// Aviso amable en lo que es solo para premium. Aún no hay pago: premium se activa desde Supabase.
const TEXTO_PREMIUM = {
  "Proyección":"Mira cómo puede crecer tu dinero con escenarios a futuro.",
  "Personalización":"Elige tu color, un fondo a tu gusto o una foto tuya.",
  "compartir":"Lleva una cuenta a medias con tu pareja o tu piso: los dos veis y apuntáis sus movimientos."
};
function avisoPremium(que){
  return `
  <div class="card premium-aviso">
    <div class="premium-icono" aria-hidden="true">👑</div>
    <h2>Esto es de Premium</h2>
    <p>${TEXTO_PREMIUM[que]||""}</p>
    <p class="meta">Muy pronto podrás hacerte premium desde aquí.</p>
  </div>`;
}

function renderTabs(){
  document.getElementById("tabActual").textContent = TITULOS_TAB[tab] || tab;
  document.getElementById("ojoCab").innerHTML = botonOjo("btnOjo");
  document.getElementById("btnOjo").onclick = alternarPrivacidad;
  const item = t=>`<button class="menu-item ${t===tab?"active":""}" data-tab="${t}"><span class="mi">${ICONOS_MENU[t]||"•"}</span>${TITULOS_TAB[t]||t}${!esPremium && (TABS_PREMIUM.includes(t) || t==="Personalización") ? `<span class="marca-premium">Premium</span>` : ""}</button>`;
  document.getElementById("menuPanel").innerHTML =
    `<div class="menu-marca">${LOGO_HUCHA}Mis finanzas</div>` + item("Inicio") +
    GRUPOS_MENU.map(g=>`<div class="menu-group-title">${g.nombre}</div>${g.tabs.map(item).join("")}`).join("") +
    `<button class="menu-comunidad" data-tab="Comunidad"><strong>🌸 Comunidad &amp; Feedback</strong><span>Ideas, ayuda y supporters</span></button>` +
    (sinCuenta() ? `<button class="menu-item menu-guardar" id="menuGuardar"><span class="mi">💾</span>Crear cuenta y guardar mis datos</button>` : "") +
    `<button class="menu-item menu-salir" id="menuLogout"><span class="mi">↩</span>Cerrar sesión</button>`;
  document.querySelectorAll("#menuPanel [data-tab]").forEach(b=>b.onclick=()=>{ tab=b.dataset.tab; closeMenu(); render(); });
  document.getElementById("menuLogout").onclick = ()=>{ closeMenu(); cerrarSesion(); };
  const mg = document.getElementById("menuGuardar"); if(mg) mg.onclick = ()=>{ closeMenu(); guardarCuenta(); };
  document.querySelectorAll("[data-nav]").forEach(b=>{
    b.classList.toggle("active", b.dataset.nav===tab);
    b.onclick = ()=>{ tab = b.dataset.nav; closeMenu(); render(); window.scrollTo(0,0); };
  });
  const enNav = [...document.querySelectorAll("[data-nav]")].some(b=>b.dataset.nav===tab);
  document.getElementById("navMas").classList.toggle("active", !enNav && tab!=="Notificaciones");
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

// Gráficas interactivas (ver graficoInteractivo en helpers.js). Un único manejador para todas,
// porque las gráficas se vuelven a pintar con cada render.
function mostrarPuntoGrafico(g, clientX){
  let puntos = g._puntos;
  if(!puntos){ try{ puntos = g._puntos = JSON.parse(g.dataset.puntos); }catch(e){ return; } }
  if(!puntos.length) return;
  const r = g.getBoundingClientRect();
  const px = (clientX - r.left) / r.width * 100;
  const p = puntos.reduce((a,b)=>Math.abs(b.x-px) < Math.abs(a.x-px) ? b : a);
  if(g._actual===p) return;
  g._actual = p;
  g.querySelector(".graf-linea").style.left = p.x+"%";
  g.querySelectorAll(".graf-punto").forEach(d=>d.remove());
  p.s.forEach(s=>{
    const d = document.createElement("div");
    d.className = "graf-punto";
    d.style.cssText = `left:${p.x}%;top:${s.y}%;border-color:${s.c}`;
    g.appendChild(d);
  });
  const tip = g.querySelector(".graf-tip");
  tip.innerHTML = p.s.length===1
    ? `<b>${esc(p.s[0].v)}</b><span>${esc(p.t)}</span>`
    : `<span>${esc(p.t)}</span>` + p.s.map(s=>`<div><i style="background:${s.c}"></i>${esc(s.n)}: <b style="display:inline">${esc(s.v)}</b></div>`).join("");
  g.classList.add("activa");
  // Que el globo no se salga de la tarjeta por los lados.
  const mitad = tip.offsetWidth/2/r.width*100;
  tip.style.left = Math.min(Math.max(p.x, mitad), 100-mitad)+"%";
}

function ocultarGraficos(excepto){
  document.querySelectorAll(".graf-int.activa").forEach(g=>{
    if(g===excepto) return;
    g.classList.remove("activa"); g._actual = null;
    g.querySelectorAll(".graf-punto").forEach(d=>d.remove());
  });
}

document.addEventListener("pointerdown", e=>{
  const g = e.target.closest && e.target.closest(".graf-int");
  ocultarGraficos(g);
  if(g) mostrarPuntoGrafico(g, e.clientX);
});
document.addEventListener("pointermove", e=>{
  const g = e.target.closest && e.target.closest(".graf-int");
  if(g && (e.pointerType==="mouse" || e.buttons || g.classList.contains("activa"))) mostrarPuntoGrafico(g, e.clientX);
  else if(!g && e.pointerType==="mouse") ocultarGraficos();
});

// Confirmación en hoja inferior (sustituye a confirm()). Devuelve una promesa con true/false.
// El texto se parte solo: la primera pregunta «¿…?» es el título y el resto la explicación.
function confirmar(texto, opciones = {}){
  let titulo = opciones.titulo, cuerpo = texto;
  if(!titulo){
    const m = texto.match(/^(¿[^?]*\?)\s*([\s\S]*)$/) || texto.match(/^([\s\S]*?)\s*(¿[^?]*\?)\s*$/);
    if(m && m[1].startsWith("¿")){ titulo = m[1]; cuerpo = m[2]; }
    else if(m){ titulo = m[2]; cuerpo = m[1]; }
    else { titulo = "¿Seguro?"; }
  }
  const verbo = (titulo.match(/^¿\s*(\p{L}+)/u) || [])[1] || "";
  const base = verbo.replace(/(la|lo|las|los)$/i, "").toLowerCase();
  const ok = opciones.ok || (base ? `Sí, ${base}` : "Confirmar");
  const ICONOS = {borrar:"🗑️", archivar:"📦", deshacer:"↩️", restaurar:"💾", volver:"🎨"};
  const icono = opciones.icono || ICONOS[base] || "🐷";
  document.getElementById("hoja")?.remove();
  const cont = document.createElement("div");
  cont.id = "hoja";
  cont.innerHTML = `
    <div class="hoja-fondo"></div>
    <div class="hoja" role="dialog" aria-modal="true" aria-labelledby="hojaTitulo">
      <div class="hoja-asa"></div>
      <div class="hoja-ico">${icono}</div>
      <h2 id="hojaTitulo">${esc(titulo)}</h2>
      ${cuerpo ? `<p>${esc(cuerpo)}</p>` : ""}
      <div class="hoja-btns">
        <button class="hoja-no" id="hojaNo">Cancelar</button>
        <button class="hoja-si" id="hojaOk">${esc(ok)}</button>
      </div>
    </div>`;
  document.body.appendChild(cont);
  const previo = document.activeElement;
  requestAnimationFrame(()=>requestAnimationFrame(()=>cont.classList.add("abierta")));
  return new Promise(resolver=>{
    const cerrar = valor=>{
      document.removeEventListener("keydown", tecla);
      cont.classList.remove("abierta");
      setTimeout(()=>cont.remove(), 260);
      try{ previo && previo.focus && previo.focus({preventScroll:true}); }catch(e){}
      resolver(valor);
    };
    const tecla = e=>{ if(e.key==="Escape") cerrar(false); };
    document.addEventListener("keydown", tecla);
    cont.querySelector(".hoja-fondo").onclick = ()=>cerrar(false);
    cont.querySelector("#hojaNo").onclick = ()=>cerrar(false);
    cont.querySelector("#hojaOk").onclick = ()=>cerrar(true);
    setTimeout(()=>{ try{ cont.querySelector("#hojaOk").focus({preventScroll:true}); }catch(e){} }, 60);
  });
}

// Estados vacíos con ilustración: la hucha dormida o una nube sonriente con monedas.
const DIBUJOS_VACIO = {
  hucha: `<svg viewBox="0 0 124 96" width="112" height="87" aria-hidden="true">
    <text x="92" y="22" font-size="13" font-weight="800" fill="var(--muted)" font-family="Nunito,sans-serif" opacity=".7">z</text>
    <text x="102" y="12" font-size="10" font-weight="800" fill="var(--muted)" font-family="Nunito,sans-serif" opacity=".5">z</text>
    <rect x="34" y="72" width="11" height="14" rx="4" fill="#ef95a8"/><rect x="78" y="72" width="11" height="14" rx="4" fill="#ef95a8"/>
    <path d="M104 52c9-2 11-11 5-13s-7 6-1 7" fill="none" stroke="#ef95a8" stroke-width="3" stroke-linecap="round"/>
    <path d="M36 34 42 16 56 29Z" fill="#ef95a8" stroke="#ef95a8" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="64" cy="54" rx="42" ry="29" fill="#f8b6c3"/>
    <rect x="44" y="77" width="11" height="11" rx="4" fill="#f8b6c3"/><rect x="70" y="77" width="11" height="11" rx="4" fill="#f8b6c3"/>
    <ellipse cx="78" cy="42" rx="12" ry="6" fill="#fff" opacity=".35"/>
    <rect x="53" y="27" width="22" height="5" rx="2.5" fill="#d9788d"/>
    <ellipse cx="22" cy="57" rx="10" ry="12" fill="#ef95a8"/>
    <ellipse cx="19" cy="53" rx="2" ry="3" fill="#c9667c"/><ellipse cx="19" cy="61" rx="2" ry="3" fill="#c9667c"/>
    <path d="M34 47q5 4 10 0" fill="none" stroke="#4a3b3b" stroke-width="2.2" stroke-linecap="round"/>
    <ellipse cx="45" cy="60" rx="5.5" ry="3.2" fill="#f28ba0" opacity=".6"/>
  </svg>`,
  nube: `<svg viewBox="0 0 140 96" width="124" height="86" aria-hidden="true">
    <circle cx="22" cy="80" r="9" fill="#f6c453" stroke="#e0a82e" stroke-width="2"/><text x="22" y="84" text-anchor="middle" font-size="10" font-weight="800" fill="#b9831c" font-family="Nunito,sans-serif">€</text>
    <circle cx="108" cy="74" r="7" fill="#f6c453" stroke="#e0a82e" stroke-width="2"/><text x="108" y="77.5" text-anchor="middle" font-size="8" font-weight="800" fill="#b9831c" font-family="Nunito,sans-serif">€</text>
    <circle cx="96" cy="88" r="5" fill="#f6c453" stroke="#e0a82e" stroke-width="1.6"/>
    <path d="M32 66a18 18 0 0 1-2-35.9A26 26 0 0 1 80 20a21 21 0 0 1 34 12 17 17 0 0 1 0 34Z" fill="var(--card)" stroke="#bfe0f7" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="58" cy="42" r="3" fill="#4a3b3b"/><circle cx="80" cy="42" r="3" fill="#4a3b3b"/>
    <path d="M62 51q7 6 14 0" fill="none" stroke="#4a3b3b" stroke-width="2.4" stroke-linecap="round"/>
    <ellipse cx="51" cy="50" rx="5" ry="3" fill="#f7a8b8" opacity=".7"/><ellipse cx="87" cy="50" rx="5" ry="3" fill="#f7a8b8" opacity=".7"/>
  </svg>`
};

function vacio(dibujo, titulo, texto){
  return `<div class="vacio">${DIBUJOS_VACIO[dibujo] || DIBUJOS_VACIO.nube}<b>${titulo}</b>${texto ? `<span>${texto}</span>` : ""}</div>`;
}

// Modo privacidad: eur() devuelve «•••• €» y todo se vuelve a pintar. Se recuerda en este dispositivo.
function alternarPrivacidad(){
  ocultarSaldos = !ocultarSaldos;
  try{ localStorage.setItem("ocultarSaldos", ocultarSaldos ? "1" : ""); }catch(e){}
  render();
}

function botonOjo(id){
  const ojo = ocultarSaldos
    ? `<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.3 6.3A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 5.2-1.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>`
    : `<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>`;
  return `<button class="icono-btn ojo ${ocultarSaldos?"activo":""}" id="${id}" aria-label="${ocultarSaldos?"Mostrar importes":"Ocultar importes"}" aria-pressed="${ocultarSaldos}" title="${ocultarSaldos?"Mostrar importes":"Ocultar importes"}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ojo}</svg></button>`;
}
