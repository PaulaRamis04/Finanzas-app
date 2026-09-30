// Pestaña «Personalización»: tema, color principal, fondo e imagen propia. Se guarda en este dispositivo
// (localStorage) y se aplica con aplicarPersonalizacion(), definida en index.html para que no haya parpadeo.

const TEMAS = [["auto","Automático","linear-gradient(90deg,#fdf7f2 50%,#1c1718 50%)"],["light","Claro","#fdf7f2"],["dark","Oscuro","#1c1718"]];
const ACENTOS = [["","Coral","#f07f76"],["#3fae92","Menta","#3fae92"],["#8b7fd6","Lavanda","#8b7fd6"],["#f2a65a","Melocotón","#f2a65a"],["#5aa9e6","Cielo","#5aa9e6"],["#e27aa8","Rosa","#e27aa8"],["#5b6b8c","Pizarra","#5b6b8c"]];
const NOMBRES_FONDO = {crema:"Crema", menta:"Menta", lavanda:"Lavanda", rosa:"Rosa", cielo:"Cielo", blanco:"Blanco"};

function guardarPersonalizacion(cambios){
  const p = {...leerPersonalizacion(), ...cambios};
  try{
    localStorage.setItem("personalizacion", JSON.stringify({tema:p.tema, acento:p.acento, fondo:p.fondo, velo:p.velo}));
    if("imagen" in cambios){ if(p.imagen) localStorage.setItem("fondoImagen", p.imagen); else localStorage.removeItem("fondoImagen"); }
  }catch(e){
    showError("No se pudo guardar: la imagen es demasiado grande para este navegador. Prueba con otra.");
    return false;
  }
  hideError();
  aplicarPersonalizacion(p);
  return true;
}

