const TABS = ["Inicio","Gastos","Resumen del mes","Presupuestos","Movimientos","Cuentas","Deudas","Importar","Inversiones","Objetivos","Proyección","Recurrentes","Categorías","Preferencias"];

const GRUPOS_MENU = [
  {nombre:"Resumen", tabs:["Gastos","Resumen del mes","Presupuestos"]},
  {nombre:"Movimientos", tabs:["Movimientos","Cuentas","Deudas","Importar","Recurrentes"]},
  {nombre:"Ahorro", tabs:["Inversiones","Objetivos","Proyección"]},
  {nombre:"Ajustes", tabs:["Categorías","Preferencias"]}
];

let tab = "Inicio";

let ready = false;

let movimientos = [], deudas = [], cuentas = [], inversiones = [], aportaciones = [], categorias = [], retiros = [], presupuestos = [], objetivos = [];

let editarPresupuestoId = null, editarPresDeudaId = null, meDebenMovId = null;

let editarAutoObjId = null;

let formsPorDefecto = "abiertos", formsEstado = {};
try{ formsPorDefecto = localStorage.getItem("formsPorDefecto")==="cerrados" ? "cerrados" : "abiertos"; }catch(e){}

let catsContraidas = {};
try{ catsContraidas = JSON.parse(localStorage.getItem("catsContraidas") || "{}") || {}; }catch(e){ catsContraidas = {}; }

let deudaLado = "me_deben", saldadasAbiertas = {};

let recurrentes = [];

let editarMovId = null, transferenciaAbierta = false, movBuscarTexto = "", movFiltroCategoria = "";

let proy = {inicial:null, aporte:0, anios:10, tasa:5, detalle:false};

let proyResultado = null;

let cuentaDefecto = "";
try{ cuentaDefecto = localStorage.getItem("cuentaDefecto") || ""; }catch(e){}

let csvHeaders = [], csvFilas = [], csvPreview = [], csvSel = {}, csvPreviewCuentaId = "";

let csvDecisiones = {};

let pendientes = [], pendCats = {};

let aportarInvId = null, editarValorInvId = null, editarCatId = null, verAportacionesId = null, ajustarSaldoId = null, rescatarInvId = null;

let expandidaInvId = null, editarInfoInvId = null, resumenSel = null, resumenAhorroAbierto = false;
let gastosCatSel = null;
let verAbonosDeudaId = null;
let movPlantilla = null; // {tipo, categoria, importe, cuentaId, nota} para precargar "Añadir movimiento"

let gruposAbiertos = {}, modoOrdenInv = false, rentasInvId = null, modoOrdenCuentas = false, modoOrdenObjetivos = false;

let session = null, appStarted = false;

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

function cuentaPorDefecto(){ return cuentas.some(c=>c.id===cuentaDefecto) ? cuentaDefecto : ""; }

function aportadoInv(inv){ return (inv.valorInicial||0) + aportaciones.filter(a=>a.inversionId===inv.id).reduce((s,a)=>s+a.importe,0); }

function retiradoInv(inv){ return retiros.filter(r=>r.inversionId===inv.id).reduce((s,r)=>s+r.importe,0); }

function beneficioInv(inv){ return (inv.valorActual + retiradoInv(inv)) - aportadoInv(inv); }

function saldoCuenta(c){
  const ing = movimientos.filter(m=>m.cuentaId===c.id && m.tipo==="ingreso").reduce((s,m)=>s+m.importe,0);
  const gas = movimientos.filter(m=>m.cuentaId===c.id && m.tipo==="gasto").reduce((s,m)=>s+m.importe,0);
  return (c.saldoInicial||0) + ing - gas;
}

