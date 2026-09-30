// Pestaña «Proyección»: su render y sus eventos.

function bloqueResultadoProyeccion(r){
  const inicialV = r.escenarios[0].data[0];
  const aportado = inicialV + proy.aporte*12*r.anios;
  return `
  <div class="card">
    <h2>Dentro de ${r.anios} año${r.anios===1?"":"s"}</h2>
    <div class="list" style="margin-top:4px">
      ${r.escenarios.map(e=>`
        <div class="item">
          <div><strong>${e.nombre}</strong><div class="meta">${e.tasa.toFixed(1)}% anual</div></div>
          <div class="amt" style="color:${e.color}">${eur(e.data[e.data.length-1])}</div>
        </div>`).join("")}
    </div>
    <div class="meta" style="margin-top:10px">Habrás aportado ${eur(aportado)} en total (capital inicial incluido); el resto es lo que habría crecido.</div>
  </div>
  <div class="card">
    <h2>Crecimiento año a año</h2>
    ${graficoLineasProyeccion(r.escenarios, r.anios)}
    <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px">
      ${r.escenarios.map(e=>`<span class="meta" style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:50%;background:${e.color}"></span>${e.nombre}</span>`).join("")}
    </div>
    <button class="btn ghost" id="proyToggleDetalle" style="margin-top:12px">${proy.detalle? "Ocultar detalle año a año" : "Ver detalle año a año"}</button>
    ${proy.detalle? `
    <div class="list" style="margin-top:10px">
      ${r.escenarios[0].data.map((_,i)=> i===0? "" : `
      <div class="item">
        <div>Año ${i}</div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:flex-end">
          ${r.escenarios.map(e=>`<span class="meta" style="color:${e.color};font-weight:600">${eur(e.data[i])}</span>`).join("")}
        </div>
      </div>`).join("")}
    </div>` : ""}
  </div>`;
}

function renderProyeccion(){
  if(proy.inicial === null) proy.inicial = Math.round(patrimonioActual()*100)/100;
  return `
  <div class="card">
    <h2>Proyección de patrimonio</h2>
    <p class="meta" style="margin:0 0 10px">Calcula cómo podría crecer tu dinero con aportaciones periódicas. Es una estimación, no una garantía: los mercados no crecen de forma constante.</p>
    <div class="row2">
      <div><label>Capital inicial (€)</label><input type="number" step="0.01" id="proyInicial" value="${proy.inicial}"></div>
      <div><label>Aportación mensual (€)</label><input type="number" step="0.01" id="proyAporte" value="${proy.aporte}"></div>
    </div>
    <div class="row2">
      <div><label>Años</label><input type="number" step="1" min="1" max="60" id="proyAnios" value="${proy.anios}"></div>
      <div><label>Rentabilidad anual estimada (%)</label><input type="number" step="0.1" id="proyTasa" value="${proy.tasa}"></div>
    </div>
    <p class="meta" style="margin:8px 0 0">Conservador y optimista se calculan solos: 2 puntos por debajo y por encima de la rentabilidad que pongas.</p>
    <button class="btn" id="proyCalcular" style="margin-top:10px">Calcular</button>
  </div>
  ${proyResultado? bloqueResultadoProyeccion(proyResultado) : ""}`;
}

function wireEventosProyeccion(){
  const proyCalcular = document.getElementById("proyCalcular");
  if(proyCalcular) proyCalcular.onclick = ()=>{
    const inicial = parseFloat(document.getElementById("proyInicial")?.value);
    const aporte = parseFloat(document.getElementById("proyAporte")?.value);
    const anios = Math.round(parseFloat(document.getElementById("proyAnios")?.value));
    const tasa = parseFloat(document.getElementById("proyTasa")?.value);
    if(isNaN(inicial) || isNaN(aporte) || isNaN(anios) || isNaN(tasa) || anios<1){
      showError("Revisa los datos: capital, aportación, años y rentabilidad deben ser números válidos.");
      return;
    }
    hideError();
    proy = {inicial, aporte: Math.max(aporte,0), anios: Math.min(Math.max(anios,1),60), tasa, detalle:false};
    calcularProyeccion();
    render();
  };
  document.querySelectorAll("#proyToggleDetalle").forEach(b=>b.onclick=()=>{ proy.detalle = !proy.detalle; render(); });
}
