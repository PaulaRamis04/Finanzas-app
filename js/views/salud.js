// Pestaña «¿Cómo estoy?» (clave "Salud"): semáforo con cinco indicadores y una nota de 0 a 100.
// No es una nota absoluta: cada indicador se mide contra objetivos que la persona puede cambiar.
// Los objetivos se guardan en la tabla «salud_config» (schema_salud.sql); sin ella, en este dispositivo.

const SALUD_DEFECTO = {ahorro:20, inversion:10, deudaMeses:1, fondoMeses:6, margenGastos:5,
  pesos:{ahorro:1, deuda:1, fondo:1, inversion:1, gastos:1}};
let saludConfig = null, saludEnBd = false, cargandoHistSalud = false, saludAjustesAbiertos = false;

function leerSaludLocal(){ try{ const c = JSON.parse(localStorage.getItem("saludConfig")||"null"); return c && typeof c==="object" ? c : null; }catch(e){ return null; } }
function fijarSaludConfig(d){
  saludEnBd = !!d.ok;
  saludConfig = (saludEnBd ? d.config : null) || leerSaludLocal() || {};
}
// Objetivos efectivos: lo guardado encima de los valores por defecto.
function objetivosSalud(){
  const c = saludConfig || {};
  return {...SALUD_DEFECTO, ...c, pesos:{...SALUD_DEFECTO.pesos, ...(c.pesos||{})}};
}

const mesClave = (y, m)=>`${y}-${String(m).padStart(2,"0")}`;
function mesesAntes(n){ const d = new Date(); return Array.from({length:n}, (_,i)=>{ const x = new Date(d.getFullYear(), d.getMonth()-n+i, 1); return mesClave(x.getFullYear(), x.getMonth()+1); }); }
const pctTxt = n=>`${Math.round(n)} %`;
const mesesTxt = n=>`${String(Math.round(n*10)/10).replace(".",",")} ${Math.round(n*10)/10===1?"mes":"meses"}`;

// Ingresos, gastos (sin «Inversión») e inversión de cada mes cerrado reciente, más lo gastado este mes hasta hoy.
function datosSalud(){
  const hoy = today(), actual = hoy.slice(0,7), dia = Number(hoy.slice(8,10));
  const seis = mesesAntes(6);
  const cargadoDesde = movParcial ? movDesde.slice(0,7) : "";
  const primerDato = [...movimientos.map(m=>m.fecha), ...movResumen.map(r=>r.mes)].filter(Boolean).sort()[0]?.slice(0,7) || actual;
  const validos = seis.filter(k=>k>=cargadoDesde && k>=primerDato);
  const porMes = Object.fromEntries(validos.map(k=>[k, {ingresos:0, gastos:0, invertido:0, hastaDia:0}]));
  let gastoActual = 0;
  movimientosEfectivos(()=>true).forEach(m=>{
    const k = m.fecha.slice(0,7), r = porMes[k];
    if(k===actual){ if(m.tipo==="gasto" && m.categoria!=="Inversión" && m.fecha<=hoy) gastoActual = sumarDinero(gastoActual, m.importe); return; }
    if(!r) return;
    if(m.tipo==="ingreso") r.ingresos = sumarDinero(r.ingresos, m.importe);
    else if(m.categoria==="Inversión") r.invertido = sumarDinero(r.invertido, m.importe);
    else {
      r.gastos = sumarDinero(r.gastos, m.importe);
      if(Number(m.fecha.slice(8,10))<=dia) r.hastaDia = sumarDinero(r.hastaDia, m.importe);
    }
  });
  // Aportaciones que no crearon movimiento (p. ej. importadas) también cuentan como inversión.
  aportaciones.filter(a=>!a.movimientoId && a.fecha && porMes[a.fecha.slice(0,7)]).forEach(a=>{
    const r = porMes[a.fecha.slice(0,7)]; r.invertido = sumarDinero(r.invertido, a.importe);
  });
  const tres = validos.slice(-3);
  const suma = (ks, campo)=>sumaImportes(ks, k=>porMes[k][campo]);
  const ingresos3 = suma(tres, "ingresos");
  return {
    nMeses3: tres.length, nMeses6: validos.length,
    ingresos3, gastos3: suma(tres, "gastos"), invertido3: suma(tres, "invertido"),
    ingresoMedio: tres.length ? ingresos3/tres.length : 0,
    gastoMedio: validos.length ? suma(validos, "gastos")/validos.length : 0,
    gastoHastaDiaMedio: validos.length ? suma(validos, "hastaDia")/validos.length : 0,
    gastoActual, dia
  };
}

