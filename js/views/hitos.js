// Pestaña «Hitos»: logros que la app desbloquea sola según tu patrimonio, tu ahorro, tus inversiones y tus huchas.
// Cada hito guarda la fecha en que se consiguió (tabla «hitos», schema_hitos.sql; sin ella, se guarda en este dispositivo)
// y ya no se vuelve a bloquear aunque luego baje el saldo.

let hitosGuardados = null; // {clave: "AAAA-MM-DD"}; null hasta cargarlos
let hitosEnBd = false, sincronizandoHitos = false, cargandoHistHitos = false;

const GRUPOS_HITOS = [
  {id:"patrimonio", icono:"💰", nombre:"Ahorro y patrimonio"},
  {id:"seguridad", icono:"🛡️", nombre:"Seguridad"},
  {id:"inversion", icono:"📈", nombre:"Inversión"},
  {id:"objetivos", icono:"🎯", nombre:"Objetivos"},
  {id:"rachas", icono:"🔥", nombre:"Rachas"}
];

const miles = n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const fechaHito = f=>f.split("-").reverse().join("/");
function finDeMes(ym){ const [y,m] = ym.split("-").map(Number); return fechaLocal(new Date(y, m, 0)); }
function mesSiguiente(ym){ let [y,m] = ym.split("-").map(Number); m++; if(m>12){ m = 1; y++; } return `${y}-${String(m).padStart(2,"0")}`; }

// hist: necesita todo el histórico de movimientos para saber si (y cuándo) se cumplió.
// eval(c) → {ok, fecha}; fecha null = no se sabe, se toma el día en que la app lo ve.
// progreso(c) → [actual, meta] para la barra de los que aún no tienes.
const hitoPatrimonio = (icono, cantidad, titulo)=>({id:"pat_"+cantidad, grupo:"patrimonio", icono, titulo,
  hecho:`Alcanzaste ${miles(cantidad)} € de patrimonio`, pista:`Llega a ${miles(cantidad)} € de patrimonio (cuentas e inversiones, menos deudas).`,
  eval:c=>c.patrimonio(cantidad), progreso:c=>[c.patActual, cantidad]});
const hitoCobertura = (meses, titulo)=>({id:"cob_"+meses, grupo:"seguridad", icono:"🛡️", titulo,
  hecho:`Tus cuentas ya cubrían ${meses} ${meses===1?"mes":"meses"} de gastos`, pista:`Ten en tus cuentas lo que gastas en ${meses} ${meses===1?"mes":"meses"}.`,
  eval:c=>({ok:c.cobertura!==null && c.cobertura>=meses, fecha:null}), progreso:c=>c.cobertura===null ? null : [c.cobertura, meses], unidad:"meses"});
const hitoInvertido = (icono, cantidad, titulo)=>({id:"inv_"+cantidad, grupo:"inversion", icono, titulo,
  hecho:`Llegaste a ${miles(cantidad)} € invertidos`, pista:`Invierte ${miles(cantidad)} € en total (sumando todas tus aportaciones).`,
  eval:c=>c.invertido(cantidad), progreso:c=>[c.invertidoTotal, cantidad]});
const hitoVivienda = (pct, icono, titulo)=>({id:"casa_"+pct, grupo:"objetivos", icono, titulo,
  hecho: pct===100 ? "Llenaste tu hucha de vivienda" : `Tu hucha de vivienda llegó al ${pct} %`, pista:`Llena el ${pct} % de una hucha de vivienda (con el icono 🏠).`,
  eval:c=>({ok:c.pctVivienda>=pct, fecha:null}), progreso:c=>[c.pctVivienda, pct], unidad:"%"});
const hitoRacha = (tipo, n)=>({id:`racha_${tipo}_${n}`, grupo:"rachas", icono: tipo==="ahorro" ? "🔥" : "📈", hist:true,
  titulo:`${n} meses ${tipo==="ahorro" ? "ahorrando" : "invirtiendo"}`,
  hecho: tipo==="ahorro" ? `Completaste ${n} meses seguidos ahorrando` : `Completaste ${n} meses seguidos aportando a tus inversiones`,
  pista: tipo==="ahorro" ? `Ahorra ${n} meses seguidos (que entre más de lo que gastas).` : `Aporta a tus inversiones ${n} meses seguidos.`,
  eval:c=>c.rachaHasta(tipo==="ahorro" ? c.mesesAhorro : c.mesesInversion, n), progreso:c=>[c.mejorRacha(tipo==="ahorro" ? c.mesesAhorro : c.mesesInversion), n], unidad:"meses"});
