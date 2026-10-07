// Pestaña «Inmuebles»: casa, garaje, local… con lo que valen, la hipoteca que queda y la renta que dan.
// Cuentan en el patrimonio por su valor menos la hipoteca. Cada cambio de valor o de hipoteca se apunta
// en su historial, así el patrimonio de meses pasados usa el valor que tenían entonces.
// Se guardan en la tabla «inmuebles» (schema_inmuebles.sql); sin ella, en este dispositivo.

let inmueblesEnBd = false, editarInmuebleId = null;

const TIPOS_INMUEBLE = [
  {id:"vivienda", icono:"🏠", nombre:"Casa o piso"},
  {id:"garaje", icono:"🚗", nombre:"Garaje"},
  {id:"local", icono:"🏪", nombre:"Local"},
  {id:"trastero", icono:"📦", nombre:"Trastero"},
  {id:"terreno", icono:"🌳", nombre:"Terreno"},
  {id:"otro", icono:"🏢", nombre:"Otro"}
];
const tipoInmueble = id=>TIPOS_INMUEBLE.find(t=>t.id===id) || TIPOS_INMUEBLE[TIPOS_INMUEBLE.length-1];

function leerInmueblesLocal(){ try{ const l = JSON.parse(localStorage.getItem("inmuebles")||"[]"); return Array.isArray(l) ? l : []; }catch(e){ return []; } }

function fijarInmuebles(d){
  inmueblesEnBd = !!d.ok;
  inmuebles = (inmueblesEnBd ? d.filas : leerInmueblesLocal()).map(i=>{
    const valor = Number(i.valor)||0, hipoteca = Number(i.hipoteca)||0;
    const historial = (Array.isArray(i.historial) ? i.historial : [])
      .map(h=>({fecha:h.fecha, valor:Number(h.valor)||0, hipoteca:Number(h.hipoteca)||0})).filter(h=>h.fecha).sort((a,b)=>a.fecha.localeCompare(b.fecha));
    if(!historial.length) historial.push({fecha:String(i.creado||"").slice(0,10) || today(), valor, hipoteca});
    return {id:i.id, nombre:i.nombre, tipo:i.tipo||"vivienda", valor, hipoteca, renta:Number(i.renta_mensual)||0,
      precioCompra:i.precio_compra!=null && i.precio_compra!=="" ? Number(i.precio_compra) : null, historial, orden:i.orden||0};
  }).sort(porOrden);
}

// Lo que se guarda (en la tabla o en el dispositivo), con los nombres de las columnas.
const filaInmueble = i=>({id:i.id, nombre:i.nombre, tipo:i.tipo, valor:i.valor, hipoteca:i.hipoteca, renta_mensual:i.renta,
  precio_compra:i.precioCompra, historial:i.historial, orden:i.orden||0});

function nuevoIdInmueble(){
  try{ if(crypto.randomUUID) return crypto.randomUUID(); }catch(e){}
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c=>(c ^ Math.random()*16 >> c/4).toString(16));
}

// op: "crear" | "cambiar" | "borrar". Devuelve el error de Supabase o null.
async function guardarInmueble(op, inm){
  if(inmueblesEnBd){
    const fila = filaInmueble(inm);
    const {error} = op==="crear" ? await sb.from("inmuebles").insert(fila)
      : op==="cambiar" ? await sb.from("inmuebles").update(fila).eq("id", inm.id)
      : await sb.from("inmuebles").delete().eq("id", inm.id);
    if(error) return error;
    await recargar(["inmuebles"]);
    return null;
  }
  const lista = inmuebles.filter(i=>i.id!==inm.id);
  if(op!=="borrar") lista.push(inm);
  try{ localStorage.setItem("inmuebles", JSON.stringify(lista.map(filaInmueble))); }catch(e){}
  fijarInmuebles({ok:false});
  render();
  return null;
}

// Apunta el valor y la hipoteca de hoy en el historial (si ya había una entrada de hoy, la sustituye).
function conHistorialHoy(historial, valor, hipoteca){
  const ultimo = historial[historial.length-1];
  if(ultimo && ultimo.valor===valor && ultimo.hipoteca===hipoteca) return historial;
  return [...historial.filter(h=>h.fecha!==today()), {fecha:today(), valor, hipoteca}];
}

const pctTexto = n=>`${n>=0?"+":"-"}${Math.abs(n).toFixed(1).replace(".",",")} %`;

