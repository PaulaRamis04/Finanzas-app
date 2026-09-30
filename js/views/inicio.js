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
    ${vacio("hucha","Tu hucha sueña con algo","Ponle una meta: un viaje, un colchón o un capricho.")}
    <button class="btn" data-ir-tab="Objetivos">Crear un objetivo</button>
  </div>`;

  // Gráfico de gasto acumulado: por días si hay un mes elegido, por meses si es el año entero.
  const porMes = periodoMes!=="todos";
  const mesSel = Number(periodoMes);
  const esActual = porMes ? (periodoAnio===hoy.getFullYear() && mesSel===hoy.getMonth()+1) : periodoAnio===hoy.getFullYear();
  const nTramos = porMes ? new Date(periodoAnio, mesSel, 0).getDate() : 12;
  const etiquetasGasto = porMes ? Array.from({length:nTramos}, (_,i)=>String(i+1)) : MESES.map(x=>x.slice(0,3));
  const hastaTramo = esActual ? (porMes ? hoy.getDate() : hoy.getMonth()+1) : nTramos;
  const gastoTramo = Array(nTramos).fill(0);
  enP.filter(m=>m.tipo==="gasto" && m.categoria!=="Inversión").forEach(m=>{
    const i = porMes ? Number(m.fecha.slice(8,10))-1 : Number(m.fecha.slice(5,7))-1;
    if(i>=0 && i<nTramos) gastoTramo[i] = sumarDinero(gastoTramo[i], m.importe);
  });
  const acumulado = [];
  gastoTramo.slice(0, hastaTramo).forEach(v=>acumulado.push(sumarDinero(acumulado.length ? acumulado[acumulado.length-1] : 0, v)));
  const presupuestoTotal = porMes ? presupuestos.reduce((s,p)=>sumarDinero(s, p.limite, rolloverAcumulado(p)), 0) : 0;
  const pctPat = patIni ? delta/Math.abs(patIni)*100 : 0;
  const nombre = (session?.user?.user_metadata?.full_name || "").trim().split(/\s+/)[0];
  const avisos = hayAvisosNuevos();
  const vistas = new Set();
  const recientes = [...movimientos].sort((a,b)=>b.fecha.localeCompare(a.fecha)).filter(m=>{
    if(!m.transferenciaId) return true;
    if(vistas.has(m.transferenciaId)) return false;
    vistas.add(m.transferenciaId); return true;
  }).slice(0,5);
  const ACCIONES = [["mov","➕","Añadir","var(--lav-soft)"],["transferencia","🔁","Transferir","var(--accent-soft)"],["Deudas","🤝","Deudas","var(--peach-soft)"],["Inversiones","🌱","Invertir","var(--mint-soft)"]];

  const {valores:valoresPat, etiquetas:etiquetasPat} = serieRango(patrimonioRango);
  const cambioPat = valoresPat.length>1 ? Math.round((valoresPat[valoresPat.length-1]-valoresPat[0])*100)/100 : 0;
  const RANGOS_PAT = [["max","Máx"],["1a","1 año"],["6m","6 meses"],["1m","1 mes"],["1d","1 día"]];

  return `
  <div class="hola">
    <h1>Hola${nombre ? ", "+esc(nombre) : ""} 👋</h1>
    <span style="display:flex;gap:10px">${botonOjo("btnOjoInicio")}<button class="campana" id="btnAvisos" aria-label="Notificaciones"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>${avisos ? `<span class="punto"></span>` : ""}</button></span>
  </div>
  <div class="saldo-lbl">Saldo total</div>
  <div class="saldo">
    <span class="cifra ${patNeto>=0?'':'neg'}">${eur(patNeto)}</span>
    <span class="var ${delta>=0?'pos':'neg'}">${delta>=0?"↗ +":"↘ -"}${Math.abs(pctPat).toFixed(1).replace(".",",")} % · ${delta>=0?"+":"-"}${eur(Math.abs(delta))} en ${lbl}</span>
  </div>
  <div class="mini">
    <div><b>${eur(disponible)}</b><span>Disponible</span></div>
    <div><b>${eur(totalInversiones)}</b><span>Inversiones</span></div>
    <div><b class="pos">${eur(meDeben)}</b><span>Me deben</span></div>
    <div><b class="neg">${eur(debo)}</b><span>Debo</span></div>
  </div>
  <div class="card grafico">
    <h2 style="margin-bottom:6px">Gasto de ${porMes ? MESES[mesSel-1].toLowerCase() : periodoAnio}</h2>
    <div class="meta" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
      <span style="width:9px;height:9px;border-radius:50%;background:var(--mint);display:inline-block"></span>
      Gastado: <strong style="color:var(--ink)">${eur(gastosReales)}</strong>${presupuestoTotal>0 ? ` / Presupuesto: <strong style="color:var(--ink)">${eur(presupuestoTotal)}</strong>` : ""}
    </div>
    ${tAnt ? comparar(gastosReales, tAnt.gastos, false) : ""}
    <div style="margin-top:10px">${graficoGastoMes(acumulado, etiquetasGasto, presupuestoTotal, porMes ? etiquetasGasto.map(d=>`${d} ${MESES[mesSel-1].slice(0,3).toLowerCase()}`) : MESES.map(m=>`Hasta ${m.toLowerCase()}`))}</div>
    <div class="meta" style="margin-top:4px">Ingresos: <strong class="pos">${eur(ingresos)}</strong> · Ahorro: <strong>${eur(ahorroMes)}</strong></div>
  </div>
  <h2 style="margin:22px 0 10px">Acciones rápidas</h2>
  <div class="acciones">
    ${ACCIONES.map(([dest, ico, txt, fondo])=>`<button class="accion" data-accion="${dest}"><i style="background:${fondo}">${ico}</i>${txt}</button>`).join("")}
  </div>
  <div class="tit-fila"><h2>Movimientos recientes</h2><button class="auth-link" data-ir-tab="Movimientos">Ver todos</button></div>
  ${recientes.length ? `<div class="list" style="margin-bottom:16px">
    ${recientes.map(m=>filaMov(m)).join("")}
  </div>` : `<div class="card">${vacio("hucha","Aún no hay movimientos","Toca «Añadir» para apuntar el primero.")}</div>`}
  ${bloqueAlertas}
  ${bloqueObjetivos}
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
  document.querySelectorAll("[data-accion]").forEach(b=>b.onclick=()=>{
    const d = b.dataset.accion;
    if(d==="mov" || d==="transferencia"){
      tab = "Movimientos"; formsEstado[d] = true;
      pendienteEnfoque = d==="mov" ? "movImporte" : "trOrigen";
    } else tab = d;
    const enfocar = !!pendienteEnfoque;
    render();
    if(!enfocar) window.scrollTo(0,0);
  });
  const ojo = document.getElementById("btnOjoInicio");
  if(ojo) ojo.onclick = alternarPrivacidad;
  const av = document.getElementById("btnAvisos");
  if(av) av.onclick = ()=>{ tab = "Notificaciones"; render(); window.scrollTo(0,0); };
  document.querySelectorAll("[data-ir-tab]").forEach(b=>b.onclick=()=>{ tab=b.dataset.irTab; render(); window.scrollTo(0,0); });
  document.querySelectorAll("[data-rango-pat]").forEach(b=>b.onclick=()=>{ patrimonioRango = b.dataset.rangoPat; render(); });
}
