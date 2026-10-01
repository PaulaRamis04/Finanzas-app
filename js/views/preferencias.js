// Pestaña «Preferencias»: su render y sus eventos.

function renderPreferencias(){
  const def = cuentaPorDefecto();
  return `
  <div class="card">
    <h2>Cuenta por defecto</h2>
    <p class="meta" style="margin:0 0 10px">Es la cuenta que aparece ya seleccionada cuando añades un movimiento, aportas o rescatas de una inversión, o saldas una deuda. Siempre puedes elegir otra en cada caso.</p>
    ${cuentasActivas().length? `<select id="prefCuenta"><option value="">Ninguna (la primera de la lista)</option>${cuentasActivas().map(c=>`<option value="${c.id}"${c.id===def?" selected":""}>${esc(c.nombre)}</option>`).join("")}</select>` : `<div class="meta">Crea antes una cuenta en la pestaña "Cuentas".</div>`}
    <div class="meta" id="prefEstado" style="margin-top:8px"></div>
  </div>
  <div class="card">
    <h2>Formularios para añadir</h2>
    <p class="meta" style="margin:0 0 10px">Los huecos para añadir un movimiento, una deuda, una cuenta, una inversión, etc. pueden salir desplegados o contraídos al entrar. Se abren y cierran tocando su título. Esta preferencia se guarda en este dispositivo.</p>
    <select id="prefForms">
      <option value="abiertos"${formsPorDefecto==="abiertos"?" selected":""}>Desplegados por defecto</option>
      <option value="cerrados"${formsPorDefecto==="cerrados"?" selected":""}>Contraídos por defecto</option>
    </select>
  </div>
  <div class="card">
    <h2>Copia de seguridad</h2>
    <p class="meta" style="margin:0 0 10px">Descarga un archivo con todos tus datos (movimientos, cuentas, deudas, inversiones, presupuestos, objetivos, categorías...) tal como están ahora mismo.</p>
    <button class="btn" id="btnExportar">Descargar copia (.json)</button>
    <p class="meta" style="margin:16px 0 10px">Para recuperar una copia, ábrela aquí. Solo funciona en una cuenta sin datos, para no duplicar nada.</p>
    <input type="file" id="copiaArchivo" accept=".json,application/json" style="display:none">
    <button class="btn gold" id="btnRestaurar">Restaurar copia…</button>
  </div>
  <div class="card">
    <h2>Eliminar cuenta y datos</h2>
    <p class="meta" style="margin:0 0 10px">Borra para siempre tu cuenta y todo lo que has guardado en la app: movimientos, cuentas, deudas, inversiones, objetivos, mensajes, suscripción... Las cuentas que compartías dejarán de verse para las demás personas. No se puede deshacer, así que si quieres conservar algo descarga antes una copia.</p>
    <p class="meta" style="margin:0 0 6px">Para confirmar, escribe <b>ELIMINAR</b>:</p>
    <input id="borrarCuentaTexto" autocomplete="off" autocapitalize="characters" placeholder="ELIMINAR" style="margin-bottom:10px">
    <button class="btn ghost" id="btnBorrarCuenta" disabled>Eliminar mi cuenta y mis datos</button>
  </div>`;
}

