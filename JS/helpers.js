const PALETTE = ["#1f4d43","#c08a2e","#a3402f","#5c9683","#7fb8a6","#e0ac4e","#8a6d3b","#3f6b52","#b5651d","#4a7c94"];

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

function today(){ const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }

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

function parseImporteCSV(str){
  if(str==null) return NaN;
  let s = String(str).trim().replace(/[€\s]/g,"");
  if(s.includes(",") && s.includes(".")) s = s.replace(/\./g,"").replace(",", ".");
  else if(s.includes(",")) s = s.replace(",", ".");
  return parseFloat(s);
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
