// Orquestador: render() pinta la pestaña actual y wireEvents() engancha los eventos de todas. Va el último porque arranca la app con init().

let tabPintada = null;

function render(){
  const y0 = window.scrollY, ae = document.activeElement;
  const focoId = tab===tabPintada && ae && ae.id && document.getElementById("app").contains(ae) ? ae.id : null;
  const sel = focoId && typeof ae.selectionStart==="number" ? [ae.selectionStart, ae.selectionEnd] : null;
  document.getElementById("appShell").classList.toggle("en-inicio", tab==="Inicio" || tab==="Notificaciones");
  renderTabs();
  renderBalance();
  renderPeriodo();
  const app = document.getElementById("app");
  if(!ready){ app.innerHTML = `<div class="status">Cargando...</div>`; return; }
  if(TABS_PREMIUM.includes(tab) && !esPremium) app.innerHTML = avisoPremium(tab);
  else if(tab==="Inicio") app.innerHTML = renderInicio();
  else if(tab==="Gastos") app.innerHTML = renderGastos();
  else if(tab==="Resumen del mes") app.innerHTML = renderResumen();
  else if(tab==="Presupuestos") app.innerHTML = renderPresupuestos();
  else if(tab==="Movimientos") app.innerHTML = renderMovimientos();
  else if(tab==="Deudas") app.innerHTML = renderDeudas();
  else if(tab==="Cuentas") app.innerHTML = renderCuentas();
  else if(tab==="Inversiones") app.innerHTML = renderInversiones();
  else if(tab==="Objetivos") app.innerHTML = renderObjetivos();
  else if(tab==="Vivienda") app.innerHTML = renderVivienda();
  else if(tab==="Hitos") app.innerHTML = renderHitos();
  else if(tab==="Proyección") app.innerHTML = renderProyeccion();
  else if(tab==="Recurrentes") app.innerHTML = renderRecurrentes();
  else if(tab==="Preferencias") app.innerHTML = renderPreferencias();
  else if(tab==="Notificaciones") app.innerHTML = renderNotificaciones();
  else if(tab==="Personalización") app.innerHTML = renderPersonalizacion();
  else if(tab==="Comunidad") app.innerHTML = renderComunidad();
  else app.innerHTML = renderCategorias();
  wireEvents();
  aplicarPlegables();
  activarOrdenar();
  if(pendienteEnfoque){
    const el = document.getElementById(pendienteEnfoque);
    pendienteEnfoque = null;
    if(el){ el.scrollIntoView({block:"center", behavior:"smooth"}); try{ el.focus({preventScroll:true}); }catch(e){} }
  } else if(ready && tab===tabPintada){
    if(focoId){ const el = document.getElementById(focoId); if(el){ try{ el.focus({preventScroll:true}); if(sel) el.setSelectionRange(sel[0], sel[1]); }catch(e){} } }
    window.scrollTo(0, y0);
  }
  if(ready) tabPintada = tab;
}

// Cada pestaña engancha sus propios eventos; se llaman todos en cada render,
// igual que antes, porque algunos elementos (p. ej. la lista de movimientos) salen en varias pestañas.
function wireEvents(){
  wireEventosMovimientos();
  wireEventosDeudas();
  wireEventosCuentas();
  wireEventosInicio();
  wireEventosResumen();
  wireEventosGastos();
  wireEventosInversiones();
  wireEventosCategorias();
  wireEventosProyeccion();
  wireEventosRecurrentes();
  wireEventosPreferencias();
  wireEventosPersonalizacion();
  wireEventosNotificaciones();
  wireEventosPresupuestos();
  wireEventosObjetivos();
  wireEventosVivienda();
  wireEventosHitos();
  wireEventosComunidad();
}

init();
