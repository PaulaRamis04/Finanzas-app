// Idioma de la app: español (el original), català o English.
// La primera vez se elige según el idioma del dispositivo (si no es catalán ni inglés, español).
// La elección se guarda en este dispositivo y se cambia en Preferencias.
// Los textos se escriben en español en el código; js/i18n/<idioma>.js trae su traducción.
const IDIOMAS = {es:"Español", ca:"Català", en:"English"};
const LOCALES = {es:"es-ES", ca:"ca-ES", en:"en-GB"};
const TRADUCCIONES = {};
const idioma = (()=>{
  let guardado = null; try{ guardado = localStorage.getItem("idioma"); }catch(e){}
  if(IDIOMAS[guardado]) return guardado;
  let elegido = "es";
  for(const l of navigator.languages || [navigator.language || ""]){
    const c = String(l).slice(0,2).toLowerCase();
    if(IDIOMAS[c]){ elegido = c; break; }
  }
  try{ localStorage.setItem("idioma", elegido); }catch(e){}
  return elegido;
})();
document.documentElement.lang = idioma;
// Las páginas sueltas (privacidad, eliminar cuenta) traen su propio texto en cada idioma: no cargan el diccionario.
if(idioma!=="es" && !document.currentScript?.hasAttribute("data-solo-idioma")) document.write(`<script src="js/i18n/${idioma}.js"><\/script>`);

function fijarIdioma(i){
  if(!IDIOMAS[i] || i===idioma) return;
  try{ localStorage.setItem("idioma", i); }catch(e){}
  location.reload();
}
// Formato de fechas según el idioma («2 de octubre», «2 d'octubre», «2 October»).
function localeApp(){ return LOCALES[idioma]; }
