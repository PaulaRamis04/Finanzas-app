const PALETTE = ["#f07f76","#3fae92","#8b7fd6","#f2a65a","#5aa9e6","#e98bb5","#7cc26b","#d9a441","#6c8ebf","#c77dbb"];

// Valores de movimientos.categoria que genera la propia app; no son categorías de usuario.
const CATEGORIAS_ESPECIALES = ["Ajuste","Inversión","Deuda","Transferencia"];

const CATEGORIAS_DEFECTO = [
  {tipo:"gasto", padre:"Imprescindible", nombre:"Gasolina"},
  {tipo:"gasto", padre:"Imprescindible", nombre:"Academia"},
  {tipo:"gasto", padre:"Prescindible", nombre:"Salidas"},
  {tipo:"gasto", padre:"Prescindible", nombre:"Tomar algo"},
  {tipo:"gasto", padre:"Prescindible", nombre:"Comer"},
  {tipo:"gasto", padre:"Prescindible", nombre:"Compras"},
  {tipo:"gasto", padre:"Prescindible", nombre:"Suscripciones"},
  {tipo:"ingreso", padre:null, nombre:"Nómina"},
  {tipo:"ingreso", padre:null, nombre:"Extra"},
  {tipo:"ingreso", padre:null, nombre:"Bizum"},
  {tipo:"ingreso", padre:null, nombre:"Otro"}
];

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function eur(n){ return (n<0?"-":"") + "€" + Math.abs(n).toFixed(2).replace(".",","); }

