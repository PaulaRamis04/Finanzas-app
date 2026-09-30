// «Cierre del mes»: tarjeta resumen del periodo (estilo Wrapped) dibujada en un canvas,
// para guardarla como imagen o PDF, o compartirla. Se abre desde la pestaña «Resumen del mes».

const CIERRE_W = 1080, CIERRE_H = 1350; // 4:5, el formato que mejor se ve en redes
let cierreOcultar = null; // null = sigue al ojito de privacidad

function datosCierre(){
  const enP = movimientosEfectivos();
  const ingresos = enP.filter(m=>m.tipo==="ingreso");
  const ahorro = enP.filter(m=>m.tipo==="gasto" && m.categoria==="Inversión");
  const gastos = enP.filter(m=>m.tipo==="gasto" && m.categoria!=="Inversión" && m.importe>0);
  const totalIng = sumaImportes(ingresos), totalGas = sumaImportes(gastos), totalAho = sumaImportes(ahorro);
  const balance = restarDinero(totalIng, totalGas);
  const anual = periodoMes==="todos";
  // Día (o mes, en el resumen del año) en el que más se gastó
  const porClave = {};
  gastos.forEach(m=>{ const k = anual ? m.fecha.slice(0,7) : m.fecha; porClave[k] = sumarDinero(porClave[k]||0, m.importe); });
  const pico = Object.entries(porClave).sort((a,b)=>b[1]-a[1])[0] || null;
  let picoTexto = null;
  if(pico){
    if(anual) picoTexto = MESES[Number(pico[0].slice(5,7))-1];
    else { const d = parseFecha(pico[0]); picoTexto = `${["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][d.getDay()]} ${d.getDate()}`; }
  }
  return {
    anual, enCurso: esPeriodoActualReal(),
    titulo: anual ? `Mi ${periodoAnio}` : `${MESES[Number(periodoMes)-1]} ${periodoAnio}`,
    nombrePeriodo: anual ? String(periodoAnio) : MESES[Number(periodoMes)-1],
    n: enP.length, totalIng, totalGas, totalAho, balance,
    tasa: totalIng>0 ? Math.round(balance/totalIng*100) : null,
    top: desglosePorCategoria(gastos).slice(0,3),
    mayor: gastos.reduce((a,m)=> !a || m.importe>a.importe ? m : a, null),
    pico: pico ? {texto:picoTexto, total:pico[1]} : null,
  };
}

function fraseCierre(d){
  const p = d.anual ? "Año" : "Mes";
  if(d.tasa===null) return d.totalGas>0 ? `${p} sin ingresos… ¡a por el siguiente! 🌈` : `${p} tranquilo y sin sustos 🌷`;
  if(d.tasa>=30) return `¡${p} de hucha llena! 🐷✨`;
  if(d.tasa>=10) return "Vas por buen camino, ¡sigue así! 💪";
  if(d.tasa>=0) return "Cuentas cuadradas, ¡bien hecho! 🌷";
  return `${p} intenso… ¡el siguiente será mejor! 🌈`;
}

// Banner de la pestaña «Resumen del mes»
function tarjetaCierre(){
  const d = datosCierre();
  const hay = d.n>0;
  return `
  <div class="card cierre-banner">
    <div class="cierre-banner-ico">🎁</div>
    <div style="flex:1 1 180px;min-width:0">
      <strong style="font-size:16px">Tu cierre de ${esc(d.nombrePeriodo)}</strong>
      <div class="meta">${hay ? `Tu ${d.anual?"año":"mes"} en una tarjeta bonita para guardar o compartir` : "Cuando haya movimientos en este periodo podrás ver tu cierre"}</div>
    </div>
    <button class="btn" id="btnCierre" ${hay?"":"disabled"}>Ver mi cierre ✨</button>
  </div>`;
}

// ── Dibujo ──
function fuenteCierre(ctx, peso, tam){ ctx.font = `${peso} ${tam}px Nunito, "Segoe UI", Roboto, sans-serif`; }
function textoCierre(ctx, txt, x, y, maxW, peso, tam, min = 18){
  let t = tam; fuenteCierre(ctx, peso, t);
  while(ctx.measureText(txt).width>maxW && t>min){ t -= 2; fuenteCierre(ctx, peso, t); }
  if(ctx.measureText(txt).width>maxW){
    while(txt.length>1 && ctx.measureText(txt+"…").width>maxW) txt = txt.slice(0,-1);
    txt += "…";
  }
  ctx.fillText(txt, x, y);
}
function rectRedondo(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y); ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r); ctx.arcTo(x, y, x+w, y, r); ctx.closePath();
}
function colorAcentoCierre(ctx){
  const v = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  ctx.fillStyle = "#f07f76"; ctx.fillStyle = v || "#f07f76"; // si el valor no es un color válido, se queda el de por defecto
  return ctx.fillStyle;
}

