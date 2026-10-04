// Pestaña «Recurrentes»: su render y sus eventos.

// Cuánto de cada gasto te han devuelto ya (reembolsos cobrados). Las deudas pendientes
// NO cuentan: hasta que se salden, el gasto sigue contando entero.

function recurrenteItem(r){
  return `
  <div class="item">
    <div style="min-width:0">
      <strong>${esc(r.categoria)}</strong>
      <span class="tag">${r.tipo==="ingreso"?"Ingreso":"Gasto"}</span>
      ${!r.activo?'<span class="tag">Pausado</span>':''}
      ${r.nota?`<div class="meta">${esc(r.nota)}</div>`:""}
      <div class="meta">${cuentaNombre(r.cuentaId)} · día ${r.diaMes} de cada mes</div>
      <div class="meta">${r.activo? "Próxima: "+proximaFechaRecurrente(r) : "En pausa, no genera movimientos"}</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
      <div class="amt ${r.tipo==='ingreso'?'pos':'neg'}">${eur(r.importe)}</div>
      <div style="display:flex;gap:6px">
        <button class="btn ghost" data-toggle-recurrente="${r.id}">${r.activo?"Pausar":"Reanudar"}</button>
        <button class="btn ghost" data-del-recurrente="${r.id}">Borrar</button>
      </div>
    </div>
  </div>`;
}

// Calendario de cuotas: los próximos cargos fijos con los días que faltan para cada uno.
function textoFaltan(dias){ return dias<=0 ? "Hoy" : dias===1 ? "Mañana" : `Faltan ${dias} días`; }
function renderCalendarioCuotas(){
  const hoy = today();
  const proximos = recurrentes.filter(r=>r.activo && r.tipo==="gasto")
    .map(r=>({r, fecha:proximaFechaRecurrente(r)})).map(x=>({...x, dias:Math.max(diasEntre(hoy, x.fecha), 0)}))
    .sort((a,b)=>a.dias-b.dias);
  if(!proximos.length) return "";
  const totalMes = sumaImportes(proximos, x=>x.r.importe);
  return `
  <div class="section-title" style="margin-top:0">Próximos cobros</div>
  <div class="cuotas">
    ${proximos.map(({r, fecha, dias})=>`
    <div class="cuota${dias<=3?" pronto":""}">
      <div class="cuota-ico">${emojiCategoria(r.categoria, "gasto")}</div>
      <strong>${esc(r.nota || r.categoria)}</strong>
      <div class="cuota-imp">${eur(r.importe)}</div>
      <div class="cuota-dias">${textoFaltan(dias)}</div>
      <div class="meta">${Number(fecha.slice(8))} ${MESES[Number(fecha.slice(5,7))-1].slice(0,3).toLowerCase()}</div>
    </div>`).join("")}
  </div>
  <p class="meta" style="margin:-4px 4px 14px">Cuotas fijas al mes: <strong style="color:var(--ink)">${eur(totalMes)}</strong></p>`;
}

function renderRecurrentes(){
  const items = [...recurrentes].sort((a,b)=> (a.activo===b.activo?0:(a.activo?-1:1)) || a.categoria.localeCompare(b.categoria));
  return `
  ${renderCalendarioCuotas()}
  <div class="card">
    <h2>Nuevo recurrente</h2>
    <p class="meta" style="margin:0 0 10px">Para suscripciones, nóminas u otros pagos o ingresos que se repiten cada mes. Se generan solos en la fecha que digas, sin que tengas que apuntarlos.</p>
    <form id="fRecurrente">
      <div class="row2">
        <div><label>Tipo</label><select name="tipo" id="recTipo"><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option></select></div>
        <div><label>Importe (${simboloMoneda()})</label><input name="importe" type="number" step="0.01" min="0.01" required></div>
      </div>
      <div class="row2">
        <div><label>Categoría</label><select name="categoria" id="recCategoria" required></select></div>
        <div><label>Día del mes</label><input name="diaMes" type="number" min="1" max="28" value="1" required></div>
      </div>
      <div><label>Nota (opcional)</label><input name="nota" placeholder="ej. Netflix"></div>
      <div class="row2">
        <div><label>Cuenta</label>${cuentasActivas().length? `<select name="cuentaId">${opcionesCuentas()}</select>` : `<div class="meta">Crea antes una cuenta.</div>`}</div>
        <div><label>Empieza el</label><input name="fechaInicio" type="date" value="${today()}" required></div>
      </div>
      <p class="meta" style="margin:0">El día máximo es 28 para que funcione igual en todos los meses, incluido febrero.</p>
      <button class="btn" type="submit" ${cuentasActivas().length?"":"disabled"}>Añadir</button>
    </form>
  </div>
  <div class="section-title">Recurrentes (${items.length})</div>
  <div class="list">
    ${items.length? items.map(recurrenteItem).join("") : `<div class="card">${vacio("nube","Sin pagos automáticos todavía","Añade tu nómina, el alquiler o las suscripciones y se apuntarán solos cada mes.")}</div>`}
  </div>`;
}

function wireEventosRecurrentes(){
  const recTipo = document.getElementById("recTipo");
  const recCategoria = document.getElementById("recCategoria");
  if(recTipo && recCategoria){
    const fill = ()=>{ recCategoria.innerHTML = opcionesCategoriaPend(recTipo.value, null); };
    fill(); recTipo.onchange = fill;
  }
  const fRecurrente = document.getElementById("fRecurrente");
  if(fRecurrente) fRecurrente.onsubmit = (e)=>{
    e.preventDefault();
    conCarga(fRecurrente.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const f = new FormData(fRecurrente);
      const data = {
        tipo: f.get("tipo"), categoria: f.get("categoria"), importe: parseFloat(f.get("importe")),
        nota: f.get("nota")||"", cuenta_id: f.get("cuentaId")||null,
        dia_mes: Math.min(Math.max(parseInt(f.get("diaMes"),10)||1,1),28), fecha_inicio: f.get("fechaInicio")
      };
      const {error} = await sb.from("recurrentes").insert(data);
      if(error){ showError("No se pudo guardar: "+error.message); return; }
      hideError(); fRecurrente.reset(); await recargar(["recurrentes","movimientos"], {procesar:true});
    });
  };
  document.querySelectorAll("[data-toggle-recurrente]").forEach(b=>b.onclick=()=>conCarga(b, "…", async ()=>{
    const r = recurrentes.find(x=>x.id===b.dataset.toggleRecurrente);
    if(!r) return;
    const {error} = await sb.from("recurrentes").update({activo: !r.activo}).eq("id", r.id);
    if(error){ showError("No se pudo actualizar: "+error.message); return; }
    hideError(); await recargar(["recurrentes","movimientos"], {procesar:true});
  }));
  document.querySelectorAll("[data-del-recurrente]").forEach(b=>b.onclick=async ()=>{
    if(!(await confirmar("¿Borrar este recurrente? Los movimientos que ya generó no se borran."))) return;
    conCarga(b, "Borrando…", async ()=>{
      const {error} = await sb.from("recurrentes").delete().eq("id", b.dataset.delRecurrente);
      if(error){ showError("No se pudo borrar: "+error.message); return; }
      hideError(); await recargar(["recurrentes"]);
    });
  });
}
