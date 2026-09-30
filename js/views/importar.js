// Pestaña «Importar»: su render y sus eventos.

function renderPendientes(){
  if(!pendientes.length) return "";
  const lista = [...pendientes].sort((a,b)=> b.fecha.localeCompare(a.fecha) || (a.posicion-b.posicion));
  return `
  <div class="card">
    <h2>Pendientes de confirmar (${pendientes.length})</h2>
    <p class="meta" style="margin:0 0 10px">Aún no cuentan en tus saldos ni en tus gastos. La descripción y el saldo son los del banco. Elige la categoría de cada uno y confírmalo.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <button class="btn" id="pendConfirmarTodos">Confirmar los que tienen categoría</button>
      <button class="btn ghost" id="pendDescartarTodos">Descartar todos</button>
    </div>
    <div class="list">
      ${lista.map(p=>`
      <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div style="min-width:0;word-break:break-word">
            <strong style="font-weight:600">${esc(p.descripcion) || "(sin descripción)"}</strong>
            <div class="meta">${p.fecha} · ${cuentaNombre(p.cuentaId)}${p.saldo!=null?` · Saldo ${eur(p.saldo)}`:""}</div>
          </div>
          <div class="amt ${p.tipo==='ingreso'?'pos':'neg'}">${p.tipo==='ingreso'?'+':'-'}${eur(p.importe)}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select id="pendCat-${p.id}" style="flex:1;min-width:150px">${opcionesCategoriaPend(p.tipo, pendCats[p.id] ?? sugerirCategoria(p.descripcion, p.tipo))}</select>
          <button class="btn" data-pend-confirmar="${p.id}">Confirmar</button>
          <button class="btn ghost" data-pend-descartar="${p.id}">Descartar</button>
        </div>
      </div>`).join("")}
    </div>
  </div>`;
}

