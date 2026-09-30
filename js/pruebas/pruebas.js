// Pruebas de la app en un navegador real contra un Supabase simulado (supabase_simulado.js).
// Uso, desde la carpeta del proyecto:  npm install  y después  npm test
const { chromium } = require("playwright");
const fs = require("fs");
const os = require("os");
const path = require("path");
const assert = require("assert");

const RAIZ = path.join(__dirname, "..");
const HTML_PRUEBA = path.join(RAIZ, "index.pruebas.html");
const PESTANAS = ["Inicio","Gastos","Resumen del mes","Presupuestos","Movimientos","Cuentas","Deudas","Importar","Inversiones","Objetivos","Proyección","Recurrentes","Categorías","Preferencias"];

const pruebas = [];
const prueba = (nombre, fn)=>pruebas.push({nombre, fn});

// ── Funciones puras (sin navegador) ──
function cargarHelpers(){
  const ctx = {};
  new Function("ctx", fs.readFileSync(path.join(RAIZ, "js/helpers.js"), "utf8") + "\nctx.h = {parseImporteCSV, sumaImportes, sumarDinero, restarDinero, parseFechaCSV, diasEntre};")(ctx);
  return ctx.h;
}
prueba("importes del CSV en formatos español, inglés y bancario", ()=>{
  const {parseImporteCSV} = cargarHelpers();
  const casos = {"1.234,56":1234.56, "1,234.56":1234.56, "1.234":1234, "-12,50":-12.5, "12,50-":-12.5, "(12,50)":-12.5,
    "+12,50 €":12.5, "0.123":0.123, "12.5":12.5, "-1.234.567,89":-1234567.89, "1,234,567":1234567, "45":45, "45,5":45.5,
    "-0,99":-0.99, "1 234,56 €":1234.56, "12,34 EUR":12.34};
  for(const [txt, esperado] of Object.entries(casos)) assert.strictEqual(parseImporteCSV(txt), esperado, txt);
  assert.ok(isNaN(parseImporteCSV("abc")) && isNaN(parseImporteCSV("")));
});
prueba("las sumas de dinero no arrastran decimales", ()=>{
  const {sumaImportes, sumarDinero, restarDinero} = cargarHelpers();
  assert.strictEqual(sumarDinero(0.1, 0.2), 0.3);
  assert.strictEqual(restarDinero(0.3, 0.1), 0.2);
  assert.strictEqual(sumaImportes(Array(10).fill({importe:0.1})), 1);
});

// ── En el navegador ──
let navegador, errores = [];
async function abrir(qs = ""){
  const p = await navegador.newPage();
  p.on("pageerror", e=>errores.push(e.message));
  p.on("dialog", d=>d.accept());
  await p.goto("file://" + HTML_PRUEBA + qs);
  await p.waitForFunction(()=>typeof ready!=="undefined" && ready);
  return p;
}
// Saldo esperado calculado aparte, directamente sobre los datos simulados.
const saldosEsperados = p=>p.evaluate(()=>Object.fromEntries(__db.cuentas.map(c=>[c.nombre, sumarDinero(c.saldo_inicial,
  sumaImportes(__db.movimientos.filter(m=>m.cuenta_id===c.id && m.tipo==="ingreso")),
  -sumaImportes(__db.movimientos.filter(m=>m.cuenta_id===c.id && m.tipo==="gasto")))])));
const saldosApp = p=>p.evaluate(()=>Object.fromEntries(cuentas.map(c=>[c.nombre, saldoCuenta(c)])));
const textoError = p=>p.evaluate(()=>document.getElementById("errBar").classList.contains("show") ? document.getElementById("errMsg").textContent : "");
async function descargarCopia(p){
  await p.evaluate(()=>{ tab = "Preferencias"; render(); });
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#btnExportar")]);
  const ruta = path.join(os.tmpdir(), "copia-prueba.json");
  fs.copyFileSync(await dl.path(), ruta);
  return ruta;
}
async function restaurar(p, ruta){
  await p.evaluate(()=>{ tab = "Preferencias"; render(); });
  const [fc] = await Promise.all([p.waitForEvent("filechooser"), p.click("#btnRestaurar")]);
  await fc.setFiles(ruta);
  await p.waitForFunction(()=>!document.getElementById("btnRestaurar") || !document.getElementById("btnRestaurar").disabled, null, {timeout:30000});
  await p.waitForTimeout(200);
}

