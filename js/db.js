const SUPABASE_URL = "https://qlgtgmgtijjzqwxkhwdg.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsZ3RnbWd0aWpqenF3eGtod2RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNDU1OTcsImV4cCI6MjEwNTgyMTU5N30.HZx4Sh-gic5ZG7i80utcShW_Jxwa20dATo0kdvIwoIA";

// Se mira antes de crear el cliente, que limpia el # de la URL al leer la sesión.
let recuperando = /type=recovery/.test(location.hash);
const errorEnlace = new URLSearchParams(location.hash.slice(1)).get("error_description");
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

// Supabase corta cada consulta en 1000 filas: pide páginas hasta traerlo todo.
const TAM_PAGINA = 1000;
async function todas(consulta){
  const filas = [];
  for(let desde=0; ; desde+=TAM_PAGINA){
    const {data, error} = await consulta().order("id").range(desde, desde+TAM_PAGINA-1);
    if(error) return {data:null, error};
    filas.push(...(data||[]));
    if(!data || data.length<TAM_PAGINA) return {data:filas, error:null};
  }
}

// Renombra la categoría y todo lo que la usa (movimientos, presupuestos, recurrentes).
async function renombrarCategoria(cat, nuevo){
  const r = await sb.rpc("renombrar_categoria", {p_id: String(cat.id), p_nombre: nuevo});
  if(!r.error || r.error.code!=="PGRST202") return r;
  // schema_renombrar_categoria.sql sin aplicar: mismo cambio desde el cliente (no atómico).
  const pasos = [
    ()=>sb.from("categorias").update({nombre:nuevo}).eq("id", cat.id),
    ()=>sb.from("movimientos").update({categoria:nuevo}).eq("categoria", cat.nombre).eq("tipo", cat.tipo),
    ()=>sb.from("recurrentes").update({categoria:nuevo}).eq("categoria", cat.nombre).eq("tipo", cat.tipo)
  ];
  if(cat.tipo==="gasto") pasos.push(()=>sb.from("presupuestos").update({categoria:nuevo}).eq("categoria", cat.nombre));
  for(const paso of pasos){ const {error} = await paso(); if(error) return {error}; }
  return {error:null};
}

// ── Restaurar copia de seguridad ──
// Solo en una cuenta sin datos, para no duplicar nada. Conserva los ids de la copia, así los
// vínculos entre tablas siguen valiendo. Si algo falla a mitad, borra lo que haya insertado.
const COPIA_A_FILAS = {
  cuentas: c=>({id:c.id, nombre:c.nombre, saldo_inicial:c.saldoInicial, orden:c.orden||0}),
  categorias: c=>({id:c.id, tipo:c.tipo, padre:c.padre??null, nombre:c.nombre}),
  presupuestos: p=>({id:p.id, categoria:p.categoria, limite:p.limite, rollover:!!p.rollover, rollover_desde:p.rolloverDesde??null}),
  recurrentes: r=>({id:r.id, tipo:r.tipo, categoria:r.categoria, importe:r.importe, nota:r.nota||"", cuenta_id:r.cuentaId??null, dia_mes:r.diaMes, activo:r.activo, fecha_inicio:r.fechaInicio, ultima_generada:r.ultimaGenerada??null}),
  inversiones: i=>({id:i.id, nombre:i.nombre, tipo:i.tipo??"", valor_actual:i.valorActual, valor_inicial:i.valorInicial, estado:i.estado||"activa", fecha_prevista:i.fechaPrevista??null, importe_previsto:i.importePrevisto??null, cuenta_prevista_id:i.cuentaPrevistaId??null, padre_id:i.padreId??null, es_grupo:!!i.esGrupo, orden:i.orden||0, rentas:i.rentas||0}),
  deudas: d=>({id:d.id, persona:d.persona, importe:d.importe, importe_inicial:d.importeInicial??d.importe, direccion:d.direccion, concepto:d.concepto??"", estado:d.estado, fecha:d.fecha, movimiento_id:null}),
  movimientos: m=>({id:m.id, tipo:m.tipo, categoria:m.categoria, importe:m.importe, fecha:m.fecha, nota:m.nota??null, cuenta_id:m.cuentaId??null, saldo_banco:m.saldoBanco??null, reembolso_de:null, recurrente_id:m.recurrenteId??null, transferencia_id:m.transferenciaId??null, conciliado:!!m.conciliado, deuda_id:m.deudaId??null}),
  aportaciones_inversion: a=>({id:a.id, inversion_id:a.inversionId, importe:a.importe, fecha:a.fecha, cuenta_id:a.cuentaId??null, movimiento_id:a.movimientoId??null}),
  retiros_inversion: r=>({id:r.id, inversion_id:r.inversionId, importe:r.importe, fecha:r.fecha, cuenta_id:r.cuentaId??null, movimiento_id:r.movimientoId??null}),
  objetivos: o=>({id:o.id, nombre:o.nombre, meta:o.meta, tipo_vinculo:o.tipoVinculo, vinculo_id:o.vinculoId??null, orden:o.orden||0, auto_activo:!!o.autoActivo, auto_cuota:o.autoCuota??null, auto_dia_mes:o.autoDiaMes??null, auto_cuenta_origen:o.autoCuentaOrigen??null, auto_ultima_generada:o.autoUltimaGenerada??null,
    ...(o.tema?{tema:o.tema}:{}), ...(o.ahorrado?{ahorrado:o.ahorrado}:{})})
};
// Clave de la copia para cada tabla (la copia usa los nombres del estado de la app).
const CLAVE_COPIA = {aportaciones_inversion:"aportaciones", retiros_inversion:"retiros"};