const tieneHuchaLlena = (c, tema)=>objetivos.some(o=>temaObjetivo(o)===tema && objetivoCompletado(o));

const HITOS = [
  hitoPatrimonio("🥉", 500, "Primeros 500 €"),
  hitoPatrimonio("🥉", 1000, "Primeros 1.000 €"),
  hitoPatrimonio("🥈", 2500, "2.500 € de patrimonio"),
  hitoPatrimonio("🥈", 5000, "5.000 €"),
  hitoPatrimonio("🥇", 10000, "10.000 €"),
  hitoPatrimonio("🏆", 25000, "25.000 €"),
  hitoPatrimonio("💎", 50000, "50.000 €"),
  hitoPatrimonio("🚀", 100000, "100.000 €"),

  {id:"mes_ahorro", grupo:"seguridad", icono:"🟢", titulo:"Primer mes con ahorro", hist:true,
    hecho:"Cerraste tu primer mes ahorrando", pista:"Termina un mes en el que entre más dinero del que gastas.",
    eval:c=>{ const m = [...c.mesesAhorro].sort()[0]; return {ok:!!m, fecha: m ? finDeMes(m) : null}; }},
  {id:"mes_inversion", grupo:"seguridad", icono:"🟢", titulo:"Primer mes con inversión", hist:true,
    hecho:"Hiciste tu primera aportación a una inversión", pista:"Aporta dinero a una inversión (o apunta un gasto de «Inversión»).",
    eval:c=>({ok:!!c.primeraFechaInv, fecha:c.primeraFechaInv})},
  hitoCobertura(1, "1 mes de gastos cubierto"),
  hitoCobertura(3, "3 meses de gastos"),
  hitoCobertura(6, "6 meses de gastos"),
  {id:"fondo_emergencia", grupo:"seguridad", icono:"🛡️", titulo:"Fondo de emergencia completo",
    hecho:"Llenaste tu fondo de emergencia", pista:"Llena una hucha de emergencias (con el icono ☂️).",
    eval:c=>({ok:tieneHuchaLlena(c, "emergencia"), fecha:null})},

  {id:"inv_primera", grupo:"inversion", icono:"📈", titulo:"Primera inversión",
    hecho:"Empezaste a invertir", pista:"Añade tu primera inversión.",
    eval:c=>({ok:c.hayInversion, fecha:c.valorInicialInv>0 ? null : c.primeraFechaInv})},
  hitoInvertido("💵", 500, "Primeros 500 € invertidos"),
  hitoInvertido("💵", 1000, "1.000 € invertidos"),
  hitoInvertido("📊", 5000, "5.000 € invertidos"),
  hitoInvertido("📊", 10000, "10.000 € invertidos"),
  {id:"inv_anio", grupo:"inversion", icono:"🔄", titulo:"Primer año invirtiendo",
    hecho:"Cumpliste un año invirtiendo", pista:"Sigue invirtiendo hasta que se cumpla un año desde tu primera inversión.",
    eval:c=>{
      const ini = [hitosGuardados?.inv_primera, c.primeraFechaInv].filter(Boolean).sort()[0];
      if(!ini) return {ok:false};
      const [y,m,d] = ini.split("-");
      const aniversario = `${Number(y)+1}-${m}-${m==="02" && d==="29" ? "28" : d}`;
      return {ok:aniversario<=c.hoy, fecha:aniversario};
    }, progreso:c=>{ const ini = [hitosGuardados?.inv_primera, c.primeraFechaInv].filter(Boolean).sort()[0]; return ini ? [Math.min(diasEntre(ini, c.hoy),365), 365] : null; }, unidad:"días"},
  {...hitoRacha("inversion", 12), id:"inv_12_meses", grupo:"inversion", icono:"🔄", titulo:"12 meses seguidos aportando"},

  {id:"obj_primero", grupo:"objetivos", icono:"🎯", titulo:"Primer objetivo completado",
    hecho:"Llenaste tu primera hucha", pista:"Llena cualquiera de tus huchas.",
    eval:c=>({ok:objetivos.some(objetivoCompletado), fecha:null})},
  {id:"obj_viaje", grupo:"objetivos", icono:"✈️", titulo:"Primer viaje financiado",
    hecho:"Financiaste tu primer viaje con tu hucha de viajes", pista:"Llena una hucha de viaje (con el icono ✈️).",
    eval:c=>({ok:tieneHuchaLlena(c, "viaje"), fecha:null})},
  {id:"obj_regalos", grupo:"objetivos", icono:"🎁", titulo:"Fondo de regalos completado",
    hecho:"Completaste tu fondo de regalos", pista:"Llena una hucha de regalos (con el icono 🎁).",
    eval:c=>({ok:tieneHuchaLlena(c, "regalo"), fecha:null})},
  hitoVivienda(10, "🏠", "10 % del objetivo vivienda"),
  hitoVivienda(25, "🏠", "25 % vivienda"),
  hitoVivienda(50, "🏠", "50 % vivienda"),
  hitoVivienda(75, "🏠", "75 % vivienda"),
  hitoVivienda(100, "🏡", "Vivienda: objetivo conseguido"),

  hitoRacha("ahorro", 3),
  hitoRacha("ahorro", 6),
  hitoRacha("ahorro", 12),
  hitoRacha("inversion", 3),
  hitoRacha("inversion", 6),
];

