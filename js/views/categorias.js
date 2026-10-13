// Pestaña «Categorías»: su render y sus eventos.

function catItem(c){
  return editarCatId===c.id ? `
    <div class="item" style="flex-direction:column;align-items:stretch;gap:8px">
      <input id="catNuevoNombre" value="${esc(c.nombre)}">
      <div style="display:flex;gap:8px">
        <button class="btn" data-confirmar-cat="${c.id}">Guardar</button>
        <button class="btn ghost" data-cancelar-cat="1">Cancelar</button>
      </div>
    </div>` : `
    <div class="item">
      <div>${esc(c.nombre)}</div>
      <div style="display:flex;gap:8px">
        <button class="btn ghost" data-editar-cat="${c.id}">Renombrar</button>
        <button class="btn ghost" data-del-cat="${c.id}">Borrar</button>
      </div>
    </div>`;
}

function renderCategorias(){
  const porPadre = {};
  categorias.filter(c=>c.tipo==="gasto").forEach(c=>{ const p=c.padre||"Otros"; (porPadre[p]=porPadre[p]||[]).push(c); });
  const ingresoList = categorias.filter(c=>c.tipo==="ingreso");
  const padres = Object.keys(porPadre);
  const claves = [...padres, ...(ingresoList.length ? ["__ingresos__"] : [])];
  const todasContraidas = claves.length>0 && claves.every(k=>catsContraidas[k]);
  return `
  <div class="card">
    <h2>Nueva categoría</h2>
    <form id="fCategoria">
      <div class="row2">
        <div><label>Tipo</label><select name="tipo" id="catTipo"><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option></select></div>
        <div id="catPadreWrap"><label>Grupo</label><input name="padre" id="catPadre" list="padresList" placeholder="ej. Imprescindible"><datalist id="padresList">${padres.map(p=>`<option value="${esc(p)}">`).join("")}</datalist></div>
      </div>
      <div><label>Nombre</label><input name="nombre" placeholder="ej. Gasolina" required></div>
      <button class="btn" type="submit">Añadir</button>
    </form>
  </div>
  <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
    <span>Gastos</span>
    ${padres.length + (ingresoList.length?1:0) > 1? `<button class="btn ghost" data-toggle-todas-cats="${todasContraidas?'expandir':'contraer'}" style="color:var(--accent)">${todasContraidas?"Expandir todas":"Contraer todas"}</button>` : ""}
  </div>
  <div class="list">
    ${padres.length? padres.map(p=>{
      const cerrado = !!catsContraidas[p];
      return `
      <div data-toggle-cat="${esc(p)}" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:8px 4px;margin-top:4px;font-weight:700;font-size:14px">
        <span>${cerrado?"▸":"▾"} ${esc(p)}</span>
        <span class="meta" style="font-weight:400">${porPadre[p].length} categoría${porPadre[p].length===1?"":"s"}</span>
      </div>
      ${cerrado? "" : porPadre[p].map(catItem).join("")}`;
    }).join("") : vacio("nube","Sin categorías de gasto","Crea la primera para ordenar tus compras.")}
  </div>
  <div class="section-title">Ingresos</div>
  <div class="list">
    ${ingresoList.length? `
      <div data-toggle-cat="__ingresos__" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:8px 4px;font-weight:700;font-size:14px">
        <span>${catsContraidas["__ingresos__"]?"▸":"▾"} Ingresos</span>
        <span class="meta" style="font-weight:400">${ingresoList.length} categoría${ingresoList.length===1?"":"s"}</span>
      </div>
      ${catsContraidas["__ingresos__"]? "" : ingresoList.map(catItem).join("")}` : vacio("hucha","Sin categorías de ingreso","Por ejemplo: nómina, regalos o ventas.")}
  </div>`;
}

