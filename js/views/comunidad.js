// Pestaña «Comunidad»: hacerse supporter, enviar ideas y reportar fallos. Todo se guarda en la tabla
// comunidad de Supabase (schema_comunidad.sql); la dueña de la app lo lee desde allí y contesta por email.

let comunidadAbierto = null; // "supporter" | "idea" | "fallo"
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
  fallo:"Recibido. Lo miro y te escribo a tu email en cuanto lo tenga. 🛠️"
};

function tarjetaComunidad(clave, ico, titulo, texto, boton, cuerpo){
  const abierto = comunidadAbierto===clave;
  return `
  <div class="card comunidad">
    <div class="comunidad-cab"><span class="comunidad-ico" aria-hidden="true">${ico}</span><h2>${titulo}</h2></div>
    <p class="meta">${texto}</p>
    ${comunidadEnviado===clave ? `<div class="comunidad-ok">${GRACIAS_COMUNIDAD[clave]}</div>`
      : abierto ? cuerpo : `<button class="btn" data-comunidad-abrir="${clave}">${boton}</button>`}
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
  ${tarjetaComunidad("supporter", "✨", "Apoyo personal (Supporters)",
    "Apoya el proyecto desde 1 €/mes y dispón de las opciones premium. Si aportas 5 € o más, ¡tienes incluida una mini asesoría personalizada para ayudarte a organizar tus presupuestos del mes! 💌",
    "Hacerse supporter", supporter)}
  ${tarjetaComunidad("idea", "💬", "Buzón de ideas y feedback <span class=\"gratis\">Gratis</span>",
    "¿Qué función te gustaría ver en la app? Cuéntamelo.",
    "Dar feedback", formulario("idea", "Tu idea", "Me encantaría que la app…", "Enviar idea"))}
  ${tarjetaComunidad("fallo", "🐞", "Ayuda técnica y fallos <span class=\"gratis\">Gratis</span>",
    "¿Algo no funciona como debería? Escríbeme directamente.",
    "Reportar un problema", formulario("fallo", "¿Qué ha pasado?", "Qué estabas haciendo y qué esperabas que pasara", "Enviar"))}`;
}

function wireEventosComunidad(){
  document.querySelectorAll("[data-comunidad-abrir]").forEach(b=>b.onclick=()=>{
    comunidadAbierto = b.dataset.comunidadAbrir; comunidadEnviado = null; pendienteEnfoque = "comunidadTexto"; render();
  });
  document.querySelectorAll("[data-comunidad-cerrar]").forEach(b=>b.onclick=()=>{ comunidadAbierto = null; render(); });
  document.querySelectorAll("[data-supporter-importe]").forEach(b=>b.onclick=()=>{ supporterImporte = Number(b.dataset.supporterImporte); render(); });
  document.querySelectorAll("[data-comunidad-enviar]").forEach(b=>b.onclick=()=>conCarga(b, "Enviando…", async ()=>{
    const tipo = b.dataset.comunidadEnviar;
    const texto = (document.getElementById("comunidadTexto")?.value || "").trim();
    if(tipo!=="supporter" && !texto){ showError("Escribe un mensaje antes de enviarlo."); return; }
    const fila = {tipo, texto, importe: tipo==="supporter" ? supporterImporte : null};
    if(tipo==="fallo") fila.info = {navegador:navigator.userAgent, pantalla:`${innerWidth}x${innerHeight}`, fecha:new Date().toISOString()};
    const {error} = await sb.from("comunidad").insert(fila);
    if(error){ showError(/does not exist|schema cache/i.test(error.message) ? "Falta ejecutar schema_comunidad.sql en Supabase." : "No se pudo enviar: "+error.message); return; }
    hideError(); comunidadAbierto = null; comunidadEnviado = tipo; render();
  }));
}