function esc(s){
  if(s==null) return "";
  return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

// ── Fechas: siempre día local del usuario. Nunca new Date("YYYY-MM-DD") (se interpreta en UTC) ni toISOString().slice(0,10).
function fechaLocal(d = new Date()){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function today(){ return fechaLocal(); }
function parseFecha(s){ const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d, 12); } // mediodía: inmune a cambios de hora
function sumarDias(s, n){ const d = parseFecha(s); d.setDate(d.getDate()+n); return fechaLocal(d); }
function diasEntre(a, b){ const [y1,m1,d1] = a.split("-").map(Number), [y2,m2,d2] = b.split("-").map(Number); return Math.round((Date.UTC(y2,m2-1,d2) - Date.UTC(y1,m1-1,d1))/86400000); }

// ── Dinero: opera en céntimos enteros internamente, devuelve euros.
function aCentimos(n){ const x = Number(n)||0; return (x<0?-1:1) * Math.round(Math.abs(x)*100 + 1e-6); }
function redondearDinero(n){ return aCentimos(n)/100; }
function sumarDinero(...ns){ return ns.reduce((c,n)=>c+aCentimos(n),0)/100; }
function restarDinero(a, b){ return (aCentimos(a)-aCentimos(b))/100; }
function sumaImportes(lista, campo = x=>x.importe){ return lista.reduce((c,x)=>c+aCentimos(campo(x)),0)/100; }

function emojiObjetivo(nombre){
  const n = (nombre||"").toLowerCase();
  if(/vivienda|casa|piso|hipoteca/.test(n)) return "🏠";
  if(/emergencia|colch[oó]n/.test(n)) return "🛡️";
  if(/viaje|vacacion/.test(n)) return "✈️";
  if(/coche|auto|carro|moto/.test(n)) return "🚗";
  if(/boda/.test(n)) return "💍";
  if(/estudio|carrera|master|máster/.test(n)) return "🎓";
  return "🎯";
}

function emojiCategoria(categoria, tipo){
  const n = (categoria||"").toLowerCase();
  const reglas = [[/transfer/,"🔁"],[/inversi/,"🌱"],[/n[oó]mina|sueldo|salario/,"💰"],[/super|comida|aliment|mercado/,"🛒"],
    [/restaur|cena|bar|caf/,"🍽️"],[/gasolin|transporte|coche|parking|taxi|tren|metro|bus/,"⛽"],[/alquiler|hipoteca|casa|hogar/,"🏠"],
    [/luz|agua|gas|internet|m[oó]vil|tel[eé]fono|factura/,"💡"],[/suscrip|netflix|spotify|hbo|disney/,"📺"],[/ocio|fiesta|cine|concierto/,"🎉"],
    [/ropa|moda|zapat/,"👗"],[/salud|farmacia|m[eé]dic|dentista/,"💊"],[/gimnasio|deporte/,"🏋️"],[/viaje|vacacion|hotel|vuelo/,"✈️"],
    [/regalo/,"🎁"],[/mascota|perro|gato/,"🐾"],[/educaci|curso|libro|estudio/,"📚"],[/deuda|pr[eé]stamo/,"🤝"],[/ajuste/,"⚖️"]];
  const r = reglas.find(([re])=>re.test(n));
  return r ? r[1] : (tipo==="ingreso" ? "💶" : "💸");
}

// Gasto acumulado del periodo (línea con relleno) frente al presupuesto (línea discontinua).
function graficoGastoMes(acumulado, etiquetas, presupuesto){
  const W=320,H=150,padL=6,padR=8,padT=14,padB=20;
  const n = acumulado.length;
  const max = Math.max(1, presupuesto||0, ...acumulado) * 1.08;
  const x = i => padL + (W-padL-padR) * (n>1 ? i/(n-1) : 0);
  const y = v => (H-padB) - (H-padT-padB) * (v/max);
  // Curva suave que no se sale de los puntos (controles a media distancia en horizontal).
  const puntos = acumulado.map((v,i)=>[x(i), y(v)]);
  const linea = puntos.map(([px,py],i)=>{
    if(i===0) return `M${px.toFixed(1)},${py.toFixed(1)}`;
    const [ax,ay] = puntos[i-1], cx = (ax+px)/2;
    return `C${cx.toFixed(1)},${ay.toFixed(1)} ${cx.toFixed(1)},${py.toFixed(1)} ${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(" ");
  const [ux,uy] = puntos[n-1] || [padL, H-padB];
  const area = n ? `${linea} L${ux.toFixed(1)},${H-padB} L${padL},${H-padB} Z` : "";
  const total = etiquetas.length;
  const xe = i => padL + (W-padL-padR) * (total>1 ? i/(total-1) : 0);
  const marcas = total>12 ? [0,6,13,20,total-1] : etiquetas.map((_,i)=>i);
  const yp = presupuesto>0 ? y(presupuesto) : null;
  return `
  <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Gasto acumulado del periodo">
    <defs><linearGradient id="gradGasto" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--mint)" stop-opacity=".35"/><stop offset="1" stop-color="var(--mint)" stop-opacity="0"/></linearGradient></defs>
    <line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" stroke="var(--line)"/>
    ${yp!==null ? `<line x1="${padL}" y1="${yp.toFixed(1)}" x2="${W-padR}" y2="${yp.toFixed(1)}" stroke="var(--accent)" stroke-width="1.4" stroke-dasharray="4 4"/>` : ""}
    ${n ? `<path d="${area}" fill="url(#gradGasto)"/>
    <path d="${linea}" fill="none" stroke="var(--mint)" stroke-width="2.6" stroke-linecap="round"/>
    <line x1="${ux.toFixed(1)}" y1="${uy.toFixed(1)}" x2="${ux.toFixed(1)}" y2="${H-padB}" stroke="var(--mint)" stroke-width="1" opacity=".5"/>
    <circle cx="${ux.toFixed(1)}" cy="${uy.toFixed(1)}" r="4.2" fill="var(--card)" stroke="var(--mint)" stroke-width="2.2"/>` : ""}
    ${marcas.map(i=>`<text x="${xe(i).toFixed(1)}" y="${H-5}" font-size="9" fill="var(--muted)" text-anchor="${i===0?"start":i===total-1?"end":"middle"}">${esc(etiquetas[i])}</text>`).join("")}
  </svg>`;
}

function graficoPatrimonio(valores, etiquetas){
  const W=320,H=150,padL=6,padR=6,padT=14,padB=20;
  const min = Math.min(0,...valores), max = Math.max(1,...valores);
  const rango = (max-min) || 1;
  const n = valores.length;
  const x = i => padL + (W-padL-padR) * (n>1 ? i/(n-1) : 0);
  const y = v => (H-padB) - (H-padT-padB) * ((v-min)/rango);
  const path = valores.map((v,i)=>`${i===0?"M":"L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return `
  <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
    <line x1="${padL}" y1="${(H-padB).toFixed(1)}" x2="${W-padR}" y2="${(H-padB).toFixed(1)}" stroke="var(--line)" stroke-width="1"/>
    <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(n-1).toFixed(1)}" cy="${y(valores[n-1]).toFixed(1)}" r="3.4" fill="var(--accent)"/>
    ${(()=>{
      const paso = Math.max(1, Math.ceil(n/6));
      const idxs = [];
      for(let i=0;i<n;i+=paso) idxs.push(i);
      if(idxs[idxs.length-1]!==n-1) idxs.push(n-1);
      return idxs.map(i=>`<text x="${x(i).toFixed(1)}" y="${H-6}" font-size="8" fill="var(--muted)" text-anchor="${i===0?"start":i===n-1?"end":"middle"}">${esc(etiquetas[i])}</text>`).join("");
    })()}
  </svg>`;
}

function proyectarSerie(inicial, aporteMensual, tasaAnual, anios){
  const tasaMensual = Math.pow(1 + Math.max(tasaAnual,0)/100, 1/12) - 1;
  let saldo = inicial;
  const serie = [Math.round(saldo*100)/100];
  for(let a=1;a<=anios;a++){
    for(let m=0;m<12;m++) saldo = saldo*(1+tasaMensual) + aporteMensual;
    serie.push(Math.round(saldo*100)/100);
  }
  return serie;
}

function graficoLineasProyeccion(escenarios, anios){
  const W=320,H=170,padL=6,padR=6,padT=10,padB=20;
  const max = Math.max(1, ...escenarios.flatMap(e=>e.data));
  const x = i => padL + (W-padL-padR) * (anios>0 ? i/anios : 0);
  const y = v => (H-padB) - (H-padT-padB) * (v/max);
  const linea = e => e.data.map((v,i)=>`${i===0?"M":"L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const paso = anios<=10?1: anios<=20?2: anios<=40?5:10;
  const marcas = [];
  for(let a=0;a<=anios;a+=paso) marcas.push(a);
  if(marcas[marcas.length-1]!==anios) marcas.push(anios);
  return `
  <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
    <line x1="${padL}" y1="${(H-padB).toFixed(1)}" x2="${W-padR}" y2="${(H-padB).toFixed(1)}" stroke="var(--line)" stroke-width="1"/>
    ${escenarios.slice().reverse().map(e=>`<path d="${linea(e)}" fill="none" stroke="${e.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`).join("")}
    ${marcas.map(a=>`<text x="${x(a).toFixed(1)}" y="${H-6}" font-size="8" fill="var(--muted)" text-anchor="${a===0?"start":a===anios?"end":"middle"}">${a}</text>`).join("")}
  </svg>`;
}

function pieStyle(desc){
  const total = desc.reduce((s,d)=>s+d.total,0);
  if(!total) return "var(--line)";
  let acc = 0;
  return desc.map(d=>{
    const start = acc/total*360; acc += d.total; const end = acc/total*360;
    return `${d.color} ${start}deg ${end}deg`;
  }).join(", ");
}

function anguloXY(cx,cy,r,deg){ const rad=(deg-90)*Math.PI/180; return [cx+r*Math.cos(rad), cy+r*Math.sin(rad)]; }
function sectorDonut(cx,cy,rOut,rIn,a0,a1){
  const [x1,y1]=anguloXY(cx,cy,rOut,a0), [x2,y2]=anguloXY(cx,cy,rOut,a1);
  const [x3,y3]=anguloXY(cx,cy,rIn,a1), [x4,y4]=anguloXY(cx,cy,rIn,a0);
  const large = (a1-a0)>180 ? 1 : 0;
  return `M ${x1.toFixed(2)},${y1.toFixed(2)} A ${rOut},${rOut} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} L ${x3.toFixed(2)},${y3.toFixed(2)} A ${rIn},${rIn} 0 ${large} 0 ${x4.toFixed(2)},${y4.toFixed(2)} Z`;
}
function donutClicable(desc, tipo, atributo){
  const total = desc.reduce((s,d)=>s+d.total,0);
  if(!total) return `<div style="width:130px;height:130px;border-radius:50%;background:var(--line);flex-shrink:0"></div>`;
  const attr = atributo || "data-resumen-sel";
  if(desc.length===1){
    return `
    <svg viewBox="0 0 130 130" width="130" height="130" style="flex-shrink:0">
      <circle cx="65" cy="65" r="50" fill="none" stroke="${desc[0].color}" stroke-width="30" ${attr}="${tipo}|${esc(desc[0].categoria)}" style="cursor:pointer"/>
      <circle cx="65" cy="65" r="34" fill="var(--card)"/>
      <text x="65" y="65" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="800" fill="var(--ink)">${esc(eur(total))}</text>
    </svg>`;
  }
  let acc = 0;
  const sectores = desc.map(d=>{
    const a0 = acc/total*360; acc += d.total; const a1 = acc/total*360;
    return `<path d="${sectorDonut(65,65,65,35,a0,a1)}" fill="${d.color}" ${attr}="${tipo}|${esc(d.categoria)}" style="cursor:pointer"><title>${esc(d.categoria)}</title></path>`;
  }).join("");
  return `
  <svg viewBox="0 0 130 130" width="130" height="130" style="flex-shrink:0">
    ${sectores}
    <circle cx="65" cy="65" r="34" fill="var(--card)" style="pointer-events:none"/>
    <text x="65" y="65" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="800" fill="var(--ink)" style="pointer-events:none">${esc(eur(total))}</text>
  </svg>`;
}

function parseCSV(texto){
  const lineas = texto.split(/\r?\n/).filter(l=>l.trim().length);
  const splitLinea = (linea, delim)=>{
    const out = []; let cur=""; let enComillas=false;
    for(let i=0;i<linea.length;i++){
      const ch = linea[i];
      if(ch==='"'){ enComillas = !enComillas; }
      else if(ch===delim && !enComillas){ out.push(cur); cur=""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map(x=>x.trim());
  };
  let best = null;
  [";",",","\t"].forEach(d=>{
    const freq = {};
    lineas.slice(0,50).forEach(l=>{ const n = splitLinea(l,d).length; freq[n]=(freq[n]||0)+1; });
    let modo = 1, f = 0;
    Object.entries(freq).forEach(([c,n])=>{ if(Number(c)>1 && n>f){ modo=Number(c); f=n; } });
    if(!best || f>best.f) best = {d, modo, f};
  });
  const delim = best ? best.d : ",";
  const modo = best && best.f ? best.modo : 1;
  const filas = lineas.map(l=>splitLinea(l, delim));
  let h = filas.findIndex(f=>f.length===modo && f.every(c=>c.length>0));
  if(h<0) h = filas.findIndex(f=>f.length===modo);
  if(h<0) h = 0;
  return {headers: filas[h]||[], filas: filas.slice(h+1).filter(f=>f.length>1)};
}

// Admite "1.234,56", "1,234.56", "1.234", "-12,50", "12,50-", "(12,50)", "+12,50 €".
function parseImporteCSV(str){
  if(str==null) return NaN;
  let s = String(str).trim().replace(/[€\s\u00a0+]/g,"").replace(/EUR/i,"");
  let neg = false;
  if(/^\(.*\)$/.test(s)){ neg = true; s = s.slice(1,-1); }
  if(s.endsWith("-")){ neg = true; s = s.slice(0,-1); }
  if(s.startsWith("-")){ neg = !neg; s = s.slice(1); }
  if(!/^[\d.,]+$/.test(s)) return NaN;
  const ultComa = s.lastIndexOf(","), ultPunto = s.lastIndexOf(".");
  let dec = null; // separador decimal
  if(ultComa>=0 && ultPunto>=0) dec = ultComa>ultPunto ? "," : ".";
  else if(ultComa>=0) dec = s.split(",").length>2 ? null : ",";
  else if(ultPunto>=0){
    // Un único punto seguido de 3 cifras es de miles ("1.234"), salvo "0.123".
    const partes = s.split(".");
    dec = partes.length>2 || (partes[1].length===3 && !/^0*$/.test(partes[0])) ? null : ".";
  }
  const miles = dec==="," ? "." : dec==="." ? "," : /[.,]/g;
  s = s.replace(typeof miles==="string" ? new RegExp("\\"+miles,"g") : miles, "");
  if(dec) s = s.replace(dec, ".");
  const n = parseFloat(s);
  return isNaN(n) ? NaN : (neg ? -n : n);
}

function parseFechaCSV(str){
  if(!str) return null;
  const s = String(str).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})/);
  if(m){ let y = m[3]; if(y.length===2) y = "20"+y; return `${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`; }
  return s;
}

function lanzarConfeti(mensajeHtml){
  const aviso = document.createElement("div");
  aviso.style.cssText = "position:fixed;left:50%;top:22%;transform:translateX(-50%);z-index:61;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:18px;padding:14px 22px;box-shadow:0 10px 40px rgba(0,0,0,.25);text-align:center;max-width:82%;pointer-events:none;transition:opacity .5s";
  aviso.innerHTML = `<div style="font-size:12px;color:var(--pos);font-weight:800">¡Objetivo conseguido!</div><div style="font-size:17px;font-weight:800;margin-top:3px">${mensajeHtml}</div>`;
  document.body.appendChild(aviso);
  setTimeout(()=>{ aviso.style.opacity = "0"; setTimeout(()=>aviso.remove(), 600); }, 3300);
  if(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60";
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth, H = window.innerHeight;
  canvas.width = W*dpr; canvas.height = H*dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const colores = [...PALETTE, "#6c4ee3", "#ffc233", "#ff6b81"];
  const piezas = Array.from({length:170}, (_,i)=>({
    x: W*(0.2 + Math.random()*0.6), y: H*0.28,
    vx: (Math.random()-0.5)*10, vy: -(Math.random()*12+5), g: 0.3 + Math.random()*0.12,
    w: 6 + Math.random()*6, h: 8 + Math.random()*8, r: Math.random()*6.28, vr: (Math.random()-0.5)*0.4,
    c: colores[i % colores.length]
  }));
  const inicio = performance.now();
  (function frame(t){
    const el = t - inicio;
    ctx.clearRect(0, 0, W, H);
    piezas.forEach(q=>{
      q.vy += q.g; q.x += q.vx; q.y += q.vy; q.vx *= 0.99; q.r += q.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, el-2300)/1400);
      ctx.translate(q.x, q.y); ctx.rotate(q.r);
      ctx.fillStyle = q.c; ctx.fillRect(-q.w/2, -q.h/2, q.w, q.h);
      ctx.restore();
    });
    if(el < 3800) requestAnimationFrame(frame); else canvas.remove();
  })(inicio);
}
// Lanza el confeti solo cuando un objetivo pasa a estar completado (una vez por dispositivo)

function mesesEntre(desde, hastaExclusivo){
  const out = [];
  let [y,m] = desde.split("-").map(Number);
  const [yh,mh] = hastaExclusivo.split("-").map(Number);
  let guard = 0;
  while((y<yh || (y===yh && m<mh)) && guard++<600){
    out.push(`${y}-${String(m).padStart(2,"0")}-01`);
    m++; if(m>12){ m=1; y++; }
  }
  return out;
}

function gripHtml(){ return `<span class="grip" title="Mantén pulsado y arrastra para ordenar" aria-label="Arrastrar para ordenar"><i></i><i></i><i></i></span>`; }

function sortItem(id, html){ return `<div class="sort-item" data-sort-id="${id}">${html}</div>`; }