function dibujarCierre(canvas, d, ocultar){
  canvas.width = CIERRE_W; canvas.height = CIERRE_H;
  const ctx = canvas.getContext("2d");
  const W = CIERRE_W, M = 72, ancho = W - 2*M;
  const INK = "#4a3b3b", MUTED = "#9a8a86", POS = "#2f9e7a", NEG = "#e0556a", LINE = "#f3e7df";
  const ACC = colorAcentoCierre(ctx);
  const dinero = n=> ocultar ? "••••" : eur0(n);
  const pct = n=> `${String(n).replace(".",",")} %`;
  ctx.textBaseline = "alphabetic";

  // Fondo pastel con manchas de color
  const g = ctx.createLinearGradient(0, 0, W, CIERRE_H);
  g.addColorStop(0, "#fff7f0"); g.addColorStop(1, "#fdeee9");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, CIERRE_H);
  [[990,110,230,ACC,.2],[70,1260,280,"#3fae92",.13],[1010,1040,170,"#8b7fd6",.12],[80,420,120,"#f2a65a",.12]].forEach(([x,y,r,c,a])=>{
    ctx.globalAlpha = a; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
  });
  ctx.globalAlpha = .55; ctx.fillStyle = ACC; fuenteCierre(ctx, 800, 34);
  ctx.fillText("✦", 880, 250); ctx.fillText("✦", 118, 1150); fuenteCierre(ctx, 800, 22); ctx.fillText("✦", 948, 300);
  ctx.globalAlpha = 1;

  // Cabecera
  const etiqueta = d.anual ? "MI CIERRE DEL AÑO" : "MI CIERRE DEL MES";
  fuenteCierre(ctx, 800, 26);
  const anchoEt = ctx.measureText(etiqueta).width + 48;
  ctx.globalAlpha = .16; ctx.fillStyle = ACC; rectRedondo(ctx, M, 72, anchoEt, 52, 26); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = ACC; ctx.fillText(etiqueta, M+24, 107);
  ctx.fillStyle = INK; textoCierre(ctx, d.titulo, M, 218, ancho-120, 800, 88, 40);
  if(d.enCurso){ ctx.fillStyle = MUTED; fuenteCierre(ctx, 700, 28); ctx.fillText(d.anual ? "Año en curso · hasta hoy" : "Mes en curso · hasta hoy", M, 262); }

  // Tarjeta principal: lo que sobró (o faltó)
  const tarjeta = (x, y, w, h, r = 40)=>{
    ctx.save(); ctx.shadowColor = "rgba(74,59,59,.08)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
    ctx.fillStyle = "#ffffff"; rectRedondo(ctx, x, y, w, h, r); ctx.fill(); ctx.restore();
  };
  tarjeta(M, 292, ancho, 272, 44);
  const positivo = d.balance>=0;
  ctx.fillStyle = MUTED;
  if(ocultar && d.tasa!==null){
    fuenteCierre(ctx, 700, 34); ctx.fillText(positivo ? "De todo lo que entró, guardaste" : "Gastaste más de lo que entró", M+48, 360);
    ctx.fillStyle = positivo ? POS : NEG; textoCierre(ctx, pct(Math.abs(d.tasa)), M+48, 476, ancho-96, 800, 116, 40);
    if(!positivo){ ctx.fillStyle = MUTED; fuenteCierre(ctx, 700, 30); ctx.fillText("por encima de tus ingresos", M+48, 526); }
  } else {
    fuenteCierre(ctx, 700, 34); ctx.fillText(positivo ? "Este " + (d.anual?"año":"mes") + " te sobró" : "Este " + (d.anual?"año":"mes") + " gastaste de más", M+48, 360);
    ctx.fillStyle = positivo ? POS : NEG; textoCierre(ctx, dinero(Math.abs(d.balance)), M+48, 476, ancho-96, 800, 116, 40);
    if(d.tasa!==null){
      const t = positivo ? `Guardaste el ${pct(d.tasa)} de lo que entró` : `${pct(Math.abs(d.tasa))} por encima de tus ingresos`;
      ctx.fillStyle = MUTED; textoCierre(ctx, t, M+48, 530, ancho-96, 700, 30);
    }
  }

  // Tres cifras: ingresos, gastos, ahorro
  const gap = 24, tw = (ancho - 2*gap)/3;
  [["💶","Ingresos",d.totalIng,"#3fae92"],["💸","Gastos",d.totalGas,ACC],["🌱","Invertido",d.totalAho,"#8b7fd6"]].forEach(([emo,txt,val,col],i)=>{
    const x = M + i*(tw+gap);
    tarjeta(x, 590, tw, 170, 34);
    ctx.globalAlpha = .9; ctx.fillStyle = col; rectRedondo(ctx, x+28, 614, 8, 34, 4); ctx.fill(); ctx.globalAlpha = 1;
    fuenteCierre(ctx, 400, 36); ctx.fillText(emo, x+48, 646);
    ctx.fillStyle = MUTED; fuenteCierre(ctx, 700, 26); ctx.fillText(txt, x+28, 692);
    ctx.fillStyle = INK; textoCierre(ctx, dinero(val), x+28, 736, tw-56, 800, 40, 20);
  });

  // ¿En qué se fue?
  ctx.fillStyle = INK; fuenteCierre(ctx, 800, 36); ctx.fillText("¿En qué se fue el dinero?", M, 822);
  tarjeta(M, 846, ancho, 240, 40);
  if(!d.top.length){
    ctx.fillStyle = MUTED; fuenteCierre(ctx, 700, 32); ctx.fillText("¡Ni un gasto en este periodo! 😮", M+48, 978);
  } else d.top.forEach((c,i)=>{
    const y = 846 + (240 - d.top.length*72)/2 + 4 + i*72;
    fuenteCierre(ctx, 400, 40); ctx.fillStyle = INK; ctx.fillText(emojiCategoria(c.categoria, "gasto"), M+40, y+36);
    ctx.fillStyle = INK; textoCierre(ctx, c.categoria, M+104, y+22, 300, 800, 30, 20);
    const valor = ocultar ? pct(Math.round(c.pct)) : `${dinero(c.total)} · ${Math.round(c.pct)} %`;
    fuenteCierre(ctx, 700, 26); ctx.fillStyle = MUTED; ctx.textAlign = "right"; ctx.fillText(valor, M+ancho-40, y+22); ctx.textAlign = "left";
    const bx = M+104, bw = ancho-144;
    ctx.fillStyle = LINE; rectRedondo(ctx, bx, y+36, bw, 14, 7); ctx.fill();
    ctx.fillStyle = c.color; rectRedondo(ctx, bx, y+36, Math.max(14, bw*c.pct/100), 14, 7); ctx.fill();
  });

  // Dos curiosidades
  const hw = (ancho - gap)/2;
  const curiosidades = [
    ["🏆", "Gasto más grande", d.mayor ? (ocultar ? d.mayor.categoria : `${dinero(d.mayor.importe)} · ${d.mayor.categoria}`) : "—"],
    d.pico ? ["📅", d.anual ? "Mes más gastón" : "Día más gastón", d.pico.texto] : ["🧾", "Movimientos", String(d.n)],
  ];
  curiosidades.forEach(([emo,txt,val],i)=>{
    const x = M + i*(hw+gap);
    tarjeta(x, 1108, hw, 124, 34);
    fuenteCierre(ctx, 400, 44); ctx.fillStyle = INK; ctx.fillText(emo, x+28, 1186);
    ctx.fillStyle = MUTED; fuenteCierre(ctx, 700, 24); ctx.fillText(txt, x+96, 1156);
    ctx.fillStyle = INK; textoCierre(ctx, val, x+96, 1198, hw-124, 800, 32, 18);
  });

  // Pie
  ctx.textAlign = "center";
  ctx.fillStyle = INK; textoCierre(ctx, fraseCierre(d), W/2, 1290, ancho, 800, 36, 22);
  ctx.fillStyle = MUTED; fuenteCierre(ctx, 700, 22); ctx.fillText("🐷 Hecho con Cuentas", W/2, 1326);
  ctx.textAlign = "left";
}

