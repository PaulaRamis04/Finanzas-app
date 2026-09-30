// Pestaña «Presupuestos»: su render y sus eventos.

function renderPresupuestos(){
  const enP = movimientosEfectivos().filter(m=>m.tipo==="gasto" && m.categoria!=="Inversión");
  const cubiertoCat = {};
  const gastoPorCat = {};
  enP.forEach(m=>{ gastoPorCat[m.categoria] = sumarDinero(gastoPorCat[m.categoria]||0, m.importe); if(m.cubierto) cubiertoCat[m.categoria] = sumarDinero(cubiertoCat[m.categoria]||0, m.cubierto); });
  const catsGasto = categorias.filter(c=>c.tipo==="gasto").map(c=>c.nombre);
  const catsSinPresupuesto = catsGasto.filter(c=>!presupuestos.some(p=>p.categoria===c));
  const lbl = periodoMes==="todos" ? `Año ${periodoAnio}` : `${MESES[Number(periodoMes)-1]} ${periodoAnio}`;
  const mult = periodoMes==="todos" ? 12 : 1;
  const totalLimite = presupuestos.reduce((s,p)=>sumarDinero(s, p.limite*mult),0);
  const totalGastado = presupuestos.reduce((s,p)=>sumarDinero(s, (gastoPorCat[p.categoria]||0)),0);
  const totalPct = totalLimite>0 ? Math.max(0, totalGastado/totalLimite*100) : 0;
  const totalPasado = totalGastado > totalLimite;
  const bloqueTotal = presupuestos.length ? `
  <div class="card">
    <div class="meta" style="font-weight:600">Gastado de lo presupuestado · ${lbl}</div>
    <div style="display:flex;align-items:flex-end;gap:8px;flex-wrap:wrap;margin:4px 0 12px">
      <span style="font-size:34px;font-weight:800;letter-spacing:-0.02em;font-variant-numeric:tabular-nums" class="${totalPasado?'neg':''}">${eur(totalGastado)}</span>
      <span class="meta" style="padding-bottom:7px;font-size:14px">de ${eur(totalLimite)} ${mult===12?"al año":"al mes"} · ${totalPct.toFixed(0)}%</span>
    </div>
    <div class="barra"><div style="width:${Math.min(totalPct,100)}%;background:${totalPasado?'var(--neg)':totalPct>=80?'#e0ac4e':'var(--mint)'}"></div></div>
    ${mult===12? `<p class="meta" style="margin:8px 0 0">Vista anual: cada límite mensual se multiplica por 12.</p>` : ""}
    ${totalPasado? `<p class="meta" style="margin:8px 0 0;color:var(--neg)">Has superado el total presupuestado en ${eur(restarDinero(totalGastado, totalLimite))}</p>` : ""}
  </div>` : "";

  return `
  ${bloqueTotal}
  <div class="card">
    <h2>Nuevo presupuesto</h2>
    <form id="fPresupuesto">
      <div class="row2">
        <div><label>Categoría</label>
          ${catsSinPresupuesto.length? `<select name="categoria">${catsSinPresupuesto.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("")}</select>` : `<div class="meta">Todas tus categorías de gasto ya tienen presupuesto.</div>`}
        </div>
        <div><label>Límite mensual (€)</label><input name="limite" type="number" step="0.01" min="0" required></div>
      </div>
      <button class="btn" type="submit" ${catsSinPresupuesto.length?"":"disabled"}>Añadir</button>
    </form>
    <p class="meta" style="margin:10px 0 0">Después de crearlo puedes activarle "remanente": lo que te sobre o te pases un mes se suma o resta al límite del siguiente.</p>
  </div>
  <div class="section-title">Presupuestos · ${lbl}</div>
  <div class="list">
    ${presupuestos.length? presupuestos.map(p=>{
      const rolloverImp = rolloverAcumulado(p);
      const limiteEf = mult===12 ? redondearDinero(p.limite*mult) : sumarDinero(p.limite, rolloverImp);
      const ajuste = cubiertoCat[p.categoria] || 0;
      const gastado = gastoPorCat[p.categoria] || 0;
      const pct = limiteEf>0 ? Math.max(0, gastado/limiteEf*100) : 0;
      const pasado = gastado > limiteEf;
      return `
      <div class="item" style="flex-direction:column;align-items:stretch;gap:10px">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="ico-cat">${emojiCategoria(p.categoria, "gasto")}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;justify-content:space-between;gap:8px;font-weight:700;font-size:15px"><span>${esc(p.categoria)}</span><span class="${pasado?'neg':''}" style="font-variant-numeric:tabular-nums">${pct.toFixed(0)}%</span></div>
            <div class="meta">${eur(gastado)} de ${eur(limiteEf)}${mult===12?" al año":""}${p.rollover?" · con remanente":""}</div>
          </div>
        </div>
        <div class="barra" style="height:8px"><div style="width:${Math.min(pct,100)}%;background:${pasado?'var(--neg)':pct>=80?'#e0ac4e':'var(--mint)'}"></div></div>
        ${rolloverImp!==0 && mult!==12? `<div class="meta">Incluye ${rolloverImp>=0?"+":""}${eur(rolloverImp)} de meses anteriores</div>` : ""}
        ${ajuste>0? `<div class="meta">Sin contar ${eur(ajuste)} que ya te han devuelto</div>` : ""}
        ${pasado? `<div class="meta" style="color:var(--neg)">Has superado el límite en ${eur(restarDinero(gastado, limiteEf))}</div>` : ""}
        <div class="chips">
          <button class="chip" data-editar-presupuesto="${p.id}">Editar</button>
          <button class="chip ${p.rollover?'ok':'lav'}" data-toggle-rollover="${p.id}">${p.rollover?"Quitar remanente":"Activar remanente"}</button>
          <button class="chip peligro" data-del-presupuesto="${p.id}">Borrar</button>
        </div>
      </div>
      ${editarPresupuestoId===p.id? `
      <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
        <label>Nuevo límite mensual (€)</label>
        <input type="number" step="0.01" min="0" id="presupuestoNuevoLimite" value="${p.limite}">
        <div style="display:flex;gap:8px">
          <button class="btn" data-confirmar-presupuesto="${p.id}">Guardar</button>
          <button class="btn ghost" data-cancelar-presupuesto="1">Cancelar</button>
        </div>
      </div>` : ""}`;
    }).join("") : `<div class="card">${vacio("nube","Sin presupuestos todavía","Ponle un límite a una categoría arriba y te avisaré antes de pasarte.")}</div>`}
  </div>`;
}