function leerCopia(texto){
  let d;
  try{ d = JSON.parse(texto); }catch(e){ throw new Error("El archivo no es un JSON válido."); }
  if(!d || !d.exportado_en || !Array.isArray(d.movimientos) || !Array.isArray(d.cuentas)) throw new Error("El archivo no es una copia de seguridad de esta app.");
  const filas = {};
  Object.keys(COPIA_A_FILAS).forEach(t=>{ filas[t] = (d[CLAVE_COPIA[t]||t] || []).map(COPIA_A_FILAS[t]); });
  // "archivada" solo se envía si hace falta: sin schema_cuentas_archivadas.sql la columna no existe.
  const archivadas = new Set((d.cuentas||[]).filter(c=>c.archivada).map(c=>c.id));
  if(archivadas.size) filas.cuentas.forEach(c=>{ c.archivada = archivadas.has(c.id); });
  return {
    exportadoEn: d.exportado_en, filas,
    reembolsos: d.movimientos.filter(m=>m.reembolsoDe).map(m=>({id:m.id, reembolso_de:m.reembolsoDe})),
    deudaMov: (d.deudas||[]).filter(x=>x.movimientoId).map(x=>({id:x.id, movimiento_id:x.movimientoId}))
  };
}

async function cuentaVacia(){
  const tablas = ["cuentas","movimientos","deudas","inversiones","objetivos","recurrentes","presupuestos"];
  const res = await Promise.all(tablas.map(t=>sb.from(t).select("id", {count:"exact", head:true})));
  const err = res.find(r=>r.error);
  if(err) throw new Error(err.error.message);
  return res.every(r=>!r.count);
}

