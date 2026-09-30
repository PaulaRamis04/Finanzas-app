const TABS = ["Inicio","Gastos","Resumen del mes","Presupuestos","Movimientos","Cuentas","Deudas","Inversiones","Objetivos","Hitos","Proyección","Simulador","Recurrentes","Categorías","Preferencias"];

const GRUPOS_MENU = [
  {nombre:"Resumen", tabs:["Gastos","Resumen del mes","Presupuestos"]},
  {nombre:"Dinero", tabs:["Movimientos","Cuentas","Deudas","Recurrentes"]},
  {nombre:"Ahorro", tabs:["Inversiones","Objetivos","Hitos","Proyección","Simulador"]},
  {nombre:"Ajustes", tabs:["Categorías","Preferencias","Personalización","Comunidad"]}
];

let tab = "Inicio";

let ready = false;

let movimientos = [], deudas = [], cuentas = [], inversiones = [], aportaciones = [], categorias = [], retiros = [], presupuestos = [], objetivos = [];
// Carga parcial: "movimientos" solo trae desde movDesde; lo anterior llega agregado por mes en movResumen.
let movDesde = null, movResumen = [], movParcial = false;
function previoCuenta(cuentaId, hasta){
  return movResumen.reduce((s,r)=> r.cuentaId===cuentaId && r.mes<hasta ? restarDinero(sumarDinero(s, r.ingresos), r.gastos) : s, 0);
}

let editarPresupuestoId = null, editarPresDeudaId = null, meDebenMovId = null;

let editarAutoObjId = null;

let formsPorDefecto = "abiertos", formsEstado = {};
try{ formsPorDefecto = localStorage.getItem("formsPorDefecto")==="cerrados" ? "cerrados" : "abiertos"; }catch(e){}

let catsContraidas = {};
try{ catsContraidas = JSON.parse(localStorage.getItem("catsContraidas") || "{}") || {}; }catch(e){ catsContraidas = {}; }

let deudaLado = "me_deben", saldadasAbiertas = {};

let recurrentes = [];

let editarMovId = null, movAbiertoId = null, transferenciaAbierta = false, movBuscarTexto = "", movFiltroCategoria = "";

let proy = {inicial:null, aporte:0, anios:10, tasa:5, detalle:false};

let proyResultado = null;

let cuentaDefecto = "";
try{ cuentaDefecto = localStorage.getItem("cuentaDefecto") || ""; }catch(e){}

let aportarInvId = null, editarValorInvId = null, editarCatId = null, verAportacionesId = null, ajustarSaldoId = null, rescatarInvId = null;

let expandidaInvId = null, editarInfoInvId = null, resumenSel = null, resumenAhorroAbierto = false;
let gastosCatSel = null;
let verAbonosDeudaId = null;
let movPlantilla = null; // {tipo, categoria, importe, cuentaId, nota} para precargar "Añadir movimiento"

let gruposAbiertos = {}, modoOrdenInv = false, rentasInvId = null, modoOrdenCuentas = false, modoOrdenObjetivos = false;
let huchaMeterId = null, huchaTemaId = null;

let session = null, appStarted = false;

// Premium (tabla perfiles, se activa a mano en Supabase) y cuentas compartidas (tabla cuentas_miembros).
let esPremium = false;
let cuentasMiembros = [], compartirCuentaId = null;
const TABS_PREMIUM = ["Proyección"];
function miembrosDe(cuentaId){ return cuentasMiembros.filter(m=>m.cuentaId===cuentaId); }
function cuentaCompartida(c){ return !c.propia || miembrosDe(c.id).length>0; }

// --- Configura aquí tu proyecto de Supabase ---

let periodoMes = String(new Date().getMonth()+1); // "todos" o "1".."12"; por defecto el mes actual

let periodoAnio = new Date().getFullYear();

let saldarId = null; // deuda que se está saldando ahora mismo

let arrastrando = false;

function enPeriodo(fecha){
  if(!fecha) return false;
  const [y,m] = fecha.split("-");
  if(Number(y) !== periodoAnio) return false;
  return periodoMes==="todos" ? true : Number(m)===Number(periodoMes);
}

function cuentaNombre(id){ const c = cuentas.find(c=>c.id===id); return c? esc(c.nombre) : "Sin cuenta"; }

