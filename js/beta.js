// Modo beta: la app se puede probar sin cuenta. Sustituye a supabase-js por un Supabase local que
// guarda todo en este navegador (localStorage), con datos de ejemplo y todas las opciones premium.
// Se entra con ?beta=1 o con «Probar sin cuenta» en la pantalla de acceso; se sale con «Salir de la beta»
// o «Cerrar sesión» (la sesión real que hubiera en el dispositivo sigue intacta).
const CLAVE_MODO_BETA = "modoBeta", CLAVE_DATOS_BETA = "betaDatos";
function entrarBeta(){
  try{ localStorage.setItem(CLAVE_MODO_BETA, "1"); }catch(e){}
  location.replace(location.pathname);
}
function salirBeta(){
  try{ localStorage.removeItem(CLAVE_MODO_BETA); localStorage.removeItem("cuentaDefecto"); }catch(e){}
  location.replace(location.pathname);
}
function reiniciarBeta(){
  try{ localStorage.setItem(CLAVE_DATOS_BETA, "{}"); localStorage.removeItem("cuentaDefecto"); }catch(e){}
  location.reload();
}
const MODO_BETA = (()=>{
  const p = new URLSearchParams(location.search).get("beta");
  try{
    if(p==="1") localStorage.setItem(CLAVE_MODO_BETA, "1");
    if(p==="0") localStorage.removeItem(CLAVE_MODO_BETA);
    return localStorage.getItem(CLAVE_MODO_BETA)==="1";
  }catch(e){ return p==="1"; }
})();

