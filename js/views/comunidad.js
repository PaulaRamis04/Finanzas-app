// Pestaña «Comunidad»: hacerse supporter, enviar ideas y reportar fallos. Todo se guarda en la tabla
// comunidad de Supabase (schema_comunidad.sql); la dueña de la app lo contesta desde la app de gestión
// (repositorio APP-GESTION-CLIENTES, schema_gestion.sql) y aquí se ven sus respuestas y el chat de la mini asesoría.

let comunidadAbierto = null; // "supporter" | "cambio" | "idea" | "fallo"
let comunidadEnviado = null; // el mismo valor, tras enviar
let supporterImporte = 5;

const NIVELES_SUPPORTER = [
  ["☕","Desde 1 €/mes","Dispones de todas las opciones premium: personalización, proyección y cuentas compartidas."],
  ["🌸","A partir de 5 €/mes","Todas las opciones premium y además una mini asesoría personalizada. Revisamos juntos tus presupuestos del mes, te doy consejos para optimizar tus categorías de gasto y resolvemos tus metas de ahorro paso a paso."]
];
const IMPORTES_SUPPORTER = [1, 3, 5, 10];
const GRACIAS_COMUNIDAD = {
  supporter:"¡Gracias de corazón! Te escribiré a tu email para contarte cómo hacer la aportación. 💌",
  idea:"¡Gracias por tu idea! La leeré con cariño. ✨",
  fallo:"Recibido. Lo miro y te escribo a tu email en cuanto lo tenga. 🛠️",
  cambio:"¡Recibido! Te escribiré a tu email para confirmar el cambio de tu aportación. 💌"
};

// Aportación al mes que consta en la suscripción activa (la pone la dueña desde la app de gestión).
function aportacionActual(){
  const s = miSuscripcion;
  return s && s.activa && (!s.hasta || s.hasta>=today()) && s.importe!=null ? Number(s.importe) : null;
}

// Para quien ya es supporter: pedir subir o bajar la aportación. No cobra nada: queda como petición
// en el buzón (tipo "supporter") y la dueña la confirma en la app de gestión.
function renderCambioAportacion(){
  const actual = aportacionActual();
  const aviso = tieneAsesoria() && supporterImporte<5 ? "Con menos de 5 €/mes dejarás de tener la mini asesoría, pero seguirás con todas las opciones premium."
    : !tieneAsesoria() && supporterImporte>=5 ? "Con 5 €/mes o más se suma la mini asesoría personalizada." : "";
  return `
    <label>Tu nueva aportación al mes</label>
    <div class="opciones">
      ${IMPORTES_SUPPORTER.map(n=>`<button class="opcion ${supporterImporte===n?"sel":""}" data-supporter-importe="${n}">${n} €${n===actual?" (actual)":""}</button>`).join("")}
    </div>
    ${aviso ? `<p class="meta aviso-aportacion">${aviso}</p>` : ""}
    <label for="comunidadTexto">Algo que quieras contarme (opcional)</label>
    <textarea id="comunidadTexto" rows="2" maxlength="1000"></textarea>
    <div class="comunidad-btns">
      <button class="btn" data-comunidad-enviar="cambio">Pedir el cambio</button>
      <button class="btn ghost" data-comunidad-cerrar="1">Cancelar</button>
    </div>`;
}

function renderSupporterPremium(){
  if(comunidadEnviado==="cambio") return `<div class="comunidad-ok">${GRACIAS_COMUNIDAD.cambio}</div>`;
  if(comunidadAbierto==="cambio") return renderCambioAportacion();
  const actual = aportacionActual();
  return `<div class="comunidad-ok">👑 Ya eres premium y tienes todas las opciones desbloqueadas. ¡Gracias por apoyar la app!</div>
    ${actual!=null ? `<p class="meta">Tu aportación ahora: <strong>${actual} €/mes</strong></p>` : ""}
    <button class="btn ghost" data-comunidad-abrir="cambio">Cambiar mi aportación</button>`;
}

function tarjetaComunidad(clave, ico, titulo, texto, boton, cuerpo){
  const abierto = comunidadAbierto===clave;
  return `
  <div class="card comunidad">
    <div class="comunidad-cab"><span class="comunidad-ico" aria-hidden="true">${ico}</span><h2>${titulo}</h2></div>
    <p class="meta">${texto}</p>
    ${clave==="supporter" && esPremium ? renderSupporterPremium()
      : comunidadEnviado===clave ? `<div class="comunidad-ok">${GRACIAS_COMUNIDAD[clave]}</div>`
      : abierto ? cuerpo : `<button class="btn" data-comunidad-abrir="${clave}">${boton}</button>`}
  </div>`;
}