async function restaurarCopia(copia, progreso = ()=>{}){
  if(!(await cuentaVacia())) throw new Error("Solo se puede restaurar en una cuenta sin datos, para no duplicar nada. Borra antes tus cuentas, movimientos, deudas, inversiones, objetivos, recurrentes y presupuestos, o usa otra cuenta.");
  const {filas} = copia;
  const insertados = {}; // tabla -> ids, para deshacer
  const LOTE = 500;
  const insertar = async (clave, lista)=>{
    const tabla = clave==="inversiones_hijas" ? "inversiones" : clave;
    for(let i=0; i<lista.length; i+=LOTE){
      const lote = lista.slice(i, i+LOTE);
      const {error} = await sb.from(tabla).insert(lote);
      if(error) throw new Error(`${tabla}: ${error.message}`);
      (insertados[clave] = insertados[clave] || []).push(...lote.map(x=>x.id));
    }
  };
  const actualizar = async (tabla, lista)=>{
    for(const x of lista){
      const {id, ...cambios} = x;
      const {error} = await sb.from(tabla).update(cambios).eq("id", id);
      if(error) throw new Error(`${tabla}: ${error.message}`);
    }
  };
  try{
    progreso("Cuentas y categorías…");
    await insertar("cuentas", filas.cuentas);
    // La cuenta está vacía, así que las categorías que tenga son las de por defecto: se sustituyen
    // por las de la copia (si falla, la app vuelve a crear las de por defecto al cargar).
    if(filas.categorias.length){
      const {error:eCats} = await sb.from("categorias").delete().not("id", "is", null);
      if(eCats) throw new Error(eCats.message);
    }
    await insertar("categorias", filas.categorias);
    await insertar("presupuestos", filas.presupuestos);
    await insertar("recurrentes", filas.recurrentes);
    progreso("Inversiones y deudas…");
    await insertar("inversiones", filas.inversiones.filter(i=>!i.padre_id));
    await insertar("inversiones_hijas", filas.inversiones.filter(i=>i.padre_id));
    await insertar("deudas", filas.deudas);
    progreso(`Movimientos (${filas.movimientos.length})…`);
    await insertar("movimientos", filas.movimientos);
    progreso("Vínculos…");
    await actualizar("movimientos", copia.reembolsos);
    await actualizar("deudas", copia.deudaMov);
    await insertar("aportaciones_inversion", filas.aportaciones_inversion);
    await insertar("retiros_inversion", filas.retiros_inversion);
    await insertar("objetivos", filas.objetivos);
  }catch(e){
    progreso("Deshaciendo…");
    await deshacerRestauracion(insertados);
    throw e;
  }
}

async function deshacerRestauracion(insertados){
  const porLotes = async (ids, fn)=>{ for(let i=0; i<ids.length; i+=100) await fn(ids.slice(i, i+100)); };
  const borrar = (clave)=>porLotes(insertados[clave] || [], ids=>sb.from(clave==="inversiones_hijas" ? "inversiones" : clave).delete().in("id", ids));
  // Primero se sueltan los vínculos circulares (deuda ↔ movimiento, reembolso → movimiento).
  await porLotes(insertados.deudas || [], ids=>sb.from("deudas").update({movimiento_id:null}).in("id", ids));
  await porLotes(insertados.movimientos || [], ids=>sb.from("movimientos").update({reembolso_de:null}).in("id", ids));
  for(const t of ["objetivos","retiros_inversion","aportaciones_inversion","movimientos","deudas","inversiones_hijas","inversiones","recurrentes","presupuestos","categorias","cuentas"]) await borrar(t);
}

