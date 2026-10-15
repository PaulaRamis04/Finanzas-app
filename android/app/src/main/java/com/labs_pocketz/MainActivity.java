package com.labs_pocketz;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

import java.io.OutputStream;

/**
 * PocketZ como app Android: carga la web dentro de un WebView propio
 * (antes era una TWA que abría la web en Chrome).
 */
public class MainActivity extends Activity {

    private static final String URL_INICIO = "https://paularamis04.github.io/Finanzas-app/";
    private static final String HOST = "paularamis04.github.io";
    private static final String RUTA = "/Finanzas-app";

    private static final int PEDIR_ARCHIVO = 1;
    private static final int GUARDAR_ARCHIVO = 2;

    // Ajustes que la web necesita y el WebView no trae: descargas de blobs y compartir texto
    private static final String PUENTE_JS =
        "(function(){if(window.__pocketz)return;window.__pocketz=1;" +
        "var A=window.PocketZAndroid,blobs={},crear=URL.createObjectURL,revocar=URL.revokeObjectURL;" +
        "URL.createObjectURL=function(o){var u=crear.call(URL,o);if(o instanceof Blob)blobs[u]=o;return u;};" +
        "URL.revokeObjectURL=function(u){setTimeout(function(){delete blobs[u];revocar.call(URL,u);},60000);};" +
        "function guardar(b,nombre){var fr=new FileReader();fr.onload=function(){var s=fr.result;" +
        "A.guardarArchivo(nombre||'archivo',b.type||'application/octet-stream',s.substring(s.indexOf(',')+1));};fr.readAsDataURL(b);}" +
        "var clic=HTMLAnchorElement.prototype.click;" +
        "HTMLAnchorElement.prototype.click=function(){var h=this.href||'';" +
        "if(this.hasAttribute('download')&&(h.indexOf('blob:')===0||h.indexOf('data:')===0)){var n=this.getAttribute('download');" +
        "if(blobs[h])guardar(blobs[h],n);else fetch(h).then(function(r){return r.blob();}).then(function(b){guardar(b,n);});return;}" +
        "return clic.apply(this,arguments);};" +
        "if(!navigator.share){navigator.share=function(d){d=d||{};" +
        "if(d.files&&d.files.length)return Promise.reject(new DOMException('No disponible','NotAllowedError'));" +
        "A.compartirTexto([d.title,d.text,d.url].filter(Boolean).join('\\n'));return Promise.resolve();};}" +
        "})();";

    // Atrás dentro de la web: cierra el menú, vuelve a la sección o a Inicio; solo sale de la app desde Inicio
    private static final String ATRAS_JS =
        "(function(){try{" +
        "var m=document.getElementById('menuPanel');" +
        "if(m&&m.classList.contains('open')&&typeof closeMenu==='function'){closeMenu();return 'ok';}" +
        "var v=document.querySelector('.volver-seccion');if(v){v.click();return 'ok';}" +
        "if(typeof tab!=='undefined'&&tab!=='Inicio'&&typeof render==='function'){tab='Inicio';render();window.scrollTo(0,0);return 'ok';}" +
        "}catch(e){}return 'salir';})()";

