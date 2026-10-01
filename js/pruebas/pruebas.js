// Pruebas de la app en un navegador real contra un Supabase simulado (supabase_simulado.js).
// Uso, desde la carpeta del proyecto:  npm install  y después  npm test
const { chromium } = require("playwright");
const fs = require("fs");
const os = require("os");
const path = require("path");
const assert = require("assert");

const RAIZ = path.join(__dirname, "..");
const HTML_PRUEBA = path.join(RAIZ, "index.pruebas.html");
const PESTANAS = ["Inicio","Salud","Gastos","Resumen del mes","Presupuestos","Permitir","Movimientos","Cuentas","Deudas","Inversiones","Objetivos","Vivienda","Hitos","Proyección","Simulador","Recurrentes","Categorías","Preferencias","Personalización","Notificaciones","Comunidad"];

const pruebas = [];
const prueba = (nombre, fn)=>pruebas.push({nombre, fn});
const restarDineroPrueba = (a, b)=>Math.round(a*100 - b*100)/100;

// ── Funciones puras (sin navegador) ──
function cargarHelpers(){
  const ctx = {};
  new Function("ctx", fs.readFileSync(path.join(RAIZ, "js/helpers.js"), "utf8") + "\nctx.h = {sumaImportes, sumarDinero, restarDinero, diasEntre};")(ctx);
  return ctx.h;
}
prueba("las sumas de dinero no arrastran decimales", ()=>{
  const {sumaImportes, sumarDinero, restarDinero} = cargarHelpers();
  assert.strictEqual(sumarDinero(0.1, 0.2), 0.3);
  assert.strictEqual(restarDinero(0.3, 0.1), 0.2);
  assert.strictEqual(sumaImportes(Array(10).fill({importe:0.1})), 1);
});