function renderImportar(){
  const sel = (id, actual, conNinguna)=>`<select id="${id}">${conNinguna?`<option value="">— Ninguna —</option>`:""}${csvHeaders.map(h=>`<option value="${esc(h)}"${h===actual?" selected":""}>${esc(h)}</option>`).join("")}</select>`;
  const invalidas = csvPreview.filter(m=>m.invalida);
  const yaEnPendientes = csvPreview.filter(m=>!m.invalida && m.dup);
  const conciliables = csvPreview.filter(m=>!m.invalida && !m.dup && m.matchId);
  const nuevos = csvPreview.filter(m=>!m.invalida && !m.dup && !m.matchId);
  const aImportar = nuevos.length + conciliables.filter((m,i)=>csvDecisiones[m.posicion]==="distinto").length;

  let bloqueSinExtracto = "";
  if(csvPreview.length && csvPreviewCuentaId){
    const validas = csvPreview.filter(m=>!m.invalida);
    if(validas.length){
      const fechas = validas.map(m=>m.fecha).sort();
      const desde = fechas[0], hasta = fechas[fechas.length-1];
      const idsEmparejados = new Set(validas.filter(m=>m.matchId).map(m=>m.matchId));
      const sinAparecer = movimientos.filter(m=>m.cuentaId===csvPreviewCuentaId && m.fecha>=desde && m.fecha<=hasta && !idsEmparejados.has(m.id) && m.categoria!=="Ajuste");
      if(sinAparecer.length){
        bloqueSinExtracto = `
        <div class="card">
          <h2>No aparecen en este extracto (${sinAparecer.length})</h2>
          <p class="meta" style="margin:0 0 10px">Los tienes apuntados entre ${desde} y ${hasta}, pero ninguna línea del banco encaja con ellos. Puede que aún no se hayan cargado, o que estén mal apuntados.</p>
          <div class="list">
            ${sinAparecer.sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(m=>`
              <div class="item"><div>${esc(m.nota||m.categoria)}<div class="meta">${m.fecha}</div></div><div class="amt ${m.tipo==='ingreso'?'pos':'neg'}">${eur(m.importe)}</div></div>
            `).join("")}
          </div>
        </div>`;
      }
    }
  }

  return `
  ${renderPendientes()}
  <div class="card">
    <h2>Importar y conciliar extracto del banco (CSV)</h2>
    <p class="meta" style="margin:0 0 10px">Sube el CSV del banco. Cada línea se compara con lo que ya tienes apuntado (mismo importe, fecha cercana) para no duplicar nada. Lo nuevo se guarda como pendiente de confirmar hasta que le pongas categoría.</p>
    <input type="file" id="csvFile" accept=".csv,text/csv,text/plain">
  </div>
  ${csvHeaders.length? `
  <div class="card">
    <h2>Columnas del archivo</h2>
    <div class="row2">
      <div><label>Fecha</label>${sel("csvColFecha", csvSel.fecha, false)}</div>
      <div><label>Importe</label>${sel("csvColImporte", csvSel.importe, false)}</div>
    </div>
    <div class="row2" style="margin-top:10px">
      <div><label>Descripción / concepto</label>${sel("csvColNota", csvSel.nota, true)}</div>
      <div><label>Saldo (opcional)</label>${sel("csvColSaldo", csvSel.saldo, true)}</div>
    </div>
    <div style="margin-top:10px"><label>Cuenta</label>${cuentasActivas().length?`<select id="csvCuenta">${opcionesCuentas(csvSel.cuenta)}</select>`:`<div class="meta">Crea antes una cuenta.</div>`}</div>
    <button class="btn" id="csvPrevisualizar" style="margin-top:12px" ${cuentasActivas().length?"":"disabled"}>Previsualizar</button>
  </div>` : ""}
  ${csvPreview.length? `
  <div class="card">
    <h2>Resultado de la conciliación</h2>
    <p class="meta" style="margin:0 0 10px">${conciliables.length} ya los tenías apuntados · ${nuevos.length} son nuevos${yaEnPendientes.length?` · ${yaEnPendientes.length} ya estaban en pendientes`:""}${invalidas.length?` · ${invalidas.length} con fecha no válida`:""}.</p>
  </div>
  ${conciliables.length? `
  <div class="card">
    <h2>Ya los tenías apuntados (${conciliables.length})</h2>
    <p class="meta" style="margin:0 0 10px">Misma cantidad y fecha cercana a un movimiento tuyo. Si es el mismo, se marca como conciliado y no se importa de nuevo. Si es otro distinto que coincidió por casualidad, dile que lo importe también.</p>
    <div class="list">
      ${conciliables.map(m=>{
        const ex = movimientos.find(x=>x.id===m.matchId);
        const decision = csvDecisiones[m.posicion] || "igual";
        return `
        <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
          <div style="display:flex;justify-content:space-between;gap:10px">
            <div style="min-width:0">
              <div class="meta">Banco: ${esc(m.nota)||"(sin descripción)"} · ${m.fecha}</div>
              <div class="meta">Tuyo: ${ex? esc(ex.nota||ex.categoria) : "—"} · ${ex?ex.fecha:""}</div>
            </div>
            <div class="amt ${m.tipo==='ingreso'?'pos':'neg'}">${eur(m.importe)}</div>
          </div>
          <select data-decision="${m.posicion}">
            <option value="igual"${decision==="igual"?" selected":""}>Es el mismo movimiento</option>
            <option value="distinto"${decision==="distinto"?" selected":""}>Es distinto, impórtalo también</option>
          </select>
        </div>`;
      }).join("")}
    </div>
  </div>` : ""}
  <div class="card">
    <h2>Nuevos, se guardarán como pendientes (${aImportar})</h2>
    <div class="list">
      ${[...nuevos, ...conciliables.filter(m=>(csvDecisiones[m.posicion]||"igual")==="distinto")].slice(0,15).map(m=>`
        <div class="item">
          <div style="min-width:0;word-break:break-word">${esc(m.nota)||"(sin descripción)"}<div class="meta">${esc(m.fecha)||"—"}${m.saldo!=null?` · Saldo ${eur(m.saldo)}`:""}</div></div>
          <div class="amt ${m.tipo==='ingreso'?'pos':'neg'}">${m.tipo==='ingreso'?'+':'-'}${eur(m.importe)}</div>
        </div>`).join("")}
      ${aImportar>15? `<div class="empty">... y ${aImportar-15} más</div>` : ""}
      ${aImportar===0? `<div class="empty">Nada nuevo que importar.</div>` : ""}
    </div>
    <button class="btn" id="csvImportar" style="margin-top:12px">Confirmar conciliación</button>
  </div>
  ` : ""}
  ${bloqueSinExtracto}`;
}