// Las archivadas siguen sumando al patrimonio, pero no se ofrecen para movimientos nuevos.
function cuentasActivas(){ return cuentas.filter(c=>!c.archivada); }
function cuentaPorDefecto(){ return cuentasActivas().some(c=>c.id===cuentaDefecto) ? cuentaDefecto : ""; }

function aportadoInv(inv){ return sumarDinero(inv.valorInicial||0, sumaImportes(aportaciones.filter(a=>a.inversionId===inv.id))); }

function retiradoInv(inv){ return sumaImportes(retiros.filter(r=>r.inversionId===inv.id)); }

function beneficioInv(inv){ return restarDinero(sumarDinero(inv.valorActual, retiradoInv(inv)), aportadoInv(inv)); }

function saldoCuenta(c){
  const ing = sumaImportes(movimientos.filter(m=>m.cuentaId===c.id && m.tipo==="ingreso"));
  const gas = sumaImportes(movimientos.filter(m=>m.cuentaId===c.id && m.tipo==="gasto"));
  return restarDinero(sumarDinero(c.saldoInicial||0, movParcial ? previoCuenta(c.id, movDesde) : 0, ing), gas);
}

function patrimonioEnFecha(corte){
  // Estimación: reconstruye el patrimonio a partir de los movimientos anteriores a "corte".
  // Las deudas ya saldadas no se pueden reconstruir con precisión (no guardamos cuándo se saldaron).
  const totalCuentas = sumaImportes(cuentas, c=>{
    if(movParcial && corte<=movDesde) return sumarDinero(c.saldoInicial, previoCuenta(c.id, corte));
    const movs = movimientos.filter(m=>m.cuentaId===c.id && m.fecha < corte);
    const ing = sumaImportes(movs.filter(m=>m.tipo==="ingreso"));
    const gas = sumaImportes(movs.filter(m=>m.tipo==="gasto"));
    return restarDinero(sumarDinero(c.saldoInicial, movParcial ? previoCuenta(c.id, movDesde) : 0, ing), gas);
  });
  const totalInv = sumaImportes(inversiones.filter(i=>i.estado==="activa"), i=>{
    const apoDesde = sumaImportes(aportaciones.filter(a=>a.inversionId===i.id && a.fecha>=corte));
    const retDesde = sumaImportes(retiros.filter(r=>r.inversionId===i.id && r.fecha>=corte));
    return sumarDinero(restarDinero(i.valorActual, apoDesde), retDesde);
  });
  const meDeben = sumaImportes(deudas.filter(d=>d.direccion==="me_deben" && d.estado==="pendiente" && d.fecha<corte));
  const debo = sumaImportes(deudas.filter(d=>d.direccion==="debo" && d.estado==="pendiente" && d.fecha<corte));
  return restarDinero(sumarDinero(totalCuentas, totalInv, meDeben), debo);
}

function inicioPeriodoSeleccionado(){
  if(periodoMes==="todos") return `${periodoAnio}-01-01`;
  return `${periodoAnio}-${String(periodoMes).padStart(2,"0")}-01`;
}

function esPeriodoActualReal(){
  const hoy = new Date();
  if(periodoMes==="todos") return periodoAnio===hoy.getFullYear();
  return Number(periodoMes)===hoy.getMonth()+1 && periodoAnio===hoy.getFullYear();
}

function finPeriodoCorte(){
  if(periodoMes==="todos") return `${periodoAnio+1}-01-01`;
  let m = Number(periodoMes)+1, y = periodoAnio;
  if(m>12){ m=1; y++; }
  return `${y}-${String(m).padStart(2,"0")}-01`;
}