function tarjetaInmueble(i, k){
  const t = tipoInmueble(i.tipo);
  const neto = netoInmueble(i);
  const tuyo = i.valor>0 ? Math.max(0, Math.min(neto/i.valor*100, 100)) : 0;
  const previo = i.historial.length>1 ? i.historial[i.historial.length-2] : null;
  const cambio = previo && previo.valor!==i.valor ? restarDinero(i.valor, previo.valor) : null;
  const revalorizacion = i.precioCompra>0 ? (i.valor-i.precioCompra)/i.precioCompra*100 : null;
  const rentabilidad = i.renta>0 && i.valor>0 ? i.renta*12/i.valor*100 : null;
  const editando = editarInmuebleId===i.id;
  return `
  <div class="card cuenta-tarjeta" style="--fondo-cuenta:${FONDOS_CUENTA[k%FONDOS_CUENTA.length]}">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
      <div style="display:flex;align-items:center;gap:12px;min-width:0">
        <div style="width:44px;height:44px;border-radius:50%;background:var(--card);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0" aria-hidden="true">${t.icono}</div>
        <div style="min-width:0"><strong style="font-size:16px">${esc(i.nombre)}</strong><div class="meta">${t.nombre}</div></div>
      </div>
      <div style="text-align:right">
        <div style="font-size:19px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap">${eur(i.valor)}</div>
        ${cambio!==null ? `<div class="meta ${cambio>=0?"pos":"neg"}" style="white-space:nowrap">${cambio>=0?"▲":"▼"} ${eur(Math.abs(cambio))}</div>` : ""}
      </div>
    </div>
    <div class="list" style="margin-top:12px;gap:4px">
      ${i.hipoteca>0 ? `<div class="meta">Hipoteca pendiente: <b class="neg">${eur(i.hipoteca)}</b></div>` : `<div class="meta">Sin hipoteca</div>`}
      <div class="meta">Tu parte: <b>${eur(neto)}</b>${i.hipoteca>0 ? ` · ya es tuyo el ${Math.floor(tuyo)} %` : ""}</div>
      ${i.hipoteca>0 ? `<div class="barra" style="margin:4px 0"><div style="width:${tuyo}%;background:var(--accent)"></div></div>` : ""}
      ${i.renta>0 ? `<div class="meta">Renta: <b class="pos">${eur(i.renta)}</b> al mes · ${eur(i.renta*12)} al año${rentabilidad!==null ? ` · rentabilidad bruta ${rentabilidad.toFixed(1).replace(".",",")} %` : ""}</div>` : ""}
      ${revalorizacion!==null ? `<div class="meta">Desde la compra (${eur(i.precioCompra)}): <span class="${revalorizacion>=0?"pos":"neg"}">${pctTexto(revalorizacion)}</span></div>` : ""}
      ${previo ? `<div class="meta">Último cambio: ${fechaHito(i.historial[i.historial.length-1].fecha)}</div>` : ""}
    </div>
    <div class="chips" style="margin-top:14px">
      ${editando ? "" : `<button class="chip" data-editar-inmueble="${i.id}">Actualizar valor</button>`}
      <button class="chip peligro" data-del-inmueble="${i.id}">Borrar</button>
    </div>
    ${editando ? `
    <form id="fEditarInmueble" data-id="${i.id}" style="display:flex;flex-direction:column;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)">
      ${camposInmueble(i, "ed")}
      <div style="display:flex;gap:8px">
        <button class="btn" type="submit">Guardar</button>
        <button class="btn ghost" type="button" data-cancelar-inmueble="1">Cancelar</button>
      </div>
      ${i.historial.length>1 ? `
      <div class="meta" style="font-weight:700;margin-top:6px">Historial</div>
      ${[...i.historial].reverse().map(h=>`<div class="meta" style="display:flex;justify-content:space-between;gap:8px"><span>${fechaHito(h.fecha)}</span><span>${eur(h.valor)}${h.hipoteca>0 ? ` · hipoteca ${eur(h.hipoteca)}` : ""}</span></div>`).join("")}` : ""}
    </form>` : ""}
  </div>`;
}

// Campos del formulario de alta y del de editar (pre = prefijo de los id).
function camposInmueble(i, pre){
  const v = (x)=>x==null ? "" : x;
  return `
    <div class="row2">
      <div><label for="${pre}InmNombre">Nombre</label><input id="${pre}InmNombre" name="nombre" placeholder="ej. Piso de la playa" value="${esc(v(i?.nombre))}" required></div>
      <div><label for="${pre}InmTipo">Tipo</label><select id="${pre}InmTipo" name="tipo">${TIPOS_INMUEBLE.map(t=>`<option value="${t.id}"${(i?.tipo||"vivienda")===t.id?" selected":""}>${t.icono} ${t.nombre}</option>`).join("")}</select></div>
    </div>
    <div class="row2">
      <div><label for="${pre}InmValor">Valor actual (${simboloMoneda()})</label><input id="${pre}InmValor" name="valor" type="number" step="0.01" min="0" value="${v(i?.valor)}" required></div>
      <div><label for="${pre}InmHipoteca">Hipoteca pendiente (${simboloMoneda()})</label><input id="${pre}InmHipoteca" name="hipoteca" type="number" step="0.01" min="0" value="${v(i ? i.hipoteca : 0)}"></div>
    </div>
    <div class="row2">
      <div><label for="${pre}InmRenta">Renta al mes (${simboloMoneda()})</label><input id="${pre}InmRenta" name="renta" type="number" step="0.01" min="0" value="${v(i ? i.renta : 0)}"></div>
      <div><label for="${pre}InmCompra">Precio de compra (opcional)</label><input id="${pre}InmCompra" name="precioCompra" type="number" step="0.01" min="0" value="${v(i?.precioCompra)}"></div>
    </div>`;
}

