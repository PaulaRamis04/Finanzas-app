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
  const maxCat = Math.max(0, ...Object.values(porCategoria));
  const pctGastado = disponible>0 ? Math.min(gastado/disponible*100, 100) : (gastado>0 ? 100 : 0);
  return `
  <div class="card">
    <div class="meta" style="font-weight:600">Te queda para gastar · ${lbl}</div>
    <div style="font-size:34px;font-weight:800;letter-spacing:-0.02em;font-variant-numeric:tabular-nums;margin:2px 0 12px" class="${restante>=0?'pos':'neg'}">${eur(restante)}</div>
    <div class="barra"><div style="width:${pctGastado}%;background:${restante>=0?'var(--mint)':'var(--neg)'}"></div></div>
    <div class="meta" style="margin-top:8px">Has gastado <strong style="color:var(--ink)">${eur(gastado)}</strong> de ${eur(disponible)} disponibles</div>
  </div>
  <div class="stats">
    <div class="stat"><i style="background:var(--mint-soft)">💰</i><b class="pos">${eur(ingresos)}</b><span>Ingresos</span></div>
    <div class="stat"><i style="background:var(--lav-soft)">🌱</i><b>${eur(ahorro)}</b><span>Ahorro (inversiones)</span></div>
  </div>
  <p class="meta" style="margin:-6px 4px 0">Disponible = ingresos menos lo que aportas a inversiones.</p>
  <div class="section-title">Por categoría</div>
  <div class="list">
    ${Object.keys(porCategoria).length? Object.entries(porCategoria).sort((a,b)=>b[1]-a[1]).map(([cat,total])=>`
      <button class="cat-fila ${gastosCatSel===cat?'sel':''}" data-gastos-cat="${esc(cat)}">
        <div class="ico">${emojiCategoria(cat, "gasto")}</div>
        <div class="txt">
          <div class="top"><span>${esc(cat)}</span><span style="font-variant-numeric:tabular-nums">${eur(total)}</span></div>
          <div class="barra"><div style="width:${maxCat? total/maxCat*100 : 0}%;background:var(--accent)"></div></div>
        </div>
      </button>
    `).join("") : `<div class="card">${vacio("nube","¡Todo tranquilo por aquí!","Aún no hay compras registradas este periodo.")}</div>`}
  </div>
  ${gastosReales.length ? `<div class="section-title" style="display:flex;justify-content:space-between;align-items:center;gap:10px">
    <span>Gastos${gastosCatSel? ` · ${esc(gastosCatSel)}` : ""} <span class="meta" style="font-size:13px">(${gastosMostrados.length})</span></span>
    ${gastosCatSel? `<button class="btn ghost" data-gastos-cat="" style="color:var(--accent)">Ver todos</button>` : ""}
  </div>
  ${gastosMostrados.length? listaPorDias([...gastosMostrados].sort((a,b)=>b.fecha.localeCompare(a.fecha)), m=>filaMov(m, {fecha:false,
      extra: m.cubierto ? `De ${eur(m.importeOriginal)}; ${eur(m.cubierto)} ya cobrados` : (m.nota ? m.categoria : cuentaNombre(m.cuentaId))}))
    : `<div class="card">${gastosCatSel? vacio("hucha","Nada en esta categoría","Tu hucha lo agradece.") : vacio("nube","¡Todo tranquilo por aquí!","Aún no hay compras registradas este periodo.")}</div>`}` : ""}`;
}

function wireEventosGastos(){
  document.querySelectorAll("[data-gastos-cat]").forEach(b=>b.onclick=()=>{
    const cat = b.dataset.gastosCat;
    gastosCatSel = (!cat || gastosCatSel===cat) ? null : cat;
    render();
  });
}