function wireEventosPreferencias(){
  const btnExportar = document.getElementById("btnExportar");
  if(btnExportar) btnExportar.onclick = ()=>conCarga(btnExportar, "Preparando…", async ()=>{
    await cargarHistoricoCompleto();
    // Las cuentas que otra persona comparte contigo no son tuyas: no van en la copia.
    const ajenas = new Set(cuentas.filter(c=>!c.propia).map(c=>c.id));
    const movs = movimientos.filter(m=>!ajenas.has(m.cuentaId));
    const ids = new Set(movs.map(m=>m.id));
    const soloPropio = a=>ajenas.has(a.cuentaId) || (a.movimientoId && !ids.has(a.movimientoId)) ? {...a, cuentaId:ajenas.has(a.cuentaId)?null:a.cuentaId, movimientoId:ids.has(a.movimientoId)?a.movimientoId:null} : a;
    const datos = {
      exportado_en: new Date().toISOString(),
      cuentas: cuentas.filter(c=>c.propia),
      movimientos: movs.map(m=>m.reembolsoDe && !ids.has(m.reembolsoDe) ? {...m, reembolsoDe:null} : m),
      deudas: deudas.map(d=>d.movimientoId && !ids.has(d.movimientoId) ? {...d, movimientoId:null} : d),
      aportaciones: aportaciones.map(soloPropio), retiros: retiros.map(soloPropio),
      inversiones, categorias, presupuestos, objetivos,
      recurrentes: recurrentes.map(r=>ajenas.has(r.cuentaId) ? {...r, cuentaId:null} : r)
    };
    const blob = new Blob([JSON.stringify(datos, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `finanzas-backup-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  });
  const btnRestaurar = document.getElementById("btnRestaurar");
  const copiaArchivo = document.getElementById("copiaArchivo");
  if(btnRestaurar && copiaArchivo){
    btnRestaurar.onclick = ()=>{ copiaArchivo.value = ""; copiaArchivo.click(); };
    copiaArchivo.onchange = ()=>{
      const archivo = copiaArchivo.files[0];
      if(!archivo) return;
      conCarga(btnRestaurar, "Leyendo…", async ()=>{
        let copia;
        try{ copia = leerCopia(await archivo.text()); }catch(e){ showError(e.message); return; }
        const f = copia.filas;
        const fecha = new Date(copia.exportadoEn).toLocaleString("es-ES");
        if(!(await confirmar(`Copia del ${fecha}: ${f.cuentas.length} cuentas, ${f.movimientos.length} movimientos, ${f.deudas.length} deudas, ${f.inversiones.length} inversiones y ${f.objetivos.length} objetivos. ¿Restaurarla?`))) return;
        try{
          await restaurarCopia(copia, txt=>{ btnRestaurar.textContent = txt; });
        }catch(e){ showError("No se pudo restaurar y no se ha guardado nada: "+e.message); return; }
        hideError(); tab = "Inicio"; await fetchAll();
      });
    };
  }
  const borrarTexto = document.getElementById("borrarCuentaTexto");
  const btnBorrar = document.getElementById("btnBorrarCuenta");
  if(borrarTexto && btnBorrar){
    borrarTexto.oninput = ()=>{ btnBorrar.disabled = borrarTexto.value.trim().toUpperCase() !== "ELIMINAR"; };
    btnBorrar.onclick = async ()=>{
      if(!(await confirmar("¿Borrar tu cuenta y todos tus datos? Se eliminarán para siempre y no podrás recuperarlos.", {ok:"Sí, borrar mi cuenta"}))) return;
      conCarga(btnBorrar, "Eliminando…", async ()=>{
        const {error} = await sb.rpc("borrar_mi_cuenta");
        if(error){ showError("No se pudo eliminar la cuenta: "+error.message); return; }
        // El usuario ya no existe en el servidor: se cierra la sesión solo en este dispositivo.
        await sb.auth.signOut({scope:"local"});
      });
    };
  }
  const prefForms = document.getElementById("prefForms");
  if(prefForms) prefForms.onchange = ()=>{
    formsPorDefecto = prefForms.value === "cerrados" ? "cerrados" : "abiertos";
    formsEstado = {};
    try{ localStorage.setItem("formsPorDefecto", formsPorDefecto); }catch(e){}
  };
  const prefCuenta = document.getElementById("prefCuenta");
  if(prefCuenta) prefCuenta.onchange = async ()=>{
    const estado = document.getElementById("prefEstado");
    if(estado) estado.textContent = "Guardando…";
    const ok = await guardarCuentaDefecto(prefCuenta.value);
    if(estado) estado.textContent = ok ? "Guardado" : "";
  };
}
