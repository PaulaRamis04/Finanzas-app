// Pestaña «Movimientos»: su render y sus eventos.

function movItem(m, cubMov, pendMov){
  const protegido = movimientoProtegido(m.id);
  const abierto = movAbiertoId===m.id || editarMovId===m.id || meDebenMovId===m.id;
  if(m.transferenciaId){
    const otro = movimientos.find(x=>x.transferenciaId===m.transferenciaId && x.id!==m.id);
    if(m.tipo==="gasto" && otro){
      return `
      ${filaMov(m, {attrs:`data-abrir-mov="${m.id}"`, extra:`${cuentaNombre(m.cuentaId)} → ${cuentaNombre(otro.cuentaId)}`, fecha:false, clase:abierto?"abierta":""})}
      ${abierto? `<div class="fila-extra">
        ${m.nota && m.nota!=="Transferencia"?`<div class="meta">${esc(m.nota)}</div>`:""}
        <div class="chips"><button class="chip peligro" data-del-transferencia="${m.transferenciaId}">Borrar</button></div>
      </div>` : ""}`;
    }
    return ""; // el lado "ingreso" del par ya se muestra junto al "gasto"
  }
  const notas = [
    m.saldoBanco!=null ? `Saldo banco: ${eur(m.saldoBanco)}` : "",
    m.recurrenteId ? "Generado automáticamente (recurrente)" : "",
    m.reembolsoDe ? "Reembolso de un gasto: no cuenta como ingreso" : "",
    pendMov[m.id] ? `Te deben ${eur(pendMov[m.id])} (pendiente: hasta que lo cobres, cuenta entero)` : "",
    cubMov[m.id] ? `Ya cobrado: ${eur(cubMov[m.id])} · cuenta ${eur(Math.max(0,restarDinero(m.importe, cubMov[m.id])))} como gasto tuyo` : "",
  ].filter(Boolean);
  const sub = `${m.nota ? m.categoria : ""}${m.nota ? " · " : ""}${cuentaNombre(m.cuentaId)}`;
  return `
  ${filaMov(m, {attrs:`data-abrir-mov="${m.id}"`, extra:sub, fecha:false, clase:abierto?"abierta":""})}
  ${abierto? `<div class="fila-extra">
    ${notas.map(n=>`<div class="meta">${n}</div>`).join("")}
    ${meDebenMovId!==m.id && editarMovId!==m.id? `<div class="chips">
      ${!protegido? `<button class="chip" data-editar-mov="${m.id}">Editar</button>` : ""}
      <button class="chip lav" data-duplicar-mov="${m.id}">Repetir</button>
      ${m.tipo==='gasto' && !m.reembolsoDe && m.categoria!=='Inversión' && m.categoria!=='Ajuste' && m.categoria!=='Transferencia'? `<button class="chip" data-me-deben="${m.id}" style="background:var(--peach-soft);color:#c77a2e">Me deben…</button>` : ""}
      <button class="chip peligro" data-del-mov="${m.id}">Borrar</button>
    </div>` : ""}
    ${meDebenMovId===m.id? `
    <label>¿Quién te lo debe?</label>
    <input id="mdPersona" placeholder="ej. Marta">
    <label>Cuánto te deben (${simboloMoneda()})</label>
    <input id="mdImporte" type="number" step="0.01" min="0.01" value="${m.importe}">
    <div class="meta">Se crea una deuda "me deben" vinculada a este gasto. Hasta que la saldes no cambia nada; cuando la cobres, esa cantidad dejará de contar como gasto tuyo (mes, resumen y presupuesto).</div>
    <div style="display:flex;gap:8px">
      <button class="btn" data-confirmar-me-deben="${m.id}">Crear deuda</button>
      <button class="btn ghost" data-cancelar-me-deben="1">Cancelar</button>
    </div>` : ""}
    ${editarMovId===m.id? `
    <label>Tipo</label>
    <select id="movEditTipo">
      <option value="gasto"${m.tipo==="gasto"?" selected":""}>Gasto</option>
      <option value="ingreso"${m.tipo==="ingreso"?" selected":""}>Ingreso</option>
    </select>
    <label>Categoría</label>
    <select id="movEditCategoria">${opcionesCategoriaPend(m.tipo, m.categoria)}</select>
    <div class="row2">
      <div><label>Importe (${simboloMoneda()})</label><input id="movEditImporte" type="number" step="0.01" min="0.01" value="${m.importe}"></div>
      <div><label>Fecha</label><input id="movEditFecha" type="date" value="${m.fecha}"></div>
    </div>
    <label>Cuenta</label>
    <select id="movEditCuenta">${opcionesCuentas(m.cuentaId)}</select>
    <label>Nota</label>
    <input id="movEditNota" value="${esc(m.nota||"")}">
    <div style="display:flex;gap:8px">
      <button class="btn" data-confirmar-editar-mov="${m.id}">Guardar</button>
      <button class="btn ghost" data-cancelar-editar-mov="1">Cancelar</button>
    </div>` : ""}
  </div>` : ""}`;
}

