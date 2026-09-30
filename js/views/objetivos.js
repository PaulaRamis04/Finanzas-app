// Pestaña «Objetivos» (las huchas de ahorro): su render y sus eventos.

// Barra de 10 iconos del tema de la hucha que se van rellenando según lo ahorrado.
function barraHucha(o, pct, mini = false){
  const tema = TEMAS_HUCHA[temaObjetivo(o)];
  const llenos = Math.min(Math.max(pct,0),100)/10;
  return `<div class="hucha-barra${mini?" mini":""}" style="background:${tema.fondo}" role="img" aria-label="${pct.toFixed(0)}% ahorrado">${Array.from({length:10}, (_,i)=>{
    const parte = Math.min(Math.max(llenos-i,0),1);
    return `<span class="hucha-slot"><span class="hucha-vacio">${tema.icono}</span>${parte>0? `<span class="hucha-lleno" style="--i:${i};clip-path:inset(0 ${((1-parte)*100).toFixed(1)}% 0 0)">${tema.icono}</span>` : ""}</span>`;
  }).join("")}</div>`;
}

function selectorTemas(marcado){
  return `<div class="temas-hucha">${Object.entries(TEMAS_HUCHA).map(([k,t])=>
    `<label title="${t.nombre}"><input type="radio" name="tema" value="${k}"${k===marcado?" checked":""} aria-label="${t.nombre}"><span>${t.icono}</span></label>`).join("")}</div>`;
}

