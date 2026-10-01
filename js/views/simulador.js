// Pestaña «¿Qué pasaría si…?»: simulador que cambia ingresos, gastos o inversión
// y muestra cómo afecta a tu patrimonio a 1, 3, 5 y 10 años y a tus huchas. Para todos, no es premium.

const SIM_HORIZONTES = [1,3,5,10];
const SIM_TIPOS = {
  ahorro:  {texto:"Ahorro más al mes", get pide(){ return `${simboloMoneda()} más al mes`; }, frase:c=>`Ahorro ${eur(c.valor)} más al mes`},
  gasto:   {texto:"Gasto menos al mes", get pide(){ return `${simboloMoneda()} menos al mes`; }, frase:c=>`Gasto ${eur(c.valor)} menos al mes`},
  sueldo:  {texto:"Cobro al mes", get pide(){ return `${simboloMoneda()} al mes`; }, frase:c=>`Cobro ${eur(c.valor)} al mes`},
  invertir:{texto:"Invierto al mes", get pide(){ return `${simboloMoneda()} al mes`; }, frase:c=>`Invierto ${eur(c.valor)} al mes`},
  pausa:   {texto:"Dejo de invertir durante", pide:"meses", frase:c=>`Durante ${c.valor} ${c.valor===1?"mes":"meses"} no invierto`}
};
const SIM_EJEMPLOS = [
  {tipo:"ahorro", valor:100, get texto(){ return `Ahorro ${importeRedondo(100)} más`; }},
  {tipo:"sueldo", valor:1800, get texto(){ return `Cobro ${importeRedondo(1800)}/mes`; }},
  {tipo:"invertir", valor:300, get texto(){ return `Invierto ${importeRedondo(300)}/mes`; }},
  {tipo:"pausa", valor:12, texto:"Un año sin invertir"},
  {tipo:"gasto", valor:100, get texto(){ return `Gasto ${importeRedondo(100)} menos`; }}
];

// base: {ingresos, gastos, inversion, cuentas, invertido, tasa} (null = aún sin calcular desde tus datos)
let sim = {base:null, cambios:[], tipo:"ahorro"};

const redondear = n=>Math.round(n*100)/100;