function renderMovimientosLista(){
  const items = movimientosFiltrados();
  const cubMov = cubiertoPorMovimiento();
  const pendMov = pendientePorMovimiento();
  const hayFiltro = movBuscarTexto.trim() || movFiltroCategoria;
  return `
  <div class="section-title">Historial <span class="meta" style="font-size:13px">(${items.length})</span></div>
  ${items.length? listaPorDias(items, m=>movItem(m,cubMov,pendMov)) : `<div class="card">${hayFiltro? vacio("nube","No encontramos nada","Prueba con otra palabra o categoría.") : vacio("hucha","Aún no hay movimientos","Apunta el primero arriba y tu hucha despertará.")}</div>`}`;
}

function renderMovimientos(){
  const soloVista = periodoMes === "todos";
  const categoriasPresentes = [...new Set(movimientos.filter(m=>enPeriodo(m.fecha)).map(m=>m.categoria))].sort((a,b)=>a.localeCompare(b));
  return `
  ${soloVista ? `<div class="card"><p class="meta" style="margin:0">Estás viendo el total del año — elige un mes concreto arriba para poder añadir movimientos o transferencias.</p></div>` : `
  <div class="card">
    <h2>Añadir movimiento</h2>
    ${movPlantilla? `<p class="meta" style="margin:0 0 10px;color:var(--accent)">Repitiendo un movimiento — revisa los datos y añade.</p>` : ""}
    <form id="fMov">
      <div class="row2">
        <div><label>Tipo</label><select name="tipo" id="movTipo"><option value="gasto"${(!movPlantilla||movPlantilla.tipo==="gasto")?" selected":""}>Gasto</option><option value="ingreso"${movPlantilla&&movPlantilla.tipo==="ingreso"?" selected":""}>Ingreso</option></select></div>
        <div><label>Importe (${simboloMoneda()})</label><input name="importe" id="movImporte" type="number" step="0.01" min="0.01" value="${movPlantilla?movPlantilla.importe:''}" required></div>
      </div>
      <div class="row2">
        <div><label>Categoría</label><select name="categoria" id="movCat"></select></div>
        <div><label>Fecha</label><input name="fecha" type="date" value="${today()}" required></div>
      </div>
      <div><label>Cuenta</label>${cuentasActivas().length? `<select name="cuentaId">${opcionesCuentas(movPlantilla?movPlantilla.cuentaId:null)}</select>` : `<div class="meta">Crea antes una cuenta en la pestaña "Cuentas".</div>`}</div>
      <div><label>Nota (opcional)</label><input name="nota" placeholder="ej. cena viernes" value="${movPlantilla?esc(movPlantilla.nota||''):''}"></div>
      <button class="btn" type="submit" ${cuentasActivas().length?"":"disabled"}>Añadir</button>
    </form>
  </div>
  <div class="card">
    <h2>Transferencia entre cuentas</h2>
    <p class="meta" style="margin:0 0 12px">Mueve dinero de una cuenta a otra sin que cuente como gasto ni ingreso.</p>
    ${cuentasActivas().length<2? `<div class="meta">Necesitas al menos dos cuentas para transferir entre ellas.</div>` : `
    <form id="fTransferencia">
      <div class="row2">
        <div><label>Desde</label><select name="origen" id="trOrigen">${opcionesCuentas()}</select></div>
        <div><label>Hacia</label><select name="destino" id="trDestino">${opcionesCuentas()}</select></div>
      </div>
      <div class="row2">
        <div><label>Importe (${simboloMoneda()})</label><input name="importe" type="number" step="0.01" min="0.01" required></div>
        <div><label>Fecha</label><input name="fecha" type="date" value="${today()}" required></div>
      </div>
      <div><label>Nota (opcional)</label><input name="nota" placeholder="ej. traspaso a ahorro"></div>
      <button class="btn" type="submit">Transferir</button>
    </form>`}
  </div>`}
  <div class="buscador">
    <div class="buscar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="movBuscar" placeholder="Buscar" aria-label="Buscar en concepto" value="${esc(movBuscarTexto)}"></div>
    <select id="movFiltroCat" aria-label="Categoría"><option value="">Todas</option>${categoriasPresentes.map(c=>`<option value="${esc(c)}"${c===movFiltroCategoria?" selected":""}>${esc(c)}</option>`).join("")}</select>
  </div>
  <div id="movListaWrap">${renderMovimientosLista()}</div>`;
}