// Reduce la foto (lado mayor 1600 px, JPEG) para que quepa en el almacenamiento del navegador.
function reducirImagen(archivo){
  return new Promise((ok, mal)=>{
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = ()=>{
      URL.revokeObjectURL(url);
      const k = Math.min(1, 1600/Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width*k); c.height = Math.round(img.height*k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      let q = 0.82, datos = c.toDataURL("image/jpeg", q);
      while(datos.length > 1500000 && q > 0.4){ q -= 0.12; datos = c.toDataURL("image/jpeg", q); }
      ok(datos);
    };
    img.onerror = ()=>{ URL.revokeObjectURL(url); mal(new Error("No se pudo leer la imagen.")); };
    img.src = url;
  });
}

function renderPersonalizacion(){
  const p = leerPersonalizacion();
  const propio = p.acento && !ACENTOS.some(a=>a[0]===p.acento);
  return `
  <div class="card">
    <h2>Tema</h2>
    <div class="opciones">
      ${TEMAS.map(([v,t,muestra])=>`<button class="opcion ${p.tema===v?"sel":""}" data-tema="${v}"><span class="muestra" style="background:${muestra}"></span>${t}</button>`).join("")}
    </div>
    <p class="meta" style="margin:10px 0 0">Automático sigue el modo claro u oscuro de tu móvil.</p>
  </div>
  ${esPremium ? "" : avisoPremium("Personalización")}
  ${esPremium ? `  <div class="card">
    <h2>Color principal</h2>
    <div class="colores">
      ${ACENTOS.map(([v,t,c])=>`<button class="color ${p.acento===v?"sel":""}" data-acento="${v}" title="${t}" aria-label="${t}" style="background:${c}"></button>`).join("")}
      <label class="color-propio ${propio?"sel":""}" title="Elegir otro color"><input type="color" id="acentoPropio" value="${propio ? p.acento : "#f07f76"}" aria-label="Elegir otro color"></label>
    </div>
    <p class="meta" style="margin:10px 0 0">Se usa en botones, pestañas activas y destacados.</p>
  </div>
  <div class="card">
    <h2>Color de fondo</h2>
    <div class="opciones">
      ${Object.entries(FONDOS).map(([k,[claro,oscuro]])=>`<button class="opcion ${p.fondo===k?"sel":""}" data-fondo="${k}"><span class="muestra" style="background:linear-gradient(90deg,${claro} 50%,${oscuro} 50%)"></span>${NOMBRES_FONDO[k]}</button>`).join("")}
    </div>
    <p class="meta" style="margin:10px 0 0">Cada fondo tiene su versión clara y oscura.</p>
  </div>
  <div class="card">
    <h2>Imagen de fondo</h2>
    <div class="vista-img" style="${p.imagen ? `background-image:url('${p.imagen}')` : ""}">${p.imagen ? "" : "Sin imagen"}</div>
    <input type="file" id="fondoArchivo" accept="image/*" style="display:none">
    <div class="chips" style="margin-top:12px">
      <button class="btn" id="btnSubirFondo">${p.imagen ? "Cambiar imagen" : "Subir imagen"}</button>
      ${p.imagen ? `<button class="btn ghost" id="btnQuitarFondo">Quitar</button>` : ""}
    </div>
    ${p.imagen ? `
    <label for="veloFondo" style="margin-top:14px">Suavizar la imagen</label>
    <input type="range" id="veloFondo" min="0" max="90" step="5" value="${p.velo}">
    <p class="meta" style="margin:4px 0 0">Cuanto más suave, mejor se leen los textos encima.</p>` : ""}
    <p class="meta" style="margin:10px 0 0">La imagen se guarda solo en este dispositivo y se borra al cerrar sesión.</p>
  </div>
  <button class="btn ghost" id="btnRestablecerAspecto" style="color:var(--muted)">Restablecer aspecto original</button>` : ""}`;
}

// Sin premium solo se conserva el tema (claro, oscuro o automático).
function quitarPersonalizacionPremium(){
  const p = leerPersonalizacion();
  if(!p.acento && p.fondo==="crema" && !p.imagen) return;
  try{ localStorage.setItem("personalizacion", JSON.stringify({tema:p.tema})); localStorage.removeItem("fondoImagen"); }catch(e){}
  aplicarPersonalizacion();
}

function wireEventosPersonalizacion(){
  const repintar = cambios=>{ if(guardarPersonalizacion(cambios)) render(); };
  document.querySelectorAll("[data-tema]").forEach(b=>b.onclick=()=>repintar({tema:b.dataset.tema}));
  document.querySelectorAll("[data-acento]").forEach(b=>b.onclick=()=>repintar({acento:b.dataset.acento}));
  document.querySelectorAll("[data-fondo]").forEach(b=>b.onclick=()=>repintar({fondo:b.dataset.fondo}));
  const propio = document.getElementById("acentoPropio");
  if(propio){
    propio.oninput = ()=>aplicarPersonalizacion({...leerPersonalizacion(), acento:propio.value});
    propio.onchange = ()=>repintar({acento:propio.value});
  }
  const velo = document.getElementById("veloFondo");
  if(velo){
    velo.oninput = ()=>aplicarPersonalizacion({...leerPersonalizacion(), velo:Number(velo.value)});
    velo.onchange = ()=>guardarPersonalizacion({velo:Number(velo.value)});
  }
  const subir = document.getElementById("btnSubirFondo"), archivo = document.getElementById("fondoArchivo");
  if(subir && archivo){
    subir.onclick = ()=>{ archivo.value = ""; archivo.click(); };
    archivo.onchange = ()=>{
      const f = archivo.files[0];
      if(!f) return;
      if(!f.type.startsWith("image/")){ showError("Elige un archivo de imagen."); return; }
      conCarga(subir, "Preparando…", async ()=>{
        let datos;
        try{ datos = await reducirImagen(f); }catch(e){ showError(e.message); return; }
        repintar({imagen:datos});
      });
    };
  }
  const quitar = document.getElementById("btnQuitarFondo");
  if(quitar) quitar.onclick = ()=>repintar({imagen:null});
  const reset = document.getElementById("btnRestablecerAspecto");
  if(reset) reset.onclick = async ()=>{
    if(!(await confirmar("¿Volver al aspecto original? Se quitan el tema, los colores y la imagen elegidos."))) return;
    try{ localStorage.removeItem("personalizacion"); localStorage.removeItem("fondoImagen"); }catch(e){}
    aplicarPersonalizacion(); render();
  };
}