function patrimonioEnFecha(corte){
  // Estimación: reconstruye el patrimonio a partir de los movimientos anteriores a "corte".
  // Las deudas ya saldadas no se pueden reconstruir con precisión (no guardamos cuándo se saldaron).
  const totalCuentas = cuentas.reduce((s,c)=>{
    const movs = movimientos.filter(m=>m.cuentaId===c.id && m.fecha < corte);
    const ing = movs.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.importe,0);
    const gas = movs.filter(m=>m.tipo==="gasto").reduce((a,m)=>a+m.importe,0);
    return s + c.saldoInicial + ing - gas;
  },0);
  const totalInv = inversiones.filter(i=>i.estado==="activa").reduce((s,i)=>{
    const apoDesde = aportaciones.filter(a=>a.inversionId===i.id && a.fecha>=corte).reduce((a,x)=>a+x.importe,0);
    const retDesde = retiros.filter(r=>r.inversionId===i.id && r.fecha>=corte).reduce((a,x)=>a+x.importe,0);
    return s + i.valorActual - apoDesde + retDesde;
  },0);
  const meDeben = deudas.filter(d=>d.direccion==="me_deben" && d.estado==="pendiente" && d.fecha<corte).reduce((s,d)=>s+d.importe,0);
  const debo = deudas.filter(d=>d.direccion==="debo" && d.estado==="pendiente" && d.fecha<corte).reduce((s,d)=>s+d.importe,0);
  return totalCuentas + totalInv + meDeben - debo;
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
  return cuentas.reduce((s,c)=>s+saldoCuenta(c),0) + inversiones.filter(i=>i.estado==="activa").reduce((s,i)=>s+i.valorActual,0);
}
function patrimonioNetoActual(){
  const meDeben = deudas.filter(d=>d.direccion==="me_deben" && d.estado==="pendiente").reduce((s,d)=>s+d.importe,0);
  const debo = deudas.filter(d=>d.direccion==="debo" && d.estado==="pendiente").reduce((s,d)=>s+d.importe,0);
  return patrimonioActual() + meDeben - debo;
}
let patrimonioRango = "6m"; // "max" | "1a" | "6m" | "1m" | "1d"
function serieMensual(mesesAtras){
  const hoy = new Date();
  const meses = Array.from({length:mesesAtras},(_,i)=> new Date(hoy.getFullYear(), hoy.getMonth()-(mesesAtras-1-i), 1));
  const valores = meses.map((d,i)=>{
    if(i===meses.length-1) return patrimonioNetoActual();
    const sig = new Date(d.getFullYear(), d.getMonth()+1, 1);
    const corte = `${sig.getFullYear()}-${String(sig.getMonth()+1).padStart(2,"0")}-01`;
    return patrimonioEnFecha(corte);
  });
  const etiquetas = meses.map(d=>MESES[d.getMonth()].slice(0,3));
  return {valores, etiquetas};
}
function serieDiaria(diasAtras){
  const hoy = new Date();
  const dias = Array.from({length:diasAtras},(_,i)=>{ const d=new Date(hoy); d.setDate(d.getDate()-(diasAtras-1-i)); return d; });
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const valores = dias.map((d,i)=>{
    if(i===dias.length-1) return patrimonioNetoActual();
    const sig = new Date(d); sig.setDate(sig.getDate()+1);
    return patrimonioEnFecha(fmt(sig));
  });
  const etiquetas = diasAtras<=2 ? dias.map((d,i)=> i===dias.length-1 ? "Hoy" : "Ayer") : dias.map(d=>`${d.getDate()}/${d.getMonth()+1}`);
  return {valores, etiquetas};
}
function rangoMaximoPatrimonio(){
  if(!movimientos.length) return {valores:[patrimonioNetoActual()], etiquetas:["Hoy"]};
  const minFecha = movimientos.reduce((a,m)=> m.fecha<a? m.fecha : a, movimientos[0].fecha);
  const hoy = new Date();
  const [y0,m0] = minFecha.split("-").map(Number);
  const mesesTotal = (hoy.getFullYear()-y0)*12 + (hoy.getMonth()+1-m0) + 1;
  if(mesesTotal<=1){
    const dMin = new Date(minFecha+"T00:00:00");
    const diasSpan = Math.max(1, Math.round((hoy-dMin)/86400000)+1);
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
  lista.forEach(m=>{ map[m.categoria] = (map[m.categoria]||0) + m.importe; });
  const total = lista.reduce((s,m)=>s+m.importe,0);
  return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([categoria,tot],i)=>({
    categoria, total:tot, color: PALETTE[i%PALETTE.length], pct: total? (tot/total*100) : 0
  }));
}

function sugerirCategoria(desc, tipo){
  if(!desc) return "";
  const d = desc.trim().toLowerCase();
  const m = movimientos.find(x=>x.tipo===tipo && (x.nota||"").trim().toLowerCase()===d
    && !["Inversión","Ajuste","Deuda"].includes(x.categoria)
    && categorias.some(c=>c.tipo===tipo && c.nombre===x.categoria));
  return m ? m.categoria : "";
}

