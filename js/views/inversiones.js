// Pestaña «Inversiones»: su render y sus eventos.

function renderListaAportaciones(inv){
  const apo = aportaciones.filter(a=>a.inversionId===inv.id).map(a=>({...a, mov:"aportacion"}));
  const ret = retiros.filter(r=>r.inversionId===inv.id).map(r=>({...r, mov:"retiro"}));
  const lista = [...apo, ...ret].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  return `
  <div style="padding:0 4px 10px">
    ${lista.length? lista.map(x=>`
      <div class="item" style="padding:8px 10px;margin-bottom:6px">
        <div><span class="tag">${x.fecha}</span><div class="meta">${x.mov==="aportacion"?"Aportación":"Rescate"} · ${cuentaNombre(x.cuentaId)}</div></div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="amt ${x.mov==='aportacion'?'pos':'neg'}">${x.mov==="aportacion"?"+":"-"}${eur(x.importe)}</div>
          <button class="btn ghost" data-del-${x.mov==="aportacion"?"aportacion":"retiro"}="${x.id}">Borrar</button>
        </div>
      </div>`).join("") : `<div class="empty">Sin movimientos registrados.</div>`}
  </div>`;
}

function opcionesGrupos(selectedId){
  return grupos().map(g=>`<option value="${g.id}"${g.id===selectedId?" selected":""}>${esc(g.nombre)}</option>`).join("");
}

function grupoItem(g, conGrip){
  const abierto = !!gruposAbiertos[g.id];
  const hs = hijosDe(g);
  const val = valorGrupo(g);
  const ben = beneficioGrupo(g);
  const rG = rentasGrupo(g);
  const cab = `
  <div class="item" data-toggle-grupo="${g.id}" style="cursor:pointer;background:var(--accent-soft);border-color:transparent">
    <div style="display:flex;align-items:center;gap:10px;min-width:0">
      ${conGrip? gripHtml() : ""}
      <div>
        <strong>${abierto?"▾":"▸"} ${esc(g.nombre)}</strong>
        <span class="tag" style="background:var(--card)">${hs.length} inversion${hs.length===1?"":"es"}</span>
        <div class="meta">Beneficio: <span class="${ben>=0?'pos':'neg'}">${eur(ben)}</span>${rG>0?` · Rentas: <span class="pos">${eur(rG)}</span>`:""}</div>
      </div>
    </div>
    <div class="amt">${eur(val)}</div>
  </div>`;
  if(!abierto) return cab;
  return cab + `
  <div style="margin:2px 0 6px 12px;padding-left:10px;border-left:2px solid var(--accent-soft);display:flex;flex-direction:column;gap:8px">
    ${hs.length? `<div data-sortable="ordenar_inversiones" style="display:flex;flex-direction:column;gap:8px">${hs.map(h=>sortItem(h.id, invItem(h, hs.length>1))).join("")}</div>` : `<div class="empty" style="padding:14px">Grupo vacío. Asigna inversiones desde "Editar información".</div>`}
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${editarInfoInvId!==g.id?`<button class="btn ghost" data-editar-info="${g.id}">Renombrar grupo</button>`:""}
      <button class="btn ghost" data-del-inv="${g.id}">Borrar grupo</button>
    </div>
    ${editarInfoInvId===g.id? `<div class="item" style="flex-direction:column;align-items:stretch;gap:8px"><label>Nombre</label><input id="infoNombre" value="${esc(g.nombre)}"><div style="display:flex;gap:8px"><button class="btn" data-confirmar-info="${g.id}">Guardar</button><button class="btn ghost" data-cancelar-info="1">Cancelar</button></div></div>` : ""}
  </div>`;
}

