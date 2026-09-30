// Pruebas de la app en un navegador real contra un Supabase simulado (supabase_simulado.js).
// Uso, desde la carpeta del proyecto:  npm install  y después  npm test
const { chromium } = require("playwright");
const fs = require("fs");
const os = require("os");
const path = require("path");
const assert = require("assert");

const RAIZ = path.join(__dirname, "..");
const HTML_PRUEBA = path.join(RAIZ, "index.pruebas.html");
const PESTANAS = ["Inicio","Gastos","Resumen del mes","Presupuestos","Movimientos","Cuentas","Deudas","Inversiones","Objetivos","Proyección","Recurrentes","Categorías","Preferencias","Personalización","Notificaciones","Comunidad"];

const pruebas = [];
const prueba = (nombre, fn)=>pruebas.push({nombre, fn});

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
  assert.ok(!/Todos tus objetivos están conseguidos/.test(txt));
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
prueba("sin premium: Inversiones y Proyección bloqueadas, Personalización solo tema y compartir avisa", async ()=>{
  const p = await abrir("?premium=0");
  await p.evaluate(()=>localStorage.setItem("personalizacion", JSON.stringify({tema:"dark", acento:"#3fae92", fondo:"lavanda"})));
  await p.reload(); await p.waitForFunction(()=>typeof ready!=="undefined" && ready);
  await p.waitForFunction(()=>!getComputedStyle(document.documentElement).getPropertyValue("--paper-l").trim());
  assert.deepStrictEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem("personalizacion"))), {tema:"dark"});
  assert.strictEqual(await p.evaluate(()=>document.documentElement.getAttribute("data-theme")), "dark");
  for(const t of ["Inversiones","Proyección"]){
    await p.evaluate(t=>{ tab = t; render(); }, t);
    assert.match(await p.innerText("#app"), /Esto es de Premium/, t);
  }
  await p.evaluate(()=>{ tab = "Personalización"; render(); });
  assert.ok(await p.locator("[data-tema]").count() > 0);
  assert.strictEqual(await p.locator("[data-acento], #btnSubirFondo").count(), 0);
  assert.ok(await p.locator(".marca-premium").count() >= 3);
  await p.evaluate(()=>{ tab = "Cuentas"; render(); });
  await p.click('[data-sort-id="c1"] [data-compartir-cuenta]');
  assert.match(await p.innerText("#app"), /Esto es de Premium/);
  assert.strictEqual(await p.locator("#compartirEmail").count(), 0);
});
prueba("Comunidad: supporter, idea y fallo se guardan y dan las gracias", async ()=>{
  const p = await abrir("", {width:1280, height:900});
  await p.click(".menu-comunidad");
  assert.strictEqual(await p.evaluate(()=>tab), "Comunidad");
  await p.click('[data-comunidad-abrir="supporter"]');
  assert.match(await p.innerText("#app"), /Mini asesoría personalizada/);
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
