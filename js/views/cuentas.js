// Pestaña «Cuentas»: su render y sus eventos.

function nMovCuenta(c){
  return movParcial ? movResumen.filter(r=>r.cuentaId===c.id).reduce((s,r)=>s+r.n,0) : movimientos.filter(m=>m.cuentaId===c.id).length;
}

function textoCompartida(c){
  if(!c.propia) return `👥 Compartida por ${esc(cuentasMiembros.find(m=>m.cuentaId===c.id)?.propietarioEmail || "otra persona")}`;
  const ms = miembrosDe(c.id);
  return ms.length ? `👥 Compartida con ${ms.map(m=>esc(m.email)).join(", ")}` : "";
}

function panelCompartir(c){
  if(!esPremium) return `${avisoPremium("compartir")}<button class="btn ghost" data-cerrar-compartir="1">Cerrar</button>`;
  const ms = miembrosDe(c.id);
  return `
    ${ms.map(m=>`<div class="miembro"><span>${esc(m.email)}</span><button class="chip peligro" data-quitar-miembro="${m.userId}" data-cuenta="${c.id}">Quitar</button></div>`).join("")}
    <label for="compartirEmail">Email de la otra persona</label>
    <input type="email" id="compartirEmail" placeholder="nombre@correo.com" autocomplete="off">
    <p class="meta" style="margin:0">Tiene que tener cuenta en la app. Los dos veréis la cuenta y podréis apuntar, editar y borrar sus movimientos. Solo tú puedes archivarla o quitar a alguien.</p>
    <div style="display:flex;gap:8px">
      <button class="btn" data-invitar="${c.id}">Compartir</button>
      <button class="btn ghost" data-cerrar-compartir="1">Cerrar</button>
    </div>`;
}

