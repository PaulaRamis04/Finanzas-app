// Pestaña «¿Me lo puedo permitir?»: escribes una compra y ves cómo quedarían tu patrimonio,
// tu fondo de emergencia, tus huchas y el presupuesto de esa categoría. No aconseja: solo enseña el coste.

let permitir = {concepto:"", importe:"", categoria:null, cuentaId:null};

// Media mensual de los últimos meses completos (hasta 3) que estén cargados: ingresos, gastos y lo que sobra.
function mediasMensuales(){
  const hoy = new Date();
  const primerMov = movimientos.reduce((a,m)=> !a || m.fecha<a ? m.fecha : a, null);
  if(!primerMov) return null;
  const meses = [];
  for(let i=1; i<=3; i++){
    const d = new Date(hoy.getFullYear(), hoy.getMonth()-i, 1), s = new Date(hoy.getFullYear(), hoy.getMonth()-i+1, 1);
    const desde = fechaLocal(d), hasta = fechaLocal(s);
    if((movParcial && desde<movDesde) || hasta<=primerMov.slice(0,7)+"-01") break;
    meses.push(totalesEfectivos(movimientosEfectivos(f=>!!f && f>=desde && f<hasta)));
  }
  if(!meses.length) return null;
  const n = meses.length;
  const ingresos = redondearDinero(sumaImportes(meses, t=>t.ingresos)/n);
  const gastos = redondearDinero(sumaImportes(meses, t=>t.gastos)/n);
  return {meses:n, ingresos, gastos, ahorro:restarDinero(ingresos, gastos)};
}

// Lo que queda del presupuesto de una categoría en el mes en curso (con remanente si lo tiene).
function presupuestoMesActual(categoria){
  const p = presupuestos.find(x=>x.categoria===categoria);
  if(!p) return null;
  const hoy = new Date(), y = hoy.getFullYear(), m = hoy.getMonth()+1;
  let limite = p.limite;
  if(p.rollover && p.rolloverDesde){
    mesesEntre(p.rolloverDesde, `${y}-${String(m).padStart(2,"0")}-01`).forEach(ym=>{
      const [yy,mm] = ym.split("-").map(Number);
      limite = sumarDinero(limite, restarDinero(p.limite, gastoCategoriaEnMes(p.categoria, yy, mm)));
    });
  }
  const gastado = gastoCategoriaEnMes(categoria, y, m);
  return {limite, gastado, queda:restarDinero(limite, gastado)};
}

function textoMesesPermitir(n){
  if(n<1){ const dias = Math.max(1, Math.round(n*30)); return `${dias} día${dias===1?"":"s"}`; }
  const r = Math.round(n*10)/10;
  return `${String(r).replace(".",",")} ${r===1?"mes":"meses"}`;
}

// Todos los números del «después», sin HTML (así también se pueden probar).
function calcularPermitir(importe, categoria, cuentaId){
  const medias = mediasMensuales();
  const patrimonio = patrimonioNetoActual();

  // Fondo de emergencia: las huchas con el icono ☂️. Solo baja si la compra sale de la cuenta a la que está atada.
  const huchasEmergencia = objetivos.filter(o=>temaObjetivo(o)==="emergencia");
  let fondo = null;
  if(huchasEmergencia.length){
    const antes = sumaImportes(huchasEmergencia, o=>Math.max(progresoObjetivo(o),0));
    const atada = huchasEmergencia.find(o=>o.tipoVinculo==="cuenta" && o.vinculoId===cuentaId);
    const baja = atada ? Math.min(importe, Math.max(progresoObjetivo(atada),0)) : 0;
    const despues = restarDinero(antes, baja);
    const cubre = v=> medias && medias.gastos>0 ? v/medias.gastos : null;
    fondo = {antes, despues, toca:!!atada, cuenta:atada ? cuentaNombre(cuentaId) : "", mesesAntes:cubre(antes), mesesDespues:cubre(despues)};
  }

  // Huchas en curso: cuánto tardarías en reponer ese dinero al ritmo al que ahorras.
  const enCurso = objetivos.filter(o=>!objetivoCompletado(o) && temaObjetivo(o)!=="emergencia").sort(porOrden);
  const ritmo = medias && medias.ahorro>0 ? medias.ahorro : null;
  const huchas = enCurso.map(o=>{
    const cuota = o.autoActivo && o.autoCuota>0 ? o.autoCuota : null;
    return {nombre:o.nombre, icono:emojiObjetivo(o), cuota, meses: cuota ? importe/cuota : (ritmo ? importe/ritmo : null)};
  });

  const pres = categoria ? presupuestoMesActual(categoria) : null;
  return {
    importe, categoria, medias,
    patrimonio:{antes:patrimonio, despues:restarDinero(patrimonio, importe)},
    fondo,
    objetivos:{hay:objetivos.length>0, retraso: ritmo ? importe/ritmo : null, ritmo, huchas},
    presupuesto: pres ? {...pres, despues:restarDinero(pres.queda, importe)} : null,
  };
}