// ── En el navegador ──
let navegador, errores = [];
const MOVIL = {width:390, height:844};
async function abrir(qs = "", viewport = MOVIL){
  const p = await navegador.newPage({viewport});
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
// Pulsa «Sí, …» en la hoja de confirmación si aparece (no aparece cuando antes hay un error).
const aceptarHoja = p=>p.waitForSelector("#hojaOk", {timeout:3000}).then(()=>p.click("#hojaOk")).catch(()=>{});
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
  await aceptarHoja(p);
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
  await aceptarHoja(p);
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
prueba("Inicio muestra saldo, barras del mes, acciones y recientes", async ()=>{
  const p = await abrir();
  const txt = await p.evaluate(()=>document.getElementById("app").innerText);
  assert.match(txt, /Hola, Paula/);
  assert.match(txt, /Saldo total/);
  assert.match(txt, /Gastado\s*€[\d.,]+ de €400,00/);
  assert.deepStrictEqual(await p.$$eval(".hero-grid span", s=>s.map(x=>x.textContent)), ["Disponible","Inversiones","Me deben","Debo"]);
  assert.strictEqual(await p.$$eval(".barra-mes", b=>b.length), 3);
  assert.match(await p.$$eval(".barra-cab", b=>b[1].innerText), /Ahorro\s*€200,00/, "el ahorro es lo apartado, no lo que sobra");
  assert.match(txt, /Movimientos recientes/);
  assert.ok(await p.isHidden("header"), "en Inicio no se ve la cabecera");
  assert.strictEqual(await p.$$eval("[data-accion]", b=>b.length), 0, "las acciones rápidas empiezan vacías");
  await p.click("#btnEditarAcciones");
  await p.click('[data-elegir-accion="Deudas"]');
  await p.click('[data-elegir-accion="mov"]');
  await p.click("#hojaListo");
  await p.waitForSelector("#hoja", {state:"detached"});
  assert.deepStrictEqual(await p.$$eval("[data-accion]", b=>b.map(x=>x.dataset.accion)), ["Deudas","mov"]);
  await p.click('[data-accion="mov"]');
  assert.strictEqual(await p.evaluate(()=>tab), "Movimientos");
  assert.strictEqual(await p.evaluate(()=>document.activeElement.id), "movImporte");
  assert.ok(await p.isVisible("header"));
  await p.click('[data-nav="Inicio"]');
  assert.strictEqual(await p.evaluate(()=>tab), "Inicio");
});
prueba("en pantalla ancha solo hay menú lateral agrupado, sin barra inferior", async ()=>{
  const p = await abrir("", {width:1280, height:800});
  assert.ok(await p.isHidden("#navInf"));
  const panel = await p.$("#menuPanel");
  assert.strictEqual((await panel.boundingBox()).x, 0, "el menú lateral está fijo a la vista");
  assert.deepStrictEqual(await p.$$eval(".menu-group-title", t=>t.map(x=>x.textContent)), ["Resumen","Dinero","Ahorro","Ajustes"]);
  await p.click('.menu-item[data-tab="Cuentas"]');
  assert.strictEqual(await p.evaluate(()=>tab), "Cuentas");
  assert.ok(await p.isHidden("#menuOverlay"));
  const m = await p.$eval("main", el=>el.getBoundingClientRect().left);
  assert.ok(m >= 248, "el contenido no queda debajo del menú");
  const q = await abrir();
  assert.ok(await q.isVisible("#navInf"), "en el móvil sigue la barra inferior");
  assert.ok((await (await q.$("#menuPanel")).boundingBox()).x < 0, "y el menú está escondido");
});
prueba("al tocar una gráfica se ve el importe de ese punto", async ()=>{
  const p = await abrir();
  const g = await p.$(".graf-int");
  await g.scrollIntoViewIfNeeded();
  const bb = await g.boundingBox();
  await p.mouse.click(bb.x + bb.width*0.3, bb.y + bb.height/2);
  const tip = await p.evaluate(()=>document.querySelector(".graf-int.activa .graf-tip").innerText);
  assert.match(tip, /€[\d.,]+/);
  await p.mouse.click(5, 5);
  assert.strictEqual(await p.$(".graf-int.activa"), null, "al tocar fuera se oculta");
});
prueba("borrar pide confirmación en una hoja inferior y cancelar no borra nada", async ()=>{
  const p = await abrir();
  await p.evaluate(()=>{ tab = "Presupuestos"; render(); });
  const antes = await p.evaluate(()=>__db.presupuestos.length);
  await p.click("[data-del-presupuesto]");
  await p.waitForSelector("#hoja.abierta");
  assert.match(await p.textContent("#hojaTitulo"), /¿Borrar este presupuesto\?/);
  assert.strictEqual(await p.textContent("#hojaOk"), "Sí, borrar");
  await p.click("#hojaNo");
  await p.waitForSelector("#hoja", {state:"detached"});
  assert.strictEqual(await p.evaluate(()=>__db.presupuestos.length), antes);
  await p.click("[data-del-presupuesto]");
  await p.click("#hojaOk");
  await p.waitForFunction(n=>__db.presupuestos.length===n-1, antes);
});
prueba("el ojito oculta todos los importes y se recuerda", async ()=>{
  const p = await abrir();
  await p.click("#btnOjoInicio");
  const txt = await p.evaluate(()=>document.getElementById("app").innerText);
  assert.ok(!/€\d/.test(txt), "no queda ningún importe visible");
  assert.match(txt, /•••• €/);
  await p.reload(); await p.waitForFunction(()=>typeof ready!=="undefined" && ready);
  await p.evaluate(()=>{ tab = "Cuentas"; render(); });
  assert.ok(!/€\d/.test(await p.evaluate(()=>document.body.innerText)));
  await p.click("#btnOjo");
  assert.match(await p.evaluate(()=>document.getElementById("app").innerText), /€\d/);
});
prueba("Objetivos: el resumen de arriba suma lo ahorrado, no la meta", async ()=>{
  const p = await abrir();
  const txt = await p.evaluate(()=>{
    objetivos = [{id:"o1", nombre:"Viaje", meta:1000, tipoVinculo:"cuenta", vinculoId:"c2", orden:0},
                 {id:"o2", nombre:"Coche", meta:3000, tipoVinculo:"ninguno", vinculoId:null, orden:1}];
    tab = "Objetivos"; render();
    return document.getElementById("app").innerText;
  });
  const ahorrado = await p.evaluate(()=>saldoCuenta(cuentas.find(c=>c.id==="c2")));
  assert.ok(ahorrado < 1000);
  assert.match(txt, new RegExp(`${Math.round(ahorrado/4000*100)}% de la meta`));
  assert.ok(!/Todas tus huchas están llenas/.test(txt));
});
prueba("huchas: la barra de iconos se rellena, se echa y se saca dinero y se elige el icono", async ()=>{
  const p = await abrir();
  await p.evaluate(()=>{ __db.objetivos.push({id:"o2", nombre:"Viaje a Japón", meta:1000, tipo_vinculo:"ninguno", vinculo_id:null, orden:2, ahorrado:250}); });
  await p.evaluate(()=>recargar(["objetivos"]));
  await p.evaluate(()=>{ tab = "Objetivos"; render(); });
  const tarjeta = '[data-sort-id="o2"]';
  const barra = ()=>p.$$eval(`${tarjeta} .hucha-barra .hucha-lleno`, els=>els.map(e=>e.textContent + "|" + e.style.clipPath));
  let llenos = await barra();
  assert.strictEqual(llenos.length, 3, "250 de 1000: dos iconos llenos y medio");
  assert.ok(llenos.every(t=>t.startsWith("✈️")), "el nombre elige el tema de viaje");
  assert.match(llenos[2], /inset\(0(px)? 50%/);
  await p.click(`${tarjeta} [data-meter-hucha]`);
  await p.fill("#huchaImporte", "250");
  await p.click(`${tarjeta} [data-hucha-mover][data-signo="1"]`);
  await p.waitForFunction(()=>objetivos.find(o=>o.id==="o2").ahorrado===500);
  assert.strictEqual((await barra()).length, 5);
  await p.click(`${tarjeta} [data-meter-hucha]`);
  await p.fill("#huchaImporte", "600");
  await p.click(`${tarjeta} [data-hucha-mover][data-signo="-1"]`);
  assert.match(await textoError(p), /solo hay/);
  assert.strictEqual(await p.evaluate(()=>__db.objetivos.find(o=>o.id==="o2").ahorrado), 500);
  await p.click(`${tarjeta} [data-tema-hucha]`);
  await p.click(`${tarjeta} [data-elegir-tema="concierto"]`);
  await p.waitForFunction(()=>objetivos.find(o=>o.id==="o2").tema==="concierto");
  assert.ok((await barra()).every(t=>t.startsWith("🎤")));
  // Hucha nueva: el icono elegido se guarda; sin elegir, sale del nombre.
  await p.evaluate(()=>{ formsEstado.objetivo = true; render(); });
  await p.fill('#fObjetivo [name="nombre"]', "Fondo de emergencia");
  await p.fill('#fObjetivo [name="meta"]', "3000");
  await p.click('#fObjetivo button[type="submit"]');
  await p.waitForFunction(()=>__db.objetivos.some(o=>o.nombre==="Fondo de emergencia"));
  assert.strictEqual(await p.evaluate(()=>__db.objetivos.find(o=>o.nombre==="Fondo de emergencia").tema), "emergencia");
  await p.fill('#fObjetivo [name="nombre"]', "Ahorro");
  await p.fill('#fObjetivo [name="meta"]', "100");
  await p.click('#fObjetivo .temas-hucha label[title="Mascota"]');
  await p.click('#fObjetivo button[type="submit"]');
  await p.waitForFunction(()=>__db.objetivos.some(o=>o.nombre==="Ahorro"));
  assert.strictEqual(await p.evaluate(()=>__db.objetivos.find(o=>o.nombre==="Ahorro").tema), "mascota");
});
prueba("la campana abre la pantalla de notificaciones y solo al tocar un aviso va a su pestaña", async ()=>{
  const p = await abrir();
  assert.ok(await p.isVisible("#btnAvisos .punto"), "hay avisos nuevos");
  await p.click("#btnAvisos");
  assert.strictEqual(await p.evaluate(()=>tab), "Notificaciones");
  assert.ok(await p.isHidden("header"));
  assert.match(await p.evaluate(()=>document.getElementById("app").innerText), /Te has pasado en Ocio/);
  await p.click("#btnVolverAvisos");
  assert.strictEqual(await p.evaluate(()=>tab), "Inicio");
  assert.ok(await p.isHidden("#btnAvisos .punto"), "ya vistos: sin punto");
  await p.click("#btnAvisos");
  await p.click('[data-ir-aviso="Presupuestos"]');
  assert.strictEqual(await p.evaluate(()=>tab), "Presupuestos");
});
prueba("personalización: tema, color, fondo e imagen se aplican, se recuerdan y se borran al salir", async ()=>{
  const p = await abrir();
  await p.evaluate(()=>{ tab = "Personalización"; render(); });
  await p.click('[data-tema="dark"]');
  await p.click('[data-acento="#3fae92"]');
  await p.click('[data-fondo="lavanda"]');
  const estilo = ()=>p.evaluate(()=>({tema:document.documentElement.getAttribute("data-theme"),
    acento:getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
    paper:getComputedStyle(document.documentElement).getPropertyValue("--paper").trim(), img:document.documentElement.classList.contains("con-imagen")}));
  assert.deepStrictEqual(await estilo(), {tema:"dark", acento:"#3fae92", paper:"#1b1925", img:false});
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP4z8Dwn4GBgYGJAQoAAB0+AQJ3fQ3pAAAAAElFTkSuQmCC", "base64");
  const [fc] = await Promise.all([p.waitForEvent("filechooser"), p.click("#btnSubirFondo")]);
  await fc.setFiles({name:"foto.png", mimeType:"image/png", buffer:png});
  await p.waitForSelector("#btnQuitarFondo");
  assert.ok((await estilo()).img);
  assert.match(await p.evaluate(()=>localStorage.getItem("fondoImagen")), /^data:image\/jpeg/);
  await p.reload(); await p.waitForFunction(()=>typeof ready!=="undefined" && ready);
  assert.deepStrictEqual(await estilo(), {tema:"dark", acento:"#3fae92", paper:"#1b1925", img:true});
  await p.evaluate(()=>{ tab = "Personalización"; render(); });
  await p.click("#btnQuitarFondo");
  assert.strictEqual((await estilo()).img, false);
  await p.click("#navMas");
  await Promise.all([p.waitForNavigation(), p.click("#menuLogout")]);
  assert.strictEqual(await p.evaluate(()=>localStorage.getItem("personalizacion")), null);
});
prueba("cuentas compartidas: se ven, se ajustan, se comparten, no van en la copia y se puede salir", async ()=>{
  const p = await abrir("?compartida=1");
  await p.evaluate(()=>{ tab = "Cuentas"; render(); });
  const tarjeta = id=>p.locator(`[data-sort-id="${id}"]`);
  assert.match(await tarjeta("c4").innerText(), /Compartida por ana@x\.com/);
  assert.strictEqual(await tarjeta("c4").locator("[data-compartir-cuenta], [data-archivar-cuenta], [data-del-cuenta]").count(), 0);
  assert.deepStrictEqual(await saldosApp(p), await saldosEsperados(p));
  assert.strictEqual(await p.evaluate(()=>saldoCuenta(cuentas.find(c=>c.id==="c4"))), 40);
  // Ajustar saldo en una compartida crea el ajuste desde la app (la RPC no ve lo que apunta la otra persona).
  await tarjeta("c4").locator("[data-ajustar-saldo]").click();
  await p.fill("#saldoRealInput", "25");
  await p.click("[data-confirmar-ajuste]");
  await p.waitForFunction(()=>saldoCuenta(cuentas.find(c=>c.id==="c4"))===25);
  // Compartir una cuenta propia.
  await tarjeta("c1").locator("[data-compartir-cuenta]").click();
  await p.fill("#compartirEmail", "nadie@x.com");
  await p.click("[data-invitar]");
  assert.match(await textoError(p), /no tiene cuenta/);
  await p.fill("#compartirEmail", "Ana@x.com");
  await p.click("[data-invitar]");
  await p.waitForFunction(()=>/Compartida con ana@x\.com/.test(document.querySelector('[data-sort-id="c1"]').innerText));
  // La copia no lleva la cuenta ajena ni sus movimientos.
  const copia = JSON.parse(fs.readFileSync(await descargarCopia(p), "utf8"));
  assert.ok(!copia.cuentas.some(c=>c.id==="c4"));
  assert.ok(!copia.movimientos.some(m=>m.cuentaId==="c4"));
  // Salir de la compartida.
  await p.evaluate(()=>{ tab = "Cuentas"; render(); });
  await tarjeta("c4").locator("[data-salir-cuenta]").click();
  await aceptarHoja(p);
  await p.waitForFunction(()=>!cuentas.some(c=>c.id==="c4"));
});
prueba("sin premium: Proyección bloqueada (Inversiones no), Personalización solo tema y compartir avisa", async ()=>{
  const p = await abrir("?premium=0");
  await p.evaluate(()=>localStorage.setItem("personalizacion", JSON.stringify({tema:"dark", acento:"#3fae92", fondo:"lavanda"})));
  await p.reload(); await p.waitForFunction(()=>typeof ready!=="undefined" && ready);
  await p.waitForFunction(()=>!getComputedStyle(document.documentElement).getPropertyValue("--paper-l").trim());
  assert.deepStrictEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem("personalizacion"))), {tema:"dark"});
  assert.strictEqual(await p.evaluate(()=>document.documentElement.getAttribute("data-theme")), "dark");
  await p.evaluate(()=>{ tab = "Proyección"; render(); });
  assert.match(await p.innerText("#app"), /Esto es de Premium/);
  await p.evaluate(()=>{ tab = "Inversiones"; render(); });
  assert.doesNotMatch(await p.innerText("#app"), /Esto es de Premium/);
  await p.evaluate(()=>{ tab = "Personalización"; render(); });
  assert.ok(await p.locator("[data-tema]").count() > 0);
  assert.strictEqual(await p.locator("[data-acento], #btnSubirFondo").count(), 0);
  assert.strictEqual(await p.locator(".marca-premium").count(), 2);
  // Las secciones premium llevan su estrella; el saludo no, porque no es premium.
  assert.strictEqual(await p.locator("#menuPanel .estrella-premium").count(), 2);
  await p.evaluate(()=>{ tab = "Inicio"; render(); });
  assert.strictEqual(await p.locator(".hola .estrella-premium").count(), 0);
  await p.evaluate(()=>{ tab = "Cuentas"; render(); });
  await p.click('[data-sort-id="c1"] [data-compartir-cuenta]');
  assert.match(await p.innerText("#app"), /Esto es de Premium/);
  assert.strictEqual(await p.locator("#compartirEmail").count(), 0);
});
prueba("dividir un gasto: apunta el gasto entero y una deuda «Me deben» por amigo", async ()=>{
  const p = await abrir();
  assert.deepStrictEqual(await p.evaluate(()=>repartoGasto(10, 3)), {parte:3.33, tuya:3.34, meDeben:6.66});
  await p.evaluate(()=>{ tab = "Deudas"; render(); });
  assert.strictEqual(await p.locator("#fDividir").count(), 0, "empieza plegado");
  await p.click("[data-toggle-dividir]");
  await p.fill("#divImporte", "60");
  await p.fill("#divPersonas", "3");
  assert.strictEqual(await p.locator('#divNombres input').count(), 2);
  await p.fill('#divNombres input >> nth=0', "Marta");
  assert.match(await p.innerText("#divResumen"), /20,00 cada uno · te deben €40,00/);
  await p.fill('#fDividir [name="concepto"]', "cena viernes");
  const antes = await p.evaluate(()=>({m:__db.movimientos.length, d:__db.deudas.length}));
  await p.click('#fDividir button[type="submit"]');
  await p.waitForFunction(n=>__db.deudas.length===n+2, antes.d);
  const r = await p.evaluate(()=>{
    const m = __db.movimientos[__db.movimientos.length-1];
    return {m:{tipo:m.tipo, importe:m.importe, nota:m.nota}, d:__db.deudas.slice(-2).map(d=>[d.persona, d.importe, d.direccion, d.movimiento_id===m.id])};
  });
  assert.deepStrictEqual(r.m, {tipo:"gasto", importe:60, nota:"cena viernes"});
  assert.deepStrictEqual(r.d, [["Marta",20,"me_deben",true],["Amigo 2",20,"me_deben",true]]);
  await p.waitForFunction(()=>deudas.some(d=>d.persona==="Marta"));
  assert.strictEqual(await p.locator("#fDividir").count(), 0, "se pliega al guardar");
  assert.ok(await p.locator("[data-pedir-bizum]").count() >= 3);
  assert.match(await p.evaluate(()=>textoBizum(deudas.find(d=>d.persona==="Marta"))), /Marta.*cena viernes me debes 20,00 €.*Bizum/);
  // Si fallan las deudas no queda el gasto suelto.
  await p.click("[data-toggle-dividir]");
  await p.fill("#divImporte", "9");
  await p.fill('#fDividir [name="concepto"]', "pizzas");
  await p.evaluate(()=>{ window.__fallarEn = "deudas"; });
  await p.click('#fDividir button[type="submit"]');
  await p.waitForFunction(()=>document.getElementById("errBar").classList.contains("show"));
  assert.ok(!(await p.evaluate(()=>__db.movimientos.some(m=>m.nota==="pizzas"))));
  // También sin premium.
  const pp = await abrir("?premium=0");
  await pp.evaluate(()=>{ tab = "Deudas"; render(); });
  await pp.click("[data-toggle-dividir]");
  assert.doesNotMatch(await pp.innerText("#app"), /Esto es de Premium/);
  assert.strictEqual(await pp.locator("#fDividir").count(), 1);
  assert.ok(await pp.locator("[data-pedir-bizum]").count() >= 1);
});
prueba("premium: estrella junto al nombre en Inicio y en las secciones premium", async ()=>{
  const p = await abrir("");
  await p.waitForFunction(()=>esPremium);
  await p.evaluate(()=>{ tab = "Inicio"; render(); });
  assert.strictEqual(await p.locator(".hola h1 .estrella-premium").count(), 1);
  assert.match(await p.innerText(".hola h1"), /Paula\s*⭐/);
  assert.strictEqual(await p.locator("#menuPanel .estrella-premium").count(), 2);
  assert.strictEqual(await p.locator(".marca-premium").count(), 0);
  await p.evaluate(()=>{ tab = "Proyección"; render(); });
  assert.strictEqual(await p.locator("#tabActual .estrella-premium").count(), 1);
  await p.evaluate(()=>{ tab = "Inversiones"; render(); });
  assert.strictEqual(await p.locator("#tabActual .estrella-premium").count(), 0);
});
prueba("Comunidad: supporter, idea y fallo se guardan y dan las gracias", async ()=>{
  const pp = await abrir("", {width:1280, height:900});
  await pp.evaluate(()=>{ tab = "Comunidad"; render(); });
  assert.match(await pp.innerText("#app"), /Ya eres premium/);
  assert.strictEqual(await pp.locator('[data-comunidad-abrir="supporter"]').count(), 0, "un premium no puede volver a hacerse supporter");
  const p = await abrir("?premium=0", {width:1280, height:900});
  await p.click(".menu-comunidad");
  assert.strictEqual(await p.evaluate(()=>tab), "Comunidad");
  await p.click('[data-comunidad-abrir="supporter"]');
  assert.match(await p.innerText("#app"), /opciones premium/);
  await p.click('[data-supporter-importe="10"]');
  await p.click('[data-comunidad-enviar="supporter"]');
  await p.waitForSelector(".comunidad-ok");
  await p.click('[data-comunidad-abrir="idea"]');
  await p.click('[data-comunidad-enviar="idea"]');
  assert.match(await textoError(p), /Escribe un mensaje/);
  await p.fill("#comunidadTexto", "Modo pareja");
  await p.click('[data-comunidad-enviar="idea"]');
  await p.click('[data-comunidad-abrir="fallo"]');
  await p.fill("#comunidadTexto", "No carga");
  await p.click('[data-comunidad-enviar="fallo"]');
  await p.waitForSelector(".comunidad-ok");
  const filas = await p.evaluate(()=>__db.comunidad.map(f=>[f.tipo, f.importe, f.texto, !!f.info]));
  assert.deepStrictEqual(filas, [["supporter",10,"",false],["idea",null,"Modo pareja",false],["fallo",null,"No carga",true]]);
});
prueba("acceso con contraseña: error, registro, recuperar y entrar", async ()=>{
  const p = await navegador.newPage({viewport:MOVIL});
  p.on("pageerror", e=>errores.push(e.message));
  await p.goto("file://" + HTML_PRUEBA + "?sinsesion=1");
  await p.waitForSelector("#fLogin", {state:"visible"});
  assert.ok(await p.isHidden("#appShell"));
  await p.fill("#loginEmail", "p@x.com");
  await p.fill("#loginPass", "mala");
  await p.click("#fLogin button[type=submit]");
  await p.waitForFunction(()=>/incorrectos/.test(document.getElementById("loginMsg").textContent));
  await p.click('[data-auth="registro"]');
  assert.ok(await p.isVisible("#fRegistro"));
  assert.strictEqual(await p.inputValue("#regEmail"), "p@x.com", "el email se conserva al cambiar de formulario");
  await p.fill("#regNombre", "Ana"); await p.fill("#regPass", "otraclave1");
  await p.click("#fRegistro button[type=submit]");
  await p.waitForFunction(()=>/confirmar la cuenta/.test(document.getElementById("loginMsg").textContent));
  await p.click('[data-auth="olvido"]');
  await p.click("#fOlvido button[type=submit]");
  await p.waitForFunction(()=>/te llegará un enlace/.test(document.getElementById("loginMsg").textContent));
  const llamadas = await p.evaluate(()=>__auth.map(a=>a[0]));
  assert.deepStrictEqual(llamadas, ["signInWithPassword","signUp","resetPasswordForEmail"]);
  await p.click('[data-auth="login"]');
  await p.fill("#loginPass", "secreta123");
  await p.click("#fLogin button[type=submit]");
  await p.waitForFunction(()=>typeof ready!=="undefined" && ready);
  assert.ok(await p.isVisible("#appShell"));
  assert.ok(await p.isHidden("#authScreen"));
});
prueba("el enlace de recuperar pide la contraseña nueva antes de entrar", async ()=>{
  const p = await navegador.newPage({viewport:MOVIL});
  p.on("pageerror", e=>errores.push(e.message));
  await p.goto("file://" + HTML_PRUEBA + "#access_token=x&type=recovery");
  await p.waitForSelector("#fNuevaPass", {state:"visible"});
  assert.ok(await p.isHidden("#appShell"));
  await p.fill("#nuevaPass", "nuevaclave1");
  await p.click("#fNuevaPass button[type=submit]");
  await p.waitForFunction(()=>typeof ready!=="undefined" && ready);
  assert.deepStrictEqual(await p.evaluate(()=>__auth[0]), ["updateUser", {password:"nuevaclave1"}]);
  assert.ok(await p.isVisible("#appShell"));
});
prueba("cerrar sesión recarga y borra los datos locales", async ()=>{
  const p = await abrir();
  await p.evaluate(()=>localStorage.setItem("cuentaDefecto", "c1"));
  await p.click("#navMas");
  await Promise.all([p.waitForNavigation(), p.click("#menuLogout")]);
  assert.strictEqual(await p.evaluate(()=>localStorage.getItem("cuentaDefecto")), null);
});
prueba("eliminar cuenta: pide escribir ELIMINAR, confirma, borra los datos y cierra la sesión", async ()=>{
  const p = await abrir();
  await p.evaluate(()=>localStorage.setItem("cuentaDefecto", "c1"));
  await p.evaluate(()=>{ tab = "Preferencias"; render(); });
  assert.ok(await p.isDisabled("#btnBorrarCuenta"));
  await p.fill("#borrarCuentaTexto", "eliminar");
  assert.ok(!(await p.isDisabled("#btnBorrarCuenta")));
  // Cancelar en la hoja no borra nada.
  await p.click("#btnBorrarCuenta");
  await p.click("#hojaNo");
  assert.ok(await p.evaluate(()=>__db.movimientos.length) > 0);
  await p.click("#btnBorrarCuenta");
  await Promise.all([p.waitForNavigation(), p.click("#hojaOk")]);
  assert.strictEqual(await p.evaluate(()=>localStorage.getItem("__cuentaBorrada")), "1");
  assert.ok(await p.isVisible("#loginEmail"));
  assert.strictEqual(await p.evaluate(()=>localStorage.getItem("cuentaDefecto")), null);
  assert.ok(!(await p.evaluate(()=>JSON.parse(localStorage.getItem("perfiles")||"[]").length)));
});
prueba("perfiles: añadir otra cuenta, cambiar con la flecha y cerrar solo uno", async ()=>{
  const p = await abrir();
  await p.evaluate(()=>localStorage.setItem("accionesRapidas", '["Gastos"]'));
  await p.click("#btnPerfiles");
  await Promise.all([p.waitForNavigation(), p.click("#btnAnadirPerfil")]);
  await p.waitForSelector("#fLogin", {state:"visible"});
  assert.match(await p.innerText("#authPerfiles"), /Paula/, "el perfil anterior sale en el acceso");
  await p.fill("#loginEmail", "ana@x.com"); await p.fill("#loginPass", "secreta123");
  await p.click("#fLogin button[type=submit]");
  await p.waitForFunction(()=>typeof ready!=="undefined" && ready && session?.user?.id==="u2");
  assert.match(await p.innerText(".hola"), /Ana/);
  assert.strictEqual(await p.evaluate(()=>localStorage.getItem("accionesRapidas")), null, "Ana no hereda las preferencias de Paula");
  await p.click("#btnPerfiles");
  await p.waitForSelector('[data-cambiar-perfil="u1"]');
  await Promise.all([p.waitForNavigation(), p.click('[data-cambiar-perfil="u1"]')]);
  await p.waitForFunction(()=>typeof ready!=="undefined" && ready);
  assert.strictEqual(await p.evaluate(()=>session.user.id), "u1");
  assert.strictEqual(await p.evaluate(()=>localStorage.getItem("accionesRapidas")), '["Gastos"]', "Paula recupera sus preferencias");
  await p.click("#btnPerfiles");
  await Promise.all([p.waitForNavigation(), p.click("#btnSalirPerfil")]);
  await p.waitForSelector("#fLogin", {state:"visible"});
  assert.deepStrictEqual(await p.evaluate(()=>leerPerfiles().map(x=>x.id)), ["u2"], "solo se olvida el perfil que cierra sesión");
  await Promise.all([p.waitForNavigation(), p.click('[data-perfil="u2"]')]);
  await p.waitForFunction(()=>typeof ready!=="undefined" && ready && session?.user?.id==="u2");
});