function patrimonioActual(){
  return sumarDinero(sumaImportes(cuentas, saldoCuenta), sumaImportes(inversiones.filter(i=>i.estado==="activa"), i=>i.valorActual));
}
function patrimonioNetoActual(){
  const meDeben = sumaImportes(deudas.filter(d=>d.direccion==="me_deben" && d.estado==="pendiente"));
  const debo = sumaImportes(deudas.filter(d=>d.direccion==="debo" && d.estado==="pendiente"));
  return restarDinero(sumarDinero(patrimonioActual(), meDeben), debo);
}
let patrimonioRango = "6m"; // "max" | "1a" | "6m" | "1m" | "1d"
function serieMensual(mesesAtras){
  const hoy = new Date();
  const meses = Array.from({length:mesesAtras},(_,i)=> new Date(hoy.getFullYear(), hoy.getMonth()-(mesesAtras-1-i), 1));
  const valores = meses.map((d,i)=>{
    if(i===meses.length-1) return patrimonioNetoActual();
    const sig = new Date(d.getFullYear(), d.getMonth()+1, 1);
    return patrimonioEnFecha(fechaLocal(sig));
  });
  const etiquetas = meses.map(d=>MESES[d.getMonth()].slice(0,3));
  return {valores, etiquetas};
}
function serieDiaria(diasAtras){
  const hoy = new Date();
  const dias = Array.from({length:diasAtras},(_,i)=>{ const d=new Date(hoy); d.setDate(d.getDate()-(diasAtras-1-i)); return d; });
  const valores = dias.map((d,i)=>{
    if(i===dias.length-1) return patrimonioNetoActual();
    const sig = new Date(d); sig.setDate(sig.getDate()+1);
    return patrimonioEnFecha(fechaLocal(sig));
  });
  const etiquetas = diasAtras<=2 ? dias.map((d,i)=> i===dias.length-1 ? "Hoy" : "Ayer") : dias.map(d=>`${d.getDate()}/${d.getMonth()+1}`);
  return {valores, etiquetas};
}
function rangoMaximoPatrimonio(){
  const minCargado = movimientos.length ? movimientos.reduce((a,m)=> m.fecha<a? m.fecha : a, movimientos[0].fecha) : null;
  const minRes = movResumen.reduce((a,r)=> !a || r.mes<a ? r.mes : a, null);
  const minFecha = minRes && (!minCargado || minRes.slice(0,7)<minCargado.slice(0,7)) ? minRes : minCargado;
  if(!minFecha) return {valores:[patrimonioNetoActual()], etiquetas:["Hoy"]};
  const hoy = new Date();
  const [y0,m0] = minFecha.split("-").map(Number);
  const mesesTotal = (hoy.getFullYear()-y0)*12 + (hoy.getMonth()+1-m0) + 1;
  if(mesesTotal<=1){
    const diasSpan = Math.max(1, diasEntre(minFecha, today())+1);
    return serieDiaria(diasSpan);
  }
  return serieMensual(mesesTotal);
}
function serieRango(rango){
  if(rango==="max") return rangoMaximoPatrimonio();
  if(rango==="1a") return serieMensual(12);
  if(rango==="1m") return serieDiaria(30);
  if(rango==="1d") return serieDiaria(2);
  return serieMensual(6);
}

function calcularProyeccion(){
  const base = proy.tasa;
  const cons = Math.max(base-2, 0);
  const opt = base+2;
  const anios = proy.anios;
  proyResultado = {
    anios,
    escenarios: [
      {nombre:"Conservador", tasa:cons, color:"#8a6d3b", data:proyectarSerie(proy.inicial, proy.aporte, cons, anios)},
      {nombre:"Moderado", tasa:base, color:"var(--accent)", data:proyectarSerie(proy.inicial, proy.aporte, base, anios)},
      {nombre:"Optimista", tasa:opt, color:"var(--pos)", data:proyectarSerie(proy.inicial, proy.aporte, opt, anios)}
    ]
  };
}

function desglosePorCategoria(lista){
  const map = {};
  lista.forEach(m=>{ map[m.categoria] = sumarDinero(map[m.categoria]||0, m.importe); });
  const total = sumaImportes(lista);
  return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([categoria,tot],i)=>({
    categoria, total:tot, color: PALETTE[i%PALETTE.length], pct: total? (tot/total*100) : 0
  }));
}

function objetivoCompletado(o){ return o.meta>0 && progresoObjetivo(o)>=o.meta; }

function detectarObjetivosCompletados(){
  let previos = null;
  try{ const raw = localStorage.getItem("objCompletados"); if(raw!==null) previos = JSON.parse(raw); }catch(e){ previos = null; }
  const actuales = objetivos.filter(objetivoCompletado).map(o=>o.id);
  try{ localStorage.setItem("objCompletados", JSON.stringify(actuales)); }catch(e){}
  if(!Array.isArray(previos)) return;
  const nuevos = objetivos.filter(o=>objetivoCompletado(o) && !previos.includes(o.id));
  if(nuevos.length) lanzarConfeti(nuevos.map(o=>esc(o.nombre)).join(", "));
}

