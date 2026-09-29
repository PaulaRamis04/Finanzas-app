const SUPABASE_URL = "https://qlgtgmgtijjzqwxkhwdg.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsZ3RnbWd0aWpqenF3eGtod2RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNDU1OTcsImV4cCI6MjEwNTgyMTU5N30.HZx4Sh-gic5ZG7i80utcShW_Jxwa20dATo0kdvIwoIA";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function guardarCuentaDefecto(id){
  cuentaDefecto = id || "";
  try{ if(id) localStorage.setItem("cuentaDefecto", id); else localStorage.removeItem("cuentaDefecto"); }catch(e){}
  const {error} = await sb.from("preferencias").upsert({user_id: session.user.id, cuenta_defecto: id || null});
  if(error){
    showError("Se ha guardado solo en este dispositivo. Para guardarlo en tu cuenta, ejecuta schema_preferencias.sql en Supabase. ("+error.message+")");
    return false;
  }
  hideError();
  return true;
}

// Movimientos: se cargan desde la fecha más antigua que necesita la vista actual.
let movForzarDesde = null; // mínimo pedido a mano (año anterior, abonos antiguos, importación, copia)
function fechaMes(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; }
function calcularMovDesde(){
  const hoy = new Date();
  const c = [`${periodoAnio}-01-01`, fechaMes(new Date(hoy.getFullYear(), hoy.getMonth()-1, 1))];
  if(movForzarDesde) c.push(movForzarDesde);
  presupuestos.forEach(p=>{ if(p.rollover && p.rolloverDesde) c.push(p.rolloverDesde.slice(0,7)+"-01"); });
  deudas.forEach(d=>{ if(d.estado==="pendiente" && d.fecha) c.push(d.fecha.slice(0,7)+"-01"); });
  return c.sort()[0];
}
// Si hace falta histórico anterior a lo cargado, lo pide y devuelve true (recargar ya repinta).
function asegurarMovimientosDesde(fecha){
  if(!movParcial || !fecha || fecha>=movDesde) return false;
  const f = fecha.slice(0,7)+"-01";
  if(!movForzarDesde || f<movForzarDesde) movForzarDesde = f;
  recargar(["movimientos"]);
  return true;
}
async function cargarHistoricoCompleto(){
  if(!movParcial || movDesde<="1900-01-01") return;
  movForzarDesde = "1900-01-01";
  await recargar(["movimientos"]);
}