prueba("cierre del mes: tarjeta que se guarda como imagen y PDF, con importes ocultables", async ()=>{
  const p = await abrir();
  await p.evaluate(()=>{ tab = "Resumen del mes"; render(); });
  await p.click("#btnCierre");
  await p.waitForFunction(()=>document.getElementById("cierreImg")?.src.startsWith("data:image/png"));
  const bytes = async boton=>{
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click(boton)]);
    return {nombre: dl.suggestedFilename(), datos: fs.readFileSync(await dl.path())};
  };
  const png = await bytes("#cierrePng");
  assert.match(png.nombre, /^cierre-[a-z]+-\d{4}\.png$/);
  assert.strictEqual(png.datos.subarray(1,4).toString(), "PNG");
  const pdf = await bytes("#cierrePdf");
  assert.match(pdf.nombre, /\.pdf$/);
  assert.ok(pdf.datos.subarray(0,8).toString().startsWith("%PDF-1.4") && pdf.datos.includes("/DCTDecode") && pdf.datos.subarray(-6).toString().includes("%%EOF"));
  const antes = await p.$eval("#cierreImg", i=>i.src);
  await p.click("#cierreOcultar");
  assert.notStrictEqual(await p.$eval("#cierreImg", i=>i.src), antes, "ocultar importes vuelve a dibujar la tarjeta");
  await p.keyboard.press("Escape");
  await p.waitForSelector("#cierre", {state:"detached"});
  await p.evaluate(()=>{ periodoAnio = periodoAnio-1; periodoMes = "8"; render(); });
  assert.ok(await p.$eval("#btnCierre", b=>b.disabled), "sin movimientos no hay cierre que ver");
});