function renderObjetivos(){
  const pendientes = objetivos.filter(o=>!objetivoCompletado(o));
  const conseguidos = objetivos.length - pendientes.length;
  const metaPend = pendientes.reduce((s,o)=>sumarDinero(s, o.meta),0);
  const ahorradoPend = pendientes.reduce((s,o)=>sumarDinero(s, Math.min(Math.max(progresoObjetivo(o),0), o.meta)),0);
  const pctPend = metaPend>0 ? ahorradoPend/metaPend*100 : 0;
  const resumen = objetivos.length ? `
  <div class="card">
    <h2>Tus huchas</h2>
    <div class="balance" style="margin-top:6px">
      <div><div class="num">${pendientes.length}</div><div class="lbl">En curso</div></div>
      <div><div class="num pos">${conseguidos}</div><div class="lbl">Conseguidos</div></div>
      <div><div class="num">${eur(metaPend)}</div><div class="lbl">Meta total (en curso)</div></div>
    </div>
    ${pendientes.length? `
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-top:14px">
      <span class="meta">${eur(ahorradoPend)} de ${eur(metaPend)}</span>
      <strong style="font-size:15px">${pctPend.toFixed(0)}% de la meta</strong>
    </div>
    <div style="height:8px;background:var(--line);border-radius:999px;margin-top:6px;overflow:hidden"><div style="height:100%;width:${pctPend}%;background:var(--accent);border-radius:999px"></div></div>` : `<div class="meta" style="margin-top:12px">Todas tus huchas están llenas.</div>`}
  </div>` : "";
  const enCurso = objetivos.filter(o=>!objetivoCompletado(o)).sort(porOrden);
  const completados = objetivos.filter(objetivoCompletado).sort(porOrden);
  const tarjeta = (o,k,n)=>{
    const actual = progresoObjetivo(o);
    const pct = o.meta>0 ? Math.min(actual/o.meta*100,100) : 0;
    const hecho = o.meta>0 && actual>=o.meta;
    const col = hecho ? "var(--pos)" : "var(--accent)";
    const tema = TEMAS_HUCHA[temaObjetivo(o)];
    const manual = o.tipoVinculo==="ninguno";
    return `
    <div class="sort-item" data-sort-id="${o.id}"><div class="card"${hecho?' style="border-color:var(--pos)"':''}>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:14px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">${n>1? gripHtml() : ""}<span class="hucha-icono" style="background:${tema.fondo}">${tema.icono}</span><div style="min-width:0"><h2 style="margin:0">${esc(o.nombre)}</h2>
          ${!manual?`<span class="tag">${nombreVinculo(o)}</span>`:`<span class="meta">Hucha manual: añade lo que vayas guardando</span>`}</div></div>
          <div style="font-size:14px;margin-top:8px"><strong>${eur(actual)}</strong> <span class="meta">de ${eur(o.meta)}</span></div>
        </div>
        <div style="width:68px;height:68px;border-radius:50%;background:conic-gradient(${col} ${pct*3.6}deg, var(--line) 0);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <div style="width:52px;height:52px;border-radius:50%;background:var(--card);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px">${pct.toFixed(0)}%</div>
        </div>
      </div>
      ${barraHucha(o, pct)}
      <div class="meta" style="margin-top:6px;${hecho?'color:var(--pos);font-weight:700':''}">${hecho? "¡Hucha llena! Objetivo conseguido" : `Te faltan ${eur(Math.max(restarDinero(o.meta, actual),0))}`}</div>
      ${o.autoActivo? `<div class="meta" style="margin-top:8px">Aporta ${eur(o.autoCuota)} el día ${o.autoDiaMes} de cada mes desde ${cuentaNombre(o.autoCuentaOrigen)}</div>` : ""}
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        ${(()=>{
          const invVinculo = o.tipoVinculo==="inversion" ? inversiones.find(i=>i.id===o.vinculoId) : null;
          const puedeAuto = o.tipoVinculo==="cuenta" || (o.tipoVinculo==="inversion" && invVinculo && !invVinculo.esGrupo);
          if(!puedeAuto) return "";
          return `<button class="btn ghost" data-toggle-auto-obj="${o.id}">${o.autoActivo?"Editar aportación automática":"Aportación automática"}</button>`;
        })()}
        ${manual? `<button class="btn ghost" data-meter-hucha="${o.id}">Añadir o sacar</button>` : ""}
        ${temaObjetivo(o)==="casa"? `<button class="btn ghost" data-ir-tab="Vivienda">Simular vivienda</button>` : ""}
        <button class="btn ghost" data-tema-hucha="${o.id}">Cambiar icono</button>
        <button class="btn ghost" data-del-objetivo="${o.id}">Borrar</button>
      </div>
      ${editarAutoObjId===o.id? `
      <div class="item" style="flex-direction:column;align-items:stretch;gap:8px;margin-top:10px">
        <label>Cuota mensual (€)</label>
        <input type="number" step="0.01" min="0.01" id="autoObjCuota" value="${o.autoCuota||''}">
        <label>Día del mes</label>
        <input type="number" min="1" max="28" id="autoObjDia" value="${o.autoDiaMes||1}">
        <label>Cuenta de origen</label>
        <select id="autoObjCuenta">${opcionesCuentas(o.autoCuentaOrigen || cuentaPorDefecto())}</select>
        <p class="meta" style="margin:0">Cada mes se ${o.tipoVinculo==="cuenta"?"transfiere":"aporta"} esa cantidad desde esta cuenta a "${esc(o.nombre)}", sin que tengas que hacerlo tú.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" data-confirmar-auto-obj="${o.id}">Guardar y activar</button>
          ${o.autoActivo? `<button class="btn ghost" data-desactivar-auto-obj="${o.id}">Desactivar</button>` : ""}
          <button class="btn ghost" data-cancelar-auto-obj="1">Cancelar</button>
        </div>
      </div>` : ""}
      ${huchaMeterId===o.id? `
      <div class="item" style="flex-direction:column;align-items:stretch;gap:8px;margin-top:10px">
        <label for="huchaImporte">Importe (€)</label>
        <input type="number" step="0.01" min="0.01" id="huchaImporte" inputmode="decimal">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" data-hucha-mover="${o.id}" data-signo="1">Echar a la hucha</button>
          <button class="btn ghost" data-hucha-mover="${o.id}" data-signo="-1">Sacar</button>
          <button class="btn ghost" data-cancelar-hucha="1">Cancelar</button>
        </div>
      </div>` : ""}
      ${huchaTemaId===o.id? `
      <div class="item" style="flex-direction:column;align-items:stretch;gap:4px;margin-top:10px">
        <label>Elige el icono de la hucha</label>
        <div class="temas-hucha">${Object.entries(TEMAS_HUCHA).map(([k,t])=>
          `<button type="button" class="${k===temaObjetivo(o)?"activo":""}" data-elegir-tema="${k}" data-obj="${o.id}" title="${t.nombre}" aria-label="${t.nombre}">${t.icono}</button>`).join("")}</div>
      </div>` : ""}
    </div></div>`;
  };
  return `
  <div class="card">
    <h2>Nueva hucha</h2>
    <form id="fObjetivo">
      <div class="row2">
        <div><label>Nombre</label><input name="nombre" placeholder="ej. Viaje a Japón" required></div>
        <div><label>Meta (€)</label><input name="meta" type="number" step="0.01" min="0" required></div>
      </div>
      <label>Icono <span class="meta">(si no eliges, lo pongo según el nombre)</span></label>
      ${selectorTemas(null)}
      <label>¿Dónde está el dinero?</label>
      <select name="tipoVinculo" id="objTipoVinculo">
        <option value="ninguno">Hucha manual (lo añado yo)</option>
        <option value="cuenta">Una cuenta</option>
        <option value="inversion">Una inversión o grupo</option>
      </select>
      <div id="objVinculoWrap" style="display:none">
        <label>Elige cuál</label>
        <select name="vinculoId" id="objVinculoSelect"></select>
      </div>
      <button class="btn" type="submit">Añadir</button>
    </form>
  </div>
  ${resumen}
  ${completados.length && enCurso.length ? `<div class="section-title">En curso (${enCurso.length})</div>` : ""}
  ${enCurso.length ? `<div data-sortable="ordenar_objetivos">${enCurso.map((o,k)=>tarjeta(o,k,enCurso.length)).join("")}</div>` : ""}
  ${completados.length ? `<div class="section-title">Completados (${completados.length})</div><div data-sortable="ordenar_objetivos">${completados.map((o,k)=>tarjeta(o,k,completados.length)).join("")}</div>` : ""}
  ${objetivos.length ? "" : `<div class="card">${vacio("hucha","Tu hucha sueña con algo","Crea tu primera hucha arriba: un viaje, un concierto o un fondo para imprevistos.")}</div>`}
`;
}