const TABLAS = {
  cuentas: { q:()=>sb.from("cuentas").select("*").order("nombre"),
    set:d=>{ cuentas = d.map(c=>({id:c.id, nombre:c.nombre, saldoInicial:Number(c.saldo_inicial), orden:c.orden||0})).sort(porOrden); } },
  movimientos: { q: async ()=>{
      const desde = calcularMovDesde();
      const [res, lista] = await Promise.all([
        sb.rpc("resumen_movimientos_mensual"),
        sb.from("movimientos").select("*").gte("fecha", desde).order("fecha", {ascending:false})
      ]);
      if(res.error){ // schema_resumen_movimientos.sql sin aplicar: carga completa como antes
        const todo = await sb.from("movimientos").select("*").order("fecha", {ascending:false});
        return {data:{filas:todo.data||[], resumen:null, desde:null}, error:todo.error};
      }
      return {data:{filas:lista.data||[], resumen:res.data||[], desde}, error:lista.error};
    },
    map:m=>({id:m.id, tipo:m.tipo, categoria:m.categoria, importe:Number(m.importe), fecha:m.fecha, nota:m.nota, cuentaId:m.cuenta_id, saldoBanco:m.saldo_banco!=null?Number(m.saldo_banco):null, presupuesto:m.presupuesto||null, presupuestoFecha:m.presupuesto_fecha||null, reembolsoDe:m.reembolso_de||null, recurrenteId:m.recurrente_id||null, transferenciaId:m.transferencia_id||null, conciliado:!!m.conciliado, deudaId:m.deuda_id||null}),
    set:d=>{
      movimientos = d.filas.map(TABLAS.movimientos.map);
      movParcial = !!d.resumen;
      movDesde = movParcial ? d.desde : null;
      movResumen = (d.resumen||[]).map(r=>({cuentaId:r.cuenta_id, mes:r.mes, ingresos:Number(r.ingresos), gastos:Number(r.gastos), n:Number(r.n)}));
    } },
  deudas: { q:()=>sb.from("deudas").select("*"),
    set:rows=>{ deudas = rows.map(d=>({id:d.id, persona:d.persona, importe:Number(d.importe), importeInicial:d.importe_inicial!=null?Number(d.importe_inicial):Number(d.importe), direccion:d.direccion, concepto:d.concepto, estado:d.estado, fecha:d.fecha, presupuesto:d.presupuesto||null, movimientoId:d.movimiento_id||null})); } },
  inversiones: { q:()=>sb.from("inversiones").select("*"),
    set:d=>{ inversiones = d.map(i=>({id:i.id, nombre:i.nombre, tipo:i.tipo, valorActual:Number(i.valor_actual), valorInicial:Number(i.valor_inicial), estado:i.estado||"activa", fechaPrevista:i.fecha_prevista, importePrevisto:i.importe_previsto!=null?Number(i.importe_previsto):null, cuentaPrevistaId:i.cuenta_prevista_id, padreId:i.padre_id||null, esGrupo:!!i.es_grupo, orden:i.orden||0, rentas:Number(i.rentas||0)})); } },
  aportaciones_inversion: { q:()=>sb.from("aportaciones_inversion").select("*"),
    set:d=>{ aportaciones = d.map(a=>({id:a.id, inversionId:a.inversion_id, importe:Number(a.importe), fecha:a.fecha, cuentaId:a.cuenta_id, movimientoId:a.movimiento_id})); } },
  retiros_inversion: { q:()=>sb.from("retiros_inversion").select("*"),
    set:d=>{ retiros = d.map(r=>({id:r.id, inversionId:r.inversion_id, importe:Number(r.importe), fecha:r.fecha, cuentaId:r.cuenta_id, movimientoId:r.movimiento_id})); } },
  categorias: { q:()=>sb.from("categorias").select("*"),
    set:d=>{ categorias = d.map(c=>({id:c.id, tipo:c.tipo, padre:c.padre, nombre:c.nombre})); } },
  presupuestos: { q:()=>sb.from("presupuestos").select("*"),
    set:d=>{ presupuestos = d.map(p=>({id:p.id, categoria:p.categoria, limite:Number(p.limite), rollover:!!p.rollover, rolloverDesde:p.rollover_desde||null})); } },
  recurrentes: { q:()=>sb.from("recurrentes").select("*"),
    set:d=>{ recurrentes = d.map(r=>({id:r.id, tipo:r.tipo, categoria:r.categoria, importe:Number(r.importe), nota:r.nota||"", cuentaId:r.cuenta_id, diaMes:r.dia_mes, activo:r.activo, fechaInicio:r.fecha_inicio, ultimaGenerada:r.ultima_generada})); } },
  objetivos: { q:()=>sb.from("objetivos").select("*"),
    set:d=>{ objetivos = d.map(o=>({id:o.id, nombre:o.nombre, meta:Number(o.meta), tipoVinculo:o.tipo_vinculo, vinculoId:o.vinculo_id, orden:o.orden||0,
      autoActivo:!!o.auto_activo, autoCuota:o.auto_cuota!=null?Number(o.auto_cuota):null, autoDiaMes:o.auto_dia_mes||null, autoCuentaOrigen:o.auto_cuenta_origen||null, autoUltimaGenerada:o.auto_ultima_generada||null})).sort(porOrden); } },
  movimientos_pendientes: { q:()=>sb.from("movimientos_pendientes").select("*"),
    set:d=>{ pendientes = d.map(x=>({id:x.id, cuentaId:x.cuenta_id, tipo:x.tipo, importe:Number(x.importe), fecha:x.fecha, descripcion:x.descripcion||"", saldo:x.saldo!=null?Number(x.saldo):null, posicion:x.posicion||0})); } },
  preferencias: { q:()=>sb.from("preferencias").select("*"), opcional:true,
    set:d=>{ if(!d[0]) return;
      cuentaDefecto = d[0].cuenta_defecto || "";
      try{ if(cuentaDefecto) localStorage.setItem("cuentaDefecto", cuentaDefecto); else localStorage.removeItem("cuentaDefecto"); }catch(e){} } }
};