prueba("hitos: se desbloquean solos, guardan la fecha y celebran los nuevos", async ()=>{
  const p = await abrir();
  const guardados = ()=>p.evaluate(()=>Object.fromEntries(__db.hitos.map(h=>[h.clave, h.fecha])));
  // Al abrir se pone al día sin celebrar: patrimonio (~4.500 €) e inversión (1.200 €).
  let g = await guardados();
  for(const k of ["pat_500","pat_1000","pat_2500","inv_primera","inv_500","inv_1000"]) assert.ok(g[k], k);
  for(const k of ["pat_5000","inv_5000","obj_viaje"]) assert.ok(!g[k], k);
  assert.ok(!(await p.evaluate(()=>document.body.innerText.includes("hito desbloqueado"))));
  // En la pestaña se carga todo el histórico y salen los que dependen de él (meses con ahorro e inversión).
  await p.evaluate(()=>{ tab = "Hitos"; render(); });
  await p.waitForFunction(()=>__db.hitos.some(h=>h.clave==="mes_ahorro"));
  g = await guardados();
  assert.ok(g.mes_inversion, "mes con inversión");
  const texto = await p.evaluate(()=>document.getElementById("app").innerText);
  assert.ok(texto.includes("MIS HITOS"));
  assert.ok(texto.includes(`${Object.keys(g).length} / 34 desbloqueados`), texto.slice(0, 200));
  assert.ok(/Racha de ahorro: [1-9]\d* mes/.test(texto), "racha de ahorro en marcha");
  // Detalle: el conseguido dice cuándo; el bloqueado, qué falta.
  await p.click('[data-hito="pat_500"]');
  await p.waitForSelector("#hoja.abierta");
  const [yy,mm,dd] = g.pat_500.split("-");
  assert.ok((await p.textContent("#hoja")).includes(`Alcanzaste 500 € de patrimonio el ${dd}/${mm}/${yy}.`));
  await p.click("#hojaOk");
  await p.waitForSelector("#hoja", {state:"detached"});
  await p.click('[data-hito="pat_100000"]');
  await p.waitForSelector("#hoja.abierta");
  assert.ok((await p.textContent("#hoja")).includes("Llega a 100.000 € de patrimonio"));
  await p.keyboard.press("Escape");
  await p.waitForSelector("#hoja", {state:"detached"});
  // Llenar una hucha de viaje desbloquea dos hitos nuevos con la fecha de hoy y los celebra.
  await p.evaluate(async ()=>{ __db.objetivos.push({id:"o9", nombre:"Japón", meta:100, ahorrado:100, tipo_vinculo:"ninguno", tema:"viaje", orden:2}); await recargar(["objetivos"]); });
  await p.waitForFunction(()=>document.body.innerText.includes("¡Nuevos hitos desbloqueados!"));
  g = await guardados();
  const hoy = await p.evaluate(()=>today());
  assert.strictEqual(g.obj_viaje, hoy);
  assert.strictEqual(g.obj_primero, hoy);
  // Una vez conseguido no se pierde, aunque la hucha se borre.
  await p.evaluate(async ()=>{ __db.objetivos = __db.objetivos.filter(o=>o.id!=="o9"); await recargar(["objetivos","hitos"]); });
  assert.ok(await p.evaluate(()=>!!hitosGuardados.obj_viaje));
  // Sin la tabla «hitos» se guardan en este dispositivo.
  const local = await p.evaluate(async ()=>{ delete __db.hitos; localStorage.removeItem("hitos"); await recargar(["hitos","movimientos"]); return {enBd:hitosEnBd, local:JSON.parse(localStorage.getItem("hitos")||"{}")}; });
  assert.strictEqual(local.enBd, false);
  assert.ok(local.local.pat_500 && local.local.mes_ahorro);
});