function categoriaPorDefectoPermitir(){
  const gasto = categorias.filter(c=>c.tipo==="gasto").map(c=>c.nombre);
  return gasto.find(c=>/ocio/i.test(c)) || gasto.find(c=>presupuestos.some(p=>p.categoria===c)) || gasto[0] || "";
}

function filaPermitir(icono, titulo, antes, despues, pie, color = ""){
  return `
  <div class="permitir-fila">
    <div class="ico-cat">${icono}</div>
    <div style="flex:1;min-width:0">
      <div class="permitir-tit">${titulo}</div>
      <div class="permitir-cifras">${antes!=null ? `<span class="meta">${antes}</span><span class="meta">→</span>` : ""}<strong${color?` style="color:${color}"`:""}>${despues}</strong></div>
      ${pie ? `<div class="meta">${pie}</div>` : ""}
    </div>
  </div>`;
}

function resultadoPermitir(){
  const importe = parseFloat(permitir.importe);
  if(isNaN(importe) || importe<=0) return `<div class="card">${vacio("hucha","Escribe un importe","Verás cómo quedaría todo después de comprarlo.")}</div>`;
  const r = calcularPermitir(importe, permitir.categoria, permitir.cuentaId);
  const que = permitir.concepto.trim() ? esc(permitir.concepto.trim()) : "comprarlo";
  const filas = [];

  filas.push(filaPermitir("💰", "Patrimonio", eur(r.patrimonio.antes), eur(r.patrimonio.despues),
    r.patrimonio.antes>0 ? `${String(Math.round(importe/r.patrimonio.antes*1000)/10).replace(".",",")} % de todo lo que tienes` : "",
    r.patrimonio.despues<0 ? "var(--neg)" : ""));

  if(r.fondo){
    const cubre = v=> v!=null ? ` · cubre ${textoMesesPermitir(v)} de gastos` : "";
    const pie = r.fondo.toca
      ? `Sale de ${r.fondo.cuenta}, donde está tu fondo${cubre(r.fondo.mesesDespues)}`
      : `No lo toca: pagas desde otra cuenta${cubre(r.fondo.mesesDespues)}`;
    filas.push(filaPermitir("☂️", "Fondo de emergencia", r.fondo.toca ? eur(r.fondo.antes) : null, eur(r.fondo.despues), pie));
  } else {
    filas.push(filaPermitir("☂️", "Fondo de emergencia", null, "Sin fondo", `Crea una hucha con el icono ☂️ en <button class="auth-link" data-ir-tab="Objetivos">Objetivos</button> y lo tendré en cuenta.`));
  }

  if(!r.objetivos.hay){
    filas.push(filaPermitir("🐷", "Objetivos", null, "Sin huchas", "Cuando tengas una hucha te diré cuánto la retrasa."));
  } else {
    const conCuota = r.objetivos.huchas.filter(h=>h.cuota);
    const titulo = r.objetivos.retraso!=null ? `${textoMesesPermitir(r.objetivos.retraso)} de retraso`
      : conCuota.length ? "Retraso por hucha" : "No lo puedo calcular";
    const pie = r.objetivos.retraso!=null ? `Es lo que tardas en ahorrar ${eur(importe)} (ahorras ${eur(r.objetivos.ritmo)} al mes de media)`
      : r.medias ? "Estos últimos meses no te ha sobrado dinero para ahorrar" : "Aún no hay meses completos para saber cuánto ahorras";
    const detalle = r.objetivos.huchas.filter(h=>h.meses!=null).slice(0,4).map(h=>
      `<div class="permitir-hucha"><span>${h.icono} ${esc(h.nombre)}</span><b>+${textoMesesPermitir(h.meses)}</b>${h.cuota ? `<span class="meta">a ${eur(h.cuota)}/mes</span>` : ""}</div>`).join("");
    filas.push(filaPermitir("🐷", "Objetivos", null, titulo, pie) + (detalle ? `<div class="permitir-huchas">${detalle}</div>` : ""));
  }

  if(r.presupuesto){
    const p = r.presupuesto;
    filas.push(filaPermitir(emojiCategoria(r.categoria, "gasto"), `Presupuesto ${esc(r.categoria.toLowerCase())} · ${MESES[new Date().getMonth()].toLowerCase()}`,
      eur(p.queda), eur(p.despues),
      p.despues<0 ? `Te pasarías del límite de ${eur(p.limite)} en ${eur(Math.abs(p.despues))}` : `Te quedarían ${eur(p.despues)} de ${eur(p.limite)}`,
      p.despues<0 ? "var(--neg)" : ""));
  } else if(r.categoria){
    filas.push(filaPermitir(emojiCategoria(r.categoria, "gasto"), `Presupuesto ${esc(r.categoria.toLowerCase())}`, null, "Sin presupuesto",
      `Ponle un límite en <button class="auth-link" data-ir-tab="Presupuestos">Presupuestos</button> para verlo aquí.`));
  }

  return `
  <div class="card">
    <h2>Después de ${que}</h2>
    <div class="permitir-lista">${filas.join("")}</div>
    <p class="meta" style="margin:12px 0 0">No te digo si comprarlo o no: solo lo que cuesta. Las medias salen de tus ${r.medias ? r.medias.meses : 0} último${r.medias?.meses===1?"":"s"} mes${r.medias?.meses===1?"":"es"} completo${r.medias?.meses===1?"":"s"}.</p>
  </div>`;
}