if(MODO_BETA) (function(){
  const nuevoId = ()=> (crypto.randomUUID ? crypto.randomUUID() : "b"+Date.now().toString(36)+Math.random().toString(36).slice(2));
  const hoyISO = ()=>{ const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  const fecha = (y,m,d)=>{ const f = new Date(y, m, 1); const ultimo = new Date(f.getFullYear(), f.getMonth()+1, 0).getDate();
    return `${f.getFullYear()}-${String(f.getMonth()+1).padStart(2,"0")}-${String(Math.min(d, ultimo)).padStart(2,"0")}`; };
  const redondear = n=>Math.round(n*100)/100;

  // Datos de ejemplo: dos cuentas y unos meses de movimientos (las categorías las crea la app al cargar).
  function datosEjemplo(){
    const hoy = new Date(), y = hoy.getFullYear(), m = hoy.getMonth(), dia = hoy.getDate();
    const db = {cuentas:[{id:"banco", nombre:"Banco", saldo_inicial:1200, orden:1, archivada:false},{id:"ahorro", nombre:"Ahorro", saldo_inicial:2500, orden:2, archivada:false}],
      movimientos:[], categorias:[], presupuestos:[{id:nuevoId(), categoria:"Comer", limite:200, rollover:false},{id:nuevoId(), categoria:"Salidas", limite:120, rollover:false}],
      recurrentes:[{id:"spotify", tipo:"gasto", categoria:"Suscripciones", importe:10.99, nota:"Spotify", cuenta_id:"banco", dia_mes:5, activo:true, fecha_inicio:fecha(y,m-3,1), ultima_generada:null}],
      deudas:[], inversiones:[{id:"fondo", nombre:"Fondo indexado", tipo:"fondo", valor_actual:1080, valor_inicial:1000, estado:"activa", es_grupo:false, orden:1}],
      aportaciones_inversion:[], retiros_inversion:[], objetivos:[{id:nuevoId(), nombre:"Viaje", meta:4000, tipo_vinculo:"cuenta", vinculo_id:"ahorro", orden:1}]};
    const gastos = [["Comer",4,32.5,"Súper"],["Comer",11,18.2,"Súper"],["Salidas",13,24,"Cena"],["Gasolina",9,55,""],["Comer",19,41.3,"Súper"],["Compras",21,35.9,"Ropa"],["Tomar algo",25,7.5,""]];
    for(let k=3; k>=0; k--){
      const mm = m-k;
      db.movimientos.push({id:nuevoId(), tipo:"ingreso", categoria:"Nómina", importe:1450, fecha:fecha(y,mm,1), nota:"", cuenta_id:"banco"});
      if(k>0) db.movimientos.push({id:nuevoId(), tipo:"gasto", categoria:"Transferencia", importe:200, fecha:fecha(y,mm,2), nota:"Ahorro", cuenta_id:"banco", transferencia_id:"t"+k},
        {id:nuevoId(), tipo:"ingreso", categoria:"Transferencia", importe:200, fecha:fecha(y,mm,2), nota:"Ahorro", cuenta_id:"ahorro", transferencia_id:"t"+k});
      gastos.forEach(([cat,d,imp,nota], i)=>{ if(k===0 && d>dia) return;
        db.movimientos.push({id:nuevoId(), tipo:"gasto", categoria:cat, importe:redondear(imp*(1+((k+i)%3)*0.15)), fecha:fecha(y,mm,d), nota, cuenta_id:"banco"}); });
    }
    const cena = db.movimientos.find(x=>x.categoria==="Salidas" && x.fecha.slice(0,7)===fecha(y,m,1).slice(0,7));
    db.deudas.push({id:nuevoId(), persona:"Ana", importe:12, importe_inicial:12, direccion:"me_deben", concepto:"Cena", estado:"pendiente", fecha:cena ? cena.fecha : hoyISO(), movimiento_id:cena ? cena.id : null});
    return db;
  }

  let db = null;
  try{ db = JSON.parse(localStorage.getItem(CLAVE_DATOS_BETA)); }catch(e){}
  if(!db || typeof db!=="object") db = datosEjemplo();
  const guardar = ()=>{ try{ localStorage.setItem(CLAVE_DATOS_BETA, JSON.stringify(db)); }catch(e){} };
  guardar();
  // Cualquier tabla existe (vacía) para que todas las pestañas funcionen como con el esquema completo.
  const tabla = t=> db[t] || (db[t] = []);

  class Consulta {
    constructor(t){ this.t=t; this.op="select"; this.filtros=[]; this.orden=[]; this.rango=null; this.opts={}; }
    select(_c, opts){ if(this.op==="select") this.opts = opts||{}; return this; }
    insert(d){ this.op="insert"; this.datos=Array.isArray(d)?d:[d]; return this; }
    update(d){ this.op="update"; this.datos=d; return this; }
    upsert(d, opts){ this.op="upsert"; this.datos=Array.isArray(d)?d:[d]; this.conflicto=(opts&&opts.onConflict)||"id"; return this; }
    delete(){ this.op="delete"; return this; }
    eq(c,v){ this.filtros.push(r=>String(r[c])===String(v)); return this; }
    in(c,vs){ const s = vs.map(String); this.filtros.push(r=>s.includes(String(r[c]))); return this; }
    not(c,_op,_v){ this.filtros.push(r=>r[c]!=null); return this; }
    gte(c,v){ this.filtros.push(r=>r[c]>=v); return this; }
    order(c,o){ this.orden.push([c,(o&&o.ascending===false)?-1:1]); return this; }
    range(a,b){ this.rango=[a,b]; return this; }
    single(){ return this; }
    then(ok, mal){ return Promise.resolve().then(()=>this.ejecutar()).then(ok, mal); }
    ejecutar(){
      const filas = tabla(this.t);
      const coinciden = filas.filter(r=>this.filtros.every(fn=>fn(r)));
      if(this.op==="select"){
        if(this.opts.head) return {data:null, count:coinciden.length, error:null};
        const out = coinciden.map(r=>({...r}));
        out.sort((a,b)=>{ for(const [c,d] of this.orden){ if(a[c]<b[c]) return -d; if(a[c]>b[c]) return d; } return 0; });
        const [a,b] = this.rango || [0, out.length-1];
        return {data:out.slice(a, b+1), error:null};
      }
      if(this.op==="insert"){
        if(this.datos.some(d=>d.id!=null && filas.some(r=>String(r.id)===String(d.id)))) return {data:null, error:{message:"duplicate key value violates unique constraint"}};
        this.datos.forEach(d=>filas.push({id:nuevoId(), ...d}));
      }
      if(this.op==="update") coinciden.forEach(r=>Object.assign(r, this.datos));
      if(this.op==="delete") db[this.t] = filas.filter(r=>!coinciden.includes(r));
      if(this.op==="upsert") this.datos.forEach(d=>{
        // Sin la clave en los datos (p. ej. user_id, que pone Supabase) la tabla es de una sola fila.
        const r = d[this.conflicto]!=null ? filas.find(x=>String(x[this.conflicto])===String(d[this.conflicto])) : filas[0];
        if(r) Object.assign(r, d); else filas.push({id:nuevoId(), ...d});
      });
      guardar();
      return {data:null, error:null};
    }
  }

  const porId = (t,id)=>tabla(t).find(r=>String(r.id)===String(id));
  const borrar = (t, fn)=>{ db[t] = tabla(t).filter(r=>!fn(r)); };
  const mov = d=>{ const m = {id:nuevoId(), nota:"", ...d}; tabla("movimientos").push(m); return m; };
  const saldo = id=>{ const c = porId("cuentas", id);
    return redondear(tabla("movimientos").filter(m=>m.cuenta_id===id).reduce((s,m)=>s+(m.tipo==="ingreso"?1:-1)*Number(m.importe), Number(c?.saldo_inicial||0))); };
  const noEncontrada = {data:null, error:{code:"PGRST202", message:"Could not find the function"}};
  const fallo = message=>({data:null, error:{message}});

  // Versión local de las funciones de Supabase (schema_*.sql) que usa la app.
  const RPC = {
    es_premium: ()=>true,
    procesar_recurrentes: ()=>{
      const hoy = hoyISO();
      tabla("recurrentes").filter(r=>r.activo).forEach(r=>{
        const ini = new Date(r.fecha_inicio+"T00:00:00");
        for(let i=0; i<240; i++){
          const f = fecha(ini.getFullYear(), ini.getMonth()+i, r.dia_mes);
          if(f>hoy) break;
          if(f<r.fecha_inicio || (r.ultima_generada && f<=r.ultima_generada)) continue;
          mov({tipo:r.tipo, categoria:r.categoria, importe:r.importe, fecha:f, nota:r.nota||"", cuenta_id:r.cuenta_id, recurrente_id:r.id});
          r.ultima_generada = f;
        }
      });
    },
    procesar_aportaciones_objetivos: ()=>null,
    crear_transferencia: a=>{
      const t = nuevoId(), base = {categoria:"Transferencia", importe:a.p_importe, fecha:a.p_fecha, nota:a.p_nota||"", transferencia_id:t};
      mov({...base, tipo:"gasto", cuenta_id:a.p_cuenta_origen});
      mov({...base, tipo:"ingreso", cuenta_id:a.p_cuenta_destino});
    },
    eliminar_transferencia: a=>borrar("movimientos", m=>m.transferencia_id===a.p_transferencia_id),
    ajustar_saldo_cuenta: a=>{
      const dif = redondear(a.p_saldo_real - saldo(a.p_cuenta_id));
      if(dif) mov({tipo:dif>0?"ingreso":"gasto", categoria:"Ajuste", importe:Math.abs(dif), fecha:hoyISO(), nota:"Ajuste de saldo", cuenta_id:a.p_cuenta_id});
    },
    aportar_inversion: a=>{
      const inv = porId("inversiones", a.p_inversion_id); if(!inv) return fallo("La inversión no existe");
      const m = mov({tipo:"gasto", categoria:"Inversión", importe:a.p_importe, fecha:hoyISO(), nota:inv.nombre, cuenta_id:a.p_cuenta_id});
      tabla("aportaciones_inversion").push({id:nuevoId(), inversion_id:inv.id, importe:a.p_importe, fecha:m.fecha, cuenta_id:a.p_cuenta_id, movimiento_id:m.id});
      inv.valor_actual = redondear(Number(inv.valor_actual) + a.p_importe);
    },
    rescatar_inversion: a=>{
      const inv = porId("inversiones", a.p_inversion_id); if(!inv) return fallo("La inversión no existe");
      if(a.p_importe > Number(inv.valor_actual)) return fallo("No puedes rescatar más de lo que vale la inversión");
      const m = mov({tipo:"ingreso", categoria:"Inversión", importe:a.p_importe, fecha:hoyISO(), nota:inv.nombre, cuenta_id:a.p_cuenta_id});
      tabla("retiros_inversion").push({id:nuevoId(), inversion_id:inv.id, importe:a.p_importe, fecha:m.fecha, cuenta_id:a.p_cuenta_id, movimiento_id:m.id});
      inv.valor_actual = redondear(Number(inv.valor_actual) - a.p_importe);
    },
    eliminar_aportacion: a=>{
      const ap = porId("aportaciones_inversion", a.p_aportacion_id); if(!ap) return;
      const inv = porId("inversiones", ap.inversion_id);
      if(inv) inv.valor_actual = redondear(Math.max(0, Number(inv.valor_actual) - ap.importe));
      borrar("movimientos", m=>m.id===ap.movimiento_id); borrar("aportaciones_inversion", x=>x===ap);
    },
    eliminar_retiro: a=>{
      const re = porId("retiros_inversion", a.p_retiro_id); if(!re) return;
      const inv = porId("inversiones", re.inversion_id);
      if(inv) inv.valor_actual = redondear(Number(inv.valor_actual) + re.importe);
      borrar("movimientos", m=>m.id===re.movimiento_id); borrar("retiros_inversion", x=>x===re);
    },
    eliminar_inversion: a=>{
      const ids = [a.p_inversion_id, ...tabla("inversiones").filter(i=>i.padre_id===a.p_inversion_id).map(i=>i.id)];
      const movs = [...tabla("aportaciones_inversion"), ...tabla("retiros_inversion")].filter(x=>ids.includes(x.inversion_id)).map(x=>x.movimiento_id);
      borrar("movimientos", m=>movs.includes(m.id));
      borrar("aportaciones_inversion", x=>ids.includes(x.inversion_id)); borrar("retiros_inversion", x=>ids.includes(x.inversion_id));
      borrar("inversiones", i=>ids.includes(i.id));
    },
    saldar_deuda: a=>{
      const d = porId("deudas", a.p_deuda_id); if(!d) return fallo("La deuda no existe");
      mov({tipo:d.direccion==="me_deben"?"ingreso":"gasto", categoria:a.p_categoria||"Deuda", importe:a.p_importe, fecha:hoyISO(), nota:d.persona+(d.concepto?" · "+d.concepto:""), cuenta_id:a.p_cuenta_id, deuda_id:d.id});
      d.importe = redondear(Math.max(0, Number(d.importe) - a.p_importe));
      if(!d.importe) d.estado = "saldado";
    },
    confirmar_pendiente: a=>RPC.confirmar_pendientes({p_ids:[a.p_id], p_categorias:[a.p_categoria]}),
    confirmar_pendientes: a=>{
      a.p_ids.forEach((id, i)=>{
        const p = porId("movimientos_pendientes", id); if(!p) return;
        mov({tipo:p.tipo, categoria:a.p_categorias[i], importe:p.importe, fecha:p.fecha, nota:p.descripcion||"", cuenta_id:p.cuenta_id, saldo_banco:p.saldo??null, conciliado:true});
        borrar("movimientos_pendientes", x=>x===p);
      });
    },
    compartir_cuenta: ()=>fallo("En la beta no se pueden compartir cuentas: para eso hace falta crear una cuenta."),
    dejar_de_compartir: ()=>null
  };

  const usuario = {id:"beta", email:"beta@sin-cuenta", user_metadata:{full_name:"Beta"}};
  const sesion = {user:usuario, access_token:"beta", expires_at:9999999999};
  window.supabase = { createClient(){ return {
    from: t=>new Consulta(t),
    rpc: async (nombre, args)=>{
      if(!RPC[nombre]) return noEncontrada;
      const r = RPC[nombre](args||{});
      if(r && r.error) return r;
      guardar();
      return {data:r ?? null, error:null};
    },
    auth: {
      storageKey: "sb-beta-auth-token",
      getSession: async ()=>({data:{session:sesion}}),
      onAuthStateChange: ()=>{},
      signOut: async ()=>salirBeta(),
      updateUser: async ()=>({data:{user:usuario}, error:null}),
      signInWithPassword: async ()=>({data:{}, error:{message:"Estás en la beta: sal de ella para entrar con tu cuenta."}}),
      signUp: async ()=>({data:{}, error:{message:"Estás en la beta: sal de ella para crear una cuenta."}}),
      resetPasswordForEmail: async ()=>({error:null})
    },
    channel(){ const c = {on(){ return c; }, subscribe(){ return c; }}; return c; }
  }; } };

  // Aviso fijo arriba de la app con las acciones de la beta.
  document.addEventListener("DOMContentLoaded", ()=>{
    const shell = document.getElementById("appShell"); if(!shell) return;
    const aviso = document.createElement("div");
    aviso.className = "aviso-beta"; aviso.id = "avisoBeta";
    aviso.innerHTML = `<span><b>Beta sin cuenta</b> · Todo se guarda solo en este navegador.</span>
      <span class="aviso-beta-btns"><button type="button" id="betaReiniciar">Empezar de cero</button><button type="button" id="betaSalir">Salir de la beta</button></span>`;
    shell.prepend(aviso);
    document.getElementById("betaReiniciar").onclick = ()=>{ if(confirm("¿Borrar todos los datos de la beta y empezar con la app vacía?")) reiniciarBeta(); };
    document.getElementById("betaSalir").onclick = salirBeta;
  });
})();