function progresoObjetivo(o){
  if(o.tipoVinculo==="cuenta"){ const c=cuentas.find(x=>x.id===o.vinculoId); return c? saldoCuenta(c) : 0; }
  if(o.tipoVinculo==="inversion"){ const i=inversiones.find(x=>x.id===o.vinculoId); return i? (i.esGrupo? valorGrupo(i) : i.valorActual) : 0; }
  return o.ahorrado||0;
}

function nombreVinculo(o){
  if(o.tipoVinculo==="cuenta") return cuentaNombre(o.vinculoId);
  if(o.tipoVinculo==="inversion"){ const i=inversiones.find(x=>x.id===o.vinculoId); return i? esc(i.nombre) : "—"; }
  return "";
}

function etiquetaGasto(id){ const m = movimientos.find(x=>x.id===id); return m ? esc(m.nota||m.categoria) : ""; }

function cubiertoPorMovimiento(){
  const c = {};
  movimientos.filter(m=>m.reembolsoDe && m.tipo==="ingreso")
    .forEach(m=>{ c[m.reembolsoDe] = sumarDinero(c[m.reembolsoDe]||0, m.importe); });
  return c;
}
// Lo que te deben todavía de cada gasto (solo informativo)

function pendientePorMovimiento(){
  const c = {};
  deudas.filter(d=>d.estado==="pendiente" && d.movimientoId && d.direccion==="me_deben")
    .forEach(d=>{ c[d.movimientoId] = sumarDinero(c[d.movimientoId]||0, d.importe); });
  return c;
}
// Movimientos del periodo tal y como cuentan para TU gasto/ingreso: sin ajustes, sin
// reembolsos, y con los gastos rebajados por la parte que te deben o te han devuelto.

function movimientosEfectivos(dentro = enPeriodo){
  const cub = cubiertoPorMovimiento();
  const out = [];
  movimientos.forEach(m=>{
    if(!dentro(m.fecha) || m.categoria==="Ajuste" || m.categoria==="Transferencia" || m.reembolsoDe) return;
    if(m.tipo==="gasto" && cub[m.id]){
      const cubierto = Math.min(m.importe, cub[m.id]);
      out.push({...m, importe: restarDinero(m.importe, cubierto), importeOriginal: m.importe, cubierto});
    } else out.push(m);
  });
  return out;
}

// Mes anterior al seleccionado, solo si sus movimientos están cargados (si no, null).
function mesAnteriorCargado(){
  if(periodoMes==="todos") return null;
  let y = periodoAnio, m = Number(periodoMes)-1;
  if(m<1){ m = 12; y--; }
  const desde = `${y}-${String(m).padStart(2,"0")}-01`;
  if(movParcial && desde<movDesde) return null;
  const hasta = inicioPeriodoSeleccionado();
  return {y, m, dentro: f=>!!f && f>=desde && f<hasta};
}

function totalesEfectivos(lista){
  return {
    ingresos: sumaImportes(lista.filter(m=>m.tipo==="ingreso")),
    gastos: sumaImportes(lista.filter(m=>m.tipo==="gasto" && m.categoria!=="Inversión"))
  };
}

// Presupuestos del mes seleccionado que han llegado al umbral (% del límite con remanente).
function presupuestosEnAlerta(umbral = 80){
  if(periodoMes==="todos") return [];
  const gastoPorCat = {};
  movimientosEfectivos().forEach(m=>{
    if(m.tipo==="gasto" && m.categoria!=="Inversión") gastoPorCat[m.categoria] = sumarDinero(gastoPorCat[m.categoria]||0, m.importe);
  });
  return presupuestos.map(p=>{
    const limite = sumarDinero(p.limite, rolloverAcumulado(p));
    const gastado = gastoPorCat[p.categoria] || 0;
    return {categoria:p.categoria, limite, gastado, pct: limite>0 ? gastado/limite*100 : (gastado>0 ? Infinity : 0)};
  }).filter(x=>x.pct>=umbral).sort((a,b)=>b.pct-a.pct);
}