// Todo lo que miran los hitos, calculado solo cuando alguno lo pide.
function contextoHitos(){
  const c = {hoy: today()};
  const perezoso = (k, fn)=>Object.defineProperty(c, k, {get(){ const v = fn(); Object.defineProperty(c, k, {value:v}); return v; }, configurable:true});
  perezoso("patActual", patrimonioNetoActual);
  // Patrimonio al final de cada mes desde el primer dato hasta el mes pasado.
  perezoso("seriePat", ()=>{
    const fechas = [...movimientos.map(m=>m.fecha), ...movResumen.map(r=>r.mes), ...aportaciones.map(a=>a.fecha)].filter(Boolean);
    if(!fechas.length) return [];
    const actual = c.hoy.slice(0,7), serie = [];
    for(let ym = fechas.sort()[0].slice(0,7); ym<actual; ym = mesSiguiente(ym)) serie.push({ym, valor:patrimonioEnFecha(mesSiguiente(ym)+"-01")});
    return serie;
  });
  c.patrimonio = cantidad=>{
    const mes = c.seriePat.find(s=>s.valor>=cantidad);
    if(!mes) return {ok:c.patActual>=cantidad, fecha:null};
    // Día exacto dentro de ese mes (si solo está el resumen mensual, se queda en el día 1).
    for(let f = mes.ym+"-01"; f.startsWith(mes.ym); f = sumarDias(f, 1)) if(patrimonioEnFecha(sumarDias(f, 1))>=cantidad) return {ok:true, fecha:f};
    return {ok:true, fecha:finDeMes(mes.ym)};
  };
  // Meses en los que entró más de lo que se gastó (sin contar lo que se aparta a inversión).
  perezoso("mesesAhorro", ()=>{
    const porMes = {};
    movimientosEfectivos(()=>true).forEach(m=>{
      if(m.tipo==="gasto" && m.categoria==="Inversión") return;
      const k = m.fecha.slice(0,7);
      porMes[k] = m.tipo==="ingreso" ? sumarDinero(porMes[k]||0, m.importe) : restarDinero(porMes[k]||0, m.importe);
    });
    return new Set(Object.keys(porMes).filter(k=>porMes[k]>0));
  });
  perezoso("fechasInversion", ()=>[...aportaciones.map(a=>a.fecha),
    ...movimientos.filter(m=>m.tipo==="gasto" && m.categoria==="Inversión" && !m.reembolsoDe).map(m=>m.fecha)].filter(Boolean).sort());
  perezoso("mesesInversion", ()=>new Set(c.fechasInversion.map(f=>f.slice(0,7))));
  perezoso("primeraFechaInv", ()=>c.fechasInversion[0] || null);
  const invSueltas = ()=>inversiones.filter(i=>!i.esGrupo);
  perezoso("valorInicialInv", ()=>sumaImportes(invSueltas(), i=>i.valorInicial||0));
  perezoso("hayInversion", ()=>invSueltas().length>0 || aportaciones.length>0 || c.fechasInversion.length>0);
  perezoso("invertidoTotal", ()=>sumarDinero(c.valorInicialInv, sumaImportes(aportaciones)));
  c.invertido = cantidad=>{
    if(c.invertidoTotal<cantidad) return {ok:false};
    let suma = c.valorInicialInv;
    if(suma>=cantidad) return {ok:true, fecha:null};
    for(const a of [...aportaciones].sort((x,y)=>(x.fecha||"").localeCompare(y.fecha||""))){
      suma = sumarDinero(suma, a.importe);
      if(suma>=cantidad) return {ok:true, fecha:a.fecha||null};
    }
    return {ok:true, fecha:null};
  };
  // Meses de gastos que cubre lo que hay en las cuentas: media de los últimos 6 meses cerrados con movimientos.
  perezoso("cobertura", ()=>{
    const actual = c.hoy.slice(0,7);
    const desde = movParcial && movDesde>"1900-01-01" ? movDesde.slice(0,7) : "";
    const porMes = {};
    movimientosEfectivos(()=>true).forEach(m=>{
      const k = m.fecha.slice(0,7);
      if(k>=actual || k<desde) return;
      porMes[k] = porMes[k] || 0;
      if(m.tipo==="gasto" && m.categoria!=="Inversión") porMes[k] = sumarDinero(porMes[k], m.importe);
    });
    const meses = Object.keys(porMes).sort().slice(-6);
    const media = meses.length ? sumaImportes(meses, k=>porMes[k])/meses.length : 0;
    if(media<=0) return null;
    return Math.max(0, sumaImportes(cuentas, saldoCuenta)/media);
  });
  perezoso("pctVivienda", ()=>Math.max(0, ...objetivos.filter(o=>temaObjetivo(o)==="casa" && o.meta>0).map(o=>progresoObjetivo(o)/o.meta*100)));
  // Primer mes en el que una racha llegó a n meses seguidos.
  c.rachaHasta = (set, n)=>{
    let racha = 0, previo = null;
    for(const ym of [...set].sort()){
      racha = previo && mesSiguiente(previo)===ym ? racha+1 : 1;
      previo = ym;
      if(racha>=n) return {ok:true, fecha:finDeMes(ym)};
    }
    return {ok:false};
  };
  c.mejorRacha = set=>{
    let mejor = 0, racha = 0, previo = null;
    [...set].sort().forEach(ym=>{ racha = previo && mesSiguiente(previo)===ym ? racha+1 : 1; previo = ym; mejor = Math.max(mejor, racha); });
    return mejor;
  };
  // Racha que sigue viva: cuenta hacia atrás desde este mes (o desde el pasado si este aún no cuenta).
  c.rachaActual = set=>{
    const mesAnterior = ym=>{ let [y,m] = ym.split("-").map(Number); m--; if(m<1){ m = 12; y--; } return `${y}-${String(m).padStart(2,"0")}`; };
    let ym = c.hoy.slice(0,7), n = 0;
    if(!set.has(ym)) ym = mesAnterior(ym);
    while(set.has(ym)){ n++; ym = mesAnterior(ym); }
    return n;
  };
  return c;
}

