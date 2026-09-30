// Pestaña «Inicio»: su render y sus eventos.

function renderInicio(){
  const hoy = new Date();
  const totalInversiones = inversiones.filter(i=>i.estado==="activa").reduce((s,i)=>sumarDinero(s, i.valorActual),0);
  const meDeben = deudas.filter(d=>d.direccion==="me_deben" && d.estado==="pendiente").reduce((s,d)=>sumarDinero(s, d.importe),0);
  const debo = deudas.filter(d=>d.direccion==="debo" && d.estado==="pendiente").reduce((s,d)=>sumarDinero(s, d.importe),0);
  const patNeto = restarDinero(sumarDinero(patrimonioActual(), meDeben), debo);
  const patFin = esPeriodoActualReal() ? patNeto : patrimonioEnFecha(finPeriodoCorte());
  const patIni = patrimonioEnFecha(inicioPeriodoSeleccionado());
  const delta = restarDinero(patFin, patIni);
  const lbl = periodoMes==="todos" ? `Año ${periodoAnio}` : `${MESES[Number(periodoMes)-1]} ${periodoAnio}`;

  const enP = movimientosEfectivos();
  const ingresos = enP.filter(m=>m.tipo==="ingreso").reduce((s,m)=>sumarDinero(s, m.importe),0);
  const inversionMes = enP.filter(m=>m.tipo==="gasto" && m.categoria==="Inversión").reduce((s,m)=>sumarDinero(s, m.importe),0);
  const gastosReales = enP.filter(m=>m.tipo==="gasto" && m.categoria!=="Inversión").reduce((s,m)=>sumarDinero(s, m.importe),0);
  const ahorroMes = restarDinero(ingresos, gastosReales);
  const disponible = restarDinero(ahorroMes, inversionMes);

  const mesAnt = mesAnteriorCargado();
  const tAnt = mesAnt ? totalesEfectivos(movimientosEfectivos(mesAnt.dentro)) : null;
  const comparar = (actual, previo, masEsBueno)=>{
    if(!tAnt || previo===0) return "";
    const pct = (actual-previo)/previo*100;
    if(Math.abs(pct)<0.5) return `<div class="meta">= que ${MESES[mesAnt.m-1].toLowerCase()}</div>`;
    const bueno = (pct>0)===masEsBueno;
    return `<div class="meta" style="color:var(${bueno?'--pos':'--neg'})">${pct>0?"▲":"▼"} ${Math.abs(pct).toFixed(0)}% vs ${MESES[mesAnt.m-1].toLowerCase()}</div>`;
  };
  const alertas = presupuestosEnAlerta();
  const bloqueAlertas = alertas.length ? `
  <div class="card">
    <h2>⚠️ Presupuestos al límite</h2>
    <div class="list" style="margin-top:8px">
      ${alertas.map(a=>{
        const pasado = a.gastado>a.limite;
        return `
        <div>
          <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:5px">
            <span>${esc(a.categoria)}</span>
            <strong class="${pasado?'neg':''}">${eur(a.gastado)} de ${eur(a.limite)}</strong>
          </div>
          <div style="height:7px;background:var(--line);border-radius:999px;overflow:hidden">
            <div style="height:100%;width:${Math.min(a.pct,100)}%;background:${pasado?'var(--neg)':'#e0ac4e'};border-radius:999px"></div>
          </div>
        </div>`;
      }).join("")}
    </div>
    <button class="btn ghost" data-ir-tab="Presupuestos" style="margin-top:14px">Ver presupuestos</button>
  </div>` : "";

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
      <div><div class="num pos">${eur(ingresos)}</div><div class="lbl">Ingresos</div>${tAnt ? comparar(ingresos, tAnt.ingresos, true) : ""}</div>
      <div><div class="num neg">${eur(gastosReales)}</div><div class="lbl">Gastos</div>${tAnt ? comparar(gastosReales, tAnt.gastos, false) : ""}</div>
      <div><div class="num">${eur(ahorroMes)}</div><div class="lbl">Ahorro</div></div>
      <div><div class="num">${eur(inversionMes)}</div><div class="lbl">Inversión</div></div>
    </div>
  </div>
  ${bloqueAlertas}
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

function wireEventosInicio(){
  document.querySelectorAll("[data-ir-tab]").forEach(b=>b.onclick=()=>{ tab=b.dataset.irTab; render(); });
  document.querySelectorAll("[data-rango-pat]").forEach(b=>b.onclick=()=>{ patrimonioRango = b.dataset.rangoPat; render(); });
}