function wireEventosPresupuestos(){
  const fPresupuesto = document.getElementById("fPresupuesto");
  if(fPresupuesto) fPresupuesto.onsubmit = (e)=>{
    e.preventDefault();
    conCarga(fPresupuesto.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const f = new FormData(fPresupuesto);
      const data = {categoria:f.get("categoria"), limite:parseFloat(f.get("limite"))};
      const {error} = await sb.from("presupuestos").insert(data);
      if(error){ showError("No se pudo guardar el presupuesto: "+error.message); return; }
      hideError(); fPresupuesto.reset(); await recargar(["presupuestos"]);
    });
  };
  document.querySelectorAll("[data-del-presupuesto]").forEach(b=>b.onclick=async ()=>{
    if(!(await confirmar("¿Borrar este presupuesto?"))) return;
    conCarga(b, "Borrando…", async ()=>{
      const {error} = await sb.from("presupuestos").delete().eq("id", b.dataset.delPresupuesto);
      if(error){ showError("No se pudo borrar: "+error.message); return; }
      hideError(); await recargar(["presupuestos"]);
    });
  });
  document.querySelectorAll("[data-toggle-rollover]").forEach(b=>b.onclick=()=>conCarga(b, "…", async ()=>{
    const p = presupuestos.find(x=>x.id===b.dataset.toggleRollover);
    if(!p) return;
    const activar = !p.rollover;
    const hoy = new Date();
    const cambios = activar
      ? {rollover:true, rollover_desde:`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}-01`}
      : {rollover:false};
    const {error} = await sb.from("presupuestos").update(cambios).eq("id", p.id);
    if(error){ showError("No se pudo actualizar: "+error.message); return; }
    hideError(); await recargar(["presupuestos"]);
  }));
  document.querySelectorAll("[data-editar-presupuesto]").forEach(b=>b.onclick=()=>{ editarPresupuestoId=b.dataset.editarPresupuesto; render(); });
  document.querySelectorAll("[data-cancelar-presupuesto]").forEach(b=>b.onclick=()=>{ editarPresupuestoId=null; render(); });
  document.querySelectorAll("[data-confirmar-presupuesto]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
    const id = b.dataset.confirmarPresupuesto;
    const nuevo = parseFloat(document.getElementById("presupuestoNuevoLimite")?.value);
    if(isNaN(nuevo)) return;
    const {error} = await sb.from("presupuestos").update({limite:nuevo}).eq("id", id);
    if(error){ showError("No se pudo guardar: "+error.message); return; }
    hideError(); editarPresupuestoId=null; await recargar(["presupuestos"]);
  }));
}