prueba("¿me lo puedo permitir?: enseña cómo quedaría todo después de la compra", async ()=>{
  const p = await abrir();
  await p.evaluate(async ()=>{
    __db.objetivos.push({id:"o8", nombre:"Japón", meta:3000, ahorrado:200, tipo_vinculo:"ninguno", tema:"viaje", orden:2, auto_activo:true, auto_cuota:100, auto_dia_mes:1, auto_cuenta_origen:"c2"});
    await recargar(["objetivos"]);
    tab = "Inicio"; render();
  });
  await p.click('[data-ir-tab="Permitir"]');
  assert.strictEqual(await p.$eval("#permCategoria", s=>s.value), "Ocio", "por defecto propone la categoría de ocio");
  await p.selectOption("#permCuenta", "c1");
  await p.fill("#permConcepto", "Móvil");
  await p.fill("#permImporte", "650");
  const r = await p.evaluate(()=>calcularPermitir(650, "Ocio", "c1"));
  assert.strictEqual(r.patrimonio.despues, restarDineroPrueba(r.patrimonio.antes, 650));
  assert.ok(r.fondo.toca, "el Colchón está en la cuenta con la que se paga");
  assert.strictEqual(r.fondo.despues, restarDineroPrueba(r.fondo.antes, Math.min(650, r.fondo.antes)));
  assert.strictEqual(r.presupuesto.despues, restarDineroPrueba(r.presupuesto.queda, 650));
  const japon = r.objetivos.huchas.find(h=>h.nombre==="Japón");
  assert.strictEqual(japon.meses, 6.5, "a 100 €/mes, 650 € son 6,5 meses");
  assert.ok(!r.objetivos.huchas.some(h=>h.nombre==="Colchón"), "el fondo de emergencia no cuenta como objetivo");
  const texto = await p.innerText("#permResultado");
  assert.ok(texto.includes("Después de Móvil"), texto);
  for(const t of ["Patrimonio","Fondo de emergencia","Objetivos","Presupuesto ocio","+6,5 meses"]) assert.ok(texto.includes(t), t);
  // Pagando desde otra cuenta el fondo no se toca.
  await p.selectOption("#permCuenta", "c2");
  assert.ok((await p.innerText("#permResultado")).includes("No lo toca"));
  assert.strictEqual(await p.evaluate(()=>calcularPermitir(650, "Ocio", "c2").fondo.toca), false);
  // Sin importe no hay resultado, y lo escrito se mantiene al volver a la pestaña.
  await p.fill("#permImporte", "");
  assert.ok((await p.innerText("#permResultado")).includes("Escribe un importe"));
  await p.fill("#permImporte", "650");
  await p.evaluate(()=>{ tab = "Inicio"; render(); tab = "Permitir"; render(); });
  assert.strictEqual(await p.$eval("#permImporte", i=>i.value), "650");
  assert.ok((await p.innerText("#permResultado")).includes("Después de Móvil"));
});