// Cada indicador devuelve {p (0..1+, null = sin datos), estado, detalle}. Verde con p≥1, ámbar con p≥0,5, rojo por debajo.
const INDICADORES_SALUD = [
  {id:"ahorro", icono:"💰", nombre:"Ahorro", tab:"Resumen del mes", calc:(d, o)=>{
    if(d.ingresos3<=0) return {p:null, detalle:"Necesito al menos un mes cerrado con ingresos para calcularlo."};
    const tasa = (d.ingresos3-d.gastos3)/d.ingresos3*100;
    return {p: o.ahorro>0 ? tasa/o.ahorro : (tasa>=0 ? 1 : 0), estados:["saludable","mejorable","bajo"],
      detalle:`Ahorras el ${pctTxt(tasa)} de lo que ingresas (tu objetivo: ${pctTxt(o.ahorro)}). ${d.nMeses3===1?"Último mes":`Últimos ${d.nMeses3} meses`}.`};
  }},
  {id:"deuda", icono:"🤝", nombre:"Deuda", tab:"Deudas", calc:(d, o)=>{
    const debo = sumaImportes(deudas.filter(x=>x.direccion==="debo" && x.estado==="pendiente"));
    if(debo<=0) return {p:1, estados:["sin deudas"], detalle:"No tienes deudas pendientes."};
    if(d.ingresoMedio<=0) return {p:null, detalle:`Debes ${eur(debo)}, pero aún no tengo ingresos con los que compararlo.`};
    const meses = debo/d.ingresoMedio;
    return {p: meses<=o.deudaMeses ? 1 : Math.max(0, 2-meses/Math.max(o.deudaMeses, 0.01)), estados:["baja","moderada","alta"],
      detalle:`Debes ${eur(debo)}, ${mesesTxt(meses)} de ingresos (tu límite: ${mesesTxt(o.deudaMeses)}).`};
  }},
  {id:"fondo", icono:"☂️", nombre:"Fondo de emergencia", tab:"Objetivos", calc:(d, o)=>{
    const huchas = objetivos.filter(x=>temaObjetivo(x)==="emergencia" && x.meta>0);
    if(huchas.length){
      const tengo = sumaImportes(huchas, x=>Math.max(0, progresoObjetivo(x))), meta = sumaImportes(huchas, x=>x.meta);
      return {p: tengo/meta, estados:["completo","en progreso","por construir"],
        detalle:`Tu hucha ☂️ lleva ${eur(tengo)} de ${eur(meta)} (${pctTxt(Math.min(tengo/meta*100, 999))}).`};
    }
    if(d.gastoMedio<=0) return {p:null, detalle:"Crea una hucha ☂️ de emergencias, o apunta tus gastos para saber cuánto necesitas."};
    const tengo = Math.max(0, sumaImportes(cuentasActivas(), saldoCuenta)), meses = tengo/d.gastoMedio;
    return {p: o.fondoMeses>0 ? meses/o.fondoMeses : 1, estados:["completo","en progreso","por construir"],
      detalle:`Tus cuentas cubren ${mesesTxt(meses)} de gastos (tu objetivo: ${mesesTxt(o.fondoMeses)}). Crea una hucha ☂️ para seguirlo aparte.`};
  }},
  {id:"inversion", icono:"📈", nombre:"Inversión", tab:"Inversiones", calc:(d, o)=>{
    if(d.ingresos3<=0) return {p:null, detalle:"Necesito al menos un mes cerrado con ingresos para calcularlo."};
    const tasa = d.invertido3/d.ingresos3*100;
    return {p: o.inversion>0 ? tasa/o.inversion : 1, estados:["dentro del objetivo","por debajo del objetivo","muy por debajo del objetivo"],
      detalle:`Inviertes el ${pctTxt(tasa)} de lo que ingresas (tu objetivo: ${pctTxt(o.inversion)}). ${d.nMeses3===1?"Último mes":`Últimos ${d.nMeses3} meses`}.`};
  }},
  {id:"gastos", icono:"💸", nombre:"Gastos", tab:"Gastos", calc:(d, o)=>{
    if(d.gastoHastaDiaMedio<=0) return {p:null, detalle:"Necesito al menos un mes cerrado con gastos para compararlo."};
    const ratio = d.gastoActual/d.gastoHastaDiaMedio, margen = Math.max(o.margenGastos, 0.5)/100;
    const p = ratio<=1+margen ? 1 : Math.max(0, 1-(ratio-1-margen)/(6*margen));
    const dif = Math.round(Math.abs(ratio-1)*100);
    return {p, estados:[ratio<1-margen ? "por debajo de tu media" : "en tu media", "ligeramente por encima de tu media", "muy por encima de tu media"],
      detalle:`Llevas ${eur(d.gastoActual)} este mes; hasta el día ${d.dia} sueles llevar ${eur(redondearDinero(d.gastoHastaDiaMedio))} (${ratio>=1?"+":"-"}${dif} %).`};
  }}
];