prueba("carga más de 1000 movimientos y los saldos cuadran", async ()=>{
  const p = await abrir();
  assert.ok(await p.evaluate(()=>__db.movimientos.length) > 2000);
  assert.deepStrictEqual(await saldosApp(p), await saldosEsperados(p));
});
prueba("sin la RPC de resumen también carga todo", async ()=>{
  const p = await abrir("?resumen=0");
  assert.strictEqual(await p.evaluate(()=>movimientos.length), await p.evaluate(()=>__db.movimientos.length));
  assert.deepStrictEqual(await saldosApp(p), await saldosEsperados(p));
});
prueba("todas las pestañas se pintan", async ()=>{
  const p = await abrir();
  for(const t of PESTANAS){
    await p.evaluate(t=>{ tab = t; render(); }, t);
    assert.ok((await p.evaluate(()=>document.getElementById("app").innerText)).trim().length > 0, t);
  }
});
prueba("Inicio avisa de presupuestos al 80 % y compara con el mes anterior", async ()=>{
  const p = await abrir();
  const txt = await p.evaluate(()=>document.getElementById("app").innerText);
  assert.match(txt, /Presupuestos al límite/);
  assert.match(txt, /vs [a-z]+/);
});
prueba("renombrar una categoría actualiza movimientos, presupuestos y recurrentes", async ()=>{
  const p = await abrir();
  await p.evaluate(()=>{ tab = "Categorías"; editarCatId = "k1"; render(); });
  await p.fill("#catNuevoNombre", "Super");
  await p.click('[data-confirmar-cat="k1"]');
  await p.waitForFunction(()=>categorias.some(c=>c.nombre==="Super"));
  const r = await p.evaluate(()=>({viejos: __db.movimientos.filter(m=>m.categoria==="Comida").length,
    pres: __db.presupuestos.map(x=>x.categoria), rec: __db.recurrentes.map(x=>x.categoria)}));
  assert.deepStrictEqual(r, {viejos:0, pres:["Super","Ocio"], rec:["Super"]});
  await p.evaluate(()=>{ editarCatId = "k2"; render(); });
  await p.fill("#catNuevoNombre", "Ajuste");
  await p.click('[data-confirmar-cat="k2"]');
  await p.waitForTimeout(200);
  assert.match(await textoError(p), /reservado/);
});
prueba("archivar una cuenta la quita de los selects pero no del patrimonio", async ()=>{
  const p = await abrir();
  const patrimonio = await p.evaluate(()=>patrimonioActual());
  await p.evaluate(()=>{ tab = "Cuentas"; render(); });
  assert.strictEqual(await p.$('[data-del-cuenta="c2"]'), null, "una cuenta con movimientos no se puede borrar");
  await p.click('[data-archivar-cuenta="c2"]');
  await p.waitForFunction(()=>cuentas.find(c=>c.id==="c2").archivada);
  assert.ok(!(await p.evaluate(()=>opcionesCuentas())).includes('value="c2"'));
  assert.strictEqual(await p.evaluate(()=>patrimonioActual()), patrimonio);
  await p.click('[data-desarchivar-cuenta="c2"]');
  await p.waitForFunction(()=>!cuentas.find(c=>c.id==="c2").archivada);
});
prueba("la copia exporta todos los movimientos y se restaura igual", async ()=>{
  const a = await abrir();
  const ruta = await descargarCopia(a);
  assert.strictEqual(JSON.parse(fs.readFileSync(ruta, "utf8")).movimientos.length, await a.evaluate(()=>__db.movimientos.length));
  const v = await abrir("?vacia=1");
  await restaurar(v, ruta);
  assert.strictEqual(await textoError(v), "");
  assert.deepStrictEqual(await saldosApp(v), await saldosApp(a));
  assert.strictEqual(await v.evaluate(()=>patrimonioNetoActual()), await a.evaluate(()=>patrimonioNetoActual()));
  const vinculos = p=>p.evaluate(()=>({deudas:__db.deudas.map(d=>d.movimiento_id), reemb:__db.movimientos.filter(m=>m.reembolso_de).map(m=>m.reembolso_de), inv:__db.inversiones.map(i=>i.padre_id||null)}));
  assert.deepStrictEqual(await vinculos(v), await vinculos(a));
});
prueba("restaurar no toca una cuenta con datos, deshace si falla y rechaza archivos ajenos", async ()=>{
  const a = await abrir();
  const ruta = await descargarCopia(a);
  const antes = await a.evaluate(()=>__db.movimientos.length);
  await restaurar(a, ruta);
  assert.match(await textoError(a), /sin datos/);
  assert.strictEqual(await a.evaluate(()=>__db.movimientos.length), antes);
  const f = await abrir("?vacia=1");
  await f.evaluate(()=>{ window.__fallarEn = "aportaciones_inversion"; });
  await restaurar(f, ruta);
  assert.match(await textoError(f), /fallo simulado/);
  const quedan = await f.evaluate(()=>Object.entries(__db).filter(([k,v])=>v.length).map(([k])=>k));
  assert.deepStrictEqual(quedan, []);
  const malo = path.join(os.tmpdir(), "no-es-copia.json");
  fs.writeFileSync(malo, '{"hola":1}');
  const m = await abrir("?vacia=1");
  await restaurar(m, malo);
  assert.match(await textoError(m), /no es una copia/);
});
prueba("cerrar sesión recarga y borra los datos locales", async ()=>{
  const p = await abrir();
  await p.evaluate(()=>localStorage.setItem("cuentaDefecto", "c1"));
  await Promise.all([p.waitForNavigation(), p.click("#btnLogout")]);
  assert.strictEqual(await p.evaluate(()=>localStorage.getItem("cuentaDefecto")), null);
});

(async ()=>{
  const html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
  const conSimulado = html.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase[^>]*><\/script>/, '<script src="pruebas/supabase_simulado.js"></script>');
  assert.notStrictEqual(conSimulado, html, "no se encontró el <script> de supabase-js en index.html");
  fs.writeFileSync(HTML_PRUEBA, conSimulado);
  navegador = await chromium.launch();
  let fallos = 0;
  try{
    for(const {nombre, fn} of pruebas){
      errores = [];
      try{
        await fn();
        if(errores.length) throw new Error("errores de JavaScript: " + errores.join(" | "));
        console.log("✓ " + nombre);
      }catch(e){ fallos++; console.log("✗ " + nombre + "\n    " + e.message.split("\n").join("\n    ")); }
    }
  }finally{
    await navegador.close();
    fs.rmSync(HTML_PRUEBA, {force:true});
  }
  console.log(fallos ? `\n${fallos} de ${pruebas.length} pruebas han fallado` : `\nLas ${pruebas.length} pruebas pasan`);
  process.exit(fallos ? 1 : 0);
})();