// Hay histórico completo cuando no hay carga parcial o ya se pidió todo.
function historiaCompletaHitos(){ return !movParcial || movDesde<="1900-01-01"; }

function leerHitosLocal(){ try{ const h = JSON.parse(localStorage.getItem("hitos")||"{}"); return h && typeof h==="object" ? h : {}; }catch(e){ return {}; } }

function fijarHitos(d){
  hitosEnBd = !!d.ok;
  hitosGuardados = hitosEnBd ? Object.fromEntries(d.filas.map(h=>[h.clave, h.fecha])) : leerHitosLocal();
}

// Guarda los hitos recién conseguidos. La primera vez (nada guardado aún) no celebra: solo se pone al día.
function sincronizarHitos(){
  if(!hitosGuardados || sincronizandoHitos) return;
  const c = contextoHitos();
  const primeraVez = Object.keys(hitosGuardados).length===0;
  const completa = historiaCompletaHitos();
  const nuevos = [];
  HITOS.forEach(h=>{
    if(hitosGuardados[h.id] || (h.hist && !completa)) return;
    const r = h.eval(c);
    if(r.ok) nuevos.push({clave:h.id, fecha: r.fecha && r.fecha<=c.hoy ? r.fecha : c.hoy});
  });
  if(!nuevos.length) return;
  nuevos.forEach(n=>{ hitosGuardados[n.clave] = n.fecha; });
  if(hitosEnBd){
    sincronizandoHitos = true;
    (async ()=>{
      try{
        const {error} = await sb.from("hitos").insert(nuevos);
        // Si otro dispositivo ya guardó alguno, se guardan uno a uno (los repetidos fallan sin más).
        if(error) for(const n of nuevos) await sb.from("hitos").insert(n);
      }catch(e){}
      sincronizandoHitos = false;
    })();
  } else {
    try{ localStorage.setItem("hitos", JSON.stringify(hitosGuardados)); }catch(e){}
  }
  if(primeraVez) return;
  const recientes = nuevos.filter(n=>diasEntre(n.fecha, c.hoy)<=7).map(n=>HITOS.find(h=>h.id===n.clave));
  if(recientes.length) lanzarConfeti(recientes.map(h=>`${h.icono} ${esc(h.titulo)}`).join("<br>"), recientes.length>1 ? "¡Nuevos hitos desbloqueados!" : "¡Nuevo hito desbloqueado!");
}