function invItem(inv, conGrip){
  if(inv.esGrupo) return grupoItem(inv, conGrip);
  const esActiva = inv.estado === "activa";
  const aportado = aportadoInv(inv);
  const beneficio = beneficioInv(inv);
  const expandida = expandidaInvId === inv.id;

  const cabecera = `
  <div class="item" data-expandir-inv="${inv.id}" style="cursor:pointer">
    <div style="display:flex;align-items:center;gap:10px;min-width:0">
      ${conGrip? gripHtml() : ""}
      <div>
        <strong>${esc(inv.nombre)}</strong>
        ${inv.tipo?`<span class="tag">${esc(inv.tipo)}</span>`:""}
        ${!esActiva?`<span class="tag">Planificada</span>`:""}
      </div>
    </div>
    <div class="amt">${esActiva? eur(inv.valorActual) : "—"}</div>
  </div>`;

  if(!expandida) return cabecera;

  return cabecera + `
  <div style="padding:0 4px 6px">
    ${esActiva? `<div class="meta">Aportado: ${eur(aportado)}</div>` : `<div class="meta">Sin aportar todavía — no cuenta en tu patrimonio</div>`}
    ${!esActiva && (inv.fechaPrevista||inv.importePrevisto)? `<div class="meta">Previsto: ${inv.importePrevisto?eur(inv.importePrevisto):"—"}${inv.fechaPrevista?` el ${inv.fechaPrevista}`:""}${inv.cuentaPrevistaId?` desde ${cuentaNombre(inv.cuentaPrevistaId)}`:""}</div>` : ""}
    ${esActiva? `<div class="meta">Beneficio: <span class="${beneficio>=0?'pos':'neg'}">${eur(beneficio)}</span></div>` : ""}
    ${esActiva? `<div class="meta">Rentas: <span class="pos">${eur(inv.rentas||0)}</span> · solo recuento, no afecta al valor</div>` : ""}
  </div>
  <div style="display:flex;gap:8px;padding:0 4px 8px;flex-wrap:wrap">
    ${aportarInvId!==inv.id?`<button class="btn gold" data-aportar-inv="${inv.id}">Aportar</button>`:""}
    ${esActiva && inv.valorActual>0 && rescatarInvId!==inv.id?`<button class="btn ghost" data-rescatar-inv="${inv.id}">Rescatar</button>`:""}
    ${esActiva && editarValorInvId!==inv.id?`<button class="btn ghost" data-editar-valor="${inv.id}">Actualizar valor</button>`:""}
    ${esActiva && rentasInvId!==inv.id?`<button class="btn ghost" data-rentas-inv="${inv.id}">Anotar rentas</button>`:""}
    ${aportado>0 || esActiva ? `<button class="btn ghost" data-ver-aportaciones="${inv.id}">${verAportacionesId===inv.id?"Ocultar aportaciones":"Ver aportaciones"}</button>` : ""}
    ${editarInfoInvId!==inv.id?`<button class="btn ghost" data-editar-info="${inv.id}">Editar información</button>`:""}
    <button class="btn ghost" data-del-inv="${inv.id}">Borrar</button>
  </div>
  ${verAportacionesId===inv.id? renderListaAportaciones(inv) : ""}
  ${aportarInvId===inv.id? `
  <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
    <label>Importe a aportar (${simboloMoneda()})</label>
    <input type="number" step="0.01" min="0.01" id="aportarImporte" value="${inv.importePrevisto||''}">
    <label>Cuenta de origen</label>
    ${cuentasActivas().length? `<select id="aportarCuenta">${opcionesCuentas(inv.cuentaPrevistaId)}</select>` : `<div class="meta">Crea antes una cuenta en la pestaña "Cuentas".</div>`}
    <div style="display:flex;gap:8px">
      <button class="btn" data-confirmar-aportar="${inv.id}" ${cuentasActivas().length?"":"disabled"}>Confirmar</button>
      <button class="btn ghost" data-cancelar-aportar="1">Cancelar</button>
    </div>
  </div>` : ""}
  ${rescatarInvId===inv.id? `
  <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
    <label>Importe a rescatar (${simboloMoneda()}) — máximo ${eur(inv.valorActual)}</label>
    <input type="number" step="0.01" min="0.01" max="${inv.valorActual}" id="rescatarImporte">
    <label>Cuenta destino</label>
    ${cuentasActivas().length? `<select id="rescatarCuenta">${opcionesCuentas()}</select>` : `<div class="meta">Crea antes una cuenta en la pestaña "Cuentas".</div>`}
    <div style="display:flex;gap:8px">
      <button class="btn" data-confirmar-rescate="${inv.id}" ${cuentasActivas().length?"":"disabled"}>Confirmar</button>
      <button class="btn ghost" data-cancelar-rescate="1">Cancelar</button>
    </div>
  </div>` : ""}
  ${rentasInvId===inv.id? `
  <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
    <label>Cantidad (${simboloMoneda()})</label>
    <input type="number" step="0.01" id="rentasImporte">
    <p class="meta" style="margin:0">Llevas ${eur(inv.rentas||0)} en rentas. Es solo un recuento: no cambia el valor de la inversión, ni el patrimonio, ni crea movimientos. Para corregir un error, suma una cantidad negativa o fija el total.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" data-sumar-rentas="${inv.id}">Sumar</button>
      <button class="btn gold" data-fijar-rentas="${inv.id}">Fijar total</button>
      <button class="btn ghost" data-cancelar-rentas="1">Cancelar</button>
    </div>
  </div>` : ""}
  ${editarValorInvId===inv.id? `
  <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
    <label>Nuevo valor actual (${simboloMoneda()})</label>
    <input type="number" step="0.01" id="valorNuevo" value="${inv.valorActual}">
    <div style="display:flex;gap:8px">
      <button class="btn" data-confirmar-valor="${inv.id}">Guardar</button>
      <button class="btn ghost" data-cancelar-valor="1">Cancelar</button>
    </div>
  </div>` : ""}
  ${editarInfoInvId===inv.id? `
  <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
    <label>Nombre</label><input id="infoNombre" value="${esc(inv.nombre)}">
    <label>Tipo</label><input id="infoTipo" value="${esc(inv.tipo||'')}">
    ${grupos().length? `<label>Grupo</label><select id="infoGrupo"><option value="">Sin grupo</option>${opcionesGrupos(inv.padreId)}</select>` : ""}
    ${!esActiva? `
    <label>Fecha prevista</label><input id="infoFechaPrevista" type="date" value="${inv.fechaPrevista||''}">
    <label>Importe previsto (${simboloMoneda()})</label><input id="infoImportePrevisto" type="number" step="0.01" min="0" value="${inv.importePrevisto??''}">
    <label>Cuenta prevista</label>
    ${cuentasActivas().length? `<select id="infoCuentaPrevista"><option value="">Sin elegir todavía</option>${cuentas.filter(c=>!c.archivada || c.id===inv.cuentaPrevistaId).map(c=>`<option value="${c.id}" ${c.id===inv.cuentaPrevistaId?"selected":""}>${esc(c.nombre)}</option>`).join("")}</select>` : `<div class="meta">Crea una cuenta cuando quieras usarla.</div>`}
    ` : ""}
    <div style="display:flex;gap:8px">
      <button class="btn" data-confirmar-info="${inv.id}">Guardar</button>
      <button class="btn ghost" data-cancelar-info="1">Cancelar</button>
    </div>
  </div>` : ""}`;
}

