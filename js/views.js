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
    cab.style.cssText = "display:flex;justify-content:space-between;align-items:center;cursor:pointer;gap:10px";
    h2.style.margin = "0";
    const etiqueta = document.createElement("span");
    etiqueta.style.cssText = "color:var(--accent);font-weight:800;font-size:13px;white-space:nowrap";
    card.insertBefore(cab, card.firstChild);
    cab.appendChild(h2); cab.appendChild(etiqueta);
    card.appendChild(cuerpo);
    const pintar = ()=>{
      const ab = formAbierto(clave);
      cuerpo.style.display = ab ? "block" : "none";
      etiqueta.textContent = ab ? "Ocultar" : "+ Añadir";
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
    await fetchAll();
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
  const years = Array.from(new Set([...movimientos.map(m=>Number((m.fecha||"").slice(0,4))).filter(Boolean), periodoAnio])).sort((a,b)=>b-a);
  document.getElementById("periodoBox").innerHTML = `
    <select id="selMes">
      <option value="todos" ${periodoMes==="todos"?"selected":""}>Total del año</option>
      ${MESES.map((m,i)=>`<option value="${i+1}" ${periodoMes===String(i+1)?"selected":""}>${m}</option>`).join("")}
    </select>
    <select id="selAnio">${years.map(y=>`<option value="${y}" ${y===periodoAnio?"selected":""}>${y}</option>`).join("")}</select>
  `;
  document.getElementById("selMes").onchange = e=>{periodoMes=e.target.value; render();};
  document.getElementById("selAnio").onchange = e=>{periodoAnio=Number(e.target.value); render();};
}

function closeMenu(){
  document.getElementById("menuPanel")?.classList.remove("open");
  document.getElementById("menuOverlay")?.classList.remove("open");
}

function renderTabs(){
  document.getElementById("tabActual").textContent = tab;
  document.getElementById("menuPanel").innerHTML =
    `<button class="menu-item ${tab==="Inicio"?"active":""}" data-tab="Inicio" style="margin-bottom:16px">🏠 Inicio</button>` +
    GRUPOS_MENU.map(g=>`
    <div class="menu-group-title">${g.nombre}</div>
    ${g.tabs.map(t=>`<button class="menu-item ${t===tab?'active':''}" data-tab="${t}">${t}${t==="Importar" && pendientes.length? ` (${pendientes.length})` : ""}</button>`).join("")}
  `).join("");
  document.querySelectorAll(".menu-item").forEach(b=>b.onclick=()=>{ tab=b.dataset.tab; closeMenu(); render(); });
  const menuBtn = document.getElementById("menuBtn");
  const overlay = document.getElementById("menuOverlay");
  if(menuBtn) menuBtn.onclick = ()=>{
    document.getElementById("menuPanel").classList.add("open");
    overlay.classList.add("open");
  };
  if(overlay) overlay.onclick = closeMenu;
  const rb = document.getElementById("btnRefrescar");
  if(rb) rb.onclick = ()=>conCarga(rb, "Actualizando…", async ()=>{ await fetchAll(); });
}

function renderBalance(){
  const enP = movimientosEfectivos();
  const ingresos = enP.filter(m=>m.tipo==="ingreso").reduce((s,m)=>s+m.importe,0);
  const ahorro = enP.filter(m=>m.tipo==="gasto" && m.categoria==="Inversión").reduce((s,m)=>s+m.importe,0);
  const gastado = enP.filter(m=>m.tipo==="gasto" && m.categoria!=="Inversión").reduce((s,m)=>s+m.importe,0);
  const disponible = (ingresos - ahorro) - gastado;
  const meDeben = deudas.filter(d=>d.direccion==="me_deben" && d.estado==="pendiente").reduce((s,d)=>s+d.importe,0);
  const debo = deudas.filter(d=>d.direccion==="debo" && d.estado==="pendiente").reduce((s,d)=>s+d.importe,0);
  const totalCuentas = cuentas.reduce((s,c)=>s+saldoCuenta(c),0);
  const totalInversiones = inversiones.filter(i=>i.estado==="activa").reduce((s,i)=>s+i.valorActual,0);
  const patrimonioNeto = totalCuentas + totalInversiones + meDeben - debo;
  const lbl = periodoMes==="todos" ? `Año ${periodoAnio}` : `${MESES[Number(periodoMes)-1]} ${periodoAnio}`;
  document.getElementById("balanceBox").innerHTML = `
    <div><div class="num pos">${eur(ingresos)}</div><div class="lbl">Ingresos · ${lbl}</div></div>
    <div><div class="num ${disponible>=0?'pos':'neg'}">${eur(disponible)}</div><div class="lbl">Disponible para gastar</div></div>
    <div><div class="num ${patrimonioNeto>=0?'pos':'neg'}">${eur(patrimonioNeto)}</div><div class="lbl">Patrimonio neto</div></div>
    <div><div class="num pos">${eur(meDeben)}</div><div class="lbl">Me deben (total)</div></div>
    <div><div class="num neg">${eur(debo)}</div><div class="lbl">Debo (total)</div></div>
  `;
}

function opcionesCuentas(selectedId, sinDefecto){
  const sel = selectedId || (sinDefecto ? "" : cuentaPorDefecto());
  return cuentas.map(c=>`<option value="${c.id}"${c.id===sel?" selected":""}>${esc(c.nombre)}</option>`).join("");
}

function renderInicio(){
  const hoy = new Date();
  const totalInversiones = inversiones.filter(i=>i.estado==="activa").reduce((s,i)=>s+i.valorActual,0);
  const meDeben = deudas.filter(d=>d.direccion==="me_deben" && d.estado==="pendiente").reduce((s,d)=>s+d.importe,0);
  const debo = deudas.filter(d=>d.direccion==="debo" && d.estado==="pendiente").reduce((s,d)=>s+d.importe,0);
  const patNeto = patrimonioActual() + meDeben - debo;
  const patFin = esPeriodoActualReal() ? patNeto : patrimonioEnFecha(finPeriodoCorte());
  const patIni = patrimonioEnFecha(inicioPeriodoSeleccionado());
  const delta = Math.round((patFin-patIni)*100)/100;
  const lbl = periodoMes==="todos" ? `Año ${periodoAnio}` : `${MESES[Number(periodoMes)-1]} ${periodoAnio}`;

  const enP = movimientosEfectivos();
  const ingresos = enP.filter(m=>m.tipo==="ingreso").reduce((s,m)=>s+m.importe,0);
  const inversionMes = enP.filter(m=>m.tipo==="gasto" && m.categoria==="Inversión").reduce((s,m)=>s+m.importe,0);
  const gastosReales = enP.filter(m=>m.tipo==="gasto" && m.categoria!=="Inversión").reduce((s,m)=>s+m.importe,0);
  const ahorroMes = ingresos - gastosReales;
  const disponible = ahorroMes - inversionMes;

  const enCurso = objetivos.filter(o=>!objetivoCompletado(o)).sort(porOrden);
  const bloqueObjetivos = objetivos.length ? `
  <div class="card">
    <h2>🎯 Mis objetivos</h2>
    ${enCurso.length? `
    <div class="list" style="margin-top:8px">
      ${enCurso.slice(0,4).map(o=>{
        const actual = Math.max(progresoObjetivo(o),0);
        const pct = o.meta>0 ? Math.min(actual/o.meta*100,100) : 0;
        return `
        <div>
          <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:5px">
            <span>${emojiObjetivo(o.nombre)} ${esc(o.nombre)}</span>
            <strong>${pct.toFixed(0)}%</strong>
          </div>
          <div style="height:7px;background:var(--line);border-radius:999px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:999px"></div>
          </div>
        </div>`;
      }).join("")}
    </div>` : `<p class="meta" style="margin:8px 0 0">Todos tus objetivos están conseguidos 🎉</p>`}
    <button class="btn ghost" data-ir-tab="Objetivos" style="margin-top:14px">Ver todos los objetivos</button>
  </div>` : `
  <div class="card">
    <h2>🎯 Mis objetivos</h2>
    <p class="meta" style="margin:8px 0 12px">Aún no tienes ningún objetivo de ahorro.</p>
    <button class="btn" data-ir-tab="Objetivos">Crear un objetivo</button>
  </div>`;

  const {valores:valoresPat, etiquetas:etiquetasPat} = serieRango(patrimonioRango);
  const cambioPat = valoresPat.length>1 ? Math.round((valoresPat[valoresPat.length-1]-valoresPat[0])*100)/100 : 0;
  const RANGOS_PAT = [["max","Máx"],["1a","1 año"],["6m","6 meses"],["1m","1 mes"],["1d","1 día"]];

  return `
  <div class="card">
    <h2>💰 Mi situación</h2>
    <div class="meta" style="margin-top:6px">Patrimonio neto</div>
    <div style="font-size:32px;font-weight:800;letter-spacing:-0.02em;font-variant-numeric:tabular-nums" class="${patNeto>=0?'':'neg'}">${eur(patNeto)}</div>
    <div class="meta ${delta>=0?'pos':'neg'}" style="font-weight:700;margin-top:2px">${delta>=0?"📈 +":"📉 "}${eur(Math.abs(delta))} en ${lbl}</div>
    <div class="balance" style="margin-top:18px">
      <div><div class="num">${eur(disponible)}</div><div class="lbl">Disponible</div></div>
      <div><div class="num">${eur(totalInversiones)}</div><div class="lbl">Inversiones</div></div>
      <div><div class="num pos">${eur(meDeben)}</div><div class="lbl">Me deben</div></div>
      <div><div class="num neg">${eur(debo)}</div><div class="lbl">Debo</div></div>
    </div>
  </div>
  ${bloqueObjetivos}
  <div class="card">
    <h2>📅 ${lbl}</h2>
    <div class="balance" style="margin-top:6px">
      <div><div class="num pos">${eur(ingresos)}</div><div class="lbl">Ingresos</div></div>
      <div><div class="num neg">${eur(gastosReales)}</div><div class="lbl">Gastos</div></div>
      <div><div class="num">${eur(ahorroMes)}</div><div class="lbl">Ahorro</div></div>
      <div><div class="num">${eur(inversionMes)}</div><div class="lbl">Inversión</div></div>
    </div>
  </div>
  <div class="card">
    <h2>📈 Patrimonio</h2>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 12px">
      ${RANGOS_PAT.map(([v,t])=>`<button class="btn ghost" data-rango-pat="${v}" style="${patrimonioRango===v?'background:var(--accent);color:#fff;border-color:var(--accent)':''}">${t}</button>`).join("")}
    </div>
    ${graficoPatrimonio(valoresPat, etiquetasPat)}
    <p class="meta ${cambioPat>=0?'pos':'neg'}" style="margin-top:8px;font-weight:600">${cambioPat>=0?"+":""}${eur(cambioPat)} en este periodo</p>
    <p class="meta" style="margin-top:2px">Estimación a partir de tus movimientos.</p>
  </div>`;
}