// Importe sin céntimos cuando es redondo, para que la tarjeta respire
function eur0(n){
  const s = Math.abs(n).toFixed(2).replace(".",",");
  return (n<0?"-":"") + "€" + (s.endsWith(",00") ? s.slice(0,-3) : s);
}

// ── Exportar ──
function blobDeCanvas(canvas, tipo, calidad){ return new Promise(ok=>canvas.toBlob(ok, tipo, calidad)); }

// PDF de una página con la tarjeta como imagen JPEG (sin librerías)
function pdfConJpeg(jpeg, wPx, hPx){
  const wPt = 540, hPt = Math.round(540*hPx/wPx);
  const enc = new TextEncoder(), partes = [], offs = [];
  let largo = 0;
  const add = x=>{ const b = typeof x==="string" ? enc.encode(x) : x; partes.push(b); largo += b.length; };
  const obj = (n, cuerpo)=>{ offs[n] = largo; add(`${n} 0 obj\n`); cuerpo(); add("\nendobj\n"); };
  add("%PDF-1.4\n");
  obj(1, ()=>add("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, ()=>add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"));
  obj(3, ()=>add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
  obj(4, ()=>{ add(`<< /Type /XObject /Subtype /Image /Width ${wPx} /Height ${hPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`); add(jpeg); add("\nendstream"); });
  const contenido = `q ${wPt} 0 0 ${hPt} 0 0 cm /Im0 Do Q`;
  obj(5, ()=>add(`<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`));
  const xref = largo;
  add(`xref\n0 6\n0000000000 65535 f \n${[1,2,3,4,5].map(n=>String(offs[n]).padStart(10,"0")+" 00000 n \n").join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(partes, {type:"application/pdf"});
}

function descargarArchivo(blob, nombre){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 4000);
}

function nombreArchivoCierre(d, ext){
  const base = (d.anual ? `cierre-${periodoAnio}` : `cierre-${MESES[Number(periodoMes)-1]}-${periodoAnio}`).toLowerCase();
  return `${base}.${ext}`;
}

// ── Ventana con la tarjeta ──
async function abrirCierre(){
  document.getElementById("cierre")?.remove();
  const d = datosCierre();
  const canvas = document.createElement("canvas");
  const cont = document.createElement("div");
  cont.id = "cierre";
  cont.innerHTML = `
    <div class="cierre-fondo"></div>
    <div class="cierre-panel" role="dialog" aria-modal="true" aria-label="Cierre de ${esc(d.nombrePeriodo)}">
      <button class="cierre-x" id="cierreCerrar" aria-label="Cerrar">✕</button>
      <img id="cierreImg" alt="Tarjeta resumen de ${esc(d.titulo)}">
      <label class="cierre-ocultar"><input type="checkbox" id="cierreOcultar"> Ocultar importes (solo porcentajes)</label>
      <div class="cierre-btns">
        <button class="btn" id="cierrePng">🖼️ Imagen</button>
        <button class="btn gold" id="cierrePdf">📄 PDF</button>
        <button class="btn gold" id="cierreCompartir" hidden>📤 Compartir</button>
      </div>
    </div>`;
  document.body.appendChild(cont);
  const img = cont.querySelector("#cierreImg"), chk = cont.querySelector("#cierreOcultar");
  chk.checked = cierreOcultar===null ? ocultarSaldos : cierreOcultar;
  // Espera a la fuente Nunito (sin bloquear si no carga, p. ej. sin conexión)
  try{ await Promise.race([document.fonts.load("800 40px Nunito"), new Promise(r=>setTimeout(r, 1500))]); }catch(e){}
  const pintar = ()=>{ dibujarCierre(canvas, d, chk.checked); img.src = canvas.toDataURL("image/png"); };
  pintar();
  requestAnimationFrame(()=>requestAnimationFrame(()=>cont.classList.add("abierta")));

  const previo = document.activeElement;
  const cerrar = ()=>{
    document.removeEventListener("keydown", tecla);
    cont.classList.remove("abierta");
    setTimeout(()=>cont.remove(), 260);
    try{ previo && previo.focus && previo.focus({preventScroll:true}); }catch(e){}
  };
  const tecla = e=>{ if(e.key==="Escape") cerrar(); };
  document.addEventListener("keydown", tecla);
  cont.querySelector(".cierre-fondo").onclick = cerrar;
  cont.querySelector("#cierreCerrar").onclick = cerrar;
  chk.onchange = ()=>{ cierreOcultar = chk.checked; pintar(); };
  cont.querySelector("#cierrePng").onclick = async ()=>descargarArchivo(await blobDeCanvas(canvas, "image/png"), nombreArchivoCierre(d, "png"));
  cont.querySelector("#cierrePdf").onclick = async ()=>{
    const jpeg = new Uint8Array(await (await blobDeCanvas(canvas, "image/jpeg", 0.92)).arrayBuffer());
    descargarArchivo(pdfConJpeg(jpeg, canvas.width, canvas.height), nombreArchivoCierre(d, "pdf"));
  };
  // Compartir (móvil): solo si el navegador sabe compartir archivos
  const btnComp = cont.querySelector("#cierreCompartir");
  const prueba = typeof File!=="undefined" && navigator.canShare && navigator.canShare({files:[new File([""], "a.png", {type:"image/png"})]});
  if(prueba){
    btnComp.hidden = false;
    btnComp.onclick = async ()=>{
      const archivo = new File([await blobDeCanvas(canvas, "image/png")], nombreArchivoCierre(d, "png"), {type:"image/png"});
      try{ await navigator.share({files:[archivo], title:`Mi cierre de ${d.nombrePeriodo}`}); }catch(e){}
    };
  }
}

function wireEventosCierre(){
  const b = document.getElementById("btnCierre");
  if(b) b.onclick = ()=>abrirCierre();
}