    private WebView web;
    private ValueCallback<Uri[]> esperaArchivo;
    private byte[] pendienteDatos;

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);

        // Barra superior del color de la app y la web debajo, sin solaparse con las barras del sistema
        LinearLayout raiz = new LinearLayout(this);
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setBackgroundColor(Color.parseColor("#FDF7F2"));
        View barra = new View(this);
        barra.setBackgroundColor(Color.parseColor("#F07F76"));
        raiz.addView(barra, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0));

        web = new WebView(this);
        raiz.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(raiz);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            raiz.setOnApplyWindowInsetsListener((v, insets) -> {
                android.graphics.Insets b = insets.getInsets(
                    android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.ime());
                android.graphics.Insets s = insets.getInsets(android.view.WindowInsets.Type.statusBars());
                barra.getLayoutParams().height = s.top;
                barra.requestLayout();
                v.setPadding(b.left, 0, b.right, b.bottom);
                return android.view.WindowInsets.CONSUMED;
            });
        }

        WebSettings ajustes = web.getSettings();
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true);
        ajustes.setDatabaseEnabled(true);
        ajustes.setAllowFileAccess(false);
        ajustes.setMediaPlaybackRequiresUserGesture(false);
        // La web lee la versión de la app para avisar si hay que actualizarla (js/aviso-app.js)
        ajustes.setUserAgentString(ajustes.getUserAgentString() + " PocketZAndroid/" + versionApp());
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);

        web.addJavascriptInterface(new Puente(), "PocketZAndroid");
        web.setWebViewClient(new Cliente());
        web.setWebChromeClient(new Chrome());
        web.setDownloadListener((url, ua, disposicion, tipo, largo) -> abrirFuera(Uri.parse(url)));

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::atras);
        }

        if (estado != null) {
            web.restoreState(estado);
        } else {
            web.loadUrl(urlDe(getIntent()));
        }
    }

    private long versionApp() {
        try {
            android.content.pm.PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
        } catch (Exception e) {
            return 0;
        }
    }

    private String urlDe(Intent intent) {
        Uri datos = intent != null ? intent.getData() : null;
        return datos != null && esNuestra(datos) ? datos.toString() : URL_INICIO;
    }

    private static boolean esNuestra(Uri uri) {
        String ruta = uri.getPath() == null ? "" : uri.getPath();
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && ruta.startsWith(RUTA);
    }

    private void abrirFuera(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "No hay ninguna app para abrir este enlace", Toast.LENGTH_SHORT).show();
        }
    }

    private void atras() {
        if (web.canGoBack()) {
            web.goBack();
            return;
        }
        web.evaluateJavascript(ATRAS_JS, resultado -> {
            if (!"\"ok\"".equals(resultado)) finish();
        });
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        atras();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent.getData() != null && esNuestra(intent.getData())) web.loadUrl(intent.getData().toString());
    }

    @Override
    protected void onSaveInstanceState(Bundle estado) {
        super.onSaveInstanceState(estado);
        web.saveState(estado);
    }

    @Override
    protected void onActivityResult(int peticion, int resultado, Intent datos) {
        super.onActivityResult(peticion, resultado, datos);
        if (peticion == PEDIR_ARCHIVO && esperaArchivo != null) {
            esperaArchivo.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultado, datos));
            esperaArchivo = null;
        } else if (peticion == GUARDAR_ARCHIVO) {
            byte[] bytes = pendienteDatos;
            pendienteDatos = null;
            if (resultado != RESULT_OK || datos == null || datos.getData() == null || bytes == null) return;
            try (OutputStream salida = getContentResolver().openOutputStream(datos.getData())) {
                salida.write(bytes);
                Toast.makeText(this, "Archivo guardado", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, "No se pudo guardar el archivo", Toast.LENGTH_SHORT).show();
            }
        }
    }

    private class Cliente extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView vista, WebResourceRequest peticion) {
            Uri uri = peticion.getUrl();
            if (esNuestra(uri)) return false;
            abrirFuera(uri);
            return true;
        }

        @Override
        public void onPageFinished(WebView vista, String url) {
            vista.evaluateJavascript(PUENTE_JS, null);
        }

        @Override
        public void onReceivedError(WebView vista, WebResourceRequest peticion, WebResourceError error) {
            if (!peticion.isForMainFrame()) return;
            String html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head>"
                + "<body style='font-family:sans-serif;background:#FDF7F2;color:#333;text-align:center;padding:40px 24px'>"
                + "<h2>Sin conexión</h2><p>PocketZ necesita internet para cargar tus datos.</p>"
                + "<p><a href='" + URL_INICIO + "' style='display:inline-block;padding:12px 24px;border-radius:24px;"
                + "background:#F07F76;color:#fff;text-decoration:none'>Reintentar</a></p></body></html>";
            vista.loadDataWithBaseURL(URL_INICIO, html, "text/html", "utf-8", URL_INICIO);
        }
    }

    private class Chrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView vista, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (esperaArchivo != null) esperaArchivo.onReceiveValue(null);
            esperaArchivo = callback;
            try {
                startActivityForResult(params.createIntent(), PEDIR_ARCHIVO);
            } catch (ActivityNotFoundException e) {
                esperaArchivo = null;
                return false;
            }
            return true;
        }
    }

    /** Lo que la web puede pedirle a la app. */
    private class Puente {
        @JavascriptInterface
        public void guardarArchivo(String nombre, String tipo, String base64) {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            runOnUiThread(() -> {
                pendienteDatos = bytes;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType(tipo)
                    .putExtra(Intent.EXTRA_TITLE, nombre);
                try {
                    startActivityForResult(intent, GUARDAR_ARCHIVO);
                } catch (ActivityNotFoundException e) {
                    pendienteDatos = null;
                    Toast.makeText(MainActivity.this, "No se pudo guardar el archivo", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void compartirTexto(String texto) {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, texto);
                startActivity(Intent.createChooser(intent, "Compartir"));
            });
        }
    }
}