function bloqueResultadoProyeccion(r){
  const inicialV = r.escenarios[0].data[0];
  const aportado = inicialV + proy.aporte*12*r.anios;
  return `
  <div class="card">
    <h2>Dentro de ${r.anios} año${r.anios===1?"":"s"}</h2>
    <div class="list" style="margin-top:4px">
      ${r.escenarios.map(e=>`
        <div class="item">
          <div><strong>${e.nombre}</strong><div class="meta">${e.tasa.toFixed(1)}% anual</div></div>
          <div class="amt" style="color:${e.color}">${eur(e.data[e.data.length-1])}</div>
        </div>`).join("")}
    </div>
    <div class="meta" style="margin-top:10px">Habrás aportado ${eur(aportado)} en total (capital inicial incluido); el resto es lo que habría crecido.</div>
  </div>
  <div class="card">
    <h2>Crecimiento año a año</h2>
    ${graficoLineasProyeccion(r.escenarios, r.anios)}
    <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px">
      ${r.escenarios.map(e=>`<span class="meta" style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:50%;background:${e.color}"></span>${e.nombre}</span>`).join("")}
    </div>
    <button class="btn ghost" id="proyToggleDetalle" style="margin-top:12px">${proy.detalle? "Ocultar detalle año a año" : "Ver detalle año a año"}</button>
    ${proy.detalle? `
    <div class="list" style="margin-top:10px">
      ${r.escenarios[0].data.map((_,i)=> i===0? "" : `
      <div class="item">
        <div>Año ${i}</div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:flex-end">
          ${r.escenarios.map(e=>`<span class="meta" style="color:${e.color};font-weight:600">${eur(e.data[i])}</span>`).join("")}
        </div>
      </div>`).join("")}
    </div>` : ""}
  </div>`;
}

function renderProyeccion(){
  if(proy.inicial === null) proy.inicial = Math.round(patrimonioActual()*100)/100;
  return `
  <div class="card">
    <h2>Proyección de patrimonio</h2>
    <p class="meta" style="margin:0 0 10px">Calcula cómo podría crecer tu dinero con aportaciones periódicas. Es una estimación, no una garantía: los mercados no crecen de forma constante.</p>
    <div class="row2">
      <div><label>Capital inicial (€)</label><input type="number" step="0.01" id="proyInicial" value="${proy.inicial}"></div>
      <div><label>Aportación mensual (€)</label><input type="number" step="0.01" id="proyAporte" value="${proy.aporte}"></div>
    </div>
    <div class="row2">
      <div><label>Años</label><input type="number" step="1" min="1" max="60" id="proyAnios" value="${proy.anios}"></div>
      <div><label>Rentabilidad anual estimada (%)</label><input type="number" step="0.1" id="proyTasa" value="${proy.tasa}"></div>
    </div>
    <p class="meta" style="margin:8px 0 0">Conservador y optimista se calculan solos: 2 puntos por debajo y por encima de la rentabilidad que pongas.</p>
    <button class="btn" id="proyCalcular" style="margin-top:10px">Calcular</button>
  </div>
  ${proyResultado? bloqueResultadoProyeccion(proyResultado) : ""}`;
}

function bloqueGraficaCategoria(titulo, desc, tipo){
  if(!desc.length) return `<div class="card"><p class="meta" style="margin:0">Sin movimientos en este periodo.</p></div>`;
  const totalGrafica = desc.reduce((sum,d)=>sum+d.total,0);
  return `
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">
      <h2 style="margin:0">${titulo}</h2>
      <strong style="font-size:15px;font-variant-numeric:tabular-nums">${eur(totalGrafica)}</strong>
    </div>
    <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;margin-top:10px">
      ${donutClicable(desc, tipo)}
      <div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:180px">
        ${desc.map(d=>`
          <button data-resumen-sel="${tipo}|${esc(d.categoria)}" style="display:flex;align-items:center;gap:8px;background:none;border:none;padding:5px 0;cursor:pointer;text-align:left;color:var(--ink);font-family:inherit;font-size:13px;width:100%">
            <span style="width:12px;height:12px;border-radius:50%;background:${d.color};flex-shrink:0"></span>
            <span style="flex:1">${esc(d.categoria)}</span>
            <span class="meta" style="white-space:nowrap">${eur(d.total)} · ${d.pct.toFixed(0)}%</span>
          </button>`).join("")}
      </div>
    </div>
  </div>`;
}

function renderResumen(){
  const enP = movimientosEfectivos();
  const ingresosList = enP.filter(m=>m.tipo==="ingreso");
  const ahorroList = enP.filter(m=>m.tipo==="gasto" && m.categoria==="Inversión");
  const gastosList = enP.filter(m=>m.tipo==="gasto" && m.categoria!=="Inversión" && m.importe>0);
  const descIngresos = desglosePorCategoria(ingresosList);
  const descGastos = desglosePorCategoria(gastosList);
  const totalAhorro = ahorroList.reduce((s,m)=>s+m.importe,0);
  const lbl = periodoMes==="todos" ? `Año ${periodoAnio}` : `${MESES[Number(periodoMes)-1]} ${periodoAnio}`;

  let detalle = "";
  if(resumenSel){
    const lista = (resumenSel.tipo==="ingreso"?ingresosList:gastosList).filter(m=>m.categoria===resumenSel.categoria);
    const desc = resumenSel.tipo==="ingreso"?descIngresos:descGastos;
    const info = desc.find(d=>d.categoria===resumenSel.categoria);
    if(lista.length && info){
      detalle = `
      <div class="card">
        <h2>${esc(resumenSel.categoria)}</h2>
        <div class="balance" style="margin-top:8px">
          <div><div class="num">${eur(info.total)}</div><div class="lbl">Total</div></div>
          <div><div class="num">${lista.length}</div><div class="lbl">Movimientos</div></div>
          <div><div class="num">${info.pct.toFixed(1)}%</div><div class="lbl">Del total</div></div>
        </div>
        <div class="list" style="margin-top:12px">
          ${[...lista].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(m=>`
            <div class="item"><div>${esc(m.nota||m.categoria)}<div class="meta">${m.fecha}</div></div><div class="amt ${resumenSel.tipo==='ingreso'?'pos':'neg'}">${eur(m.importe)}</div></div>
          `).join("")}
        </div>
      </div>`;
    }
  }

  const bloqueAhorro = ahorroList.length ? `
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" data-toggle-ahorro="1">
      <div><strong>Ahorro / Inversión</strong><div class="meta">${ahorroList.length} movimiento${ahorroList.length>1?"s":""} · no cuenta como consumo</div></div>
      <div class="amt neg">${eur(totalAhorro)}</div>
    </div>
    ${resumenAhorroAbierto? `
    <div class="list" style="margin-top:12px">
      ${[...ahorroList].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(m=>`
        <div class="item"><div>${esc(m.nota||"Aportación")}<div class="meta">${m.fecha}</div></div><div class="amt neg">${eur(m.importe)}</div></div>
      `).join("")}
    </div>` : ""}
  </div>` : `<div class="card"><p class="meta" style="margin:0">Sin ahorro/inversión en este periodo.</p></div>`;

  return `
  <div class="section-title">Resumen · ${lbl}</div>
  ${bloqueGraficaCategoria("Ingresos por categoría", descIngresos, "ingreso")}
  ${bloqueGraficaCategoria("Gastos reales por categoría", descGastos, "gasto")}
  ${bloqueAhorro}
  ${detalle}`;
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

function renderPendientes(){
  if(!pendientes.length) return "";
  const lista = [...pendientes].sort((a,b)=> b.fecha.localeCompare(a.fecha) || (a.posicion-b.posicion));
  return `
  <div class="card">
    <h2>Pendientes de confirmar (${pendientes.length})</h2>
    <p class="meta" style="margin:0 0 10px">Aún no cuentan en tus saldos ni en tus gastos. La descripción y el saldo son los del banco. Elige la categoría de cada uno y confírmalo.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <button class="btn" id="pendConfirmarTodos">Confirmar los que tienen categoría</button>
      <button class="btn ghost" id="pendDescartarTodos">Descartar todos</button>
    </div>
    <div class="list">
      ${lista.map(p=>`
      <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div style="min-width:0;word-break:break-word">
            <strong style="font-weight:600">${esc(p.descripcion) || "(sin descripción)"}</strong>
            <div class="meta">${p.fecha} · ${cuentaNombre(p.cuentaId)}${p.saldo!=null?` · Saldo ${eur(p.saldo)}`:""}</div>
          </div>
          <div class="amt ${p.tipo==='ingreso'?'pos':'neg'}">${p.tipo==='ingreso'?'+':'-'}${eur(p.importe)}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select id="pendCat-${p.id}" style="flex:1;min-width:150px">${opcionesCategoriaPend(p.tipo, pendCats[p.id] ?? sugerirCategoria(p.descripcion, p.tipo))}</select>
          <button class="btn" data-pend-confirmar="${p.id}">Confirmar</button>
          <button class="btn ghost" data-pend-descartar="${p.id}">Descartar</button>
        </div>
      </div>`).join("")}
    </div>
  </div>`;
}

function renderImportar(){
  const sel = (id, actual, conNinguna)=>`<select id="${id}">${conNinguna?`<option value="">— Ninguna —</option>`:""}${csvHeaders.map(h=>`<option value="${esc(h)}"${h===actual?" selected":""}>${esc(h)}</option>`).join("")}</select>`;
  const invalidas = csvPreview.filter(m=>m.invalida);
  const yaEnPendientes = csvPreview.filter(m=>!m.invalida && m.dup);
  const conciliables = csvPreview.filter(m=>!m.invalida && !m.dup && m.matchId);
  const nuevos = csvPreview.filter(m=>!m.invalida && !m.dup && !m.matchId);
  const aImportar = nuevos.length + conciliables.filter((m,i)=>csvDecisiones[m.posicion]==="distinto").length;

  let bloqueSinExtracto = "";
  if(csvPreview.length && csvPreviewCuentaId){
    const validas = csvPreview.filter(m=>!m.invalida);
    if(validas.length){
      const fechas = validas.map(m=>m.fecha).sort();
      const desde = fechas[0], hasta = fechas[fechas.length-1];
      const idsEmparejados = new Set(validas.filter(m=>m.matchId).map(m=>m.matchId));
      const sinAparecer = movimientos.filter(m=>m.cuentaId===csvPreviewCuentaId && m.fecha>=desde && m.fecha<=hasta && !idsEmparejados.has(m.id) && m.categoria!=="Ajuste");
      if(sinAparecer.length){
        bloqueSinExtracto = `
        <div class="card">
          <h2>No aparecen en este extracto (${sinAparecer.length})</h2>
          <p class="meta" style="margin:0 0 10px">Los tienes apuntados entre ${desde} y ${hasta}, pero ninguna línea del banco encaja con ellos. Puede que aún no se hayan cargado, o que estén mal apuntados.</p>
          <div class="list">
            ${sinAparecer.sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(m=>`
              <div class="item"><div>${esc(m.nota||m.categoria)}<div class="meta">${m.fecha}</div></div><div class="amt ${m.tipo==='ingreso'?'pos':'neg'}">${eur(m.importe)}</div></div>
            `).join("")}
          </div>
        </div>`;
      }
    }
  }

  return `
  ${renderPendientes()}
  <div class="card">
    <h2>Importar y conciliar extracto del banco (CSV)</h2>
    <p class="meta" style="margin:0 0 10px">Sube el CSV del banco. Cada línea se compara con lo que ya tienes apuntado (mismo importe, fecha cercana) para no duplicar nada. Lo nuevo se guarda como pendiente de confirmar hasta que le pongas categoría.</p>
    <input type="file" id="csvFile" accept=".csv,text/csv,text/plain">
  </div>
  ${csvHeaders.length? `
  <div class="card">
    <h2>Columnas del archivo</h2>
    <div class="row2">
      <div><label>Fecha</label>${sel("csvColFecha", csvSel.fecha, false)}</div>
      <div><label>Importe</label>${sel("csvColImporte", csvSel.importe, false)}</div>
    </div>
    <div class="row2" style="margin-top:10px">
      <div><label>Descripción / concepto</label>${sel("csvColNota", csvSel.nota, true)}</div>
      <div><label>Saldo (opcional)</label>${sel("csvColSaldo", csvSel.saldo, true)}</div>
    </div>
    <div style="margin-top:10px"><label>Cuenta</label>${cuentas.length?`<select id="csvCuenta">${opcionesCuentas(csvSel.cuenta)}</select>`:`<div class="meta">Crea antes una cuenta.</div>`}</div>
    <button class="btn" id="csvPrevisualizar" style="margin-top:12px" ${cuentas.length?"":"disabled"}>Previsualizar</button>
  </div>` : ""}
  ${csvPreview.length? `
  <div class="card">
    <h2>Resultado de la conciliación</h2>
    <p class="meta" style="margin:0 0 10px">${conciliables.length} ya los tenías apuntados · ${nuevos.length} son nuevos${yaEnPendientes.length?` · ${yaEnPendientes.length} ya estaban en pendientes`:""}${invalidas.length?` · ${invalidas.length} con fecha no válida`:""}.</p>
  </div>
  ${conciliables.length? `
  <div class="card">
    <h2>Ya los tenías apuntados (${conciliables.length})</h2>
    <p class="meta" style="margin:0 0 10px">Misma cantidad y fecha cercana a un movimiento tuyo. Si es el mismo, se marca como conciliado y no se importa de nuevo. Si es otro distinto que coincidió por casualidad, dile que lo importe también.</p>
    <div class="list">
      ${conciliables.map(m=>{
        const ex = movimientos.find(x=>x.id===m.matchId);
        const decision = csvDecisiones[m.posicion] || "igual";
        return `
        <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
          <div style="display:flex;justify-content:space-between;gap:10px">
            <div style="min-width:0">
              <div class="meta">Banco: ${esc(m.nota)||"(sin descripción)"} · ${m.fecha}</div>
              <div class="meta">Tuyo: ${ex? esc(ex.nota||ex.categoria) : "—"} · ${ex?ex.fecha:""}</div>
            </div>
            <div class="amt ${m.tipo==='ingreso'?'pos':'neg'}">${eur(m.importe)}</div>
          </div>
          <select data-decision="${m.posicion}">
            <option value="igual"${decision==="igual"?" selected":""}>Es el mismo movimiento</option>
            <option value="distinto"${decision==="distinto"?" selected":""}>Es distinto, impórtalo también</option>
          </select>
        </div>`;
      }).join("")}
    </div>
  </div>` : ""}
  <div class="card">
    <h2>Nuevos, se guardarán como pendientes (${aImportar})</h2>
    <div class="list">
      ${[...nuevos, ...conciliables.filter(m=>(csvDecisiones[m.posicion]||"igual")==="distinto")].slice(0,15).map(m=>`
        <div class="item">
          <div style="min-width:0;word-break:break-word">${esc(m.nota)||"(sin descripción)"}<div class="meta">${esc(m.fecha)||"—"}${m.saldo!=null?` · Saldo ${eur(m.saldo)}`:""}</div></div>
          <div class="amt ${m.tipo==='ingreso'?'pos':'neg'}">${m.tipo==='ingreso'?'+':'-'}${eur(m.importe)}</div>
        </div>`).join("")}
      ${aImportar>15? `<div class="empty">... y ${aImportar-15} más</div>` : ""}
      ${aImportar===0? `<div class="empty">Nada nuevo que importar.</div>` : ""}
    </div>
    <button class="btn" id="csvImportar" style="margin-top:12px">Confirmar conciliación</button>
  </div>
  ` : ""}
  ${bloqueSinExtracto}`;
}

function renderPreferencias(){
  const def = cuentaPorDefecto();
  return `
  <div class="card">
    <h2>Cuenta por defecto</h2>
    <p class="meta" style="margin:0 0 10px">Es la cuenta que aparece ya seleccionada cuando añades un movimiento, aportas o rescatas de una inversión, saldas una deuda o importas un extracto. Siempre puedes elegir otra en cada caso.</p>
    ${cuentas.length? `<select id="prefCuenta"><option value="">Ninguna (la primera de la lista)</option>${cuentas.map(c=>`<option value="${c.id}"${c.id===def?" selected":""}>${esc(c.nombre)}</option>`).join("")}</select>` : `<div class="meta">Crea antes una cuenta en la pestaña "Cuentas".</div>`}
    <div class="meta" id="prefEstado" style="margin-top:8px"></div>
  </div>
  <div class="card">
    <h2>Formularios para añadir</h2>
    <p class="meta" style="margin:0 0 10px">Los huecos para añadir un movimiento, una deuda, una cuenta, una inversión, etc. pueden salir desplegados o contraídos al entrar. Se abren y cierran tocando su título. Esta preferencia se guarda en este dispositivo.</p>
    <select id="prefForms">
      <option value="abiertos"${formsPorDefecto==="abiertos"?" selected":""}>Desplegados por defecto</option>
      <option value="cerrados"${formsPorDefecto==="cerrados"?" selected":""}>Contraídos por defecto</option>
    </select>
  </div>
  <div class="card">
    <h2>Copia de seguridad</h2>
    <p class="meta" style="margin:0 0 10px">Descarga un archivo con todos tus datos (movimientos, cuentas, deudas, inversiones, presupuestos, objetivos, categorías...) tal como están ahora mismo. Sirve para guardarlo tú, no para restaurarlo automáticamente en la app.</p>
    <button class="btn" id="btnExportar">Descargar copia (.json)</button>
  </div>`;
}

function renderObjetivos(){
  const pendientes = objetivos.filter(o=>!objetivoCompletado(o));
  const conseguidos = objetivos.length - pendientes.length;
  const metaPend = pendientes.reduce((s,o)=>s+o.meta,0);
  const ahorradoPend = pendientes.reduce((s,o)=>s+Math.min(Math.max(progresoObjetivo(o),0), o.meta),0);
  const pctPend = metaPend>0 ? ahorradoPend/metaPend*100 : 0;
  const resumen = objetivos.length ? `
  <div class="card">
    <h2>Tus objetivos</h2>
    <div class="balance" style="margin-top:6px">
      <div><div class="num">${pendientes.length}</div><div class="lbl">En curso</div></div>
      <div><div class="num pos">${conseguidos}</div><div class="lbl">Conseguidos</div></div>
      <div><div class="num">${eur(metaPend)}</div><div class="lbl">Meta total (en curso)</div></div>
    </div>
    ${pendientes.length? `
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-top:14px">
      <span class="meta">${eur(ahorradoPend)} de ${eur(metaPend)}</span>
      <strong style="font-size:15px">${pctPend.toFixed(0)}% de la meta</strong>
    </div>
    <div style="height:8px;background:var(--line);border-radius:999px;margin-top:6px;overflow:hidden"><div style="height:100%;width:${pctPend}%;background:var(--accent);border-radius:999px"></div></div>` : `<div class="meta" style="margin-top:12px">Todos tus objetivos están conseguidos.</div>`}
  </div>` : "";
  const enCurso = objetivos.filter(o=>!objetivoCompletado(o)).sort(porOrden);
  const completados = objetivos.filter(objetivoCompletado).sort(porOrden);
  const tarjeta = (o,k,n)=>{
    const actual = progresoObjetivo(o);
    const pct = o.meta>0 ? Math.min(actual/o.meta*100,100) : 0;
    const hecho = o.meta>0 && actual>=o.meta;
    const col = hecho ? "var(--pos)" : "var(--accent)";
    return `
    <div class="sort-item" data-sort-id="${o.id}"><div class="card"${hecho?' style="border-color:var(--pos)"':''}>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:14px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">${n>1? gripHtml() : ""}<h2 style="margin:0">${esc(o.nombre)}</h2></div>
          ${o.tipoVinculo!=="ninguno"?`<span class="tag">${nombreVinculo(o)}</span>`:`<span class="meta">Sin vincular: el progreso no se actualiza solo</span>`}
          <div style="font-size:14px;margin-top:8px"><strong>${eur(actual)}</strong> <span class="meta">de ${eur(o.meta)}</span></div>
          <div style="height:8px;background:var(--line);border-radius:999px;margin-top:8px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${col};border-radius:999px"></div>
          </div>
          <div class="meta" style="margin-top:6px;${hecho?'color:var(--pos);font-weight:700':''}">${hecho? "Objetivo conseguido" : `Te faltan ${eur(Math.max(o.meta-actual,0))}`}</div>
        </div>
        <div style="width:68px;height:68px;border-radius:50%;background:conic-gradient(${col} ${pct*3.6}deg, var(--line) 0);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <div style="width:52px;height:52px;border-radius:50%;background:var(--card);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px">${pct.toFixed(0)}%</div>
        </div>
      </div>
      ${o.autoActivo? `<div class="meta" style="margin-top:8px">Aporta ${eur(o.autoCuota)} el día ${o.autoDiaMes} de cada mes desde ${cuentaNombre(o.autoCuentaOrigen)}</div>` : ""}
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        ${(()=>{
          const invVinculo = o.tipoVinculo==="inversion" ? inversiones.find(i=>i.id===o.vinculoId) : null;
          const puedeAuto = o.tipoVinculo==="cuenta" || (o.tipoVinculo==="inversion" && invVinculo && !invVinculo.esGrupo);
          if(!puedeAuto) return "";
          return `<button class="btn ghost" data-toggle-auto-obj="${o.id}">${o.autoActivo?"Editar aportación automática":"Aportación automática"}</button>`;
        })()}
        <button class="btn ghost" data-del-objetivo="${o.id}">Borrar</button>
      </div>
      ${editarAutoObjId===o.id? `
      <div class="item" style="flex-direction:column;align-items:stretch;gap:8px;margin-top:10px">
        <label>Cuota mensual (€)</label>
        <input type="number" step="0.01" min="0.01" id="autoObjCuota" value="${o.autoCuota||''}">
        <label>Día del mes</label>
        <input type="number" min="1" max="28" id="autoObjDia" value="${o.autoDiaMes||1}">
        <label>Cuenta de origen</label>
        <select id="autoObjCuenta">${opcionesCuentas(o.autoCuentaOrigen || cuentaPorDefecto())}</select>
        <p class="meta" style="margin:0">Cada mes se ${o.tipoVinculo==="cuenta"?"transfiere":"aporta"} esa cantidad desde esta cuenta a "${esc(o.nombre)}", sin que tengas que hacerlo tú.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" data-confirmar-auto-obj="${o.id}">Guardar y activar</button>
          ${o.autoActivo? `<button class="btn ghost" data-desactivar-auto-obj="${o.id}">Desactivar</button>` : ""}
          <button class="btn ghost" data-cancelar-auto-obj="1">Cancelar</button>
        </div>
      </div>` : ""}
    </div></div>`;
  };
  return `
  <div class="card">
    <h2>Nuevo objetivo</h2>
    <form id="fObjetivo">
      <div class="row2">
        <div><label>Nombre</label><input name="nombre" placeholder="ej. Entrada de vivienda" required></div>
        <div><label>Meta (€)</label><input name="meta" type="number" step="0.01" min="0" required></div>
      </div>
      <label>Vincular a</label>
      <select name="tipoVinculo" id="objTipoVinculo">
        <option value="ninguno">Sin vincular (solo la meta)</option>
        <option value="cuenta">Una cuenta</option>
        <option value="inversion">Una inversión o grupo</option>
      </select>
      <div id="objVinculoWrap" style="display:none">
        <label>Elige cuál</label>
        <select name="vinculoId" id="objVinculoSelect"></select>
      </div>
      <button class="btn" type="submit">Añadir</button>
    </form>
  </div>
  ${resumen}
  ${completados.length && enCurso.length ? `<div class="section-title">En curso (${enCurso.length})</div>` : ""}
  ${enCurso.length ? `<div data-sortable="ordenar_objetivos">${enCurso.map((o,k)=>tarjeta(o,k,enCurso.length)).join("")}</div>` : ""}
  ${completados.length ? `<div class="section-title">Completados (${completados.length})</div><div data-sortable="ordenar_objetivos">${completados.map((o,k)=>tarjeta(o,k,completados.length)).join("")}</div>` : ""}
  ${objetivos.length ? "" : `<div class="card"><div class="empty" style="padding:20px 10px">Sin objetivos todavía. Crea el primero abajo.</div></div>`}
`;
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
// Cuánto de cada gasto te han devuelto ya (reembolsos cobrados). Las deudas pendientes
// NO cuentan: hasta que se salden, el gasto sigue contando entero.

function recurrenteItem(r){
  return `
  <div class="item">
    <div style="min-width:0">
      <strong>${esc(r.categoria)}</strong>
      <span class="tag">${r.tipo==="ingreso"?"Ingreso":"Gasto"}</span>
      ${!r.activo?'<span class="tag">Pausado</span>':''}
      ${r.nota?`<div class="meta">${esc(r.nota)}</div>`:""}
      <div class="meta">${cuentaNombre(r.cuentaId)} · día ${r.diaMes} de cada mes</div>
      <div class="meta">${r.activo? "Próxima: "+proximaFechaRecurrente(r) : "En pausa, no genera movimientos"}</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
      <div class="amt ${r.tipo==='ingreso'?'pos':'neg'}">${eur(r.importe)}</div>
      <div style="display:flex;gap:6px">
        <button class="btn ghost" data-toggle-recurrente="${r.id}">${r.activo?"Pausar":"Reanudar"}</button>
        <button class="btn ghost" data-del-recurrente="${r.id}">Borrar</button>
      </div>
    </div>
  </div>`;
}

function renderRecurrentes(){
  const items = [...recurrentes].sort((a,b)=> (a.activo===b.activo?0:(a.activo?-1:1)) || a.categoria.localeCompare(b.categoria));
  return `
  <div class="card">
    <h2>Nuevo recurrente</h2>
    <p class="meta" style="margin:0 0 10px">Para suscripciones, nóminas u otros pagos o ingresos que se repiten cada mes. Se generan solos en la fecha que digas, sin que tengas que apuntarlos.</p>
    <form id="fRecurrente">
      <div class="row2">
        <div><label>Tipo</label><select name="tipo" id="recTipo"><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option></select></div>
        <div><label>Importe (€)</label><input name="importe" type="number" step="0.01" min="0" required></div>
      </div>
      <div class="row2">
        <div><label>Categoría</label><select name="categoria" id="recCategoria" required></select></div>
        <div><label>Día del mes</label><input name="diaMes" type="number" min="1" max="28" value="1" required></div>
      </div>
      <div><label>Nota (opcional)</label><input name="nota" placeholder="ej. Netflix"></div>
      <div class="row2">
        <div><label>Cuenta</label>${cuentas.length? `<select name="cuentaId">${opcionesCuentas()}</select>` : `<div class="meta">Crea antes una cuenta.</div>`}</div>
        <div><label>Empieza el</label><input name="fechaInicio" type="date" value="${today()}" required></div>
      </div>
      <p class="meta" style="margin:0">El día máximo es 28 para que funcione igual en todos los meses, incluido febrero.</p>
      <button class="btn" type="submit" ${cuentas.length?"":"disabled"}>Añadir</button>
    </form>
  </div>
  <div class="section-title">Recurrentes (${items.length})</div>
  <div class="list">
    ${items.length? items.map(recurrenteItem).join("") : `<div class="empty">Sin gastos o ingresos recurrentes todavía.</div>`}
  </div>`;
}

function renderPresupuestos(){
  const enP = movimientosEfectivos().filter(m=>m.tipo==="gasto" && m.categoria!=="Inversión");
  const cubiertoCat = {};
  const gastoPorCat = {};
  enP.forEach(m=>{ gastoPorCat[m.categoria] = (gastoPorCat[m.categoria]||0) + m.importe; if(m.cubierto) cubiertoCat[m.categoria] = (cubiertoCat[m.categoria]||0) + m.cubierto; });
  const catsGasto = categorias.filter(c=>c.tipo==="gasto").map(c=>c.nombre);
  const catsSinPresupuesto = catsGasto.filter(c=>!presupuestos.some(p=>p.categoria===c));
  const lbl = periodoMes==="todos" ? `Año ${periodoAnio}` : `${MESES[Number(periodoMes)-1]} ${periodoAnio}`;
  const mult = periodoMes==="todos" ? 12 : 1;
  const totalLimite = presupuestos.reduce((s,p)=>s+p.limite*mult,0);
  const totalGastado = presupuestos.reduce((s,p)=>s+(gastoPorCat[p.categoria]||0),0);
  const totalPct = totalLimite>0 ? Math.max(0, totalGastado/totalLimite*100) : 0;
  const totalPasado = totalGastado > totalLimite;
  const bloqueTotal = presupuestos.length ? `
  <div class="card">
    <h2>Total presupuestado · ${lbl}</h2>
    <div class="balance" style="margin-top:6px">
      <div><div class="num">${eur(totalLimite)}</div><div class="lbl">${mult===12?"Presupuesto anual":"Presupuesto mensual"}</div></div>
      <div><div class="num ${totalPasado?'neg':''}">${eur(totalGastado)}</div><div class="lbl">Gastado</div></div>
      <div><div class="num ${totalPasado?'neg':'pos'}">${totalPct.toFixed(0)}%</div><div class="lbl">Consumido</div></div>
    </div>
    <div style="height:8px;background:var(--line);border-radius:999px;margin-top:12px;overflow:hidden">
      <div style="height:100%;width:${Math.min(totalPct,100)}%;background:${totalPasado?'var(--neg)':'var(--accent)'}"></div>
    </div>
    ${mult===12? `<p class="meta" style="margin:8px 0 0">Vista anual: cada límite mensual se multiplica por 12.</p>` : ""}
    ${totalPasado? `<p class="meta" style="margin:8px 0 0;color:var(--neg)">Has superado el total presupuestado en ${eur(totalGastado-totalLimite)}</p>` : ""}
  </div>` : "";

  return `
  ${bloqueTotal}
  <div class="card">
    <h2>Nuevo presupuesto</h2>
    <form id="fPresupuesto">
      <div class="row2">
        <div><label>Categoría</label>
          ${catsSinPresupuesto.length? `<select name="categoria">${catsSinPresupuesto.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("")}</select>` : `<div class="meta">Todas tus categorías de gasto ya tienen presupuesto.</div>`}
        </div>
        <div><label>Límite mensual (€)</label><input name="limite" type="number" step="0.01" min="0" required></div>
      </div>
      <button class="btn" type="submit" ${catsSinPresupuesto.length?"":"disabled"}>Añadir</button>
    </form>
    <p class="meta" style="margin:10px 0 0">Después de crearlo puedes activarle "remanente": lo que te sobre o te pases un mes se suma o resta al límite del siguiente.</p>
  </div>
  <div class="section-title">Presupuestos · ${lbl}</div>
  <div class="list">
    ${presupuestos.length? presupuestos.map(p=>{
      const rolloverImp = rolloverAcumulado(p);
      const limiteEf = mult===12 ? p.limite*mult : (p.limite + rolloverImp);
      const ajuste = cubiertoCat[p.categoria] || 0;
      const gastado = gastoPorCat[p.categoria] || 0;
      const pct = limiteEf>0 ? Math.max(0, gastado/limiteEf*100) : 0;
      const pasado = gastado > limiteEf;
      return `
      <div class="item">
        <div style="flex:1">
          <strong>${esc(p.categoria)}</strong>
          ${p.rollover?`<span class="tag">Con remanente</span>`:""}
          <div class="meta">${eur(gastado)} de ${eur(limiteEf)}${mult===12?" al año":""} · ${pct.toFixed(0)}%</div>
          ${rolloverImp!==0 && mult!==12? `<div class="meta">Incluye ${rolloverImp>=0?"+":""}${eur(rolloverImp)} de meses anteriores</div>` : ""}
          ${ajuste>0? `<div class="meta">Sin contar ${eur(ajuste)} que ya te han devuelto</div>` : ""}
          <div style="height:6px;background:var(--line);border-radius:999px;margin-top:6px;overflow:hidden">
            <div style="height:100%;width:${Math.min(pct,100)}%;background:${pasado?'var(--neg)':'var(--accent)'}"></div>
          </div>
          ${pasado? `<div class="meta" style="color:var(--neg);margin-top:4px">Has superado el límite en ${eur(gastado-limiteEf)}</div>` : ""}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
          <button class="btn ghost" data-toggle-rollover="${p.id}">${p.rollover?"Quitar remanente":"Activar remanente"}</button>
          <button class="btn ghost" data-editar-presupuesto="${p.id}">Editar</button>
          <button class="btn ghost" data-del-presupuesto="${p.id}">Borrar</button>
        </div>
      </div>
      ${editarPresupuestoId===p.id? `
      <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
        <label>Nuevo límite mensual (€)</label>
        <input type="number" step="0.01" min="0" id="presupuestoNuevoLimite" value="${p.limite}">
        <div style="display:flex;gap:8px">
          <button class="btn" data-confirmar-presupuesto="${p.id}">Guardar</button>
          <button class="btn ghost" data-cancelar-presupuesto="1">Cancelar</button>
        </div>
      </div>` : ""}`;
    }).join("") : `<div class="empty">Sin presupuestos todavía. Crea el primero arriba.</div>`}
  </div>`;
}

function renderGastos(){
  const enP = movimientosEfectivos();
  const ingresos = enP.filter(m=>m.tipo==="ingreso").reduce((s,m)=>s+m.importe,0);
  const ahorro = enP.filter(m=>m.tipo==="gasto" && m.categoria==="Inversión").reduce((s,m)=>s+m.importe,0);
  const disponible = ingresos - ahorro;
  const gastosReales = enP.filter(m=>m.tipo==="gasto" && m.categoria!=="Inversión" && m.importe>0);
  const gastado = gastosReales.reduce((s,m)=>s+m.importe,0);
  const restante = disponible - gastado;
  const porCategoria = {};
  gastosReales.forEach(m=>{ porCategoria[m.categoria] = (porCategoria[m.categoria]||0) + m.importe; });
  const gastosMostrados = gastosCatSel ? gastosReales.filter(m=>m.categoria===gastosCatSel) : gastosReales;
  const lbl = periodoMes==="todos" ? `Año ${periodoAnio}` : `${MESES[Number(periodoMes)-1]} ${periodoAnio}`;
  const catBtnStyle = (activa) => {
    const base = "display:flex;justify-content:space-between;align-items:center;width:100%;text-align:left;border-radius:11px;padding:12px 13px;cursor:pointer;font-family:inherit;font-size:14px;color:var(--ink);transition:background .15s,box-shadow .15s,opacity .15s;";
    if(activa) return base + "background:var(--accent-soft);border:1px solid var(--accent);box-shadow:inset 3px 0 0 var(--accent),0 0 0 2px var(--accent-soft);font-weight:600";
    return base + `background:var(--card);border:1px solid var(--line);${gastosCatSel?'opacity:.55':''}`;
  };
  return `
  <div class="card">
    <h2>Disponible para gastar · ${lbl}</h2>
    <p class="meta" style="margin:4px 0 0">Ingresos menos lo que aportas a inversiones (tu ahorro del mes)</p>
    <div class="balance" style="margin-top:14px">
      <div><div class="num pos">${eur(ingresos)}</div><div class="lbl">Ingresos</div></div>
      <div><div class="num neg">${eur(ahorro)}</div><div class="lbl">Ahorro (inversiones)</div></div>
      <div><div class="num">${eur(disponible)}</div><div class="lbl">Disponible</div></div>
    </div>
  </div>
  <div class="card">
    <div class="balance">
      <div><div class="num neg">${eur(gastado)}</div><div class="lbl">Gastado</div></div>
      <div><div class="num ${restante>=0?'pos':'neg'}">${eur(restante)}</div><div class="lbl">Te queda</div></div>
    </div>
  </div>
  <div class="section-title">Por categoría${gastosCatSel? ` <span class="meta" style="font-weight:400">· pulsa de nuevo para quitar el filtro</span>` : ""}</div>
  <div class="list">
    ${Object.keys(porCategoria).length? Object.entries(porCategoria).sort((a,b)=>b[1]-a[1]).map(([cat,total])=>{
      const activa = gastosCatSel===cat;
      return `
      <button data-gastos-cat="${esc(cat)}" aria-pressed="${activa}" style="${catBtnStyle(activa)}">
        <span style="display:flex;align-items:center;gap:8px">${activa?`<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:var(--accent);color:#fff;font-size:11px">✓</span>`:""}${esc(cat)}</span><span class="amt neg">${eur(total)}</span>
      </button>`;
    }).join("") : `<div class="empty">Sin gastos en este periodo.</div>`}
  </div>
  <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
    <span>Movimientos de gasto (${gastosMostrados.length})</span>
    ${gastosCatSel? `<button data-gastos-cat="" title="Quitar filtro" style="display:inline-flex;align-items:center;gap:6px;background:var(--accent-soft);color:var(--accent);border:1px solid var(--accent);border-radius:999px;padding:5px 8px 5px 12px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer">${esc(gastosCatSel)}<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:var(--accent);color:#fff;font-size:12px;line-height:1">✕</span></button>` : ""}
  </div>
  <div class="list">
    ${gastosMostrados.length? [...gastosMostrados].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(m=>`
      <div class="item">
        <div><span class="tag">${esc(m.categoria)}</span>${m.nota?`<div class="meta">${esc(m.nota)}</div>`:""}<div class="meta">${m.fecha}</div>${m.cubierto?`<div class="meta">De ${eur(m.importeOriginal)}; ${eur(m.cubierto)} ya cobrados de deudas</div>`:""}</div>
        <div class="amt neg">-${eur(m.importe)}</div>
      </div>`).join("") : `<div class="empty">${gastosCatSel? "Sin movimientos en esta categoría." : "Sin movimientos de gasto en este periodo."}</div>`}
  </div>`;
}
function movItem(m, cubMov, pendMov){
  const protegido = movimientoProtegido(m.id);
  if(m.transferenciaId){
    const otro = movimientos.find(x=>x.transferenciaId===m.transferenciaId && x.id!==m.id);
    if(m.tipo==="gasto" && otro){
      return `
      <div class="item">
        <div>
          <span class="tag">Transferencia</span>
          <div class="meta">${cuentaNombre(m.cuentaId)} → ${cuentaNombre(otro.cuentaId)}</div>
          ${m.nota && m.nota!=="Transferencia"?`<div class="meta">${esc(m.nota)}</div>`:""}
          <div class="meta">${m.fecha}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="amt">${eur(m.importe)}</div>
          <button class="btn ghost" data-del-transferencia="${m.transferenciaId}">Borrar</button>
        </div>
      </div>`;
    }
    return ""; // el lado "ingreso" del par ya se muestra junto al "gasto"
  }
  return `
  <div class="item">
    <div>
      <span class="tag">${esc(m.categoria)}</span>
      <span class="tag">${cuentaNombre(m.cuentaId)}</span>
      ${m.nota?`<div class="meta">${esc(m.nota)}</div>`:""}
      ${m.saldoBanco!=null?`<div class="meta">Saldo banco: ${eur(m.saldoBanco)}</div>`:""}
      ${m.recurrenteId? `<div class="meta">Generado automáticamente (recurrente)</div>` : ""}
      ${m.reembolsoDe? `<div class="meta">Reembolso de un gasto: no cuenta como ingreso</div>` : ""}
      ${pendMov[m.id]? `<div class="meta">Te deben ${eur(pendMov[m.id])} (pendiente: hasta que lo cobres, cuenta entero)</div>` : ""}
      ${cubMov[m.id]? `<div class="meta">Ya cobrado: ${eur(cubMov[m.id])} · cuenta ${eur(Math.max(0,m.importe-cubMov[m.id]))} como gasto tuyo</div>` : ""}
      <div class="meta">${m.fecha}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        ${m.tipo==='gasto' && !m.reembolsoDe && m.categoria!=='Inversión' && m.categoria!=='Ajuste' && m.categoria!=='Transferencia' && meDebenMovId!==m.id? `<button class="tag" data-me-deben="${m.id}" style="cursor:pointer;border:none;font-family:inherit">Me deben…</button>` : ""}
        ${!protegido && editarMovId!==m.id? `<button class="tag" data-editar-mov="${m.id}" style="cursor:pointer;border:none;font-family:inherit">Editar</button>` : ""}
        <button class="tag" data-duplicar-mov="${m.id}" style="cursor:pointer;border:none;font-family:inherit">Repetir</button>
        <button class="tag" data-toggle-conciliado="${m.id}" style="cursor:pointer;border:none;font-family:inherit;${m.conciliado?'background:var(--pos);color:#fff':''}">${m.conciliado?"✓ Conciliado":"Sin conciliar"}</button>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px">
      <div class="amt ${m.tipo==='ingreso'?'pos':'neg'}">${m.tipo==='ingreso'?'+':'-'}${eur(m.importe)}</div>
      <button class="btn ghost" data-del-mov="${m.id}">Borrar</button>
    </div>
  </div>
  ${meDebenMovId===m.id? `
  <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
    <label>¿Quién te lo debe?</label>
    <input id="mdPersona" placeholder="ej. Marta">
    <label>Cuánto te deben (€)</label>
    <input id="mdImporte" type="number" step="0.01" min="0" value="${m.importe}">
    <div class="meta">Se crea una deuda "me deben" vinculada a este gasto. Hasta que la saldes no cambia nada; cuando la cobres, esa cantidad dejará de contar como gasto tuyo (mes, resumen y presupuesto).</div>
    <div style="display:flex;gap:8px">
      <button class="btn" data-confirmar-me-deben="${m.id}">Crear deuda</button>
      <button class="btn ghost" data-cancelar-me-deben="1">Cancelar</button>
    </div>
  </div>` : ""}
  ${editarMovId===m.id? `
  <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
    <label>Tipo</label>
    <select id="movEditTipo">
      <option value="gasto"${m.tipo==="gasto"?" selected":""}>Gasto</option>
      <option value="ingreso"${m.tipo==="ingreso"?" selected":""}>Ingreso</option>
    </select>
    <label>Categoría</label>
    <select id="movEditCategoria">${opcionesCategoriaPend(m.tipo, m.categoria)}</select>
    <div class="row2">
      <div><label>Importe (€)</label><input id="movEditImporte" type="number" step="0.01" min="0" value="${m.importe}"></div>
      <div><label>Fecha</label><input id="movEditFecha" type="date" value="${m.fecha}"></div>
    </div>
    <label>Cuenta</label>
    <select id="movEditCuenta">${opcionesCuentas(m.cuentaId)}</select>
    <label>Nota</label>
    <input id="movEditNota" value="${esc(m.nota||"")}">
    <div style="display:flex;gap:8px">
      <button class="btn" data-confirmar-editar-mov="${m.id}">Guardar</button>
      <button class="btn ghost" data-cancelar-editar-mov="1">Cancelar</button>
    </div>
  </div>` : ""}`;
}

function renderMovimientosLista(){
  const items = movimientosFiltrados();
  const cubMov = cubiertoPorMovimiento();
  const pendMov = pendientePorMovimiento();
  const hayFiltro = movBuscarTexto.trim() || movFiltroCategoria;
  return `
  <div class="section-title">Historial (${items.length})</div>
  <div class="list">
    ${items.length? items.map(m=>movItem(m,cubMov,pendMov)).join("") : `<div class="empty">${hayFiltro? "Nada coincide con el filtro." : "Aún no hay movimientos. Añade el primero arriba."}</div>`}
  </div>`;
}

function renderMovimientos(){
  const soloVista = periodoMes === "todos";
  const categoriasPresentes = [...new Set(movimientos.filter(m=>enPeriodo(m.fecha)).map(m=>m.categoria))].sort((a,b)=>a.localeCompare(b));
  return `
  ${soloVista ? `<div class="card"><p class="meta" style="margin:0">Estás viendo el total del año — elige un mes concreto arriba para poder añadir movimientos o transferencias.</p></div>` : `
  <div class="card">
    <h2>Añadir movimiento</h2>
    ${movPlantilla? `<p class="meta" style="margin:0 0 10px;color:var(--accent)">Repitiendo un movimiento — revisa los datos y añade.</p>` : ""}
    <form id="fMov">
      <div class="row2">
        <div><label>Tipo</label><select name="tipo" id="movTipo"><option value="gasto"${(!movPlantilla||movPlantilla.tipo==="gasto")?" selected":""}>Gasto</option><option value="ingreso"${movPlantilla&&movPlantilla.tipo==="ingreso"?" selected":""}>Ingreso</option></select></div>
        <div><label>Importe (€)</label><input name="importe" type="number" step="0.01" min="0" value="${movPlantilla?movPlantilla.importe:''}" required></div>
      </div>
      <div class="row2">
        <div><label>Categoría</label><select name="categoria" id="movCat"></select></div>
        <div><label>Fecha</label><input name="fecha" type="date" value="${today()}" required></div>
      </div>
      <div><label>Cuenta</label>${cuentas.length? `<select name="cuentaId">${opcionesCuentas(movPlantilla?movPlantilla.cuentaId:null)}</select>` : `<div class="meta">Crea antes una cuenta en la pestaña "Cuentas".</div>`}</div>
      <div><label>Nota (opcional)</label><input name="nota" placeholder="ej. cena viernes" value="${movPlantilla?esc(movPlantilla.nota||''):''}"></div>
      <button class="btn" type="submit" ${cuentas.length?"":"disabled"}>Añadir</button>
    </form>
  </div>
  <div class="card">
    <h2>Transferencia entre cuentas</h2>
    <p class="meta" style="margin:0 0 10px">Mueve dinero de una cuenta a otra sin que cuente como gasto ni ingreso.</p>
    ${cuentas.length<2? `<div class="meta">Necesitas al menos dos cuentas para transferir entre ellas.</div>` : `
    <form id="fTransferencia">
      <div class="row2">
        <div><label>Desde</label><select name="origen" id="trOrigen">${opcionesCuentas()}</select></div>
        <div><label>Hacia</label><select name="destino" id="trDestino">${opcionesCuentas()}</select></div>
      </div>
      <div class="row2">
        <div><label>Importe (€)</label><input name="importe" type="number" step="0.01" min="0" required></div>
        <div><label>Fecha</label><input name="fecha" type="date" value="${today()}" required></div>
      </div>
      <div><label>Nota (opcional)</label><input name="nota" placeholder="ej. traspaso a ahorro"></div>
      <button class="btn" type="submit">Transferir</button>
    </form>`}
  </div>`}
  <div class="card">
    <div class="row2">
      <div><label>Buscar en concepto</label><input id="movBuscar" placeholder="ej. supermercado" value="${esc(movBuscarTexto)}"></div>
      <div><label>Categoría</label><select id="movFiltroCat"><option value="">Todas</option>${categoriasPresentes.map(c=>`<option value="${esc(c)}"${c===movFiltroCategoria?" selected":""}>${esc(c)}</option>`).join("")}</select></div>
    </div>
  </div>
  <div id="movListaWrap">${renderMovimientosLista()}</div>`;
}

function abonosDeDeuda(id){
  return movimientos.filter(m=>m.deudaId===id).sort((a,b)=>a.fecha.localeCompare(b.fecha));
}
function deudaItem(d){
  const pend = d.estado==='pendiente';
  const abonos = abonosDeDeuda(d.id);
  const abonado = Math.round(((d.importeInicial||d.importe) - d.importe)*100)/100;
  return `
  <div class="item" style="${pend?'':'opacity:.72'}">
    <div style="min-width:0">
      <strong>${esc(d.persona)}</strong>
      ${!pend?'<span class="tag">Saldada</span>':''}
      ${pend && d.direccion==='me_deben'? `<button class="tag" data-pres-deuda="${d.id}" style="cursor:pointer;border:none;font-family:inherit">${d.movimientoId? "Gasto: "+etiquetaGasto(d.movimientoId) : "+ Vincular gasto"}</button>` : (d.movimientoId? `<span class="tag">Gasto: ${etiquetaGasto(d.movimientoId)}</span>` : "")}
      ${d.concepto?`<div class="meta">${esc(d.concepto)}</div>`:""}
      <div class="meta">${d.fecha}</div>
      ${abonos.length? `<div class="meta">Importe inicial: ${eur(d.importeInicial)} · Abonado: ${eur(abonado)} · Pendiente: ${eur(d.importe)}</div>` : ""}
      ${abonos.length? `<button class="tag" data-ver-abonos="${d.id}" style="cursor:pointer;border:none;font-family:inherit;margin-top:4px">${verAbonosDeudaId===d.id?"Ocultar abonos":`Ver abonos (${abonos.length})`}</button>` : ""}
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      <div class="amt ${d.direccion==='me_deben'?'pos':'neg'}">${eur(d.importe)}</div>
      ${pend && saldarId!==d.id?`<button class="btn gold" data-saldar="${d.id}">Abonar</button>`:''}
      <button class="btn ghost" data-del-deuda="${d.id}">Borrar</button>
    </div>
  </div>
  ${verAbonosDeudaId===d.id? `
  <div style="padding:0 4px 10px">
    ${abonos.map(m=>`
      <div class="item" style="padding:8px 10px;margin-bottom:6px">
        <div><span class="tag">${m.fecha}</span><div class="meta">${cuentaNombre(m.cuentaId)}</div></div>
        <div class="amt ${d.direccion==='me_deben'?'pos':'neg'}">${eur(m.importe)}</div>
      </div>`).join("")}
  </div>` : ""}
  ${editarPresDeudaId===d.id? `
  <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
    <label>Gasto asociado</label>
    <select id="presDeudaSel"><option value="">Ninguno</option>${opcionesMovimientosGasto(d.movimientoId)}</select>
    <div class="meta">Hasta que la saldes no cambia nada; al cobrarla, esa cantidad dejará de contar como gasto tuyo.</div>
    <div style="display:flex;gap:8px">
      <button class="btn" data-confirmar-pres-deuda="${d.id}">Guardar</button>
      <button class="btn ghost" data-cancelar-pres-deuda="1">Cancelar</button>
    </div>
  </div>` : ""}
  ${saldarId===d.id? `
  <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
    <label>Importe a abonar (€) — máximo ${eur(d.importe)}</label>
    <input type="number" step="0.01" min="0.01" max="${d.importe}" id="saldarImporte" value="${d.importe}">
    <p class="meta" style="margin:0">Si abonas menos del total, la deuda queda pendiente por el resto.</p>
    <label>${d.direccion==='me_deben'?'¿A qué cuenta entra el pago?':'¿De qué cuenta sale el pago?'}</label>
    ${cuentas.length? `<select id="saldarCuenta">${opcionesCuentas()}</select>` : `<div class="meta">Crea antes una cuenta en la pestaña "Cuentas".</div>`}
    ${d.direccion==='debo'? `
    <label>Categoría del gasto (opcional)</label>
    <select id="saldarCat"><option value="">Deuda (sin categoría)</option>${opcionesCategoriasGasto()}</select>
    <div class="meta">Al pagarlo cuenta como gasto en esa categoría, y por tanto en su presupuesto.</div>` : (d.movimientoId? `<div class="meta">Al cobrarlo se registra como reembolso de ese gasto: rebaja ese gasto y no cuenta como ingreso.</div>` : `<div class="meta">Sin gasto vinculado, el cobro cuenta como un ingreso normal.</div>`)}
    <div style="display:flex;gap:8px">
      <button class="btn" data-confirmar-saldar="${d.id}" ${cuentas.length?"":"disabled"}>Confirmar</button>
      <button class="btn ghost" data-cancelar-saldar="1">Cancelar</button>
    </div>
  </div>` : ""}`;
}

function renderDeudas(){
  const lado = deudaLado === "debo" ? "debo" : "me_deben";
  const pendMe = deudas.filter(d=>d.direccion==="me_deben" && d.estado==="pendiente");
  const pendDebo = deudas.filter(d=>d.direccion==="debo" && d.estado==="pendiente");
  const totMe = pendMe.reduce((sum,d)=>sum+d.importe,0);
  const totDebo = pendDebo.reduce((sum,d)=>sum+d.importe,0);
  const porFecha = (a,b)=>b.fecha.localeCompare(a.fecha);
  const pend = (lado==="me_deben" ? pendMe : pendDebo).slice().sort(porFecha);
  const saldadas = deudas.filter(d=>d.direccion===lado && d.estado==="saldado").sort(porFecha);
  const porPersona = {};
  pend.forEach(d=>{ const k = d.persona.trim().toLowerCase(); (porPersona[k] = porPersona[k] || {nombre:d.persona.trim(), total:0, n:0}); porPersona[k].total += d.importe; porPersona[k].n++; });
  const personas = Object.values(porPersona).sort((a,b)=>b.total-a.total);
  const tarjetaLado = (clave, titulo, total, n, clase)=>`
    <div class="lado ${clase} ${lado===clave?'activo':''}" data-lado-deuda="${clave}" role="button">
      <div class="meta" style="font-weight:700">${titulo}</div>
      <div class="cifra ${clase}">${eur(total)}</div>
      <div class="meta">${n} pendiente${n===1?"":"s"}</div>
    </div>`;
  return `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
    ${tarjetaLado("me_deben","Me deben",totMe,pendMe.length,"pos")}
    ${tarjetaLado("debo","Debo",totDebo,pendDebo.length,"neg")}
  </div>
  <div class="card">
    <h2>Nueva deuda</h2>
    <form id="fDeuda">
      <div class="row2">
        <div><label>Persona</label><input name="persona" placeholder="ej. Marta" required></div>
        <div><label>Importe (€)</label><input name="importe" type="number" step="0.01" min="0" required></div>
      </div>
      <div class="row2">
        <div><label>Dirección</label><select name="direccion"><option value="debo"${lado==="debo"?" selected":""}>Yo debo</option><option value="me_deben"${lado==="me_deben"?" selected":""}>Me deben</option></select></div>
        <div><label>Fecha</label><input name="fecha" type="date" value="${today()}" required></div>
      </div>
      <div><label>Concepto</label><input name="concepto" placeholder="ej. cena cumpleaños"></div>
      <div id="deudaMovWrap" style="display:none"><label>Gasto asociado (opcional)</label>
        <select name="movimientoId"><option value="">Ninguno</option>${opcionesMovimientosGasto()}</select>
        <div class="meta" style="margin-top:4px">Si te deben parte de un gasto que pagaste tú, elígelo. Hasta que la saldes no cambia nada; al cobrarla, esa cantidad dejará de contar como gasto tuyo (mes, resumen y presupuesto).</div>
      </div>
      <button class="btn" type="submit">Añadir</button>
    </form>
  </div>
  <div class="section-title">${lado==="me_deben" ? "Lo que me deben" : "Lo que debo"} (${pend.length})</div>
  ${personas.length>1 ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${personas.map(x=>`<span class="tag">${esc(x.nombre.charAt(0).toUpperCase()+x.nombre.slice(1))} · ${eur(x.total)}</span>`).join("")}</div>` : ""}
  <div class="list">
    ${pend.length ? pend.map(deudaItem).join("") : `<div class="card"><div class="empty" style="padding:18px 10px">${lado==="me_deben" ? "Nadie te debe nada ahora mismo." : "No debes nada ahora mismo."}</div></div>`}
  </div>
  ${saldadas.length ? `
  <div data-toggle-saldadas="${lado}" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin-top:18px;padding:6px 2px">
    <span class="section-title" style="margin:0">Saldadas (${saldadas.length})</span>
    <span class="meta">${saldadasAbiertas[lado] ? "▾ Ocultar" : "▸ Ver"}</span>
  </div>
  ${saldadasAbiertas[lado] ? `<div class="list" style="margin-top:8px">${saldadas.map(deudaItem).join("")}</div>` : ""}` : ""}`;
}

function renderCuentas(){
  const items = [...cuentas].sort(porOrden);
  const total = items.reduce((s,c)=>s+saldoCuenta(c),0);
  const positivas = items.map((c,k)=>({c,k,saldo:saldoCuenta(c)})).filter(x=>x.saldo>0);
  const totalPos = positivas.reduce((s,x)=>s+x.saldo,0);
  const resumen = items.length ? `
  <div class="card">
    <div class="meta">Saldo total en cuentas</div>
    <div style="font-size:30px;font-weight:800;letter-spacing:-0.02em;font-variant-numeric:tabular-nums;margin-top:2px" class="${total>=0?'':'neg'}">${eur(total)}</div>
    ${totalPos>0? `
    <div style="display:flex;height:10px;border-radius:999px;overflow:hidden;margin-top:14px;gap:2px">
      ${positivas.map(x=>`<div style="width:${x.saldo/totalPos*100}%;background:${PALETTE[x.k%PALETTE.length]}"></div>`).join("")}
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px">
      ${positivas.map(x=>`<span class="meta" style="display:flex;align-items:center;gap:6px"><span style="width:9px;height:9px;border-radius:50%;background:${PALETTE[x.k%PALETTE.length]}"></span>${esc(x.c.nombre)} ${(x.saldo/totalPos*100).toFixed(0)}%</span>`).join("")}
    </div>` : ""}
  </div>` : "";
  const tarjetas = items.map((c,k)=>{
    const saldo = saldoCuenta(c);
    const col = PALETTE[k%PALETTE.length];
    const nMov = movimientos.filter(m=>m.cuentaId===c.id).length;
    return `
    <div class="sort-item" data-sort-id="${c.id}"><div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
        <div style="display:flex;align-items:center;gap:12px;min-width:0">
          ${items.length>1? gripHtml() : ""}
          <div style="width:42px;height:42px;border-radius:14px;background:${col};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0">${esc((c.nombre||"?").trim().charAt(0).toUpperCase())}</div>
          <div style="min-width:0"><strong>${esc(c.nombre)}</strong><div class="meta">Inicial ${eur(c.saldoInicial||0)} · ${nMov} movimiento${nMov===1?"":"s"}</div></div>
        </div>
        <div style="font-size:20px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap" class="${saldo>=0?'':'neg'}">${eur(saldo)}</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
        ${ajustarSaldoId!==c.id?`<button class="btn gold" data-ajustar-saldo="${c.id}">Ajustar saldo</button>`:""}
        <button class="btn ghost" data-del-cuenta="${c.id}">Borrar</button>
      </div>
      ${ajustarSaldoId===c.id? `
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)">
        <label>Saldo real actual (€)</label>
        <input type="number" step="0.01" id="saldoRealInput" value="${saldo.toFixed(2)}">
        <p class="meta" style="margin:0">Se creará un movimiento de "Ajuste" por la diferencia, así el histórico queda intacto.</p>
        <div style="display:flex;gap:8px">
          <button class="btn" data-confirmar-ajuste="${c.id}">Guardar</button>
          <button class="btn ghost" data-cancelar-ajuste="1">Cancelar</button>
        </div>
      </div>` : ""}
    </div></div>`;
  }).join("");
  return `
  ${resumen}
  ${tarjetas ? `<div data-sortable="ordenar_cuentas">${tarjetas}</div>` : `<div class="card"><div class="empty" style="padding:20px 10px">Sin cuentas todavía. Crea la primera abajo.</div></div>`}
  <div class="card">
    <h2>Añadir cuenta</h2>
    <form id="fCuenta">
      <div class="row2">
        <div><label>Nombre</label><input name="nombre" placeholder="ej. Trade Republic" required></div>
        <div><label>Saldo inicial (€)</label><input name="saldoInicial" type="number" step="0.01" value="0" required></div>
      </div>
      <button class="btn" type="submit">Añadir</button>
    </form>
  </div>`;
}

function renderListaAportaciones(inv){
  const apo = aportaciones.filter(a=>a.inversionId===inv.id).map(a=>({...a, mov:"aportacion"}));
  const ret = retiros.filter(r=>r.inversionId===inv.id).map(r=>({...r, mov:"retiro"}));
  const lista = [...apo, ...ret].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  return `
  <div style="padding:0 4px 10px">
    ${lista.length? lista.map(x=>`
      <div class="item" style="padding:8px 10px;margin-bottom:6px">
        <div><span class="tag">${x.fecha}</span><div class="meta">${x.mov==="aportacion"?"Aportación":"Rescate"} · ${cuentaNombre(x.cuentaId)}</div></div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="amt ${x.mov==='aportacion'?'pos':'neg'}">${x.mov==="aportacion"?"+":"-"}${eur(x.importe)}</div>
          <button class="btn ghost" data-del-${x.mov==="aportacion"?"aportacion":"retiro"}="${x.id}">Borrar</button>
        </div>
      </div>`).join("") : `<div class="empty">Sin movimientos registrados.</div>`}
  </div>`;
}

function opcionesGrupos(selectedId){
  return grupos().map(g=>`<option value="${g.id}"${g.id===selectedId?" selected":""}>${esc(g.nombre)}</option>`).join("");
}

function grupoItem(g, conGrip){
  const abierto = !!gruposAbiertos[g.id];
  const hs = hijosDe(g);
  const val = valorGrupo(g);
  const ben = beneficioGrupo(g);
  const rG = rentasGrupo(g);
  const cab = `
  <div class="item" data-toggle-grupo="${g.id}" style="cursor:pointer;background:var(--accent-soft);border-color:transparent">
    <div style="display:flex;align-items:center;gap:10px;min-width:0">
      ${conGrip? gripHtml() : ""}
      <div>
        <strong>${abierto?"▾":"▸"} ${esc(g.nombre)}</strong>
        <span class="tag" style="background:var(--card)">${hs.length} inversion${hs.length===1?"":"es"}</span>
        <div class="meta">Beneficio: <span class="${ben>=0?'pos':'neg'}">${eur(ben)}</span>${rG>0?` · Rentas: <span class="pos">${eur(rG)}</span>`:""}</div>
      </div>
    </div>
    <div class="amt">${eur(val)}</div>
  </div>`;
  if(!abierto) return cab;
  return cab + `
  <div style="margin:2px 0 6px 12px;padding-left:10px;border-left:2px solid var(--accent-soft);display:flex;flex-direction:column;gap:8px">
    ${hs.length? `<div data-sortable="ordenar_inversiones" style="display:flex;flex-direction:column;gap:8px">${hs.map(h=>sortItem(h.id, invItem(h, hs.length>1))).join("")}</div>` : `<div class="empty" style="padding:14px">Grupo vacío. Asigna inversiones desde "Editar información".</div>`}
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${editarInfoInvId!==g.id?`<button class="btn ghost" data-editar-info="${g.id}">Renombrar grupo</button>`:""}
      <button class="btn ghost" data-del-inv="${g.id}">Borrar grupo</button>
    </div>
    ${editarInfoInvId===g.id? `<div class="item" style="flex-direction:column;align-items:stretch;gap:8px"><label>Nombre</label><input id="infoNombre" value="${esc(g.nombre)}"><div style="display:flex;gap:8px"><button class="btn" data-confirmar-info="${g.id}">Guardar</button><button class="btn ghost" data-cancelar-info="1">Cancelar</button></div></div>` : ""}
  </div>`;
}

function invItem(inv, conGrip){
  if(inv.esGrupo) return grupoItem(inv, conGrip);
  const esActiva = inv.estado === "activa";
  const aportado = aportadoInv(inv);
  const beneficio = beneficioInv(inv);
  const expandida = expandidaInvId === inv.id;

  const cabecera = `
  <div class="item" data-expandir-inv="${inv.id}" style="cursor:pointer">
    <div style="display:flex;align-items:center;gap:10px;min-width:0">
      ${conGrip? gripHtml() : ""}
      <div>
        <strong>${esc(inv.nombre)}</strong>
        ${inv.tipo?`<span class="tag">${esc(inv.tipo)}</span>`:""}
        ${!esActiva?`<span class="tag">Planificada</span>`:""}
      </div>
    </div>
    <div class="amt">${esActiva? eur(inv.valorActual) : "—"}</div>
  </div>`;

  if(!expandida) return cabecera;

  return cabecera + `
  <div style="padding:0 4px 6px">
    ${esActiva? `<div class="meta">Aportado: ${eur(aportado)}</div>` : `<div class="meta">Sin aportar todavía — no cuenta en tu patrimonio</div>`}
    ${!esActiva && (inv.fechaPrevista||inv.importePrevisto)? `<div class="meta">Previsto: ${inv.importePrevisto?eur(inv.importePrevisto):"—"}${inv.fechaPrevista?` el ${inv.fechaPrevista}`:""}${inv.cuentaPrevistaId?` desde ${cuentaNombre(inv.cuentaPrevistaId)}`:""}</div>` : ""}
    ${esActiva? `<div class="meta">Beneficio: <span class="${beneficio>=0?'pos':'neg'}">${eur(beneficio)}</span></div>` : ""}
    ${esActiva? `<div class="meta">Rentas: <span class="pos">${eur(inv.rentas||0)}</span> · solo recuento, no afecta al valor</div>` : ""}
  </div>
  <div style="display:flex;gap:8px;padding:0 4px 8px;flex-wrap:wrap">
    ${aportarInvId!==inv.id?`<button class="btn gold" data-aportar-inv="${inv.id}">Aportar</button>`:""}
    ${esActiva && inv.valorActual>0 && rescatarInvId!==inv.id?`<button class="btn ghost" data-rescatar-inv="${inv.id}">Rescatar</button>`:""}
    ${esActiva && editarValorInvId!==inv.id?`<button class="btn ghost" data-editar-valor="${inv.id}">Actualizar valor</button>`:""}
    ${esActiva && rentasInvId!==inv.id?`<button class="btn ghost" data-rentas-inv="${inv.id}">Anotar rentas</button>`:""}
    ${aportado>0 || esActiva ? `<button class="btn ghost" data-ver-aportaciones="${inv.id}">${verAportacionesId===inv.id?"Ocultar aportaciones":"Ver aportaciones"}</button>` : ""}
    ${editarInfoInvId!==inv.id?`<button class="btn ghost" data-editar-info="${inv.id}">Editar información</button>`:""}
    <button class="btn ghost" data-del-inv="${inv.id}">Borrar</button>
  </div>
  ${verAportacionesId===inv.id? renderListaAportaciones(inv) : ""}
  ${aportarInvId===inv.id? `
  <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
    <label>Importe a aportar (€)</label>
    <input type="number" step="0.01" min="0" id="aportarImporte" value="${inv.importePrevisto||''}">
    <label>Cuenta de origen</label>
    ${cuentas.length? `<select id="aportarCuenta">${opcionesCuentas(inv.cuentaPrevistaId)}</select>` : `<div class="meta">Crea antes una cuenta en la pestaña "Cuentas".</div>`}
    <div style="display:flex;gap:8px">
      <button class="btn" data-confirmar-aportar="${inv.id}" ${cuentas.length?"":"disabled"}>Confirmar</button>
      <button class="btn ghost" data-cancelar-aportar="1">Cancelar</button>
    </div>
  </div>` : ""}
  ${rescatarInvId===inv.id? `
  <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
    <label>Importe a rescatar (€) — máximo ${eur(inv.valorActual)}</label>
    <input type="number" step="0.01" min="0" max="${inv.valorActual}" id="rescatarImporte">
    <label>Cuenta destino</label>
    ${cuentas.length? `<select id="rescatarCuenta">${opcionesCuentas()}</select>` : `<div class="meta">Crea antes una cuenta en la pestaña "Cuentas".</div>`}
    <div style="display:flex;gap:8px">
      <button class="btn" data-confirmar-rescate="${inv.id}" ${cuentas.length?"":"disabled"}>Confirmar</button>
      <button class="btn ghost" data-cancelar-rescate="1">Cancelar</button>
    </div>
  </div>` : ""}
  ${rentasInvId===inv.id? `
  <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
    <label>Cantidad (€)</label>
    <input type="number" step="0.01" id="rentasImporte">
    <p class="meta" style="margin:0">Llevas ${eur(inv.rentas||0)} en rentas. Es solo un recuento: no cambia el valor de la inversión, ni el patrimonio, ni crea movimientos. Para corregir un error, suma una cantidad negativa o fija el total.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" data-sumar-rentas="${inv.id}">Sumar</button>
      <button class="btn gold" data-fijar-rentas="${inv.id}">Fijar total</button>
      <button class="btn ghost" data-cancelar-rentas="1">Cancelar</button>
    </div>
  </div>` : ""}
  ${editarValorInvId===inv.id? `
  <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
    <label>Nuevo valor actual (€)</label>
    <input type="number" step="0.01" id="valorNuevo" value="${inv.valorActual}">
    <div style="display:flex;gap:8px">
      <button class="btn" data-confirmar-valor="${inv.id}">Guardar</button>
      <button class="btn ghost" data-cancelar-valor="1">Cancelar</button>
    </div>
  </div>` : ""}
  ${editarInfoInvId===inv.id? `
  <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
    <label>Nombre</label><input id="infoNombre" value="${esc(inv.nombre)}">
    <label>Tipo</label><input id="infoTipo" value="${esc(inv.tipo||'')}">
    ${grupos().length? `<label>Grupo</label><select id="infoGrupo"><option value="">Sin grupo</option>${opcionesGrupos(inv.padreId)}</select>` : ""}
    ${!esActiva? `
    <label>Fecha prevista</label><input id="infoFechaPrevista" type="date" value="${inv.fechaPrevista||''}">
    <label>Importe previsto (€)</label><input id="infoImportePrevisto" type="number" step="0.01" min="0" value="${inv.importePrevisto??''}">
    <label>Cuenta prevista</label>
    ${cuentas.length? `<select id="infoCuentaPrevista"><option value="">Sin elegir todavía</option>${cuentas.map(c=>`<option value="${c.id}" ${c.id===inv.cuentaPrevistaId?"selected":""}>${esc(c.nombre)}</option>`).join("")}</select>` : `<div class="meta">Crea una cuenta cuando quieras usarla.</div>`}
    ` : ""}
    <div style="display:flex;gap:8px">
      <button class="btn" data-confirmar-info="${inv.id}">Guardar</button>
      <button class="btn ghost" data-cancelar-info="1">Cancelar</button>
    </div>
  </div>` : ""}`;
}

function renderInversiones(){
  const topActivos = inversiones.filter(i=>!i.padreId && (i.esGrupo || i.estado==="activa")).sort(porOrden);
  const topPlan = inversiones.filter(i=>!i.padreId && !i.esGrupo && i.estado!=="activa").sort(porOrden);
  const reales = inversiones.filter(i=>!i.esGrupo && i.estado==="activa");
  const totalValor = reales.reduce((s,i)=>s+i.valorActual,0);
  const totalBeneficio = reales.reduce((s,i)=>s+beneficioInv(i),0);
  const totalRentas = reales.reduce((s,i)=>s+(i.rentas||0),0);
  const slices = sliceInversiones();
  const bloqueGrafica = slices.length ? `
  <div class="card">
    <h2>Distribución de tus inversiones</h2>
    <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin-top:10px">
      <div style="width:130px;height:130px;border-radius:50%;background:conic-gradient(${pieStyle(slices)});flex-shrink:0;position:relative">
        <div style="position:absolute;inset:30px;border-radius:50%;background:var(--card);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px">${eur(totalValor)}</div>
      </div>
      <div style="flex:1;min-width:190px;display:flex;flex-direction:column;gap:8px">
        ${slices.map(sl=>`
        <div>
          <div style="display:flex;align-items:center;gap:8px;font-size:13px">
            <span style="width:12px;height:12px;border-radius:50%;background:${sl.color};flex-shrink:0"></span>
            <span style="flex:1;font-weight:600">${esc(sl.nombre)}</span>
            <span class="meta">${eur(sl.total)} · ${sl.pct.toFixed(1)}%</span>
          </div>
          ${sl.hijos.map(h=>`<div class="meta" style="margin-left:20px;display:flex;justify-content:space-between"><span>${esc(h.nombre)}</span><span>${(sl.totalGlobal? h.total/sl.totalGlobal*100 : 0).toFixed(1)}%</span></div>`).join("")}
        </div>`).join("")}
      </div>
    </div>
  </div>` : "";
  return `
  ${bloqueGrafica}
  <div class="card">
    <h2>Nueva inversión</h2>
    <form id="fInversion">
      <div class="row2">
        <div><label>Nombre</label><input name="nombre" placeholder="ej. Trade Republic" required></div>
        <div><label>Tipo (opcional)</label><input name="tipo" placeholder="ej. ETF, inmobiliaria..."></div>
      </div>
      ${grupos().length? `<div><label>Grupo (opcional)</label><select name="grupoId"><option value="">Sin grupo</option>${opcionesGrupos()}</select></div>` : ""}
      <div><label>Estado</label><select name="estado" id="invEstado"><option value="activa">Activa — ya tengo dinero invertido</option><option value="planificada">Planificada — todavía no he aportado nada</option></select></div>
      <div id="invValorWrap"><label>Valor actual inicial (€)</label><input name="valorActual" type="number" step="0.01" value="0" id="invValorInput" required></div>
      <div id="invPlanWrap" style="display:none">
        <div class="row2">
          <div><label>Fecha prevista</label><input name="fechaPrevista" type="date"></div>
          <div><label>Importe previsto (€)</label><input name="importePrevisto" type="number" step="0.01" min="0"></div>
        </div>
        <label>Cuenta prevista</label>
        ${cuentas.length? `<select name="cuentaPrevista"><option value="">Sin elegir todavía</option>${opcionesCuentas(null, true)}</select>` : `<div class="meta">Crea una cuenta cuando quieras usarla.</div>`}
      </div>
      <button class="btn" type="submit">Añadir</button>
    </form>
  </div>
  <div class="card">
    <h2>Nuevo grupo</h2>
    <p class="meta" style="margin:0 0 10px">Agrupa varias inversiones bajo un mismo nombre (por ejemplo, "Trade Republic Felicidad"). Después eliges el grupo desde "Editar información" de cada inversión.</p>
    <form id="fGrupo">
      <div><label>Nombre del grupo</label><input name="nombre" required></div>
      <button class="btn" type="submit">Crear grupo</button>
    </form>
  </div>
  <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
    <span>Activas · Valor ${eur(totalValor)} · Beneficio ${eur(totalBeneficio)}${totalRentas>0?` · Rentas ${eur(totalRentas)}`:""}</span>
  </div>
  <div class="list" data-sortable="ordenar_inversiones">
    ${topActivos.length? topActivos.map(x=>sortItem(x.id, invItem(x, topActivos.length>1))).join("") : `<div class="empty">Sin inversiones activas todavía.</div>`}
  </div>
  <div class="section-title">Planificadas · no cuentan en tu patrimonio</div>
  <div class="list" data-sortable="ordenar_inversiones">
    ${topPlan.length? topPlan.map(x=>sortItem(x.id, invItem(x, topPlan.length>1))).join("") : `<div class="empty">Sin inversiones planificadas.</div>`}
  </div>`;
}

function catItem(c){
  return editarCatId===c.id ? `
    <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
      <input id="catNuevoNombre" value="${esc(c.nombre)}">
      <div style="display:flex;gap:8px">
        <button class="btn" data-confirmar-cat="${c.id}">Guardar</button>
        <button class="btn ghost" data-cancelar-cat="1">Cancelar</button>
      </div>
    </div>` : `
    <div class="item">
      <div>${esc(c.nombre)}</div>
      <div style="display:flex;gap:8px">
        <button class="btn ghost" data-editar-cat="${c.id}">Renombrar</button>
        <button class="btn ghost" data-del-cat="${c.id}">Borrar</button>
      </div>
    </div>`;
}

function renderCategorias(){
  const porPadre = {};
  categorias.filter(c=>c.tipo==="gasto").forEach(c=>{ const p=c.padre||"Otros"; (porPadre[p]=porPadre[p]||[]).push(c); });
  const ingresoList = categorias.filter(c=>c.tipo==="ingreso");
  const padres = Object.keys(porPadre);
  const claves = [...padres, ...(ingresoList.length ? ["__ingresos__"] : [])];
  const todasContraidas = claves.length>0 && claves.every(k=>catsContraidas[k]);
  return `
  <div class="card">
    <h2>Nueva categoría</h2>
    <form id="fCategoria">
      <div class="row2">
        <div><label>Tipo</label><select name="tipo" id="catTipo"><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option></select></div>
        <div id="catPadreWrap"><label>Grupo</label><input name="padre" id="catPadre" list="padresList" placeholder="ej. Imprescindible"><datalist id="padresList">${padres.map(p=>`<option value="${esc(p)}">`).join("")}</datalist></div>
      </div>
      <div><label>Nombre</label><input name="nombre" placeholder="ej. Gasolina" required></div>
      <button class="btn" type="submit">Añadir</button>
    </form>
  </div>
  <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
    <span>Gastos</span>
    ${padres.length + (ingresoList.length?1:0) > 1? `<button class="btn ghost" data-toggle-todas-cats="${todasContraidas?'expandir':'contraer'}" style="color:var(--accent)">${todasContraidas?"Expandir todas":"Contraer todas"}</button>` : ""}
  </div>
  <div class="list">
    ${padres.length? padres.map(p=>{
      const cerrado = !!catsContraidas[p];
      return `
      <div data-toggle-cat="${esc(p)}" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:8px 4px;margin-top:4px;font-weight:700;font-size:14px">
        <span>${cerrado?"▸":"▾"} ${esc(p)}</span>
        <span class="meta" style="font-weight:400">${porPadre[p].length} categoría${porPadre[p].length===1?"":"s"}</span>
      </div>
      ${cerrado? "" : porPadre[p].map(catItem).join("")}`;
    }).join("") : `<div class="empty">Sin categorías de gasto todavía.</div>`}
  </div>
  <div class="section-title">Ingresos</div>
  <div class="list">
    ${ingresoList.length? `
      <div data-toggle-cat="__ingresos__" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:8px 4px;font-weight:700;font-size:14px">
        <span>${catsContraidas["__ingresos__"]?"▸":"▾"} Ingresos</span>
        <span class="meta" style="font-weight:400">${ingresoList.length} categoría${ingresoList.length===1?"":"s"}</span>
      </div>
      ${catsContraidas["__ingresos__"]? "" : ingresoList.map(catItem).join("")}` : `<div class="empty">Sin categorías de ingreso todavía.</div>`}
  </div>`;
}

function render(){
  renderTabs();
  renderBalance();
  renderPeriodo();
  const app = document.getElementById("app");
  if(!ready){ app.innerHTML = `<div class="status">Cargando...</div>`; return; }
  if(tab==="Inicio") app.innerHTML = renderInicio();
  else if(tab==="Gastos") app.innerHTML = renderGastos();
  else if(tab==="Resumen del mes") app.innerHTML = renderResumen();
  else if(tab==="Presupuestos") app.innerHTML = renderPresupuestos();
  else if(tab==="Movimientos") app.innerHTML = renderMovimientos();
  else if(tab==="Deudas") app.innerHTML = renderDeudas();
  else if(tab==="Cuentas") app.innerHTML = renderCuentas();
  else if(tab==="Importar") app.innerHTML = renderImportar();
  else if(tab==="Inversiones") app.innerHTML = renderInversiones();
  else if(tab==="Objetivos") app.innerHTML = renderObjetivos();
  else if(tab==="Proyección") app.innerHTML = renderProyeccion();
  else if(tab==="Recurrentes") app.innerHTML = renderRecurrentes();
  else if(tab==="Preferencias") app.innerHTML = renderPreferencias();
  else app.innerHTML = renderCategorias();
  wireEvents();
  aplicarPlegables();
  activarOrdenar();
  if(pendienteEnfoque){
    const el = document.getElementById(pendienteEnfoque);
    pendienteEnfoque = null;
    if(el){ el.scrollIntoView({block:"center", behavior:"smooth"}); try{ el.focus({preventScroll:true}); }catch(e){} }
  }
}

function wireEvents(){
  const cat = document.getElementById("movCat");
  const tipoSel = document.getElementById("movTipo");
  if(cat){
    const fill = ()=>{
      const sel = movPlantilla && movPlantilla.tipo===tipoSel.value ? movPlantilla.categoria : null;
      if(tipoSel.value==="gasto"){
        const porPadre = {};
        categorias.filter(c=>c.tipo==="gasto").forEach(c=>{ const p=c.padre||"Otros"; (porPadre[p]=porPadre[p]||[]).push(c); });
        cat.innerHTML = Object.keys(porPadre).length
          ? Object.entries(porPadre).map(([p,cats])=>`<optgroup label="${esc(p)}">${cats.map(c=>`<option value="${esc(c.nombre)}"${c.nombre===sel?" selected":""}>${esc(c.nombre)}</option>`).join("")}</optgroup>`).join("")
          : `<option value="">Crea una categoría en la pestaña "Categorías"</option>`;
      } else {
        const list = categorias.filter(c=>c.tipo==="ingreso");
        cat.innerHTML = list.length ? list.map(c=>`<option value="${esc(c.nombre)}"${c.nombre===sel?" selected":""}>${esc(c.nombre)}</option>`).join("") : `<option value="">Crea una categoría en la pestaña "Categorías"</option>`;
      }
    };
    fill(); tipoSel.onchange = fill;
  }
  const fMov = document.getElementById("fMov");
  if(fMov) fMov.onsubmit = (e)=>{
    e.preventDefault();
    conCarga(fMov.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const f = new FormData(fMov);
      const data = {tipo:f.get("tipo"), categoria:f.get("categoria"), importe:parseFloat(f.get("importe")), fecha:f.get("fecha"), nota:f.get("nota")||"", cuenta_id:f.get("cuentaId")||null};
      const {error} = await sb.from("movimientos").insert(data);
      if(error){ showError("No se pudo guardar el movimiento: "+error.message); return; }
      hideError(); fMov.reset(); movPlantilla = null; await fetchAll();
    });
  };
  document.querySelectorAll("[data-lado-deuda]").forEach(b=>b.onclick=()=>{ deudaLado = b.dataset.ladoDeuda; saldarId = null; editarPresDeudaId = null; render(); });
  document.querySelectorAll("[data-ver-abonos]").forEach(b=>b.onclick=()=>{ verAbonosDeudaId = verAbonosDeudaId===b.dataset.verAbonos ? null : b.dataset.verAbonos; render(); });
  document.querySelectorAll("[data-toggle-saldadas]").forEach(b=>b.onclick=()=>{ const k = b.dataset.toggleSaldadas; saldadasAbiertas[k] = !saldadasAbiertas[k]; render(); });
  const fDeuda = document.getElementById("fDeuda");
  const fDeudaDir = fDeuda ? fDeuda.querySelector('select[name="direccion"]') : null;
  const deudaMovWrap = document.getElementById("deudaMovWrap");
  if(fDeudaDir && deudaMovWrap){
    const t = ()=>{ deudaMovWrap.style.display = fDeudaDir.value==="me_deben" ? "block" : "none"; };
    t(); fDeudaDir.onchange = t;
  }
  if(fDeuda) fDeuda.onsubmit = (e)=>{
    e.preventDefault();
    conCarga(fDeuda.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const f = new FormData(fDeuda);
      const impInicial = parseFloat(f.get("importe"));
      const data = {persona:f.get("persona"), importe:impInicial, importe_inicial:impInicial, direccion:f.get("direccion"), fecha:f.get("fecha"), concepto:f.get("concepto")||"", estado:"pendiente", movimiento_id: f.get("direccion")==="me_deben" ? (f.get("movimientoId")||null) : null};
      const {error} = await sb.from("deudas").insert(data);
      if(error){ showError("No se pudo guardar la deuda: "+error.message); return; }
      deudaLado = data.direccion==="debo" ? "debo" : "me_deben";
      hideError(); fDeuda.reset(); await fetchAll();
    });
  };
  const fCuenta = document.getElementById("fCuenta");
  if(fCuenta) fCuenta.onsubmit = (e)=>{
    e.preventDefault();
    conCarga(fCuenta.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const f = new FormData(fCuenta);
      const data = {nombre:f.get("nombre"), saldo_inicial:parseFloat(f.get("saldoInicial")), orden:siguienteOrdenLista(cuentas)};
      const {error} = await sb.from("cuentas").insert(data);
      if(error){ showError("No se pudo guardar la cuenta: "+error.message); return; }
      hideError(); fCuenta.reset(); await fetchAll();
    });
  };
  document.querySelectorAll("[data-del-deuda]").forEach(b=>b.onclick=()=>{
    if(!confirm("¿Borrar esta deuda?")) return;
    conCarga(b, "Borrando…", async ()=>{
      const {error} = await sb.from("deudas").delete().eq("id", b.dataset.delDeuda);
      if(error){ showError("No se pudo borrar: "+error.message); return; }
      hideError(); await fetchAll();
    });
  });
  document.querySelectorAll("[data-del-cuenta]").forEach(b=>b.onclick=()=>{
    if(!confirm("¿Borrar esta cuenta? Los movimientos ya registrados en ella no se borran.")) return;
    conCarga(b, "Borrando…", async ()=>{
      const {error} = await sb.from("cuentas").delete().eq("id", b.dataset.delCuenta);
      if(error){ showError("No se pudo borrar: "+error.message); return; }
      hideError(); await fetchAll();
    });
  });
  document.querySelectorAll("[data-ir-tab]").forEach(b=>b.onclick=()=>{ tab=b.dataset.irTab; render(); });
  document.querySelectorAll("[data-rango-pat]").forEach(b=>b.onclick=()=>{ patrimonioRango = b.dataset.rangoPat; render(); });
  document.querySelectorAll("[data-toggle-ahorro]").forEach(b=>b.onclick=()=>{ resumenAhorroAbierto = !resumenAhorroAbierto; render(); });
  document.querySelectorAll("[data-gastos-cat]").forEach(b=>b.onclick=()=>{
    const cat = b.dataset.gastosCat;
    gastosCatSel = (!cat || gastosCatSel===cat) ? null : cat;
    render();
  });
  document.querySelectorAll("[data-resumen-sel]").forEach(b=>b.onclick=()=>{
    const [t,cat] = b.dataset.resumenSel.split("|");
    resumenSel = (resumenSel && resumenSel.tipo===t && resumenSel.categoria===cat) ? null : {tipo:t, categoria:cat};
    render();
  });
  document.querySelectorAll("[data-ajustar-saldo]").forEach(b=>b.onclick=()=>{ ajustarSaldoId = b.dataset.ajustarSaldo; pendienteEnfoque = "saldoRealInput"; render(); });
  document.querySelectorAll("[data-cancelar-ajuste]").forEach(b=>b.onclick=()=>{ ajustarSaldoId = null; render(); });
  document.querySelectorAll("[data-confirmar-ajuste]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
    const cuentaId = b.dataset.confirmarAjuste;
    const nuevo = parseFloat(document.getElementById("saldoRealInput")?.value);
    if(isNaN(nuevo)) return;
    const {error} = await sb.rpc("ajustar_saldo_cuenta", {p_cuenta_id: cuentaId, p_saldo_real: nuevo});
    if(error){ showError("No se pudo ajustar el saldo: "+error.message); return; }
    hideError(); ajustarSaldoId = null; await fetchAll();
  }));
  document.querySelectorAll("[data-pres-deuda]").forEach(b=>b.onclick=()=>{ editarPresDeudaId = b.dataset.presDeuda; saldarId = null; render(); });
  document.querySelectorAll("[data-cancelar-pres-deuda]").forEach(b=>b.onclick=()=>{ editarPresDeudaId = null; render(); });
  document.querySelectorAll("[data-confirmar-pres-deuda]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
    const id = b.dataset.confirmarPresDeuda;
    const mov = document.getElementById("presDeudaSel")?.value || null;
    const {error} = await sb.from("deudas").update({movimiento_id: mov}).eq("id", id);
    if(error){ showError("No se pudo guardar: "+error.message); return; }
    hideError(); editarPresDeudaId = null; await fetchAll();
  }));
  function refrescarListaMov(){
    const wrap = document.getElementById("movListaWrap");
    if(!wrap) return;
    wrap.innerHTML = renderMovimientosLista();
    wireListaMovimientos();
  }
  function wireListaMovimientos(){
    document.querySelectorAll("[data-del-mov]").forEach(b=>b.onclick=()=>{
      if(!confirm("¿Borrar este movimiento?")) return;
      conCarga(b, "Borrando…", async ()=>{
        const {error} = await sb.from("movimientos").delete().eq("id", b.dataset.delMov);
        if(error){ showError("No se pudo borrar: "+error.message); return; }
        hideError(); await fetchAll();
      });
    });
    document.querySelectorAll("[data-del-transferencia]").forEach(b=>b.onclick=()=>{
      if(!confirm("¿Borrar esta transferencia? Se deshacen los dos movimientos.")) return;
      conCarga(b, "Borrando…", async ()=>{
        const {error} = await sb.rpc("eliminar_transferencia", {p_transferencia_id: b.dataset.delTransferencia});
        if(error){ showError("No se pudo borrar: "+error.message); return; }
        hideError(); await fetchAll();
      });
    });
    document.querySelectorAll("[data-me-deben]").forEach(b=>b.onclick=()=>{ meDebenMovId = b.dataset.meDeben; editarMovId=null; render(); });
    document.querySelectorAll("[data-cancelar-me-deben]").forEach(b=>b.onclick=()=>{ meDebenMovId = null; render(); });
    document.querySelectorAll("[data-confirmar-me-deben]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
      const id = b.dataset.confirmarMeDeben;
      const m = movimientos.find(x=>x.id===id);
      const persona = document.getElementById("mdPersona")?.value.trim();
      const imp = parseFloat(document.getElementById("mdImporte")?.value);
      if(!m || !persona || isNaN(imp) || imp<=0){ showError("Escribe quién te lo debe y una cantidad válida."); return; }
      if(imp>m.importe){ showError("Te pueden deber como máximo el importe del gasto ("+eur(m.importe)+")."); return; }
      const {error} = await sb.from("deudas").insert({persona, importe:imp, importe_inicial:imp, direccion:"me_deben", fecha:m.fecha, concepto:m.nota||m.categoria, estado:"pendiente", movimiento_id:m.id});
      if(error){ showError("No se pudo crear la deuda: "+error.message); return; }
      hideError(); meDebenMovId = null; await fetchAll();
    }));
    document.querySelectorAll("[data-toggle-conciliado]").forEach(b=>b.onclick=()=>conCarga(b, "…", async ()=>{
      const m = movimientos.find(x=>x.id===b.dataset.toggleConciliado);
      if(!m) return;
      const {error} = await sb.from("movimientos").update({conciliado: !m.conciliado}).eq("id", m.id);
      if(error){ showError("No se pudo actualizar: "+error.message); return; }
      hideError(); await fetchAll();
    }));
    document.querySelectorAll("[data-editar-mov]").forEach(b=>b.onclick=()=>{ editarMovId = b.dataset.editarMov; meDebenMovId=null; render(); });
    document.querySelectorAll("[data-duplicar-mov]").forEach(b=>b.onclick=()=>{
      const m = movimientos.find(x=>x.id===b.dataset.duplicarMov);
      if(!m) return;
      movPlantilla = {tipo:m.tipo, categoria:m.categoria, importe:m.importe, cuentaId:m.cuentaId, nota:m.nota||""};
      formsEstado["mov"] = true;
      editarMovId = null; meDebenMovId = null;
      const hoy = new Date();
      if(periodoMes==="todos"){ periodoMes = String(hoy.getMonth()+1); periodoAnio = hoy.getFullYear(); }
      pendienteEnfoque = "fMov";
      render();
    });
    document.querySelectorAll("[data-cancelar-editar-mov]").forEach(b=>b.onclick=()=>{ editarMovId = null; render(); });
    document.querySelectorAll("#movEditTipo").forEach(sel=>sel.onchange=()=>{
      const cat = document.getElementById("movEditCategoria");
      if(cat) cat.innerHTML = opcionesCategoriaPend(sel.value, null);
    });
    document.querySelectorAll("[data-confirmar-editar-mov]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
      const id = b.dataset.confirmarEditarMov;
      const tipo = document.getElementById("movEditTipo")?.value;
      const categoria = document.getElementById("movEditCategoria")?.value;
      const importe = parseFloat(document.getElementById("movEditImporte")?.value);
      const fecha = document.getElementById("movEditFecha")?.value;
      const cuentaId = document.getElementById("movEditCuenta")?.value;
      const nota = document.getElementById("movEditNota")?.value || "";
      if(!categoria || isNaN(importe) || importe<=0 || !fecha || !cuentaId){ showError("Revisa los datos del movimiento."); return; }
      const {error} = await sb.from("movimientos").update({tipo, categoria, importe, fecha, nota, cuenta_id:cuentaId}).eq("id", id);
      if(error){ showError("No se pudo guardar: "+error.message); return; }
      hideError(); editarMovId = null; await fetchAll();
    }));
  }
  wireListaMovimientos();
  const movBuscar = document.getElementById("movBuscar");
  if(movBuscar) movBuscar.oninput = ()=>{ movBuscarTexto = movBuscar.value; refrescarListaMov(); };
  const movFiltroCat = document.getElementById("movFiltroCat");
  if(movFiltroCat) movFiltroCat.onchange = ()=>{ movFiltroCategoria = movFiltroCat.value; refrescarListaMov(); };
  const fTransferencia = document.getElementById("fTransferencia");
  if(fTransferencia) fTransferencia.onsubmit = (e)=>{
    e.preventDefault();
    conCarga(fTransferencia.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const f = new FormData(fTransferencia);
      const origen = f.get("origen"), destino = f.get("destino");
      const importe = parseFloat(f.get("importe"));
      if(origen===destino){ showError("Elige dos cuentas distintas."); return; }
      if(isNaN(importe) || importe<=0){ showError("Escribe un importe válido."); return; }
      const {error} = await sb.rpc("crear_transferencia", {p_cuenta_origen:origen, p_cuenta_destino:destino, p_importe:importe, p_fecha:f.get("fecha"), p_nota:f.get("nota")||""});
      if(error){ showError("No se pudo transferir: "+error.message); return; }
      hideError(); fTransferencia.reset(); await fetchAll();
    });
  };
  document.querySelectorAll("[data-saldar]").forEach(b=>b.onclick=()=>{ saldarId = b.dataset.saldar; editarPresDeudaId = null; render(); });
  document.querySelectorAll("[data-cancelar-saldar]").forEach(b=>b.onclick=()=>{ saldarId = null; render(); });
  document.querySelectorAll("[data-confirmar-saldar]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
    const deudaId = b.dataset.confirmarSaldar;
    const sel = document.getElementById("saldarCuenta");
    if(!sel || !sel.value) return;
    const importe = parseFloat(document.getElementById("saldarImporte")?.value);
    if(isNaN(importe) || importe<=0){ showError("Escribe un importe válido."); return; }
    const cat = document.getElementById("saldarCat")?.value || null;
    const {error} = await sb.rpc("saldar_deuda", {p_deuda_id: deudaId, p_cuenta_id: sel.value, p_categoria: cat, p_importe: importe});
    if(error){ showError("No se pudo saldar la deuda: "+error.message); return; }
    hideError(); saldarId = null; await fetchAll();
  }));
  const invEstado = document.getElementById("invEstado");
  const invValorWrap = document.getElementById("invValorWrap");
  const invValorInput = document.getElementById("invValorInput");
  const invPlanWrap = document.getElementById("invPlanWrap");
  if(invEstado && invValorWrap){
    const toggleInv = ()=>{
      const esPlan = invEstado.value === "planificada";
      invValorWrap.style.display = esPlan ? "none" : "block";
      if(invValorInput) invValorInput.required = !esPlan;
      if(invPlanWrap) invPlanWrap.style.display = esPlan ? "block" : "none";
    };
    toggleInv(); invEstado.onchange = toggleInv;
  }
  const fInversion = document.getElementById("fInversion");
  if(fInversion) fInversion.onsubmit = (e)=>{
    e.preventDefault();
    conCarga(fInversion.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const f = new FormData(fInversion);
      const estado = f.get("estado")||"activa";
      const valInicial = estado==="planificada" ? 0 : parseFloat(f.get("valorActual"));
      const data = {nombre:f.get("nombre"), tipo:f.get("tipo")||"", valor_actual:valInicial, valor_inicial:valInicial, estado};
      data.padre_id = f.get("grupoId") || null;
      data.orden = siguienteOrden();
      if(estado==="planificada"){
        data.fecha_prevista = f.get("fechaPrevista") || null;
        data.importe_previsto = f.get("importePrevisto") ? parseFloat(f.get("importePrevisto")) : null;
        data.cuenta_prevista_id = f.get("cuentaPrevista") || null;
      }
      const {error} = await sb.from("inversiones").insert(data);
      if(error){ showError("No se pudo guardar la inversión: "+error.message); return; }
      hideError(); fInversion.reset(); await fetchAll();
    });
  };
  document.querySelectorAll("[data-del-inv]").forEach(b=>b.onclick=()=>{
    const esG = inversiones.find(i=>i.id===b.dataset.delInv)?.esGrupo;
    if(!confirm(esG ? "¿Borrar este grupo? Las inversiones de dentro no se borran, quedarán sueltas." : "¿Borrar esta inversión? También se borrarán sus aportaciones y los gastos que generó.")) return;
    conCarga(b, "Borrando…", async ()=>{
      const {error} = await sb.rpc("eliminar_inversion", {p_inversion_id: b.dataset.delInv});
      if(error){ showError("No se pudo borrar: "+error.message); return; }
      hideError(); await fetchAll();
    });
  });
  document.querySelectorAll("[data-expandir-inv]").forEach(b=>b.onclick=()=>{
    const id = b.dataset.expandirInv;
    expandidaInvId = expandidaInvId===id ? null : id;
    aportarInvId=null; editarValorInvId=null; verAportacionesId=null; editarInfoInvId=null; rescatarInvId=null; rentasInvId=null;
    render();
  });
  document.querySelectorAll("[data-editar-info]").forEach(b=>b.onclick=()=>{ editarInfoInvId=b.dataset.editarInfo; pendienteEnfoque = "infoNombre"; render(); });
  document.querySelectorAll("[data-cancelar-info]").forEach(b=>b.onclick=()=>{ editarInfoInvId=null; render(); });
  document.querySelectorAll("[data-confirmar-info]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
    const invId = b.dataset.confirmarInfo;
    const nombre = document.getElementById("infoNombre")?.value.trim();
    const tipo = document.getElementById("infoTipo")?.value.trim();
    if(!nombre) return;
    const data = {nombre, tipo};
    const grupoEl = document.getElementById("infoGrupo");
    if(grupoEl) data.padre_id = grupoEl.value || null;
    const fechaEl = document.getElementById("infoFechaPrevista");
    const importeEl = document.getElementById("infoImportePrevisto");
    const cuentaEl = document.getElementById("infoCuentaPrevista");
    if(fechaEl){
      data.fecha_prevista = fechaEl.value || null;
      data.importe_previsto = importeEl?.value ? parseFloat(importeEl.value) : null;
      data.cuenta_prevista_id = cuentaEl?.value || null;
    }
    const {error} = await sb.from("inversiones").update(data).eq("id", invId);
    if(error){ showError("No se pudo guardar: "+error.message); return; }
    hideError(); editarInfoInvId = null; await fetchAll();
  }));
  document.querySelectorAll("[data-aportar-inv]").forEach(b=>b.onclick=()=>{ aportarInvId=b.dataset.aportarInv; editarValorInvId=null; pendienteEnfoque = "aportarImporte"; render(); });
  document.querySelectorAll("[data-cancelar-aportar]").forEach(b=>b.onclick=()=>{ aportarInvId=null; render(); });
  document.querySelectorAll("[data-confirmar-aportar]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
    const invId = b.dataset.confirmarAportar;
    const importeEl = document.getElementById("aportarImporte");
    const cuentaEl = document.getElementById("aportarCuenta");
    const importe = parseFloat(importeEl?.value);
    if(!cuentaEl?.value || !importe || importe<=0) return;
    const {error} = await sb.rpc("aportar_inversion", {p_inversion_id: invId, p_importe: importe, p_cuenta_id: cuentaEl.value});
    if(error){ showError("No se pudo guardar la aportación: "+error.message); return; }
    hideError(); aportarInvId = null; await fetchAll();
  }));
  document.querySelectorAll("[data-rescatar-inv]").forEach(b=>b.onclick=()=>{ rescatarInvId=b.dataset.rescatarInv; aportarInvId=null; editarValorInvId=null; pendienteEnfoque = "rescatarImporte"; render(); });
  document.querySelectorAll("[data-cancelar-rescate]").forEach(b=>b.onclick=()=>{ rescatarInvId=null; render(); });
  document.querySelectorAll("[data-confirmar-rescate]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
    const invId = b.dataset.confirmarRescate;
    const importeEl = document.getElementById("rescatarImporte");
    const cuentaEl = document.getElementById("rescatarCuenta");
    const importe = parseFloat(importeEl?.value);
    if(!cuentaEl?.value || !importe || importe<=0) return;
    const {error} = await sb.rpc("rescatar_inversion", {p_inversion_id: invId, p_importe: importe, p_cuenta_id: cuentaEl.value});
    if(error){ showError("No se pudo rescatar: "+error.message); return; }
    hideError(); rescatarInvId = null; await fetchAll();
  }));
  document.querySelectorAll("[data-del-retiro]").forEach(b=>b.onclick=()=>{
    if(!confirm("¿Deshacer este rescate? Se borrará el ingreso asociado y volverá a la inversión.")) return;
    conCarga(b, "Borrando…", async ()=>{
      const {error} = await sb.rpc("eliminar_retiro", {p_retiro_id: b.dataset.delRetiro});
      if(error){ showError("No se pudo deshacer: "+error.message); return; }
      hideError(); await fetchAll();
    });
  });
  document.querySelectorAll("[data-ver-aportaciones]").forEach(b=>b.onclick=()=>{
    verAportacionesId = verAportacionesId===b.dataset.verAportaciones ? null : b.dataset.verAportaciones;
    render();
  });
  document.querySelectorAll("[data-del-aportacion]").forEach(b=>b.onclick=()=>{
    if(!confirm("¿Borrar esta aportación? También se borrará el gasto asociado y se restará del valor de la inversión.")) return;
    conCarga(b, "Borrando…", async ()=>{
      const {error} = await sb.rpc("eliminar_aportacion", {p_aportacion_id: b.dataset.delAportacion});
      if(error){ showError("No se pudo borrar la aportación: "+error.message); return; }
      hideError(); await fetchAll();
    });
  });
  document.querySelectorAll("[data-editar-valor]").forEach(b=>b.onclick=()=>{ editarValorInvId=b.dataset.editarValor; aportarInvId=null; pendienteEnfoque = "valorNuevo"; render(); });
  document.querySelectorAll("[data-cancelar-valor]").forEach(b=>b.onclick=()=>{ editarValorInvId=null; render(); });
  document.querySelectorAll("[data-confirmar-valor]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
    const invId = b.dataset.confirmarValor;
    const nuevo = parseFloat(document.getElementById("valorNuevo")?.value);
    if(isNaN(nuevo)) return;
    const {error} = await sb.from("inversiones").update({valor_actual:nuevo}).eq("id", invId);
    if(error){ showError("No se pudo guardar el nuevo valor: "+error.message); return; }
    hideError(); editarValorInvId = null; await fetchAll();
  }));
  const catTipo = document.getElementById("catTipo");
  const catPadreWrap = document.getElementById("catPadreWrap");
  if(catTipo && catPadreWrap){
    const toggle = ()=> catPadreWrap.style.display = catTipo.value==="ingreso" ? "none" : "block";
    toggle(); catTipo.onchange = toggle;
  }
  const fCategoria = document.getElementById("fCategoria");
  if(fCategoria) fCategoria.onsubmit = (e)=>{
    e.preventDefault();
    conCarga(fCategoria.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const f = new FormData(fCategoria);
      const tipoVal = f.get("tipo");
      const data = {tipo:tipoVal, padre: tipoVal==="gasto" ? (f.get("padre")||"Otros") : null, nombre:f.get("nombre")};
      const {error} = await sb.from("categorias").insert(data);
      if(error){ showError("No se pudo guardar la categoría: "+error.message); return; }
      hideError(); fCategoria.reset(); await fetchAll();
    });
  };
  document.querySelectorAll("[data-del-cat]").forEach(b=>b.onclick=()=>{
    if(!confirm("¿Borrar esta categoría?")) return;
    conCarga(b, "Borrando…", async ()=>{
      const {error} = await sb.from("categorias").delete().eq("id", b.dataset.delCat);
      if(error){ showError("No se pudo borrar: "+error.message); return; }
      hideError(); await fetchAll();
    });
  });
  document.querySelectorAll("[data-editar-cat]").forEach(b=>b.onclick=()=>{ editarCatId=b.dataset.editarCat; render(); });
  document.querySelectorAll("[data-cancelar-cat]").forEach(b=>b.onclick=()=>{ editarCatId=null; render(); });
  document.querySelectorAll("[data-confirmar-cat]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
    const catId = b.dataset.confirmarCat;
    const nuevo = document.getElementById("catNuevoNombre")?.value.trim();
    if(!nuevo) return;
    const {error} = await sb.from("categorias").update({nombre:nuevo}).eq("id", catId);
    if(error){ showError("No se pudo renombrar: "+error.message); return; }
    hideError(); editarCatId = null; await fetchAll();
  }));

  document.querySelectorAll("[data-toggle-grupo]").forEach(b=>b.onclick=()=>{ const id=b.dataset.toggleGrupo; gruposAbiertos[id]=!gruposAbiertos[id]; render(); });
  document.querySelectorAll("[data-rentas-inv]").forEach(b=>b.onclick=()=>{ rentasInvId=b.dataset.rentasInv; aportarInvId=null; editarValorInvId=null; rescatarInvId=null; pendienteEnfoque = "rentasImporte"; render(); });
  document.querySelectorAll("[data-cancelar-rentas]").forEach(b=>b.onclick=()=>{ rentasInvId=null; render(); });
  const guardarRentas = (b, modo)=>conCarga(b, "Guardando…", async ()=>{
    const id = modo==="sumar" ? b.dataset.sumarRentas : b.dataset.fijarRentas;
    const v = parseFloat(document.getElementById("rentasImporte")?.value);
    const inv = inversiones.find(i=>i.id===id);
    if(!inv) return;
    if(isNaN(v)){ showError("Escribe la cantidad de rentas (por ejemplo 10 o 2,50)."); return; }
    const nuevo = Math.round((modo==="sumar" ? (inv.rentas||0)+v : v)*100)/100;
    if(nuevo<0){ showError("Las rentas no pueden quedar en negativo."); return; }
    const {error} = await sb.from("inversiones").update({rentas:nuevo}).eq("id", id);
    if(error){ showError("No se pudieron guardar las rentas: "+error.message); return; }
    hideError(); rentasInvId = null; await fetchAll();
  });
  document.querySelectorAll("[data-sumar-rentas]").forEach(b=>b.onclick=()=>guardarRentas(b,"sumar"));
  document.querySelectorAll("[data-fijar-rentas]").forEach(b=>b.onclick=()=>guardarRentas(b,"fijar"));
  const proyCalcular = document.getElementById("proyCalcular");
  if(proyCalcular) proyCalcular.onclick = ()=>{
    const inicial = parseFloat(document.getElementById("proyInicial")?.value);
    const aporte = parseFloat(document.getElementById("proyAporte")?.value);
    const anios = Math.round(parseFloat(document.getElementById("proyAnios")?.value));
    const tasa = parseFloat(document.getElementById("proyTasa")?.value);
    if(isNaN(inicial) || isNaN(aporte) || isNaN(anios) || isNaN(tasa) || anios<1){
      showError("Revisa los datos: capital, aportación, años y rentabilidad deben ser números válidos.");
      return;
    }
    hideError();
    proy = {inicial, aporte: Math.max(aporte,0), anios: Math.min(Math.max(anios,1),60), tasa, detalle:false};
    calcularProyeccion();
    render();
  };
  document.querySelectorAll("#proyToggleDetalle").forEach(b=>b.onclick=()=>{ proy.detalle = !proy.detalle; render(); });
  const recTipo = document.getElementById("recTipo");
  const recCategoria = document.getElementById("recCategoria");
  if(recTipo && recCategoria){
    const fill = ()=>{ recCategoria.innerHTML = opcionesCategoriaPend(recTipo.value, null); };
    fill(); recTipo.onchange = fill;
  }
  const fRecurrente = document.getElementById("fRecurrente");
  if(fRecurrente) fRecurrente.onsubmit = (e)=>{
    e.preventDefault();
    conCarga(fRecurrente.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const f = new FormData(fRecurrente);
      const data = {
        tipo: f.get("tipo"), categoria: f.get("categoria"), importe: parseFloat(f.get("importe")),
        nota: f.get("nota")||"", cuenta_id: f.get("cuentaId")||null,
        dia_mes: Math.min(Math.max(parseInt(f.get("diaMes"),10)||1,1),28), fecha_inicio: f.get("fechaInicio")
      };
      const {error} = await sb.from("recurrentes").insert(data);
      if(error){ showError("No se pudo guardar: "+error.message); return; }
      hideError(); fRecurrente.reset(); await fetchAll();
    });
  };
  document.querySelectorAll("[data-toggle-recurrente]").forEach(b=>b.onclick=()=>conCarga(b, "…", async ()=>{
    const r = recurrentes.find(x=>x.id===b.dataset.toggleRecurrente);
    if(!r) return;
    const {error} = await sb.from("recurrentes").update({activo: !r.activo}).eq("id", r.id);
    if(error){ showError("No se pudo actualizar: "+error.message); return; }
    hideError(); await fetchAll();
  }));
  document.querySelectorAll("[data-del-recurrente]").forEach(b=>b.onclick=()=>{
    if(!confirm("¿Borrar este recurrente? Los movimientos que ya generó no se borran.")) return;
    conCarga(b, "Borrando…", async ()=>{
      const {error} = await sb.from("recurrentes").delete().eq("id", b.dataset.delRecurrente);
      if(error){ showError("No se pudo borrar: "+error.message); return; }
      hideError(); await fetchAll();
    });
  });
  const btnExportar = document.getElementById("btnExportar");
  if(btnExportar) btnExportar.onclick = ()=>{
    const datos = {
      exportado_en: new Date().toISOString(),
      cuentas, movimientos, deudas, inversiones, aportaciones, retiros,
      categorias, presupuestos, objetivos, recurrentes, pendientes
    };
    const blob = new Blob([JSON.stringify(datos, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `finanzas-backup-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };
  const prefForms = document.getElementById("prefForms");
  if(prefForms) prefForms.onchange = ()=>{
    formsPorDefecto = prefForms.value === "cerrados" ? "cerrados" : "abiertos";
    formsEstado = {};
    try{ localStorage.setItem("formsPorDefecto", formsPorDefecto); }catch(e){}
  };
  const prefCuenta = document.getElementById("prefCuenta");
  if(prefCuenta) prefCuenta.onchange = async ()=>{
    const estado = document.getElementById("prefEstado");
    if(estado) estado.textContent = "Guardando…";
    const ok = await guardarCuentaDefecto(prefCuenta.value);
    if(estado) estado.textContent = ok ? "Guardado" : "";
  };
  const guardarContraidas = ()=>{ try{ localStorage.setItem("catsContraidas", JSON.stringify(catsContraidas)); }catch(e){} };
  document.querySelectorAll("[data-toggle-cat]").forEach(b=>b.onclick=()=>{
    const k = b.dataset.toggleCat;
    if(catsContraidas[k]) delete catsContraidas[k]; else catsContraidas[k] = true;
    guardarContraidas(); render();
  });
  document.querySelectorAll("[data-toggle-todas-cats]").forEach(b=>b.onclick=()=>{
    if(b.dataset.toggleTodasCats==="contraer"){
      categorias.filter(c=>c.tipo==="gasto").forEach(c=>{ catsContraidas[c.padre||"Otros"] = true; });
      if(categorias.some(c=>c.tipo==="ingreso")) catsContraidas["__ingresos__"] = true;
    } else catsContraidas = {};
    guardarContraidas(); render();
  });
  const fGrupo = document.getElementById("fGrupo");
  if(fGrupo) fGrupo.onsubmit = (e)=>{
    e.preventDefault();
    conCarga(fGrupo.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const f = new FormData(fGrupo);
      const data = {nombre:f.get("nombre"), tipo:"", valor_actual:0, valor_inicial:0, estado:"activa", es_grupo:true, orden:siguienteOrden()};
      const {error} = await sb.from("inversiones").insert(data);
      if(error){ showError("No se pudo crear el grupo: "+error.message); return; }
      hideError(); fGrupo.reset(); await fetchAll();
    });
  };

  const fPresupuesto = document.getElementById("fPresupuesto");
  if(fPresupuesto) fPresupuesto.onsubmit = (e)=>{
    e.preventDefault();
    conCarga(fPresupuesto.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const f = new FormData(fPresupuesto);
      const data = {categoria:f.get("categoria"), limite:parseFloat(f.get("limite"))};
      const {error} = await sb.from("presupuestos").insert(data);
      if(error){ showError("No se pudo guardar el presupuesto: "+error.message); return; }
      hideError(); fPresupuesto.reset(); await fetchAll();
    });
  };
  document.querySelectorAll("[data-del-presupuesto]").forEach(b=>b.onclick=()=>{
    if(!confirm("¿Borrar este presupuesto?")) return;
    conCarga(b, "Borrando…", async ()=>{
      const {error} = await sb.from("presupuestos").delete().eq("id", b.dataset.delPresupuesto);
      if(error){ showError("No se pudo borrar: "+error.message); return; }
      hideError(); await fetchAll();
    });
  });
  document.querySelectorAll("[data-toggle-rollover]").forEach(b=>b.onclick=()=>conCarga(b, "…", async ()=>{
    const p = presupuestos.find(x=>x.id===b.dataset.toggleRollover);
    if(!p) return;
    const activar = !p.rollover;
    const hoy = new Date();
    const cambios = activar
      ? {rollover:true, rollover_desde:`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}-01`}
      : {rollover:false};
    const {error} = await sb.from("presupuestos").update(cambios).eq("id", p.id);
    if(error){ showError("No se pudo actualizar: "+error.message); return; }
    hideError(); await fetchAll();
  }));
  document.querySelectorAll("[data-editar-presupuesto]").forEach(b=>b.onclick=()=>{ editarPresupuestoId=b.dataset.editarPresupuesto; render(); });
  document.querySelectorAll("[data-cancelar-presupuesto]").forEach(b=>b.onclick=()=>{ editarPresupuestoId=null; render(); });
  document.querySelectorAll("[data-confirmar-presupuesto]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
    const id = b.dataset.confirmarPresupuesto;
    const nuevo = parseFloat(document.getElementById("presupuestoNuevoLimite")?.value);
    if(isNaN(nuevo)) return;
    const {error} = await sb.from("presupuestos").update({limite:nuevo}).eq("id", id);
    if(error){ showError("No se pudo guardar: "+error.message); return; }
    hideError(); editarPresupuestoId=null; await fetchAll();
  }));

  const objTipoVinculo = document.getElementById("objTipoVinculo");
  const objVinculoWrap = document.getElementById("objVinculoWrap");
  const objVinculoSelect = document.getElementById("objVinculoSelect");
  if(objTipoVinculo && objVinculoWrap){
    const toggleObj = ()=>{
      const v = objTipoVinculo.value;
      objVinculoWrap.style.display = v==="ninguno" ? "none" : "block";
      if(objVinculoSelect){
        if(v==="cuenta") objVinculoSelect.innerHTML = opcionesCuentas();
        else if(v==="inversion") objVinculoSelect.innerHTML = inversiones.map(i=>`<option value="${i.id}">${esc(i.nombre)}${i.esGrupo?" (grupo)":""}</option>`).join("");
      }
    };
    toggleObj(); objTipoVinculo.onchange = toggleObj;
  }
  document.querySelectorAll("[data-toggle-auto-obj]").forEach(b=>b.onclick=()=>{ editarAutoObjId = b.dataset.toggleAutoObj; pendienteEnfoque = "autoObjCuota"; render(); });
  document.querySelectorAll("[data-cancelar-auto-obj]").forEach(b=>b.onclick=()=>{ editarAutoObjId = null; render(); });
  document.querySelectorAll("[data-confirmar-auto-obj]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
    const id = b.dataset.confirmarAutoObj;
    const cuota = parseFloat(document.getElementById("autoObjCuota")?.value);
    const dia = Math.min(Math.max(parseInt(document.getElementById("autoObjDia")?.value,10)||1,1),28);
    const cuentaOrigen = document.getElementById("autoObjCuenta")?.value;
    if(isNaN(cuota) || cuota<=0 || !cuentaOrigen){ showError("Pon una cuota y una cuenta de origen válidas."); return; }
    const {error} = await sb.from("objetivos").update({auto_activo:true, auto_cuota:cuota, auto_dia_mes:dia, auto_cuenta_origen:cuentaOrigen}).eq("id", id);
    if(error){ showError("No se pudo guardar: "+error.message); return; }
    hideError(); editarAutoObjId = null; await fetchAll();
  }));
  document.querySelectorAll("[data-desactivar-auto-obj]").forEach(b=>b.onclick=()=>conCarga(b, "…", async ()=>{
    const {error} = await sb.from("objetivos").update({auto_activo:false}).eq("id", b.dataset.desactivarAutoObj);
    if(error){ showError("No se pudo desactivar: "+error.message); return; }
    hideError(); editarAutoObjId = null; await fetchAll();
  }));
  const fObjetivo = document.getElementById("fObjetivo");
  if(fObjetivo) fObjetivo.onsubmit = (e)=>{
    e.preventDefault();
    conCarga(fObjetivo.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const f = new FormData(fObjetivo);
      const tipoVinculo = f.get("tipoVinculo")||"ninguno";
      const data = {nombre:f.get("nombre"), meta:parseFloat(f.get("meta")), tipo_vinculo:tipoVinculo, vinculo_id: tipoVinculo==="ninguno"?null:(f.get("vinculoId")||null), orden:siguienteOrdenLista(objetivos)};
      const {error} = await sb.from("objetivos").insert(data);
      if(error){ showError("No se pudo guardar el objetivo: "+error.message); return; }
      hideError(); fObjetivo.reset(); await fetchAll();
    });
  };
  document.querySelectorAll("[data-del-objetivo]").forEach(b=>b.onclick=()=>{
    if(!confirm("¿Borrar este objetivo?")) return;
    conCarga(b, "Borrando…", async ()=>{
      const {error} = await sb.from("objetivos").delete().eq("id", b.dataset.delObjetivo);
      if(error){ showError("No se pudo borrar: "+error.message); return; }
      hideError(); await fetchAll();
    });
  });

  const guessAny = (res)=>{
    const norm = h=>h.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    for(const re of res){ const h = csvHeaders.find(x=>re.test(norm(x))); if(h) return h; }
    return "";
  };
  const csvFile = document.getElementById("csvFile");
  if(csvFile) csvFile.onchange = ()=>{
    const file = csvFile.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      let txt;
      try{ txt = new TextDecoder("utf-8", {fatal:true}).decode(reader.result); }
      catch(e){ txt = new TextDecoder("windows-1252").decode(reader.result); }
      txt = txt.replace(/^\uFEFF/, "");
      const {headers, filas} = parseCSV(txt);
      csvHeaders = headers; csvFilas = filas; csvPreview = [];
      csvSel = {
        fecha: guessAny([/fecha operacion/,/fecha/,/date/]) || headers[0] || "",
        importe: guessAny([/importe/,/amount/,/cantidad/]) || headers[1] || headers[0] || "",
        nota: guessAny([/concepto/,/descripcion/,/detalle/,/movimiento/,/description/]),
        saldo: guessAny([/saldo/,/balance/]),
        cuenta: cuentaPorDefecto() || (cuentas[0] ? cuentas[0].id : "")
      };
      render();
    };
    reader.readAsArrayBuffer(file);
  };
  [["csvColFecha","fecha"],["csvColImporte","importe"],["csvColNota","nota"],["csvColSaldo","saldo"]].forEach(([id,k])=>{
    const el = document.getElementById(id);
    if(el) el.onchange = ()=>{ csvSel[k] = el.value; if(csvPreview.length){ csvPreview = []; render(); } };
  });
  const csvCuentaEl = document.getElementById("csvCuenta");
  if(csvCuentaEl) csvCuentaEl.onchange = ()=>{ csvSel.cuenta = csvCuentaEl.value; if(csvPreview.length){ calcularPreview(); render(); } };
  const csvPrevisualizar = document.getElementById("csvPrevisualizar");
  if(csvPrevisualizar) csvPrevisualizar.onclick = ()=>{ calcularPreview(); render(); };
  const csvImportar = document.getElementById("csvImportar");
  document.querySelectorAll("[data-decision]").forEach(sel=>sel.onchange=()=>{ csvDecisiones[sel.dataset.decision] = sel.value; render(); });
  if(csvImportar) csvImportar.onclick = ()=>conCarga(csvImportar, "Guardando…", async ()=>{
    const conciliar = csvPreview.filter(m=>!m.invalida && !m.dup && m.matchId && (csvDecisiones[m.posicion]||"igual")==="igual");
    const nuevas = csvPreview.filter(m=>!m.invalida && (!m.dup && (!m.matchId || (csvDecisiones[m.posicion]||"igual")==="distinto")));
    if(!csvSel.cuenta) return;
       if(conciliar.length){
      const items = conciliar.map(m=>({id:m.matchId, saldo:m.saldo??null}));
      const {error} = await sb.rpc("conciliar_movimientos_lote", {p_items:items});
      if(error){ showError("No se pudo conciliar: "+error.message); return; }
    }
    if(nuevas.length){
      const filas = nuevas.map(m=>({
        cuenta_id: csvSel.cuenta, tipo:m.tipo, importe:m.importe, fecha:m.fecha, descripcion:m.nota||"", saldo:m.saldo, posicion:m.posicion
      }));
      const {error} = await sb.from("movimientos_pendientes").insert(filas);
      if(error){ showError("No se pudo importar: "+error.message); return; }
    }
    hideError(); csvHeaders=[]; csvFilas=[]; csvPreview=[]; csvSel={}; csvDecisiones={}; await fetchAll();
  });

  document.querySelectorAll('select[id^="pendCat-"]').forEach(el=>el.onchange = ()=>{ pendCats[el.id.slice(8)] = el.value; });
  document.querySelectorAll("[data-pend-confirmar]").forEach(b=>b.onclick=()=>conCarga(b, "…", async ()=>{
    const id = b.dataset.pendConfirmar;
    const cat = document.getElementById("pendCat-"+id)?.value;
    if(!cat){ showError("Elige una categoría antes de confirmar."); return; }
    const {error} = await sb.rpc("confirmar_pendiente", {p_id:id, p_categoria:cat});
    if(error){ showError("No se pudo confirmar: "+error.message); return; }
    delete pendCats[id]; hideError(); await fetchAll();
  }));
  document.querySelectorAll("[data-pend-descartar]").forEach(b=>b.onclick=()=>{
    if(!confirm("¿Descartar este movimiento? No se importará.")) return;
    conCarga(b, "…", async ()=>{
      const id = b.dataset.pendDescartar;
      const {error} = await sb.from("movimientos_pendientes").delete().eq("id", id);
      if(error){ showError("No se pudo descartar: "+error.message); return; }
      delete pendCats[id]; hideError(); await fetchAll();
    });
  });
  const pendConfirmarTodos = document.getElementById("pendConfirmarTodos");
  if(pendConfirmarTodos) pendConfirmarTodos.onclick = ()=>conCarga(pendConfirmarTodos, "Confirmando…", async ()=>{
    const ids = [], cats = [];
    pendientes.forEach(p=>{ const c = document.getElementById("pendCat-"+p.id)?.value; if(c){ ids.push(p.id); cats.push(c); } });
    if(!ids.length){ showError("Elige la categoría de al menos un movimiento."); return; }
    const {error} = await sb.rpc("confirmar_pendientes", {p_ids:ids, p_categorias:cats});
    if(error){ showError("No se pudieron confirmar: "+error.message); return; }
    ids.forEach(id=>delete pendCats[id]); hideError(); await fetchAll();
  });
  const pendDescartarTodos = document.getElementById("pendDescartarTodos");
  if(pendDescartarTodos) pendDescartarTodos.onclick = ()=>{
    if(!confirm(`¿Descartar los ${pendientes.length} movimientos pendientes? No se importarán.`)) return;
    conCarga(pendDescartarTodos, "Descartando…", async ()=>{
      const {error} = await sb.from("movimientos_pendientes").delete().not("id","is",null);
      if(error){ showError("No se pudo descartar: "+error.message); return; }
      pendCats = {}; hideError(); await fetchAll();
    });
  };
}

init();