function wireEventosImportar(){
  const guessAny = (res)=>{
    const norm = h=>h.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    for(const re of res){ const h = csvHeaders.find(x=>re.test(norm(x))); if(h) return h; }
    return "";
  };
  const csvFile = document.getElementById("csvFile");
  if(csvFile) csvFile.onchange = ()=>{
    const file = csvFile.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      let txt;
      try{ txt = new TextDecoder("utf-8", {fatal:true}).decode(reader.result); }
      catch(e){ txt = new TextDecoder("windows-1252").decode(reader.result); }
      txt = txt.replace(/^\uFEFF/, "");
      const {headers, filas} = parseCSV(txt);
      csvHeaders = headers; csvFilas = filas; csvPreview = [];
      csvSel = {
        fecha: guessAny([/fecha operacion/,/fecha/,/date/]) || headers[0] || "",
        importe: guessAny([/importe/,/amount/,/cantidad/]) || headers[1] || headers[0] || "",
        nota: guessAny([/concepto/,/descripcion/,/detalle/,/movimiento/,/description/]),
        saldo: guessAny([/saldo/,/balance/]),
        cuenta: cuentaPorDefecto() || (cuentasActivas()[0] ? cuentasActivas()[0].id : "")
      };
      render();
    };
    reader.readAsArrayBuffer(file);
  };
  [["csvColFecha","fecha"],["csvColImporte","importe"],["csvColNota","nota"],["csvColSaldo","saldo"]].forEach(([id,k])=>{
    const el = document.getElementById(id);
    if(el) el.onchange = ()=>{ csvSel[k] = el.value; if(csvPreview.length){ csvPreview = []; render(); } };
  });
  const csvCuentaEl = document.getElementById("csvCuenta");
  if(csvCuentaEl) csvCuentaEl.onchange = ()=>{ csvSel.cuenta = csvCuentaEl.value; if(csvPreview.length){ calcularPreview(); render(); } };
  const csvPrevisualizar = document.getElementById("csvPrevisualizar");
  if(csvPrevisualizar) csvPrevisualizar.onclick = ()=>conCarga(csvPrevisualizar, "Cargando…", async ()=>{ await cargarHistoricoCompleto(); calcularPreview(); render(); });
  const csvImportar = document.getElementById("csvImportar");
  document.querySelectorAll("[data-decision]").forEach(sel=>sel.onchange=()=>{ csvDecisiones[sel.dataset.decision] = sel.value; render(); });
  if(csvImportar) csvImportar.onclick = ()=>conCarga(csvImportar, "Guardando…", async ()=>{
    const conciliar = csvPreview.filter(m=>!m.invalida && !m.dup && m.matchId && (csvDecisiones[m.posicion]||"igual")==="igual");
    const nuevas = csvPreview.filter(m=>!m.invalida && (!m.dup && (!m.matchId || (csvDecisiones[m.posicion]||"igual")==="distinto")));
    if(!csvSel.cuenta) return;
    for(const m of conciliar){
      const cambios = {conciliado:true};
      if(m.saldo!=null) cambios.saldo_banco = m.saldo;
      const {error} = await sb.from("movimientos").update(cambios).eq("id", m.matchId);
      if(error){ showError("No se pudo conciliar: "+error.message); return; }
    }
    if(nuevas.length){
      const filas = nuevas.map(m=>({
        cuenta_id: csvSel.cuenta, tipo:m.tipo, importe:m.importe, fecha:m.fecha, descripcion:m.nota||"", saldo:m.saldo, posicion:m.posicion
      }));
      const {error} = await sb.from("movimientos_pendientes").insert(filas);
      if(error){ showError("No se pudo importar: "+error.message); return; }
    }
    hideError(); csvHeaders=[]; csvFilas=[]; csvPreview=[]; csvSel={}; csvDecisiones={}; await recargar(["movimientos","movimientos_pendientes"]);
  });
  document.querySelectorAll('select[id^="pendCat-"]').forEach(el=>el.onchange = ()=>{ pendCats[el.id.slice(8)] = el.value; });
  document.querySelectorAll("[data-pend-confirmar]").forEach(b=>b.onclick=()=>conCarga(b, "…", async ()=>{
    const id = b.dataset.pendConfirmar;
    const cat = document.getElementById("pendCat-"+id)?.value;
    if(!cat){ showError("Elige una categoría antes de confirmar."); return; }
    const {error} = await sb.rpc("confirmar_pendiente", {p_id:id, p_categoria:cat});
    if(error){ showError("No se pudo confirmar: "+error.message); return; }
    delete pendCats[id]; hideError(); await recargar(["movimientos","movimientos_pendientes"]);
  }));
  document.querySelectorAll("[data-pend-descartar]").forEach(b=>b.onclick=()=>{
    if(!confirm("¿Descartar este movimiento? No se importará.")) return;
    conCarga(b, "…", async ()=>{
      const id = b.dataset.pendDescartar;
      const {error} = await sb.from("movimientos_pendientes").delete().eq("id", id);
      if(error){ showError("No se pudo descartar: "+error.message); return; }
      delete pendCats[id]; hideError(); await recargar(["movimientos_pendientes"]);
    });
  });
  const pendConfirmarTodos = document.getElementById("pendConfirmarTodos");
  if(pendConfirmarTodos) pendConfirmarTodos.onclick = ()=>conCarga(pendConfirmarTodos, "Confirmando…", async ()=>{
    const ids = [], cats = [];
    pendientes.forEach(p=>{ const c = document.getElementById("pendCat-"+p.id)?.value; if(c){ ids.push(p.id); cats.push(c); } });
    if(!ids.length){ showError("Elige la categoría de al menos un movimiento."); return; }
    const {error} = await sb.rpc("confirmar_pendientes", {p_ids:ids, p_categorias:cats});
    if(error){ showError("No se pudieron confirmar: "+error.message); return; }
    ids.forEach(id=>delete pendCats[id]); hideError(); await recargar(["movimientos","movimientos_pendientes"]);
  });
  const pendDescartarTodos = document.getElementById("pendDescartarTodos");
  if(pendDescartarTodos) pendDescartarTodos.onclick = ()=>{
    if(!confirm(`¿Descartar los ${pendientes.length} movimientos pendientes? No se importarán.`)) return;
    conCarga(pendDescartarTodos, "Descartando…", async ()=>{
      const {error} = await sb.from("movimientos_pendientes").delete().not("id","is",null);
      if(error){ showError("No se pudo descartar: "+error.message); return; }
      pendCats = {}; hideError(); await recargar(["movimientos_pendientes"]);
    });
  };
}
