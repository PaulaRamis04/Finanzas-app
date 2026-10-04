// Pestaña «Vivienda»: simulador de lo que hace falta ahorrar para comprar una casa (entrada + gastos).
// Solo muestra cifras; no recomienda ninguna opción.

// Hucha de vivienda (icono 🏠) de la que se toman el ahorro actual y el mensual si no se han escrito.
function huchaVivienda(){
  const casas = objetivos.filter(o=>temaObjetivo(o)==="casa").sort(porOrden);
  return casas.find(o=>!objetivoCompletado(o)) || casas[0] || null;
}

// Rellena lo que falte (ahorro actual y mensual) con los datos de la hucha de vivienda.
function prepararViv(){
  const o = huchaVivienda();
  if(viv.ahorro===null) viv.ahorro = o ? Math.round(progresoObjetivo(o)*100)/100 : 0;
  if(viv.mensual===null) viv.mensual = o && o.autoActivo && o.autoCuota ? o.autoCuota : 0;
}

// Cálculo puro: cuánto hace falta, cuánto falta y cuántos meses se tardaría al ritmo dado.
function calcularVivienda({precio, entrada, gastos, ahorro, mensual}){
  const pEntrada = Math.round(precio*entrada)/100, pGastos = Math.round(precio*gastos)/100;
  const necesario = sumarDinero(pEntrada, pGastos);
  const faltan = Math.max(restarDinero(necesario, ahorro), 0);
  const meses = faltan<=0 ? 0 : mensual>0 ? Math.ceil(faltan/mensual - 1e-9) : null;
  return {pEntrada, pGastos, necesario, faltan, meses, hipoteca: Math.max(restarDinero(precio, pEntrada), 0)};
}

function textoMesesViv(m){
  if(m===null) return "Sin ahorro mensual no se llega";
  if(m===0) return "Ya lo tienes";
  const a = Math.floor(m/12), r = m%12;
  const partes = [];
  if(a) partes.push(`${a} año${a===1?"":"s"}`);
  if(r) partes.push(`${r} mes${r===1?"":"es"}`);
  return partes.join(" y ");
}

function fechaDentroDeViv(m){
  if(!m) return "";
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()+m);
  return d.toLocaleDateString(localeApp(), {month:"long", year:"numeric"});
}

function htmlResultadoVivienda(){
  const base = {precio:viv.precio||0, entrada:viv.entrada||0, gastos:viv.gastos||0};
  const solo = calcularVivienda({...base, ahorro:viv.ahorro||0, mensual:viv.mensual||0});
  const bloque = `
  <div class="card">
    <h2>Resultado</h2>
    <div class="balance" style="margin-top:6px">
      <div><div class="num" id="vivNecesario">${eur(solo.necesario)}</div><div class="lbl">Necesitas aproximadamente</div></div>
      <div><div class="num" id="vivFaltan">${eur(solo.faltan)}</div><div class="lbl">Te faltan</div></div>
      <div><div class="num" id="vivTiempo" style="font-size:18px">${textoMesesViv(solo.meses)}</div><div class="lbl">Con tu ritmo actual${solo.meses? ` (hacia ${fechaDentroDeViv(solo.meses)})` : ""}</div></div>
    </div>
    <div class="list" style="margin-top:12px">
      <div class="item"><div>Entrada (${base.entrada} %)</div><div class="amt">${eur(solo.pEntrada)}</div></div>
      <div class="item"><div>Gastos de compra (${base.gastos} %)</div><div class="amt">${eur(solo.pGastos)}</div></div>
      <div class="item"><div>Resto del precio (lo que quedaría por financiar)</div><div class="amt">${eur(solo.hipoteca)}</div></div>
    </div>
  </div>`;
  if(!viv.conOtra) return bloque;
  const nombre = (viv.otraNombre||"").trim() || "otra persona";
  const juntos = calcularVivienda({...base, ahorro:sumarDinero(viv.ahorro||0, viv.otraAhorro||0), mensual:sumarDinero(viv.mensual||0, viv.otraMensual||0)});
  const fila = (lbl, a, b)=>`<div class="item"><div>${lbl}</div><div style="display:flex;gap:14px;justify-content:flex-end;text-align:right"><span class="viv-col">${a}</span><span class="viv-col">${b}</span></div></div>`;
  return bloque + `
  <div class="card" id="vivComparacion">
    <h2>Solo tú vs. tú + ${esc(nombre)}</h2>
    <div class="list" style="margin-top:4px">
      ${fila("", "<strong>Solo tú</strong>", `<strong>Tú + ${esc(nombre)}</strong>`)}
      ${fila("Ahorro actual", eur(viv.ahorro||0), eur(sumarDinero(viv.ahorro||0, viv.otraAhorro||0)))}
      ${fila("Ahorro mensual", eur(viv.mensual||0), eur(sumarDinero(viv.mensual||0, viv.otraMensual||0)))}
      ${fila("Necesitas", eur(solo.necesario), eur(juntos.necesario))}
      ${fila("Faltan", eur(solo.faltan), eur(juntos.faltan))}
      ${fila("Tiempo", textoMesesViv(solo.meses), textoMesesViv(juntos.meses))}
    </div>
  </div>`;
}

