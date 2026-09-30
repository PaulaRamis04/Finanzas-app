// Pestaña «Resumen del mes»: su render y sus eventos.

function bloqueGraficaCategoria(titulo, desc, tipo){
  if(!desc.length) return `<div class="card"><p class="meta" style="margin:0">Sin movimientos en este periodo.</p></div>`;
  const totalGrafica = desc.reduce((sum,d)=>sumarDinero(sum, d.total),0);
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
  const totalAhorro = ahorroList.reduce((s,m)=>sumarDinero(s, m.importe),0);
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

function wireEventosResumen(){
  document.querySelectorAll("[data-toggle-ahorro]").forEach(b=>b.onclick=()=>{ resumenAhorroAbierto = !resumenAhorroAbierto; render(); });
  document.querySelectorAll("[data-resumen-sel]").forEach(b=>b.onclick=()=>{
    const [t,cat] = b.dataset.resumenSel.split("|");
    resumenSel = (resumenSel && resumenSel.tipo===t && resumenSel.categoria===cat) ? null : {tipo:t, categoria:cat};
    render();
  });
}