function calcularPreview(){
  const iFecha = csvHeaders.indexOf(csvSel.fecha);
  const iImporte = csvHeaders.indexOf(csvSel.importe);
  const iNota = csvSel.nota ? csvHeaders.indexOf(csvSel.nota) : -1;
  const iSaldo = csvSel.saldo ? csvHeaders.indexOf(csvSel.saldo) : -1;
  const cuentaId = csvSel.cuenta;
  const cntP = new Map();
  const add = (mp,k)=>mp.set(k,(mp.get(k)||0)+1);
  pendientes.filter(p=>p.cuentaId===cuentaId).forEach(p=>add(cntP, `${p.fecha}|${p.tipo}|${p.importe.toFixed(2)}|${p.descripcion}|${p.saldo!=null?p.saldo.toFixed(2):""}`));
  const VENTANA_DIAS = 3;
  const movsCuenta = movimientos.filter(m=>m.cuentaId===cuentaId);
  const usados = new Set(); // ids de movimientos ya emparejados con otra línea del banco
  csvDecisiones = {};
  csvPreview = csvFilas.map((fila,idx)=>{
    const imp = parseImporteCSV(fila[iImporte]);
    if(isNaN(imp) || imp===0) return null;
    const saldoRaw = iSaldo>=0 ? parseImporteCSV(fila[iSaldo]) : NaN;
    const r = {
      fecha: parseFechaCSV(fila[iFecha]) || "", importe: Math.round(Math.abs(imp)*100)/100,
      tipo: imp<0 ? "gasto" : "ingreso", nota: iNota>=0 ? (fila[iNota]||"") : "",
      saldo: isNaN(saldoRaw) ? null : saldoRaw, posicion: idx,
      dup:false, invalida:false, matchId:null
    };
    r.invalida = !/^\d{4}-\d{2}-\d{2}$/.test(r.fecha);
    if(r.invalida) return r;
    const kP = `${r.fecha}|${r.tipo}|${r.importe.toFixed(2)}|${r.nota}|${r.saldo!=null?r.saldo.toFixed(2):""}`;
    if((cntP.get(kP)||0)>0){ cntP.set(kP, cntP.get(kP)-1); r.dup = true; return r; }
    // Conciliación: busca un movimiento ya apuntado con el mismo importe y tipo,
    // en una fecha cercana (no hace falta que la descripción coincida).
    let mejor = null, mejorDif = Infinity;
    movsCuenta.forEach(m=>{
      if(usados.has(m.id) || m.tipo!==r.tipo || Math.abs(m.importe-r.importe)>0.005) return;
      const dif = Math.abs((new Date(m.fecha) - new Date(r.fecha)) / 86400000);
      if(dif<=VENTANA_DIAS && dif<mejorDif){ mejor = m; mejorDif = dif; }
    });
    if(mejor){ r.matchId = mejor.id; usados.add(mejor.id); csvDecisiones[idx] = "igual"; }
    return r;
  }).filter(Boolean);
  csvPreviewCuentaId = cuentaId;
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
  return 0;
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
    .forEach(m=>{ c[m.reembolsoDe] = (c[m.reembolsoDe]||0) + m.importe; });
  return c;
}
// Lo que te deben todavía de cada gasto (solo informativo)

function pendientePorMovimiento(){
  const c = {};
  deudas.filter(d=>d.estado==="pendiente" && d.movimientoId && d.direccion==="me_deben")
    .forEach(d=>{ c[d.movimientoId] = (c[d.movimientoId]||0) + d.importe; });
  return c;
}
// Movimientos del periodo tal y como cuentan para TU gasto/ingreso: sin ajustes, sin
// reembolsos, y con los gastos rebajados por la parte que te deben o te han devuelto.

function movimientosEfectivos(){
  const cub = cubiertoPorMovimiento();
  const out = [];
  movimientos.forEach(m=>{
    if(!enPeriodo(m.fecha) || m.categoria==="Ajuste" || m.categoria==="Transferencia" || m.reembolsoDe) return;
    if(m.tipo==="gasto" && cub[m.id]){
      const cubierto = Math.min(m.importe, cub[m.id]);
      out.push({...m, importe: Math.round((m.importe-cubierto)*100)/100, importeOriginal: m.importe, cubierto});
    } else out.push(m);
  });
  return out;
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
    total += Math.max(0, mv.importe - cubierto);
  });
  return Math.round(total*100)/100;
}

function rolloverAcumulado(p){
  if(!p.rollover || !p.rolloverDesde || periodoMes==="todos") return 0;
  const hastaMes = `${periodoAnio}-${String(periodoMes).padStart(2,"0")}-01`;
  const meses = mesesEntre(p.rolloverDesde, hastaMes);
  let acumulado = 0;
  meses.forEach(ym=>{
    const [y,m] = ym.split("-").map(Number);
    acumulado += p.limite - gastoCategoriaEnMes(p.categoria, y, m);
  });
  return Math.round(acumulado*100)/100;
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

function valorGrupo(g){ return hijosDe(g).filter(h=>h.estado==="activa").reduce((s,h)=>s+h.valorActual,0); }

function beneficioGrupo(g){ return hijosDe(g).filter(h=>h.estado==="activa").reduce((s,h)=>s+beneficioInv(h),0); }

function rentasGrupo(g){ return hijosDe(g).reduce((s,h)=>s+(h.rentas||0),0); }

function siguienteOrden(){ return Math.max(0, ...inversiones.map(i=>i.orden||0)) + 1; }

function sliceInversiones(){
  const items = [];
  inversiones.filter(i=>!i.padreId && i.esGrupo).forEach(g=>{
    const v = valorGrupo(g);
    if(v>0) items.push({nombre:g.nombre, total:v, hijos:hijosDe(g).filter(h=>h.estado==="activa" && h.valorActual>0).map(h=>({nombre:h.nombre, total:h.valorActual}))});
  });
  inversiones.filter(i=>!i.padreId && !i.esGrupo && i.estado==="activa" && i.valorActual>0).forEach(i=>items.push({nombre:i.nombre, total:i.valorActual, hijos:[]}));
  const totalGlobal = items.reduce((s,x)=>s+x.total,0);
  return items.sort((a,b)=>b.total-a.total).map((x,k)=>({...x, color:PALETTE[k%PALETTE.length], pct: totalGlobal? x.total/totalGlobal*100 : 0, totalGlobal}));
}

let refrescoSilencioso = false;
