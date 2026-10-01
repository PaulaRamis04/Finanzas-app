// Bienvenida: al entrar por primera vez después de registrarse, tres tarjetas con el resumen de cómo usar la app.
// Los textos son de Paula, tal cual. Solo la ven las cuentas nuevas: al registrarse se guarda
// «bienvenida: pendiente» en los datos del usuario (user_metadata) y al terminar pasa a «vista».
// Además se apunta en este dispositivo por si no se pudiera guardar en la cuenta. No necesita SQL.

let bienvenidaRevisada = ""; // id del usuario ya revisado (por si se cambia de perfil sin recargar)

const claveBienvenida = ()=>"bienvenidaVista:"+(session?.user?.id||"");
function bienvenidaPendiente(){
  if(!session || session.user?.user_metadata?.bienvenida!=="pendiente") return false;
  try{ if(localStorage.getItem(claveBienvenida())) return false; }catch(e){}
  return true;
}

async function revisarBienvenida(){
  if(!session || bienvenidaRevisada===session.user.id) return;
  if(!bienvenidaPendiente()){ bienvenidaRevisada = session.user.id; return; }
  // Si ya hay otra hoja abierta, se espera a que se cierre.
  if(document.getElementById("hoja")){ setTimeout(revisarBienvenida, 1500); return; }
  bienvenidaRevisada = session.user.id;
  await hojaBienvenida();
  try{ localStorage.setItem(claveBienvenida(), "1"); }catch(e){}
  try{ await sb.auth.updateUser({data:{bienvenida:"vista"}}); }catch(e){}
}

const bvTag = t=>`<span class="bv-tag">${t}</span>`;
const bvItem = (etq, txt)=>`<li><b>${etq}</b> ${txt}</li>`;

const TARJETAS_BIENVENIDA = [
  { ico:"🌸", titulo:"¡Bienvenida a tu espacio de calma! 🌸", boton:"Siguiente ➔", html:`
    <p class="bv-cita">«¡Hola! Me alegra un montón tenerte por aquí ✨»</p>
    <p>He creado esta app con mucho cariño para que organizar tu dinero sea un momento agradable y sin agobios.</p>
    <p class="bv-nota">🍃 <b>Cero anuncios:</b> Aquí no encontrarás publicidad molesta ni cosas raras; es tu rincón personal.</p>` },
  { ico:"🧁", titulo:"Lo que puedes hacer aquí 🧁", boton:"Siguiente ➔", html:`
    <h3>1. Tu panel de control (${bvTag("Inicio")})</h3>
    <ul>
      ${bvItem("Dónde está:", "Es la primera pestaña que ves al entrar al menú.")}
      ${bvItem("Qué verás:", "Una tarjeta principal suave (Tarjeta Hero) que reúne tu saldo total y lo divide de forma realista en Disponible para gastar, Inversiones, Me deben y Debo. Así sabes exactamente con qué dinero cuentas sin engañarte.")}
      ${bvItem("Cómo usarlo:", "Échale un vistazo rápido al empezar el día o la semana para ver tus barras de presupuesto mensual sin agobios ni números rojos estridentes.")}
    </ul>
    <h3>2. Apuntar gastos e ingresos al instante (${bvTag("+ Gasto rápido")})</h3>
    <ul>
      ${bvItem("Dónde está:", `En el botón flotante ${bvTag("+")} accesible desde cualquier pantalla.`)}
      ${bvItem("Cómo usarlo:", `No necesitas formularios eternos ni conectar bancos. Solo tocas el ${bvTag("+")}, pones la cantidad, pulsas la burbuja de la categoría (Comer, Ocio, Supermercado...) y listo en dos toques.`)}
    </ul>
    <h3>3. El desglose y tus límites (${bvTag("Gastos &amp; Presupuestos")})</h3>
    <ul>
      ${bvItem("Dónde está:", "En la sección Resumen / Gastos.")}
      <li><b>Cómo usarlo:</b>
        <ul>
          <li>Puedes filtrar al instante tocando cualquier categoría para ver solo esos movimientos (y volver a tocarla para quitar el filtro).</li>
          <li>En Presupuestos, verás barras redondeadas que se van llenando suavemente para que sepas cuándo frenar un poquito en ocio o compras antes de que termine el mes.</li>
        </ul>
      </li>
    </ul>
    <h3>4. Metas y caprichos (${bvTag("Huchas de Ahorro")})</h3>
    <ul>
      ${bvItem("Dónde está:", "En la pestaña Objetivos / Huchas.")}
      ${bvItem("Cómo usarlo:", "Crea tus huchas para viajes, conciertos o tu fondo de tranquilidad. Elige su icono temático y añade dinero poco a poco viendo cómo avanza la barrita hacia tu meta.")}
    </ul>
    <h3>5. El buzón y tu contacto conmigo (${bvTag("Ajustes &amp; Comunidad")})</h3>
    <ul>
      ${bvItem("Dónde está:", "En el menú inferior o lateral, en Ajustes (sección Rincón de la Comunidad).")}
      ${bvItem("Cómo usarlo:", "Ahí tienes el Buzón gratuito para mandarme ideas o reportar cualquier problema técnico. Y si quieres apoyar el mantenimiento de la app libre de anuncios, puedes hacerlo desde 1 €/mes (¡y a partir de 5 € me siento contigo a organizar tus presupuestos del mes paso a paso!).")}
    </ul>
    <div class="bv-extra">
      <h3>✨ ¡Hay muchísimos detalles interesantes por investigar!</h3>
      <p>Esto es solo lo básico, pero si curoseas por la app irás descubriendo pequeñas sorpresas diseñadas para hacerte la vida fácil:</p>
      <ul>
        ${bvItem("👁️ Modo Privacidad:", "Toca el icono del ojito en la cabecera para esconder tus saldos con bolitas si estás en el bus o rodeada de gente.")}
        ${bvItem("🍕 Dividir gastos y Bizum:", "Al registrar una cena o viaje con amigos, calcula automáticamente la parte de cada uno y crea el recordatorio en «Me deben» con el texto listo para pedir Bizum.")}
        ${bvItem("💭 ¿Me lo puedo permitir?:", "Una herramienta que te calcula si ese capricho retrasará tus huchas de ahorro antes de comprarlo.")}
        ${bvItem("🔄 Arrastre de remanente (Rollover):", "Al cambiar de mes, la app te preguntará con cariño si quieres sumar el dinerito que te sobró el mes pasado a tu nuevo disponible o guardarlo en una hucha.")}
        ${bvItem("📸 Cierre del mes descargable:", "A final de mes podrás generar una tarjeta bonita resumen estilo Wrapped con tus progresos para guardarla de recuerdo.")}
      </ul>
    </div>
    <p class="bv-cierre">Tómate tu tiempo para explorar y poner la app a tu gusto. ¡Bienvenida a tu nuevo rincón de tranquilidad financiera! 🌸🤍</p>` },
  { ico:"💌", titulo:"Habla conmigo cuando quieras 💌", boton:"¡Empezar a organizar mi dinero! ✨", html:`
    <p class="bv-cita">«Detrás de esta pantalla estoy yo ☕»</p>
    <p>Si encuentras algún fallo, tienes una idea para mejorar la app o simplemente quieres comentarme algo, escríbeme desde el buzón de la app.</p>
    <p>Leo todo personalmente y te contestaré enseguida que me sea posible.</p>` }
];