function renderInversiones(){
  const topActivos = inversiones.filter(i=>!i.padreId && (i.esGrupo || i.estado==="activa")).sort(porOrden);
  const topPlan = inversiones.filter(i=>!i.padreId && !i.esGrupo && i.estado!=="activa").sort(porOrden);
  const reales = inversiones.filter(i=>!i.esGrupo && i.estado==="activa");
  const totalValor = reales.reduce((s,i)=>sumarDinero(s, i.valorActual),0);
  const totalBeneficio = reales.reduce((s,i)=>sumarDinero(s, beneficioInv(i)),0);
  const totalRentas = reales.reduce((s,i)=>sumarDinero(s, (i.rentas||0)),0);
  const slices = sliceInversiones();
  const bloqueGrafica = slices.length ? `
  <div class="card">
    <h2>Distribución de tus inversiones</h2>
    <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin-top:10px">
      <div style="width:130px;height:130px;border-radius:50%;background:conic-gradient(${pieStyle(slices)});flex-shrink:0;position:relative">
        <div style="position:absolute;inset:30px;border-radius:50%;background:var(--card);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px">${eur(totalValor)}</div>
      </div>
      <div style="flex:1;min-width:190px;display:flex;flex-direction:column;gap:8px">
        ${slices.map(sl=>`
        <div>
          <div style="display:flex;align-items:center;gap:8px;font-size:13px">
            <span style="width:12px;height:12px;border-radius:50%;background:${sl.color};flex-shrink:0"></span>
            <span style="flex:1;font-weight:600">${esc(sl.nombre)}</span>
            <span class="meta">${eur(sl.total)} · ${sl.pct.toFixed(1)}%</span>
          </div>
          ${sl.hijos.map(h=>`<div class="meta" style="margin-left:20px;display:flex;justify-content:space-between"><span>${esc(h.nombre)}</span><span>${(sl.totalGlobal? h.total/sl.totalGlobal*100 : 0).toFixed(1)}%</span></div>`).join("")}
        </div>`).join("")}
      </div>
    </div>
  </div>` : "";
  return `
  ${bloqueGrafica}
  <div class="card">
    <h2>Nueva inversión</h2>
    <form id="fInversion">
      <div class="row2">
        <div><label>Nombre</label><input name="nombre" placeholder="ej. Trade Republic" required></div>
        <div><label>Tipo (opcional)</label><input name="tipo" placeholder="ej. ETF, inmobiliaria..."></div>
      </div>
      ${grupos().length? `<div><label>Grupo (opcional)</label><select name="grupoId"><option value="">Sin grupo</option>${opcionesGrupos()}</select></div>` : ""}
      <div><label>Estado</label><select name="estado" id="invEstado"><option value="activa">Activa — ya tengo dinero invertido</option><option value="planificada">Planificada — todavía no he aportado nada</option></select></div>
      <div id="invValorWrap"><label>Valor actual inicial (${simboloMoneda()})</label><input name="valorActual" type="number" step="0.01" value="0" id="invValorInput" required></div>
      <div id="invPlanWrap" style="display:none">
        <div class="row2">
          <div><label>Fecha prevista</label><input name="fechaPrevista" type="date"></div>
          <div><label>Importe previsto (${simboloMoneda()})</label><input name="importePrevisto" type="number" step="0.01" min="0"></div>
        </div>
        <label>Cuenta prevista</label>
        ${cuentasActivas().length? `<select name="cuentaPrevista"><option value="">Sin elegir todavía</option>${opcionesCuentas(null, true)}</select>` : `<div class="meta">Crea una cuenta cuando quieras usarla.</div>`}
      </div>
      <button class="btn" type="submit">Añadir</button>
    </form>
  </div>
  <div class="card">
    <h2>Nuevo grupo</h2>
    <p class="meta" style="margin:0 0 10px">Agrupa varias inversiones bajo un mismo nombre (por ejemplo, "Trade Republic Felicidad"). Después eliges el grupo desde "Editar información" de cada inversión.</p>
    <form id="fGrupo">
      <div><label>Nombre del grupo</label><input name="nombre" required></div>
      <button class="btn" type="submit">Crear grupo</button>
    </form>
  </div>
  <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
    <span>Activas · Valor ${eur(totalValor)} · Beneficio ${eur(totalBeneficio)}${totalRentas>0?` · Rentas ${eur(totalRentas)}`:""}</span>
  </div>
  <div class="list" data-sortable="ordenar_inversiones">
    ${topActivos.length? topActivos.map(x=>sortItem(x.id, invItem(x, topActivos.length>1))).join("") : `<div class="card">${vacio("nube","Tu dinero aún no está sembrado 🌱","Cuando añadas una inversión activa, la verás crecer aquí.")}</div>`}
  </div>
  <div class="section-title">Planificadas · no cuentan en tu patrimonio</div>
  <div class="list" data-sortable="ordenar_inversiones">
    ${topPlan.length? topPlan.map(x=>sortItem(x.id, invItem(x, topPlan.length>1))).join("") : `<div class="card">${vacio("hucha","Sin planes a la vista","Apunta aquí lo que quieras invertir más adelante.")}</div>`}
  </div>`;
}

