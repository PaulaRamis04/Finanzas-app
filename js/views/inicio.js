// Pestaña «Inicio»: su render y sus eventos.

function renderInicio(){
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
  // Ahorro es lo apartado a propósito (movimientos de la categoría «Inversión»), no lo que sobra.
  const disponible = restarDinero(restarDinero(ingresos, gastosReales), inversionMes);

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
    <h2>🐷 Mis huchas</h2>
    ${enCurso.length? `
    <div class="list" style="margin-top:8px">
      ${enCurso.slice(0,4).map(o=>{
        const actual = Math.max(progresoObjetivo(o),0);
        const pct = o.meta>0 ? Math.min(actual/o.meta*100,100) : 0;
        return `
        <div>
          <div style="font-size:14px;margin-bottom:2px">${esc(o.nombre)}</div>
          ${barraHucha(o, pct, true)}
        </div>`;
      }).join("")}
    </div>` : `<p class="meta" style="margin:8px 0 0">Todas tus huchas están llenas 🎉</p>`}
    <button class="btn ghost" data-ir-tab="Objetivos" style="margin-top:14px">Ver todas las huchas</button>
  </div>` : `
  <div class="card">
    <h2>🐷 Mis huchas</h2>
    ${vacio("hucha","Tu hucha sueña con algo","Ponle una meta: un viaje, un colchón o un capricho.")}
    <button class="btn" data-ir-tab="Objetivos">Crear una hucha</button>
  </div>`;

  const hitosHechos = HITOS.filter(h=>hitosGuardados?.[h.id]).length;
  const bloqueHitos = `
  <div class="card cierre-banner">
    <div class="cierre-banner-ico">🏆</div>
    <div style="flex:1 1 160px;min-width:0">
      <strong style="font-size:16px">Mis hitos</strong>
      <div class="meta">${hitosHechos} / ${HITOS.length} desbloqueados</div>
    </div>
    <button class="btn ghost" data-ir-tab="Hitos">Ver mis hitos</button>
  </div>`;

  const bloquePermitir = `
  <div class="card cierre-banner">
    <div class="cierre-banner-ico">🧾</div>
    <div style="flex:1 1 160px;min-width:0">
      <strong style="font-size:16px">¿Me lo puedo permitir?</strong>
      <div class="meta">Mira qué te cuesta de verdad una compra antes de hacerla</div>
    </div>
    <button class="btn ghost" data-ir-tab="Permitir">Probar</button>
  </div>`;

  const {nota:notaSalud} = evaluarSalud();
  const bloqueSalud = `
  <div class="card cierre-banner">
    <div class="cierre-banner-ico">🚦</div>
    <div style="flex:1 1 160px;min-width:0">
      <strong style="font-size:16px">¿Cómo estoy?</strong>
      <div class="meta">${notaSalud===null ? "Tu semáforo financiero" : `Salud financiera: ${notaSalud}/100`}</div>
    </div>
    <button class="btn ghost" data-ir-tab="Salud">Ver mi semáforo</button>
  </div>`;

  // Gráfico de gasto acumulado: por días si hay un mes elegido, por meses si es el año entero.
  const hoy = new Date();
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

  const {valores:valoresPat, etiquetas:etiquetasPat} = serieRango(patrimonioRango);
  const cambioPat = valoresPat.length>1 ? Math.round((valoresPat[valoresPat.length-1]-valoresPat[0])*100)/100 : 0;
  const RANGOS_PAT = [["max","Máx"],["1a","1 año"],["6m","6 meses"],["1m","1 mes"],["1d","1 día"]];

  return `
  <div class="hola">
    <h1><button class="hola-perfil" id="btnPerfiles" aria-haspopup="dialog" aria-label="Cambiar de perfil">Hola${nombre ? ", "+esc(nombre) : ""}${esPremium ? ESTRELLA_PREMIUM : ""} 👋<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button></h1>
    <span style="display:flex;gap:10px">${botonOjo("btnOjoInicio")}<button class="campana" id="btnAvisos" aria-label="Notificaciones"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>${avisos ? `<span class="punto"></span>` : ""}</button></span>
  </div>
  <div class="hero">
    <div class="saldo-lbl">Saldo total</div>
    <div class="saldo">
      <span class="cifra ${patNeto>=0?'':'neg'}">${eur(patNeto)}</span>
      <span class="var ${delta>=0?'pos':'neg'}">${delta>=0?"↗ +":"↘ -"}${Math.abs(pctPat).toFixed(1).replace(".",",")} % · ${delta>=0?"+":"-"}${eur(Math.abs(delta))} en ${lbl}</span>
    </div>
    <div class="hero-grid">
      <div class="t-menta"><span>Disponible</span><b>${eur(disponible)}</b></div>
      <div class="t-melocoton"><span>Inversiones</span><b>${eur(totalInversiones)}</b></div>
      <div class="t-menta"><span>Me deben</span><b class="pos">${eur(meDeben)}</b></div>
      <div class="t-melocoton"><span>Debo</span><b class="neg">${eur(debo)}</b></div>
    </div>
  </div>
  <div class="card barras-mes">
    <h2>${porMes ? MESES[Number(periodoMes)-1] : "Año "+periodoAnio} de un vistazo</h2>
    ${barrasMes(gastosReales, presupuestoTotal, ingresos, inversionMes, disponible, tAnt ? comparar(gastosReales, tAnt.gastos, false) : "")}
  </div>
  <div class="card grafico" id="graficoGastoInicio">
    <h2 style="margin-bottom:6px">Gasto de ${porMes ? MESES[mesSel-1].toLowerCase() : periodoAnio}</h2>
    <div class="meta" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
      <span style="width:9px;height:9px;border-radius:50%;background:var(--mint);display:inline-block"></span>
      ${porMes ? "Lo que llevas gastado día a día" : "Lo que llevas gastado mes a mes"}${presupuestoTotal>0 ? ` · <span style="color:var(--accent)">- - -</span> presupuesto` : ""}
    </div>
    <div style="margin-top:10px">${graficoGastoMes(acumulado, etiquetasGasto, presupuestoTotal, porMes ? etiquetasGasto.map(d=>`${d} ${MESES[mesSel-1].slice(0,3).toLowerCase()}`) : MESES.map(m=>`Hasta ${m.toLowerCase()}`))}</div>
  </div>
  <div class="tit-fila" style="margin-top:22px"><h2>Acciones rápidas</h2>${accionesElegidas().length ? `<button class="auth-link" data-editar-acciones="1">Editar</button>` : ""}</div>
  <div class="acciones">
    ${accionesElegidas().map(a=>`<button class="accion" data-accion="${a.id}"><i style="background:${a.fondo}">${a.ico}</i>${a.txt}</button>`).join("")}
    <button class="accion nueva" id="btnEditarAcciones" aria-label="Añadir o quitar accesos rápidos"><i>＋</i>Añadir</button>
    ${accionesElegidas().length ? "" : `<p class="meta acciones-pista">Añade aquí los accesos que más uses.</p>`}
  </div>
  <div class="tit-fila"><h2>Movimientos recientes</h2><button class="auth-link" data-ir-tab="Movimientos">Ver todos</button></div>
  ${recientes.length ? `<div class="list" style="margin-bottom:16px">
    ${recientes.map(m=>filaMov(m)).join("")}
  </div>` : `<div class="card">${vacio("hucha","Aún no hay movimientos","Toca «Añadir» para apuntar el primero.")}</div>`}
  ${bloqueAlertas}
  ${bloqueObjetivos}
  ${bloqueSalud}
  ${bloqueHitos}
  ${bloquePermitir}
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

// Tres barras redondeadas del periodo: gastado frente al presupuesto (o a los ingresos si no hay), ahorro apartado y disponible.
function barrasMes(gastado, presupuesto, ingresos, ahorro, disponible, vsAnterior){
  const pct = (v, base)=>base>0 ? Math.max(0, Math.min(v/base*100, 100)) : 0;
  const base = presupuesto>0 ? presupuesto : ingresos;
  const uso = base>0 ? gastado/base*100 : 0;
  const colorGasto = uso>100 ? "var(--neg)" : uso>=80 ? "#f2a65a" : "var(--mint)";
  const fila = (titulo, valor, ancho, color, pie, extra = "")=>`
    <div class="barra-mes">
      <div class="barra-cab"><span>${titulo}</span><b>${valor}</b></div>
      <div class="barra"><div style="width:${ancho}%;background:${color}"></div></div>
      <div class="meta">${pie}</div>${extra}
    </div>`;
  const deIngresos = v=>ingresos>0 ? `${Math.round(v/ingresos*100)} % de tus ingresos` : "Sin ingresos en este periodo";
  return fila("Gastado", presupuesto>0 ? `${eur(gastado)} de ${eur(presupuesto)}` : eur(gastado), pct(gastado, base), colorGasto,
      presupuesto>0 ? (gastado>presupuesto ? `Te has pasado ${eur(restarDinero(gastado, presupuesto))}` : `Te quedan ${eur(restarDinero(presupuesto, gastado))} del presupuesto`)
        : (ingresos>0 ? `${Math.round(uso)} % de tus ingresos` : "Sin presupuesto ni ingresos"), vsAnterior)
    + fila("Ahorro", eur(ahorro), pct(ahorro, ingresos), "#8b7fd6", ahorro>0 ? `Apartado a propósito · ${deIngresos(ahorro)}` : "Aún no has apartado nada en este periodo")
    + fila("Disponible", eur(disponible), pct(disponible, ingresos), "var(--accent)", `Lo que sobra tras gastos y ahorro · ${deIngresos(disponible)}`);
}

// Acciones rápidas personalizables: empiezan vacías y cada uno elige las suyas (se guardan en este dispositivo).
const CATALOGO_ACCIONES = [
  {id:"mov", ico:"✍️", txt:"Apuntar", largo:"Apuntar movimiento", fondo:"var(--lav-soft)"},
  {id:"transferencia", ico:"🔁", txt:"Transferir", largo:"Transferir entre cuentas", fondo:"var(--accent-soft)"},
  {id:"Movimientos", ico:"📒", txt:"Movim.", largo:"Movimientos", fondo:"var(--peach-soft)"},
  {id:"Gastos", ico:"💸", txt:"Gastos", largo:"Gastos", fondo:"var(--accent-soft)"},
  {id:"Resumen del mes", ico:"📊", txt:"Análisis", largo:"Análisis", fondo:"var(--lav-soft)"},
  {id:"Presupuestos", ico:"🧮", txt:"Presup.", largo:"Presupuestos", fondo:"var(--mint-soft)"},
  {id:"Permitir", ico:"🧾", txt:"¿Puedo?", largo:"¿Me lo puedo permitir?", fondo:"var(--peach-soft)"},
  {id:"Cuentas", ico:"👛", txt:"Cuentas", largo:"Cuentas", fondo:"var(--peach-soft)"},
  {id:"Deudas", ico:"🤝", txt:"Deudas", largo:"Deudas", fondo:"var(--peach-soft)"},
  {id:"Inversiones", ico:"🌱", txt:"Invertir", largo:"Inversiones", fondo:"var(--mint-soft)"},
  {id:"Objetivos", ico:"🎯", txt:"Objetivos", largo:"Objetivos", fondo:"var(--accent-soft)"},
  {id:"Hitos", ico:"🏆", txt:"Hitos", largo:"Mis hitos", fondo:"var(--peach-soft)"},
  {id:"Salud", ico:"🚦", txt:"¿Cómo estoy?", largo:"¿Cómo estoy?", fondo:"var(--mint-soft)"},
  {id:"Recurrentes", ico:"📅", txt:"Recurr.", largo:"Recurrentes", fondo:"var(--lav-soft)"},
  {id:"Proyección", ico:"🔮", txt:"Proyección", largo:"Proyección", fondo:"var(--lav-soft)"},
  {id:"Categorías", ico:"🏷️", txt:"Categorías", largo:"Categorías", fondo:"var(--mint-soft)"},
  {id:"Personalización", ico:"🎨", txt:"Aspecto", largo:"Personalización", fondo:"var(--accent-soft)"},
];

function leerAcciones(){ try{ const a = JSON.parse(localStorage.getItem("accionesRapidas")||"[]"); return Array.isArray(a) ? a : []; }catch(e){ return []; } }
function accionesElegidas(){ return leerAcciones().map(id=>CATALOGO_ACCIONES.find(a=>a.id===id)).filter(Boolean); }

// Hoja inferior con todo el catálogo: tocar marca o desmarca; el orden es el de elección.
function elegirAcciones(){
  let elegidas = leerAcciones().filter(id=>CATALOGO_ACCIONES.some(a=>a.id===id));
  document.getElementById("hoja")?.remove();
  const cont = document.createElement("div");
  cont.id = "hoja";
  const pintar = ()=>{ cont.querySelector(".elegir-acciones").innerHTML = CATALOGO_ACCIONES.map(a=>{
    const n = elegidas.indexOf(a.id);
    return `<button class="elegir ${n>=0?"sel":""}" data-elegir-accion="${esc(a.id)}" aria-pressed="${n>=0}"><i style="background:${a.fondo}">${a.ico}</i><span>${a.largo}</span>${n>=0?`<b>${n+1}</b>`:""}</button>`;
  }).join(""); };
  cont.innerHTML = `
    <div class="hoja-fondo"></div>
    <div class="hoja" role="dialog" aria-modal="true" aria-labelledby="hojaTitulo">
      <div class="hoja-asa"></div>
      <h2 id="hojaTitulo">Tus acciones rápidas</h2>
      <p>Toca las que quieras tener a mano en el Inicio. Salen en el orden en que las eliges.</p>
      <div class="elegir-acciones"></div>
      <div class="hoja-btns"><button class="hoja-si" id="hojaListo">Listo</button></div>
    </div>`;
  document.body.appendChild(cont);
  pintar();
  requestAnimationFrame(()=>requestAnimationFrame(()=>cont.classList.add("abierta")));
  cont.querySelector(".elegir-acciones").onclick = e=>{
    const b = e.target.closest("[data-elegir-accion]");
    if(!b) return;
    const id = b.dataset.elegirAccion;
    elegidas = elegidas.includes(id) ? elegidas.filter(x=>x!==id) : [...elegidas, id];
    try{ localStorage.setItem("accionesRapidas", JSON.stringify(elegidas)); }catch(e){}
    pintar();
  };
  const cerrar = ()=>{
    document.removeEventListener("keydown", tecla);
    cont.classList.remove("abierta");
    setTimeout(()=>cont.remove(), 260);
    render();
  };
  const tecla = e=>{ if(e.key==="Escape") cerrar(); };
  document.addEventListener("keydown", tecla);
  cont.querySelector(".hoja-fondo").onclick = cerrar;
  cont.querySelector("#hojaListo").onclick = cerrar;
}

// Hoja inferior de perfiles: cambiar a otro, añadir otra cuenta o cerrar la sesión de este.
function elegirPerfil(){
  const yo = session?.user?.id;
  const perfiles = leerPerfiles();
  if(!perfiles.some(p=>p.id===yo)) perfiles.unshift({id:yo, email:session.user.email, nombre:(session.user.user_metadata?.full_name||"").trim()});
  document.getElementById("hoja")?.remove();
  const cont = document.createElement("div");
  cont.id = "hoja";
  cont.innerHTML = `
    <div class="hoja-fondo"></div>
    <div class="hoja" role="dialog" aria-modal="true" aria-labelledby="hojaTitulo">
      <div class="hoja-asa"></div>
      <h2 id="hojaTitulo">Perfiles</h2>
      <div class="perfiles-lista">${perfiles.map(p=>`<button class="perfil-btn ${p.id===yo?"actual":""}" data-cambiar-perfil="${esc(p.id)}" ${p.id===yo?'aria-current="true"':""}>${avatarPerfil(p)}<span><b>${esc(p.nombre||p.email)}</b>${p.nombre?`<small>${esc(p.email)}</small>`:""}</span>${p.id===yo?`<span class="check">✓</span>`:""}</button>`).join("")}</div>
      <button class="perfil-accion" id="btnAnadirPerfil">＋ Añadir otra cuenta</button>
      <button class="perfil-accion salir" id="btnSalirPerfil">Cerrar sesión de este perfil</button>
    </div>`;
  document.body.appendChild(cont);
  requestAnimationFrame(()=>requestAnimationFrame(()=>cont.classList.add("abierta")));
  const cerrar = ()=>{
    document.removeEventListener("keydown", tecla);
    cont.classList.remove("abierta");
    setTimeout(()=>cont.remove(), 260);
  };
  const tecla = e=>{ if(e.key==="Escape") cerrar(); };
  document.addEventListener("keydown", tecla);
  cont.querySelector(".hoja-fondo").onclick = cerrar;
  cont.querySelector(".perfiles-lista").onclick = e=>{ const b = e.target.closest("[data-cambiar-perfil]"); if(b && b.dataset.cambiarPerfil!==yo) cambiarAPerfil(b.dataset.cambiarPerfil); };
  cont.querySelector("#btnAnadirPerfil").onclick = anadirPerfil;
  cont.querySelector("#btnSalirPerfil").onclick = ()=> sb.auth.signOut();
}

function wireEventosInicio(){
  const perf = document.getElementById("btnPerfiles");
  if(perf) perf.onclick = elegirPerfil;
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
  const editar = document.getElementById("btnEditarAcciones");
  if(editar) editar.onclick = elegirAcciones;
  document.querySelectorAll("[data-editar-acciones]").forEach(b=>b.onclick = elegirAcciones);
  const ojo = document.getElementById("btnOjoInicio");
  if(ojo) ojo.onclick = alternarPrivacidad;
  const av = document.getElementById("btnAvisos");
  if(av) av.onclick = ()=>{ tab = "Notificaciones"; render(); window.scrollTo(0,0); };
  document.querySelectorAll("[data-ir-tab]").forEach(b=>b.onclick=()=>{ tab=b.dataset.irTab; render(); window.scrollTo(0,0); });
  document.querySelectorAll("[data-rango-pat]").forEach(b=>b.onclick=()=>{ patrimonioRango = b.dataset.rangoPat; render(); });
}