function wireEventosMovimientos(){
  const cat = document.getElementById("movCat");
  const tipoSel = document.getElementById("movTipo");
  if(cat){
    const fill = ()=>{
      const sel = movPlantilla && movPlantilla.tipo===tipoSel.value ? movPlantilla.categoria : null;
      if(tipoSel.value==="gasto"){
        const porPadre = {};
        categorias.filter(c=>c.tipo==="gasto").forEach(c=>{ const p=c.padre||"Otros"; (porPadre[p]=porPadre[p]||[]).push(c); });
        cat.innerHTML = Object.keys(porPadre).length
          ? Object.entries(porPadre).map(([p,cats])=>`<optgroup label="${esc(p)}">${cats.map(c=>`<option value="${esc(c.nombre)}"${c.nombre===sel?" selected":""}>${esc(c.nombre)}</option>`).join("")}</optgroup>`).join("")
          : `<option value="">Crea una categoría en la pestaña "Categorías"</option>`;
      } else {
        const list = categorias.filter(c=>c.tipo==="ingreso");
        cat.innerHTML = list.length ? list.map(c=>`<option value="${esc(c.nombre)}"${c.nombre===sel?" selected":""}>${esc(c.nombre)}</option>`).join("") : `<option value="">Crea una categoría en la pestaña "Categorías"</option>`;
      }
    };
    fill(); tipoSel.onchange = fill;
  }
  const fMov = document.getElementById("fMov");
  if(fMov) fMov.onsubmit = (e)=>{
    e.preventDefault();
    vibrar();
    conCarga(fMov.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const f = new FormData(fMov);
      const data = {tipo:f.get("tipo"), categoria:f.get("categoria"), importe:parseFloat(f.get("importe")), fecha:f.get("fecha"), nota:f.get("nota")||"", cuenta_id:f.get("cuentaId")||null};
      const {error} = await sb.from("movimientos").insert(data);
      if(error){ showError("No se pudo guardar el movimiento: "+error.message); return; }
      sonarMoneda();
      hideError(); fMov.reset(); movPlantilla = null; await recargar(["movimientos"]);
    });
  };
  function refrescarListaMov(){
    const wrap = document.getElementById("movListaWrap");
    if(!wrap) return;
    wrap.innerHTML = renderMovimientosLista();
    wireListaMovimientos();
  }
  function wireListaMovimientos(){
    document.querySelectorAll("[data-abrir-mov]").forEach(b=>b.onclick=()=>{
      const id = b.dataset.abrirMov;
      const cerrar = movAbiertoId===id || editarMovId===id || meDebenMovId===id;
      movAbiertoId = cerrar ? null : id;
      if(cerrar || (editarMovId && editarMovId!==id)) editarMovId = null;
      if(cerrar || (meDebenMovId && meDebenMovId!==id)) meDebenMovId = null;
      refrescarListaMov();
    });
    document.querySelectorAll("[data-del-mov]").forEach(b=>b.onclick=async ()=>{
      if(!(await confirmar("¿Borrar este movimiento?"))) return;
      conCarga(b, "Borrando…", async ()=>{
        const {error} = await sb.from("movimientos").delete().eq("id", b.dataset.delMov);
        if(error){ showError("No se pudo borrar: "+error.message); return; }
        hideError(); await recargar(["movimientos","deudas","aportaciones_inversion","retiros_inversion"]);
      });
    });
    document.querySelectorAll("[data-del-transferencia]").forEach(b=>b.onclick=async ()=>{
      if(!(await confirmar("¿Borrar esta transferencia? Se deshacen los dos movimientos."))) return;
      conCarga(b, "Borrando…", async ()=>{
        const {error} = await sb.rpc("eliminar_transferencia", {p_transferencia_id: b.dataset.delTransferencia});
        if(error){ showError("No se pudo borrar: "+error.message); return; }
        hideError(); await recargar(["movimientos"]);
      });
    });
    document.querySelectorAll("[data-me-deben]").forEach(b=>b.onclick=()=>{ meDebenMovId = b.dataset.meDeben; editarMovId=null; render(); });
    document.querySelectorAll("[data-cancelar-me-deben]").forEach(b=>b.onclick=()=>{ meDebenMovId = null; render(); });
    document.querySelectorAll("[data-confirmar-me-deben]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
      const id = b.dataset.confirmarMeDeben;
      const m = movimientos.find(x=>x.id===id);
      const persona = document.getElementById("mdPersona")?.value.trim();
      const imp = parseFloat(document.getElementById("mdImporte")?.value);
      if(!m || !persona || isNaN(imp) || imp<=0){ showError("Escribe quién te lo debe y una cantidad válida."); return; }
      if(imp>m.importe){ showError("Te pueden deber como máximo el importe del gasto ("+eur(m.importe)+")."); return; }
      const {error} = await sb.from("deudas").insert({persona, importe:imp, importe_inicial:imp, direccion:"me_deben", fecha:m.fecha, concepto:m.nota||m.categoria, estado:"pendiente", movimiento_id:m.id});
      if(error){ showError("No se pudo crear la deuda: "+error.message); return; }
      hideError(); meDebenMovId = null; await recargar(["deudas"]);
    }));
    document.querySelectorAll("[data-editar-mov]").forEach(b=>b.onclick=()=>{ editarMovId = b.dataset.editarMov; meDebenMovId=null; render(); });
    document.querySelectorAll("[data-duplicar-mov]").forEach(b=>b.onclick=()=>{
      const m = movimientos.find(x=>x.id===b.dataset.duplicarMov);
      if(!m) return;
      movPlantilla = {tipo:m.tipo, categoria:m.categoria, importe:m.importe, cuentaId:m.cuentaId, nota:m.nota||""};
      formsEstado["mov"] = true;
      editarMovId = null; meDebenMovId = null;
      const hoy = new Date();
      if(periodoMes==="todos"){ periodoMes = String(hoy.getMonth()+1); periodoAnio = hoy.getFullYear(); }
      pendienteEnfoque = "fMov";
      render();
    });
    document.querySelectorAll("[data-cancelar-editar-mov]").forEach(b=>b.onclick=()=>{ editarMovId = null; render(); });
    document.querySelectorAll("#movEditTipo").forEach(sel=>sel.onchange=()=>{
      const cat = document.getElementById("movEditCategoria");
      if(cat) cat.innerHTML = opcionesCategoriaPend(sel.value, null);
    });
    document.querySelectorAll("[data-confirmar-editar-mov]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
      const id = b.dataset.confirmarEditarMov;
      const tipo = document.getElementById("movEditTipo")?.value;
      const categoria = document.getElementById("movEditCategoria")?.value;
      const importe = parseFloat(document.getElementById("movEditImporte")?.value);
      const fecha = document.getElementById("movEditFecha")?.value;
      const cuentaId = document.getElementById("movEditCuenta")?.value;
      const nota = document.getElementById("movEditNota")?.value || "";
      if(!categoria || isNaN(importe) || importe<=0 || !fecha || !cuentaId){ showError("Revisa los datos del movimiento."); return; }
      const {error} = await sb.from("movimientos").update({tipo, categoria, importe, fecha, nota, cuenta_id:cuentaId}).eq("id", id);
      if(error){ showError("No se pudo guardar: "+error.message); return; }
      hideError(); editarMovId = null; await recargar(["movimientos"]);
    }));
  }
  wireListaMovimientos();
  const movBuscar = document.getElementById("movBuscar");
  if(movBuscar) movBuscar.oninput = ()=>{ movBuscarTexto = movBuscar.value; refrescarListaMov(); };
  const movFiltroCat = document.getElementById("movFiltroCat");
  if(movFiltroCat) movFiltroCat.onchange = ()=>{ movFiltroCategoria = movFiltroCat.value; refrescarListaMov(); };
  const fTransferencia = document.getElementById("fTransferencia");
  if(fTransferencia) fTransferencia.onsubmit = (e)=>{
    e.preventDefault();
    conCarga(fTransferencia.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const f = new FormData(fTransferencia);
      const origen = f.get("origen"), destino = f.get("destino");
      const importe = parseFloat(f.get("importe"));
      if(origen===destino){ showError("Elige dos cuentas distintas."); return; }
      if(isNaN(importe) || importe<=0){ showError("Escribe un importe válido."); return; }
      const {error} = await sb.rpc("crear_transferencia", {p_cuenta_origen:origen, p_cuenta_destino:destino, p_importe:importe, p_fecha:f.get("fecha"), p_nota:f.get("nota")||""});
      if(error){ showError("No se pudo transferir: "+error.message); return; }
      hideError(); fTransferencia.reset(); await recargar(["movimientos"]);
    });
  };
}
