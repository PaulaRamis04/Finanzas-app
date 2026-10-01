// Saldo del mes pasado: al empezar un mes nuevo, si el disponible del mes anterior quedó en positivo o en negativo,
// una hoja inferior pregunta si sumarlo (o descontarlo) del disponible de este mes. Se pregunta una vez por mes.
// La decisión se guarda en la tabla «saldo_arrastre» (schema_saldo_arrastre.sql); sin ella, en este dispositivo.

let arrastres = {}; // {"AAAA-MM": {decision:"si"|"no", importe}}
let arrastresEnBd = false, arrastreRevisado = false;

const claveMes = (y, m)=>`${y}-${String(m).padStart(2,"0")}`;
function leerArrastresLocal(){ try{ const a = JSON.parse(localStorage.getItem("arrastresMes")||"{}"); return a && typeof a==="object" ? a : {}; }catch(e){ return {}; } }

function fijarArrastres(d){
  arrastresEnBd = d.ok;
  const enBd = {};
  d.filas.forEach(r=>{ enBd[r.mes] = {decision:r.decision, importe:Number(r.importe)}; });
  // Lo guardado en la cuenta manda; lo que solo está en el dispositivo rellena los huecos.
  arrastres = {...leerArrastresLocal(), ...enBd};
}

// Lo que se sumó (o restó) al disponible de ese mes; 0 si se dijo que no o aún no se ha decidido.
function arrastreMes(y, m){ const a = arrastres[claveMes(y, m)]; return a && a.decision==="si" ? a.importe : 0; }
function arrastrePeriodo(){ return periodoMes==="todos" ? 0 : arrastreMes(periodoAnio, Number(periodoMes)); }

// Disponible con el que cerró un mes (ingresos menos gastos y ahorro, más lo que arrastraba). null si no está cargado.
function disponibleMes(y, m){
  const desde = claveMes(y, m)+"-01";
  const hasta = m===12 ? claveMes(y+1, 1)+"-01" : claveMes(y, m+1)+"-01";
  if(movParcial && desde<movDesde) return null;
  const lista = movimientosEfectivos(f=>!!f && f>=desde && f<hasta);
  const ingresos = sumaImportes(lista.filter(x=>x.tipo==="ingreso"));
  const gastos = sumaImportes(lista.filter(x=>x.tipo==="gasto"));
  return sumarDinero(restarDinero(ingresos, gastos), arrastreMes(y, m));
}

async function revisarArrastreMes(){
  if(arrastreRevisado || !session) return;
  const hoy = new Date();
  const y = hoy.getFullYear(), m = hoy.getMonth()+1;
  const py = m===1 ? y-1 : y, pm = m===1 ? 12 : m-1;
  if(arrastres[claveMes(y, m)]){ arrastreRevisado = true; return; }
  const importe = disponibleMes(py, pm);
  if(importe===null) return;
  arrastreRevisado = true;
  if(Math.abs(importe)<0.005) return;
  // Si ya hay otra hoja abierta (p. ej. un hito nuevo), se espera a que se cierre.
  if(document.getElementById("hoja")){ arrastreRevisado = false; setTimeout(revisarArrastreMes, 1500); return; }
  const respuesta = await hojaArrastre(importe);
  if(respuesta===null) return; // cerrada sin contestar: se vuelve a preguntar la próxima vez que se abra la app
  await guardarArrastre(claveMes(y, m), respuesta ? "si" : "no", importe);
}

async function guardarArrastre(mes, decision, importe){
  arrastres[mes] = {decision, importe};
  try{ const local = leerArrastresLocal(); local[mes] = {decision, importe}; localStorage.setItem("arrastresMes", JSON.stringify(local)); }catch(e){}
  if(arrastresEnBd){
    const {error} = await sb.from("saldo_arrastre").upsert({mes, decision, importe}, {onConflict:"user_id,mes"});
    if(error) arrastresEnBd = false;
  }
  render();
}

// Hoja inferior con la pregunta. Devuelve true (sí), false (no) o null si se cierra sin contestar.
function hojaArrastre(importe){
  const positivo = importe>0;
  const cantidad = ocultarSaldos ? eur(importe) : importeMensaje(Math.abs(importe));
  const titulo = positivo ? "¡Bien hecho!" : `El mes pasado gastaste ${cantidad} más de lo planeado.`;
  const texto = positivo ? `El mes pasado te sobraron ${cantidad}. ¿Quieres sumarlos a tu disponible de este mes para gastar más holgada?`
    : "¿Quieres descontarlo del disponible de este mes para compensar?";
  const [si, no] = positivo ? ["Sí, añadirlo ✨", "No, dejarlo como ahorro 🌱"] : ["Sí, ajustar disponible 📉", "No, empezar de cero 🔄"];
  document.getElementById("hoja")?.remove();
  const cont = document.createElement("div");
  cont.id = "hoja";
  cont.innerHTML = `
    <div class="hoja-fondo"></div>
    <div class="hoja" role="dialog" aria-modal="true" aria-labelledby="hojaTitulo">
      <div class="hoja-asa"></div>
      <div class="hoja-ico${positivo ? "" : " arrastre-neg"}">${positivo ? "🎉" : "🐷"}</div>
      <h2 id="hojaTitulo">${esc(titulo)}</h2>
      <p>${esc(texto)}</p>
      <div class="hoja-btns hoja-btns-arrastre">
        <button class="hoja-si" id="hojaArrastreSi">${si}</button>
        <button class="hoja-no" id="hojaArrastreNo">${no}</button>
      </div>
    </div>`;
  document.body.appendChild(cont);
  const previo = document.activeElement;
  requestAnimationFrame(()=>requestAnimationFrame(()=>cont.classList.add("abierta")));
  return new Promise(resolver=>{
    const cerrar = valor=>{
      document.removeEventListener("keydown", tecla);
      cont.classList.remove("abierta");
      setTimeout(()=>cont.remove(), 260);
      try{ previo && previo.focus && previo.focus({preventScroll:true}); }catch(e){}
      resolver(valor);
    };
    const tecla = e=>{ if(e.key==="Escape") cerrar(null); };
    document.addEventListener("keydown", tecla);
    cont.querySelector(".hoja-fondo").onclick = ()=>cerrar(null);
    cont.querySelector("#hojaArrastreSi").onclick = ()=>cerrar(true);
    cont.querySelector("#hojaArrastreNo").onclick = ()=>cerrar(false);
    setTimeout(()=>{ try{ cont.querySelector("#hojaArrastreSi").focus({preventScroll:true}); }catch(e){} }, 60);
  });
}

// Nota bajo el disponible cuando incluye el saldo del mes pasado.
function notaArrastre(){
  const a = arrastrePeriodo();
  if(!a) return "";
  const m = Number(periodoMes), anterior = MESES[(m+10)%12].toLowerCase();
  return a>0 ? `Incluye ${eur(a)} que te sobraron en ${anterior}` : `Incluye ${eur(Math.abs(a))} descontados de ${anterior}`;
}