prueba("¿cómo estoy?: semáforo con nota y objetivos configurables", async ()=>{
  const p = await abrir();
  await p.evaluate(()=>{ tab = "Salud"; render(); });
  // Carga los 6 meses cerrados que necesita aunque la carga inicial fuese parcial.
  await p.waitForFunction(()=>!movParcial || movDesde<=mesesAntes(6)[0]+"-01");
  let texto = await p.evaluate(()=>document.getElementById("app").innerText);
  for(const t of ["Ahorro:","Deuda: sin deudas","Fondo de emergencia:","Inversión:","Gastos:"]) assert.ok(texto.includes(t), t);
  const {nota} = await p.evaluate(()=>evaluarSalud());
  assert.ok(Number.isInteger(nota) && nota>=0 && nota<=100, "nota "+nota);
  assert.ok(texto.includes(`Salud financiera: ${nota}/100`), texto.slice(0, 400));
  // El detalle se despliega al tocar el indicador.
  await p.click('[data-salud="deuda"]');
  assert.ok(await p.isVisible("#saludDet_deuda"));
  // Una deuda enorme pone la deuda en rojo y baja la nota.
  await p.evaluate(async ()=>{ __db.deudas.push({id:"d9", persona:"Banco", importe:100000, importe_inicial:100000, direccion:"debo", concepto:"hipoteca", estado:"pendiente", fecha:today()}); await recargar(["deudas"]); });
  texto = await p.evaluate(()=>document.getElementById("app").innerText);
  assert.ok(texto.includes("Deuda: alta"), texto.slice(0, 400));
  const conDeuda = await p.evaluate(()=>evaluarSalud().nota);
  assert.ok(conDeuda<nota, `${conDeuda} < ${nota}`);
  // Si la deuda no cuenta, la nota no la tiene en cuenta; los objetivos se guardan en la tabla.
  await p.click("#saludAjustes");
  await p.selectOption("#saludPeso_deuda", "0");
  await p.fill("#salud_ahorro", "35");
  await p.click("#saludGuardar");
  await p.waitForFunction(()=>__db.salud_config.length===1);
  const cfg = await p.evaluate(()=>__db.salud_config[0].config);
  assert.strictEqual(cfg.ahorro, 35);
  assert.strictEqual(cfg.pesos.deuda, 0);
  texto = await p.evaluate(()=>document.getElementById("app").innerText);
  assert.ok(texto.includes("(no cuenta)"));
  assert.ok((await p.textContent("#saludDet_ahorro")).includes("tu objetivo: 35 %"));
  assert.strictEqual(await p.evaluate(()=>evaluarSalud().nota), await p.evaluate(()=>{
    const l = evaluarSalud().lista.filter(i=>i.puntos!==null && i.id!=="deuda");
    return Math.round(l.reduce((s,i)=>s+i.puntos, 0)/l.length);
  }));
  // Inicio enseña la nota.
  const notaFinal = await p.evaluate(()=>{ tab = "Inicio"; render(); return evaluarSalud().nota; });
  assert.ok((await p.evaluate(()=>document.getElementById("app").innerText)).includes(`Salud financiera: ${notaFinal}/100`));
  // Sin la tabla «salud_config» se guardan en este dispositivo.
  const local = await p.evaluate(async ()=>{
    delete __db.salud_config; await recargar(["salud_config"]);
    tab = "Salud"; saludAjustesAbiertos = true; render();
    document.getElementById("salud_inversion").value = "15";
    document.getElementById("saludGuardar").click();
    await new Promise(r=>setTimeout(r, 50));
    return {enBd:saludEnBd, local:JSON.parse(localStorage.getItem("saludConfig")||"{}")};
  });
  assert.strictEqual(local.enBd, false);
  assert.strictEqual(local.local.inversion, 15);
});