const TIPOS_MENSAJE = {idea:"💬 Idea", fallo:"🐞 Fallo"};

function renderAsesoria(){
  if(!tieneAsesoria()) return "";
  return `
  <div class="card comunidad">
    <div class="comunidad-cab"><span class="comunidad-ico" aria-hidden="true">🌸</span><h2>Tu mini asesoría</h2></div>
    <p class="meta">Cuéntame qué quieres revisar este mes (presupuestos, categorías, metas de ahorro) y te contesto por aquí.</p>
    <div class="chat">${mensajesAsesoria.length ? mensajesAsesoria.map(m=>`<div class="burbuja ${m.autor==="admin"?"de-admin":"mia"}">${esc(m.texto)}<small>${new Date(m.creado_en).toLocaleString("es-ES", {day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"})}</small></div>`).join("")
      : `<p class="meta">Aún no hay mensajes. ¡Escríbeme el primero!</p>`}</div>
    <textarea id="asesoriaTexto" rows="3" maxlength="4000" placeholder="Escribe tu mensaje…"></textarea>
    <div class="comunidad-btns"><button class="btn" id="btnEnviarAsesoria">Enviar</button></div>
  </div>`;
}

function renderMisMensajes(){
  if(!misMensajesComunidad.length) return "";
  return `
  <div class="card comunidad">
    <div class="comunidad-cab"><span class="comunidad-ico" aria-hidden="true">💌</span><h2>Tus mensajes</h2></div>
    <div class="mis-mensajes">${misMensajesComunidad.map(f=>`
      <div class="mi-mensaje">
        <div class="meta">${TIPOS_MENSAJE[f.tipo]||esc(f.tipo)}</div>
        <p>${esc(f.texto)}</p>
        ${f.respuesta ? `<div class="respuesta"><strong>Respuesta:</strong> ${esc(f.respuesta)}</div>` : `<div class="meta">${f.estado==="resuelto" ? "Resuelto" : "Pendiente de respuesta"}</div>`}
      </div>`).join("")}</div>
  </div>`;
}

function renderComunidad(){
  const supporter = `
    <div class="comunidad-intro">
      <strong>✨ Apoya la app y recibe ayuda directa</strong>
      <p>Esta aplicación no tiene anuncios molestos para cuidar tu tranquilidad y privacidad. Puedes apoyar su mantenimiento con la cantidad que tú elijas:</p>
    </div>
    ${NIVELES_SUPPORTER.map(([i,t,d])=>`<div class="nivel"><span aria-hidden="true">${i}</span><div><strong>${t}</strong><p class="meta">${d}</p></div></div>`).join("")}
    <label>Tu aportación al mes</label>
    <div class="opciones">
      ${IMPORTES_SUPPORTER.map(n=>`<button class="opcion ${supporterImporte===n?"sel":""}" data-supporter-importe="${n}">${n} €</button>`).join("")}
    </div>
    <label for="comunidadTexto">Algo que quieras contarme (opcional)</label>
    <textarea id="comunidadTexto" rows="2" maxlength="1000"></textarea>
    <div class="comunidad-btns">
      <button class="btn" data-comunidad-enviar="supporter">Quiero ser supporter</button>
      <button class="btn ghost" data-comunidad-cerrar="1">Ahora no</button>
    </div>
    <p class="meta">Soporte técnico habitual y reporte de errores 100 % gratuito para toda la comunidad.</p>`;
  const formulario = (clave, etiqueta, ayuda, boton)=>`
    <label for="comunidadTexto">${etiqueta}</label>
    <textarea id="comunidadTexto" rows="4" maxlength="2000" placeholder="${ayuda}"></textarea>
    <div class="comunidad-btns">
      <button class="btn" data-comunidad-enviar="${clave}">${boton}</button>
      <button class="btn ghost" data-comunidad-cerrar="1">Cancelar</button>
    </div>`;
  return `
  <div class="comunidad-hero">🌸 Rincón de la Comunidad &amp; Soporte</div>
  ${renderAsesoria()}
  ${tarjetaComunidad("supporter", "✨", "Apoyo personal (Supporters)",
    "Apoya el proyecto desde 1 €/mes y dispón de las opciones premium. Si aportas 5 € o más, ¡tienes incluida una mini asesoría personalizada para ayudarte a organizar tus presupuestos del mes! 💌",
    "Hacerse supporter", supporter)}
  ${tarjetaComunidad("idea", "💬", "Buzón de ideas y feedback <span class=\"gratis\">Gratis</span>",
    "¿Qué función te gustaría ver en la app? Cuéntamelo.",
    "Dar feedback", formulario("idea", "Tu idea", "Me encantaría que la app…", "Enviar idea"))}
  ${tarjetaComunidad("fallo", "🐞", "Ayuda técnica y fallos <span class=\"gratis\">Gratis</span>",
    "¿Algo no funciona como debería? Escríbeme directamente.",
    "Reportar un problema", formulario("fallo", "¿Qué ha pasado?", "Qué estabas haciendo y qué esperabas que pasara", "Enviar"))}
  ${renderMisMensajes()}`;
}

function wireEventosComunidad(){
  document.querySelectorAll("[data-comunidad-abrir]").forEach(b=>b.onclick=()=>{
    comunidadAbierto = b.dataset.comunidadAbrir; comunidadEnviado = null;
    if(comunidadAbierto==="cambio"){ const actual = aportacionActual(); supporterImporte = IMPORTES_SUPPORTER.includes(actual) ? actual : 5; }
    pendienteEnfoque = comunidadAbierto==="cambio" ? null : "comunidadTexto"; render();
  });
  document.querySelectorAll("[data-comunidad-cerrar]").forEach(b=>b.onclick=()=>{ comunidadAbierto = null; render(); });
  document.querySelectorAll("[data-supporter-importe]").forEach(b=>b.onclick=()=>{ supporterImporte = Number(b.dataset.supporterImporte); render(); });
  document.querySelectorAll("[data-comunidad-enviar]").forEach(b=>b.onclick=()=>conCarga(b, "Enviando…", async ()=>{
    const enviado = b.dataset.comunidadEnviar, tipo = enviado==="cambio" ? "supporter" : enviado;
    const texto = (document.getElementById("comunidadTexto")?.value || "").trim();
    if(enviado==="supporter" && esPremium) return;
    if(enviado==="cambio" && supporterImporte===aportacionActual()){ showError("Elige una cantidad distinta de la que ya aportas."); return; }
    if(tipo!=="supporter" && !texto){ showError("Escribe un mensaje antes de enviarlo."); return; }
    const fila = {tipo, texto, importe: tipo==="supporter" ? supporterImporte : null};
    if(tipo==="fallo") fila.info = {navegador:navigator.userAgent, pantalla:`${innerWidth}x${innerHeight}`, fecha:new Date().toISOString()};
    const {error} = await sb.from("comunidad").insert(fila);
    if(error){ showError(/does not exist|schema cache/i.test(error.message) ? "Falta ejecutar schema_comunidad.sql en Supabase." : "No se pudo enviar: "+error.message); return; }
    hideError(); comunidadAbierto = null; comunidadEnviado = enviado; render();
    if(tipo!=="supporter") recargar(["comunidad"]);
  }));
  const enviarAsesoria = document.getElementById("btnEnviarAsesoria");
  if(enviarAsesoria) enviarAsesoria.onclick = ()=>conCarga(enviarAsesoria, "Enviando…", async ()=>{
    const texto = (document.getElementById("asesoriaTexto")?.value || "").trim();
    if(!texto){ showError("Escribe un mensaje antes de enviarlo."); return; }
    const {error} = await sb.from("asesoria_mensajes").insert({autor:"cliente", texto});
    if(error){ showError("No se pudo enviar: "+error.message); return; }
    hideError(); document.getElementById("asesoriaTexto").value = "";
    await recargar(["asesoria"]);
  });
  const chat = document.querySelector(".comunidad .chat");
  if(chat) chat.scrollTop = chat.scrollHeight;
  // Al ver la pestaña, las respuestas quedan como leídas.
  if(tab==="Comunidad" && tieneAsesoria() && mensajesAsesoria.some(m=>m.autor==="admin" && !m.leido)){
    mensajesAsesoria.forEach(m=>{ if(m.autor==="admin") m.leido = true; });
    sb.rpc("marcar_asesoria_leida").then(()=>{}, ()=>{});
  }
}