async function recargar(tablas = Object.keys(TABLAS), {procesar=false} = {}){
  try{
    if(procesar){
      try{ await sb.rpc("procesar_recurrentes"); }catch(e){}
      try{ await sb.rpc("procesar_aportaciones_objetivos"); }catch(e){}
    }
    const res = await Promise.all(tablas.map(t=>TABLAS[t].q()));
    const fallo = res.find((r,i)=>r.error && !TABLAS[tablas[i]].opcional);
    if(fallo){ ready = true; render(); showError("No se pudieron cargar los datos: "+fallo.error.message); return; }
    for(let i=0; i<tablas.length; i++){
      let data = res[i].data || [];
      if(tablas[i]==="categorias" && data.length===0){
        const {error:eSeed} = await sb.from("categorias").insert(CATEGORIAS_DEFECTO);
        if(eSeed) continue;
        data = (await TABLAS.categorias.q()).data || [];
      }
      TABLAS[tablas[i]].set(data);
    }
    // Presupuestos/deudas pueden pedir más histórico del que se calculó antes de tenerlos.
    if(movParcial && calcularMovDesde()<movDesde){ await recargar(["movimientos"]); return; }
    detectarObjetivosCompletados();
    hideError(); ready = true;
    const ae = document.activeElement;
    const escribiendo = refrescoSilencioso && (arrastrando || (ae && ["INPUT","SELECT","TEXTAREA"].includes(ae.tagName) && document.getElementById("app").contains(ae)));
    refrescoSilencioso = false;
    if(escribiendo) renderBalance(); else render();
  }catch(e){
    ready = true; render();
    showError("No se han podido cargar los datos. Comprueba tu conexión e inténtalo de nuevo.");
  }
}

function fetchAll(){ return recargar(undefined, {procesar:true}); }

function applyAuthUI(){
  document.getElementById("authScreen").style.display = session ? "none" : "block";
  document.getElementById("appShell").style.display = session ? "block" : "none";
  if(session){
    const nombre = session.user.user_metadata?.full_name;
    document.getElementById("sesionInfo").textContent = nombre ? `Hola, ${nombre}` : session.user.email;
  }
}

function refrescar(){ if(!session) return; refrescoSilencioso = true; fetchAll(); }

// Realtime: agrupa los cambios de 400 ms y recarga solo las tablas afectadas.
const tablasPorRecargar = new Set();
let timerRecarga = null;
function refrescarTabla(tabla){
  if(!session) return;
  tablasPorRecargar.add(tabla);
  clearTimeout(timerRecarga);
  timerRecarga = setTimeout(()=>{
    const tablas = [...tablasPorRecargar];
    tablasPorRecargar.clear();
    refrescoSilencioso = true;
    recargar(tablas);
  }, 400);
}

async function startApp(){
  if(appStarted) return;
  appStarted = true;
  render();
  await fetchAll();
  let primeraSub = true;
  const canal = sb.channel("cambios");
  Object.keys(TABLAS).filter(t=>t!=="preferencias").forEach(t=>
    canal.on("postgres_changes", {event:"*", schema:"public", table:t}, ()=>refrescarTabla(t)));
  canal
    .subscribe((status)=>{
      if(status==="SUBSCRIBED"){ if(primeraSub) primeraSub = false; else refrescar(); }
    });
  document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible") refrescar(); });
  window.addEventListener("online", refrescar);
}

async function init(){
  if(!SUPABASE_URL.startsWith("http")){
    document.body.innerHTML = `<div class="status">Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY en el código.</div>`;
    return;
  }
  document.getElementById("fLogin").onsubmit = async (e)=>{
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const nombre = document.getElementById("loginNombre").value;
    const msg = document.getElementById("loginMsg");
    msg.textContent = "Enviando...";
    localStorage.setItem("pendingName", nombre);
    const {error} = await sb.auth.signInWithOtp({email, options:{emailRedirectTo: window.location.href, data:{full_name: nombre}}});
    msg.textContent = error ? "Error: "+error.message : "Enlace enviado. Revisa tu correo y pulsa el enlace desde este mismo dispositivo.";
  };
  document.getElementById("btnLogout").onclick = ()=> sb.auth.signOut();

  const {data:{session:s}} = await sb.auth.getSession();
  session = s;
  await syncPendingName();
  applyAuthUI();
  if(session) startApp();

  sb.auth.onAuthStateChange(async (_event, s2)=>{
    session = s2;
    await syncPendingName();
    applyAuthUI();
    if(session) startApp();
  });
}

async function syncPendingName(){
  const pending = localStorage.getItem("pendingName");
  if(pending && session){
    const {data, error} = await sb.auth.updateUser({data:{full_name: pending}});
    if(!error && data?.user) session = {...session, user: data.user};
    localStorage.removeItem("pendingName");
  }
}