function leerFormInmueble(form){
  const f = new FormData(form);
  const num = k=>{ const n = parseFloat(f.get(k)); return isNaN(n) ? 0 : Math.round(n*100)/100; };
  const compra = parseFloat(f.get("precioCompra"));
  return {nombre:String(f.get("nombre")||"").trim(), tipo:f.get("tipo")||"vivienda", valor:num("valor"), hipoteca:num("hipoteca"), renta:num("renta"),
    precioCompra:isNaN(compra) || compra<=0 ? null : Math.round(compra*100)/100};
}

function renderInmuebles(){
  const total = sumaImportes(inmuebles, i=>i.valor);
  const hipotecas = sumaImportes(inmuebles, i=>i.hipoteca);
  const rentas = sumaImportes(inmuebles, i=>i.renta);
  const resumen = inmuebles.length ? `
  <div class="card">
    <div class="meta" style="font-weight:600">Valor de tus inmuebles</div>
    <div style="font-size:34px;font-weight:800;letter-spacing:-0.02em;font-variant-numeric:tabular-nums;margin-top:2px">${eur(total)}</div>
    <div class="list" style="margin-top:10px;gap:4px">
      ${hipotecas>0 ? `<div class="meta">Hipotecas pendientes: <b class="neg">${eur(hipotecas)}</b></div>` : ""}
      <div class="meta">Tu parte (suma a tu patrimonio): <b>${eur(netoInmuebles())}</b></div>
      ${rentas>0 ? `<div class="meta">Rentas: <b class="pos">${eur(rentas)}</b> al mes · ${eur(rentas*12)} al año</div>` : ""}
    </div>
  </div>` : "";
  return `
  ${resumen}
  ${inmuebles.length ? inmuebles.map(tarjetaInmueble).join("") : `<div class="card">${vacio("hucha","Aún no tienes inmuebles","Añade tu casa, un garaje o un local y suma lo que es tuyo a tu patrimonio.")}</div>`}
  <div class="card">
    <h2>Añadir inmueble</h2>
    <form id="fInmueble" style="display:flex;flex-direction:column;gap:8px">
      ${camposInmueble(null, "nuevo")}
      <button class="btn" type="submit">Añadir</button>
    </form>
    <p class="meta" style="margin:10px 0 0">Cuenta en tu patrimonio por su valor menos la hipoteca que queda. Si la hipoteca ya la tienes apuntada en Deudas, ponla aquí a 0 para no restarla dos veces. La renta es informativa: lo que cobres apúntalo como ingreso en tu cuenta.</p>
  </div>`;
}

function wireEventosInmuebles(){
  const fNuevo = document.getElementById("fInmueble");
  if(fNuevo) fNuevo.onsubmit = e=>{
    e.preventDefault();
    conCarga(fNuevo.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const d = leerFormInmueble(fNuevo);
      if(!d.nombre) return;
      const error = await guardarInmueble("crear", {...d, id:nuevoIdInmueble(), orden:siguienteOrdenLista(inmuebles), historial:[{fecha:today(), valor:d.valor, hipoteca:d.hipoteca}]});
      if(error){ showError("No se pudo guardar el inmueble: "+error.message); return; }
      hideError();
    });
  };
  const fEd = document.getElementById("fEditarInmueble");
  if(fEd) fEd.onsubmit = e=>{
    e.preventDefault();
    const i = inmuebles.find(x=>x.id===fEd.dataset.id);
    if(!i) return;
    conCarga(fEd.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const d = leerFormInmueble(fEd);
      if(!d.nombre) return;
      const error = await guardarInmueble("cambiar", {...i, ...d, historial:conHistorialHoy(i.historial, d.valor, d.hipoteca)});
      if(error){ showError("No se pudo guardar el inmueble: "+error.message); return; }
      hideError(); editarInmuebleId = null; render();
    });
  };
  document.querySelectorAll("[data-editar-inmueble]").forEach(b=>b.onclick=()=>{ editarInmuebleId = b.dataset.editarInmueble; pendienteEnfoque = "edInmValor"; render(); });
  document.querySelectorAll("[data-cancelar-inmueble]").forEach(b=>b.onclick=()=>{ editarInmuebleId = null; render(); });
  document.querySelectorAll("[data-del-inmueble]").forEach(b=>b.onclick=async ()=>{
    const i = inmuebles.find(x=>x.id===b.dataset.delInmueble);
    if(!i || !(await confirmar("¿Borrar este inmueble? Dejará de contar en tu patrimonio, también en los meses pasados."))) return;
    conCarga(b, "Borrando…", async ()=>{
      const error = await guardarInmueble("borrar", i);
      if(error){ showError("No se pudo borrar: "+error.message); return; }
      hideError(); if(editarInmuebleId===i.id) editarInmuebleId = null;
    });
  });
}