function renderHitos(){
  const completa = historiaCompletaHitos();
  if(!completa && !cargandoHistHitos){
    cargandoHistHitos = true;
    setTimeout(()=>cargarHistoricoCompleto().finally(()=>{ cargandoHistHitos = false; }), 0);
  }
  const g = hitosGuardados || {};
  const total = HITOS.length, conseguidos = HITOS.filter(h=>g[h.id]).length;
  const c = contextoHitos();
  const rachaAho = completa ? c.rachaActual(c.mesesAhorro) : null;
  const rachaInv = completa ? c.rachaActual(c.mesesInversion) : null;
  const tarjetaRacha = (icono, titulo, n, texto)=>`
    <div class="racha${n>0?" viva":""}">
      <div class="racha-ico">${icono}</div>
      <div><strong>${titulo}: ${n===null ? "…" : `${n} ${n===1?"mes":"meses"}`}</strong>
      <div class="meta">${n===null ? "Calculando con todo tu histórico…" : n>0 ? texto(n) : "Aún no hay racha en marcha. ¡Este mes puede ser el primero!"}</div></div>
    </div>`;
  const ultimo = Object.entries(g).filter(([k])=>HITOS.some(h=>h.id===k)).sort((a,b)=>b[1].localeCompare(a[1]))[0];
  const hUltimo = ultimo && HITOS.find(h=>h.id===ultimo[0]);
  return `
  <div class="card hitos-cab">
    <div class="meta" style="letter-spacing:.08em;font-weight:800">MIS HITOS</div>
    <div class="hitos-cuenta"><b>${conseguidos}</b> / ${total} desbloqueados</div>
    <div class="barra" style="margin-top:10px"><div style="width:${conseguidos/total*100}%;background:var(--accent)"></div></div>
    ${hUltimo ? `<div class="meta" style="margin-top:10px">Último: ${hUltimo.icono} ${esc(hUltimo.titulo)} · ${fechaHito(ultimo[1])}</div>` : ""}
  </div>
  <div class="rachas">
    ${tarjetaRacha("🔥", "Racha de ahorro", rachaAho, n=>`Has ahorrado durante ${n} ${n===1?"mes":"meses"} consecutivos.`)}
    ${tarjetaRacha("📈", "Racha de inversión", rachaInv, n=>`Has realizado aportaciones durante ${n} ${n===1?"mes":"meses"} consecutivos.`)}
  </div>
  ${GRUPOS_HITOS.map(gr=>{
    const lista = HITOS.filter(h=>h.grupo===gr.id);
    return `
    <div class="section-title">${gr.icono} ${gr.nombre} <span class="meta" style="font-weight:700">${lista.filter(h=>g[h.id]).length}/${lista.length}</span></div>
    <div class="hitos-grid">${lista.map(h=>`
      <button class="hito${g[h.id]?" ok":""}" data-hito="${h.id}" aria-label="${esc(h.titulo)}${g[h.id]?"":" (bloqueado)"}">
        <span class="hito-ico">${g[h.id] ? h.icono : "🔒"}</span><span class="hito-nom">${esc(h.titulo)}</span>
      </button>`).join("")}</div>`;
  }).join("")}
  <p class="meta" style="margin-top:18px">Los hitos se desbloquean solos con lo que apuntas. Las fechas antiguas son una estimación a partir de tus movimientos.</p>`;
}

