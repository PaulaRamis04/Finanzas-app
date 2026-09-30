// Pestaña «Gastos»: su render y sus eventos.

function renderGastos(){
  const enP = movimientosEfectivos();
  const ingresos = enP.filter(m=>m.tipo==="ingreso").reduce((s,m)=>sumarDinero(s, m.importe),0);
  const ahorro = enP.filter(m=>m.tipo==="gasto" && m.categoria==="Inversión").reduce((s,m)=>sumarDinero(s, m.importe),0);
  const disponible = restarDinero(ingresos, ahorro);
  const gastosReales = enP.filter(m=>m.tipo==="gasto" && m.categoria!=="Inversión" && m.importe>0);
  const gastado = gastosReales.reduce((s,m)=>sumarDinero(s, m.importe),0);
  const restante = restarDinero(disponible, gastado);
  const porCategoria = {};
  gastosReales.forEach(m=>{ porCategoria[m.categoria] = sumarDinero(porCategoria[m.categoria]||0, m.importe); });
  const gastosMostrados = gastosCatSel ? gastosReales.filter(m=>m.categoria===gastosCatSel) : gastosReales;
  const lbl = periodoMes==="todos" ? `Año ${periodoAnio}` : `${MESES[Number(periodoMes)-1]} ${periodoAnio}`;
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
  <div class="section-title">Por categoría</div>
  <div class="list">
    ${Object.keys(porCategoria).length? Object.entries(porCategoria).sort((a,b)=>b[1]-a[1]).map(([cat,total])=>`
      <button data-gastos-cat="${esc(cat)}" style="display:flex;justify-content:space-between;align-items:center;width:100%;text-align:left;background:${gastosCatSel===cat?'var(--accent-soft)':'var(--card)'};border:1px solid var(--line);border-radius:11px;padding:12px 13px;cursor:pointer;font-family:inherit;font-size:14px;color:var(--ink)">
        <span>${esc(cat)}</span><span class="amt neg">${eur(total)}</span>
      </button>
    `).join("") : `<div class="empty">Sin gastos en este periodo.</div>`}
  </div>
  <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
    <span>Movimientos de gasto${gastosCatSel? ` · ${esc(gastosCatSel)}` : ""} (${gastosMostrados.length})</span>
    ${gastosCatSel? `<button class="btn ghost" data-gastos-cat="">Ver todos</button>` : ""}
  </div>
  <div class="list">
    ${gastosMostrados.length? [...gastosMostrados].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(m=>`
      <div class="item">
        <div><span class="tag">${esc(m.categoria)}</span>${m.nota?`<div class="meta">${esc(m.nota)}</div>`:""}<div class="meta">${m.fecha}</div>${m.cubierto?`<div class="meta">De ${eur(m.importeOriginal)}; ${eur(m.cubierto)} ya cobrados de deudas</div>`:""}</div>
        <div class="amt neg">-${eur(m.importe)}</div>
      </div>`).join("") : `<div class="empty">${gastosCatSel? "Sin movimientos en esta categoría." : "Sin movimientos de gasto en este periodo."}</div>`}
  </div>`;
}

function wireEventosGastos(){
  document.querySelectorAll("[data-gastos-cat]").forEach(b=>b.onclick=()=>{
    const cat = b.dataset.gastosCat;
    gastosCatSel = (!cat || gastosCatSel===cat) ? null : cat;
    render();
  });
}
