// Pestaña «Deudas»: su render y sus eventos.

function abonosDeDeuda(id){
  return movimientos.filter(m=>m.deudaId===id).sort((a,b)=>a.fecha.localeCompare(b.fecha));
}

function deudaItem(d){
  const pend = d.estado==='pendiente';
  const abonos = abonosDeDeuda(d.id);
  const abonado = Math.round(((d.importeInicial||d.importe) - d.importe)*100)/100;
  return `
  <div class="item" style="flex-direction:column;align-items:stretch;gap:10px;${pend?'':'opacity:.72'}">
    <div style="display:flex;align-items:center;gap:12px">
    <div class="ico-cat" style="border-radius:50%;background:${d.direccion==='me_deben'?'var(--mint-soft)':'var(--accent-soft)'};color:${d.direccion==='me_deben'?'var(--mint)':'var(--accent)'};font-weight:800;font-size:17px">${esc((d.persona||"?").trim().charAt(0).toUpperCase())}</div>
    <div style="min-width:0;flex:1">
      <strong style="font-size:15px">${esc(d.persona)}</strong>
      ${!pend?'<span class="tag">Saldada</span>':''}
      ${pend && d.direccion==='me_deben'? `<button class="tag" data-pres-deuda="${d.id}" style="cursor:pointer;border:none;font-family:inherit">${d.movimientoId? "Gasto: "+etiquetaGasto(d.movimientoId) : "+ Vincular gasto"}</button>` : (d.movimientoId? `<span class="tag">Gasto: ${etiquetaGasto(d.movimientoId)}</span>` : "")}
      ${d.concepto?`<div class="meta">${esc(d.concepto)}</div>`:""}
      <div class="meta">${d.fecha}</div>
      ${abonos.length? `<div class="meta">Importe inicial: ${eur(d.importeInicial)} · Abonado: ${eur(abonado)} · Pendiente: ${eur(d.importe)}</div>` : ""}
      ${abonos.length? `<button class="tag" data-ver-abonos="${d.id}" style="cursor:pointer;border:none;font-family:inherit;margin-top:4px">${verAbonosDeudaId===d.id?"Ocultar abonos":`Ver abonos (${abonos.length})`}</button>` : ""}
    </div>
    <div class="amt ${d.direccion==='me_deben'?'pos':'neg'}">${eur(d.importe)}</div>
    </div>
    <div class="chips">
      ${pend && saldarId!==d.id?`<button class="chip ok" data-saldar="${d.id}">Abonar</button>`:''}
      <button class="chip peligro" data-del-deuda="${d.id}">Borrar</button>
    </div>
  </div>
  ${verAbonosDeudaId===d.id? `
  <div style="padding:0 4px 10px">
    ${abonos.map(m=>`
      <div class="item" style="padding:8px 10px;margin-bottom:6px">
        <div><span class="tag">${m.fecha}</span><div class="meta">${cuentaNombre(m.cuentaId)}</div></div>
        <div class="amt ${d.direccion==='me_deben'?'pos':'neg'}">${eur(m.importe)}</div>
      </div>`).join("")}
  </div>` : ""}
  ${editarPresDeudaId===d.id? `
  <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
    <label>Gasto asociado</label>
    <select id="presDeudaSel"><option value="">Ninguno</option>${opcionesMovimientosGasto(d.movimientoId)}</select>
    <div class="meta">Hasta que la saldes no cambia nada; al cobrarla, esa cantidad dejará de contar como gasto tuyo.</div>
    <div style="display:flex;gap:8px">
      <button class="btn" data-confirmar-pres-deuda="${d.id}">Guardar</button>
      <button class="btn ghost" data-cancelar-pres-deuda="1">Cancelar</button>
    </div>
  </div>` : ""}
  ${saldarId===d.id? `
  <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
    <label>Importe a abonar (€) — máximo ${eur(d.importe)}</label>
    <input type="number" step="0.01" min="0.01" max="${d.importe}" id="saldarImporte" value="${d.importe}">
    <p class="meta" style="margin:0">Si abonas menos del total, la deuda queda pendiente por el resto.</p>
    <label>${d.direccion==='me_deben'?'¿A qué cuenta entra el pago?':'¿De qué cuenta sale el pago?'}</label>
    ${cuentasActivas().length? `<select id="saldarCuenta">${opcionesCuentas()}</select>` : `<div class="meta">Crea antes una cuenta en la pestaña "Cuentas".</div>`}
    ${d.direccion==='debo'? `
    <label>Categoría del gasto (opcional)</label>
    <select id="saldarCat"><option value="">Deuda (sin categoría)</option>${opcionesCategoriasGasto()}</select>
    <div class="meta">Al pagarlo cuenta como gasto en esa categoría, y por tanto en su presupuesto.</div>` : (d.movimientoId? `<div class="meta">Al cobrarlo se registra como reembolso de ese gasto: rebaja ese gasto y no cuenta como ingreso.</div>` : `<div class="meta">Sin gasto vinculado, el cobro cuenta como un ingreso normal.</div>`)}
    <div style="display:flex;gap:8px">
      <button class="btn" data-confirmar-saldar="${d.id}" ${cuentasActivas().length?"":"disabled"}>Confirmar</button>
      <button class="btn ghost" data-cancelar-saldar="1">Cancelar</button>
    </div>
  </div>` : ""}`;
}