function renderVivienda(){
  prepararViv();
  const o = huchaVivienda();
  const campo = (id, lbl, v, extra="")=>`<div><label for="${id}">${lbl}</label><input type="number" step="0.01" min="0" inputmode="decimal" id="${id}" value="${v??""}"${extra}></div>`;
  return `
  <div class="card">
    <h2>Tus datos</h2>
    <p class="meta" style="margin:0 0 10px">Calcula cuánto necesitas ahorrar para la entrada y los gastos de compra, y cuánto tardarías a tu ritmo. Es una estimación: cambia los números para ver otras cifras.</p>
    <div class="row2">
      ${campo("vivPrecio", `Precio de la vivienda (${simboloMoneda()})`, viv.precio)}
      ${campo("vivEntrada", "Entrada (%)", viv.entrada, ' max="100"')}
    </div>
    <div class="row2">
      ${campo("vivGastos", "Gastos de compra (%)", viv.gastos, ' max="100"')}
      ${campo("vivAhorro", `Ahorro actual (${simboloMoneda()})`, viv.ahorro)}
    </div>
    <div class="row2">
      ${campo("vivMensual", `Ahorro mensual (${simboloMoneda()})`, viv.mensual)}
      <div></div>
    </div>
    <p class="meta" style="margin:8px 0 0">${o ? `El ahorro de partida sale de tu hucha «${esc(o.nombre)}»${o.autoActivo && o.autoCuota ? " y el mensual, de su aportación automática" : ""}. Puedes cambiarlos.` : "Si creas una hucha de vivienda (icono 🏠) en Objetivos, el ahorro se rellena solo."}
    Los gastos de compra (impuestos, notaría, registro…) suelen rondar el 10 % del precio.</p>
  </div>
  <div class="card">
    <label style="display:flex;align-items:center;gap:8px;margin:0"><input type="checkbox" id="vivConOtra"${viv.conOtra?" checked":""} style="width:auto">Comparar con otra persona ahorrando contigo</label>
    ${viv.conOtra? `
    <div class="row2" style="margin-top:10px">
      <div><label for="vivOtraNombre">Nombre</label><input id="vivOtraNombre" value="${esc(viv.otraNombre||"")}" placeholder="ej. Alex"></div>
      <div></div>
    </div>
    <div class="row2">
      ${campo("vivOtraAhorro", `Su ahorro actual (${simboloMoneda()})`, viv.otraAhorro)}
      ${campo("vivOtraMensual", `Su ahorro mensual (${simboloMoneda()})`, viv.otraMensual)}
    </div>` : ""}
  </div>
  <div id="vivResultado">${htmlResultadoVivienda()}</div>`;
}

// Se guarda en este dispositivo; el ahorro solo si no hay hucha de vivienda, porque con hucha se toma siempre de ella al abrir.
function guardarViv(){
  const copia = {...viv};
  if(huchaVivienda()){ delete copia.ahorro; delete copia.mensual; }
  try{ localStorage.setItem("simVivienda", JSON.stringify(copia)); }catch(e){}
}

function wireEventosVivienda(){
  const num = id=>{ const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? 0 : Math.max(v, 0); };
  const recalcular = ()=>{
    viv.precio = num("vivPrecio");
    viv.entrada = Math.min(num("vivEntrada"), 100);
    viv.gastos = Math.min(num("vivGastos"), 100);
    viv.ahorro = num("vivAhorro");
    viv.mensual = num("vivMensual");
    if(viv.conOtra){
      viv.otraNombre = document.getElementById("vivOtraNombre")?.value || "";
      viv.otraAhorro = num("vivOtraAhorro");
      viv.otraMensual = num("vivOtraMensual");
    }
    guardarViv();
    // Solo se repinta el resultado para no perder el cursor mientras se escribe.
    const r = document.getElementById("vivResultado");
    if(r) r.innerHTML = htmlResultadoVivienda();
  };
  ["vivPrecio","vivEntrada","vivGastos","vivAhorro","vivMensual","vivOtraNombre","vivOtraAhorro","vivOtraMensual"].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.oninput = recalcular;
  });
  const conOtra = document.getElementById("vivConOtra");
  if(conOtra) conOtra.onchange = ()=>{ viv.conOtra = conOtra.checked; guardarViv(); if(viv.conOtra) pendienteEnfoque = "vivOtraNombre"; render(); };
}