// Media mensual de los 3 últimos meses completos (solo los que tienen movimientos).
function mediasUltimosMeses(){
  const hoy = new Date();
  const meses = [3,2,1].map(k=>fechaMes(new Date(hoy.getFullYear(), hoy.getMonth()-k, 1)));
  const hasta = fechaMes(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const lista = movimientosEfectivos(f=>!!f && f>=meses[0] && f<hasta);
  const conDatos = new Set(lista.map(m=>m.fecha.slice(0,7))).size;
  const n = Math.max(conDatos, 1);
  return {
    ingresos: redondear(sumaImportes(lista.filter(m=>m.tipo==="ingreso"))/n),
    gastos: redondear(sumaImportes(lista.filter(m=>m.tipo==="gasto" && m.categoria!=="Inversión"))/n),
    inversion: redondear(sumaImportes(lista.filter(m=>m.tipo==="gasto" && m.categoria==="Inversión"))/n),
    meses: conDatos
  };
}

function baseDesdeMisDatos(){
  const medias = mediasUltimosMeses();
  return {
    ingresos: medias.ingresos, gastos: medias.gastos, inversion: medias.inversion, meses: medias.meses,
    cuentas: redondear(sumaImportes(cuentas, saldoCuenta)),
    invertido: redondear(sumaImportes(inversiones.filter(i=>i.estado==="activa"), i=>i.valorActual)),
    tasa: proy.tasa
  };
}

// Aplica los cambios a la base: devuelve lo que entra, sale e inviertes cada mes (y los meses de pausa).
function aplicarCambios(base, cambios){
  const r = {ingresos:base.ingresos, gastos:base.gastos, inversion:base.inversion, ahorroExtra:0, pausa:0};
  cambios.forEach(c=>{
    if(c.tipo==="sueldo") r.ingresos = c.valor;
    else if(c.tipo==="invertir") r.inversion = c.valor;
    else if(c.tipo==="gasto") r.gastos = Math.max(r.gastos - c.valor, 0);
    else if(c.tipo==="ahorro") r.ahorroExtra += c.valor;
    else if(c.tipo==="pausa") r.pausa = c.valor;
  });
  return r;
}

// Simulación mes a mes: lo que no inviertes se queda en tus cuentas (sin intereses)
// y lo invertido crece a la rentabilidad anual. Devuelve el patrimonio al final de cada año.
function simularPatrimonio(base, cambios, anios){
  const p = aplicarCambios(base, cambios);
  const tasaMensual = Math.pow(1 + Math.max(base.tasa,0)/100, 1/12) - 1;
  let enCuentas = base.cuentas, invertido = base.invertido;
  const serie = [redondear(enCuentas + invertido)];
  for(let mes=1; mes<=anios*12; mes++){
    const aporte = mes<=p.pausa ? 0 : p.inversion;
    enCuentas += p.ingresos - p.gastos - aporte + p.ahorroExtra;
    invertido = invertido*(1+tasaMensual) + aporte;
    if(mes%12===0) serie.push(redondear(enCuentas + invertido));
  }
  return serie;
}

// Capacidad de ahorro al mes: lo que entra menos lo que gastas (vaya a cuentas o a inversión).
function ahorroMensual(base, cambios){
  const p = aplicarCambios(base, cambios);
  return redondear(p.ingresos - p.gastos + p.ahorroExtra);
}

// Meses para llenar cada hucha en curso si todo tu ahorro va a ellas, una detrás de otra (por su orden).
function mesesHuchas(ahorro){
  let acumulado = 0;
  return objetivos.filter(o=>!objetivoCompletado(o)).sort(porOrden).map(o=>{
    acumulado += Math.max(restarDinero(o.meta, progresoObjetivo(o)), 0);
    return {o, meses: ahorro>0 ? Math.ceil(acumulado/ahorro) : null};
  });
}

function textoMeses(m){
  if(m===null) return "no llegas";
  if(m===0) return "ya";
  if(m<12) return `${m} ${m===1?"mes":"meses"}`;
  const a = Math.floor(m/12), r = m%12;
  return `${a} ${a===1?"año":"años"}${r? ` y ${r} ${r===1?"mes":"meses"}` : ""}`;
}

function bloqueHuchasSimulador(base){
  const antes = mesesHuchas(ahorroMensual(base, []));
  const despues = mesesHuchas(ahorroMensual(base, sim.cambios));
  if(!antes.length) return "";
  return `
  <div class="card">
    <h2>Tus huchas</h2>
    <p class="meta" style="margin:0 0 6px">Cuánto tardarías en llenarlas si todo lo que ahorras al mes fuese a ellas, una detrás de otra.</p>
    <div class="list">
      ${antes.map(({o, meses},i)=>{
        const nuevo = despues[i].meses;
        const dif = meses!==null && nuevo!==null ? meses - nuevo : null;
        const nota = dif===null ? (nuevo===null ? "" : "¡Ahora sí llegas!") : dif>0 ? `${textoMeses(dif)} antes` : dif<0 ? `${textoMeses(-dif)} después` : "Igual";
        const color = dif===null ? (nuevo===null ? "var(--neg)" : "var(--pos)") : dif>0 ? "var(--pos)" : dif<0 ? "var(--neg)" : "var(--muted)";
        return `
        <div class="item" data-sim-hucha="${o.id}">
          <div><strong>${esc(o.nombre)}</strong><div class="meta">Ahora: ${textoMeses(meses)}</div></div>
          <div style="text-align:right"><strong>${textoMeses(nuevo)}</strong>${sim.cambios.length? `<div class="meta" style="color:${color};font-weight:700">${nota}</div>` : ""}</div>
        </div>`;
      }).join("")}
    </div>
  </div>`;
}

function bloqueResultadoSimulador(base){
  const anios = SIM_HORIZONTES[SIM_HORIZONTES.length-1];
  const sinCambios = simularPatrimonio(base, [], anios);
  const conCambios = simularPatrimonio(base, sim.cambios, anios);
  const hay = sim.cambios.length>0;
  return `
  <div class="card">
    <h2>Tu patrimonio dentro de…</h2>
    <div class="list" style="margin-top:4px">
      ${SIM_HORIZONTES.map(a=>{
        const dif = restarDinero(conCambios[a], sinCambios[a]);
        return `
        <div class="item" data-sim-anio="${a}">
          <div><strong>${a} año${a===1?"":"s"}</strong>${hay? `<div class="meta">Sin cambios: ${eur(sinCambios[a])}</div>` : ""}</div>
          <div style="text-align:right"><div class="amt">${eur(conCambios[a])}</div>${hay? `<div class="meta" style="color:${dif>=0?"var(--pos)":"var(--neg)"};font-weight:700">${dif>=0?"+":""}${eur(dif)}</div>` : ""}</div>
        </div>`;
      }).join("")}
    </div>
    ${hay? `
    <div style="margin-top:12px">${graficoLineasProyeccion([
      {nombre:"Sin cambios", color:"var(--muted)", data:sinCambios},
      {nombre:"Con cambios", color:"var(--accent)", data:conCambios}
    ], anios)}</div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px">
      <span class="meta" style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:50%;background:var(--muted)"></span>Sin cambios</span>
      <span class="meta" style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:50%;background:var(--accent)"></span>Con cambios</span>
    </div>` : `<p class="meta" style="margin:10px 0 0">Así seguiría tu patrimonio si todo sigue igual. Añade un cambio para compararlo.</p>`}
    <p class="meta" style="margin:10px 0 0">Es una estimación: lo que no inviertes se queda en tus cuentas sin intereses y lo invertido crece un ${base.tasa.toString().replace(".",",")} % al año.</p>
  </div>
  ${bloqueHuchasSimulador(base)}`;
}

function renderSimulador(){
  if(!sim.base){
    // Hacen falta los movimientos de los 3 últimos meses; si no están cargados se piden y se repinta.
    const hoy = new Date();
    if(asegurarMovimientosDesde(fechaMes(new Date(hoy.getFullYear(), hoy.getMonth()-3, 1)))) return `<div class="status">Cargando...</div>`;
    sim.base = baseDesdeMisDatos();
  }
  const b = sim.base;
  const campo = (id, etiqueta, valor, paso="0.01")=>`<div><label for="${id}">${etiqueta}</label><input type="number" step="${paso}" id="${id}" data-sim-base="${id.slice(3).toLowerCase()}" value="${valor}"></div>`;
  const tipo = SIM_TIPOS[sim.tipo];
  return `
  <div class="card">
    <h2>Prueba un cambio</h2>
    <p class="meta" style="margin:0 0 10px">Cambia una cosa y mira cómo afecta a tu dinero y a tus huchas a 1, 3, 5 y 10 años.</p>
    <div class="chips">${SIM_EJEMPLOS.map((e,i)=>`<button class="chip" data-sim-ejemplo="${i}">${e.texto}</button>`).join("")}</div>
    <div class="row2" style="margin-top:12px">
      <div><label for="simTipo">Cambio</label><select id="simTipo">${Object.entries(SIM_TIPOS).map(([k,t])=>`<option value="${k}"${k===sim.tipo?" selected":""}>${t.texto}</option>`).join("")}</select></div>
      <div><label for="simValor">${tipo.pide}</label><input type="number" step="${sim.tipo==="pausa"?"1":"0.01"}" min="0" id="simValor" placeholder="${sim.tipo==="pausa"?"12":"100"}"></div>
    </div>
    <button class="btn" id="simAnadir" style="margin-top:10px">Añadir cambio</button>
    ${sim.cambios.length? `
    <div class="list" style="margin-top:12px">
      ${sim.cambios.map(c=>`
      <div class="item">
        <div>${esc(SIM_TIPOS[c.tipo].frase(c))}</div>
        <button class="btn ghost" data-sim-quitar="${c.tipo}" aria-label="Quitar este cambio">Quitar</button>
      </div>`).join("")}
    </div>
    <button class="btn ghost" id="simLimpiar" style="margin-top:8px">Quitar todos</button>` : ""}
  </div>
  ${bloqueResultadoSimulador(b)}
  <div class="card">
    <h2>Tu punto de partida</h2>
    <p class="meta" style="margin:0 0 10px">${b.meses? `Media de tus ${b.meses===1?"último mes":`últimos ${b.meses} meses`} completos.` : "Aún no hay movimientos de meses completos: pon tus cifras a mano."} Puedes ajustarlo.</p>
    <div class="row2">${campo("simIngresos",`Ingresos al mes (${simboloMoneda()})`,b.ingresos)}${campo("simGastos",`Gastos al mes (${simboloMoneda()})`,b.gastos)}</div>
    <div class="row2">${campo("simInversion",`Inviertes al mes (${simboloMoneda()})`,b.inversion)}${campo("simTasa","Rentabilidad anual (%)",b.tasa,"0.1")}</div>
    <div class="row2">${campo("simCuentas",`En tus cuentas hoy (${simboloMoneda()})`,b.cuentas)}${campo("simInvertido",`Invertido hoy (${simboloMoneda()})`,b.invertido)}</div>
    <button class="btn ghost" id="simRecalcular" style="margin-top:10px">Volver a mis datos</button>
  </div>`;
}

function anadirCambioSimulador(tipo, valor){
  sim.cambios = sim.cambios.filter(c=>c.tipo!==tipo);
  sim.cambios.push({tipo, valor});
  sim.tipo = tipo;
}

function wireEventosSimulador(){
  const anadir = document.getElementById("simAnadir");
  if(!anadir) return;
  document.getElementById("simTipo").onchange = e=>{ sim.tipo = e.target.value; render(); };
  anadir.onclick = ()=>{
    let valor = parseFloat(document.getElementById("simValor").value);
    if(sim.tipo==="pausa") valor = Math.round(valor);
    if(isNaN(valor) || valor<=0 || (sim.tipo==="pausa" && valor>120)){
      showError(sim.tipo==="pausa" ? "Pon cuántos meses, entre 1 y 120." : "Pon un importe mayor que 0.");
      return;
    }
    hideError();
    anadirCambioSimulador(sim.tipo, valor);
    render();
  };
  document.querySelectorAll("[data-sim-ejemplo]").forEach(b=>b.onclick=()=>{
    const e = SIM_EJEMPLOS[Number(b.dataset.simEjemplo)];
    anadirCambioSimulador(e.tipo, e.valor);
    render();
  });
  document.querySelectorAll("[data-sim-quitar]").forEach(b=>b.onclick=()=>{ sim.cambios = sim.cambios.filter(c=>c.tipo!==b.dataset.simQuitar); render(); });
  const limpiar = document.getElementById("simLimpiar");
  if(limpiar) limpiar.onclick = ()=>{ sim.cambios = []; render(); };
  document.querySelectorAll("[data-sim-base]").forEach(inp=>inp.onchange=()=>{
    const v = parseFloat(inp.value);
    if(isNaN(v)){ showError("Pon un número válido."); return; }
    hideError();
    sim.base[inp.dataset.simBase] = v;
    render();
  });
  document.getElementById("simRecalcular").onclick = ()=>{ sim.base = null; render(); };
}