function wireEventosObjetivos(){
  const objTipoVinculo = document.getElementById("objTipoVinculo");
  const objVinculoWrap = document.getElementById("objVinculoWrap");
  const objVinculoSelect = document.getElementById("objVinculoSelect");
  if(objTipoVinculo && objVinculoWrap){
    const toggleObj = ()=>{
      const v = objTipoVinculo.value;
      objVinculoWrap.style.display = v==="ninguno" ? "none" : "block";
      if(objVinculoSelect){
        if(v==="cuenta") objVinculoSelect.innerHTML = opcionesCuentas();
        else if(v==="inversion") objVinculoSelect.innerHTML = inversiones.map(i=>`<option value="${i.id}">${esc(i.nombre)}${i.esGrupo?" (grupo)":""}</option>`).join("");
      }
    };
    toggleObj(); objTipoVinculo.onchange = toggleObj;
  }
  document.querySelectorAll("[data-toggle-auto-obj]").forEach(b=>b.onclick=()=>{ editarAutoObjId = b.dataset.toggleAutoObj; pendienteEnfoque = "autoObjCuota"; render(); });
  document.querySelectorAll("[data-cancelar-auto-obj]").forEach(b=>b.onclick=()=>{ editarAutoObjId = null; render(); });
  document.querySelectorAll("[data-confirmar-auto-obj]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
    const id = b.dataset.confirmarAutoObj;
    const cuota = parseFloat(document.getElementById("autoObjCuota")?.value);
    const dia = Math.min(Math.max(parseInt(document.getElementById("autoObjDia")?.value,10)||1,1),28);
    const cuentaOrigen = document.getElementById("autoObjCuenta")?.value;
    if(isNaN(cuota) || cuota<=0 || !cuentaOrigen){ showError("Pon una cuota y una cuenta de origen válidas."); return; }
    const {error} = await sb.from("objetivos").update({auto_activo:true, auto_cuota:cuota, auto_dia_mes:dia, auto_cuenta_origen:cuentaOrigen}).eq("id", id);
    if(error){ showError("No se pudo guardar: "+error.message); return; }
    hideError(); editarAutoObjId = null; await recargar(["objetivos","movimientos"], {procesar:true});
  }));
  document.querySelectorAll("[data-desactivar-auto-obj]").forEach(b=>b.onclick=()=>conCarga(b, "…", async ()=>{
    const {error} = await sb.from("objetivos").update({auto_activo:false}).eq("id", b.dataset.desactivarAutoObj);
    if(error){ showError("No se pudo desactivar: "+error.message); return; }
    hideError(); editarAutoObjId = null; await recargar(["objetivos"]);
  }));
  document.querySelectorAll("[data-meter-hucha]").forEach(b=>b.onclick=()=>{ huchaMeterId = huchaMeterId===b.dataset.meterHucha ? null : b.dataset.meterHucha; huchaTemaId = null; pendienteEnfoque = "huchaImporte"; render(); });
  document.querySelectorAll("[data-cancelar-hucha]").forEach(b=>b.onclick=()=>{ huchaMeterId = null; render(); });
  document.querySelectorAll("[data-hucha-mover]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
    const o = objetivos.find(x=>x.id===b.dataset.huchaMover);
    const importe = parseFloat(document.getElementById("huchaImporte")?.value);
    if(!o || isNaN(importe) || importe<=0){ showError("Pon un importe mayor que 0."); return; }
    const sacar = b.dataset.signo==="-1";
    if(sacar && importe>(o.ahorrado||0)){ showError(`En esta hucha solo hay ${eur(o.ahorrado||0)}.`); return; }
    const ahorrado = sacar ? restarDinero(o.ahorrado||0, importe) : sumarDinero(o.ahorrado||0, importe);
    const {error} = await sb.from("objetivos").update({ahorrado}).eq("id", o.id);
    if(error){ showError(errorColumnaHucha(error) || "No se pudo guardar: "+error.message); return; }
    hideError(); huchaMeterId = null; await recargar(["objetivos"]);
  }));
  document.querySelectorAll("[data-tema-hucha]").forEach(b=>b.onclick=()=>{ huchaTemaId = huchaTemaId===b.dataset.temaHucha ? null : b.dataset.temaHucha; huchaMeterId = null; render(); });
  document.querySelectorAll("[data-elegir-tema]").forEach(b=>b.onclick=()=>conCarga(b, "…", async ()=>{
    const {error} = await sb.from("objetivos").update({tema:b.dataset.elegirTema}).eq("id", b.dataset.obj);
    if(error){ showError(errorColumnaHucha(error) || "No se pudo cambiar el icono: "+error.message); return; }
    hideError(); huchaTemaId = null; await recargar(["objetivos"]);
  }));
  const fObjetivo = document.getElementById("fObjetivo");
  if(fObjetivo) fObjetivo.onsubmit = (e)=>{
    e.preventDefault();
    conCarga(fObjetivo.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const f = new FormData(fObjetivo);
      const tipoVinculo = f.get("tipoVinculo")||"ninguno";
      const data = {nombre:f.get("nombre"), meta:parseFloat(f.get("meta")), tipo_vinculo:tipoVinculo, vinculo_id: tipoVinculo==="ninguno"?null:(f.get("vinculoId")||null), orden:siguienteOrdenLista(objetivos),
        tema: f.get("tema") || temaPorNombre(f.get("nombre"))};
      let {error} = await sb.from("objetivos").insert(data);
      // Si aún no existe la columna «tema» en la base de datos, se guarda sin ella (el icono sale del nombre).
      if(error && errorColumnaHucha(error)){ delete data.tema; ({error} = await sb.from("objetivos").insert(data)); }
      if(error){ showError("No se pudo guardar el objetivo: "+error.message); return; }
      hideError(); fObjetivo.reset(); await recargar(["objetivos"]);
    });
  };
  document.querySelectorAll("[data-del-objetivo]").forEach(b=>b.onclick=async ()=>{
    if(!(await confirmar("¿Borrar este objetivo?"))) return;
    conCarga(b, "Borrando…", async ()=>{
      const {error} = await sb.from("objetivos").delete().eq("id", b.dataset.delObjetivo);
      if(error){ showError("No se pudo borrar: "+error.message); return; }
      hideError(); await recargar(["objetivos"]);
    });
  });
}

// Mensaje claro si faltan las columnas de las huchas (schema_huchas.sql sin ejecutar).
function errorColumnaHucha(error){
  return /\b(tema|ahorrado)\b/.test(error?.message||"") ? "Falta actualizar la base de datos para las huchas (schema_huchas.sql)." : "";
}