prueba("simulador de vivienda: cifras, hucha 🏠 y comparación con otra persona", async ()=>{
  const p = await abrir();
  await p.evaluate(async ()=>{
    __db.objetivos.push({id:"ov", nombre:"Piso", meta:70000, tipo_vinculo:"ninguno", ahorrado:20000, tema:"casa", orden:2, auto_activo:true, auto_cuota:1000, auto_dia_mes:1, auto_cuenta_origen:"c1"});
    await recargar(["objetivos"]);
    tab = "Vivienda"; render();
  });
  const txt = id=>p.textContent("#"+id);
  // 300.000 € con 20 % de entrada y 10 % de gastos, partiendo de la hucha (20.000 € y 1.000 €/mes).
  assert.strictEqual(await p.inputValue("#vivAhorro"), "20000");
  assert.strictEqual(await p.inputValue("#vivMensual"), "1000");
  assert.strictEqual(await txt("vivNecesario"), "€90000,00");
  assert.strictEqual(await txt("vivFaltan"), "€70000,00");
  assert.strictEqual(await txt("vivTiempo"), "5 años y 10 meses");
  // Se recalcula al escribir, sin perder el foco.
  await p.fill("#vivGastos", "0");
  assert.strictEqual(await txt("vivNecesario"), "€60000,00");
  assert.strictEqual(await txt("vivTiempo"), "3 años y 4 meses");
  assert.strictEqual(await p.evaluate(()=>document.activeElement.id), "vivGastos");
  await p.fill("#vivMensual", "0");
  assert.strictEqual(await txt("vivTiempo"), "Sin ahorro mensual no se llega");
  await p.fill("#vivMensual", "1000");
  // Con otra persona: suma su ahorro y su ritmo, y se muestran las dos columnas.
  await p.check("#vivConOtra");
  await p.fill("#vivOtraNombre", "Alex");
  await p.fill("#vivOtraAhorro", "10000");
  await p.fill("#vivOtraMensual", "1000");
  const comp = await p.textContent("#vivComparacion");
  assert.ok(comp.includes("Tú + Alex"), comp);
  assert.ok(comp.includes("3 años y 4 meses") && comp.includes("1 año y 3 meses"), comp);
  assert.ok(!/mejor|recomend/i.test(comp), "no dice qué opción es mejor");
  // Se recuerda en este dispositivo, pero el ahorro vuelve a salir de la hucha.
  await p.reload();
  await p.waitForFunction(()=>typeof ready!=="undefined" && ready);
  await p.evaluate(()=>{ tab = "Vivienda"; render(); });
  assert.strictEqual(await p.inputValue("#vivGastos"), "0");
  assert.strictEqual(await p.inputValue("#vivOtraNombre"), "Alex");
  assert.strictEqual(await p.inputValue("#vivAhorro"), "0");
});

