// Traduce la app al idioma elegido (js/idioma.js) sin tocar las vistas: cada texto que aparece
// en pantalla se busca en TRADUCCIONES[idioma]. Si no está, se queda en español.
// Las claves con {} son plantillas: {} es la parte que cambia (una cifra, un nombre…) y se
// coloca en la traducción en el mismo orden, o en otro con {1}, {2}… {#} es igual pero solo
// vale para cifras e importes (para plantillas muy generales como «{#} de {#}»).
// Una clave que acaba en «:» vale también con lo que venga detrás (p. ej. el detalle de un error).

const DICC = new Map(), PLANTILLAS = [];
const NO_TRADUCIR = new Set(["SCRIPT","STYLE","TEXTAREA","CODE"]);
const ATRIBUTOS = ["placeholder","title","aria-label","alt","label"];
const faltanTraducir = new Set(); // textos sin traducción (para revisar en las pruebas)
const traducidos = new Set();     // textos ya traducidos: no se vuelven a buscar

const normalizar = s=>s.replace(/\s+/g," ").trim();
const escRe = s=>s.replace(/[.*+?^$()|[\]\\]/g,"\\$&");

function cargarTraducciones(){
  const t = TRADUCCIONES[idioma] || {};
  const pares = Object.entries(t);
  // confirmar() pinta por separado la pregunta «¿…?» y la explicación: también se buscan sueltas.
  for(const [es, otro] of Object.entries(t)){
    let a = /^(¿[^?]*\?)\s+(.+)$/s.exec(es), b = /^(.+?\?)\s+(.+)$/s.exec(otro);
    if(a && b){ pares.push([a[1], b[1]], [a[2], b[2]]); continue; }
    a = /^(.+?)\s*(¿[^?]*\?)$/s.exec(es); b = /^(.*[.!:])\s+([^.!:]+\?)$/s.exec(otro);
    if(a && b) pares.push([a[1], b[1]], [a[2], b[2]]);
  }
  for(const [es, otro] of pares){
    const k = normalizar(es);
    if(/\{#?\}/.test(k)) añadirPlantilla(k, otro);
    else{
      DICC.set(k, otro);
      if(/:$/.test(k)) añadirPlantilla(k+" {}", otro+" {}");
    }
  }
  // Las más largas primero, para que gane la más concreta.
  PLANTILLAS.sort((a,b)=>b.fijo-a.fijo);
  // Meses en el idioma elegido (MESES se usa para pintar, nunca para leer datos).
  if(idioma!=="es"){
    const nombres = Array.from({length:12}, (_,i)=>new Date(2000, i, 1).toLocaleDateString(localeApp(), {month:"long"}));
    nombres.forEach((m,i)=>{ MESES[i] = m.charAt(0).toUpperCase() + m.slice(1); traducidos.add(MESES[i]); traducidos.add(MESES[i].slice(0,3)); });
  }
}
function añadirPlantilla(k, otro){
  const re = new RegExp("^" + k.split(/\{#?\}/).map(escRe).join("(.+?)") + "$", "s");
  const cifras = [...k.matchAll(/\{(#?)\}/g)].map(m=>m[1]==="#");
  PLANTILLAS.push({re, otro, cifras, fijo:k.replace(/\{#?\}/g,"").length});
}
// Una cifra o un importe (o solo el símbolo de la moneda): como mucho 3 letras (US$, Bs…) y algún número, •••• o símbolo.
const esCifra = x=>/[\d•$€£₡₲\/]/.test(x) && (x.match(/\p{L}/gu)||[]).length<=3;
function rellenar(plantilla, partes){
  let n = 0;
  return plantilla.replace(/\{(\d*)\}/g, (_,i)=>{ const p = partes[i ? Number(i)-1 : n++]; return p==null ? "" : p; });
}
// Ajustes del catalán: «de» + vocal se apostrofa («d'octubre»).
const apostrofar = s=>idioma==="ca" ? s.replace(/\b([Dd])e ([aeiouhàèéíòóúAEIOUHÀÈÉÍÒÓÚ])/g, "$1'$2") : s;

function traducirNucleo(k){
  if(DICC.has(k)) return DICC.get(k);
  // Emojis, flechas o viñetas delante («▾ Ahorro», «🎯 Objetivos») o dos puntos detrás («Deuda:»).
  const bordes = /^([^\p{L}¡¿«"(]+)?(.*?)([\s:…·]+)?$/su.exec(k);
  if((bordes[1] || bordes[3]) && bordes[2]){
    const t = traducirNucleo(bordes[2]);
    if(t!=null) return (bordes[1]||"") + t + (bordes[3]||"");
  }
  for(const p of PLANTILLAS){
    const m = p.re.exec(k);
    if(m && p.cifras.every((c,i)=>!c || esCifra(m[i+1]))) return apostrofar(rellenar(p.otro, m.slice(1).map(x=>{ const t = traducirNucleo(normalizar(x)); return t==null ? x : t; })));
  }
  return null;
}
// Traduce un texto suelto (también se usa en el lienzo del cierre y en los avisos del navegador).
function tr(s){
  if(idioma==="es" || typeof s!=="string" || !/\p{L}/u.test(s)) return s;
  const k = normalizar(s);
  if(traducidos.has(k)) return s;
  const t = traducirNucleo(k);
  if(t==null){ if(/\p{L}{2}/u.test(k)) faltanTraducir.add(k); return s; }
  traducidos.add(normalizar(t));
  const ini = s.match(/^\s*/)[0], fin = s.match(/\s*$/)[0];
  return ini + t + (k ? fin : "");
}

function traducirTexto(nodo){
  const p = nodo.parentNode;
  if(!p || NO_TRADUCIR.has(p.nodeName) || (p.closest && p.closest("[translate=no]"))) return;
  const t = tr(nodo.data);
  if(t!==nodo.data) nodo.data = t;
}
function traducirAtributos(el){
  if(el.closest("[translate=no]")) return;
  for(const a of ATRIBUTOS){
    const v = el.getAttribute(a);
    if(v){ const t = tr(v); if(t!==v) el.setAttribute(a, t); }
  }
  if(el.nodeName==="INPUT" && (el.type==="button" || el.type==="submit") && el.value){ const t = tr(el.value); if(t!==el.value) el.value = t; }
}
function traducirArbol(raiz){
  if(raiz.nodeType===3){ traducirTexto(raiz); return; }
  if(raiz.nodeType!==1 || NO_TRADUCIR.has(raiz.nodeName)) return;
  traducirAtributos(raiz);
  raiz.querySelectorAll("*").forEach(traducirAtributos);
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  for(let n = w.nextNode(); n; n = w.nextNode()) traducirTexto(n);
}

if(idioma!=="es"){
  cargarTraducciones();
  traducirArbol(document.documentElement);
  document.title = tr(document.title);
  new MutationObserver(cambios=>{
    for(const c of cambios){
      if(c.type==="childList") c.addedNodes.forEach(traducirArbol);
      else if(c.type==="characterData") traducirTexto(c.target);
      else if(c.target.nodeType===1) traducirAtributos(c.target);
    }
  }).observe(document.documentElement, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:ATRIBUTOS});
  // Avisos del navegador y textos dibujados (tarjeta del cierre).
  for(const f of ["alert","confirm","prompt"]){ const orig = window[f].bind(window); window[f] = (msg, ...r)=>orig(tr(msg), ...r); }
  const C = CanvasRenderingContext2D.prototype;
  for(const f of ["fillText","strokeText","measureText"]){ const orig = C[f]; C[f] = function(txt, ...r){ return orig.call(this, tr(String(txt)), ...r); }; }
}
