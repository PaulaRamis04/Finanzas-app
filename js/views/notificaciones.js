// Pantalla «Notificaciones» (se abre con la campana del Inicio). Lista los avisos y solo al tocar uno
// lleva a su pestaña. Los ya vistos se recuerdan en este dispositivo para que la campana no marque punto.

const ICONO_AVISO_SUAVE = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:.75"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.5h.01"/></svg>`;

function avisosActuales(){
  const hoy = today();
  const en3 = new Date(); en3.setDate(en3.getDate()+3);
  const limite = `${en3.getFullYear()}-${String(en3.getMonth()+1).padStart(2,"0")}-${String(en3.getDate()).padStart(2,"0")}`;
  const hace30 = new Date(); hace30.setDate(hace30.getDate()-30);
  const viejo = `${hace30.getFullYear()}-${String(hace30.getMonth()+1).padStart(2,"0")}-${String(hace30.getDate()).padStart(2,"0")}`;
  const avisos = [];
  presupuestosEnAlerta().forEach(a=>{
    const pasado = a.gastado>a.limite;
    // Si aún no te has pasado es solo un aviso tranquilo: icono suave en vez de una señal de alarma.
    avisos.push({id:`pres-${a.categoria}-${periodoAnio}-${periodoMes}-${pasado?"pasado":"80"}`, tab:"Presupuestos", ico:pasado?"🚨":ICONO_AVISO_SUAVE, fondo:pasado?"var(--accent-soft)":"var(--mint-soft)",
      titulo: pasado ? `Te has pasado en ${a.categoria}` : `${a.categoria} se acerca al límite`,
      texto: pasado ? `${eur(a.gastado)} de ${eur(a.limite)} (${isFinite(a.pct)?a.pct.toFixed(0):"—"} %)`
        : `Llevas ${eur(a.gastado)} de ${eur(a.limite)} (${a.pct.toFixed(0)} %). Aún te quedan ${eur(restarDinero(a.limite, a.gastado))}.`});
  });
  recurrentes.filter(r=>r.activo).forEach(r=>{
    const f = proximaFechaRecurrente(r);
    if(f>=hoy && f<=limite) avisos.push({id:`rec-${r.id}-${f}`, tab:"Recurrentes", ico:"🔁", fondo:"var(--mint-soft)",
      titulo:`${r.nota||r.categoria}: ${r.tipo==="ingreso"?"+":"-"}${eur(r.importe)}`, texto:`Se apunta ${f===hoy?"hoy":etiquetaDia(f).toLowerCase()} en ${cuentaNombre(r.cuentaId)}`});
  });
  deudas.filter(d=>d.estado==="pendiente" && d.fecha<=viejo).forEach(d=>avisos.push({id:`deu-${d.id}`, tab:"Deudas", ico:"🤝", fondo:"var(--peach-soft)",
    titulo: d.direccion==="me_deben" ? `${d.persona} te debe ${eur(d.importe)}` : `Debes ${eur(d.importe)} a ${d.persona}`,
    texto:`Pendiente desde ${etiquetaDia(d.fecha)}${d.concepto?" · "+d.concepto:""}`}));
  const nuevas = mensajesAsesoria.filter(m=>m.autor==="admin" && !m.leido);
  if(nuevas.length) avisos.push({id:`ases-${nuevas[nuevas.length-1].id}`, tab:"Comunidad", ico:"🌸", fondo:"var(--accent-soft)",
    titulo:"Tienes respuesta en tu mini asesoría", texto:nuevas[nuevas.length-1].texto.slice(0,80)});
  misMensajesComunidad.filter(f=>f.respuesta && f.respondido_en && diasEntre(f.respondido_en.slice(0,10), hoy)<=30).forEach(f=>avisos.push({id:`resp-${f.id}-${f.respondido_en}`, tab:"Comunidad", ico:"💌", fondo:"var(--mint-soft)",
    titulo:"Han contestado tu mensaje", texto:f.respuesta.slice(0,80)}));
  return avisos;
}

function avisosVistos(){ try{ return JSON.parse(localStorage.getItem("avisosVistos")||"[]"); }catch(e){ return []; } }

// Novedades de la app (js/novedades.js): solo las que ya tienen texto, las más recientes primero.
function novedadesVisibles(){
  return (typeof NOVEDADES==="undefined" ? [] : NOVEDADES).filter(n=>n.texto && n.texto.trim())
    .slice().sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""));
}
function novedadesVistas(){ try{ return JSON.parse(localStorage.getItem("novedadesVistas")||"[]"); }catch(e){ return []; } }

function hayAvisosNuevos(){
  const vistos = new Set(avisosVistos()), nvistas = new Set(novedadesVistas());
  return avisosActuales().some(a=>!vistos.has(a.id)) || novedadesVisibles().some(n=>!nvistas.has(n.id));
}

function renderNotificaciones(){
  const avisos = avisosActuales();
  const vistos = new Set(avisosVistos());
  // Al abrir la pantalla quedan todos como vistos (se guardan solo los actuales, así la lista no crece).
  try{ localStorage.setItem("avisosVistos", JSON.stringify(avisos.map(a=>a.id))); }catch(e){}
  const novedades = novedadesVisibles();
  const nvistas = new Set(novedadesVistas());
  try{ localStorage.setItem("novedadesVistas", JSON.stringify(novedades.map(n=>n.id))); }catch(e){}
  return `
  <div class="hola">
    <div style="display:flex;align-items:center;gap:12px">
      <button class="icono-btn" id="btnVolverAvisos" aria-label="Volver"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
      <h1>Notificaciones</h1>
    </div>
  </div>
  ${avisos.length ? `<div class="list">
    ${avisos.map(a=>`
    <button class="fila aviso ${vistos.has(a.id)?"":"nuevo"}" data-ir-aviso="${esc(a.tab)}">
      <div class="ico" style="background:${a.fondo}">${a.ico}</div>
      <div class="txt"><b>${esc(a.titulo)}</b><div class="meta">${esc(a.texto)}</div></div>
      <svg class="flecha" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </button>`).join("")}
  </div>` : `<div class="card" style="text-align:center;padding:36px 18px">
    ${vacio("nube","¡Todo al día!","No tienes avisos pendientes.")}
  </div>`}
  ${novedades.length ? `<h3 class="titulo-novedades">Novedades de la app</h3>
  <div class="list">
    ${novedades.map(n=>`
    <button class="fila aviso novedad ${nvistas.has(n.id)?"":"nuevo"}" ${n.tab?`data-ir-aviso="${esc(n.tab)}"`:""}>
      <div class="ico" style="background:var(--accent-soft)">✨</div>
      <div class="txt">${n.titulo?`<b>${esc(n.titulo)}</b>`:""}<div class="meta">${esc(n.texto)}</div><div class="meta fecha-novedad">${esc(etiquetaDia(n.fecha))}</div></div>
      ${n.tab?`<svg class="flecha" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`:""}
    </button>`).join("")}
  </div>` : ""}`;
}

function wireEventosNotificaciones(){
  const volver = document.getElementById("btnVolverAvisos");
  if(volver) volver.onclick = ()=>{ tab = "Inicio"; render(); window.scrollTo(0,0); };
  document.querySelectorAll("[data-ir-aviso]").forEach(b=>b.onclick=()=>{ tab = b.dataset.irAviso; render(); window.scrollTo(0,0); });
}