// Evalúa todos los indicadores y la nota ponderada (null si ninguno tiene datos).
function evaluarSalud(){
  const o = objetivosSalud(), d = datosSalud();
  const lista = INDICADORES_SALUD.map(ind=>{
    const r = ind.calc(d, o), peso = Number(o.pesos[ind.id])||0;
    if(r.p===null) return {...ind, ...r, color:"gris", estado:"sin datos", puntos:null, peso};
    const color = r.p>=1 ? "verde" : r.p>=0.5 ? "ambar" : "rojo";
    const estados = r.estados;
    const estado = estados[color==="verde" ? 0 : color==="ambar" ? 1 : 2] || estados[estados.length-1];
    return {...ind, ...r, color, estado, puntos:Math.round(Math.max(0, Math.min(r.p, 1))*100), peso};
  });
  const cuentan = lista.filter(i=>i.puntos!==null && i.peso>0);
  const pesoTotal = cuentan.reduce((s,i)=>s+i.peso, 0);
  const nota = pesoTotal ? Math.round(cuentan.reduce((s,i)=>s+i.puntos*i.peso, 0)/pesoTotal) : null;
  return {lista, nota};
}

const SEMAFORO = {verde:"🟢", ambar:"🟡", rojo:"🔴", gris:"⚪"};
const colorNota = n=>n>=75 ? "var(--pos)" : n>=50 ? "#e0ac4e" : "var(--neg)";

function anilloNota(nota){
  const r = 52, circ = 2*Math.PI*r, pct = nota===null ? 0 : nota/100;
  return `<svg class="salud-anillo" viewBox="0 0 120 120" role="img" aria-label="Salud financiera: ${nota===null ? "sin datos" : nota+" de 100"}">
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--line)" stroke-width="12"/>
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="${nota===null ? "var(--line)" : colorNota(nota)}" stroke-width="12" stroke-linecap="round"
      stroke-dasharray="${(circ*pct).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 60 60)"/>
    <text x="60" y="60" text-anchor="middle" dominant-baseline="central" font-size="34" font-weight="800" fill="var(--ink)">${nota===null ? "–" : nota}</text>
    <text x="60" y="86" text-anchor="middle" font-size="12" fill="var(--muted)">/100</text>
  </svg>`;
}