function renderDeudas(){
  const lado = deudaLado === "debo" ? "debo" : "me_deben";
  const pendMe = deudas.filter(d=>d.direccion==="me_deben" && d.estado==="pendiente");
  const pendDebo = deudas.filter(d=>d.direccion==="debo" && d.estado==="pendiente");
  const totMe = pendMe.reduce((sum,d)=>sumarDinero(sum, d.importe),0);
  const totDebo = pendDebo.reduce((sum,d)=>sumarDinero(sum, d.importe),0);
  const porFecha = (a,b)=>b.fecha.localeCompare(a.fecha);
  const pend = (lado==="me_deben" ? pendMe : pendDebo).slice().sort(porFecha);
  const saldadas = deudas.filter(d=>d.direccion===lado && d.estado==="saldado").sort(porFecha);
  const porPersona = {};
  pend.forEach(d=>{ const k = d.persona.trim().toLowerCase(); (porPersona[k] = porPersona[k] || {nombre:d.persona.trim(), total:0, n:0}); porPersona[k].total = sumarDinero(porPersona[k].total, d.importe); porPersona[k].n++; });
  const personas = Object.values(porPersona).sort((a,b)=>b.total-a.total);
  const tarjetaLado = (clave, titulo, total, n, clase)=>`
    <div class="lado ${clase} ${lado===clave?'activo':''}" data-lado-deuda="${clave}" role="button">
      <div class="meta" style="font-weight:700">${titulo}</div>
      <div class="cifra ${clase}">${eur(total)}</div>
      <div class="meta">${n} pendiente${n===1?"":"s"}</div>
    </div>`;
  return `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
    ${tarjetaLado("me_deben","Me deben",totMe,pendMe.length,"pos")}
    ${tarjetaLado("debo","Debo",totDebo,pendDebo.length,"neg")}
  </div>
  <div class="card">
    <h2>Nueva deuda</h2>
    <form id="fDeuda">
      <div class="row2">
        <div><label>Persona</label><input name="persona" placeholder="ej. Marta" required></div>
        <div><label>Importe (€)</label><input name="importe" type="number" step="0.01" min="0.01" required></div>
      </div>
      <div class="row2">
        <div><label>Dirección</label><select name="direccion"><option value="debo"${lado==="debo"?" selected":""}>Yo debo</option><option value="me_deben"${lado==="me_deben"?" selected":""}>Me deben</option></select></div>
        <div><label>Fecha</label><input name="fecha" type="date" value="${today()}" required></div>
      </div>
      <div><label>Concepto</label><input name="concepto" placeholder="ej. cena cumpleaños"></div>
      <div id="deudaMovWrap" style="display:none"><label>Gasto asociado (opcional)</label>
        <select name="movimientoId"><option value="">Ninguno</option>${opcionesMovimientosGasto()}</select>
        <div class="meta" style="margin-top:4px">Si te deben parte de un gasto que pagaste tú, elígelo. Hasta que la saldes no cambia nada; al cobrarla, esa cantidad dejará de contar como gasto tuyo (mes, resumen y presupuesto).</div>
      </div>
      <button class="btn" type="submit">Añadir</button>
    </form>
  </div>
  <div class="section-title">${lado==="me_deben" ? "Lo que me deben" : "Lo que debo"} (${pend.length})</div>
  ${personas.length>1 ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${personas.map(x=>`<span class="tag">${esc(x.nombre.charAt(0).toUpperCase()+x.nombre.slice(1))} · ${eur(x.total)}</span>`).join("")}</div>` : ""}
  <div class="list">
    ${pend.length ? pend.map(deudaItem).join("") : `<div class="card">${lado==="me_deben" ? vacio("nube","Nadie te debe nada","Cuentas claras y amistades largas ✨") : vacio("hucha","¡No debes nada!","Tu hucha duerme tranquila.")}</div>`}
  </div>
  ${saldadas.length ? `
  <div data-toggle-saldadas="${lado}" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin-top:18px;padding:6px 2px">
    <span class="section-title" style="margin:0">Saldadas (${saldadas.length})</span>
    <span class="meta">${saldadasAbiertas[lado] ? "▾ Ocultar" : "▸ Ver"}</span>
  </div>
  ${saldadasAbiertas[lado] ? `<div class="list" style="margin-top:8px">${saldadas.map(deudaItem).join("")}</div>` : ""}` : ""}`;
}

function wireEventosDeudas(){
  document.querySelectorAll("[data-lado-deuda]").forEach(b=>b.onclick=()=>{ deudaLado = b.dataset.ladoDeuda; saldarId = null; editarPresDeudaId = null; render(); });
  document.querySelectorAll("[data-ver-abonos]").forEach(b=>b.onclick=()=>{ verAbonosDeudaId = verAbonosDeudaId===b.dataset.verAbonos ? null : b.dataset.verAbonos; if(!asegurarMovimientosDesde(deudas.find(d=>d.id===verAbonosDeudaId)?.fecha)) render(); });
  document.querySelectorAll("[data-toggle-saldadas]").forEach(b=>b.onclick=()=>{ const k = b.dataset.toggleSaldadas; saldadasAbiertas[k] = !saldadasAbiertas[k]; render(); });
  const fDeuda = document.getElementById("fDeuda");
  const fDeudaDir = fDeuda ? fDeuda.querySelector('select[name="direccion"]') : null;
  const deudaMovWrap = document.getElementById("deudaMovWrap");
  if(fDeudaDir && deudaMovWrap){
    const t = ()=>{ deudaMovWrap.style.display = fDeudaDir.value==="me_deben" ? "block" : "none"; };
    t(); fDeudaDir.onchange = t;
  }
  if(fDeuda) fDeuda.onsubmit = (e)=>{
    e.preventDefault();
    conCarga(fDeuda.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const f = new FormData(fDeuda);
      const impInicial = parseFloat(f.get("importe"));
      const data = {persona:f.get("persona"), importe:impInicial, importe_inicial:impInicial, direccion:f.get("direccion"), fecha:f.get("fecha"), concepto:f.get("concepto")||"", estado:"pendiente", movimiento_id: f.get("direccion")==="me_deben" ? (f.get("movimientoId")||null) : null};
      const {error} = await sb.from("deudas").insert(data);
      if(error){ showError("No se pudo guardar la deuda: "+error.message); return; }
      deudaLado = data.direccion==="debo" ? "debo" : "me_deben";
      hideError(); fDeuda.reset(); await recargar(["deudas"]);
    });
  };
  document.querySelectorAll("[data-del-deuda]").forEach(b=>b.onclick=async ()=>{
    if(!(await confirmar("¿Borrar esta deuda?"))) return;
    conCarga(b, "Borrando…", async ()=>{
      const {error} = await sb.from("deudas").delete().eq("id", b.dataset.delDeuda);
      if(error){ showError("No se pudo borrar: "+error.message); return; }
      hideError(); await recargar(["deudas","movimientos"]);
    });
  });
  document.querySelectorAll("[data-pres-deuda]").forEach(b=>b.onclick=()=>{ editarPresDeudaId = b.dataset.presDeuda; saldarId = null; render(); });
  document.querySelectorAll("[data-cancelar-pres-deuda]").forEach(b=>b.onclick=()=>{ editarPresDeudaId = null; render(); });
  document.querySelectorAll("[data-confirmar-pres-deuda]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
    const id = b.dataset.confirmarPresDeuda;
    const mov = document.getElementById("presDeudaSel")?.value || null;
    const {error} = await sb.from("deudas").update({movimiento_id: mov}).eq("id", id);
    if(error){ showError("No se pudo guardar: "+error.message); return; }
    hideError(); editarPresDeudaId = null; await recargar(["deudas"]);
  }));
  document.querySelectorAll("[data-saldar]").forEach(b=>b.onclick=()=>{ saldarId = b.dataset.saldar; editarPresDeudaId = null; render(); });
  document.querySelectorAll("[data-cancelar-saldar]").forEach(b=>b.onclick=()=>{ saldarId = null; render(); });
  document.querySelectorAll("[data-confirmar-saldar]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
    const deudaId = b.dataset.confirmarSaldar;
    const sel = document.getElementById("saldarCuenta");
    if(!sel || !sel.value) return;
    const importe = parseFloat(document.getElementById("saldarImporte")?.value);
    if(isNaN(importe) || importe<=0){ showError("Escribe un importe válido."); return; }
    const cat = document.getElementById("saldarCat")?.value || null;
    const {error} = await sb.rpc("saldar_deuda", {p_deuda_id: deudaId, p_cuenta_id: sel.value, p_categoria: cat, p_importe: importe});
    if(error){ showError("No se pudo saldar la deuda: "+error.message); return; }
    hideError(); saldarId = null; await recargar(["deudas","movimientos"]);
  }));
}