function detalleHito(id){
  const h = HITOS.find(x=>x.id===id);
  if(!h) return;
  const fecha = hitosGuardados?.[id];
  let cuerpo;
  if(fecha) cuerpo = `<p>${esc(h.hecho)} el ${fechaHito(fecha)}.</p>`;
  else {
    const p = h.progreso ? h.progreso(contextoHitos()) : null;
    const pct = p ? Math.max(0, Math.min(p[0]/p[1]*100, 100)) : 0;
    const cifra = !p ? "" : h.unidad==="%" ? `${Math.round(p[0])} % de ${p[1]} %`
      : h.unidad ? `${h.unidad==="meses" ? p[0].toFixed(p[0]%1 ? 1 : 0).replace(".",",") : Math.floor(p[0])} de ${p[1]} ${h.unidad}` : `${eur(p[0])} de ${eur(p[1])}`;
    cuerpo = `<p>${esc(h.pista)}</p>${p ? `
      <div class="barra" style="margin-top:14px"><div style="width:${pct}%;background:var(--accent)"></div></div>
      <p class="meta" style="margin-top:6px">${cifra} · ${Math.floor(pct)} %</p>` : ""}`;
  }
  document.getElementById("hoja")?.remove();
  const cont = document.createElement("div");
  cont.id = "hoja";
  cont.innerHTML = `
    <div class="hoja-fondo"></div>
    <div class="hoja" role="dialog" aria-modal="true" aria-labelledby="hojaTitulo">
      <div class="hoja-asa"></div>
      <div class="hoja-ico hito-hoja-ico${fecha?"":" bloqueado"}">${fecha ? h.icono : "🔒"}</div>
      <h2 id="hojaTitulo">${fecha ? "" : `${h.icono} `}${esc(h.titulo)}</h2>
      ${cuerpo}
      <div class="hoja-btns"><button class="hoja-si" id="hojaOk">${fecha ? "¡Genial!" : "Entendido"}</button></div>
    </div>`;
  document.body.appendChild(cont);
  const previo = document.activeElement;
  requestAnimationFrame(()=>requestAnimationFrame(()=>cont.classList.add("abierta")));
  const cerrar = ()=>{
    document.removeEventListener("keydown", tecla);
    cont.classList.remove("abierta");
    setTimeout(()=>cont.remove(), 260);
    try{ previo && previo.focus && previo.focus({preventScroll:true}); }catch(e){}
  };
  const tecla = e=>{ if(e.key==="Escape") cerrar(); };
  document.addEventListener("keydown", tecla);
  cont.querySelector(".hoja-fondo").onclick = cerrar;
  cont.querySelector("#hojaOk").onclick = cerrar;
  setTimeout(()=>{ try{ cont.querySelector("#hojaOk").focus({preventScroll:true}); }catch(e){} }, 60);
}

function wireEventosHitos(){
  document.querySelectorAll("[data-hito]").forEach(b=>b.onclick=()=>detalleHito(b.dataset.hito));
}