function wireEventosCategorias(){
  const catTipo = document.getElementById("catTipo");
  const catPadreWrap = document.getElementById("catPadreWrap");
  if(catTipo && catPadreWrap){
    const toggle = ()=> catPadreWrap.style.display = catTipo.value==="ingreso" ? "none" : "block";
    toggle(); catTipo.onchange = toggle;
  }
  const fCategoria = document.getElementById("fCategoria");
  if(fCategoria) fCategoria.onsubmit = (e)=>{
    e.preventDefault();
    conCarga(fCategoria.querySelector('button[type="submit"]'), "Guardando…", async ()=>{
      const f = new FormData(fCategoria);
      const tipoVal = f.get("tipo");
      const data = {tipo:tipoVal, padre: tipoVal==="gasto" ? (f.get("padre")||"Otros") : null, nombre:(f.get("nombre")||"").trim()};
      if(CATEGORIAS_ESPECIALES.includes(data.nombre)){ showError(`"${data.nombre}" es un nombre reservado por la app.`); return; }
      if(categorias.some(c=>c.tipo===data.tipo && c.nombre===data.nombre)){ showError(`Ya existe una categoría llamada "${data.nombre}".`); return; }
      const {error} = await sb.from("categorias").insert(data);
      if(error){ showError("No se pudo guardar la categoría: "+error.message); return; }
      hideError(); fCategoria.reset(); await recargar(["categorias"]);
    });
  };
  document.querySelectorAll("[data-del-cat]").forEach(b=>b.onclick=async ()=>{
    const cat = categorias.find(c=>String(c.id)===b.dataset.delCat);
    let aviso = "¿Borrar esta categoría?";
    if(cat){
      const {count} = await sb.from("movimientos").select("id", {count:"exact", head:true}).eq("categoria", cat.nombre).eq("tipo", cat.tipo);
      const nPres = presupuestos.filter(p=>cat.tipo==="gasto" && p.categoria===cat.nombre).length;
      const nRec = recurrentes.filter(r=>r.tipo===cat.tipo && r.categoria===cat.nombre).length;
      const usos = [count ? `${count} movimiento${count>1?"s":""}` : "", nPres ? `${nPres} presupuesto${nPres>1?"s":""}` : "", nRec ? `${nRec} recurrente${nRec>1?"s":""}` : ""].filter(Boolean);
      if(usos.length) aviso = `"${cat.nombre}" está en uso en ${usos.join(", ")}. Si la borras, conservarán ese nombre pero ya no podrás elegirla. ¿Borrarla igualmente?`;
    }
    if(!(await confirmar(aviso))) return;
    conCarga(b, "Borrando…", async ()=>{
      const {error} = await sb.from("categorias").delete().eq("id", b.dataset.delCat);
      if(error){ showError("No se pudo borrar: "+error.message); return; }
      hideError(); await recargar(["categorias"]);
    });
  });
  document.querySelectorAll("[data-editar-cat]").forEach(b=>b.onclick=()=>{ editarCatId=b.dataset.editarCat; render(); });
  document.querySelectorAll("[data-cancelar-cat]").forEach(b=>b.onclick=()=>{ editarCatId=null; render(); });
  document.querySelectorAll("[data-confirmar-cat]").forEach(b=>b.onclick=()=>conCarga(b, "Guardando…", async ()=>{
    const catId = b.dataset.confirmarCat;
    const nuevo = document.getElementById("catNuevoNombre")?.value.trim();
    if(!nuevo) return;
    const cat = categorias.find(c=>String(c.id)===catId);
    if(!cat) return;
    if(nuevo===cat.nombre){ editarCatId = null; render(); return; }
    if(CATEGORIAS_ESPECIALES.includes(nuevo)){ showError(`"${nuevo}" es un nombre reservado por la app.`); return; }
    if(categorias.some(c=>c.tipo===cat.tipo && c.nombre===nuevo)){ showError(`Ya existe una categoría llamada "${nuevo}".`); return; }
    const {error} = await renombrarCategoria(cat, nuevo);
    if(error){ showError("No se pudo renombrar: "+error.message); return; }
    hideError(); editarCatId = null; await recargar(["categorias","movimientos","presupuestos","recurrentes"]);
  }));
  const guardarContraidas = ()=>{ try{ localStorage.setItem("catsContraidas", JSON.stringify(catsContraidas)); }catch(e){} guardarAjustes(); };
  document.querySelectorAll("[data-toggle-cat]").forEach(b=>b.onclick=()=>{
    const k = b.dataset.toggleCat;
    if(catsContraidas[k]) delete catsContraidas[k]; else catsContraidas[k] = true;
    guardarContraidas(); render();
  });
  document.querySelectorAll("[data-toggle-todas-cats]").forEach(b=>b.onclick=()=>{
    if(b.dataset.toggleTodasCats==="contraer"){
      categorias.filter(c=>c.tipo==="gasto").forEach(c=>{ catsContraidas[c.padre||"Otros"] = true; });
      if(categorias.some(c=>c.tipo==="ingreso")) catsContraidas["__ingresos__"] = true;
    } else catsContraidas = {};
    guardarContraidas(); render();
  });
}
