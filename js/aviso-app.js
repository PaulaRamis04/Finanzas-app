// Aviso para actualizar la app de Android cuando la instalada es más antigua que la mínima.
// La web llega siempre nueva, pero la app (el .aab de Google Play) solo cambia si el usuario la actualiza.
// La app WebView dice su versión en el user agent («PocketZAndroid/5»); la v3 y v4 no ponían número
// y la antigua TWA abría la web en Chrome con referrer android-app://com.labs_pocketz.

// Súbela solo cuando esa versión ya esté publicada en Google Play.
const VERSION_ANDROID_MINIMA = 5;
const PAQUETE_ANDROID = "com.labs_pocketz";

function versionAndroid(){
  const m = navigator.userAgent.match(/PocketZAndroid(?:\/(\d+))?/);
  if(m) return m[1] ? Number(m[1]) : 4;
  try{
    if(document.referrer.startsWith("android-app://" + PAQUETE_ANDROID)) sessionStorage.setItem("appTWA", "1");
    if(sessionStorage.getItem("appTWA")) return 2;
  }catch(e){}
  return null; // navegador normal: no hay nada que actualizar
}

function enlaceActualizarApp(){
  const play = "https://play.google.com/store/apps/details?id=" + PAQUETE_ANDROID;
  // Desde la app WebView, market:// abre Google Play; desde Chrome (TWA), el intent con plan B a la web de Play.
  return /PocketZAndroid/.test(navigator.userAgent)
    ? "market://details?id=" + PAQUETE_ANDROID
    : "intent://details?id=" + PAQUETE_ANDROID + "#Intent;scheme=market;package=com.android.vending;S.browser_fallback_url=" + encodeURIComponent(play) + ";end";
}

async function avisoActualizarApp(){
  const v = versionAndroid();
  if(v === null || v >= VERSION_ANDROID_MINIMA) return;
  try{ if(sessionStorage.getItem("avisoAppVisto")) return; sessionStorage.setItem("avisoAppVisto", "1"); }catch(e){}
  const si = await confirmar("¿Actualizar PocketZ? Hay una versión nueva de la app en Google Play. Actualízala para que todo funcione bien.",
    {ok:"Actualizar ahora", no:"Ahora no", icono:"⬆️"});
  if(si) location.href = enlaceActualizarApp();
}

window.addEventListener("load", ()=>setTimeout(avisoActualizarApp, 1500));