function wireEventosInversiones(){
  const invEstado = document.getElementById("invEstado");
  const invValorWrap = document.getElementById("invValorWrap");
  const invValorInput = document.getElementById("invValorInput");
  const invPlanWrap = document.getElementById("invPlanWrap");
  if(invEstado && invValorWrap){
    const toggleInv = ()=>{
      const esPlan = invEstado.value === "planificada";
      invValorWrap.style.display = esPlan ? "none" : "block";
      if(invValorInput) invValorInput.required = !esPlan;
      if(invPlanWrap) invPlanWrap.style.display = esPlan ? "block" : "none";
    };
    toggleInv(); invEstado.onchange = toggleInv;
  }
  const fInversion = document.getElementById("fInversion");
  if(fInversion) fInversion.onsubmit = (e)=>{
    e.preventDefault();
    conCarga(fInversion.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const f = new FormData(fInversion);
      const estado = f.get("estado")||"activa";
      const valInicial = estado==="planificada" ? 0 : parseFloat(f.get("valorActual"));
      const data = {nombre:f.get("nombre"), tipo:f.get("tipo")||"", valor_actual:valInicial, valor_inicial:valInicial, estado};
      data.padre_id = f.get("grupoId") || null;
      data.orden = siguienteOrden();
      if(estado==="planificada"){
        data.fecha_prevista = f.get("fechaPrevista") || null;
        data.importe_previsto = f.get("importePrevisto") ? parseFloat(f.get("importePrevisto")) : null;
        data.cuenta_prevista_id = f.get("cuentaPrevista") || null;
      }
      const {error} = await sb.from("inversiones").insert(data);
      if(error){ showError("No se pudo guardar la inversión: "+error.message); return; }
      hideError(); fInversion.reset(); await recargar(["inversiones"]);
    });
  };
  document.querySelectorAll("[data-del-inv]").forEach(b=>b.onclick=async ()=>{
    const esG = inversiones.find(i=>i.id===b.dataset.delInv)?.esGrupo;
    if(!(await confirmar(esG ? "¿Borrar este grupo? Las inversiones de dentro no se borran, quedarán sueltas." : "¿Borrar esta inversión? También se borrarán sus aportaciones y los gastos que generó."))) return;
    conCarga(b, "Borrando…", async ()=>{
      const {error} = await sb.rpc("eliminar_inversion", {p_inversion_id: b.dataset.delInv});
      if(error){ showError("No se pudo borrar: "+error.message); return; }
      hideError(); await recargar(["inversiones","aportaciones_inversion","retiros_inversion","movimientos","objetivos"]);
    });
  });
  document.querySelectorAll("[data-expandir-inv]").forEach(b=>b.onclick=()=>{
    const id = b.dataset.expandirInv;
    expandidaInvId = expandidaInvId===id ? null : id;
    aportarInvId=null; editarValorInvId=null; verAportacionesId=null; editarInfoInvId=null; rescatarInvId=null; rentasInvId=null;
    render();
  });
  document.querySelectorAll("[data-editar-info]").forEach(b=>b.onclick=()=>{ editarInfoInvId=b.dataset.editarInfo; pendienteEnfoque = "infoNombre"; render(); });
  document.querySelectorAll("[data-cancelar-info]").forEach(b=>b.onclick=()=>{ editarInfoInvId=null; render(); });
  document.querySelectorAll("[data-confirmar-info]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
    const invId = b.dataset.confirmarInfo;
    const nombre = document.getElementById("infoNombre")?.value.trim();
    const tipo = document.getElementById("infoTipo")?.value.trim();
    if(!nombre) return;
    const data = {nombre, tipo};
    const grupoEl = document.getElementById("infoGrupo");
    if(grupoEl) data.padre_id = grupoEl.value || null;
    const fechaEl = document.getElementById("infoFechaPrevista");
    const importeEl = document.getElementById("infoImportePrevisto");
    const cuentaEl = document.getElementById("infoCuentaPrevista");
    if(fechaEl){
      data.fecha_prevista = fechaEl.value || null;
      data.importe_previsto = importeEl?.value ? parseFloat(importeEl.value) : null;
      data.cuenta_prevista_id = cuentaEl?.value || null;
    }
    const {error} = await sb.from("inversiones").update(data).eq("id", invId);
    if(error){ showError("No se pudo guardar: "+error.message); return; }
    hideError(); editarInfoInvId = null; await recargar(["inversiones"]);
  }));
  document.querySelectorAll("[data-aportar-inv]").forEach(b=>b.onclick=()=>{ aportarInvId=b.dataset.aportarInv; editarValorInvId=null; pendienteEnfoque = "aportarImporte"; render(); });
  document.querySelectorAll("[data-cancelar-aportar]").forEach(b=>b.onclick=()=>{ aportarInvId=null; render(); });
  document.querySelectorAll("[data-confirmar-aportar]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
    const invId = b.dataset.confirmarAportar;
    const importeEl = document.getElementById("aportarImporte");
    const cuentaEl = document.getElementById("aportarCuenta");
    const importe = parseFloat(importeEl?.value);
    if(!cuentaEl?.value || !importe || importe<=0) return;
    const {error} = await sb.rpc("aportar_inversion", {p_inversion_id: invId, p_importe: importe, p_cuenta_id: cuentaEl.value});
    if(error){ showError("No se pudo guardar la aportación: "+error.message); return; }
    hideError(); aportarInvId = null; await recargar(["inversiones","aportaciones_inversion","movimientos"]);
  }));
  document.querySelectorAll("[data-rescatar-inv]").forEach(b=>b.onclick=()=>{ rescatarInvId=b.dataset.rescatarInv; aportarInvId=null; editarValorInvId=null; pendienteEnfoque = "rescatarImporte"; render(); });
  document.querySelectorAll("[data-cancelar-rescate]").forEach(b=>b.onclick=()=>{ rescatarInvId=null; render(); });
  document.querySelectorAll("[data-confirmar-rescate]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
    const invId = b.dataset.confirmarRescate;
    const importeEl = document.getElementById("rescatarImporte");
    const cuentaEl = document.getElementById("rescatarCuenta");
    const importe = parseFloat(importeEl?.value);
    if(!cuentaEl?.value || !importe || importe<=0) return;
    const {error} = await sb.rpc("rescatar_inversion", {p_inversion_id: invId, p_importe: importe, p_cuenta_id: cuentaEl.value});
    if(error){ showError("No se pudo rescatar: "+error.message); return; }
    hideError(); rescatarInvId = null; await recargar(["inversiones","retiros_inversion","movimientos"]);
  }));
  document.querySelectorAll("[data-del-retiro]").forEach(b=>b.onclick=async ()=>{
    if(!(await confirmar("¿Deshacer este rescate? Se borrará el ingreso asociado y volverá a la inversión."))) return;
    conCarga(b, "Borrando…", async ()=>{
      const {error} = await sb.rpc("eliminar_retiro", {p_retiro_id: b.dataset.delRetiro});
      if(error){ showError("No se pudo deshacer: "+error.message); return; }
      hideError(); await recargar(["inversiones","retiros_inversion","movimientos"]);
    });
  });
  document.querySelectorAll("[data-ver-aportaciones]").forEach(b=>b.onclick=()=>{
    verAportacionesId = verAportacionesId===b.dataset.verAportaciones ? null : b.dataset.verAportaciones;
    render();
  });
  document.querySelectorAll("[data-del-aportacion]").forEach(b=>b.onclick=async ()=>{
    if(!(await confirmar("¿Borrar esta aportación? También se borrará el gasto asociado y se restará del valor de la inversión."))) return;
    conCarga(b, "Borrando…", async ()=>{
      const {error} = await sb.rpc("eliminar_aportacion", {p_aportacion_id: b.dataset.delAportacion});
      if(error){ showError("No se pudo borrar la aportación: "+error.message); return; }
      hideError(); await recargar(["inversiones","aportaciones_inversion","movimientos"]);
    });
  });
  document.querySelectorAll("[data-editar-valor]").forEach(b=>b.onclick=()=>{ editarValorInvId=b.dataset.editarValor; aportarInvId=null; pendienteEnfoque = "valorNuevo"; render(); });
  document.querySelectorAll("[data-cancelar-valor]").forEach(b=>b.onclick=()=>{ editarValorInvId=null; render(); });
  document.querySelectorAll("[data-confirmar-valor]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
    const invId = b.dataset.confirmarValor;
    const nuevo = parseFloat(document.getElementById("valorNuevo")?.value);
    if(isNaN(nuevo)) return;
    const {error} = await sb.from("inversiones").update({valor_actual:nuevo}).eq("id", invId);
    if(error){ showError("No se pudo guardar el nuevo valor: "+error.message); return; }
    hideError(); editarValorInvId = null; await recargar(["inversiones"]);
  }));
  document.querySelectorAll("[data-toggle-grupo]").forEach(b=>b.onclick=()=>{ const id=b.dataset.toggleGrupo; gruposAbiertos[id]=!gruposAbiertos[id]; render(); });
  document.querySelectorAll("[data-rentas-inv]").forEach(b=>b.onclick=()=>{ rentasInvId=b.dataset.rentasInv; aportarInvId=null; editarValorInvId=null; rescatarInvId=null; pendienteEnfoque = "rentasImporte"; render(); });
  document.querySelectorAll("[data-cancelar-rentas]").forEach(b=>b.onclick=()=>{ rentasInvId=null; render(); });
  const guardarRentas = (b, modo)=>conCarga(b, "Guardando…", async ()=>{
    const id = modo==="sumar" ? b.dataset.sumarRentas : b.dataset.fijarRentas;
    const v = parseFloat(document.getElementById("rentasImporte")?.value);
    const inv = inversiones.find(i=>i.id===id);
    if(!inv) return;
    if(isNaN(v)){ showError("Escribe la cantidad de rentas (por ejemplo 10 o 2,50)."); return; }
    const nuevo = modo==="sumar" ? sumarDinero(inv.rentas||0, v) : redondearDinero(v);
    if(nuevo<0){ showError("Las rentas no pueden quedar en negativo."); return; }
    const {error} = await sb.from("inversiones").update({rentas:nuevo}).eq("id", id);
    if(error){ showError("No se pudieron guardar las rentas: "+error.message); return; }
    hideError(); rentasInvId = null; await recargar(["inversiones"]);
  });
  document.querySelectorAll("[data-sumar-rentas]").forEach(b=>b.onclick=()=>guardarRentas(b,"sumar"));
  document.querySelectorAll("[data-fijar-rentas]").forEach(b=>b.onclick=()=>guardarRentas(b,"fijar"));
  const fGrupo = document.getElementById("fGrupo");
  if(fGrupo) fGrupo.onsubmit = (e)=>{
    e.preventDefault();
    conCarga(fGrupo.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const f = new FormData(fGrupo);
      const data = {nombre:f.get("nombre"), tipo:"", valor_actual:0, valor_inicial:0, estado:"activa", es_grupo:true, orden:siguienteOrden()};
      const {error} = await sb.from("inversiones").insert(data);
      if(error){ showError("No se pudo crear el grupo: "+error.message); return; }
      hideError(); fGrupo.reset(); await recargar(["inversiones"]);
    });
  };
}