function proximaFechaRecurrente(r){
  let y, m;
  if(r.ultimaGenerada){ const [yy,mm] = r.ultimaGenerada.split("-").map(Number); y = yy; m = mm+1; if(m>12){ m=1; y++; } }
  else { const [yy,mm] = r.fechaInicio.split("-").map(Number); y = yy; m = mm; }
  const diasEnMes = new Date(y, m, 0).getDate();
  const dia = Math.min(r.diaMes, diasEnMes);
  return `${y}-${String(m).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
}

function gastoCategoriaEnMes(categoria, y, m){
  const desde = `${y}-${String(m).padStart(2,"0")}-01`;
  let yn=y, mn=m+1; if(mn>12){ mn=1; yn=y+1; }
  const hasta = `${yn}-${String(mn).padStart(2,"0")}-01`;
  const cub = cubiertoPorMovimiento();
  let total = 0;
  movimientos.forEach(mv=>{
    if(mv.categoria!==categoria || mv.tipo!=="gasto" || mv.fecha<desde || mv.fecha>=hasta) return;
    const cubierto = cub[mv.id] || 0;
    total = sumarDinero(total, Math.max(0, restarDinero(mv.importe, cubierto)));
  });
  return total;
}

function rolloverAcumulado(p){
  if(!p.rollover || !p.rolloverDesde || periodoMes==="todos") return 0;
  const hastaMes = `${periodoAnio}-${String(periodoMes).padStart(2,"0")}-01`;
  const meses = mesesEntre(p.rolloverDesde, hastaMes);
  let acumulado = 0;
  meses.forEach(ym=>{
    const [y,m] = ym.split("-").map(Number);
    acumulado = sumarDinero(acumulado, restarDinero(p.limite, gastoCategoriaEnMes(p.categoria, y, m)));
  });
  return acumulado;
}

function movimientoProtegido(id){
  return aportaciones.some(a=>a.movimientoId===id) || retiros.some(r=>r.movimientoId===id) || !!(movimientos.find(m=>m.id===id)||{}).transferenciaId;
}

function movimientosFiltrados(){
  const texto = movBuscarTexto.trim().toLowerCase();
  return movimientos.filter(m=>enPeriodo(m.fecha))
    .filter(m=> !movFiltroCategoria || m.categoria===movFiltroCategoria)
    .filter(m=> !texto || (m.nota||"").toLowerCase().includes(texto) || (m.categoria||"").toLowerCase().includes(texto))
    .sort((a,b)=>b.fecha.localeCompare(a.fecha));
}

function siguienteOrdenLista(l){ return Math.max(0, ...l.map(x=>x.orden||0)) + 1; }

function porOrden(a,b){ return ((a.orden||0)-(b.orden||0)) || a.nombre.localeCompare(b.nombre); }

function grupos(){ return inversiones.filter(i=>i.esGrupo).sort(porOrden); }

function hijosDe(g){ return inversiones.filter(i=>i.padreId===g.id && !i.esGrupo).sort(porOrden); }

function valorGrupo(g){ return sumaImportes(hijosDe(g).filter(h=>h.estado==="activa"), h=>h.valorActual); }

function beneficioGrupo(g){ return sumaImportes(hijosDe(g).filter(h=>h.estado==="activa"), beneficioInv); }

function rentasGrupo(g){ return sumaImportes(hijosDe(g), h=>h.rentas||0); }

function siguienteOrden(){ return Math.max(0, ...inversiones.map(i=>i.orden||0)) + 1; }

function sliceInversiones(){
  const items = [];
  inversiones.filter(i=>!i.padreId && i.esGrupo).forEach(g=>{
    const v = valorGrupo(g);
    if(v>0) items.push({nombre:g.nombre, total:v, hijos:hijosDe(g).filter(h=>h.estado==="activa" && h.valorActual>0).map(h=>({nombre:h.nombre, total:h.valorActual}))});
  });
  inversiones.filter(i=>!i.padreId && !i.esGrupo && i.estado==="activa" && i.valorActual>0).forEach(i=>items.push({nombre:i.nombre, total:i.valorActual, hijos:[]}));
  const totalGlobal = sumaImportes(items, x=>x.total);
  return items.sort((a,b)=>b.total-a.total).map((x,k)=>({...x, color:PALETTE[k%PALETTE.length], pct: totalGlobal? x.total/totalGlobal*100 : 0, totalGlobal}));
}

let refrescoSilencioso = false;