// Hoja con las tres tarjetas. Se resuelve al pulsar el último botón (o al cerrarla con Escape).
function hojaBienvenida(){
  document.getElementById("hoja")?.remove();
  const cont = document.createElement("div");
  cont.id = "hoja";
  cont.innerHTML = `
    <div class="hoja-fondo"></div>
    <div class="hoja hoja-bienvenida" role="dialog" aria-modal="true" aria-labelledby="hojaTitulo">
      <div class="hoja-asa"></div>
      <div class="bv-cuerpo" id="bvCuerpo"></div>
      <div class="bv-puntos" aria-hidden="true">${TARJETAS_BIENVENIDA.map(()=>"<span></span>").join("")}</div>
      <div class="hoja-btns"><button class="hoja-si" id="bvSiguiente"></button></div>
    </div>`;
  document.body.appendChild(cont);
  const previo = document.activeElement;
  const cuerpo = cont.querySelector("#bvCuerpo"), boton = cont.querySelector("#bvSiguiente");
  let paso = 0;
  const pintar = ()=>{
    const t = TARJETAS_BIENVENIDA[paso];
    cuerpo.innerHTML = `<div class="hoja-ico">${t.ico}</div><h2 id="hojaTitulo">${t.titulo}</h2><div class="bv-texto">${t.html}</div>`;
    cuerpo.scrollTop = 0;
    boton.textContent = t.boton;
    cont.querySelectorAll(".bv-puntos span").forEach((s,i)=>s.classList.toggle("activo", i===paso));
  };
  pintar();
  requestAnimationFrame(()=>requestAnimationFrame(()=>cont.classList.add("abierta")));
  return new Promise(resolver=>{
    const cerrar = ()=>{
      document.removeEventListener("keydown", tecla);
      cont.classList.remove("abierta");
      setTimeout(()=>cont.remove(), 260);
      try{ previo && previo.focus && previo.focus({preventScroll:true}); }catch(e){}
      resolver();
    };
    const tecla = e=>{ if(e.key==="Escape") cerrar(); };
    document.addEventListener("keydown", tecla);
    boton.onclick = ()=>{
      if(paso<TARJETAS_BIENVENIDA.length-1){ paso++; pintar(); boton.focus({preventScroll:true}); }
      else cerrar();
    };
    setTimeout(()=>{ try{ boton.focus({preventScroll:true}); }catch(e){} }, 60);
  });
}