function renderSalud(){
  // Hacen falta los 6 últimos meses cerrados; si la carga parcial no llega, se piden (recargar vuelve a pintar).
  const desde = mesesAntes(6)[0]+"-01";
  if(movParcial && movDesde>desde && !cargandoHistSalud){
    cargandoHistSalud = true;
    setTimeout(()=>{ asegurarMovimientosDesde(desde); cargandoHistSalud = false; }, 0);
  }
  const {lista, nota} = evaluarSalud();
  const o = objetivosSalud();
  const campo = (id, etiqueta, valor, unidad, paso = 1)=>`
    <label class="salud-campo"><span>${etiqueta}</span><span class="salud-num"><input type="number" id="salud_${id}" min="0" step="${paso}" value="${valor}" inputmode="decimal"><i>${unidad}</i></span></label>`;
  const pesoSel = ind=>`
    <label class="salud-campo"><span>${ind.icono} ${ind.nombre}</span><select id="saludPeso_${ind.id}">
      ${[[0,"No cuenta"],[1,"Normal"],[2,"Doble"]].map(([v,t])=>`<option value="${v}"${Number(o.pesos[ind.id])===v?" selected":""}>${t}</option>`).join("")}
    </select></label>`;
  return `
  <div class="card salud-cab">
    <div class="meta" style="letter-spacing:.08em;font-weight:800">¿CÓMO ESTOY?</div>
    <div class="salud-lista">
      ${lista.map(i=>`
      <button class="salud-fila ${i.color}" data-salud="${i.id}" aria-expanded="false">
        <span class="salud-luz" aria-hidden="true">${SEMAFORO[i.color]}</span>
        <span class="salud-txt"><b>${i.nombre}:</b> ${esc(i.estado)}${i.peso>0 ? "" : ` <span class="meta">(no cuenta)</span>`}</span>
        <span class="salud-pts">${i.puntos===null ? "" : i.puntos}</span>
      </button>
      <div class="salud-detalle" id="saludDet_${i.id}" hidden>
        <p class="meta">${i.detalle}</p>
        <button class="auth-link" data-ir-tab="${i.tab}">Ir a ${esc(TITULOS_TAB[i.tab]||i.tab)}</button>
      </div>`).join("")}
    </div>
    <div class="salud-nota">
      ${anilloNota(nota)}
      <div><strong>Salud financiera: ${nota===null ? "sin datos" : `${nota}/100`}</strong>
      <p class="meta">No es una valoración absoluta: mide cómo vas frente a tus propios objetivos. Cámbialos abajo cuando quieras.</p></div>
    </div>
  </div>
  <div class="card">
    <button class="salud-ajustes-cab" id="saludAjustes" aria-expanded="${saludAjustesAbiertos}"><h2>🎯 Mis objetivos</h2><span>${saludAjustesAbiertos ? "▲" : "▼"}</span></button>
    ${saludAjustesAbiertos ? `
    <div class="salud-form">
      ${campo("ahorro", "Ahorrar al menos", o.ahorro, "% de ingresos")}
      ${campo("inversion", "Invertir al menos", o.inversion, "% de ingresos")}
      ${campo("deudaMeses", "Deuda máxima", o.deudaMeses, "meses de ingresos", 0.5)}
      ${campo("fondoMeses", "Fondo de emergencia (si no hay hucha ☂️)", o.fondoMeses, "meses de gastos", 0.5)}
      ${campo("margenGastos", "Margen sobre tu gasto medio", o.margenGastos, "%")}
      <div class="meta" style="margin:14px 0 6px;font-weight:700">Cuánto pesa cada uno en la nota</div>
      ${INDICADORES_SALUD.map(pesoSel).join("")}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
        <button class="btn" id="saludGuardar">Guardar objetivos</button>
        <button class="btn ghost" id="saludDefecto">Volver a los de serie</button>
      </div>
      <p class="meta" style="margin-top:8px">${saludEnBd ? "Se guardan en tu cuenta." : "Se guardan en este dispositivo."}</p>
    </div>` : ""}
  </div>`;
}

async function guardarSaludConfig(config){
  saludConfig = config;
  if(saludEnBd){
    const {error} = await sb.from("salud_config").upsert({config, actualizado:new Date().toISOString()}, {onConflict:"user_id"});
    if(error){ showError("No se pudieron guardar tus objetivos: "+error.message); return; }
  } else {
    try{ localStorage.setItem("saludConfig", JSON.stringify(config)); }catch(e){}
  }
  hideError(); render();
}

function wireEventosSalud(){
  document.querySelectorAll("[data-salud]").forEach(b=>b.onclick=()=>{
    const det = document.getElementById("saludDet_"+b.dataset.salud);
    det.hidden = !det.hidden;
    b.setAttribute("aria-expanded", String(!det.hidden));
  });
  const cab = document.getElementById("saludAjustes");
  if(cab) cab.onclick = ()=>{ saludAjustesAbiertos = !saludAjustesAbiertos; render(); };
  const guardar = document.getElementById("saludGuardar");
  if(guardar) guardar.onclick = ()=>conCarga(guardar, "Guardando…", async ()=>{
    const num = (id, def)=>{ const v = parseFloat(document.getElementById("salud_"+id).value); return Number.isFinite(v) && v>=0 ? v : def; };
    const pesos = Object.fromEntries(INDICADORES_SALUD.map(i=>[i.id, Number(document.getElementById("saludPeso_"+i.id).value)]));
    await guardarSaludConfig({ahorro:num("ahorro", SALUD_DEFECTO.ahorro), inversion:num("inversion", SALUD_DEFECTO.inversion),
      deudaMeses:num("deudaMeses", SALUD_DEFECTO.deudaMeses), fondoMeses:num("fondoMeses", SALUD_DEFECTO.fondoMeses),
      margenGastos:num("margenGastos", SALUD_DEFECTO.margenGastos), pesos});
  });
  const defecto = document.getElementById("saludDefecto");
  if(defecto) defecto.onclick = ()=>conCarga(defecto, "Guardando…", ()=>guardarSaludConfig({}));
}
