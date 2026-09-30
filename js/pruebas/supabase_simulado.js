// Supabase simulado en memoria para las pruebas (sustituye a supabase-js del CDN).
// Cada consulta respeta el tope de 1000 filas del Supabase real.
// Parámetros de la URL: ?vacia=1 arranca sin datos; ?resumen=0 simula que falta la RPC de resumen; ?sinsesion=1 arranca sin sesión;
// ?premium=0 usuario sin premium; ?compartida=1 añade la cuenta «Piso» que otro usuario (u2) comparte con este.
// Acceso: la contraseña buena es "secreta123". window.__auth guarda las llamadas de acceso.
// Desde la página: window.__db (los datos), window.__fallarEn = "tabla" (hace fallar los insert en esa tabla).
(function(){
  const MAX = 1000;
  const url = new URL(location.href);
  const conResumen = url.searchParams.get("resumen")!=="0";
  const db = window.__db = {
    cuentas:[{id:"c1", nombre:"Banco", saldo_inicial:1000, orden:1, archivada:false},{id:"c2", nombre:"Vieja", saldo_inicial:50, orden:2, archivada:false},{id:"c3", nombre:"Vacia", saldo_inicial:0, orden:3, archivada:false}],
    movimientos:[], deudas:[], inversiones:[], aportaciones_inversion:[], retiros_inversion:[],
    categorias:[{id:"k1", tipo:"gasto", padre:"Imprescindible", nombre:"Comida"},{id:"k2", tipo:"gasto", padre:"Prescindible", nombre:"Ocio"},{id:"k3", tipo:"ingreso", padre:null, nombre:"Nómina"}],
    presupuestos:[{id:"p1", categoria:"Comida", limite:300, rollover:false},{id:"p2", categoria:"Ocio", limite:100, rollover:false}],
    recurrentes:[{id:"r1", tipo:"gasto", categoria:"Comida", importe:10, cuenta_id:"c1", dia_mes:1, activo:true, fecha_inicio:"2026-01-01", ultima_generada:"2026-09-01"}],
    objetivos:[], hitos:[], salud_config:[], movimientos_pendientes:[], preferencias:[], cuentas_miembros:[], comunidad:[]
  };
  const usuarios = {"ana@x.com":"u2", "p@x.com":"u1"};
  const hoy = new Date(); const y = hoy.getFullYear(), mAct = hoy.getMonth()+1;
  const f = (yy,mm,dd)=>`${yy}-${String(mm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`;
  let n = 0;
  // 2500 gastos de 1 € en el año actual (supera el tope de 1000) + histórico antiguo.
  for(let i=0;i<2500;i++) db.movimientos.push({id:"m"+(n++), tipo:"gasto", categoria:"Comida", importe:0.1, fecha:f(y, 1+(i%mAct), 1+(i%27)), nota:"x", cuenta_id:"c1"});
  db.movimientos.push({id:"m"+(n++), tipo:"ingreso", categoria:"Nómina", importe:2000, fecha:f(y,mAct,1), cuenta_id:"c1"});
  db.movimientos.push({id:"m"+(n++), tipo:"ingreso", categoria:"Nómina", importe:1000, fecha:f(mAct===1?y-1:y, mAct===1?12:mAct-1, 1), cuenta_id:"c1"});
  db.movimientos.push({id:"m"+(n++), tipo:"gasto", categoria:"Ocio", importe:90, fecha:f(y,mAct,2), cuenta_id:"c1"});
  db.movimientos.push({id:"m"+(n++), tipo:"gasto", categoria:"Ocio", importe:5, fecha:f(y-3,5,2), cuenta_id:"c2"});
  db.movimientos.push({id:"mg", tipo:"gasto", categoria:"Ocio", importe:40, fecha:f(y,mAct,3), nota:"cena", cuenta_id:"c1"});
  db.movimientos.push({id:"mr", tipo:"ingreso", categoria:"Ocio", importe:10, fecha:f(y,mAct,4), nota:"devuelto", cuenta_id:"c1", reembolso_de:"mg"});
  db.movimientos.push({id:"ma", tipo:"gasto", categoria:"Inversión", importe:200, fecha:f(y,mAct,5), cuenta_id:"c1"});
  db.deudas.push({id:"d1", persona:"Ana", importe:15, importe_inicial:15, direccion:"me_deben", concepto:"cena", estado:"pendiente", fecha:f(y,mAct,3), movimiento_id:"mg"});
  db.inversiones.push({id:"g1", nombre:"Fondos", tipo:"", valor_actual:0, valor_inicial:0, estado:"activa", es_grupo:true, orden:1});
  db.inversiones.push({id:"i1", nombre:"Indexado", tipo:"fondo", valor_actual:1200, valor_inicial:1000, estado:"activa", es_grupo:false, padre_id:"g1", orden:1});
  db.aportaciones_inversion.push({id:"a1", inversion_id:"i1", importe:200, fecha:f(y,mAct,5), cuenta_id:"c1", movimiento_id:"ma"});
  db.objetivos.push({id:"o1", nombre:"Colchón", meta:5000, tipo_vinculo:"cuenta", vinculo_id:"c1", orden:1});
  if(url.searchParams.get("compartida")==="1"){
    db.cuentas.push({id:"c4", nombre:"Piso", saldo_inicial:100, orden:4, archivada:false, user_id:"u2"});
    db.cuentas_miembros.push({cuenta_id:"c4", user_id:"u1", email:"p@x.com", propietario_id:"u2", propietario_email:"ana@x.com"});
    db.movimientos.push({id:"mp1", tipo:"gasto", categoria:"Luz", importe:60, fecha:f(y,mAct,6), cuenta_id:"c4", user_id:"u2"});
  }
  if(url.searchParams.get("vacia")==="1") Object.keys(db).forEach(k=>{ db[k] = []; });
  window.__queries = [];

  class Q {
    constructor(t){ this.t=t; this.op="select"; this.filters=[]; this.ord=[]; this.rng=null; this.opts={}; }
    select(_c, opts){ if(this.op==="select") this.opts = opts||{}; return this; }
    insert(d){ this.op="insert"; this.data=Array.isArray(d)?d:[d]; return this; }
    update(d){ this.op="update"; this.data=d; return this; }
    upsert(d){ this.op="upsert"; this.data=d; return this; }
    delete(){ this.op="delete"; return this; }
    in(c,vs){ this.filters.push(r=>vs.map(String).includes(String(r[c]))); return this; }
    not(c,_op,_v){ this.filters.push(r=>r[c]!=null); return this; }
    eq(c,v){ this.filters.push(r=>String(r[c])===String(v)); return this; }
    gte(c,v){ this.filters.push(r=>r[c]>=v); return this; }
    order(c,o){ this.ord.push([c,(o&&o.ascending===false)?-1:1]); return this; }
    range(a,b){ this.rng=[a,b]; return this; }
    single(){ return this; }
    then(res, rej){ return Promise.resolve(this.run()).then(res, rej); }
    run(){
      const tabla = db[this.t];
      if(!tabla) return {data:null, error:{message:`relation "public.${this.t}" does not exist`}};
      const match = tabla.filter(r=>this.filters.every(fn=>fn(r)));
      if(this.op==="select"){
        window.__queries.push(this.t);
        if(this.opts.head) return {data:null, count:match.length, error:null};
        let out = [...match];
        out.sort((a,b)=>{ for(const [c,d] of this.ord){ if(a[c]<b[c]) return -d; if(a[c]>b[c]) return d; } return 0; });
        const [a,b] = this.rng || [0, MAX-1];
        return {data: out.slice(a, Math.min(b+1, a+MAX)), error:null};
      }
      if(this.op==="insert"){
        if(window.__fallarEn===this.t) return {error:{message:"fallo simulado"}};
        if(this.data.some(d=>d.id && tabla.some(r=>r.id===d.id))) return {error:{message:"duplicate key"}};
        this.data.forEach(d=>tabla.push({id:"n"+(n++), ...d})); return {data:null, error:null}; }
      if(this.op==="update"){
        if(this.t==="cuentas" && "archivada" in this.data && window.__sinColumna) return {error:{message:'column "archivada" does not exist'}};
        match.forEach(r=>Object.assign(r, this.data)); return {data:null, error:null};
      }
      if(this.op==="delete"){ db[this.t] = tabla.filter(r=>!match.includes(r)); return {error:null}; }
      if(this.op==="upsert"){ db[this.t] = [this.data]; return {error:null}; }
    }
  }
  const listeners = [];
  const USUARIOS = {"p@x.com":{id:"u1", email:"p@x.com", user_metadata:{full_name:"Paula"}}, "ana@x.com":{id:"u2", email:"ana@x.com", user_metadata:{full_name:"Ana"}}};
  const usuario = USUARIOS["p@x.com"];
  // La sesión se guarda en localStorage como hace supabase-js, para poder cambiar de perfil y recargar.
  const CLAVE = "sb-simulado-auth-token";
  const sesionDe = u=>({user:u, access_token:"at-"+u.id, refresh_token:"rt-"+u.id+"-"+Date.now(), expires_at:9999999999});
  const persistir = ()=>{ if(session) localStorage.setItem(CLAVE, JSON.stringify(session)); else localStorage.removeItem(CLAVE); };
  let session = null;
  try{ session = JSON.parse(localStorage.getItem(CLAVE)); }catch(e){}
  if(!session && url.searchParams.get("sinsesion")!=="1" && !localStorage.getItem("__visto")) session = sesionDe(usuario);
  localStorage.setItem("__visto", "1");
  persistir();
  const auth = window.__auth = [];
  const avisar = ev=>listeners.forEach(fn=>fn(ev, session));
  window.supabase = { createClient(){ return {
    from:t=>new Q(t),
    rpc: async (name, a)=>{
      if(name==="es_premium") return {data:url.searchParams.get("premium")!=="0", error:null};
      if(name==="compartir_cuenta"){
        if(url.searchParams.get("premium")==="0") return {data:null, error:{message:"Compartir cuentas es una función premium"}};
        const otro = usuarios[a.p_email.toLowerCase()];
        if(!otro) return {data:null, error:{message:"Ese email no tiene cuenta en la app. Pídele que se registre primero."}};
        db.cuentas_miembros.push({cuenta_id:a.p_cuenta, user_id:otro, email:a.p_email.toLowerCase(), propietario_id:"u1", propietario_email:"p@x.com"});
        return {data:null, error:null};
      }
      if(name==="dejar_de_compartir"){
        const m = db.cuentas_miembros.find(x=>x.cuenta_id===a.p_cuenta && x.user_id===a.p_user);
        if(!m) return {data:null, error:null};
        db.cuentas_miembros = db.cuentas_miembros.filter(x=>x!==m);
        // Sin RLS: se simula que la cuenta deja de verse si el que sale es este usuario.
        if(a.p_user==="u1"){ db.cuentas = db.cuentas.filter(c=>c.id!==a.p_cuenta); db.movimientos = db.movimientos.filter(x=>x.cuenta_id!==a.p_cuenta); }
        return {data:null, error:null};
      }
      if(name==="resumen_movimientos_mensual" && conResumen){
        const g = {};
        db.movimientos.forEach(m=>{ const k = m.cuenta_id+"|"+m.fecha.slice(0,7)+"-01"; g[k] = g[k] || {cuenta_id:m.cuenta_id, mes:m.fecha.slice(0,7)+"-01", ingresos:0, gastos:0, n:0}; g[k][m.tipo==="ingreso"?"ingresos":"gastos"] += m.importe; g[k].n++; });
        return {data:Object.values(g), error:null};
      }
      if(name.startsWith("procesar_")) return {data:null, error:null};
      return {data:null, error:{code:"PGRST202", message:"not found"}};
    },
    auth:{
      getSession: async ()=>({data:{session}}),
      onAuthStateChange: fn=>{ listeners.push(fn); },
      storageKey: CLAVE,
      signOut: async ()=>{ session = null; persistir(); window.__salio = true; listeners.forEach(fn=>fn("SIGNED_OUT", null)); },
      updateUser: async (d)=>{ auth.push(["updateUser", d]); return {data:{user:session.user}, error:null}; },
      signInWithPassword: async ({email, password})=>{
        auth.push(["signInWithPassword", email]);
        if(password!=="secreta123" || !USUARIOS[email]) return {data:{}, error:{message:"Invalid login credentials"}};
        session = sesionDe(USUARIOS[email]); persistir(); avisar("SIGNED_IN"); return {data:{session}, error:null};
      },
      signUp: async (d)=>{ auth.push(["signUp", d]); return {data:{user:{id:"u2", identities:[{}]}, session:null}, error:null}; },
      resetPasswordForEmail: async (email, o)=>{ auth.push(["resetPasswordForEmail", email, o]); return {error:null}; }
    },
    channel(){ const c = {on(){ return c; }, subscribe(){ return c; }}; return c; }
  }; } };
})();
