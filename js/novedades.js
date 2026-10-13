// Novedades de la app que salen en «Notificaciones». Cada cambio que se publica lleva una entrada aquí
// con el texto que escribe Paula, tal cual. Mientras «texto» esté vacío, la novedad no se muestra.
// Para añadir una: copia una entrada, pon un id nuevo que no se repita, la fecha (AAAA-MM-DD), el título,
// el texto y, si quieres, la pestaña a la que lleva al tocarla (tab). Las más recientes, arriba.
// En catalán e inglés se ven traducidos: el título y el texto, tal cual, van como clave en
// js/i18n/ca.js y js/i18n/en.js con su traducción (si no están, salen en español).
const NOVEDADES = [
  // { id:"ejemplo", fecha:"2026-10-01", tab:"Inicio", titulo:"", texto:"" },
  // El texto admite líneas que empiezan por «- » (lista) y **negrita**.
  { id:"testers-octubre", fecha:"2026-10-13", tab:"", titulo:"Novedades de PocketZ", texto:`Hola hola mi gente <3 👋

He decidido hacer una actualización un pelín grande 🎉, tanto sugerencias y fallos que habéis encontrado vosotros 🐞 como ideas que tenia en mente 💡. Los cambios son los siguientes: ✨
- 💬 **Soporte:** ahora ves en qué estado está cada mensaje que nos envías y puedes mandar varios seguidos. 📨
- 🚦 **¿Cómo estoy?:** el semáforo se actualiza al momento, sin tener que salir y volver a entrar. ⚡
- ⚙️ **Preferencias:** tus ajustes se guardan en tu cuenta y ya no se cambian solos. 🔒
- 📊 **Presupuestos:** cuando gastas el 100 % de un presupuesto, te avisamos de que está agotado. 🔔
- 🏷️ **Categorías:** las cuentas nuevas empiezan sin categorías repetidas, y los gastos se ordenan en Imprescindible y Prescindible. 🧹
- 🔄 **Remanente:** función innecesaria cambiada por completo, ahora cuando empiece nuevo mes y te haya sobrado algo de dinero o al contrario, podrás decidir si reflejarlo en el mes y empezar con menos o mas de gasto. 💸
- ↩️ **Botón Atrás:** ahora te lleva a la pantalla anterior en lugar de cerrar la app. 🙌
- 🔢 **Importes:** los porcentajes y las cantidades usan el mismo separador decimal. ✅
- 🚪 **Cerrar sesión:** te pedimos confirmación antes de salir, para que no lo pulses sin querer. 😉

Gracias a todos los que me habéis ayudado a mejorar estos detalles, todo esto es gracias a vosotros. 💖` },
  { id:"simuladores-premium", fecha:"2026-10-04", tab:"Vivienda",  titulo:"", texto:"" },
  { id:"menu-reorganizado", fecha:"2026-10-04", tab:"Inicio",      titulo:"", texto:"" },
  { id:"separador-miles", fecha:"2026-10-04", tab:"",           titulo:"", texto:"" },
  { id:"cambiar-aportacion", fecha:"2026-10-01", tab:"Comunidad", titulo:"", texto:"" },
  { id:"bienvenida",      fecha:"2026-10-01", tab:"",             titulo:"", texto:"" },
  { id:"medidor-contrasena", fecha:"2026-10-01", tab:"", titulo:"", texto:"" },
  { id:"saldo-mes-pasado", fecha:"2026-10-01", tab:"Inicio",      titulo:"", texto:"" },
  { id:"vibracion-sonido", fecha:"2026-10-01", tab:"Preferencias", titulo:"", texto:"" },
  { id:"moneda",          fecha:"2026-10-01", tab:"Preferencias", titulo:"", texto:"" },
  { id:"eliminar-cuenta", fecha:"2026-10-01", tab:"Preferencias", titulo:"", texto:"" },
  { id:"privacidad",      fecha:"2026-10-01", tab:"",             titulo:"", texto:"" },
  { id:"permitir",        fecha:"2026-09-30", tab:"Permitir",     titulo:"", texto:"" },
  { id:"salud",           fecha:"2026-09-30", tab:"Salud",        titulo:"", texto:"" },
  { id:"vivienda",        fecha:"2026-09-30", tab:"Vivienda",     titulo:"", texto:"" },
  { id:"simulador",       fecha:"2026-09-30", tab:"Simulador",    titulo:"", texto:"" },
  { id:"hitos",           fecha:"2026-09-30", tab:"Hitos",        titulo:"", texto:"" },
  { id:"cierre-mes",      fecha:"2026-09-30", tab:"Resumen del mes", titulo:"", texto:"" },
  { id:"huchas",          fecha:"2026-09-30", tab:"Objetivos",    titulo:"", texto:"" },
  { id:"deudas-bizum",    fecha:"2026-09-30", tab:"Deudas",       titulo:"", texto:"" },
  { id:"cuentas-borrar",  fecha:"2026-09-30", tab:"Cuentas",      titulo:"", texto:"" },
  { id:"estrella-premium",fecha:"2026-09-30", tab:"Inicio",       titulo:"", texto:"" },
  { id:"sin-registro",    fecha:"2026-09-30", tab:"",             titulo:"", texto:"" },
];