const TABLAS = {
  cuentas: { q:()=>todas(()=>sb.from("cuentas").select("*").order("nombre")),
    set:d=>{ cuentas = d.map(c=>({id:c.id, nombre:c.nombre, saldoInicial:Number(c.saldo_inicial), orden:c.orden||0, archivada:!!c.archivada,
      propia:!c.user_id || c.user_id===session?.user?.id, propietarioId:c.user_id||null})).sort(porOrden); } },
  // Sin schema_cuentas_compartidas.sql la tabla no existe: no hay cuentas compartidas.
  cuentas_miembros: { q:()=>sb.from("cuentas_miembros").select("*"), opcional:true, sinRealtime:true,
    set:d=>{ cuentasMiembros = d.map(m=>({cuentaId:m.cuenta_id, userId:m.user_id, email:m.email, propietarioId:m.propietario_id, propietarioEmail:m.propietario_email})); } },
  // Sin schema_premium.sql (o si falla la consulta) no se cambia nada.
  perfil: { q:async ()=>{ const r = await sb.rpc("es_premium"); return {data:r.error ? null : {premium:r.data===true}, error:r.error}; }, opcional:true, sinRealtime:true,
    set:d=>{ if(Array.isArray(d)) return; esPremium = d.premium; if(!esPremium) quitarPersonalizacionPremium(); } },
  movimientos: { q: async ()=>{
      const desde = calcularMovDesde();
      const [res, lista] = await Promise.all([
        sb.rpc("resumen_movimientos_mensual"),
        todas(()=>sb.from("movimientos").select("*").gte("fecha", desde).order("fecha", {ascending:false}))
      ]);
      if(res.error){ // schema_resumen_movimientos.sql sin aplicar: carga completa como antes
        const todo = await todas(()=>sb.from("movimientos").select("*").order("fecha", {ascending:false}));
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
  deudas: { q:()=>todas(()=>sb.from("deudas").select("*")),
    set:rows=>{ deudas = rows.map(d=>({id:d.id, persona:d.persona, importe:Number(d.importe), importeInicial:d.importe_inicial!=null?Number(d.importe_inicial):Number(d.importe), direccion:d.direccion, concepto:d.concepto, estado:d.estado, fecha:d.fecha, presupuesto:d.presupuesto||null, movimientoId:d.movimiento_id||null})); } },
  inversiones: { q:()=>todas(()=>sb.from("inversiones").select("*")),
    set:d=>{ inversiones = d.map(i=>({id:i.id, nombre:i.nombre, tipo:i.tipo, valorActual:Number(i.valor_actual), valorInicial:Number(i.valor_inicial), estado:i.estado||"activa", fechaPrevista:i.fecha_prevista, importePrevisto:i.importe_previsto!=null?Number(i.importe_previsto):null, cuentaPrevistaId:i.cuenta_prevista_id, padreId:i.padre_id||null, esGrupo:!!i.es_grupo, orden:i.orden||0, rentas:Number(i.rentas||0)})); } },
  aportaciones_inversion: { q:()=>todas(()=>sb.from("aportaciones_inversion").select("*")),
    set:d=>{ aportaciones = d.map(a=>({id:a.id, inversionId:a.inversion_id, importe:Number(a.importe), fecha:a.fecha, cuentaId:a.cuenta_id, movimientoId:a.movimiento_id})); } },
  retiros_inversion: { q:()=>todas(()=>sb.from("retiros_inversion").select("*")),
    set:d=>{ retiros = d.map(r=>({id:r.id, inversionId:r.inversion_id, importe:Number(r.importe), fecha:r.fecha, cuentaId:r.cuenta_id, movimientoId:r.movimiento_id})); } },
  categorias: { q:()=>todas(()=>sb.from("categorias").select("*")),
    set:d=>{ categorias = d.map(c=>({id:c.id, tipo:c.tipo, padre:c.padre, nombre:c.nombre})); } },
  presupuestos: { q:()=>todas(()=>sb.from("presupuestos").select("*")),
    set:d=>{ presupuestos = d.map(p=>({id:p.id, categoria:p.categoria, limite:Number(p.limite), rollover:!!p.rollover, rolloverDesde:p.rollover_desde||null})); } },
  recurrentes: { q:()=>todas(()=>sb.from("recurrentes").select("*")),
    set:d=>{ recurrentes = d.map(r=>({id:r.id, tipo:r.tipo, categoria:r.categoria, importe:Number(r.importe), nota:r.nota||"", cuentaId:r.cuenta_id, diaMes:r.dia_mes, activo:r.activo, fechaInicio:r.fecha_inicio, ultimaGenerada:r.ultima_generada})); } },
  objetivos: { q:()=>todas(()=>sb.from("objetivos").select("*")),
    set:d=>{ objetivos = d.map(o=>({id:o.id, nombre:o.nombre, meta:Number(o.meta), tipoVinculo:o.tipo_vinculo, vinculoId:o.vinculo_id, orden:o.orden||0,
      autoActivo:!!o.auto_activo, autoCuota:o.auto_cuota!=null?Number(o.auto_cuota):null, autoDiaMes:o.auto_dia_mes||null, autoCuentaOrigen:o.auto_cuenta_origen||null, autoUltimaGenerada:o.auto_ultima_generada||null,
      tema:o.tema||null, ahorrado:Number(o.ahorrado||0)})).sort(porOrden); } },
  // Fechas de los hitos conseguidos. Sin schema_hitos.sql la tabla no existe y se guardan en este dispositivo.
  hitos: { q:async ()=>{ const r = await sb.from("hitos").select("clave, fecha"); return {data:{filas:r.data||[], ok:!r.error}, error:null}; }, sinRealtime:true,
    set:d=>fijarHitos(d) },
  preferencias: { q:()=>sb.from("preferencias").select("*"), opcional:true, sinRealtime:true,
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
    sincronizarHitos();
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
  const fuera = !session || recuperando;
  document.getElementById("authScreen").style.display = fuera ? "flex" : "none";
  document.getElementById("appShell").style.display = fuera ? "none" : "block";
  if(recuperando) authModo("nueva");
  if(session){
    const nombre = session.user.user_metadata?.full_name;
    document.getElementById("sesionInfo").textContent = nombre ? `Hola, ${nombre}` : session.user.email;
  }
}

// Pantalla de acceso: "login", "registro", "olvido" o "nueva" (contraseña nueva tras el enlace del correo).
const AUTH_TEXTOS = {
  login:["¡Hola de nuevo!","Entra para ver tus cuentas","fLogin"],
  registro:["Crea tu cuenta","Solo necesitas un email y una contraseña","fRegistro"],
  olvido:["¿Olvidaste tu contraseña?","Te enviamos un enlace para crear una nueva","fOlvido"],
  nueva:["Nueva contraseña","Elige la contraseña con la que entrarás a partir de ahora","fNuevaPass"]
};
function authModo(modo, msg = "", error = false){
  const [titulo, sub, form] = AUTH_TEXTOS[modo];
  document.getElementById("authTitulo").textContent = titulo;
  document.getElementById("authSub").textContent = sub;
  ["fLogin","fRegistro","fOlvido","fNuevaPass"].forEach(id=>{ document.getElementById(id).hidden = id!==form; });
  authMsg(msg, error);
  pintarPerfilesAcceso(modo);
  document.getElementById("authPie").innerHTML =
    modo==="login" ? `¿No tienes cuenta? <button type="button" class="auth-link" data-auth="registro">Regístrate</button>`
    : modo==="nueva" ? ""
    : `¿Ya tienes cuenta? <button type="button" class="auth-link" data-auth="login">Entra</button>`;
}
function authMsg(texto, error = false){
  const m = document.getElementById("loginMsg");
  m.textContent = texto;
  m.classList.toggle("error", error);
}
function traducirErrorAuth(e){
  const t = (e && e.message) || "";
  if(/invalid login credentials/i.test(t)) return "Email o contraseña incorrectos. Si antes entrabas con enlace, usa «¿Olvidaste tu contraseña?» para crear una.";
  if(/email not confirmed/i.test(t)) return "Aún no has confirmado tu email. Revisa tu correo.";
  if(/already registered|already exists/i.test(t)) return "Ese email ya tiene cuenta. Entra o recupera la contraseña.";
  if(/password should be|at least/i.test(t)) return "La contraseña es demasiado corta o débil.";
  if(/rate limit|security purposes/i.test(t)) return "Demasiados intentos. Espera un minuto y vuelve a probar.";
  return "Error: " + t;
}
const urlApp = ()=>location.origin + location.pathname;

function wireAuth(){
  document.getElementById("authScreen").addEventListener("click", e=>{
    const a = e.target.closest("[data-auth]");
    if(a){
      const email = document.querySelector("#authScreen form:not([hidden]) input[type=email]")?.value;
      authModo(a.dataset.auth);
      const destino = document.querySelector("#authScreen form:not([hidden]) input[type=email]");
      if(destino && email && !destino.value) destino.value = email;
      return;
    }
    const pf = e.target.closest("[data-perfil]");
    if(pf) return cambiarAPerfil(pf.dataset.perfil);
    const ol = e.target.closest("[data-olvidar-perfil]");
    if(ol){ quitarPerfil(ol.dataset.olvidarPerfil); return pintarPerfilesAcceso("login"); }
    const v = e.target.closest("[data-ver]");
    if(v){
      const inp = v.parentElement.querySelector("input");
      inp.type = inp.type==="password" ? "text" : "password";
      v.textContent = inp.type==="password" ? "Ver" : "Ocultar";
    }
  });
  const enviar = (id, fn)=>{
    const f = document.getElementById(id);
    f.onsubmit = e=>{ e.preventDefault(); conCarga(f.querySelector("button[type=submit]"), "Un momento…", fn); };
  };
  enviar("fLogin", async ()=>{
    authMsg("");
    const {error} = await sb.auth.signInWithPassword({
      email: document.getElementById("loginEmail").value.trim(),
      password: document.getElementById("loginPass").value
    });
    if(error) authMsg(traducirErrorAuth(error), true);
  });
  enviar("fRegistro", async ()=>{
    authMsg("");
    const email = document.getElementById("regEmail").value.trim();
    const {data, error} = await sb.auth.signUp({
      email, password: document.getElementById("regPass").value,
      options:{emailRedirectTo: urlApp(), data:{full_name: document.getElementById("regNombre").value.trim()}}
    });
    if(error) return authMsg(traducirErrorAuth(error), true);
    // Supabase no da error si el email ya existe: devuelve un usuario sin identidades.
    if(data.user && data.user.identities && !data.user.identities.length) return authMsg("Ese email ya tiene cuenta. Entra o recupera la contraseña.", true);
    if(!data.session){ authModo("login", "Te hemos enviado un correo para confirmar la cuenta. Pulsa el enlace y después entra aquí."); document.getElementById("loginEmail").value = email; }
  });
  enviar("fOlvido", async ()=>{
    authMsg("");
    const {error} = await sb.auth.resetPasswordForEmail(document.getElementById("olvEmail").value.trim(), {redirectTo: urlApp()});
    authMsg(error ? traducirErrorAuth(error) : "Si ese email tiene cuenta, te llegará un enlace. Ábrelo desde este dispositivo.", !!error);
  });
  enviar("fNuevaPass", async ()=>{
    authMsg("");
    const {error} = await sb.auth.updateUser({password: document.getElementById("nuevaPass").value});
    if(error) return authMsg(traducirErrorAuth(error), true);
    recuperando = false;
    applyAuthUI();
    if(session) startApp();
  });
  if(errorEnlace) authModo("olvido", "El enlace no es válido o ha caducado. Pide otro.", true);
  else authModo("login");
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
  Object.keys(TABLAS).filter(t=>!TABLAS[t].sinRealtime).forEach(t=>
    canal.on("postgres_changes", {event:"*", schema:"public", table:t}, ()=>refrescarTabla(t)));
  canal
    .subscribe((status)=>{
      if(status==="SUBSCRIBED"){ if(primeraSub) primeraSub = false; else refrescar(); }
    });
  document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible") refrescar(); });
  window.addEventListener("online", refrescar);
}

// ── Perfiles: varias cuentas recordadas en este dispositivo ──
// Cada perfil guarda su sesión de Supabase y sus preferencias locales. Para cambiar se escribe
// su sesión donde la lee supabase-js y se recarga (sin cerrar la de las demás en el servidor).
const PREFS_PERFIL = ["cuentaDefecto","objCompletados","catsContraidas","formsPorDefecto","personalizacion","fondoImagen","avisosVistos","accionesRapidas","hitos"];
const claveSesionSb = ()=> sb.auth.storageKey || `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
function leerPerfiles(){ try{ const a = JSON.parse(localStorage.getItem("perfiles")||"[]"); return Array.isArray(a) ? a : []; }catch(e){ return []; } }
function escribirPerfiles(l){ try{ localStorage.setItem("perfiles", JSON.stringify(l)); }catch(e){} }
function guardarPerfil(s){
  if(!s?.user?.id || !s.refresh_token) return;
  const l = leerPerfiles(), i = l.findIndex(p=>p.id===s.user.id);
  const datos = {id:s.user.id, email:s.user.email, nombre:(s.user.user_metadata?.full_name||"").trim(), sesion:s};
  if(i>=0) l[i] = {...l[i], ...datos}; else l.push(datos);
  escribirPerfiles(l);
}
function quitarPerfil(id){ escribirPerfiles(leerPerfiles().filter(p=>p.id!==id)); }
// Guarda las preferencias locales del perfil activo y deja las del siguiente (o ninguna).
function soltarPerfilActual(siguiente){
  const l = leerPerfiles(), yo = l.find(p=>p.id===session?.user?.id);
  if(yo){
    yo.prefs = {};
    PREFS_PERFIL.forEach(k=>{ try{ const v = localStorage.getItem(k); if(v!==null) yo.prefs[k] = v; }catch(e){} });
    try{ const v = JSON.parse(localStorage.getItem(claveSesionSb())); if(v?.refresh_token) yo.sesion = v; }catch(e){}
  }
  escribirPerfiles(l);
  PREFS_PERFIL.forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} });
  Object.entries(siguiente?.prefs||{}).forEach(([k,v])=>{ try{ localStorage.setItem(k, v); }catch(e){} });
}
function cambiarAPerfil(id){
  const destino = leerPerfiles().find(p=>p.id===id);
  if(!destino || id===session?.user?.id) return;
  soltarPerfilActual(destino);
  try{ localStorage.setItem(claveSesionSb(), JSON.stringify(destino.sesion)); sessionStorage.setItem("perfilDestino", id); }catch(e){}
  location.reload();
}
function anadirPerfil(){
  soltarPerfilActual(null);
  try{ localStorage.removeItem(claveSesionSb()); }catch(e){}
  location.reload();
}
function pintarPerfilesAcceso(modo){
  const cont = document.getElementById("authPerfiles");
  const l = modo==="login" ? leerPerfiles() : [];
  cont.hidden = !l.length;
  cont.innerHTML = l.length ? `<div class="perfiles-tit">Perfiles en este dispositivo</div>` + l.map(p=>`
    <div class="perfil-fila"><button type="button" class="perfil-btn" data-perfil="${esc(p.id)}">${avatarPerfil(p)}<span><b>${esc(p.nombre||p.email)}</b>${p.nombre?`<small>${esc(p.email)}</small>`:""}</span></button><button type="button" class="perfil-olvidar" data-olvidar-perfil="${esc(p.id)}" aria-label="Quitar ${esc(p.nombre||p.email)} de este dispositivo">×</button></div>`).join("")
    + `<div class="perfiles-tit">O entra con otra cuenta</div>` : "";
}
const avatarPerfil = p=>`<i class="perfil-av">${esc(((p.nombre||p.email||"?").trim()[0]||"?").toUpperCase())}</i>`;

async function init(){
  if(!SUPABASE_URL.startsWith("http")){
    document.body.innerHTML = `<div class="status">Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY en el código.</div>`;
    return;
  }
  wireAuth();
  document.getElementById("btnLogout").onclick = ()=> sb.auth.signOut();
  // Al cerrar sesión o cambiar de usuario no puede quedar nada del anterior: ni datos
  // en memoria, ni el canal realtime, ni preferencias locales.
  const cambiarDeUsuario = (salio)=>{
    if(salio) quitarPerfil(session.user.id);
    PREFS_PERFIL.forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} });
    location.reload();
  };

  const {data:{session:s}} = await sb.auth.getSession();
  session = s;
  // Si se cambió a un perfil cuya sesión ya no vale, se olvida y se pide entrar de nuevo.
  let destino = null; try{ destino = sessionStorage.getItem("perfilDestino"); sessionStorage.removeItem("perfilDestino"); }catch(e){}
  if(destino && !session){
    const p = leerPerfiles().find(x=>x.id===destino);
    quitarPerfil(destino);
    authModo("login", "La sesión de ese perfil ha caducado. Entra de nuevo.", true);
    if(p) document.getElementById("loginEmail").value = p.email;
  }
  guardarPerfil(session);
  await syncPendingName();
  applyAuthUI();
  if(session && !recuperando) startApp();

  sb.auth.onAuthStateChange(async (event, s2)=>{
    if(appStarted && session && s2?.user?.id!==session.user.id){ cambiarDeUsuario(!s2); return; }
    if(event==="PASSWORD_RECOVERY") recuperando = true;
    session = s2;
    guardarPerfil(session);
    await syncPendingName();
    applyAuthUI();
    if(session && !recuperando) startApp();
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
