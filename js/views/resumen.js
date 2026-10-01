// Pestaña «Resumen del mes»: su render y sus eventos.

function bloqueGraficaCategoria(titulo, desc, tipo){
  if(!desc.length) return `<div class="card"><h2 style="margin:0">${titulo}</h2>${tipo==="ingreso" ? vacio("hucha","La hucha espera su primer ingreso","Cuando entre dinero este mes, lo verás repartido aquí.") : vacio("nube","¡Todo tranquilo por aquí!","Aún no hay gastos registrados en este periodo.")}</div>`;
  const totalGrafica = desc.reduce((sum,d)=>sumarDinero(sum, d.total),0);
  return `
  <div class="card">
    <h2 style="margin:0">${titulo}</h2>
    <div class="cifra-adapt">${eur(totalGrafica)}</div>
    <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;margin-top:10px">
      ${donutClicable(desc, tipo, null, resumenSel && resumenSel.tipo===tipo ? resumenSel.categoria : null)}
      <div style="display:flex;flex-direction:column;gap:2px;flex:1 1 180px;min-width:0">
        ${desc.map(d=>`
          <button data-resumen-sel="${tipo}|${esc(d.categoria)}" style="display:flex;align-items:center;gap:8px;background:${resumenSel&&resumenSel.tipo===tipo&&resumenSel.categoria===d.categoria?'var(--accent-soft)':'none'};border:none;border-radius:10px;padding:6px 8px;margin:0 -8px;cursor:pointer;text-align:left;color:var(--ink);font-family:inherit;font-size:14px;font-weight:600;width:calc(100% + 16px)">
            <span style="width:12px;height:12px;border-radius:50%;background:${d.color};flex-shrink:0"></span>
            <span style="flex:1 1 90px;min-width:0;overflow-wrap:anywhere">${esc(d.categoria)}</span>
            <span class="meta" style="text-align:right;font-variant-numeric:tabular-nums"><span style="white-space:nowrap">${eur(d.total)}</span> <span style="white-space:nowrap">· ${d.pct.toFixed(0)}%</span></span>
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

  let detalle = "";
  if(resumenSel){
    const lista = (resumenSel.tipo==="ingreso"?ingresosList:gastosList).filter(m=>m.categoria===resumenSel.categoria);
    const desc = resumenSel.tipo==="ingreso"?descIngresos:descGastos;
    const info = desc.find(d=>d.categoria===resumenSel.categoria);
    if(lista.length && info){
      detalle = `
      <div class="card">
        <h2>${esc(resumenSel.categoria)}</h2>
        <div class="mini ajustable" style="margin:10px 0 12px">
          <div><b>${eur(info.total)}</b><span>Total</span></div>
          <div><b>${lista.length}</b><span>Movimientos</span></div>
          <div><b>${info.pct.toFixed(1).replace(".",",")} %</b><span>Del total</span></div>
        </div>
        <div class="list">
          ${[...lista].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(m=>filaMov(m)).join("")}
        </div>
      </div>`;
    }
  }

  const bloqueAhorro = ahorroList.length ? `
  <div class="card">
    <div class="pleg-cab ${resumenAhorroAbierto?'abierto':''}" data-toggle-ahorro="1" style="flex-wrap:wrap">
      <i style="background:var(--mint-soft)">🌱</i>
      <div style="flex:1 1 150px;min-width:0"><strong style="font-size:16px">Ahorro / Inversión</strong><div class="meta">${ahorroList.length} movimiento${ahorroList.length>1?"s":""} · no cuenta como consumo</div></div>
      <div class="cifra-adapt" style="margin:0 0 0 auto;font-size:clamp(17px,5.5vw,20px)">${eur(totalAhorro)}</div>
    </div>
    ${resumenAhorroAbierto? `
    <div class="list" style="margin-top:12px">
      ${[...ahorroList].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(m=>filaMov(m, {signo:false})).join("")}
    </div>` : ""}
  </div>` : `<div class="card"><p class="meta" style="margin:0">Sin ahorro/inversión en este periodo.</p></div>`;

  return `
  ${tarjetaCierre()}
  ${bloqueGraficaCategoria("Ingresos por categoría", descIngresos, "ingreso")}
  ${bloqueGraficaCategoria("Gastos reales por categoría", descGastos, "gasto")}
  ${bloqueAhorro}
  ${detalle}`;
}

function wireEventosResumen(){
  wireEventosCierre();
  document.querySelectorAll("[data-toggle-ahorro]").forEach(b=>b.onclick=()=>{ resumenAhorroAbierto = !resumenAhorroAbierto; render(); });
  document.querySelectorAll("[data-resumen-sel]").forEach(b=>b.onclick=()=>{
    const [t,cat] = b.dataset.resumenSel.split("|");
    resumenSel = (resumenSel && resumenSel.tipo===t && resumenSel.categoria===cat) ? null : {tipo:t, categoria:cat};
    render();
  });
}