prueba("¿qué pasaría si…?: compara patrimonio a 1, 3, 5 y 10 años y las huchas", async ()=>{
  const p = await abrir("?premium=0");
  // Cálculo: lo ahorrado de más se queda en cuentas; pausar la inversión cuesta rentabilidad pero no dinero.
  const r = await p.evaluate(()=>{
    const base = {ingresos:2000, gastos:1500, inversion:300, cuentas:1000, invertido:0, tasa:0};
    return {
      igual: simularPatrimonio(base, [], 1),
      ahorro: simularPatrimonio(base, [{tipo:"ahorro", valor:100}], 3),
      sueldo: simularPatrimonio(base, [{tipo:"sueldo", valor:1800}], 1),
      gasto: simularPatrimonio(base, [{tipo:"gasto", valor:100}], 1),
      pausaSinRenta: simularPatrimonio(base, [{tipo:"pausa", valor:12}], 10)[10],
      conRenta: simularPatrimonio({...base, tasa:5}, [], 10)[10],
      pausaConRenta: simularPatrimonio({...base, tasa:5}, [{tipo:"pausa", valor:12}], 10)[10],
      invertirMas: simularPatrimonio({...base, tasa:5}, [{tipo:"invertir", valor:500}], 10)[10]
    };
  });
  assert.deepStrictEqual(r.igual, [1000, 7000]);
  assert.strictEqual(r.ahorro[3] - 1000 - 500*36, 100*36);
  assert.strictEqual(r.sueldo[1], 1000 + (1800-1500)*12);
  assert.strictEqual(r.gasto[1], 7000 + 1200);
  assert.strictEqual(r.pausaSinRenta, 1000 + 500*120);
  assert.ok(r.pausaConRenta < r.conRenta && r.invertirMas > r.conRenta);
  // Sin premium también se ve y parte de tus datos.
  await p.evaluate(()=>{ tab = "Simulador"; render(); });
  assert.ok(await p.isVisible("#simAnadir"));
  assert.strictEqual(await p.evaluate(()=>sim.base.cuentas), await p.evaluate(()=>sumaImportes(cuentas, saldoCuenta)));
  // Base fija para que no dependa de la fecha: 500 €/mes de ahorro; a la hucha «Colchón» le faltan 5000 − saldo.
  await p.evaluate(()=>{ sim.base = {...sim.base, ingresos:2000, gastos:1500, inversion:0, tasa:0}; render(); });
  await p.click('[data-sim-ejemplo="0"]');
  assert.ok((await p.textContent('[data-sim-anio="1"]')).includes("+€1200,00"));
  assert.ok((await p.textContent('[data-sim-anio="10"]')).includes("+€12000,00"));
  const hucha = await p.evaluate(()=>{ const falta = Math.max(5000 - progresoObjetivo(objetivos[0]), 0); return {antes:Math.ceil(falta/500), despues:Math.ceil(falta/600)}; });
  const txtHucha = await p.textContent('[data-sim-hucha="o1"]');
  if(hucha.antes>hucha.despues) assert.ok(txtHucha.includes("antes"), txtHucha);
  // Un cambio del mismo tipo sustituye al anterior; quitar lo deja como estaba.
  await p.selectOption("#simTipo", "ahorro");
  await p.fill("#simValor", "50");
  await p.click("#simAnadir");
  assert.deepStrictEqual(await p.evaluate(()=>sim.cambios), [{tipo:"ahorro", valor:50}]);
  await p.selectOption("#simTipo", "pausa");
  await p.fill("#simValor", "0");
  await p.click("#simAnadir");
  assert.ok((await textoError(p)).includes("meses"));
  await p.click('[data-sim-quitar="ahorro"]');
  assert.strictEqual(await p.evaluate(()=>sim.cambios.length), 0);
  assert.ok(!(await p.textContent('[data-sim-anio="1"]')).includes("+"));
});

(async ()=>{
  const html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
  const conSimulado = html.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase[^>]*><\/script>/, '<script src="pruebas/supabase_simulado.js"></script>');
  assert.notStrictEqual(conSimulado, html, "no se encontró el <script> de supabase-js en index.html");
  fs.writeFileSync(HTML_PRUEBA, conSimulado);
  // Usa el Chromium de Playwright si está instalado; si no (p. ej. macOS 12, que ya no lo soporta), el Google Chrome del sistema.
  try{ navegador = await chromium.launch(); }
  catch(e){
    try{ navegador = await chromium.launch({channel:"chrome"}); }
    catch(e2){ console.error("No se encontró ningún navegador. Instala Google Chrome (o ejecuta: npx playwright install chromium)."); throw e2; }
  }
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
