// Pestaña «Objetivos»: su render y sus eventos.

function renderObjetivos(){
  const pendientes = objetivos.filter(o=>!objetivoCompletado(o));
  const conseguidos = objetivos.length - pendientes.length;
  const metaPend = pendientes.reduce((s,o)=>sumarDinero(s, o.meta),0);
  const ahorradoPend = pendientes.reduce((s,o)=>sumarDinero(s, Math.min(Math.max(progresoObjetivo(o),0), o.meta)),0);
  const pctPend = metaPend>0 ? ahorradoPend/metaPend*100 : 0;
  const resumen = objetivos.length ? `
  <div class="card">
    <h2>Tus objetivos</h2>
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
    <div style="height:8px;background:var(--line);border-radius:999px;margin-top:6px;overflow:hidden"><div style="height:100%;width:${pctPend}%;background:var(--accent);border-radius:999px"></div></div>` : `<div class="meta" style="margin-top:12px">Todos tus objetivos están conseguidos.</div>`}
  </div>` : "";
  const enCurso = objetivos.filter(o=>!objetivoCompletado(o)).sort(porOrden);
  const completados = objetivos.filter(objetivoCompletado).sort(porOrden);
  const tarjeta = (o,k,n)=>{
    const actual = progresoObjetivo(o);
    const pct = o.meta>0 ? Math.min(actual/o.meta*100,100) : 0;
    const hecho = o.meta>0 && actual>=o.meta;
    const col = hecho ? "var(--pos)" : "var(--accent)";
    return `
    <div class="sort-item" data-sort-id="${o.id}"><div class="card"${hecho?' style="border-color:var(--pos)"':''}>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:14px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">${n>1? gripHtml() : ""}<h2 style="margin:0">${esc(o.nombre)}</h2></div>
          ${o.tipoVinculo!=="ninguno"?`<span class="tag">${nombreVinculo(o)}</span>`:`<span class="meta">Sin vincular: el progreso no se actualiza solo</span>`}
          <div style="font-size:14px;margin-top:8px"><strong>${eur(actual)}</strong> <span class="meta">de ${eur(o.meta)}</span></div>
          <div style="height:8px;background:var(--line);border-radius:999px;margin-top:8px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${col};border-radius:999px"></div>
          </div>
          <div class="meta" style="margin-top:6px;${hecho?'color:var(--pos);font-weight:700':''}">${hecho? "Objetivo conseguido" : `Te faltan ${eur(Math.max(restarDinero(o.meta, actual),0))}`}</div>
        </div>
        <div style="width:68px;height:68px;border-radius:50%;background:conic-gradient(${col} ${pct*3.6}deg, var(--line) 0);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <div style="width:52px;height:52px;border-radius:50%;background:var(--card);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px">${pct.toFixed(0)}%</div>
        </div>
      </div>
      ${o.autoActivo? `<div class="meta" style="margin-top:8px">Aporta ${eur(o.autoCuota)} el día ${o.autoDiaMes} de cada mes desde ${cuentaNombre(o.autoCuentaOrigen)}</div>` : ""}
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        ${(()=>{
          const invVinculo = o.tipoVinculo==="inversion" ? inversiones.find(i=>i.id===o.vinculoId) : null;
          const puedeAuto = o.tipoVinculo==="cuenta" || (o.tipoVinculo==="inversion" && invVinculo && !invVinculo.esGrupo);
          if(!puedeAuto) return "";
          return `<button class="btn ghost" data-toggle-auto-obj="${o.id}">${o.autoActivo?"Editar aportación automática":"Aportación automática"}</button>`;
        })()}
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
    </div></div>`;
  };
  return `
  <div class="card">
    <h2>Nuevo objetivo</h2>
    <form id="fObjetivo">
      <div class="row2">
        <div><label>Nombre</label><input name="nombre" placeholder="ej. Entrada de vivienda" required></div>
        <div><label>Meta (€)</label><input name="meta" type="number" step="0.01" min="0" required></div>
      </div>
      <label>Vincular a</label>
      <select name="tipoVinculo" id="objTipoVinculo">
        <option value="ninguno">Sin vincular (solo la meta)</option>
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
  ${objetivos.length ? "" : `<div class="card">${vacio("hucha","Tu hucha sueña con algo","Crea tu primer objetivo abajo: un viaje, un colchón o un capricho.")}</div>`}
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
  const fObjetivo = document.getElementById("fObjetivo");
  if(fObjetivo) fObjetivo.onsubmit = (e)=>{
    e.preventDefault();
    conCarga(fObjetivo.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const f = new FormData(fObjetivo);
      const tipoVinculo = f.get("tipoVinculo")||"ninguno";
      const data = {nombre:f.get("nombre"), meta:parseFloat(f.get("meta")), tipo_vinculo:tipoVinculo, vinculo_id: tipoVinculo==="ninguno"?null:(f.get("vinculoId")||null), orden:siguienteOrdenLista(objetivos)};
      const {error} = await sb.from("objetivos").insert(data);
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