function renderCuentas(){
  const items = cuentasActivas().sort(porOrden);
  const archivadas = cuentas.filter(c=>c.archivada).sort(porOrden);
  const total = sumaImportes(cuentas, saldoCuenta);
  const positivas = items.map((c,k)=>({c,k,saldo:saldoCuenta(c)})).filter(x=>x.saldo>0);
  const totalPos = positivas.reduce((s,x)=>sumarDinero(s, x.saldo),0);
  const resumen = items.length ? `
  <div class="card">
    <div class="meta" style="font-weight:600">Saldo total en cuentas</div>
    <div style="font-size:34px;font-weight:800;letter-spacing:-0.02em;font-variant-numeric:tabular-nums;margin-top:2px" class="${total>=0?'':'neg'}">${eur(total)}</div>
    ${totalPos>0? `
    <div style="display:flex;height:10px;border-radius:999px;overflow:hidden;margin-top:14px;gap:2px">
      ${positivas.map(x=>`<div style="width:${x.saldo/totalPos*100}%;background:${PALETTE[x.k%PALETTE.length]}"></div>`).join("")}
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px">
      ${positivas.map(x=>`<span class="meta" style="display:flex;align-items:center;gap:6px"><span style="width:9px;height:9px;border-radius:50%;background:${PALETTE[x.k%PALETTE.length]}"></span>${esc(x.c.nombre)} ${(x.saldo/totalPos*100).toFixed(0)}%</span>`).join("")}
    </div>` : ""}
  </div>` : "";
  const tarjetas = items.map((c,k)=>{
    const saldo = saldoCuenta(c);
    const col = PALETTE[k%PALETTE.length];
    const nMov = nMovCuenta(c);
    return `
    <div class="sort-item" data-sort-id="${c.id}"><div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
        <div style="display:flex;align-items:center;gap:12px;min-width:0">
          ${items.length>1? gripHtml() : ""}
          <div style="width:44px;height:44px;border-radius:50%;background:${col}26;color:${col};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;flex-shrink:0">${esc((c.nombre||"?").trim().charAt(0).toUpperCase())}</div>
          <div style="min-width:0"><strong style="font-size:16px">${esc(c.nombre)}</strong><div class="meta">Inicial ${eur(c.saldoInicial||0)} · ${nMov} movimiento${nMov===1?"":"s"}</div>${cuentaCompartida(c) ? `<div class="meta">${textoCompartida(c)}</div>` : ""}</div>
        </div>
        <div style="font-size:19px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap" class="${saldo>=0?'':'neg'}">${eur(saldo)}</div>
      </div>
      <div class="chips" style="margin-top:14px">
        ${ajustarSaldoId!==c.id?`<button class="chip" data-ajustar-saldo="${c.id}">Ajustar saldo</button>`:""}
        ${c.propia && compartirCuentaId!==c.id ? `<button class="chip lav" data-compartir-cuenta="${c.id}">Compartir</button>` : ""}
        ${!c.propia ? `<button class="chip peligro" data-salir-cuenta="${c.id}">Salir</button>`
          : `${nMov ? `<button class="chip" data-archivar-cuenta="${c.id}" style="background:var(--line);color:var(--muted)">Archivar</button>` : ""}<button class="chip peligro" data-del-cuenta="${c.id}">Borrar</button>`}
      </div>
      ${compartirCuentaId===c.id && c.propia ? `
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)">${panelCompartir(c)}</div>` : ""}
      ${ajustarSaldoId===c.id? `
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)">
        <label>Saldo real actual (€)</label>
        <input type="number" step="0.01" id="saldoRealInput" value="${saldo.toFixed(2)}">
        <p class="meta" style="margin:0">Se creará un movimiento de "Ajuste" por la diferencia, así el histórico queda intacto.</p>
        <div style="display:flex;gap:8px">
          <button class="btn" data-confirmar-ajuste="${c.id}">Guardar</button>
          <button class="btn ghost" data-cancelar-ajuste="1">Cancelar</button>
        </div>
      </div>` : ""}
    </div></div>`;
  }).join("");
  return `
  <div class="card">
    <h2>Añadir cuenta</h2>
    <form id="fCuenta">
      <div class="row2">
        <div><label>Nombre</label><input name="nombre" placeholder="ej. Trade Republic" required></div>
        <div><label>Saldo inicial (€)</label><input name="saldoInicial" type="number" step="0.01" value="0" required></div>
      </div>
      <button class="btn" type="submit">Añadir</button>
    </form>
  </div>
  ${resumen}
  ${tarjetas ? `<div data-sortable="ordenar_cuentas">${tarjetas}</div>` : `<div class="card">${vacio("hucha","Tu hucha está vacía","Crea tu primera cuenta arriba para empezar a llenarla.")}</div>`}
  ${archivadas.length ? `
  <div class="card">
    <h2>Archivadas</h2>
    <p class="meta" style="margin:-6px 0 10px">Siguen contando en tu patrimonio, pero no aparecen al apuntar movimientos.</p>
    <div class="list">${archivadas.map(c=>`
      <div class="item">
        <div style="min-width:0"><strong style="font-size:16px">${esc(c.nombre)}</strong><div class="meta">${eur(saldoCuenta(c))}</div></div>
        <div style="display:flex;gap:6px">
          ${!c.propia ? `<button class="btn ghost" data-salir-cuenta="${c.id}">Salir</button>` : `
          <button class="btn ghost" data-desarchivar-cuenta="${c.id}" style="color:var(--accent)">Reactivar</button>
          <button class="btn ghost" data-del-cuenta="${c.id}">Borrar</button>`}
        </div>
      </div>`).join("")}</div>
  </div>` : ""}`;
}

function wireEventosCuentas(){
  const fCuenta = document.getElementById("fCuenta");
  if(fCuenta) fCuenta.onsubmit = (e)=>{
    e.preventDefault();
    conCarga(fCuenta.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const f = new FormData(fCuenta);
      const data = {nombre:f.get("nombre"), saldo_inicial:parseFloat(f.get("saldoInicial")), orden:siguienteOrdenLista(cuentas)};
      const {error} = await sb.from("cuentas").insert(data);
      if(error){ showError("No se pudo guardar la cuenta: "+error.message); return; }
      hideError(); fCuenta.reset(); await recargar(["cuentas"]);
    });
  };
  const archivarCuenta = (b, id, archivada)=>conCarga(b, "Guardando…", async ()=>{
    const {error} = await sb.from("cuentas").update({archivada}).eq("id", id);
    if(error){ showError("No se pudo archivar. ¿Has ejecutado schema_cuentas_archivadas.sql en Supabase? ("+error.message+")"); return; }
    if(archivada && cuentaDefecto===id) await guardarCuentaDefecto("");
    hideError(); await recargar(["cuentas"]);
  });
  document.querySelectorAll("[data-archivar-cuenta]").forEach(b=>b.onclick=async ()=>{
    const c = cuentas.find(x=>x.id===b.dataset.archivarCuenta);
    const saldo = c ? saldoCuenta(c) : 0;
    const aviso = saldo!==0 ? ` Todavía tiene ${eur(saldo)}, que seguirá contando en tu patrimonio.` : "";
    if(!(await confirmar("¿Archivar esta cuenta? Conservas su historial y dejará de salir al apuntar movimientos."+aviso))) return;
    archivarCuenta(b, b.dataset.archivarCuenta, true);
  });
  document.querySelectorAll("[data-desarchivar-cuenta]").forEach(b=>b.onclick=()=>archivarCuenta(b, b.dataset.desarchivarCuenta, false));
  // Borrar una cuenta borra también sus movimientos y recurrentes (la base de datos solo los dejaría sin cuenta).
  document.querySelectorAll("[data-del-cuenta]").forEach(b=>b.onclick=async ()=>{
    const id = b.dataset.delCuenta;
    const c = cuentas.find(x=>x.id===id);
    const n = c ? nMovCuenta(c) : 0;
    const aviso = n ? `Se borrará${n===1?" también su movimiento":`n también sus ${n} movimientos`} y no se puede deshacer. Si quieres conservar el historial, archívala.` : "No se puede deshacer.";
    if(!(await confirmar(`¿Borrar la cuenta ${c?.nombre || ""}? ${aviso}`, {ok:"Sí, borrar", icono:"🗑️"}))) return;
    conCarga(b, "Borrando…", async ()=>{
      for(const tabla of ["movimientos","recurrentes"]){
        const {error} = await sb.from(tabla).delete().eq("cuenta_id", id);
        if(error){ showError("No se pudo borrar: "+error.message); return; }
      }
      const {error} = await sb.from("cuentas").delete().eq("id", id);
      if(error){ showError("No se pudo borrar: "+error.message); return; }
      if(cuentaDefecto===id) await guardarCuentaDefecto("");
      hideError(); await recargar(["cuentas","movimientos","recurrentes","objetivos"]);
    });
  });
  document.querySelectorAll("[data-compartir-cuenta]").forEach(b=>b.onclick=()=>{ compartirCuentaId = b.dataset.compartirCuenta; pendienteEnfoque = esPremium ? "compartirEmail" : null; render(); });
  document.querySelectorAll("[data-cerrar-compartir]").forEach(b=>b.onclick=()=>{ compartirCuentaId = null; render(); });
  const recargarCompartidas = ()=>recargar(["cuentas","cuentas_miembros","movimientos","recurrentes"]);
  document.querySelectorAll("[data-invitar]").forEach(b=>b.onclick=()=>conCarga(b, "Compartiendo…", async ()=>{
    const email = document.getElementById("compartirEmail")?.value.trim();
    if(!email){ showError("Escribe el email de la otra persona."); return; }
    const {error} = await sb.rpc("compartir_cuenta", {p_cuenta: b.dataset.invitar, p_email: email});
    if(error){ showError(error.code==="PGRST202" ? "Falta ejecutar schema_cuentas_compartidas.sql en Supabase." : error.message); return; }
    hideError(); await recargarCompartidas();
  }));
  const dejar = (b, cuentaId, userId)=>conCarga(b, "Guardando…", async ()=>{
    const {error} = await sb.rpc("dejar_de_compartir", {p_cuenta: cuentaId, p_user: userId});
    if(error){ showError("No se pudo: "+error.message); return; }
    hideError(); await recargarCompartidas();
  });
  document.querySelectorAll("[data-quitar-miembro]").forEach(b=>b.onclick=async ()=>{
    if(!(await confirmar("¿Dejar de compartir esta cuenta con esta persona? Lo que apuntó se queda en la cuenta."))) return;
    dejar(b, b.dataset.cuenta, b.dataset.quitarMiembro);
  });
  document.querySelectorAll("[data-salir-cuenta]").forEach(b=>b.onclick=async ()=>{
    if(!(await confirmar("¿Salir de esta cuenta compartida? Dejarás de verla y lo que apuntaste se queda en ella."))) return;
    if(cuentaDefecto===b.dataset.salirCuenta) await guardarCuentaDefecto("");
    dejar(b, b.dataset.salirCuenta, session.user.id);
  });
  document.querySelectorAll("[data-ajustar-saldo]").forEach(b=>b.onclick=()=>{ ajustarSaldoId = b.dataset.ajustarSaldo; pendienteEnfoque = "saldoRealInput"; render(); });
  document.querySelectorAll("[data-cancelar-ajuste]").forEach(b=>b.onclick=()=>{ ajustarSaldoId = null; render(); });
  document.querySelectorAll("[data-confirmar-ajuste]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
    const cuentaId = b.dataset.confirmarAjuste;
    const nuevo = parseFloat(document.getElementById("saldoRealInput")?.value);
    if(isNaN(nuevo)) return;
    const c = cuentas.find(x=>x.id===cuentaId);
    // En una compartida el saldo incluye lo que apunta la otra persona, que la RPC no ve: el ajuste se calcula aquí.
    const dif = c && cuentaCompartida(c) ? restarDinero(nuevo, saldoCuenta(c)) : null;
    if(dif===0){ ajustarSaldoId = null; render(); return; }
    const {error} = dif!=null
      ? await sb.from("movimientos").insert({tipo:dif>0?"ingreso":"gasto", categoria:"Ajuste", importe:Math.abs(dif), fecha:today(), nota:"Ajuste de saldo", cuenta_id:cuentaId})
      : await sb.rpc("ajustar_saldo_cuenta", {p_cuenta_id: cuentaId, p_saldo_real: nuevo});
    if(error){ showError("No se pudo ajustar el saldo: "+error.message); return; }
    hideError(); ajustarSaldoId = null; await recargar(["cuentas","movimientos"]);
  }));
}