function renderPermitir(){
  if(permitir.categoria===null || !categorias.some(c=>c.tipo==="gasto" && c.nombre===permitir.categoria)) permitir.categoria = categoriaPorDefectoPermitir();
  if(!permitir.cuentaId || !cuentas.some(c=>c.id===permitir.cuentaId)) permitir.cuentaId = cuentaPorDefecto() || cuentasActivas()[0]?.id || "";
  const catsGasto = categorias.filter(c=>c.tipo==="gasto");
  return `
  <div class="card">
    <p class="meta" style="margin:0 0 10px">Escribe lo que te quieres comprar y mira cómo quedaría todo después.</p>
    <div class="row2">
      <div><label for="permConcepto">¿Qué es?</label><input id="permConcepto" placeholder="ej. 📱 Móvil nuevo" value="${esc(permitir.concepto)}"></div>
      <div><label for="permImporte">Precio (${simboloMoneda()})</label><input id="permImporte" type="number" step="0.01" min="0" inputmode="decimal" placeholder="650" value="${esc(permitir.importe)}"></div>
    </div>
    <div class="row2">
      <div><label for="permCategoria">Categoría</label><select id="permCategoria">${catsGasto.map(c=>`<option value="${esc(c.nombre)}"${c.nombre===permitir.categoria?" selected":""}>${esc(c.nombre)}</option>`).join("")}</select></div>
      <div><label for="permCuenta">Lo pagaría con</label><select id="permCuenta">${opcionesCuentas(permitir.cuentaId)}</select></div>
    </div>
  </div>
  <div id="permResultado">${resultadoPermitir()}</div>`;
}

function wireEventosPermitir(){
  const imp = document.getElementById("permImporte");
  if(!imp) return;
  const pintar = ()=>{
    document.getElementById("permResultado").innerHTML = resultadoPermitir();
    document.querySelectorAll("#permResultado [data-ir-tab]").forEach(b=>b.onclick=()=>{ tab=b.dataset.irTab; render(); window.scrollTo(0,0); });
  };
  imp.oninput = ()=>{ permitir.importe = imp.value; pintar(); };
  document.getElementById("permConcepto").oninput = e=>{ permitir.concepto = e.target.value; pintar(); };
  document.getElementById("permCategoria").onchange = e=>{ permitir.categoria = e.target.value; pintar(); };
  document.getElementById("permCuenta").onchange = e=>{ permitir.cuentaId = e.target.value; pintar(); };
}
