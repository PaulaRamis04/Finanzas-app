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

async function fetchAll(){
  try{
    try{ await sb.rpc("procesar_recurrentes"); }catch(e){}
    try{ await sb.rpc("procesar_aportaciones_objetivos"); }catch(e){}
    const [{data:cta, error:e1}, {data:mov, error:e2}, {data:deu, error:e3}, {data:inv, error:e4}, {data:apo, error:e5}, {data:cat, error:e6}, {data:ret, error:e7}, {data:pre, error:e8}, {data:obj, error:e9}, {data:pen, error:e10}, {data:pref}] = await Promise.all([
      sb.from("cuentas").select("*").order("nombre"),
      sb.from("movimientos").select("*").order("fecha", {ascending:false}),
      sb.from("deudas").select("*"),
      sb.from("inversiones").select("*"),
      sb.from("aportaciones_inversion").select("*"),
      sb.from("categorias").select("*"),
      sb.from("retiros_inversion").select("*"),
      sb.from("presupuestos").select("*"),
      sb.from("objetivos").select("*"),
      sb.from("movimientos_pendientes").select("*"),
      sb.from("preferencias").select("*")
    ]);
    const err = e1||e2||e3||e4||e5||e6||e7||e8||e9||e10;
    if(err){ ready = true; render(); showError("No se pudieron cargar los datos: "+err.message); return; }
    cuentas = (cta||[]).map(c=>({id:c.id, nombre:c.nombre, saldoInicial:Number(c.saldo_inicial), orden:c.orden||0})).sort(porOrden);
    movimientos = (mov||[]).map(m=>({id:m.id, tipo:m.tipo, categoria:m.categoria, importe:Number(m.importe), fecha:m.fecha, nota:m.nota, cuentaId:m.cuenta_id, saldoBanco:m.saldo_banco!=null?Number(m.saldo_banco):null, presupuesto:m.presupuesto||null, presupuestoFecha:m.presupuesto_fecha||null, reembolsoDe:m.reembolso_de||null, recurrenteId:m.recurrente_id||null, transferenciaId:m.transferencia_id||null, conciliado:!!m.conciliado}));
    deudas = (deu||[]).map(d=>({id:d.id, persona:d.persona, importe:Number(d.importe), direccion:d.direccion, concepto:d.concepto, estado:d.estado, fecha:d.fecha, presupuesto:d.presupuesto||null, movimientoId:d.movimiento_id||null}));
    inversiones = (inv||[]).map(i=>({id:i.id, nombre:i.nombre, tipo:i.tipo, valorActual:Number(i.valor_actual), valorInicial:Number(i.valor_inicial), estado:i.estado||"activa", fechaPrevista:i.fecha_prevista, importePrevisto:i.importe_previsto!=null?Number(i.importe_previsto):null, cuentaPrevistaId:i.cuenta_prevista_id, padreId:i.padre_id||null, esGrupo:!!i.es_grupo, orden:i.orden||0, rentas:Number(i.rentas||0)}));
    aportaciones = (apo||[]).map(a=>({id:a.id, inversionId:a.inversion_id, importe:Number(a.importe), fecha:a.fecha, cuentaId:a.cuenta_id, movimientoId:a.movimiento_id}));
    retiros = (ret||[]).map(r=>({id:r.id, inversionId:r.inversion_id, importe:Number(r.importe), fecha:r.fecha, cuentaId:r.cuenta_id, movimientoId:r.movimiento_id}));
    presupuestos = (pre||[]).map(p=>({id:p.id, categoria:p.categoria, limite:Number(p.limite), rollover:!!p.rollover, rolloverDesde:p.rollover_desde||null}));
    const {data:rec} = await sb.from("recurrentes").select("*");
    recurrentes = (rec||[]).map(r=>({id:r.id, tipo:r.tipo, categoria:r.categoria, importe:Number(r.importe), nota:r.nota||"", cuentaId:r.cuenta_id, diaMes:r.dia_mes, activo:r.activo, fechaInicio:r.fecha_inicio, ultimaGenerada:r.ultima_generada}));
    objetivos = (obj||[]).map(o=>({id:o.id, nombre:o.nombre, meta:Number(o.meta), tipoVinculo:o.tipo_vinculo, vinculoId:o.vinculo_id, orden:o.orden||0,
      autoActivo:!!o.auto_activo, autoCuota:o.auto_cuota!=null?Number(o.auto_cuota):null, autoDiaMes:o.auto_dia_mes||null, autoCuentaOrigen:o.auto_cuenta_origen||null, autoUltimaGenerada:o.auto_ultima_generada||null})).sort(porOrden);
    if(pref && pref[0]){
      cuentaDefecto = pref[0].cuenta_defecto || "";
      try{ if(cuentaDefecto) localStorage.setItem("cuentaDefecto", cuentaDefecto); else localStorage.removeItem("cuentaDefecto"); }catch(e){}
    }
    pendientes = (pen||[]).map(x=>({id:x.id, cuentaId:x.cuenta_id, tipo:x.tipo, importe:Number(x.importe), fecha:x.fecha, descripcion:x.descripcion||"", saldo:x.saldo!=null?Number(x.saldo):null, posicion:x.posicion||0}));
    if((cat||[]).length===0){
      const {error:eSeed} = await sb.from("categorias").insert(CATEGORIAS_DEFECTO);
      if(!eSeed){ const {data:cat2} = await sb.from("categorias").select("*"); categorias = (cat2||[]).map(c=>({id:c.id, tipo:c.tipo, padre:c.padre, nombre:c.nombre})); }
    } else {
      categorias = cat.map(c=>({id:c.id, tipo:c.tipo, padre:c.padre, nombre:c.nombre}));
    }
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

function applyAuthUI(){
  document.getElementById("authScreen").style.display = session ? "none" : "block";
  document.getElementById("appShell").style.display = session ? "block" : "none";
  if(session){
    const nombre = session.user.user_metadata?.full_name;
    document.getElementById("sesionInfo").textContent = nombre ? `Hola, ${nombre}` : session.user.email;
  }
}

function refrescar(){ if(!session) return; refrescoSilencioso = true; fetchAll(); }

async function startApp(){
  if(appStarted) return;
  appStarted = true;
  render();
  await fetchAll();
  let primeraSub = true;
  sb.channel("cambios")
    .on("postgres_changes", {event:"*", schema:"public", table:"movimientos"}, refrescar)
    .on("postgres_changes", {event:"*", schema:"public", table:"deudas"}, refrescar)
    .on("postgres_changes", {event:"*", schema:"public", table:"cuentas"}, refrescar)
    .on("postgres_changes", {event:"*", schema:"public", table:"inversiones"}, refrescar)
    .on("postgres_changes", {event:"*", schema:"public", table:"aportaciones_inversion"}, refrescar)
    .on("postgres_changes", {event:"*", schema:"public", table:"categorias"}, refrescar)
    .on("postgres_changes", {event:"*", schema:"public", table:"retiros_inversion"}, refrescar)
    .on("postgres_changes", {event:"*", schema:"public", table:"presupuestos"}, refrescar)
    .on("postgres_changes", {event:"*", schema:"public", table:"objetivos"}, refrescar)
    .on("postgres_changes", {event:"*", schema:"public", table:"movimientos_pendientes"}, refrescar)
    .on("postgres_changes", {event:"*", schema:"public", table:"recurrentes"}, refrescar)
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
