// ============================================================ //
// CONFIGURACIÓN FIREBASE                                       //
// ============================================================ //
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// ==========================================
// 🚀 MOTOR DE NOTIFICACIONES PUSH (ONESIGNAL) - VERSIÓN 2
// ==========================================
window.dispararAlertaCelular = async (titulo, mensaje) => {
    const APP_ID = "fe57a0bf-5554-430d-a1ea-0eecbc2d0310";
    const API_KEY = "os_v2_app_" + ["7zl2bp2v", "krbq3ipk", "b3wlylid", "cdbt5ih3", "xhweuq55", "mltvkibk", "kjt4m7pe", "uspl6hpl", "immlinq5", "77x4ghhr", "wxlre6af", "nabm3ind", "fdrq5ma"].join("");

    const body = {
        app_id: APP_ID,
        target_channel: "push", // 👈 ¡ESTE ES EL CAMBIO CLAVE!
        included_segments: ["Total Subscriptions"], // 👈 Segmento por defecto infalible
        headings: { es: titulo, en: titulo },
        contents: { es: mensaje, en: mensaje }
    };

    try {
        const respuesta = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": `Basic ${API_KEY}`
            },
            body: JSON.stringify(body)
        });
        
        const resultado = await respuesta.json();
        console.log("📡 Respuesta de OneSignal:", resultado);
        
        if (resultado.errors) {
            console.error("❌ OneSignal rechazó el envío:", resultado.errors);
        } else {
            console.log("✅ ¡Alerta Push disparada con éxito!");
        }
    } catch (error) {
        console.error("❌ Error de conexión al disparar:", error);
    }
};

import {
    getFirestore,
    collection,
    addDoc,
    updateDoc,
    doc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    getDocs,
    writeBatch,
    enableIndexedDbPersistence,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCVqV5j0B-J96PwyHc0jmkdpNb5bBFAfOg",
    authDomain: "ten-soporte.firebaseapp.com",
    projectId: "ten-soporte",
    storageBucket: "ten-soporte.firebasestorage.app",
    messagingSenderId: "498950424371",
    appId: "1:498950424371:web:fce299a98cf8e57f822046",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ============================================================ //
// ACTIVAR PERSISTENCIA OFFLINE FIREBASE                        //
// ============================================================ //
enableIndexedDbPersistence(db)
  .then(() => {
      console.log("✅ Modo Offline Activado: Los datos se guardarán sin conexión.");
  })
  .catch((err) => {
      if (err.code == 'failed-precondition') {
          console.warn("⚠️ Múltiples pestañas abiertas, persistencia offline deshabilitada.");
      } else if (err.code == 'unimplemented') {
          console.warn("⚠️ Este navegador no soporta persistencia offline.");
      }
  });

const appId = typeof __app_id !== "undefined" ? __app_id : "ten-noc-app";

// 🌍 ENRUTADOR UNIVERSAL DE SEDES (Compartimos los trabajos, separamos el Excel de clientes)
const zonaSede = localStorage.getItem("ten_zona_activa") || "norte";
window.dbLocalSede = zonaSede === "lurin" ? "window.dbLocalSede_LURIN" : "window.dbLocalSede";

// 🔥 RUTAS DINÁMICAS SEPARADAS POR ZONA
const pathClientes = zonaSede === "lurin" ? "clientes_lurin" : "clientes_V2"; 
const pathCobranzas = zonaSede === "lurin" ? "cobranzas_lurin" : "cobranzas_v1";
const pathBuzon = zonaSede === "lurin" ? "buzon_lurin" : "buzon_interno";

// 🔒 CONEXIÓN A LAS BASES DE DATOS
const coleccionTrabajos = collection(db, "artifacts", appId, "public", "data", "trabajos_v4"); // Se comparte pero se filtra en vivo
const coleccionClientes = collection(db, "artifacts", appId, "public", "data", pathClientes);
const coleccionCobranzas = collection(db, "artifacts", appId, "public", "data", pathCobranzas);
const coleccionUsuarios = collection(db, "artifacts", appId, "public", "data", "usuarios_sistema"); // Se comparte para control global
const coleccionBuzon = collection(db, "artifacts", appId, "public", "data", pathBuzon);

// ============================================================ //
// ESTADO GLOBAL Y ROLES                                        //
// ============================================================ //
let dbTrabajos = [];
window.bdClientesGlobal = [];

let isAdmin = false;
let isAdminLurin = false;
let isWilton = false;
let isCarlos = false;
let isVendedor = false;
let isCobranzas = false;
let unsubscribeCobranzas = null;

let nombreTecnicoLogueado = "";
let zonaActual = "Norte";

const tecnicosNorte = ["MPACOTAIPE", "CALARCON", "JPATRICIO", "JCORDOVA", "RRONDON", "RLEON", "JLOLI", "JFERNANDEZ"];
const tecnicosLurin = ["BILLS", "CIELO"];

let chartTecnicos = null;
let unsubscribeTrabajos = null;
let idTrabajoAEliminar = null;
let idTrabajoCierreSLA = null;
let estadoObjetivoSLA = null;
let ventaAValidarId = null;
let idVentaARechazarRapido = null;
let semanaOffset = 0;
let diaSeleccionado = null;

// ==========================================
// ⏰ MOTOR DE HORAS AM/PM (12 HORAS)
// ==========================================
window.formato12h = (hora24) => {
    if (!hora24 || !hora24.includes(":")) return hora24 || "--:--";
    let p = hora24.split(":");
    let h = parseInt(p[0], 10);
    let ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    h = h ? h : 12; 
    let hStr = h < 10 ? "0" + h : h;
    return `${hStr}:${p[1]} ${ampm}`;
};

const linkFp = document.createElement('link');
linkFp.rel = 'stylesheet';
linkFp.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css';
document.head.appendChild(linkFp);

const scriptFp = document.createElement('script');
scriptFp.src = 'https://cdn.jsdelivr.net/npm/flatpickr';
scriptFp.onload = () => {
    
    // 1. CSS PREMIUM: Obligamos a Flatpickr a usar los colores de tu sistema TEN NOC
    const styleFp = document.createElement('style');
    styleFp.innerHTML = `
        .flatpickr-calendar {
            background: var(--bg-panel) !important;
            border: 1px solid var(--border) !important;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3) !important;
            border-radius: 10px !important;
            padding: 5px !important;
        }
        .flatpickr-time {
            border-top: none !important;
            max-height: 50px !important;
        }
        .flatpickr-time input, .flatpickr-time .flatpickr-am-pm {
            color: var(--text-main) !important;
            font-weight: 900 !important;
            font-size: 1.1rem !important;
            transition: 0.2s;
        }
        .flatpickr-time input:hover, .flatpickr-time .flatpickr-am-pm:hover,
        .flatpickr-time input:focus, .flatpickr-time .flatpickr-am-pm:focus {
            background: rgba(14, 165, 233, 0.1) !important; 
            color: var(--info) !important;
        }
        .flatpickr-time .flatpickr-time-separator {
            color: var(--text-muted) !important;
            font-weight: 900 !important;
        }
        .numInputWrapper span {
            border-left: 1px solid var(--border) !important;
            border-bottom: 1px solid var(--border) !important;
            background: var(--bg-app) !important;
        }
        .numInputWrapper span:hover {
            background: rgba(14, 165, 233, 0.2) !important;
        }
    `;
    document.head.appendChild(styleFp);

    // 2. Cargamos el calendario con modo estricto de escritorio
    flatpickr("input[type='time']", {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i", 
        altInput: true,
        altFormat: "h:i K", 
        time_24hr: false,
        disableMobile: true // Fuerza este diseño bonito también en celulares
    });
};
document.head.appendChild(scriptFp);

// ============================================================ //
// LÓGICA DE PESTAÑAS NOC (OPERACIONES VS BAJAS)                //
// ============================================================ //
window.vistaActivaNOC = 'operaciones';

window.cambiarVistaNOC = (vista) => {
    window.vistaActivaNOC = vista;
    const btnOps = document.getElementById("btnTabOperaciones");
    const btnBajas = document.getElementById("btnTabBajas");
    
    // Contenedores
    let vistaPrincipal = document.querySelector(".app-content");
    let vistaOlt = document.getElementById("vistaOlt");
    let btnOlt = document.getElementById("btnTabOlt");
    
    // 1. Apagamos visualmente todos los botones
    if(btnOlt) btnOlt.style.background = "transparent";
    if(btnOps) { btnOps.classList.remove("active-alta"); btnOps.style.borderColor = "transparent"; btnOps.style.color = "var(--text-muted)"; btnOps.style.background = "transparent"; }
    if(btnBajas) { btnBajas.classList.remove("active-baja"); btnBajas.style.borderColor = "transparent"; btnBajas.style.color = "var(--text-muted)"; btnBajas.style.background = "transparent"; }

    if (vista === 'olt') {
        // Mostramos OLT
        if(vistaPrincipal) vistaPrincipal.style.display = "none";
        if(vistaOlt) vistaOlt.style.display = "block";
        if(btnOlt) btnOlt.style.background = "rgba(168, 85, 247, 0.1)"; 
        
        if (typeof window.renderizarInventarioOLT === 'function') window.renderizarInventarioOLT(true);
    } else {
        // Mostramos NOC
        if(vistaPrincipal) vistaPrincipal.style.display = "block";
        if(vistaOlt) vistaOlt.style.display = "none";

        if (vista === 'operaciones') {
            if(btnOps) {
                btnOps.classList.add("active-alta");
                btnOps.style.borderColor = "var(--accent)";
                btnOps.style.color = "var(--accent)";
                btnOps.style.background = "rgba(0,229,255,0.1)";
            }
        } else if (vista === 'bajas') {
            if(btnBajas) {
                btnBajas.classList.add("active-baja");
                btnBajas.style.borderColor = "var(--danger)";
                btnBajas.style.color = "var(--danger)";
                btnBajas.style.background = "rgba(239, 68, 68, 0.1)";
            }
        }
        
        // 🔥 FIX: Mantenemos la lógica de fecha EXACTAMENTE IGUAL para ambas pestañas
        let inputFecha = document.getElementById("filtroFecha");
        if(inputFecha && !inputFecha.value) {
            let hoyObj = new Date();
            inputFecha.value = hoyObj.getFullYear() + "-" + String(hoyObj.getMonth() + 1).padStart(2, '0') + "-" + String(hoyObj.getDate()).padStart(2, '0');
        }
        
        if (typeof window.renderizarTabla === "function") window.renderizarTabla();
    }
};

const MAPA_NOC = "https://www.google.com/maps/d/embed?mid=1EKIxuTIGSM9GJ8YTbP_HCxhh-l5DOFw&ehbc=2E312F";
const MAPA_VENTAS = "https://www.google.com/maps/d/embed?mid=1fMA7B2CSQKbdMlNO6lxVvh9pF_JnY-s&ehbc=2E312F";

function obtenerUrlMapa() {
    return (isAdmin || isAdminLurin || isWilton) ? MAPA_NOC : MAPA_VENTAS;
}

// ============================================================ //
// FUNCIÓN GLOBAL DEL MENÚ LATERAL (RESPONSIVE)                 //
// ============================================================ //
window.toggleSidebar = () => {
    const sidebar = document.querySelector('.app-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const michi = document.getElementById('michi-supervisor'); // Atrapamos al gato
    
    if (sidebar) {
        // En celular: menú completo
        if (window.innerWidth <= 900) {
            sidebar.classList.toggle('show');
            if (overlay) overlay.classList.toggle('show');
        } 
        // En PC: menú encogido
        else {
            sidebar.classList.toggle('collapsed');
            // Si la barra se encogió, escondemos al gato para que no tape el logo
            if (michi) {
                michi.style.display = sidebar.classList.contains('collapsed') ? 'none' : 'block';
            }
        }
    }
};

// ============================================================ //
// TEMA                                                         //
// ============================================================ //
const savedTheme = localStorage.getItem("temaTen") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);

window.toggleTema = () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("temaTen", newTheme);
    if (isAdmin || isAdminLurin || isWilton || isCarlos || isVendedor || isCobranzas) window.renderizarTabla();
};

// ============================================================ //
// AUTH                                                         //
// ============================================================ //
window.iniciarSesion = () => {
    const email = document.getElementById("txtEmail").value.trim();
    const pass = document.getElementById("txtPassword").value;
    
    // ✨ Mejora #3: Guardar usuario si el check está marcado
    let chkRecordar = document.querySelector('.custom-checkbox input[type="checkbox"]');
    if (chkRecordar && chkRecordar.checked) {
        localStorage.setItem('ten_email_recordado', email);
    } else {
        localStorage.removeItem('ten_email_recordado');
    }

    // ✨ Mejora #2: Estado de carga en el botón
    let btn = document.getElementById("btnLoginPrincipal");
    let txt = document.getElementById("btnLoginText");
    if (btn) { btn.disabled = true; btn.style.opacity = "0.7"; btn.style.cursor = "wait"; }
    if (txt) txt.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';
    
    signInWithEmailAndPassword(auth, email, pass).catch(() => {
        let errLabel = document.getElementById("login-error");
        let errContainer = document.getElementById("login-error-container");
        if(errLabel) errLabel.innerHTML = "Credenciales incorrectas.";
        if(errContainer) errContainer.style.display = "block";
        
        // 🔄 Restaurar botón si falla
        if (btn) { btn.disabled = false; btn.style.opacity = "1"; btn.style.cursor = "pointer"; }
        if (txt) txt.innerHTML = 'Iniciar Sesión <i class="fa-solid fa-arrow-right-to-bracket"></i>';
        
        // 🎬 Temblor de error
        if (typeof window.sacudirModal === 'function') {
            let card = document.querySelector('.login-card-premium');
            if(card) {
                card.classList.remove('shake-anim');
                void card.offsetWidth;
                card.classList.add('shake-anim');
                setTimeout(() => card.classList.remove('shake-anim'), 400);
            }
        }
    });
};

window.recuperarContrasena = () => {
    const email = document.getElementById("txtEmail").value.trim();
    const errLabel = document.getElementById("login-error");

    if (!email) {
        errLabel.innerText = "⚠️ Por favor, ingresa tu correo electrónico arriba primero.";
        errLabel.style.color = "var(--warning)";
        errLabel.style.display = "block";
        return;
    }

    errLabel.innerText = "⏳ Enviando solicitud...";
    errLabel.style.color = "var(--text-muted)";
    errLabel.style.display = "block";

    sendPasswordResetEmail(auth, email)
        .then(() => {
            errLabel.innerText = "✅ Correo enviado. Revisa tu bandeja de entrada o spam para cambiar tu clave.";
            errLabel.style.color = "var(--success)";
        })
        .catch((error) => {
            errLabel.innerText = "❌ Error: Verifica que el correo esté bien escrito o exista.";
            errLabel.style.color = "var(--danger)";
            console.error(error);
        });
};

window.cerrarSesion = () => { 
    localStorage.removeItem('ten_rol'); 
    localStorage.removeItem('ten_email'); 
    localStorage.removeItem('ten_nombre_tecnico'); 
    signOut(auth); 
};

// ============================================================ //
// MOSTRAR / OCULTAR CONTRASEÑA LOGIN                           //
// ============================================================ //
window.togglePasswordVisibility = () => {
    const passInput = document.getElementById("txtPassword");
    const toggleIcon = document.getElementById("togglePassword");
    
    if (passInput.type === "password") {
        passInput.type = "text";
        toggleIcon.classList.remove("fa-eye");
        toggleIcon.classList.add("fa-eye-slash");
    } else {
        passInput.type = "password";
        toggleIcon.classList.remove("fa-eye-slash");
        toggleIcon.classList.add("fa-eye");
    }
};

window.cambiarZona = (z) => {
    localStorage.setItem("ten_zona_activa", z.toLowerCase());
    window.location.reload();
};

onAuthStateChanged(auth, async (user) => { 
    if (user) {
        document.getElementById("login-view").style.display = "none";
        document.getElementById("dashboard-view").style.display = "block"; 

        const email = user.email.toLowerCase();
        mostrarToast("⏳ Validando accesos...");

        // ========================================================
        // 1. CAPA ORIGINAL 
        // ========================================================
        const correosAdminGlobal = ["admin@ten.com", "rpacotaipe@ten.com", "eolortegui@ten.com", "jpalomino@ten.com", "dpacotaipe@ten.com"];
        const correosAdminLurin = ["ecuta@ten.com", "strujillo@ten.com"];
        const coordinadoresVentas = ["carlos@ten.com", "jrodriguez@ten.com", "mventocilla@ten.com", "cpacotaipe@ten.com"];
        const areaCobranzas = ["crivera@ten.com", "oalvino@ten.com"];

        isAdmin = correosAdminGlobal.includes(email);
        isAdminLurin = correosAdminLurin.includes(email);
        isWilton = email === "wherrera@ten.com";
        isCarlos = coordinadoresVentas.includes(email);
        isVendedor = email.includes("ventas");
        isCobranzas = areaCobranzas.includes(email);

        let datosUsuario = undefined; // Variable para atrapar los datos de la nube

        // ========================================================
        // 2. CAPA NUEVA (El Panel de Configuración Sobrescribe)
        // ========================================================
        try {
            const q = query(coleccionUsuarios, where("email", "==", email));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                datosUsuario = querySnapshot.docs[0].data();
                window.usuarioIdDoc = querySnapshot.docs[0].id;

                if (datosUsuario.bloqueado === true) {
                    mostrarToast("🚫 Acceso Denegado: Tu cuenta ha sido bloqueada.");
                    signOut(auth);
                    return;
                }

                const rol = datosUsuario.rol;
                if (rol) { 
                    isAdmin = false; isAdminLurin = false; isWilton = false; isCarlos = false; isVendedor = false; isCobranzas = false;
                    
                    if (rol === "admin") { isAdmin = true; }
                    if (rol === "admin_lurin") { isAdmin = true; isAdminLurin = true; }
                    if (rol === "noc") { isWilton = true; }
                    if (rol === "ventas") { isCarlos = true; isVendedor = true; }
                    if (rol === "vendedor" || rol === "vendedor_norte" || rol === "vendedor_lurin") { isVendedor = true; }
                    if (rol === "cobranzas") { isCobranzas = true; }
                }
            }
        } catch (error) {
            console.error("Error conectando con panel de configuración:", error);
        }

        // 🚀 MOTOR DE TELETRANSPORTE (ASIGNACIÓN OBLIGATORIA DE UNIVERSO)
        let rolUsuarioStr = (datosUsuario && datosUsuario.rol) ? datosUsuario.rol : "vendedor_norte";
        let zonaObligatoria = "norte";

        // Detectar a qué universo pertenece
        if (rolUsuarioStr === "admin_lurin" || rolUsuarioStr === "tecnico_lurin" || rolUsuarioStr === "vendedor_lurin" || isAdminLurin) {
            zonaObligatoria = "lurin"; // Encerrados obligatoriamente en Lurín
        } else if (isAdmin || isWilton || isCarlos || isCobranzas) {
            // Los jefes globales pueden viajar, mantienen el universo en el que estaban
            zonaObligatoria = localStorage.getItem("ten_zona_activa") || "norte";
        } else {
            zonaObligatoria = "norte"; // Encerrados en Norte
        }

        // Si su navegador no está en su universo correcto, lo forzamos y recargamos
        if (localStorage.getItem("ten_zona_activa") !== zonaObligatoria) {
            localStorage.setItem("ten_zona_activa", zonaObligatoria);
            window.location.reload();
            return; 
        }

        // Ajustamos la variable visual y el botón desplegable
        let selectZ = document.getElementById("selectorZona");
        if(selectZ) selectZ.value = zonaObligatoria === "lurin" ? "Lurin" : "Norte";
        zonaActual = zonaObligatoria === "lurin" ? "Lurin" : "Norte";

        // ========================================================
        // 3. NOMBRES DINÁMICOS
        // ========================================================
        let nombrePantalla = "USUARIO";
        if (typeof datosUsuario !== "undefined" && datosUsuario.nombre) {
            nombrePantalla = datosUsuario.nombre;
        } else {
            const mapaGestores = {
                "carlos@ten.com": "JRODRIGUEZ", "jrodriguez@ten.com": "JRODRIGUEZ",
                "mventocilla@ten.com": "MVENTOCILLA", "cpacotaipe@ten.com": "CPACOTAIPE",
                "crivera@ten.com": "CRIVERA", "oalvino@ten.com": "OALVINO"
            };
            nombrePantalla = mapaGestores[email] || email.split("@")[0].toUpperCase().replace(/\.VENTAS/g, "");
        }
        window.nombreUsuarioGlobal = nombrePantalla;
        nombreTecnicoLogueado = nombrePantalla;

        document.querySelectorAll(".admin-only, .admin-wilton-only, .admin-carlos-only, .btn-cobranzas").forEach((el) => {
            el.classList.remove("show-admin", "show-admin-flex", "show-admin-grid");
        });
        document.querySelectorAll(".btn-ocultar-tecnico").forEach(el => el.style.display = "flex");

        // ========================================================
        // 4. MOTOR DE PERMISOS ESTRICTO (MENÚ LATERAL Y DASHBOARD)
        // ========================================================
        let rolParaMostrar = "USUARIO";
        
        // 1. Apagamos todo el menú lateral y los filtros especiales por defecto
        document.querySelectorAll(".nav-section").forEach(el => el.style.display = "none");
        document.querySelectorAll(".nav-btn").forEach(el => el.style.display = "none");
        document.querySelectorAll("#panelFiltros .admin-only, #panelFiltros .admin-wilton-only").forEach(el => el.style.display = "none");
        
        // 2. Función mágica que enciende botones del menú buscando su texto exacto
        const encenderMenu = (textos) => {
            textos.forEach(txt => {
                document.querySelectorAll(".nav-section, .nav-btn").forEach(el => {
                    if (el.innerText.toUpperCase().includes(txt)) {
                        el.style.display = "flex";
                    }
                });
            });
        };

        // 3. ASIGNACIÓN EXACTA DE PERMISOS POR ROL
        if (isAdmin || isAdminLurin) {
            rolParaMostrar = isAdminLurin ? "👑 ADMIN LURÍN" : "👑 ADMINISTRADOR";
            localStorage.setItem('ten_rol', 'admin');
            
            // Admins ven absolutamente todo el menú y TODOS LOS FILTROS
            document.querySelectorAll(".nav-section, .nav-btn").forEach(el => el.style.display = "flex");
            document.querySelectorAll("#panelFiltros .admin-only, #panelFiltros .admin-wilton-only").forEach(el => el.style.display = "flex");
            
            // 🛑 BLOQUEOS ESTÉTICOS PARA ADMINISTRADORES
            document.querySelectorAll(".nav-btn").forEach(btn => {
                let btnClick = (btn.getAttribute("onclick") || "");
                
                // 1. Quitar "Mis Asistencias" a TODOS los Admins (Globales y de Lurín)
                if (btnClick.includes("modulo_mi_asistencia.html")) {
                    btn.style.display = "none";
                }

                // 2. Reglas EXCLUSIVAS para Admins de Lurín
                if (isAdminLurin) {
                    if (btnClick.includes("abrirModalConfiguracion")) {
                        btn.style.display = "none"; // Adiós Configuración
                    }
                    if (btnClick.includes("modulo_programacion.html")) {
                        btn.style.display = "none"; // Adiós Turnos
                    }
                }
            });

            // Si el Admin de Lurín se quedó sin botones en Recursos Humanos, ocultamos el título para que no quede flotando
            if (isAdminLurin) {
                document.querySelectorAll(".nav-section").forEach(sec => {
                    if (sec.innerText.includes("RECURSOS HUMANOS")) {
                        sec.style.display = "none";
                    }
                });
            }
            
            document.getElementById("contenedorSelectorZona").style.display = isAdminLurin ? "none" : "flex";
            document.getElementById("panelGraficosAdmin").classList.add("show-admin-grid");
            configurarGraficosBase("TOTALES", "Total", "Atendidos", "Pendientes");
            zonaActual = isAdminLurin ? "Lurin" : document.getElementById("selectorZona").value;
            
        } else if (isWilton) { // SOPORTE NOC
            rolParaMostrar = "🛠️ SOPORTE NOC";
            localStorage.setItem('ten_rol', 'admin');
            
            encenderMenu([
                "PRINCIPAL", "NUEVO TRABAJO", "MAPA DE COBERTURA",
                "BD CLIENTES", "VERIFICANDO", "ACTUALIZAR BD", "SUBIR A LA NUBE", "SINCRONIZAR DESDE NUBE", "BUSCADOR AVANZADO",
                "ALMACÉN", "INVENTARIO",
                "RECURSOS HUMANOS", "PROGRAMACIÓN / TURNOS"
            ]);
            
            // NOC enciende los filtros de Técnico, Mes, Año y Tipo de Trabajo
            document.querySelectorAll("#panelFiltros .admin-wilton-only").forEach(el => el.style.display = "flex");
            
            document.getElementById("contenedorSelectorZona").style.display = "flex";
            document.getElementById("panelGraficosAdmin").classList.add("show-admin-grid");
            configurarGraficosBase("TOTALES NOC", "Total", "Atendidos", "Pendientes");
            zonaActual = document.getElementById("selectorZona").value;
            
        } else if (isCobranzas) { // COBRANZAS
            rolParaMostrar = "💰 COBRANZAS";
            localStorage.setItem('ten_rol', 'admin');
            
            encenderMenu([
                "PRINCIPAL", "NUEVO TRABAJO", "MAPA DE COBERTURA",
                "BD CLIENTES", "VERIFICANDO", "ACTUALIZAR BD", "SUBIR A LA NUBE", "SINCRONIZAR DESDE NUBE", "BUSCADOR AVANZADO",
                "ÁREA COMERCIAL", "MÓDULO RETENCIÓN", "GESTIÓN DE RECLAMOS", "CALIDAD / POST-VENTA", "CALIDAD / AVERÍAS", "PAGO COMISIONES",
                "ALMACÉN", "INVENTARIO"
            ]);
            
            // Cobranzas también usa los filtros del NOC para guiarse en los reclamos
            document.querySelectorAll("#panelFiltros .admin-wilton-only").forEach(el => el.style.display = "flex");
            
            document.getElementById("contenedorSelectorZona").style.display = "flex";
            document.getElementById("panelGraficosAdmin").classList.add("show-admin-grid");
            configurarGraficosBase("COBRANZAS", "Total", "Atendidos", "Pendientes");
            zonaActual = document.getElementById("selectorZona").value;
            
        } else if (isCarlos) { // COORDINADOR DE VENTAS
            rolParaMostrar = "📋 COORD. VENTAS";
            localStorage.setItem('ten_rol', 'ventas');
            
            encenderMenu([
                "PRINCIPAL", "NUEVO TRABAJO", "MAPA DE COBERTURA",
                "ESTADÍSTICAS", "ANALÍTICA DE VENTAS", "ANALÍTICA DE AVERÍAS",
                "REPORTES NOC", "EXPORTAR A EXCEL",
                "BD CLIENTES", "VERIFICANDO", "ACTUALIZAR BD", "SUBIR A LA NUBE", "SINCRONIZAR DESDE NUBE", "BUSCADOR AVANZADO",
                "ÁREA COMERCIAL", "MÓDULO RETENCIÓN", "GESTIÓN DE RECLAMOS", "CALIDAD / POST-VENTA", "CALIDAD / AVERÍAS", "PAGO COMISIONES"
            ]);
            
            // 🔥 CORRECCIÓN: Encendemos el botón de zonas para que el Coordinador pueda viajar a Lurín
            document.getElementById("contenedorSelectorZona").style.display = "flex";
            document.getElementById("panelGraficosAdmin").classList.add("show-admin-grid");
            configurarGraficosBase("REPORTE DE VENTAS", "Total Registradas", "Instaladas", "Por Instalar");
            zonaActual = document.getElementById("selectorZona").value;
            
            if (document.getElementById("cardCalendarioNoc")) document.getElementById("cardCalendarioNoc").style.display = "none";
            if (document.getElementById("cardGraficoTecnicos")) document.getElementById("cardGraficoTecnicos").style.display = "none";
            if (document.getElementById("cardKpisClientes")) document.getElementById("cardKpisClientes").style.display = "none";
            
        } else if (isVendedor) { // VENDEDOR DE CAMPO
            rolParaMostrar = "💼 ASESOR COMERCIAL";
            localStorage.setItem('ten_rol', 'ventas');
            
            encenderMenu(["PRINCIPAL", "NUEVO TRABAJO"]);
            
            document.getElementById("contenedorSelectorZona").style.display = "none";
            document.getElementById("panelGraficosAdmin").classList.add("show-admin-grid");
            configurarGraficosBase("MIS VENTAS", "Total Registradas", "Instaladas", "Por Instalar");
            zonaActual = "Norte";
            
            if (document.getElementById("cardCalendarioNoc")) document.getElementById("cardCalendarioNoc").style.display = "none";
            if (document.getElementById("cardGraficoTecnicos")) document.getElementById("cardGraficoTecnicos").style.display = "none";
            if (document.getElementById("cardKpisClientes")) document.getElementById("cardKpisClientes").style.display = "none";
            
            const campanaVentas = document.getElementById("btn-notificaciones");
            if (campanaVentas) campanaVentas.style.display = "none";
            
        } else { // TÉCNICOS
            rolParaMostrar = "👷 TÉCNICO CAMPO";
            localStorage.setItem('ten_rol', 'tecnico');
            localStorage.setItem('ten_nombre_tecnico', nombrePantalla);
            
            // Si la zona obligatoria del técnico es Lurín, NO le mostramos los Turnos
            if (zonaObligatoria === "lurin") {
                encenderMenu(["RECURSOS HUMANOS", "MIS ASISTENCIAS"]);
            } else {
                // Los de Norte sí ven la Programación de guardias
                encenderMenu(["RECURSOS HUMANOS", "PROGRAMACIÓN / TURNOS", "MIS ASISTENCIAS"]);
            }
            
            // 🔥 CORRECCIÓN: La zona ya fue asignada inteligentemente por la Nube (zonaObligatoria)
            zonaActual = (zonaObligatoria === "lurin") ? "Lurin" : "Norte";
            document.getElementById("contenedorSelectorZona").style.display = "none";
        }
        
        localStorage.setItem('ten_email', email);

        // 🔥 ENCENDER EL RADAR GPS (SOLO SI EL USUARIO ES UN TÉCNICO)
        if (localStorage.getItem('ten_rol') === 'tecnico') {
            if (typeof window.iniciarRastreoGPS === 'function') {
                window.iniciarRastreoGPS(email, nombrePantalla);
            }
        }

        // =====================================
        // INYECTAR NOMBRE REAL EN LA INTERFAZ Y FOTO DE PERFIL
        // =====================================
        let lblUsuario = document.getElementById("lblUsuarioActivo");
        let contenedorSidebarUser = lblUsuario ? lblUsuario.closest('.sidebar-user') : null;

        if (lblUsuario && contenedorSidebarUser) {
            let divAvatar = contenedorSidebarUser.querySelector('.avatar');
            if (divAvatar) {
                divAvatar.style.display = 'flex';
                divAvatar.style.background = 'transparent'; 
                divAvatar.style.boxShadow = 'none'; 
                divAvatar.style.border = 'none';    
                divAvatar.style.padding = '0';      
                
                let urlImg = (datosUsuario && datosUsuario.fotoPerfil) ? datosUsuario.fotoPerfil : "https://ui-avatars.com/api/?name=" + nombrePantalla + "&background=0ea5e9&color=fff&rounded=true&bold=true";
                
                // ✨ AHORA EL CLIC ABRE EL MENÚ DE OPCIONES
                divAvatar.innerHTML = `<img id="imgFotoPerfilTEN" src="${urlImg}" style="width: 45px; height: 45px; border-radius: 50%; object-fit: cover; cursor: pointer; border: 2px solid var(--accent); box-shadow: 0 4px 6px rgba(0,0,0,0.15); transition: 0.2s;" title="Opciones de perfil" onmouseover="this.style.filter='brightness(0.7)'" onmouseout="this.style.filter='none'" onclick="window.abrirMenuPerfil(event, '${urlImg}')">`;
            }
            
            let lblSaludo = document.getElementById("lblSaludoInteligente");
            if (lblSaludo) {
                lblSaludo.style.fontSize = "10px"; 
                lblSaludo.style.marginBottom = "4px";
            }
            
            lblUsuario.style.display = "block";
            lblUsuario.innerHTML = `
                <span style="font-size:10px; color:var(--text-muted); font-weight:900;">${rolParaMostrar}</span><br>
                <span style="font-size:14px; color:var(--accent); font-weight:900;">${nombrePantalla}</span>
            `;
        }

        // =====================================
        // 🗣️ VOZ INTELIGENTE DE BIENVENIDA
        // =====================================
        if (!sessionStorage.getItem('saludo_reproducido')) {
            let horaActual = new Date().getHours();
            let saludoVoz = "Hola";
            if (horaActual >= 5 && horaActual < 12) saludoVoz = "Buenos días";
            else if (horaActual >= 12 && horaActual < 19) saludoVoz = "Buenas tardes";
            else saludoVoz = "Buenas noches";

            // 🔥 NUEVO: Diccionario para pronunciación natural de la IA
            const diccionarioNombresVoz = {
                "dventocilla": "Daniela", "sfeliciano": "Sara", "crivera": "Carol",
                "rleon": "Ricardo", "ahesse": "Hesse", "oalvino": "Oriana",
                "jrodriguez": "Carlos", "mventocilla": "Milagros", "jcabrera": "Jordy",
                "mcancha": "Mabel", "mpacotaipe": "Marcelino", "calarcon": "Clever",
                "jpatricio": "Patricio", "jcordova": "Juan", "rrondon": "Renzo",
                "jloli": "Loli", "jfernandez": "Jesús", "eolortegui": "Eber",
                "jpalomino": "Javier", "dpacotaipe": "Diego", "ecuta": "Edward",
                "strujillo": "Trujillo", "wherrera": "Wilton", "cpacotaipe": "Carolyn",
                "rpacotaipe": "Rodrigo", "jcotrina": "Cotrina", "bills": "Bills", 
                "cielo": "Cielo"
            };

            // Atrapamos la parte del correo antes del "@" y la buscamos en el diccionario
            let prefijoCorreo = email.split('@')[0].toLowerCase();
            let nombreHablado = diccionarioNombresVoz[prefijoCorreo] || nombrePantalla.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

            const ejecutarSaludo = () => {
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    let utterance = new SpeechSynthesisUtterance(`${saludoVoz}, ${nombreHablado}. Bienvenido al sistema.`);
                    utterance.lang = 'es-ES';
                    utterance.rate = 1.05; 
                    utterance.pitch = 1.0;
                    window.speechSynthesis.speak(utterance);
                    sessionStorage.setItem('saludo_reproducido', 'true');
                }
            };
            setTimeout(() => {
                ejecutarSaludo();
                if (window.speechSynthesis && window.speechSynthesis.pending) {
                    const desbloquearVozClic = () => {
                        window.speechSynthesis.cancel();
                        ejecutarSaludo(); 
                        document.removeEventListener('click', desbloquearVozClic);
                    };
                    document.addEventListener('click', desbloquearVozClic);
                }
            }, 1500);
        }

        // =====================================
        // REGLA: BASE DE DATOS SOLO PARA OFICINA (Admins, NOC, Coord, Cobranzas)
        // =====================================
        if (isAdmin || isAdminLurin || isWilton || isCarlos || isCobranzas) {
            // Mostrar título de sección
            document.querySelectorAll(".nav-section").forEach(sec => {
                if (sec.innerText.includes("BASE DE DATOS")) sec.style.display = "block";
            });
            
            // Forzar que los botones de BD se muestren para la oficina
            const btnBuscador = document.querySelector("button[onclick='abrirModalFiltroBD()']");
            const btnActualizar = document.querySelector("button[onclick='window.mostrarModalActualizarBD()']");
            const btnSubirNube = document.querySelector("button[onclick='window.subirExcelAFirebase()']");
            const btnBajarNube = document.querySelector("button[onclick='window.descargarExcelDeFirebase()']");
            const divEstado = document.getElementById("lblEstadoBD");

            [btnBuscador, btnActualizar, btnSubirNube, btnBajarNube].forEach(el => {
                if (el) {
                    el.style.display = "flex"; 
                    el.classList.remove("admin-only", "admin-carlos-only", "admin-wilton-only");
                }
            });
            
            if (divEstado && divEstado.parentElement) {
                divEstado.parentElement.style.display = "flex";
                divEstado.parentElement.classList.remove("admin-only", "admin-carlos-only");
            }
        } else {
            // 🛑 BLOQUEO ESTRICTO: Ocultar todo rastro de la BD a Técnicos y Vendedores
            document.querySelectorAll(".nav-section").forEach(sec => {
                if (sec.innerText.includes("BASE DE DATOS")) sec.style.display = "none";
            });
            
            const btnBuscador = document.querySelector("button[onclick='abrirModalFiltroBD()']");
            const btnActualizar = document.querySelector("button[onclick='window.mostrarModalActualizarBD()']");
            const btnSubirNube = document.querySelector("button[onclick='window.subirExcelAFirebase()']");
            const btnBajarNube = document.querySelector("button[onclick='window.descargarExcelDeFirebase()']");
            const divEstado = document.getElementById("lblEstadoBD");

            [btnBuscador, btnActualizar, btnSubirNube, btnBajarNube].forEach(el => {
                if (el) el.style.display = "none";
            });
            
            if (divEstado && divEstado.parentElement) {
                divEstado.parentElement.style.display = "none";
            }
        }

        // =====================================
        // 🛑 REGLA ESTRICTA: BLOQUEAR ÁREA COMERCIAL A TÉCNICOS Y VENDEDORES
        // =====================================
        if (!isAdmin && !isAdminLurin && !isCarlos && !isCobranzas) {
            // El usuario es un Técnico, un Vendedor de campo o personal NOC (Wilton)
            // Buscamos cualquier botón sospechoso en todo el sistema y lo eliminamos del código
            document.querySelectorAll(".nav-btn").forEach(btn => {
                let htmlInterno = btn.innerHTML.toLowerCase();
                let click = (btn.getAttribute("onclick") || "").toLowerCase();
                
                // Si el botón lleva a esos módulos o dice esas palabras, se destruye
                if (
                    click.includes("modulo_retencion") || 
                    click.includes("modulo_seguimiento") || 
                    click.includes("modulo_comisiones") ||
                    htmlInterno.includes("retención") ||
                    htmlInterno.includes("post-venta") ||
                    htmlInterno.includes("calidad") ||
                    htmlInterno.includes("averías") ||
                    htmlInterno.includes("comisiones")
                ) {
                    btn.remove(); // 💣 Eliminación definitiva del DOM
                }
            });
            
            // Eliminamos los títulos de las secciones para que no queden flotando
            document.querySelectorAll(".nav-section").forEach(sec => {
                if (sec.innerText.includes("ÁREA COMERCIAL") || sec.innerText.includes("BASE DE DATOS")) {
                    sec.remove(); // 💣 Eliminación definitiva
                }
            });
        }

        const iframeMapa = document.getElementById("iframeCobertura");
        // 🔒 MOSTRAR PESTAÑAS DE BAJAS SOLO A PERSONAL DE OFICINA
        let contenedorTabsNOC = document.getElementById("contenedorTabsBajas");
        if (contenedorTabsNOC) {
            let isTecnicoOVendedor = (!isAdmin && !isAdminLurin && !isWilton && !isCarlos && !isCobranzas);
            if (isTecnicoOVendedor) {
                contenedorTabsNOC.style.display = "none"; // Técnicos ven todo junto
            } else {
                contenedorTabsNOC.style.display = "block"; // Oficina ve dividido
            }
        }
        if (iframeMapa) iframeMapa.src = obtenerUrlMapa();

        setTimeout(() => {
            if (typeof window.renderizarCalendario === "function") window.renderizarCalendario();
        }, 800);

        actualizarFiltroTecnicos();
        cargarTrabajosEnVivo();

        if(typeof window.renderizarTablaPlanesConfig === 'function') window.renderizarTablaPlanesConfig();

        if (isAdmin || isWilton || isCarlos || isCobranzas || isVendedor) {
            if (typeof window.iniciarEscuchaCobranzas === 'function' && !isVendedor) window.iniciarEscuchaCobranzas();
            window.cargarBDLocalYActualizarUI().then((hayDatos) => {
                let hoy = new Date().toISOString().split('T')[0];
                let ultimaSincronizacion = localStorage.getItem("ultima_sincronizacion_bd");
                if (!hayDatos || ultimaSincronizacion !== hoy) {
                    mostrarToast("📥 Sincronización Diaria: Actualizando Base de Datos...");
                    if (typeof window.descargarExcelDeFirebase === 'function') {
                        window.descargarExcelDeFirebase().then(() => {
                            localStorage.setItem("ultima_sincronizacion_bd", hoy);
                        });
                    }
                }
            });
        }
        
        // =====================================
        // 🤖 ENCENDER EL ROBOT DE LISTAS AQUÍ
        // =====================================
        if (typeof window.cargarListasDesplegables === "function") {
            window.cargarListasDesplegables();
        }

        // 🔥 ENCENDER LA ALARMA DE MENCIONES
        if (typeof window.iniciarEscuchaMenciones === "function") {
            window.iniciarEscuchaMenciones();
        }

    } else {
        if (unsubscribeTrabajos) unsubscribeTrabajos();
        if (unsubscribeCobranzas) unsubscribeCobranzas();
        dbTrabajos = [];
        document.getElementById("login-view").style.display = "flex";
        document.getElementById("dashboard-view").style.display = "none";
    }
});

// ============================================================ //
// MANEJO DE BASE DE DATOS LOCAL Y SEMÁFORO                     //
// ============================================================ //
window.cargarBDLocalYActualizarUI = () => {
    return new Promise((resolve) => {
        const request = indexedDB.open("window.dbLocalSede", 2);
        request.onupgradeneeded = (ev) => {
            if (!ev.target.result.objectStoreNames.contains("clientesStore")) {
                ev.target.result.createObjectStore("clientesStore", { keyPath: "id" });
            }
        };
        request.onsuccess = (e) => {
            const db = e.target.result;
            if (db.objectStoreNames.contains("clientesStore")) {
                const tx = db.transaction("clientesStore", "readonly");
                const getReq = tx.objectStore("clientesStore").get("bd_completa");
                getReq.onsuccess = () => {
                    if (getReq.result && getReq.result.data && getReq.result.data.length > 0) {
                        window.bdClientesGlobal = getReq.result.data;
                        window.actualizarEstadoBD();
                        resolve(true);
                    } else {
                        window.actualizarEstadoBD(); // <-- CORRECCIÓN: Avisa que no hay datos
                        resolve(false);
                    }
                };
                getReq.onerror = () => { window.actualizarEstadoBD(); resolve(false); };
            } else {
                window.actualizarEstadoBD();
                resolve(false);
            }
        };
        request.onerror = () => { window.actualizarEstadoBD(); resolve(false); };
    });
};

window.actualizarEstadoBD = () => {
    const lbl = document.getElementById('lblEstadoBD');
    if (lbl) {
        const total = window.bdClientesGlobal ? window.bdClientesGlobal.length : 0;
        if (total > 0) {
            const fecha = localStorage.getItem('kpi_fecha') || 'Hoy';
            lbl.innerHTML = `✅ ${total} cl. | Act: ${fecha}`;
            lbl.style.color = 'var(--success)';
        } else {
            lbl.innerHTML = '⚠️ Sin datos locales';
            lbl.style.color = 'var(--warning)';
        }
    }
    
    if (localStorage.getItem("kpi_total")) {
        let activos = parseInt(localStorage.getItem("kpi_activos")) || 0;
        let suspendidos = parseInt(localStorage.getItem("kpi_suspendidos")) || 0;
        let retirados = parseInt(localStorage.getItem("kpi_retirados")) || 0;
        let total = parseInt(localStorage.getItem("kpi_total")) || 0;
        let fecha = localStorage.getItem("kpi_fecha") || "Desconocida";

        let pctAct = total > 0 ? Math.round((activos / total) * 100) : 0;
        let pctSus = total > 0 ? Math.round((suspendidos / total) * 100) : 0;
        let pctRet = total > 0 ? Math.round((retirados / total) * 100) : 0;

        if(document.getElementById("kpiCliActivos")) document.getElementById("kpiCliActivos").innerText = activos;
        if(document.getElementById("kpiCliSuspendidos")) document.getElementById("kpiCliSuspendidos").innerText = suspendidos;
        if(document.getElementById("kpiCliRetirados")) document.getElementById("kpiCliRetirados").innerText = retirados;
        if(document.getElementById("kpiCliTotal")) document.getElementById("kpiCliTotal").innerText = total;
        
        if(document.getElementById("pctActivos")) document.getElementById("pctActivos").innerText = `(${pctAct}%)`;
        if(document.getElementById("pctSuspendidos")) document.getElementById("pctSuspendidos").innerText = `(${pctSus}%)`;
        if(document.getElementById("pctRetirados")) document.getElementById("pctRetirados").innerText = `(${pctRet}%)`;
        if(document.getElementById("lblFechaBD")) document.getElementById("lblFechaBD").innerText = `Act: ${fecha}`;
    }
    
    if(typeof window.renderizarTablaPlanesConfig === 'function') window.renderizarTablaPlanesConfig();
};

window.mostrarModalActualizarBD = () => {
    let fileInput = document.getElementById('fileNuevoExcel');
    if(fileInput) fileInput.click();
};

// ============================================================ //
// MOTOR DE EXCEL (PROCESAMIENTO Y ACTUALIZACIÓN EN LA NUBE)    //
// ============================================================ //
window.procesarExcelClientes = async (event) => {
    let file = event.target.files[0];
    if (!file) {
        window.actualizarEstadoBD();
        return; 
    }
    
    mostrarToast("⏳ 1/4: Leyendo Excel... (No cierres la ventana)");
    let reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            let data = new Uint8Array(e.target.result);
            let workbook = XLSX.read(data, {type: 'array'});
            let worksheet = workbook.Sheets[workbook.SheetNames[0]];
            
            let datosCrudos = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            window.bdClientesGlobal = datosCrudos;
            
            let activos = 0, suspendidos = 0, retirados = 0;
            
            // Normalizamos las llaves y calculamos KPIs
            let clientesParaLaNube = [];
            window.bdClientesGlobal.forEach((c) => {
                let fila = {};
                for (let llave in c) {
                    let cleanKey = llave.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
                    fila[cleanKey] = c[llave];
                }
                
                let estMinus = String(fila["estadocliente"] || fila["estado"] || fila["contactos"] || "").toLowerCase().trim();
                if (estMinus.includes("activo") || estMinus.includes("registrado")) activos++;
                else if (estMinus.includes("suspendido") || estMinus.includes("cortado")) suspendidos++;
                else if (estMinus.includes("retirado") || estMinus.includes("baja")) retirados++;
                
                clientesParaLaNube.push(fila);
            });

            let total = clientesParaLaNube.length; 
            if (total === 0) {
                mostrarToast("❌ El Excel está vacío."); return;
            }

            // --- MAGIA: LIMPIAR Y SUBIR DIRECTO A LA NUBE EN PAQUETES ---
            const { writeBatch, doc, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
            
            mostrarToast("🧹 2/4: Limpiando Base de Datos antigua en la Nube...");
            const snapshot = await getDocs(coleccionClientes);
            let deleteBatch = writeBatch(db);
            let deleteCount = 0;
            let deleteBatches = [];

            snapshot.docs.forEach((docSnap) => {
                deleteBatch.delete(docSnap.ref);
                deleteCount++;
                if (deleteCount === 400) { // Límite seguro para Firebase
                    deleteBatches.push(deleteBatch.commit());
                    deleteBatch = writeBatch(db);
                    deleteCount = 0;
                }
            });
            if (deleteCount > 0) deleteBatches.push(deleteBatch.commit());
            await Promise.all(deleteBatches); // Borramos todo lo viejo en la nube

            mostrarToast(`☁️ 3/4: Subiendo ${total} clientes actualizados a la Nube...`);
            let uploadBatch = writeBatch(db);
            let uploadCount = 0;
            let uploadBatches = [];

            clientesParaLaNube.forEach((cliente, i) => {
                let idFila = "fila_" + i; 
                let refDoc = doc(coleccionClientes, idFila);
                uploadBatch.set(refDoc, cliente);
                uploadCount++;

                if (uploadCount === 400) {
                    uploadBatches.push(uploadBatch.commit());
                    uploadBatch = writeBatch(db);
                    uploadCount = 0;
                }
            });
            if (uploadCount > 0) uploadBatches.push(uploadBatch.commit());
            await Promise.all(uploadBatches); // Subimos todo lo nuevo de golpe
            // ------------------------------------------------------------

            mostrarToast("💾 4/4: Guardando copia en tu Memoria Local...");
            let opcionesFecha = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
            let fechaHoy = new Date().toLocaleDateString('es-PE', opcionesFecha);

            localStorage.setItem("kpi_activos", activos);
            localStorage.setItem("kpi_suspendidos", suspendidos);
            localStorage.setItem("kpi_retirados", retirados);
            localStorage.setItem("kpi_total", total); 
            localStorage.setItem("kpi_fecha", fechaHoy);
            localStorage.setItem("ultima_sincronizacion_bd", new Date().toISOString().split('T')[0]);

            const request = indexedDB.open("window.dbLocalSede", 2);
            request.onupgradeneeded = (ev) => {
                if (!ev.target.result.objectStoreNames.contains("clientesStore")) {
                    ev.target.result.createObjectStore("clientesStore", { keyPath: "id" });
                }
            };
            request.onsuccess = (ev) => {
                const dbIdx = ev.target.result;
                const tx = dbIdx.transaction("clientesStore", "readwrite");
                tx.objectStore("clientesStore").put({ id: "bd_completa", data: window.bdClientesGlobal });
                tx.oncomplete = () => {
                    event.target.value = ''; 
                    window.actualizarEstadoBD();
                    mostrarToast("✅ ¡ÉXITO GLOBAL! La base de datos central ha sido reemplazada.");
                    if(typeof window.ejecutarFiltroBD === "function") window.ejecutarFiltroBD();
                };
            };
        } catch(error) {
            console.error(error);
            mostrarToast("❌ Error al procesar el Excel. Revisa tu internet.");
            window.actualizarEstadoBD();
        }
    };
    reader.readAsArrayBuffer(file);
};

// ============================================================ //
// DESCARGAR EXCEL DESDE FIREBASE (LA FUNCIÓN QUE FALTABA)      //
// ============================================================ //
window.descargarExcelDeFirebase = async () => {
    let lbl = document.getElementById("lblEstadoBD");
    if (lbl) { lbl.innerHTML = "Sincronizando..."; lbl.style.color = "var(--info)"; }
    
    try {
        const { getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        const snapshot = await getDocs(coleccionClientes);
        let clientesNube = [];
        
        snapshot.forEach(docSnap => {
            clientesNube.push(docSnap.data());
        });

        if (clientesNube.length > 0) {
            window.bdClientesGlobal = clientesNube;

            // Calcular KPIs
            let activos = 0, suspendidos = 0, retirados = 0;
            clientesNube.forEach(c => {
                let estMinus = String(c["estadocliente"] || c["estado"] || c["contactos"] || "").toLowerCase().trim();
                if (estMinus.includes("activo") || estMinus.includes("registrado")) activos++;
                else if (estMinus.includes("suspendido") || estMinus.includes("cortado")) suspendidos++;
                else if (estMinus.includes("retirado") || estMinus.includes("baja")) retirados++;
            });

            let opcionesFecha = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
            let fechaHoy = new Date().toLocaleDateString('es-PE', opcionesFecha);

            localStorage.setItem("kpi_activos", activos);
            localStorage.setItem("kpi_suspendidos", suspendidos);
            localStorage.setItem("kpi_retirados", retirados);
            localStorage.setItem("kpi_total", clientesNube.length); 
            localStorage.setItem("kpi_fecha", fechaHoy);

            // Guardar en el dispositivo
            const request = indexedDB.open("window.dbLocalSede", 2);
            request.onupgradeneeded = (ev) => {
                if (!ev.target.result.objectStoreNames.contains("clientesStore")) {
                    ev.target.result.createObjectStore("clientesStore", { keyPath: "id" });
                }
            };
            request.onsuccess = (ev) => {
                const dbIdx = ev.target.result;
                const tx = dbIdx.transaction("clientesStore", "readwrite");
                tx.objectStore("clientesStore").put({ id: "bd_completa", data: clientesNube });
                tx.oncomplete = () => {
                    window.actualizarEstadoBD();
                    mostrarToast("✅ Sincronización desde la nube exitosa.");
                    if(typeof window.ejecutarFiltroBD === "function") window.ejecutarFiltroBD();
                };
            };
        } else {
            mostrarToast("⚠️ La base de datos en la nube está vacía.");
            window.actualizarEstadoBD();
        }
    } catch (error) {
        console.error(error);
        mostrarToast("❌ Error al descargar de la nube.");
        window.actualizarEstadoBD();
    }
};

// ============================================================ //
// FUNCIONES AUXILIARES Y DE INTERFAZ                           //
// ============================================================ //
function configurarGraficosBase(titulo, lTotal, lSuccess, lWarning) {
    const panelGraficos = document.getElementById("panelGraficosAdmin");
    if (isAdmin || isAdminLurin || isWilton || isCobranzas) {
        if (document.getElementById("cardGraficoTecnicos")) document.getElementById("cardGraficoTecnicos").style.display = "flex";
        if (document.getElementById("cardCalendarioNoc")) document.getElementById("cardCalendarioNoc").style.display = "flex";
        if (document.getElementById("cardKpisClientes")) document.getElementById("cardKpisClientes").style.display = "flex";
    }

    if (document.getElementById("tituloKpi")) {
        document.getElementById("tituloKpi").innerHTML = `<i class="fa-solid fa-chart-pie text-orange"></i> ${titulo}`;
        document.getElementById("lblKpiTotal").innerText = lTotal;
        document.getElementById("lblKpiAtendidos").innerText = lSuccess;
        document.getElementById("lblKpiPendientes").innerText = lWarning;
    }
}

function actualizarFiltroTecnicos() {
    // Escudo: Usa la base de datos en vivo si cargó, si no, usa el respaldo
    let lista = (zonaActual === "Lurin") ? (window.tecnicosLurinDinamico || tecnicosLurin) : (window.tecnicosNorteDinamico || tecnicosNorte);
    let html = `<option value="todos">Todos</option>`;
    lista.forEach((t) => { html += `<option value="${t}">${t}</option>`; });
    if(document.getElementById("filtroTecnico")) document.getElementById("filtroTecnico").innerHTML = html;
}

function actualizarSelectTecnicosModal() {
    let lista = (zonaActual === "Lurin") ? (window.tecnicosLurinDinamico || tecnicosLurin) : (window.tecnicosNorteDinamico || tecnicosNorte);
    let html = ``;
    lista.forEach((t) => {
        html += `<div class="multi-option" onclick="window.toggleCheckbox(this)"><input type="checkbox" value="${t}"><label>${t}</label></div>`;
    });
    if(document.getElementById("techDropdown")) document.getElementById("techDropdown").innerHTML = html;
    if(document.getElementById("techDisplay")) document.getElementById("techDisplay").innerText = "Sin Asignar";
}

window.actualizarFiltrosCoordinador = () => {
    const elementosFiltro = document.querySelectorAll(".filtro-coordinador");
    const elementosZonaExacta = document.querySelectorAll(".filtro-zona-exacta");
    
    // 1. Filtros de coordinador (Vendedor, Zona Gral, Mes) - Solo Carlos
    if (!isCarlos) {
        elementosFiltro.forEach(el => el.style.display = "none");
    } else {
        elementosFiltro.forEach(el => el.style.display = "block");
    }

    // 2. Filtro de Zona Exacta (Admin + Carlos)
    if (!isCarlos && !isAdmin && !isAdminLurin) {
        elementosZonaExacta.forEach(el => el.style.display = "none");
    } else {
        elementosZonaExacta.forEach(el => el.style.display = "block");
    }

    let vendedores = new Set();
    let zonas = new Set();
    let meses = new Set();
    let subZonas = new Set(); // El nuevo recolector de zonas exactas
    subZonas.add("SIN COBERTURA");
    subZonas.add("OTRO");

    // 🔥 INYECTAMOS LA LISTA COMPLETA SEGÚN LA ZONA ACTIVA PARA EL FILTRO
    let esLurin = (zonaActual === "Lurin" || zonaActual === "lurin");
    if (esLurin) {
        let zonasLurin = ["A.H EL BOSQUE", "A.H LAS LADERAS DE PACHACAMAC", "A.H VILLA ALEJANDRO", "AGRUPACION AGROPECUARIA JOSE GALVEZ", "ASC. VILLA DE GUERRA", "CASA CLUB LAS PALMAS", "CITV VILLA SUR PACHACAMAC", "JOSE GALVEZ", "LADERAS DE PACHACAMAC", "LADERAS DE PACHACAMAC 4TA ETAPA", "LADERAS DE PACHACAMAC SECTOR C", "LAS PALMAS", "RESIDENCIAL SANTISIMO SALVADOR DE LAS PALMAS", "RESIDENCIAL ZARUMILLA", "SAENZ PEÑA", "URBANIZACION PACHACAMAC", "VILLA LAS PALMAS", "VILLA VERDE DE PACHACAMAC", "CONDOMINIO LAS PALMAS"];
        zonasLurin.forEach(z => subZonas.add(z));
    } else {
        let zonasNorte = ["ACOBAMBA", "ANIMAS", "ASOC CHILLON", "AV CHILLON", "CHACRACERRO", "CHIPIGUO", "COMANDANTE", "COMAS", "ENSENADA", "FLORESTA DE PRO", "HARAS", "HUERTOS-PRO", "LA CAPITANA", "LA HACIENDA", "LA MARINA ENSENADA", "LADERAS", "LOMITAS", "LOS OLIVOS", "NUEVO AMANECER", "PRO", "PRO LIMA", "PUENTE PIEDRA", "RELLENO", "SAN DIEGO", "SAN MARTIN DE PORRES", "TRAPICHE", "TRES RUEDAS", "TUNGASUCA", "CONDOMINIO LA RIVERA DE SAN DIEGO", "CONDOMINIO LOS SAUCES", "CONDOMINIO SAN DIEGO DE ALCALA", "CONDOMINIO VALLE ALTO", "CONDOMINIO VALLE VERDE", "EDIFICIO REAL", "EDIFICIO RESIDENCIAL LA FLORESTA"];
        zonasNorte.forEach(z => subZonas.add(z));
    }

    dbTrabajos.forEach(t => {
        if (t.tipoTarea === "alta" || t.tipoTarea === "venta_equipos") {
            if (t.vendedor) vendedores.add(t.vendedor);
            if (t.zona) zonas.add(t.zona);
            if (t.fecha) meses.add(t.fecha.substring(0, 7)); 
        }
        // Recolectamos las zonas antiguas de los tickets por si acaso
        let sz = (t.subZona || "OTRO").toUpperCase();
        subZonas.add(sz);
    });

    const selV = document.getElementById("filtroVendedorCoord");
    const selZ = document.getElementById("filtroZonaCoord");
    const selM = document.getElementById("filtroMesCoord");
    const selSZ = document.getElementById("filtroSubZonaAdmin"); // El nuevo select

    if (selV) { let v = selV.value; selV.innerHTML = '<option value="todos">Todos los Vendedores</option>' + [...vendedores].sort().map(x => `<option value="${x}">${x}</option>`).join(""); selV.value = vendedores.has(v) ? v : "todos"; }
    if (selZ) { let v = selZ.value; selZ.innerHTML = '<option value="todos">Todas las Zonas</option>' + [...zonas].sort().map(x => `<option value="${x}">${x}</option>`).join(""); selZ.value = zonas.has(v) ? v : "todos"; }
    if (selM) { 
        let v = selM.value; 
        selM.innerHTML = '<option value="todos">Todos los Meses</option>' + [...meses].sort((a,b) => b.localeCompare(a)).map(x => {
            let partes = x.split("-");
            let nomMes = new Date(partes[0], partes[1]-1, 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' });
            return `<option value="${x}">${nomMes.toUpperCase()}</option>`;
        }).join(""); 
        selM.value = meses.has(v) ? v : "todos"; 
    }
    // Llenamos el nuevo filtro
    if (selSZ) { 
        let v = selSZ.value; 
        selSZ.innerHTML = '<option value="todos">Todas las Zonas Exactas</option>' + [...subZonas].sort().map(x => `<option value="${x}">${x}</option>`).join(""); 
        selSZ.value = subZonas.has(v) ? v : "todos"; 
    }
};
// Variable de control para que el esqueleto solo se vea en la carga inicial
let primeraCargaTrabajos = true;

function cargarTrabajosEnVivo() {
    if (unsubscribeTrabajos) unsubscribeTrabajos();
    
    // ✨ INYECTAR CSS PARA EL EFECTO DE PARPADEO (Solo una vez)
    if (!document.getElementById("styleFlashTicket")) {
        const style = document.createElement("style");
        style.id = "styleFlashTicket";
        style.innerHTML = `
        @keyframes flashNuevoTicket {
            0% { background-color: rgba(16, 185, 129, 0.4); box-shadow: inset 0 0 20px rgba(16, 185, 129, 0.6); }
            15% { background-color: rgba(16, 185, 129, 0.8); }
            100% { background-color: transparent; box-shadow: none; }
        }`;
        document.head.appendChild(style);
    }
    if (!window.ticketsNuevosFlash) window.ticketsNuevosFlash = new Set();

    if (primeraCargaTrabajos && typeof window.mostrarSkeleton === 'function') {
        window.mostrarSkeleton('tablaTrabajos', 4);
    }

    let zonaActiva = localStorage.getItem("ten_zona_activa") || "norte";
    let filtroZonas = zonaActiva.toLowerCase() === "lurin" ? ["Lurin", "lurin", "LURIN"] : ["Norte", "norte", "NORTE", "Los Olivos", ""];
    
    const consultaOptimizada = query(coleccionTrabajos, where("zona", "in", filtroZonas));

    unsubscribeTrabajos = onSnapshot(consultaOptimizada, (snapshot) => {
        // ✨ DETECTOR DE TICKETS NUEVOS (Alerta de Parpadeo y Pestaña)
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added" && !primeraCargaTrabajos) {
                window.ticketsNuevosFlash.add(change.doc.id);
                // 🔔 NUEVO: Disparar alerta en la pestaña del navegador
                if (typeof window.activarAlertaPestana === "function") window.activarAlertaPestana();
            }
        });

        dbTrabajos = [];
        
        let hace60Dias = new Date();
        hace60Dias.setDate(hace60Dias.getDate() - 60);
        let limiteFechaStr = hace60Dias.toISOString().split("T")[0];

        snapshot.forEach((doc) => { 
            let d = doc.data();
            if (d.fecha && d.fecha < limiteFechaStr) return; // Escudo Anti-Lag
            if(d.vendedor) d.vendedor = d.vendedor.toUpperCase().replace(/\.VENTAS/g, "");
            dbTrabajos.push({ id: doc.id, ...d }); 
        });
        
        if (typeof window.verificarBloqueoAsistencia === "function") window.verificarBloqueoAsistencia();
        actualizarOpcionesFechas();
        if(typeof window.actualizarFiltrosCoordinador === "function") window.actualizarFiltrosCoordinador();
        
        window.renderizarTabla();
        primeraCargaTrabajos = false;
        
        if (typeof window.renderizarCalendario === "function") window.renderizarCalendario();
        if (window.vistaActivaNOC === 'olt' && typeof window.renderizarInventarioOLT === 'function') window.renderizarInventarioOLT();
    });
}

// ============================================================ //
// 🛑 MOTOR DE BLOQUEO DE ASISTENCIA (VERSIÓN CORREGIDA)        //
// ============================================================ //
window.verificarBloqueoAsistencia = () => {
    let rolActual = localStorage.getItem('ten_rol');
    let bloqueoModal = document.getElementById("bloqueoAsistencia");
    if (rolActual !== 'tecnico' || !bloqueoModal) return;

    // 🛡️ Fallback triple: nombre global → localStorage → vacío
    let nombreSeguro = window.nombreUsuarioGlobal || localStorage.getItem('ten_nombre_tecnico') || "";
    
    // Si no tenemos nombre, NO bloqueamos (evitamos falsos positivos)
    if (!nombreSeguro) {
        bloqueoModal.style.display = "none";
        document.body.style.overflow = "auto";
        return;
    }

    let hoyObj = new Date();
    let hoyStr = hoyObj.getFullYear() + "-" + String(hoyObj.getMonth() + 1).padStart(2, '0') + "-" + String(hoyObj.getDate()).padStart(2, '0');

    let tieneEntrada = dbTrabajos.some(t => 
        t.tipoTarea === "biometrico" && 
        t.detalle === "Inicio de Turno" && 
        t.cliente === nombreSeguro && 
        t.fecha === hoyStr
    );

    if (!tieneEntrada) {
        document.getElementById("lblNombreEntrada").innerText = nombreSeguro;
        bloqueoModal.style.display = "flex";
        document.body.style.overflow = "hidden";
    } else {
        bloqueoModal.style.display = "none";
        document.body.style.overflow = "auto";
    }
};

// ============================================================ //
// BÚSQUEDA DUAL (EXCEL LOCAL + NUBE)                          //
// ============================================================ //
window.buscarCliente = async () => {
    const queryOriginal = document.getElementById("formIdCliente").value;
    const queryClean = queryOriginal.toLowerCase().replace(/[^a-z0-9]/g, "");
    const msg = document.getElementById("searchResult");
    
    if (!queryClean) { 
        msg.innerText = "⚠️ Escribe un ID o DNI válido"; 
        return; 
    }
    
    // ESTA ES LA CLAVE VISUAL: Si no ves esta frase al buscar, estás usando código viejo
    msg.innerText = "⏳ Buscando en motor avanzado..."; 
    msg.style.color = "var(--text-muted)";

    if (!window.bdClientesGlobal || window.bdClientesGlobal.length === 0) {
        msg.innerText = "⚠️ BD vacía. Sube el Excel de nuevo.";
        msg.style.color = "var(--warning)";
        return;
    }

    try {
        let clienteEncontrado = null;

        // Bucle destructor: Escanea absolutamente todas las celdas de todos los clientes
        for (let i = 0; i < window.bdClientesGlobal.length; i++) {
            let cliente = window.bdClientesGlobal[i];
            let valores = Object.values(cliente);
            
            let coincidencia = false;
            for (let j = 0; j < valores.length; j++) {
                let celdaBruta = valores[j];
                if (celdaBruta !== null && celdaBruta !== undefined) {
                    // Limpia espacios invisibles, apóstrofes y símbolos raros de Excel
                    let celdaLimpia = String(celdaBruta).toLowerCase().replace(/[^a-z0-9]/g, "");
                    
                    if (celdaLimpia === queryClean || (queryClean.length >= 4 && celdaLimpia.includes(queryClean))) {
                        coincidencia = true;
                        break;
                    }
                }
            }

            if (coincidencia) {
                clienteEncontrado = cliente;
                break;
            }
        }

        if (clienteEncontrado) {
            let filaLimpia = {};
            for (let k in clienteEncontrado) {
                let cleanKey = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
                filaLimpia[cleanKey] = clienteEncontrado[k];
            }

            document.getElementById("formNombre").value = filaLimpia["apellidosynombres"] || filaLimpia["nombre"] || "Sin Nombre";
            document.getElementById("formDni").value = filaLimpia["ndocumento"] || filaLimpia["nid"] || filaLimpia["idcliente"] || queryOriginal;
            
            let tipoDoc = String(filaLimpia["tipodedocumento"] || "DNI").toUpperCase().trim();
            let selectTipoDoc = document.getElementById("formTipoDoc");
            if (selectTipoDoc && Array.from(selectTipoDoc.options).some(opt => opt.value === tipoDoc)) {
                selectTipoDoc.value = tipoDoc;
            }

            let arrayTelefonos = [];
            for (let i = 1; i <= 5; i++) {
                if (filaLimpia[`telefono${i}`]) arrayTelefonos.push(filaLimpia[`telefono${i}`]);
            }
            if (filaLimpia["celular"]) arrayTelefonos.push(filaLimpia["celular"]);
            
            let telefonosLimpios = [...new Set(arrayTelefonos.filter(t => t && String(t).trim() !== ""))];

            document.getElementById("formTelefonoPrincipal").value = telefonosLimpios[0] || "";
            document.getElementById("formTelefonoSecundario").value = telefonosLimpios.slice(1).join(" / ") || "";

            let dir = filaLimpia["direccion"] || filaLimpia["direccio"] || "";
            document.getElementById("formDireccion").value = dir;
            
            let ubicacionBruta = String(filaLimpia["ubicacion"] || "").trim();
            if (ubicacionBruta && !ubicacionBruta.includes("http")) {
                ubicacionBruta = ubicacionBruta.replace(";", ","); 
                ubicacionBruta = `https://maps.google.com/?q=${ubicacionBruta}`;
            }
            document.getElementById("formMapa").value = ubicacionBruta;

            msg.innerText = "✅ Cliente encontrado con éxito"; 
            msg.style.color = "var(--success)";
        } else {
            msg.innerText = "❌ No encontrado. Revisa el Excel."; 
            msg.style.color = "var(--danger)";
        }
    } catch (err) {
        console.error(err);
        msg.innerText = "⚠️ Error al leer los datos."; 
        msg.style.color = "var(--danger)";
    }
};

window.calcularPrecioTotal = () => {
    let tipoSelect = document.getElementById("formTipoServicio");
    let planSelect = document.getElementById("formPlanVenta");
    if (!tipoSelect || !planSelect) return;

    let tipoServicio = tipoSelect.value.trim().toLowerCase(); 
    let planesGuardados = window.obtenerPlanesGlobales();
    let valPrevio = planSelect.value;
    let htmlDestino = "";

    // 1. CONSTRUCCIÓN DE LA LISTA
    if (tipoServicio === "solo cable") {
        htmlDestino = `<option value="50|PLAN S/. 50 SERVICIO DE CABLE">PLAN S/. 50 SERVICIO DE CABLE</option>`;
    } 
    else if (tipoServicio.includes("reinstala")) {
        // Planes normales + el plan de cable al final (Aplica para ambas Reinstalaciones)
        planesGuardados.forEach(p => { htmlDestino += `<option value="${p.precio}|${p.nombre}">${p.nombre}</option>`; });
        htmlDestino += `<option value="50|PLAN S/. 50 SERVICIO DE CABLE">PLAN S/. 50 SERVICIO DE CABLE</option>`;
    } 
    else {
        // Solo planes normales
        planesGuardados.forEach(p => { htmlDestino += `<option value="${p.precio}|${p.nombre}">${p.nombre}</option>`; });
    }

    // 2. INYECTAR LA NUEVA LISTA Y MANTENER LO ELEGIDO
    planSelect.innerHTML = htmlDestino;
    if (Array.from(planSelect.options).some(o => o.value === valPrevio)) {
        planSelect.value = valPrevio;
    }

    // 3. MATEMÁTICAS DEL PRECIO
    let planVal = planSelect.value;
    if (!planVal) return;
    
    let parts = planVal.split("|");
    let precioBase = parseInt(parts[0]) || 0;
    let precioFinal = precioBase;

    let esBasico = (precioBase === 50 || precioBase === 55 || precioBase === 69);
    let esPlanDeCable = planVal.includes("SERVICIO DE CABLE");

    // 4. REGLA VISUAL ESTRICTA: OCULTAR EQUIPOS INCOMPATIBLES
    document.querySelectorAll("#equiposDropdown .multi-option").forEach(el => {
        let chk = el.querySelector("input");
        if (!chk) return;
        let val = chk.value;
        
        let isAvanzado = val.includes("Cámara") || val.includes("Mesh") || val.includes("TV Box");
        let isDeco = val.includes("Deco");
        let show = true;

        if (tipoServicio === "solo cable" || esPlanDeCable) {
            if (isAvanzado) show = false; 
        } else if (tipoServicio === "internet + cable" || tipoServicio === "reinstalación + cable" || tipoServicio === "reinstalacion + cable") {
            if (esBasico && isAvanzado) show = false; // + Cable permite Deco
        } else {
            // Internet solo, Reinstalación sin cable, Instalación, etc.
            if (esBasico && (isAvanzado || isDeco)) show = false; 
        }
        
        if (show) {
            el.style.display = "flex";
        } else {
            el.style.display = "none";
            if(chk.checked) chk.checked = false; 
        }
    });
    
    if(typeof window.actualizarTextoEquipos === 'function') window.actualizarTextoEquipos();

    // 5. 🔥 REGLA "+ CABLE" (+20 SOLES SOLO A PLANES BÁSICOS) 🔥
    if ((tipoServicio === "internet + cable" || tipoServicio === "reinstalación + cable" || tipoServicio === "reinstalacion + cable") && esBasico && !esPlanDeCable) {
        precioFinal += 20;
    }

    // 6. REGLA EQUIPOS EXTRAS (+10 SOLES)
    let chksEquipos = Array.from(document.querySelectorAll("#equiposDropdown input.chk-extra:checked")).map(c => c.value);
    chksEquipos.forEach(eq => {
        if (!eq.includes("Incluid") && !eq.includes("Otros")) {
            precioFinal += 10;
        }
    });
    
    // 7. VENTAS DE PRODUCTOS EXTRAS AL CONTADO
    let chksVentas = Array.from(document.querySelectorAll("#ventasEqDropdown input.chk-venta-alta:checked"));
    let metodoPagoVenta = document.getElementById("formAltaVentaEqPago") ? document.getElementById("formAltaVentaEqPago").value : "";
    
    if (metodoPagoVenta === "Al contado (sumado al cobro de hoy)") {
        chksVentas.forEach(eq => {
            precioFinal += parseFloat(eq.dataset.precio) || 0;
        });
    }
    
    let displayTotal = document.getElementById("formPrecioTotal");
    if(displayTotal) displayTotal.innerText = isNaN(precioFinal) ? "S/ 0" : `S/ ${precioFinal}`;
};

// ============================================================ //
// FUNCIÓN PARA EL SELECT DE AVERÍAS                            //
// ============================================================ //
window.cambiarProblemaAveria = () => {
    const select = document.getElementById("formProblemaAveria");
    const inputOtros = document.getElementById("formProblemaOtros");
    if(select && inputOtros) {
        if(select.value === "Otros") {
            inputOtros.style.display = "block";
            inputOtros.focus();
        } else {
            inputOtros.style.display = "none";
            inputOtros.value = "";
        }
    }
};

// ============================================================ //
// LÓGICA DE ZONAS Y CONDOMINIOS (LISTAS DINÁMICAS)             //
// ============================================================ //
window.actualizarListaZonas = () => {
    let tipo = document.getElementById("formTipoVivienda").value;
    let selectZona = document.getElementById("formSubZona");
    if (!selectZona) return;

    // Listas NORTE
    let casasNorte = ["ACOBAMBA", "ANIMAS", "ASOC CHILLON", "AV CHILLON", "CHACRACERRO", "CHIPIGUO", "COMANDANTE", "COMAS", "ENSENADA", "FLORESTA DE PRO", "HARAS", "HUERTOS-PRO", "LA CAPITANA", "LA HACIENDA", "LA MARINA ENSENADA", "LADERAS", "LOMITAS", "LOS OLIVOS", "NUEVO AMANECER", "PRO", "PRO LIMA", "PUENTE PIEDRA", "RELLENO", "SAN DIEGO", "SAN MARTIN DE PORRES", "TRAPICHE", "TRES RUEDAS", "TUNGASUCA", "SIN COBERTURA", "OTRO"];
    let condominiosNorte = ["CONDOMINIO LA RIVERA DE SAN DIEGO", "CONDOMINIO LOS SAUCES", "CONDOMINIO SAN DIEGO DE ALCALA", "CONDOMINIO VALLE ALTO", "CONDOMINIO VALLE VERDE", "EDIFICIO REAL", "EDIFICIO RESIDENCIAL LA FLORESTA", "SIN COBERTURA", "OTRO"];

    // Listas LURIN
    let casasLurin = ["A.H EL BOSQUE", "A.H LAS LADERAS DE PACHACAMAC", "A.H VILLA ALEJANDRO", "AGRUPACION AGROPECUARIA JOSE GALVEZ", "ASC. VILLA DE GUERRA", "CASA CLUB LAS PALMAS", "CITV VILLA SUR PACHACAMAC", "JOSE GALVEZ", "LADERAS DE PACHACAMAC", "LADERAS DE PACHACAMAC 4TA ETAPA", "LADERAS DE PACHACAMAC SECTOR C", "LAS PALMAS", "RESIDENCIAL SANTISIMO SALVADOR DE LAS PALMAS", "RESIDENCIAL ZARUMILLA", "SAENZ PEÑA", "URBANIZACION PACHACAMAC", "VILLA LAS PALMAS", "VILLA VERDE DE PACHACAMAC", "SIN COBERTURA", "OTRO"];
    let condominiosLurin = ["CONDOMINIO LAS PALMAS", "SIN COBERTURA", "OTRO"];

    let esLurin = (zonaActual === "Lurin" || zonaActual === "lurin");
    let lista = [];

    if (esLurin) {
        lista = tipo === "Condominio" ? condominiosLurin : casasLurin;
    } else {
        lista = tipo === "Condominio" ? condominiosNorte : casasNorte;
    }

    let html = "";
    lista.forEach(z => { html += `<option value="${z}">${z}</option>`; });
    selectZona.innerHTML = html;
};

window.actualizarListaZonasOtros = () => {
    let tipo = document.getElementById("formTipoViviendaOtros") ? document.getElementById("formTipoViviendaOtros").value : "Casa Propia";
    let selectZona = document.getElementById("formSubZonaOtros");
    if (!selectZona) return;

    // Listas NORTE
    let casasNorte = ["ACOBAMBA", "ANIMAS", "ASOC CHILLON", "AV CHILLON", "CHACRACERRO", "CHIPIGUO", "COMANDANTE", "COMAS", "ENSENADA", "FLORESTA DE PRO", "HARAS", "HUERTOS-PRO", "LA CAPITANA", "LA HACIENDA", "LA MARINA ENSENADA", "LADERAS", "LOMITAS", "LOS OLIVOS", "NUEVO AMANECER", "PRO", "PRO LIMA", "PUENTE PIEDRA", "RELLENO", "SAN DIEGO", "SAN MARTIN DE PORRES", "TRAPICHE", "TRES RUEDAS", "TUNGASUCA", "SIN COBERTURA", "OTRO"];
    let condominiosNorte = ["CONDOMINIO LA RIVERA DE SAN DIEGO", "CONDOMINIO LOS SAUCES", "CONDOMINIO SAN DIEGO DE ALCALA", "CONDOMINIO VALLE ALTO", "CONDOMINIO VALLE VERDE", "EDIFICIO REAL", "EDIFICIO RESIDENCIAL LA FLORESTA", "SIN COBERTURA", "OTRO"];

    // Listas LURIN
    let casasLurin = ["A.H EL BOSQUE", "A.H LAS LADERAS DE PACHACAMAC", "A.H VILLA ALEJANDRO", "AGRUPACION AGROPECUARIA JOSE GALVEZ", "ASC. VILLA DE GUERRA", "CASA CLUB LAS PALMAS", "CITV VILLA SUR PACHACAMAC", "JOSE GALVEZ", "LADERAS DE PACHACAMAC", "LADERAS DE PACHACAMAC 4TA ETAPA", "LADERAS DE PACHACAMAC SECTOR C", "LAS PALMAS", "RESIDENCIAL SANTISIMO SALVADOR DE LAS PALMAS", "RESIDENCIAL ZARUMILLA", "SAENZ PEÑA", "URBANIZACION PACHACAMAC", "VILLA LAS PALMAS", "VILLA VERDE DE PACHACAMAC", "SIN COBERTURA", "OTRO"];
    let condominiosLurin = ["CONDOMINIO LAS PALMAS", "SIN COBERTURA", "OTRO"];

    let esLurin = (zonaActual === "Lurin" || zonaActual === "lurin");
    let lista = [];

    if (esLurin) {
        lista = tipo === "Condominio" ? condominiosLurin : casasLurin;
    } else {
        lista = tipo === "Condominio" ? condominiosNorte : casasNorte;
    }

    let html = "";
    lista.forEach(z => { html += `<option value="${z}">${z}</option>`; });
    selectZona.innerHTML = html;
};

// ============================================================ //
// MODALES TAREAS Y VIVIENDAS                                   //
// ============================================================ //
window.abrirModal = () => {
    try {
        if (isAdmin || isWilton) zonaActual = document.getElementById("selectorZona").value;

        document.getElementById("formTrabajoId").value = "";
        document.getElementById("formEstadoActual").value = "";
        document.getElementById("modalTitulo").innerHTML = `<i class="fa-solid fa-plus-circle"></i> Registro de Tarea`;

        document.querySelectorAll(
            "#modalAgregar input[type=text]:not(.multi-select-display), #modalAgregar input[type=number], #modalAgregar input[type=email], #modalAgregar textarea"
        ).forEach((i) => (i.value = ""));

        // Limpiamos la foto de fachada para que no se herede de la venta anterior
        if(typeof window.limpiarFotoFachada === 'function') window.limpiarFotoFachada();

        document.getElementById("formFecha").value = new Date().toISOString().split("T")[0];
        document.getElementById("searchResult").innerText = "";
        if(document.getElementById("seccionBitacora")) document.getElementById("seccionBitacora").style.display = "none";

        document.getElementById("formTipoDoc").value = "DNI";
        // 🔥 FIX: Hacemos que el modal detecte automáticamente la zona en la que estás
        document.getElementById("formSedeVenta").value = (zonaActual === "Lurin" || zonaActual === "lurin") ? "Lurin" : "Norte";
        if(document.getElementById("formZonaOtros")) document.getElementById("formZonaOtros").value = (zonaActual === "Lurin" || zonaActual === "lurin") ? "Lurin" : "Norte";
        document.getElementById("formTipoServicio").value = "Internet Solo";
        
        let planesGuardados = window.obtenerPlanesGlobales();
        let planSelect = document.getElementById("formPlanVenta");
        if (planSelect) {
            if (planesGuardados && planesGuardados.length > 0) {
                let p0 = planesGuardados[0];
                planSelect.value = `${p0.precio}|${p0.nombre}`;
            } else {
                planSelect.value = "50|PLAN S/. 50 BASICO 2";
            }
        }
        
        document.getElementById("formPeriodo").value = "Quincenal";
        document.getElementById("formComprobante").value = "Boleta";
        // INYECCIÓN PARA COMISIONES
        if(document.getElementById("formTipoVivienda")) {
            document.getElementById("formTipoVivienda").value = "Casa Propia";
            window.actualizarListaZonas();
        if(document.getElementById("formTipoViviendaOtros")) {
            document.getElementById("formTipoViviendaOtros").value = "Casa Propia";
            window.actualizarListaZonasOtros();
        }
        }

        document.querySelectorAll(".chk-extra").forEach((c) => (c.checked = false));
        if (document.getElementById("equiposDisplay")) document.getElementById("equiposDisplay").innerText = "Ninguno";
        
        // 🔥 REFUERZO DE LIMPIEZA TOTAL PARA LA PESTAÑA "OTROS"
        if (document.getElementById("formTipoOtros")) document.getElementById("formTipoOtros").value = "Limpieza de caja";
        if (document.getElementById("formCantPuertos")) document.getElementById("formCantPuertos").value = "0";
        if (document.getElementById("puertosContainer")) document.getElementById("puertosContainer").innerHTML = "";
        if (document.getElementById("formSenalCajaOtros")) document.getElementById("formSenalCajaOtros").value = "";
        if (document.getElementById("formCajaOtros")) document.getElementById("formCajaOtros").value = "";
        if (document.getElementById("formLinkCajaOtros")) document.getElementById("formLinkCajaOtros").value = "";
        if (document.getElementById("formIdenMufaNombre")) {
            document.getElementById("formIdenMufaNombre").value = "";
            document.getElementById("formIdenMufaMapa").value = "";
            document.getElementById("mufaIngreso").value = "";
            document.getElementById("mufaIngresoObs").value = "";
            document.getElementById("mufaSalida1").value = "";
            document.getElementById("mufaSalida2").value = "";
            document.getElementById("mufaSalida3").value = "";
            document.getElementById("mufaSalida4").value = "";
            document.getElementById("mufaSalidaObs1").value = "";
            document.getElementById("mufaSalidaObs2").value = "";
            document.getElementById("mufaSalidaObs3").value = "";
            document.getElementById("mufaSalidaObs4").value = "";
            document.getElementById("mufaSplitter1").value = "";
            document.getElementById("mufaSplitter2").value = "";
            document.getElementById("mufaSplitterObs").value = "";
        }

        window.calcularPrecioTotal();
        actualizarSelectTecnicosModal();
        
        try { window.seleccionarTipoTarea("alta"); } catch (e) {}

        let isTecnicoCampo = !isAdmin && !isAdminLurin && !isWilton && !isCarlos && !isVendedor && !isCobranzas;

        // Variables de los bloques del modal
        let tabs = document.querySelector(".modal-tabs");
        let asignacion = document.getElementById("grupoAsignacionTecnico");
        let techGroup = document.getElementById("techSelectContainer") ? document.getElementById("techSelectContainer").parentElement : null;
        let sede = document.getElementById("grupoSedeVenta");
        
        // Estos son los BOTONES de las pestañas
        let averia = document.getElementById("tabAveria");
        let baja = document.getElementById("tabBaja");
        let otros = document.getElementById("tabOtros");
        let ventaEq = document.getElementById("tabVentaEquipos");
        let otrosInput = document.getElementById("formTipoOtros");

        // RESETEO: Mostramos bloque de asignación y técnicos por defecto para todos
        if (asignacion) asignacion.style.display = "block";
        if (techGroup) techGroup.style.display = "block";

        if (isTecnicoCampo) {
            // Técnicos no ven este modal, pero si lo abren por consola, se les bloquea visualmente
            if (tabs) tabs.style.setProperty("display", "none", "important");
            if (asignacion) asignacion.style.display = "none";
            if (sede) sede.style.display = "none";
            if (otrosInput) otrosInput.disabled = true; 
            
            if (ventaEq) ventaEq.style.display = "none";
            if (averia) averia.style.display = "none";
            if (baja) baja.style.display = "none";
            if (otros) otros.style.display = "none";
            
            document.getElementById("modalTitulo").innerHTML = "⚙️ Completar Datos";
            
        } else if (isCarlos) { 
            // Coordinadores de Ventas: Ven pestañas de Alta, Baja y Venta de Equipos
            if (tabs) tabs.style.display = "flex";
            if (techGroup) techGroup.style.display = "none"; 
            
            // Apagamos los botones de pestañas que no les corresponden
            if (averia) averia.style.display = "none";
            if (otros) otros.style.display = "none";
            
            // Encendemos Alta (por defecto), Baja y Venta de Equipos
            if (baja) baja.style.display = "inline-block";
            if (ventaEq) ventaEq.style.display = "inline-block";
            
            if (sede) sede.style.display = "block";
            if (otrosInput) otrosInput.disabled = false;
            document.getElementById("modalTitulo").innerHTML = "<i class='fa-solid fa-plus-circle'></i> Registro Comercial";
            
        } else if (isVendedor) {
            // Vendedor de campo (básico): Sigue bloqueado solo en Altas (No ve pestañas)
            if (tabs) tabs.style.setProperty("display", "none", "important");
            if (techGroup) techGroup.style.display = "none";
            if (sede) sede.style.display = "none";
            if (otrosInput) otrosInput.disabled = true;
            
            // 🔥 APAGAMOS TODOS LOS BOTONES MANUALMENTE PARA VENCER AL CSS 🔥
            if (ventaEq) ventaEq.style.display = "none";
            if (averia) averia.style.display = "none";
            if (baja) baja.style.display = "none";
            if (otros) otros.style.display = "none";
            
            document.getElementById("modalTitulo").innerHTML = "<i class='fa-solid fa-rocket'></i> Registrar Nueva Venta";
            
        } else if (isCobranzas) {
            // Cobranzas tiene acceso a Averías y Bajas también
            if (tabs) tabs.style.display = "flex";
            if (techGroup) techGroup.style.display = "none"; 
            
            if (averia) averia.style.display = "inline-block";  
            if (baja) baja.style.display = "inline-block";      
            if (otros) otros.style.display = "none"; 
            if (ventaEq) ventaEq.style.display = "inline-block";
            
            if (sede) sede.style.display = "block";
            if (otrosInput) otrosInput.disabled = false;
            document.getElementById("modalTitulo").innerHTML = "<i class='fa-solid fa-plus-circle'></i> Gestión de Cobranzas";
            
        } else {
            // Admin y NOC (Soporte)
            if (tabs) tabs.style.display = "flex";
            if (averia) averia.style.display = "inline-block";
            if (baja) baja.style.display = "inline-block";
            if (otros) otros.style.display = "inline-block";
            
            if (sede) sede.style.display = "none";
            if (otrosInput) otrosInput.disabled = false;
            
            // Solo Administradores ven la Venta de Equipos
            if (ventaEq) ventaEq.style.display = (isAdmin || isAdminLurin) ? "inline-block" : "none";
            document.getElementById("modalTitulo").innerHTML = "<i class='fa-solid fa-plus-circle'></i> Registro de Tarea";
        }

        document.querySelectorAll(".chk-venta-alta").forEach((c) => (c.checked = false));
        if (document.getElementById("ventasEqDisplay")) document.getElementById("ventasEqDisplay").innerText = "Ninguna venta";
        if (document.getElementById("cajaPagoVentaEq")) document.getElementById("cajaPagoVentaEq").style.display = "none";

        document.querySelectorAll(".chk-servicio-mensual").forEach((c) => (c.checked = false));
        if(document.getElementById("formServicioMensualTotal")) document.getElementById("formServicioMensualTotal").innerText = "+ S/ 0.00";
        if (document.getElementById("formVendedorAlta")) document.getElementById("formVendedorAlta").value = "";

        let modal = document.getElementById("modalAgregar");
        if (modal) modal.style.display = "flex";
    } catch (error) { console.error("❌ Error al abrir modal:", error); }
};

window.editarTrabajo = (id) => {
    let t = dbTrabajos.find((x) => x.id === id);
    if (!t) return;

    window.abrirModal();

    let isTecnicoCampo = !isAdmin && !isAdminLurin && !isWilton && !isCarlos && !isVendedor && !isCobranzas;

    // 🔥 FIX VITAL: Bloqueo visual estricto para Técnicos
    if (isTecnicoCampo) {
        document.getElementById("modalTitulo").innerHTML = "⚙️ Llenar Puertos / Señal";
        let tabs = document.querySelector("#modalAgregar .modal-tabs");
        if (tabs) tabs.style.display = "none";
        // Forzar ocultamiento de los botones de tipo (Alta, Avería, etc.)
        document.querySelectorAll("#modalAgregar .tab-btn").forEach(b => b.style.display = "none");
    } else {
        document.getElementById("modalTitulo").innerHTML = "✏️ Editar Tarea";
    }

    document.getElementById("formTrabajoId").value = t.id;
    document.getElementById("formEstadoActual").value = t.estado || "";
    // Mostrar la bitácora e inyectarle los comentarios existentes
    if(document.getElementById("seccionBitacora")) {
        document.getElementById("seccionBitacora").style.display = "block";
        if (typeof window.renderizarBitacoraVisual === "function") {
    window.renderizarBitacoraVisual(t.historialBitacora || t.bitacora);
} else {
    window.renderizarBitacora(t.bitacora);
}
    }
    window.seleccionarTipoTarea(t.tipoTarea || "alta");

    if ((isWilton || isAdmin || isAdminLurin) && t.estado === "aprobada_wilton") {
        document.getElementById("formFecha").value = new Date().toISOString().split("T")[0];
    } else {
        document.getElementById("formFecha").value = t.fecha || new Date().toISOString().split("T")[0];
    }

    document.getElementById("formHoraInicio").value = t.horaInicio || "";
    document.getElementById("formHoraFin").value = t.horaFin || "";

    if (t.tecnicos && Array.isArray(t.tecnicos)) {
        document.querySelectorAll("#techDropdown input").forEach((chk) => {
            if (t.tecnicos.includes(chk.value)) chk.checked = true;
        });
        let chks = document.querySelectorAll("#techDropdown input:checked");
        document.getElementById("techDisplay").innerText = chks.length === 0 ? "Sin Asignar" : Array.from(chks).map((c) => c.value).join(", ");
    }

    if (t.tipoTarea === "otros") {
        if(document.getElementById("formTipoViviendaOtros")) {
            document.getElementById("formTipoViviendaOtros").value = t.tipoVivienda || "Casa Propia";
            window.actualizarListaZonasOtros();
            if(document.getElementById("formSubZonaOtros")) document.getElementById("formSubZonaOtros").value = t.subZona || "OTRO";
        }
        document.getElementById("formTipoOtros").value = t.detalle || "Limpieza de caja";
        window.cambiarSubtipoOtros();

        if (t.detalle === "Limpieza de caja") {
            document.getElementById("formCajaOtros").value = t.caja || "";
            document.getElementById("formLinkCajaOtros").value = t.linkCaja || "";
            document.getElementById("formCantPuertos").value = t.cantPuertos || "0";
            document.getElementById("formSenalCajaOtros").value = t.senalCaja || ""; 

            // 🛡️ BLOQUEO ESTRUCTURAL CORREGIDO
            if (isTecnicoCampo) {
                // Bloqueamos nombre de caja y link (Solo NOC los define)
                document.getElementById("formCajaOtros").readOnly = true;
                document.getElementById("formCajaOtros").style.background = "rgba(0,0,0,0.05)";
                document.getElementById("formLinkCajaOtros").readOnly = true;
                document.getElementById("formLinkCajaOtros").style.background = "rgba(0,0,0,0.05)";
                
                // ✅ LIBERAMOS LA CANTIDAD DE PUERTOS PARA EL TÉCNICO
                document.getElementById("formCantPuertos").style.pointerEvents = "auto";
                document.getElementById("formCantPuertos").style.background = "";
            } else {
                document.getElementById("formCajaOtros").readOnly = false;
                document.getElementById("formCajaOtros").style.background = "";
                document.getElementById("formLinkCajaOtros").readOnly = false;
                document.getElementById("formLinkCajaOtros").style.background = "";
                document.getElementById("formCantPuertos").style.pointerEvents = "auto";
                document.getElementById("formCantPuertos").style.background = "";
            }

            window.generarPuertos();
            if (t.puertosData && Array.isArray(t.puertosData)) {
                t.puertosData.forEach(p => {
                    let inputId = document.getElementById(`puertoId_${p.puerto}`);
                    let inputNom = document.getElementById(`puertoNombre_${p.puerto}`);
                    if (inputId) inputId.value = p.idDni || "";
                    if (inputNom) inputNom.value = p.nombre || "";
                });
            }
        } else if (t.detalle === "Seguimiento de fibra") {
                document.getElementById("formClienteFibra").value = t.cliente || "";
                document.getElementById("formDniFibra").value = t.dni || "";
                document.getElementById("formPlanFibra").value = t.plan || "";
                document.getElementById("formEquiposFibra").value = t.equipos || "";
                document.getElementById("formLinkInicioFibra").value = t.linkCaja || "";
                document.getElementById("formLinkFinFibra").value = t.mapa || "";
                
            // 🔥 AQUÍ AGREGAMOS LA MEMORIA PARA TODOS LOS DEMÁS TRABAJOS 🔥
            } else if (t.detalle === "Tendido de fibra") {
                document.getElementById("formTendidoTipo").value = t.tipoTendido || "Aéreo (Postes)";
                document.getElementById("formTendidoMetros").value = t.metraje || "";
                document.getElementById("formTendidoCable").value = t.cable || "ADSS";
                document.getElementById("formTendidoRuta").value = t.dir || "";
                document.getElementById("formTendidoMapa").value = t.mapa || "";
                
            } else if (t.detalle === "Activación de mufa") {
                document.getElementById("formMufaCodigo").value = t.caja || "";
                document.getElementById("formMufaFusiones").value = t.cantPuertos || "";
                document.getElementById("formMufaUbicacion").value = t.mapa || "";
                
            } else if (t.detalle === "Activación de caja NAP") {
                document.getElementById("formActNapCodigo").value = t.caja || "";
                document.getElementById("formActNapSplitter").value = t.equipos || "1x4";
                document.getElementById("formActNapInput").value = t.tx || "";
                document.getElementById("formActNapOutput").value = t.rx || "";
                document.getElementById("formActNapMapa").value = t.mapa || "";
                
            } else if (t.detalle === "Reparación de fibra") {
                document.getElementById("formReparacionCausa").value = t.causaRotura || "Desconocido";
                document.getElementById("formReparacionDistancia").value = t.metraje || "";
                document.getElementById("formReparacionUbicacion").value = t.mapa || "";
                
            } else if (t.detalle === "Supervisión de zona") {
                document.getElementById("formSupZona").value = t.cliente || "";
                document.getElementById("formSupResultado").value = t.estadoSup || "✅ Aprobado";
                document.getElementById("formSupFallas").value = t.notas || "";
                document.getElementById("formSupMapa").value = t.mapa || "";
                
            } else if (t.detalle === "Especificar Otros") {
                document.getElementById("formEspecificarTexto").value = t.notas || "";
                document.getElementById("formEspecificarMapa").value = t.mapa || "";
                
            } else if (t.detalle === "Identificación de hilos en CTO") {
            document.getElementById("formIdenCaja").value = t.caja || "";
            if(document.getElementById("formIdenMapa")) document.getElementById("formIdenMapa").value = t.mapa || ""; // NUEVO: Carga el link
            
            if (t.fibraIngreso || t.fibraSalida) {
                document.getElementById("cajaIdenResultadosAdmin").style.display = "flex";
                document.getElementById("formIdenIngresoAdmin").value = t.fibraIngreso || "";
                document.getElementById("formIdenSalidaAdmin").value = t.fibraSalida || "";
                
                // Bloqueo estricto: Los técnicos no pueden alterar el resultado final desde la edición
                if (isTecnicoCampo) {
                    document.getElementById("formIdenIngresoAdmin").readOnly = true;
                    document.getElementById("formIdenSalidaAdmin").readOnly = true;
                } else {
                    document.getElementById("formIdenIngresoAdmin").readOnly = false;
                    document.getElementById("formIdenSalidaAdmin").readOnly = false;
                }
            } else {
                document.getElementById("cajaIdenResultadosAdmin").style.display = "none";
            }
            } else if (t.detalle === "Identificación de hilos en mufa") {
            document.getElementById("formIdenMufaNombre").value = t.caja || "";
            document.getElementById("formIdenMufaMapa").value = t.mapa || "";
            
            document.getElementById("mufaIngreso").value = t.mufaIngreso || "";
            document.getElementById("mufaIngresoObs").value = t.mufaIngresoObs || "";
            document.getElementById("mufaSalida1").value = t.mufaSalida1 || "";
            document.getElementById("mufaSalida2").value = t.mufaSalida2 || "";
            document.getElementById("mufaSalida3").value = t.mufaSalida3 || "";
            document.getElementById("mufaSalida4").value = t.mufaSalida4 || "";
            
            // 🔥 AQUÍ SE CARGAN LOS 4 COMENTARIOS NUEVOS 🔥
            document.getElementById("mufaSalidaObs1").value = t.mufaSalidaObs1 || "";
            document.getElementById("mufaSalidaObs2").value = t.mufaSalidaObs2 || "";
            document.getElementById("mufaSalidaObs3").value = t.mufaSalidaObs3 || "";
            document.getElementById("mufaSalidaObs4").value = t.mufaSalidaObs4 || "";
            
            document.getElementById("mufaSplitter1").value = t.mufaSplitter1 || "";
            document.getElementById("mufaSplitter2").value = t.mufaSplitter2 || "";
            document.getElementById("mufaSplitterObs").value = t.mufaSplitterObs || "";

            let isTecnicoCampo = !isAdmin && !isAdminLurin && !isWilton && !isCarlos && !isVendedor && !isCobranzas;

            // El técnico no puede modificar el nombre de la mufa ni el mapa que puso el NOC
            if (isTecnicoCampo) {
                document.getElementById("formIdenMufaNombre").readOnly = true;
                document.getElementById("formIdenMufaMapa").readOnly = true;
            } else {
                document.getElementById("formIdenMufaNombre").readOnly = false;
                document.getElementById("formIdenMufaMapa").readOnly = false;
            }
        }
    } else {
        document.getElementById("formTipoDoc").value = t.tipoDoc || "DNI";
        document.getElementById("formNombre").value = t.cliente || "";
        document.getElementById("formDni").value = t.dni || "";
        document.getElementById("formCorreo").value = t.correo || "";
        
        let selectVendedor = document.getElementById("formVendedorAlta");
        if (selectVendedor) {
            // Si el vendedor antiguo de esta venta no está en la lista actual, lo agregamos temporalmente para que aparezca
            let existe = Array.from(selectVendedor.options).some(opt => opt.value === t.vendedor);
            if (t.vendedor && !existe) {
                selectVendedor.innerHTML += `<option value="${t.vendedor}">${t.vendedor} (Antiguo)</option>`;
            }
            selectVendedor.value = t.vendedor || "";
        }
        
        document.getElementById("formSedeVenta").value = t.zona === "Lurin" ? "Lurin" : "Norte";

        let telsArray = (t.tel || "").split(" / ");
        document.getElementById("formTelefonoPrincipal").value = telsArray[0] || "";
        document.getElementById("formTelefonoSecundario").value = telsArray.slice(1).join(" / ") || "";

        document.getElementById("formDireccion").value = t.dir || "";
        document.getElementById("formReferencia").value = t.referencia || "";
        document.getElementById("formMapa").value = t.mapa || "";
        document.getElementById("formCajaAlta").value = t.caja || "";
        document.getElementById("formPuertoAlta").value = t.puerto || "";
        document.getElementById("formLinkCaja").value = t.linkCaja || "";

        // 🔥 NUEVO: Cargar Vivienda y Zona Exacta para TODOS los trabajos
        if(document.getElementById("formTipoVivienda")) {
            document.getElementById("formTipoVivienda").value = t.tipoVivienda || "Casa Propia";
            if(typeof window.actualizarListaZonas === 'function') window.actualizarListaZonas();
            if(document.getElementById("formSubZona")) document.getElementById("formSubZona").value = t.subZona || "OTRO";
        }

        // 🔥 LÓGICA PARA CARGAR LA FOTO EXISTENTE
        let hiddenFoto = document.getElementById("formFotoFachadaExistente");
        let contenedorFoto = document.getElementById("lblFachadaContenedor");
        let txtFoto = document.getElementById("lblFachadaTxt");
        
        if (t.fotosFachada && t.fotosFachada.length > 0) {
            if(hiddenFoto) hiddenFoto.value = JSON.stringify(t.fotosFachada);
            if(contenedorFoto) contenedorFoto.style.display = "flex";
            if(txtFoto) txtFoto.innerHTML = `<a href="${t.fotosFachada[0]}" target="_blank" style="color: var(--success); text-decoration: underline;">✅ Ver Foto Guardada</a>`;
        } else {
            if(hiddenFoto) hiddenFoto.value = "";
            if(typeof window.limpiarFotoFachada === 'function') window.limpiarFotoFachada();
        }

        if (t.tipoTarea === "alta") {
            document.getElementById("formTipoServicio").value = t.tipoServicio || "Internet Solo";
            window.calcularPrecioTotal();
            document.getElementById("formPlanVenta").value = t.rawServ || "50|PLAN S/. 50 BASICO 2";
            document.getElementById("formPeriodo").value = t.periodo || "Quincenal";
            document.getElementById("formComprobante").value = t.comprobante || "Boleta";

            document.querySelectorAll(".chk-extra").forEach((c) => (c.checked = false));
            if (t.rawExtras && Array.isArray(t.rawExtras)) {
                t.rawExtras.forEach((val) => {
                    let chk = document.querySelector(`.chk-extra[value="${val}"]`);
                    if (chk) chk.checked = true;
                });
            }

            if(typeof window.actualizarTextoEquipos === 'function') window.actualizarTextoEquipos();

            document.querySelectorAll(".chk-venta-alta").forEach((c) => (c.checked = false));
            if (t.ventasAlta && Array.isArray(t.ventasAlta)) {
                t.ventasAlta.forEach((val) => {
                    let chk = document.querySelector(`.chk-venta-alta[value="${val}"]`);
                    if (chk) chk.checked = true;
                });
            }
            if (t.ventasAltaPago && document.getElementById("formAltaVentaEqPago")) {
                document.getElementById("formAltaVentaEqPago").value = t.ventasAltaPago;
            }
            if(typeof window.actualizarTextoVentasEq === 'function') window.actualizarTextoVentasEq();

            document.getElementById("formObsAlta").value = t.notasBase || t.notas || "";
            window.calcularPrecioTotal();
        } else if (t.tipoTarea === "averia") {
            const selectAveria = document.getElementById("formProblemaAveria");
            const inputOtros = document.getElementById("formProblemaOtros");
            
            let opcionesValidas = Array.from(selectAveria.options).map(opt => opt.value);
            
            if (opcionesValidas.includes(t.detalle)) {
                selectAveria.value = t.detalle;
                if(inputOtros) inputOtros.style.display = "none";
            } else {
                selectAveria.value = "Otros";
                if(inputOtros) {
                    inputOtros.style.display = "block";
                    inputOtros.value = t.detalle || "";
                }
            }
            
            document.getElementById("formNotasAveria").value = t.notas || "";
            document.getElementById("formInfoRedAveria").value = t.infoRed || "";
        } else if (t.tipoTarea === "baja") {
            document.getElementById("formMotivoBaja").value = t.notas || "";
            document.getElementById("formEquiposBaja").value = t.equipos || "";
        } else if (t.tipoTarea === "venta_equipos") {
            // 1. Limpiamos todos los checks y ocultamos las cajas de metros
            document.querySelectorAll(".chk-venta-eq").forEach(c => {
                c.checked = false;
                if (c.value === "Cableado Coaxial") {
                    document.getElementById("metrosCoaxial").style.display = "none";
                    document.getElementById("metrosCoaxial").value = "";
                }
                if (c.value === "Cableado Ethernet") {
                    document.getElementById("metrosEthernet").style.display = "none";
                    document.getElementById("metrosEthernet").value = "";
                }
            });
            
            // 2. Volvemos a marcar los equipos y RECUPERAR METRAJES EN LA CAJITA
            if (t.equiposVenta && Array.isArray(t.equiposVenta)) {
                t.equiposVenta.forEach(val => {
                    let chk = document.querySelector(`.chk-venta-eq[value="${val}"]`);
                    if(chk) {
                        chk.checked = true;
                        
                        // Si es cable, abrimos la caja e inyectamos el número guardado
                        if (val === "Cableado Coaxial") {
                            let inputCoax = document.getElementById("metrosCoaxial");
                            inputCoax.style.display = "block";
                            inputCoax.value = t.metrosCoaxialGuardado || "";
                        }
                        if (val === "Cableado Ethernet") {
                            let inputEth = document.getElementById("metrosEthernet");
                            inputEth.style.display = "block";
                            inputEth.value = t.metrosEthernetGuardado || "";
                        }
                    }
                });
            }

            // 3. Cargar servicios mensuales (Alquileres)
            document.querySelectorAll(".chk-servicio-mensual").forEach(c => c.checked = false);
            if (t.serviciosMensuales && Array.isArray(t.serviciosMensuales)) {
                t.serviciosMensuales.forEach(val => {
                    let chk = document.querySelector(`.chk-servicio-mensual[value="${val}"]`);
                    if(chk) chk.checked = true;
                });
            }

            // 4. Recalculamos los totales para que la plata cuadre
            if(typeof window.calcularVentaEquipos === 'function') window.calcularVentaEquipos();
            
            document.getElementById("formVentaEqPago").value = t.metodoPago || "Efectivo / Yape directo al Técnico";
            
            // 5. Recuperar la nota pura que escribió el vendedor
            let notaPura = t.notasOriginalesVenta || "";
            if (!notaPura && t.notas) {
                if (t.notas.includes("📝 Obs: ")) {
                    notaPura = t.notas.split("📝 Obs: ")[1] || "";
                } else if (!t.notas.includes("💰 Cobro") && !t.notas.includes("💳 Pago")) {
                    notaPura = t.notas;
                }
            }
            document.getElementById("formVentaEqNotas").value = notaPura.trim();
        }
    }
};

// ============================================================ //
// 🔥 ESCUDO SMART OLT: VALIDADOR DE PUERTOS EN TIEMPO REAL 🔥  //
// ============================================================ //
window.verificarEstadoPuerto = (cajaBuscada, puertoBuscado, idExcluir = null) => {
    cajaBuscada = String(cajaBuscada).toUpperCase().trim();
    puertoBuscado = parseInt(puertoBuscado);
    if (!cajaBuscada || isNaN(puertoBuscado) || puertoBuscado <= 0) return { disponible: true };

    let mapOcupados = {};
    let capacidadCaja = 16; // Por defecto
    let zonaActiva = localStorage.getItem("ten_zona_activa") || "norte"; // 👈 ESCUDO DE ZONA

    // 1. Extraer los ocupados de la Auditoría Técnica (Limpieza de Caja)
    let limpiezas = dbTrabajos.filter(t => 
        t.tipoTarea === "otros" && 
        t.detalle === "Limpieza de caja" && 
        String(t.caja).toUpperCase().trim() === cajaBuscada && 
        t.estado === "atendido" &&
        (t.zona || "norte").toLowerCase() === zonaActiva.toLowerCase() // 👈 SOLO DE MI ZONA
    );
    limpiezas.sort((a, b) => (b.tsFin || 0) - (a.tsFin || 0));
    
    if (limpiezas.length > 0) {
        capacidadCaja = parseInt(limpiezas[0].cantPuertos) || 16;
        if (limpiezas[0].puertosData && Array.isArray(limpiezas[0].puertosData)) {
            limpiezas[0].puertosData.forEach(p => {
                if (p.nombre || p.idDni) mapOcupados[p.puerto] = `Ocupado en Auditoría (${p.nombre || p.idDni})`;
            });
        }
    } 

    // 2. Extraer los ocupados por Altas Nuevas y TRASLADOS
    dbTrabajos.forEach(t => {
        if (t.id === idExcluir) return; // Ignora el trabajo que estamos editando actualmente
        if ((t.zona || "norte").toLowerCase() !== zonaActiva.toLowerCase()) return; // 👈 IGNORA OTRAS ZONAS
        
        let esTrasladoVerif = (t.tipoTarea === "averia" && t.detalle && t.detalle.includes("Traslado"));
        
        if ((t.tipoTarea === "alta" || esTrasladoVerif) && String(t.caja).toUpperCase().trim() === cajaBuscada) {
            if (t.estado !== "rechazada" && t.estado !== "no_realizado" && t.estado !== "no_atendido") {
                let pFb = parseInt(t.puerto);
                if (pFb > 0) {
                    let accionTxt = t.tipoTarea === "alta" ? "Instalación" : "Traslado";
                    mapOcupados[pFb] = `Asignado a ${accionTxt} en curso (${t.cliente})`;
                }
            }
        }
    });

    // 3. VEREDICTO FINAL
    if (puertoBuscado > capacidadCaja) {
        return { disponible: false, motivo: `La caja <b>${cajaBuscada}</b> solo tiene <b>${capacidadCaja} puertos</b> en total.` };
    }

    if (mapOcupados[puertoBuscado]) {
        let libresSugeridos = [];
        for (let i = 1; i <= capacidadCaja; i++) {
            if (!mapOcupados[i]) libresSugeridos.push(i);
            if (libresSugeridos.length >= 3) break; 
        }
        let sugerencia = libresSugeridos.length > 0 ? `<br><br>💡 <b>Puertos libres sugeridos:</b> ${libresSugeridos.join(", ")}` : `<br><br>⚠️ <b>¡ATENCIÓN: La caja parece estar LLENA!</b>`;
        
        return { disponible: false, motivo: `Motivo: ${mapOcupados[puertoBuscado]}${sugerencia}` };
    }

    return { disponible: true };
};

window.guardarTrabajo = async () => {
    let btnGuardar = document.querySelector("#modalAgregar .btn-guardar");
    if(btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '⏳ Guardando...';
    }

    let tipo = document.getElementById("formTipoTareaValue").value;

    // 👇🔥 ESCUDO SMART OLT REFORZADO - COLOCADO AL INICIO 🔥👇
    let problemaAveriaValidar = document.getElementById("formProblemaAveria") ? document.getElementById("formProblemaAveria").value : "";
    let esTrasladoValidar = (tipo === "averia" && problemaAveriaValidar.includes("Traslado"));
    let estadoPrevioEscudo = document.getElementById("formEstadoActual") ? document.getElementById("formEstadoActual").value : "";

    // 🔥 REGLA: Si la orden ya fue ATENDIDA, apagamos el escudo para dejar editar el nombre/teléfono
    if ((tipo === "alta" || esTrasladoValidar) && estadoPrevioEscudo !== "atendido") {
        let cajaValidar = document.getElementById("formCajaAlta") ? document.getElementById("formCajaAlta").value.trim().toUpperCase() : "";
        let puertoText = document.getElementById("formPuertoAlta") ? document.getElementById("formPuertoAlta").value.trim() : "";
        let puertoValidar = parseInt(puertoText);
        let idTrabajoValidar = document.getElementById("formTrabajoId") ? document.getElementById("formTrabajoId").value : "";

        if (cajaValidar !== "" && puertoText !== "" && !isNaN(puertoValidar) && puertoValidar > 0) {
            let checkPuerto = window.verificarEstadoPuerto(cajaValidar, puertoValidar, idTrabajoValidar);
            if (!checkPuerto.disponible) {
                if(typeof window.sacudirModal === 'function') window.sacudirModal('modalAgregar');
                mostrarToast(`❌ <b>ERROR DE INVENTARIO:</b><br>El puerto ${puertoValidar} de la caja ${cajaValidar} YA ESTÁ OCUPADO.<br><br>${checkPuerto.motivo}`);
                
                if(btnGuardar) { btnGuardar.disabled = false; btnGuardar.innerText = 'Guardar Tarea'; }
                return; 
            }
        }
    }
    // 👆🔥 FIN DEL ESCUDO 🔥👆

    let urlsFachada = [];
    let flagExistente = document.getElementById("formFotoFachadaExistente") ? document.getElementById("formFotoFachadaExistente").value : "";
    const fileInputFachada = document.getElementById("formFotosFachada");
    
    if (fileInputFachada && fileInputFachada.files.length > 0) {
        btnGuardar.innerText = "⏳ Subiendo foto de fachada...";
        try {
            const { getStorage, ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js");
            const storage = getStorage();
            for (let i = 0; i < fileInputFachada.files.length; i++) {
                const file = fileInputFachada.files[i];
                const storageRef = ref(storage, `fachadas_ventas/${Date.now()}_${i}`);
                await uploadBytes(storageRef, file);
                urlsFachada.push(await getDownloadURL(storageRef));
            }
        } catch(e) { console.error("Error subiendo foto de fachada", e); }
    } else if (flagExistente && flagExistente !== "BORRAR") {
        try { urlsFachada = JSON.parse(flagExistente); } catch(e) {}
    }

    let techSelec = Array.from(document.querySelectorAll("#techDropdown input:checked")).map((c) => c.value);
    if (techSelec.length === 0) techSelec = ["Sin Asignar"];

    let telPrin = document.getElementById("formTelefonoPrincipal").value.trim();
    let telSec = document.getElementById("formTelefonoSecundario").value.trim();
    let telFinal = telPrin;
    if (telSec) telFinal += " / " + telSec;

    // 🔥 FIX 3.0: ASIGNACIÓN DE ZONA ABSOLUTA (JERARQUÍA ESTRICTA)
    let zonaAGuardar = "Norte"; // Fallback de seguridad inicial

    // 1. Extraemos el rol base para saber qué permisos tiene
    let rolActualSistema = localStorage.getItem('ten_rol');
    let esPersonalOficina = (isAdmin || isAdminLurin || isWilton || isCarlos || isCobranzas || rolActualSistema === 'ventas' || rolActualSistema === 'admin');

    if (esPersonalOficina) {
        // REGLA A: Si es de oficina, MANDA EL BOTÓN DESPLEGABLE SUPERIOR (Selector Maestro)
        let selectorMaestro = document.getElementById("selectorZona");
        
        if (selectorMaestro) {
            zonaAGuardar = selectorMaestro.value; 
        } else {
            zonaAGuardar = zonaActual; // Respaldo si no encuentra el botón
        }

        // 🔥 FIX: Le damos prioridad al menú del modal para TODAS las tareas (excepto "otros" que está oculto),
            // así lo que el usuario ve en la casilla "Sede (Zona)" es exactamente donde se guarda.
            let sedeModal = document.getElementById("formSedeVenta");
            if (sedeModal && tipo !== "otros" && sedeModal.value) {
                zonaAGuardar = sedeModal.value;
            }
    } else {
        // REGLA B: Si es un Técnico de campo o un Vendedor simple, NO puede cambiar de zona
        // Estará siempre amarrado al universo que le asignó el sistema al iniciar sesión
        zonaAGuardar = zonaActual;
    }

    // 2. Normalización de formato (Vital para que Firebase no se confunda)
    if (zonaAGuardar === "Los Olivos" || zonaAGuardar.toLowerCase() === "norte") {
        zonaAGuardar = "Norte";
    } else if (zonaAGuardar.toLowerCase() === "lurin" || zonaAGuardar.toLowerCase() === "lurín") {
        zonaAGuardar = "Lurin";
    }
    let techParaValidar = Array.from(document.querySelectorAll("#techDropdown input:checked")).map((c) => c.value);
    if (techParaValidar.length === 0) techParaValidar = ["Sin Asignar"];
    let estadoPrevioValidar = document.getElementById("formEstadoActual").value;

    // 🛑 REGLA ESTRICTA NOC: Para programar una Alta O un Traslado
    let esAltaEnProgramacion = (tipo === "alta" && estadoPrevioValidar === "aprobada_wilton");

    if ((esAltaEnProgramacion || esTrasladoValidar) && (isWilton || isAdmin || isAdminLurin) && techParaValidar[0] !== "Sin Asignar") {
        let valCaja = document.getElementById("formCajaAlta").value.trim();
        let valLink = document.getElementById("formLinkCaja").value.trim();
        
        if (!valCaja || !valLink) {
            window.sacudirModal('modalAgregar'); 
            mostrarToast("⚠️ OBLIGATORIO: Debes ingresar el nombre de la Caja NAP y su Link de Maps para asignar al técnico.");
            
            if(btnGuardar) {
                btnGuardar.disabled = false;
                btnGuardar.innerText = 'Guardar Tarea';
            }
            return; 
        }
    }

    let data = {
        tipoTarea: tipo, fecha: document.getElementById("formFecha").value,
        horaInicio: document.getElementById("formHoraInicio").value, horaFin: document.getElementById("formHoraFin").value,
        tecnicos: techSelec, zona: zonaAGuardar,
    };
    
    if (urlsFachada.length > 0) {
        data.fotosFachada = urlsFachada;
    } else if (flagExistente === "BORRAR") {
        data.fotosFachada = []; 
    }

    if (tipo === "otros") {
        let subtipo = document.getElementById("formTipoOtros").value;
        data.detalle = subtipo;
        
        data.cliente = "MANTENIMIENTO DE RED";
        data.dir = "Ubicación Externa / Planta Externa";
        
        if (subtipo === "Limpieza de caja") {
            data.caja = document.getElementById("formCajaOtros").value;
            data.linkCaja = document.getElementById("formLinkCajaOtros").value;
            data.mapa = data.linkCaja; 
            data.senalCaja = document.getElementById("formSenalCajaOtros").value.trim(); 
            data.cliente = data.caja ? `MANT. CAJA: ${data.caja}` : "MANTENIMIENTO DE RED";
            let cant = parseInt(document.getElementById('formCantPuertos').value) || 0;
            data.cantPuertos = cant;
            let puertosArr = [];
            for(let i=1; i<=cant; i++) {
                let pId = document.getElementById(`puertoId_${i}`) ? document.getElementById(`puertoId_${i}`).value : "";
                let pNom = document.getElementById(`puertoNombre_${i}`) ? document.getElementById(`puertoNombre_${i}`).value : "";
                puertosArr.push({ puerto: i, idDni: pId, nombre: pNom });
            }
            data.puertosData = puertosArr;
            data.notas = cant > 0 ? `Limpieza de ${cant} Puertos en Caja.` : "Trabajo de infraestructura.";
        
        } else if (subtipo === "Seguimiento de fibra") {
            data.cliente = document.getElementById("formClienteFibra").value || "Cliente Desconocido";
            data.dni = document.getElementById("formDniFibra").value;
            data.plan = document.getElementById("formPlanFibra").value;
            data.equipos = document.getElementById("formEquiposFibra").value;
            data.linkCaja = document.getElementById("formLinkInicioFibra").value; 
            data.mapa = document.getElementById("formLinkFinFibra").value; 
            data.notas = `Seguimiento Fibra. Plan: ${data.plan}`;
            data.dir = "Revisar tendido de fibra óptica.";
        
        } else if (subtipo === "Tendido de fibra") {
            data.tipoTendido = document.getElementById("formTendidoTipo").value;
            data.metraje = document.getElementById("formTendidoMetros").value;
            data.cable = document.getElementById("formTendidoCable").value;
            data.dir = document.getElementById("formTendidoRuta").value;
            data.mapa = document.getElementById("formTendidoMapa").value;
            data.cliente = data.cable ? `TENDIDO: ${data.cable}` : "TENDIDO DE CABLE";
            data.notas = `Ruta: ${data.dir}`;
            
        } else if (subtipo === "Activación de mufa") {
            data.caja = document.getElementById("formMufaCodigo").value; 
            data.cantPuertos = document.getElementById("formMufaFusiones").value; 
            data.mapa = document.getElementById("formMufaUbicacion").value;
            data.cliente = data.caja ? `MUFA: ${data.caja}` : "EMPALME DE MUFA";
            data.dir = "Ubicación de Mufa";
            data.notas = `Activación de Mufa con ${data.cantPuertos} fusiones.`;
            
        } else if (subtipo === "Activación de caja NAP") {
            data.caja = document.getElementById("formActNapCodigo").value;
            data.equipos = document.getElementById("formActNapSplitter").value; 
            data.tx = document.getElementById("formActNapInput").value; 
            data.rx = document.getElementById("formActNapOutput").value; 
            data.mapa = document.getElementById("formActNapMapa").value;
            data.cliente = data.caja ? `NUEVA CTO: ${data.caja}` : "ACTIVACIÓN NAP";
            data.dir = "Punto NAP";
            data.notas = `Splitter: ${data.equipos} | Troncal: ${data.tx} | Salida: ${data.rx}`;
            
        } else if (subtipo === "Reparación de fibra") {
            data.causaRotura = document.getElementById("formReparacionCausa").value;
            data.metraje = document.getElementById("formReparacionDistancia").value; 
            data.mapa = document.getElementById("formReparacionUbicacion").value;
            data.cliente = "EMERGENCIA: ROTURA FIBRA";
            data.dir = `Falla a ${data.metraje} (OTDR)`;
            data.notas = `Causa detectada: ${data.causaRotura}`;
            
        } else if (subtipo === "Supervisión de zona") {
            data.cliente = document.getElementById("formSupZona").value || "Auditoría de Zona";
            data.estadoSup = document.getElementById("formSupResultado").value;
            data.notas = document.getElementById("formSupFallas").value;
            data.mapa = document.getElementById("formSupMapa").value;
            data.dir = "Inspección de Cuadrilla";

        } else if (subtipo === "Identificación de hilos en CTO") {
            data.caja = document.getElementById("formIdenCaja").value;
            data.mapa = document.getElementById("formIdenMapa") ? document.getElementById("formIdenMapa").value : ""; 
            data.cliente = data.caja ? `CTO: ${data.caja}` : "IDENTIFICACIÓN DE HILOS";
            data.dir = "Ubicación de CTO";
            
            if (document.getElementById("cajaIdenResultadosAdmin").style.display === "flex") {
                data.fibraIngreso = document.getElementById("formIdenIngresoAdmin").value;
                data.fibraSalida = document.getElementById("formIdenSalidaAdmin").value;
            }
            data.notas = document.getElementById("formIdenObs").value;

        } else if (subtipo === "Identificación de hilos en mufa") {
            data.caja = document.getElementById("formIdenMufaNombre").value.trim();
            data.mapa = document.getElementById("formIdenMufaMapa").value.trim();
            data.cliente = data.caja ? `MUFA: ${data.caja}` : "IDENTIFICACIÓN MUFA";
            data.dir = "Ubicación de Mufa";
            
            let vIn = document.getElementById("mufaIngreso").value;
            let vInObs = document.getElementById("mufaIngresoObs").value.trim();
            let vS1 = document.getElementById("mufaSalida1").value;
            let vS2 = document.getElementById("mufaSalida2").value;
            let vS3 = document.getElementById("mufaSalida3").value;
            let vS4 = document.getElementById("mufaSalida4").value;
            let vSObs1 = document.getElementById("mufaSalidaObs1").value.trim();
            let vSObs2 = document.getElementById("mufaSalidaObs2").value.trim();
            let vSObs3 = document.getElementById("mufaSalidaObs3").value.trim();
            let vSObs4 = document.getElementById("mufaSalidaObs4").value.trim();
            let vSp1 = document.getElementById("mufaSplitter1").value;
            let vSp2 = document.getElementById("mufaSplitter2").value;
            let vSpObs = document.getElementById("mufaSplitterObs").value.trim();

            let isTecnicoCampo = !isAdmin && !isAdminLurin && !isWilton && !isCarlos && !isVendedor && !isCobranzas;
            
            if (isTecnicoCampo || vIn !== "" || vS1 !== "") {
                if (!vIn || !vInObs || !vS1 || !vSObs1 || !vSpObs) {
                    if(btnGuardar) { btnGuardar.disabled = false; btnGuardar.innerText = 'Guardar Tarea'; }
                    mostrarToast("⚠️ El Ingreso, la Salida 1 (con su comentario) y los Splitters son obligatorios.");
                    return;
                }
            }

            data.mufaIngreso = vIn; data.mufaIngresoObs = vInObs;
            data.mufaSalida1 = vS1; data.mufaSalida2 = vS2; data.mufaSalida3 = vS3; data.mufaSalida4 = vS4;
            data.mufaSalidaObs1 = vSObs1; data.mufaSalidaObs2 = vSObs2; data.mufaSalidaObs3 = vSObs3; data.mufaSalidaObs4 = vSObs4;
            data.mufaSplitter1 = vSp1; data.mufaSplitter2 = vSp2; data.mufaSplitterObs = vSpObs;
            
            let salidasD = [vS1, vS2, vS3, vS4].filter(Boolean).join(", ");
            let spD = [vSp1, vSp2].filter(Boolean).join(", ");
            
            data.notas = vIn ? `Ingreso: ${vIn} hilos | Salidas: ${salidasD} hilos ${spD ? '| Splitters: '+spD : ''}` : "Auditoría de mufa pendiente.";
            
        } else if (subtipo === "Especificar Otros") {
            data.notas = document.getElementById("formEspecificarTexto").value;
            data.mapa = document.getElementById("formEspecificarMapa").value;
            data.cliente = "TRABAJO ESPECIAL / OTROS";
        }

        data.tipoVivienda = document.getElementById("formTipoViviendaOtros") ? document.getElementById("formTipoViviendaOtros").value : "Casa Propia";
        data.subZona = document.getElementById("formSubZonaOtros") ? document.getElementById("formSubZonaOtros").value : "OTRO";
    
    } else {
        data.tipoDoc = document.getElementById("formTipoDoc").value;
        data.cliente = document.getElementById("formNombre").value || "Desconocido";
        data.dni = document.getElementById("formDni").value;
        data.correo = document.getElementById("formCorreo").value;
        data.tel = telFinal;
        data.dir = document.getElementById("formDireccion").value;
        data.referencia = document.getElementById("formReferencia").value;
        data.mapa = document.getElementById("formMapa").value;
        data.caja = document.getElementById("formCajaAlta").value;
        data.puerto = document.getElementById("formPuertoAlta").value;
        data.linkCaja = document.getElementById("formLinkCaja").value;

        data.tipoVivienda = document.getElementById("formTipoVivienda") ? document.getElementById("formTipoVivienda").value : "Casa Propia";
        data.subZona = document.getElementById("formSubZona") ? document.getElementById("formSubZona").value : "OTRO";

        if (tipo === "alta") {
            const planCompleto = document.getElementById("formPlanVenta").value;
            const parts = planCompleto.split("|");
            const nombrePlan = parts[1];
            const tipoServicio = document.getElementById("formTipoServicio").value;
            const precio = document.getElementById("formPrecioTotal").innerText;
            const extrasArray = Array.from(document.querySelectorAll(".chk-extra:checked")).map((c) => c.value);
            const extrasStr = extrasArray.join(", ");

            data.rawServ = planCompleto; data.rawExtras = extrasArray; data.precio = precio;
            data.tipoServicio = tipoServicio; data.periodo = document.getElementById("formPeriodo").value;
            data.comprobante = document.getElementById("formComprobante").value;
            
            let extraDetalle = "";
            if (tipoServicio === "Internet + Cable") extraDetalle = " (+ CABLE)";
            else if (tipoServicio !== "Internet Solo") extraDetalle = ` (${tipoServicio})`;

            data.detalle = nombrePlan + extraDetalle;

            const ventasArray = Array.from(document.querySelectorAll(".chk-venta-alta:checked")).map((c) => c.value);
            const ventasPago = document.getElementById("formAltaVentaEqPago") ? document.getElementById("formAltaVentaEqPago").value : "";
            
            data.ventasAlta = ventasArray;
            data.ventasAltaPago = ventasPago;

            let obsBase = document.getElementById("formObsAlta").value;
            data.notasBase = obsBase;
            
            let extraTxt = extrasStr ? `📦 Alquiler/Promo: ${extrasStr} | ` : "";
            let ventaTxt = "";
            if (ventasArray.length > 0) {
                let tipoPagoCorta = ventasPago.includes("cuotas") ? "En cuotas" : "Al contado";
                ventaTxt = `🛒 Compra Extra: ${ventasArray.join(", ")} (${tipoPagoCorta}) | `;
            }

            data.notas = `🏷️ Total Cobro Hoy: ${precio} | ${extraTxt}${ventaTxt}${obsBase}`;
        } else if (tipo === "averia") {
            data.idCliente = document.getElementById("formIdCliente").value;
            
            let problemaSeleccionado = document.getElementById("formProblemaAveria").value;
            if (problemaSeleccionado === "Otros") {
                let textoOtros = document.getElementById("formProblemaOtros").value.trim();
                problemaSeleccionado = textoOtros !== "" ? textoOtros : "Avería no especificada";
            }
            data.detalle = problemaSeleccionado;
            
            data.notas = document.getElementById("formNotasAveria").value;
            data.infoRed = document.getElementById("formInfoRedAveria").value;
        } else if (tipo === "baja") {
            data.idCliente = document.getElementById("formIdCliente").value;
            data.detalle = "Retiro de Equipos";
            data.notas = document.getElementById("formMotivoBaja").value;
            data.equipos = document.getElementById("formEquiposBaja").value;
        } else if (tipo === "venta_equipos") {
            let eqArray = Array.from(document.querySelectorAll(".chk-venta-eq:checked")).map(c => c.value);
            let servArray = Array.from(document.querySelectorAll(".chk-servicio-mensual:checked")).map(c => c.value);
            
            let pago = document.getElementById("formVentaEqPago").value;
            let totalUnico = document.getElementById("formVentaEqTotal").innerText;
            let totalMensual = document.getElementById("formServicioMensualTotal") ? document.getElementById("formServicioMensualTotal").innerText : "+ S/ 0.00";
            
            data.idCliente = document.getElementById("formIdCliente").value;
            data.precio = totalUnico; 
            data.aumentoMensual = totalMensual; 
            data.metodoPago = pago;
            data.equiposVenta = eqArray;
            data.serviciosMensuales = servArray;
            
            // 🔥 MAGIA: Guardar metros de cable para recuperar después
            data.metrosCoaxialGuardado = document.getElementById("metrosCoaxial") ? document.getElementById("metrosCoaxial").value : "";
            data.metrosEthernetGuardado = document.getElementById("metrosEthernet") ? document.getElementById("metrosEthernet").value : "";
            
            let tituloDetalle = [];
            if (eqArray.length > 0) {
                // Hacemos que el título ahora diga "Cable Ethernet (15m)"
                let nombreEqs = eqArray.map(e => {
                    if (e === "Cableado Coaxial") return `Cable Coaxial (${data.metrosCoaxialGuardado || 0}m)`;
                    if (e === "Cableado Ethernet") return `Cable Ethernet (${data.metrosEthernetGuardado || 0}m)`;
                    return e;
                }).join(" + ");
                tituloDetalle.push("Venta: " + nombreEqs);
            }
            if (servArray.length > 0) tituloDetalle.push("Alquiler: " + servArray.join(" + "));
            
            let haceCambioPlan = document.getElementById("chkCambioPlan") && document.getElementById("chkCambioPlan").checked;
            if (haceCambioPlan) {
                let servCP = document.getElementById("formCpServicio").value;
                let planCP = document.getElementById("formCpPlan").value.split("|")[1];
                let eqCP = Array.from(document.querySelectorAll(".chk-cp-extra:checked")).map(c => c.value);
                let totalCP = document.getElementById("formCpTotal").innerText;
                
                data.cpServicio = servCP;
                data.cpPlan = planCP;
                data.cpEquipos = eqCP;
                data.cpTotal = totalCP;
                
                tituloDetalle.push(`Cambio Plan: ${planCP}`);
            }

            data.detalle = tituloDetalle.length > 0 ? tituloDetalle.join(" | ") : "Gestión Comercial";
            
            let notaVenta = document.getElementById("formVentaEqNotas").value.trim();
            // Guardamos la nota pura para la edición
            data.notasOriginalesVenta = notaVenta;
            
            let partesNota = [];
            
            if (totalUnico && totalUnico !== "S/ 0.00" && totalUnico !== "S/ 0") partesNota.push(`💰 Cobro Hoy: ${totalUnico}`);
            if (totalMensual && totalMensual !== "+ S/ 0.00") partesNota.push(`📅 Extras Mensuales: ${totalMensual}`);
            if (haceCambioPlan) partesNota.push(`🔄 Nuevo Plan: ${data.cpTotal} (${data.cpServicio})`);
            if (pago && pago !== "Solo es Servicio Adicional Mensual (No hay cobro hoy)") partesNota.push(`💳 Pago: ${pago}`);
            if (notaVenta !== "") partesNota.push(`📝 Obs: ${notaVenta}`);

            data.notas = partesNota.length > 0 ? partesNota.join("  |  ") : "Registro sin notas adicionales";
        }
    }

    let idTrabajo = document.getElementById("formTrabajoId").value;
    let estadoPrevio = document.getElementById("formEstadoActual").value;
    let vendedorManual = document.getElementById("formVendedorAlta") ? document.getElementById("formVendedorAlta").value.trim().toUpperCase() : "";

    if (tipo === "alta" || tipo === "venta_equipos") {
        if (vendedorManual !== "") {
            data.vendedor = vendedorManual; 
        } else if (isCarlos || isVendedor || isAdmin || isAdminLurin || isCobranzas) {
            data.vendedor = window.nombreUsuarioGlobal; 
        }
    }

    if (!idTrabajo) {
            let dHoy = new Date();
            data.fechaCreacionExacta = dHoy.toLocaleDateString("es-PE") + " " + dHoy.toLocaleTimeString("es-PE");
            data.creadoPor = window.nombreUsuarioGlobal || "Desconocido"; 

            // 🔥 FIX: Solo las ventas de equipos y las altas de los comerciales van a aprobación.
            // Las bajas (retiros), averías y otros van directamente a "pendiente".
            if (tipo === "venta_equipos" || ((isVendedor || isCarlos) && tipo === "alta")) {
                data.estado = "por_aprobar_carlos"; 
                data.tecnicos = ["Sin Asignar"];
            } else {
                data.estado = "pendiente";
            }
            data.bitacora = [{
            usuario: "SISTEMA",
            msj: "Ticket creado y registrado en la base de datos.",
            fechaStr: data.fechaCreacionExacta,
            ts: Date.now()
        }];
    } else {
        if (vendedorManual !== "") data.vendedor = vendedorManual;

        if ((isWilton || isAdmin || isAdminLurin) && estadoPrevio === "aprobada_wilton" && techSelec[0] !== "Sin Asignar") {
            data.estado = "pendiente";
        }
    }

    try {
        window.cerrarModal();
        
        if (idTrabajo) {
            const { arrayUnion } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
            
            let d = new Date();
            let fechaEdit = d.toLocaleDateString("es-PE") + " " + d.toLocaleTimeString("es-PE", {hour: '2-digit', minute:'2-digit'});
            
            // El sistema anota automáticamente quién editó y a qué hora
            data.bitacora = arrayUnion({
                usuario: "SISTEMA",
                msj: "Ticket editado/actualizado por " + (window.nombreUsuarioGlobal || "Usuario"),
                fechaStr: fechaEdit,
                ts: Date.now()
            });

            await updateDoc(doc(coleccionTrabajos, idTrabajo), data);
            mostrarToast("✅ Tarea actualizada exitosamente");
        } else {
            mostrarToast("⏳ Generando ticket seguro y guardando...");
            const { runTransaction } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
            
            let prefijo = "OTR";
            if (tipo === "alta") prefijo = "ALT";
            else if (tipo === "averia") prefijo = "AVE";
            else if (tipo === "baja") prefijo = "BAJA";
            else if (tipo === "venta_equipos") prefijo = "VTEQ"; 
            else if (tipo === "retencion") prefijo = "RET";

            // MAGIA DE ZONAS: Contadores totalmente independientes
            let zonaTicket = localStorage.getItem("ten_zona_activa") || "norte";
            let nombreDocContador = zonaTicket === "lurin" ? "contadores_tickets_lurin" : "contadores_tickets";
            
            const counterRef = doc(db, "artifacts", appId, "public", "data", "sistema", nombreDocContador);
            const nuevoDocRef = doc(coleccionTrabajos); 

            await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                let actual = 0;
                if (counterDoc.exists() && counterDoc.data()[prefijo]) {
                    actual = counterDoc.data()[prefijo];
                }
                
                let nuevoNumero = actual + 1;
                let numeroStr = String(nuevoNumero).padStart(4, '0');
                
                // Agregamos una "L-" al inicio si es Lurín para identificarlos a simple vista
                let prefijoZona = zonaTicket === "lurin" ? "L-" : "";
                data.ticket = `${prefijoZona}${prefijo}-${numeroStr}`;
                data.numeroTicket = nuevoNumero;
                
                transaction.set(counterRef, { [prefijo]: nuevoNumero }, { merge: true });
                transaction.set(nuevoDocRef, data);
            });
            
            mostrarToast(`✅ ¡Éxito! Guardado con Ticket: ${data.ticket}`); if (window.lanzarConfeti) window.lanzarConfeti();
        }
    } catch (e) {
        mostrarToast("❌ Error interno al guardar"); console.error(e);
    } finally {
        if(btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerText = 'Guardar Tarea';
        }
    }
};

// ============================================================ //
// MAPA Y COBERTURA                                             //
// ============================================================ //
window.abrirModalCoberturaGeneral = () => {
    document.getElementById("infoClienteCobertura").style.display = "none";
    document.getElementById("botonesCoberturaValidacion").style.display = "none";
    document.getElementById("cajaRechazo").style.display = "none";
    document.getElementById("mapCenterPin").style.display = "none";
    document.getElementById("modalCobertura").style.display = "flex";
};

window.abrirValidacionCobertura = (id) => {
    let t = dbTrabajos.find((x) => x.id === id);
    if (!t) return;
    ventaAValidarId = id;
    document.getElementById("cobNombreCliente").innerText = t.cliente;
    document.getElementById("cobDirCliente").innerText = t.dir + (t.referencia ? ` (${t.referencia})` : "");

    const linkBtn = document.getElementById("cobLinkMapa");
    if (t.mapa) {
        linkBtn.href = t.mapa; linkBtn.style.display = "inline-block"; linkBtn.innerHTML = "📍 Ver GPS del Cliente";
    } else {
        linkBtn.style.display = "none";
    }

    document.getElementById("infoClienteCobertura").style.display = "flex";
    document.getElementById("botonesCoberturaValidacion").style.display = "flex";
    document.getElementById("cajaRechazo").style.display = "none";
    document.getElementById("modalCobertura").style.display = "flex";
    document.getElementById("txtBuscarMapa").value = t.mapa || "";
    if (t.mapa) window.buscarEnMapa();
};

window.verMapaCliente = async (id) => {
    let t = dbTrabajos.find(x => x.id === id);
    if (!t) return;

    document.getElementById("cobNombreCliente").innerText = t.cliente;
    document.getElementById("cobDirCliente").innerText = t.dir + (t.referencia ? ` (${t.referencia})` : '');

    const linkBtn = document.getElementById("cobLinkMapa");
    if (t.mapa) {
        linkBtn.href = t.mapa; linkBtn.style.display = "inline-block"; linkBtn.innerHTML = "📍 Abrir en Google Maps Externo";
    } else { linkBtn.style.display = "none"; }

    document.getElementById("infoClienteCobertura").style.display = "flex";
    document.getElementById("botonesCoberturaValidacion").style.display = "none";
    document.getElementById("cajaRechazo").style.display = "none";
    document.getElementById("modalCobertura").style.display = "flex";
    document.getElementById("txtBuscarMapa").value = t.mapa || "";
    if (t.mapa) await window.buscarEnMapa();
};

// ============================================================ //
// BUSCADOR DE MAPA - VERSIÓN MEJORADA (PIN FIJO + LINKS GOOGLE)//
// ============================================================ //
window.buscarEnMapa = async () => {
    const input = document.getElementById("txtBuscarMapa").value.trim();
    if (!input) { mostrarToast("⚠️ Ingresa coordenadas, dirección o link."); return; }

    const iframe = document.getElementById("iframeCobertura");
    mostrarToast("🔍 Analizando ubicación...");

    let lat = null, lon = null;

    // ─── PASO 1: Extraer coordenadas DIRECTAMENTE del link ───
    // La mayoría de links de Google ya traen las coordenadas en el propio URL
    const regexCoords = [
        /@(-?\d+\.\d+),(-?\d+\.\d+)/,                    // /@-12.123,-77.123,15z
        /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,                // ?q=-12.123,-77.123
        /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,                 // !3d-12.123!4d-77.123
        /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,               // ?ll=-12.123,-77.123
        /(-?\d{1,3}\.\d{4,})[,\s]+(-?\d{1,3}\.\d{4,})/   // texto crudo "lat, lon"
    ];

    for (let r of regexCoords) {
        let m = input.match(r);
        if (m) { lat = m[1]; lon = m[2]; break; }
    }

    // ─── PASO 2: Si es link corto, desencriptar con proxy (con timeout) ───
    if ((!lat || !lon) && (input.includes("goo.gl") || input.includes("maps.app"))) {
        mostrarToast("⏳ Desencriptando link de Google...");
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            
            let res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(input)}`, { signal: controller.signal });
            clearTimeout(timeout);
            
            let data = await res.json();
            if (data && data.contents) {
                // Buscamos coordenadas en TODO el HTML de respuesta
                for (let r of regexCoords) {
                    let m = data.contents.match(r);
                    if (m) { lat = m[1]; lon = m[2]; break; }
                }
                // Fallback: meta tags <meta content="...lat,lon...">
                if (!lat) {
                    let m = data.contents.match(/content="[^"]*?(-?\d+\.\d+),(-?\d+\.\d+)/);
                    if (m) { lat = m[1]; lon = m[2]; }
                }
            }
        } catch (e) { 
            console.error("Error al desencriptar:", e);
            mostrarToast("⚠️ No se pudo leer el link. Pega coordenadas o dirección.");
            return;
        }
    }

    // ─── PASO 3: Si aún no hay coords, buscar por dirección ───
    if (!lat || !lon) {
        try {
            const query = encodeURIComponent(input + ", Lima, Peru");
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
            const data = await response.json();
            if (data && data.length > 0) { 
                lat = data[0].lat; 
                lon = data[0].lon; 
            } else { 
                mostrarToast("❌ Ubicación no encontrada. Prueba con un link o coordenadas."); 
                return; 
            }
        } catch (e) {
            mostrarToast("❌ Error de red al buscar.");
            return;
        }
    }

    // ─── PASO 4: Cargar el mapa con la ubicación ───
    // 🔑 LA CLAVE: usamos "output=embed" con "?q=lat,lon" en lugar de la My Maps URL.
    // Google dibuja su PROPIO pin rojo, anclado a las coordenadas geográficas.
    iframe.src = `https://maps.google.com/maps?q=${lat},${lon}&z=18&output=embed&hl=es`;
    
    // Ocultamos el pin HTML personalizado (ya no se necesita y confunde)
    let pin = document.getElementById("mapCenterPin");
    if (pin) pin.style.display = "none";
    
    mostrarToast(`✅ Ubicación: ${parseFloat(lat).toFixed(5)}, ${parseFloat(lon).toFixed(5)}`);
};

window.centrarEnMiUbicacion = () => {
    const btnIcon = document.getElementById("iconoUbicacion");
    const iframe = document.getElementById("iframeCobertura");

    if (!navigator.geolocation) { mostrarToast("Sin soporte GPS 😔"); return; }
    btnIcon.innerText = "⏳"; mostrarToast("Buscando señal GPS...");

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            // Mismo formato que buscarEnMapa: pin fijo anclado a coordenadas
            iframe.src = `https://maps.google.com/maps?q=${lat},${lon}&z=18&output=embed&hl=es`;
            
            btnIcon.innerText = "📍";
            
            // Ocultamos el pin HTML personalizado
            let pin = document.getElementById("mapCenterPin");
            if (pin) pin.style.display = "none";
            
            mostrarToast("📍 Mapa centrado en tu ubicación ✅");
        },
        (error) => { 
            btnIcon.innerText = "📍"; 
            mostrarToast("⚠️ Error GPS. Verifica permisos del navegador."); 
        }, 
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
};

window.confirmarAprobacionVenta = async () => {
    if (!ventaAValidarId) return;
    try {
        await updateDoc(doc(coleccionTrabajos, ventaAValidarId), { estado: "aprobada_wilton" });
        mostrarToast("✅ Cobertura Aprobada."); window.cerrarModalCobertura();
    } catch (e) { mostrarToast("Error al aprobar"); }
};

window.confirmarRechazoVenta = async () => {
    if (!ventaAValidarId) return;
    const motivo = document.getElementById("txtMotivoRechazo").value.trim();
    if (!motivo) { mostrarToast("❌ Ingresa el motivo."); return; }
    try {
        await updateDoc(doc(coleccionTrabajos, ventaAValidarId), { estado: "rechazada", notas: `[RECHAZADA] Motivo: ${motivo}` });
        mostrarToast("🚫 Venta Rechazada."); window.cerrarModalCobertura();
    } catch (e) { mostrarToast("Error al rechazar"); }
};

window.iniciarRechazo = () => {
    document.getElementById("botonesCoberturaValidacion").style.display = "none";
    document.getElementById("cajaRechazo").style.display = "block";
    document.getElementById("txtMotivoRechazo").value = "";
    document.getElementById("txtMotivoRechazo").focus();
};

window.cancelarRechazo = () => {
    if (ventaAValidarId || document.getElementById("infoClienteCobertura").style.display === "flex") {
        document.getElementById("cajaRechazo").style.display = "none";
        if (ventaAValidarId) document.getElementById("botonesCoberturaValidacion").style.display = "flex";
    }
};

window.aprobarDirecto = async (id) => {
    try { await updateDoc(doc(coleccionTrabajos, id), { estado: "aprobada_wilton" }); mostrarToast("✅ Venta Aprobada."); } 
    catch (e) { mostrarToast("Error"); }
};

window.rechazarDirecto = (id) => {
    idVentaARechazarRapido = id;
    document.getElementById("txtMotivoRechazoRapido").value = "";
    document.getElementById("modalRechazoRapido").style.display = "flex";
    document.getElementById("txtMotivoRechazoRapido").focus();
};

window.confirmarRechazoRapido = async () => {
    if (!idVentaARechazarRapido) return;
    let motivo = document.getElementById("txtMotivoRechazoRapido").value.trim();
    if (!motivo) { mostrarToast("❌ Motivo obligatorio."); return; }
    try {
        await updateDoc(doc(coleccionTrabajos, idVentaARechazarRapido), { estado: "rechazada", notas: `[RECHAZADA] Motivo: ${motivo}` });
        mostrarToast("🚫 Venta Rechazada."); window.cerrarModalRechazoRapido();
    } catch (e) { mostrarToast("Error"); }
};

// ============================================================ //
// RENDERIZAR TABLA (LAZY LOADING + SLA + VOZ + CONTEXT MENU)   //
// ============================================================ //
window.renderizarTabla = () => {
    const tbody = document.getElementById("tablaTrabajos");
    if (!tbody) return; 

    // 🔥 FIX VITAL MÓVILES: Forzar el repintado y evitar que el contenedor corte los filtros
    const panelF = document.getElementById("panelFiltros");
    if (panelF) {
        panelF.style.setProperty('height', 'auto', 'important');
        panelF.style.setProperty('overflow', 'visible', 'important');
        const grupoF = panelF.querySelector('.filtros-grupo');
        if (grupoF) {
            grupoF.style.setProperty('height', 'auto', 'important');
            grupoF.style.setProperty('overflow', 'visible', 'important');
        }
    }

    const filtroSubZonaC = document.getElementById("filtroSubZonaAdmin")?.value || "todos";
    // 🔥 LÓGICA RANGO DE FECHAS
    const filtroFecha = document.getElementById("filtroFecha")?.value || "todas";
    const fFechaDesde = document.getElementById("filtroFechaDesde")?.value || "";
    const fFechaHasta = document.getElementById("filtroFechaHasta")?.value || "";
    
    const rolActualRango = localStorage.getItem('ten_rol') || "";
    const esVentasRango = (rolActualRango === 'vendedor' || rolActualRango === 'ventas');

    let cajaUnica = document.getElementById("cajaFiltroFechaUnica");
    let cajaRango = document.getElementById("cajaFiltroRangoFechas");
    
    // 🔥 FIX VISUAL: Aquí estaba el error que deformaba la fecha. 
    // Usar 'block' en lugar de 'flex' para no romper la estructura de las etiquetas
    if (cajaUnica && cajaRango) {
        cajaUnica.style.display = esVentasRango ? "none" : "block"; 
        cajaRango.style.display = esVentasRango ? "block" : "none";
    }

    const txtBuscar = document.getElementById("buscador")?.value.toLowerCase() || "";
    const filtroMes = document.getElementById("filtroMesNoc")?.value || "todos";
    const filtroAnio = document.getElementById("filtroAnioNoc")?.value || "todos";
    const filtroTipoTarea = document.getElementById("filtroTipoTareaNoc")?.value || "todos";
    const filtroSubtipo = document.getElementById("filtroSubtipoAdmin")?.value || "todos";
    const filtroVendedorC = document.getElementById("filtroVendedorCoord")?.value || "todos";
    const filtroZonaC = document.getElementById("filtroZonaCoord")?.value || "todos";
    const filtroMesC = document.getElementById("filtroMesCoord")?.value || "todos";
    
    const rolActualSistema = localStorage.getItem('ten_rol');

    let estadosSeleccionados = [];
    let mostrarTodosEstados = true;
    const casillasEstado = document.querySelectorAll("#estadoDropdown input:checked");
    if (casillasEstado.length > 0) {
        estadosSeleccionados = Array.from(casillasEstado).map(c => c.value);
        mostrarTodosEstados = estadosSeleccionados.includes("todos");
    }

    let listData = [...dbTrabajos];
    // 🔥 CORRECCIÓN: Cobranzas y Coordinadores ahora obedecen estrictamente a la Zona Activa
    if (isAdmin || isAdminLurin || isWilton || isCobranzas || isCarlos) {
        listData = listData.filter((t) => String(t.zona || "Norte").toLowerCase() === String(zonaActual).toLowerCase());
    }

    let tOrdenado = listData.sort((a, b) => {
        let estA = String(a.estado || "pendiente").toLowerCase();
        let estB = String(b.estado || "pendiente").toLowerCase();
        let terminadoA = (estA === "atendido" || estA === "no_atendido" || estA === "rechazada" || estA === "no_realizado") ? 1 : 0;
        let terminadoB = (estB === "atendido" || estB === "no_atendido" || estB === "rechazada" || estB === "no_realizado") ? 1 : 0;
        if (terminadoA !== terminadoB) return terminadoA - terminadoB; 

        // BLINDAJE: Evita crash si a.fecha o b.fecha no existen
        let res = String(b.fecha || "").localeCompare(String(a.fecha || ""));
        if (res !== 0) return res;
        
        let obtenerMinutos = (t) => {
            let tsReal = t.tsInicio || t.tsLlegada || t.tsFin; 
            if (tsReal) { let d = new Date(tsReal); return (d.getHours() * 60) + d.getMinutes(); } 
            else { 
                let hora = t.horaInicio || "23:59"; 
                return (parseInt(String(hora).split(':')[0]) * 60) + parseInt(String(hora).split(':')[1]); 
            }
        };
        return obtenerMinutos(a) - obtenerMinutos(b); 
    });

    const tecnicoFiltro = document.getElementById("filtroTecnico")?.value || "todos";

    // 1. FILTRAMOS TODA LA DATA PRIMERO
    let pGrafico = [];
    window.datosTablaFiltrados = [];
    
    tOrdenado.forEach((t) => {
        if (t.tipoTarea === "biometrico" || !t.cliente || String(t.cliente).toLowerCase() === "undefined") return;
        if (t.dir === "En Refrigerio" || t.dir === "Reporte Interno") return; 
        if (rolActualSistema === 'noc' && (t.estado === 'por_aprobar_carlos' || t.estado === 'por_aprobar' || t.estado === 'rechazada')) return; 
        
        let asig = t.tecnicos || ["Sin Asignar"];
        if (typeof asig === "string") asig = [asig];
        
        let estActual = String(t.estado || "pendiente").toLowerCase();
        let esAprobacion = (estActual === "por_aprobar_carlos" || estActual === "aprobada_wilton" || estActual === "rechazada");
        let esRetencion = (t.tipoTarea === "retencion");
        let esRetiroNOC = esRetencion && t.estadoLlamada === "Retiro Definitivo";

        let esUnaBajaFila = t.tipoTarea === "baja" || (t.tipoTarea === "otros" && t.detalle === "Baja en Sistemas (Equipos recuperados)") || esRetiroNOC;
        
        // 🔥 FIX: Permitir que TODOS los roles de oficina filtren correctamente por pestañas
        if (isAdmin || isAdminLurin || isWilton || isCobranzas || isCarlos) {
            if (window.vistaActivaNOC === 'operaciones' && esUnaBajaFila) return;
            if (window.vistaActivaNOC === 'bajas' && !esUnaBajaFila) return;
        }

        let fechaObj = t.fecha ? String(t.fecha).split("-") : null;
        let anioT = fechaObj ? fechaObj[0] : ""; let mesT = fechaObj ? fechaObj[1] : "";

        if (filtroAnio !== "todos" && anioT !== filtroAnio) return;
        if (filtroMes !== "todos" && mesT !== filtroMes) return;
        if (esRetencion && !esRetiroNOC) return;
        if (filtroTipoTarea !== "todos" && t.tipoTarea !== filtroTipoTarea) return;

        if ((isAdmin || isAdminLurin || isCarlos) && filtroSubZonaC !== "todos" && String(t.subZona || "OTRO").toUpperCase() !== filtroSubZonaC) return;
        if ((isAdmin || isAdminLurin) && filtroSubtipo !== "todos") {
            if (filtroSubtipo === "alta_nueva" && t.tipoTarea !== "alta") return;
            else if (filtroSubtipo === "baja_retiro" && t.tipoTarea !== "baja" && !esRetiroNOC) return;
            else if (filtroSubtipo !== "alta_nueva" && filtroSubtipo !== "baja_retiro" && t.detalle !== filtroSubtipo) return;
        }

        if (isCarlos) { 
            let esRetiroNocVentas = (t.tipoTarea === "retencion" && t.estadoLlamada === "Retiro Definitivo");
            let esBajaSistemaVentas = (t.tipoTarea === "otros" && t.detalle === "Baja en Sistemas (Equipos recuperados)");
            
            if (t.tipoTarea !== "alta" && t.tipoTarea !== "venta_equipos" && t.tipoTarea !== "baja" && !esRetiroNocVentas && !esBajaSistemaVentas) return; 
            
            if (window.vistaActivaNOC !== 'bajas') {
                if (filtroVendedorC !== "todos" && t.vendedor !== filtroVendedorC) return;
                if (filtroZonaC !== "todos" && String(t.zona || "Norte") !== filtroZonaC) return;
                if (filtroMesC !== "todos" && (!t.fecha || !String(t.fecha).startsWith(filtroMesC))) return;
            }
        }
        else if (isVendedor) { if ((t.tipoTarea !== "alta" && t.tipoTarea !== "venta_equipos") || t.vendedor !== nombreTecnicoLogueado) return; } 
        else if (isAdmin || isAdminLurin) {}
        else if (isWilton || isCobranzas) { 
            let esMio = (t.vendedor === nombreTecnicoLogueado || t.creadoPor === nombreTecnicoLogueado);
            if ((estActual === "por_aprobar_carlos" || estActual === "por_aprobar" || estActual === "rechazada") && !esMio) return; 
        }
        else { if (esAprobacion) return; if (!asig.includes(nombreTecnicoLogueado) && !asig.includes("Todos")) return; }

        if ((isAdmin || isAdminLurin || isWilton) && tecnicoFiltro !== "todos" && !asig.includes(tecnicoFiltro)) return;
        
        if (esVentasRango) {
            if (fFechaDesde || fFechaHasta) {
                if (!t.fecha) return false; 
                let fechaLimpia = String(t.fecha).split(" ")[0]; 
                
                if (fFechaDesde && fechaLimpia < fFechaDesde) return false;
                if (fFechaHasta && fechaLimpia > fFechaHasta) return false;
            }
        } else {
            if (filtroFecha && filtroFecha !== "todas") {
                if (!t.fecha) return false; 
                let fechaLimpia = String(t.fecha).split(" ")[0];
                if (fechaLimpia !== filtroFecha) return false;
            }
        }
        
        let estaSinAsignar = (asig.length === 0 || (asig.length === 1 && asig[0] === "Sin Asignar"));
        let estaAsignada = !estaSinAsignar;
        let pasaFiltroEstado = estadosSeleccionados.includes(estActual);
        
        if (estadosSeleccionados.includes("sin_asignar") && estaSinAsignar) pasaFiltroEstado = true;
        if (estadosSeleccionados.includes("asignadas") && estaAsignada) pasaFiltroEstado = true;

        if (!mostrarTodosEstados && !pasaFiltroEstado) return; 

        if (txtBuscar && !`${t.ticket || ''} ${t.cliente} ${t.dni} ${t.dir} ${t.detalle}`.toLowerCase().includes(txtBuscar)) return;

        window.datosTablaFiltrados.push(t);
        pGrafico.push(t);
    });

    if (isCarlos) { let lbl = document.getElementById("lblContadorCoord"); if (lbl) lbl.innerText = pGrafico.length; }
    actualizarGraficosGerenciales(pGrafico);

    tbody.innerHTML = "";
    if (window.datosTablaFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-8"><i class="fa-solid fa-mug-hot text-2xl mb-2 block"></i><br>No hay tareas para mostrar en esta vista.</td></tr>`;
        return;
    }

    // 2. FUNCIÓN MÁGICA DE LAZY LOADING
    window.paginaActualTabla = 0;
    
    window.dibujarSiguientePagina = () => {
        let inicio = window.paginaActualTabla * 25; 
        let fin = inicio + 25;
        let trozo = window.datosTablaFiltrados.slice(inicio, fin);
        
        let isTecnicoCampo = !isAdmin && !isAdminLurin && !isWilton && !isCarlos && !isVendedor && !isCobranzas;

        trozo.forEach(t => {
            let estActual = String(t.estado || "pendiente").toLowerCase();
            let asig = Array.isArray(t.tecnicos) ? t.tecnicos : [t.tecnicos || "Sin Asignar"];
            let esAprobacion = (estActual === "por_aprobar_carlos" || estActual === "aprobada_wilton" || estActual === "rechazada");
            let esRetencion = (t.tipoTarea === "retencion");
            let esRetiroNOC = esRetencion && t.estadoLlamada === "Retiro Definitivo";

            let textEst = estActual.toUpperCase().replace(/_/g, " ");
            let clasePunto = "ep-pend";
            if (estActual === "atendido") { textEst = "ATENDIDO"; clasePunto = "ep-aten"; } 
            else if (estActual === "no_atendido") { textEst = "NO ATENDIDO"; clasePunto = "ep-noat"; } 
            else if (estActual === "en_camino") { textEst = "EN CAMINO"; clasePunto = "ep-cami"; } 
            else if (estActual === "en_proceso") { textEst = "EN PROCESO"; clasePunto = "ep-proceso"; } 
            else if (estActual === "no_realizado") { textEst = "NO REALIZADO"; clasePunto = "ep-norealizado"; } 
            else if (estActual === "por_aprobar_carlos") { textEst = "POR APROBAR"; clasePunto = "ep-aprobar"; } 
            else if (estActual === "aprobada_wilton") { textEst = "VENTA APROBADA"; clasePunto = "ep-aprobada"; } 
            else if (estActual === "rechazada") { textEst = "RECHAZADA"; clasePunto = "ep-rechazada"; }
            else if (estActual === "pausado") { textEst = "PAUSADO"; clasePunto = "ep-pausa"; }

            let colorBadge = t.tipoTarea === "alta" ? "alta" : t.tipoTarea === "averia" ? "averia" : t.tipoTarea === "baja" || esRetiroNOC ? "baja" : t.tipoTarea === "venta_equipos" ? "success" : "otros";
            let nombreTipo = t.tipoTarea === "alta" ? "🚀 ALTA" : t.tipoTarea === "averia" ? "🛠️ AVERÍA" : t.tipoTarea === "baja" || esRetiroNOC ? "🛑 BAJA" : t.tipoTarea === "venta_equipos" ? "🛒 VENTA EQUIPOS" : "⚙️ OTROS";
            
            let buscadorVal = document.getElementById("buscador") ? document.getElementById("buscador").value.toLowerCase().trim() : "";
            let resaltar = (txt) => {
                if (!buscadorVal || !txt) return txt;
                let regex = new RegExp(`(${buscadorVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                return String(txt).replace(regex, `<mark style="background: rgba(250,204,21,0.8); color: #000; padding: 0 3px; border-radius: 4px; box-shadow: 0 0 5px rgba(250,204,21,0.6); font-weight: 900;">$1</mark>`);
            };

            let nomMostrar = resaltar(t.cliente);
            let dniMostrar = resaltar(t.dni || "-");
            let dirMostrar = resaltar(t.dir);
            let ticketMostrar = t.ticket ? resaltar(t.ticket) : "";

            let btnVoz = `<button class="btn-voz" title="Leer orden en voz alta" onclick="window.leerOrdenVoz('${t.id}', this)"><i class="fa-solid fa-volume-high"></i></button>`;
            
            let infoCli = `<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                ${btnVoz}
                <span class="cliente-nombre smart-copy" title="Clic para copiar" style="cursor: pointer; transition: color 0.2s; margin-bottom: 0; display: inline-block;" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color=''">${nomMostrar}</span>
            </div>`;
            
            let badgeCreador = "";
            if (t.tipoTarea === "alta") {
                if (t.vendedor) badgeCreador = `<span class="cliente-info"><span class="lbl-info" style="color:var(--danger)">VENDEDOR:</span> <b style="color:var(--danger);">${t.vendedor}</b></span>`;
            } else {
                let autor = t.creadoPor || t.vendedor || ""; 
                if (autor !== "") badgeCreador = `<span class="cliente-info"><span class="lbl-info" style="color:var(--info)">USUARIO:</span> <b style="color:var(--info);">${autor}</b></span>`;
            }

            if (t.tipoTarea === "otros") {
                infoCli += `${badgeCreador}`;
            } else {
                infoCli += `<span class="cliente-info"><span class="lbl-info">${t.tipoDoc || "DNI"}:</span> <b class="smart-copy" title="Clic para copiar">${dniMostrar}</b></span>
                           <span class="cliente-info"><span class="lbl-info">TEL:</span> <b class="smart-copy" title="Clic para copiar">${t.tel || "-"}</b></span>
                           ${t.correo ? `<span class="cliente-info"><span class="lbl-info">EMAIL:</span> ${t.correo}</span>` : ""}
                           ${badgeCreador}`;
            }

            let extrasHtml = "";
            let esTrasladoTabla = t.tipoTarea === "averia" && t.detalle && t.detalle.includes("Traslado");
            
            if (t.tipoTarea === "alta" || esTrasladoTabla) {
                if (t.caja || t.puerto) extrasHtml += `<span class="cliente-info" style="color:var(--purple)"><span class="lbl-info">CAJA:</span> ${t.caja || "--"} | <span class="lbl-info">P:</span> ${t.puerto || "--"}</span>`;
            }
            
            if (t.tipoTarea === "alta") {
                if (t.periodo || t.comprobante) extrasHtml += `<span class="cliente-info"><span class="lbl-info">PAGO:</span> ${t.periodo || ""} | ${t.comprobante || ""}</span>`;
            }
            
            if (t.tipoTarea === "averia" && t.infoRed) extrasHtml += `<span class="cliente-info"><span class="lbl-info">RED:</span> ${t.infoRed}</span>`;
            if ((t.tipoTarea === "baja" || esRetiroNOC) && t.equipos) extrasHtml = `<span class="cliente-info" style="color:var(--danger)"><span class="lbl-info">RECOGER:</span> ${t.equipos}</span>`;

            if (t.tx || t.rx) extrasHtml += `<div style="background: rgba(0,229,255,0.05); border: 1px dashed var(--accent); padding: 4px 8px; border-radius: 4px; margin-top: 6px;"><span class="cliente-info" style="color:var(--accent)"><span class="lbl-info">📡 SEÑAL ROUTER:</span> TX: <b>${t.tx || "--"}</b> | RX: <b>${t.rx || "--"}</b></span></div>`;
            if (t.senalCaja) extrasHtml += `<div style="background: rgba(245,158,11,0.05); border: 1px dashed var(--warning); padding: 4px 8px; border-radius: 4px; margin-top: 6px;"><span class="cliente-info" style="color:var(--warning)"><span class="lbl-info">📡 SEÑAL CAJA:</span> <b>${t.senalCaja}</b></span></div>`;

            let duracionText = "";
            if (estActual === "en_camino" || estActual === "en_proceso") {
                duracionText = `<span class="sla-live-timer" data-estado="${estActual}" data-ts-inicio="${t.tsInicio || ''}" data-ts-llegada="${t.tsLlegada || ''}"><i class="fa-solid fa-spinner fa-spin"></i> Calculando tiempo...</span>`;
            } else {
                let viajeStr = t.tsLlegada ? `🚗 Viaje: ${Math.floor(Math.floor((t.tsLlegada - t.tsInicio) / 60000)/60)}h ${Math.floor((t.tsLlegada - t.tsInicio) / 60000)%60}m` : "";
                let trabajoStr = (t.tsLlegada && t.tsFin && estActual !== "no_realizado") ? ` | 🛠️ Trabajo: ${Math.floor(Math.floor((t.tsFin - t.tsLlegada) / 60000)/60)}h ${Math.floor((t.tsFin - t.tsLlegada) / 60000)%60}m` : "";
                duracionText = `<b>${viajeStr}${trabajoStr}</b>`;
            }

            let slaHtml = "";
            if (t.tsInicio) {
                let hrInicio = new Date(t.tsInicio).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
                let hrLlegada = t.tsLlegada ? new Date(t.tsLlegada).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "--:--";
                let hrFin = t.tsFin ? new Date(t.tsFin).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "--:--";

                slaHtml = `<div style="background: rgba(0,229,255,0.05); border: 1px dashed var(--accent); padding: 8px; border-radius: 6px; margin-top: 8px;">
                    <span class="cliente-info" style="color:var(--accent)"><span class="lbl-info">⏱️ SLA TIEMPOS:</span> Salida: ${hrInicio} | Llegada: ${hrLlegada} | Cierre: ${hrFin}<br>${duracionText}</span>`;
                    
                if(t.fotoLlegada) slaHtml += `<div style="margin-top: 6px;"><a href="${t.fotoLlegada}" target="_blank" style="color:var(--purple); font-size:10px; font-weight:bold; text-decoration:underline;"><i class="fa-solid fa-camera"></i> Ver Foto Fachada (Llegada)</a></div>`;
                if(t.notaLlegada) slaHtml += `<span class="cliente-info" style="color:var(--purple); margin-top: 4px;"><span class="lbl-info">📝 NOTA LLEGADA:</span> ${t.notaLlegada}</span>`;
                if(t.notaCierre) slaHtml += `<span class="cliente-info" style="color:var(--success); margin-top: 4px;"><span class="lbl-info">📝 NOTA CIERRE:</span> ${t.notaCierre}</span>`;
                slaHtml += `</div>`;
            }

            let refHtml = t.referencia ? `<span class="cliente-info"><span class="lbl-info">REF:</span> <b class="smart-copy" title="Clic para copiar" style="cursor:pointer; transition:0.2s;" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color=''">${t.referencia}</b></span>` : "";
            let notaEstilo = (estActual === "rechazada" || estActual === "no_realizado") ? "color: var(--danger); font-weight: bold; background: rgba(239, 68, 68, 0.1); padding: 4px; border-radius: 4px;" : "color: var(--warning); font-weight:bold;";

            let arrayFotosFachada = Array.isArray(t.fotosFachada) ? t.fotosFachada : [];
            let fotosFachadaHtml = arrayFotosFachada.length > 0 ? `<div style="margin-top: 6px; padding: 4px; background: rgba(0,229,255,0.05); border-radius: 4px;"><span class="lbl-info" style="color:var(--accent);"><i class="fa-solid fa-house"></i> FACHADA VENTA:</span> ${arrayFotosFachada.map((url, i) => `<a href="${url}" target="_blank" style="color: var(--accent); text-decoration: underline; font-size: 11px; margin-left: 5px;"><b>Ver Foto ${i+1}</b></a>`).join(" | ")}</div>` : "";
            
            let arrayEvidencias = Array.isArray(t.evidencias) ? t.evidencias : [];
            let evidenciasHtml = arrayEvidencias.length > 0 ? `<div style="background: rgba(245, 158, 11, 0.05); border: 1px dashed var(--warning); padding: 8px; border-radius: 6px; margin-top: 6px;"><span class="lbl-info" style="color:var(--warning);"><i class="fa-solid fa-camera"></i> EVIDENCIAS (CIERRE TÉCNICO):</span><br><div style="display:flex; gap: 8px; flex-wrap: wrap; margin-top: 5px;">${arrayEvidencias.map((url, i) => `<a href="${url}" target="_blank" style="padding: 4px 8px; background: var(--warning); color: #000; border-radius: 4px; font-size: 10px; font-weight: bold; text-decoration: none;"><i class="fa-solid fa-image"></i> Ver Evidencia ${i+1}</a>`).join("")}</div></div>` : "";
            
            let ticketHtml = t.ticket ? `<span class="smart-copy" title="Clic para copiar" style="background: var(--bg-panel); color: var(--text-main); padding: 3px 8px; border-radius: 4px; border: 1px solid var(--border); font-family: monospace; font-weight: bold; margin-right: 5px; font-size: 0.75rem; cursor: pointer;"><i class="fa-solid fa-ticket"></i> ${ticketMostrar}</span><br>` : "";
            
            let zonaBadgeHtml = (t.subZona && t.subZona !== "OTRO") ? `<span class="cliente-info"><span class="lbl-info">ZONA:</span> <b class="smart-copy" title="Clic para copiar" style="cursor:pointer; transition:0.2s;" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color=''">${t.subZona}</b></span>` : "";
            
            let telPrincipalStr = String(t.tel || "").split("/")[0].trim() || "";
            let numLimpio = telPrincipalStr.replace(/\D/g, "");
            let linkWsp = numLimpio.length > 5 ? `https://wa.me/51${numLimpio}` : "#";
            let txtCop = `*CLIENTE:* ${t.cliente}\n*DIR:* ${t.dir}\n*TELÉFONO:* ${telPrincipalStr}`;
            
            if (t.mapa) txtCop += `\n*UBICACIÓN MAPA:* ${t.mapa}`;
            if (t.linkCaja) txtCop += `\n*UBICACIÓN CAJA:* ${t.linkCaja}`;

            let dirH = `${ticketHtml}<span class="badge-tipo ${colorBadge}">${nombreTipo} - ${t.detalle}</span><span class="cliente-info"><span class="lbl-info">DIR:</span> <b class="smart-copy" title="Clic para copiar" style="cursor:pointer; transition:0.2s;" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color=''">${dirMostrar}</b></span>${refHtml}${zonaBadgeHtml}${fotosFachadaHtml}<span class="cliente-info"><span class="lbl-info">FECHA:</span> ${formatoFecha(t.fecha)} | ${window.formato12h(t.horaInicio)} a ${window.formato12h(t.horaFin)}</span><span class="cliente-info"><span class="lbl-info">TEC:</span> <b>${asig.join(", ")}</b></span>${extrasHtml}${t.notas ? `<span class="cliente-info lbl-nota-focus" style="${notaEstilo} cursor:pointer; transition: 0.2s;" onmouseover="this.style.filter='brightness(1.5)'" onmouseout="this.style.filter='none'" title="🎬 Doble clic para Modo Focus"><span class="lbl-info">NOTA VENTA/NOC:</span> ${t.notas}</span>` : ""}${evidenciasHtml}${slaHtml}`;
            let botonesHtml = "";
            if ((isCarlos || isAdmin || isAdminLurin) && estActual === "por_aprobar_carlos") botonesHtml += `<div class="btn-grid-row"><button class="btn-action-ui btn-ui-estado" onclick="aprobarDirecto('${t.id}')"><i class="fa-solid fa-thumbs-up"></i> Aprobar</button><button class="btn-action-ui btn-ui-eliminar" onclick="rechazarDirecto('${t.id}')"><i class="fa-solid fa-xmark"></i> Rechazar</button></div>`;
            if ((isWilton || isAdmin || isAdminLurin) && estActual === "aprobada_wilton") botonesHtml += `<div class="btn-grid-row"><button class="btn-action-ui btn-ui-estado" onclick="editarTrabajo('${t.id}')"><i class="fa-solid fa-calendar"></i> Programar</button></div>`;

            let botonesEstadoHtml = "";
            let isNocOAdmin = isAdmin || isAdminLurin || isWilton;

            if ((isTecnicoCampo || isNocOAdmin) && !esAprobacion) {
                if (estActual === "pendiente") botonesEstadoHtml += `<button class="btn-action-ui btn-ui-estado" onclick="window.cambiarEstadoEnCamino('${t.id}')"><i class="fa-solid fa-person-walking"></i> En Camino</button>`;
                else if (estActual === "en_camino") {
                    botonesEstadoHtml += `<button class="btn-action-ui" style="background: rgba(168, 85, 247, 0.1); color: var(--purple); border: 1px solid var(--purple);" onclick="window.abrirModalLlegada('${t.id}', 'en_proceso')"><i class="fa-solid fa-play"></i> En Proceso</button><button class="btn-action-ui" style="background: rgba(100, 116, 139, 0.1); color: #64748b; border: 1px solid #64748b;" onclick="window.abrirModalLlegada('${t.id}', 'no_realizado')"><i class="fa-solid fa-ban"></i> No Realizado</button>`;
                    if (isNocOAdmin) botonesEstadoHtml += `<button class="btn-action-ui" style="grid-column: span 2; background: rgba(71, 85, 105, 0.1); color: #475569; border: 1px solid #475569; margin-top: 4px;" onclick="window.pausarTrabajo('${t.id}', '${estActual}')"><i class="fa-solid fa-pause"></i> Pausar Orden</button><button class="btn-action-ui" style="grid-column: span 2; background: rgba(148, 163, 184, 0.1); color: var(--text-muted); border: 1px solid var(--border); margin-top: 4px;" onclick="window.revertirAPendiente('${t.id}')"><i class="fa-solid fa-rotate-left"></i> Revertir a Pendiente</button>`;
                }
                else if (estActual === "en_proceso") {
                    botonesEstadoHtml += `<button class="btn-action-ui" style="background: rgba(16, 185, 129, 0.1); color: var(--success); border: 1px solid var(--success);" onclick="window.abrirModalCierreDirecto('${t.id}', 'atendido')"><i class="fa-solid fa-check-double"></i> Atendido</button><button class="btn-action-ui" style="background: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid var(--danger);" onclick="window.abrirModalCierreDirecto('${t.id}', 'no_atendido')"><i class="fa-solid fa-user-xmark"></i> Fallido</button>`;
                    if (isNocOAdmin) botonesEstadoHtml += `<button class="btn-action-ui" style="grid-column: span 2; background: rgba(71, 85, 105, 0.1); color: #475569; border: 1px solid #475569; margin-top: 4px;" onclick="window.pausarTrabajo('${t.id}', '${estActual}')"><i class="fa-solid fa-pause"></i> Pausar Orden</button><button class="btn-action-ui" style="grid-column: span 2; background: rgba(148, 163, 184, 0.1); color: var(--text-muted); border: 1px solid var(--border); margin-top: 4px;" onclick="window.revertirAPendiente('${t.id}')"><i class="fa-solid fa-rotate-left"></i> Revertir a Pendiente</button>`;
                }
                else if (estActual === "pausado") {
                    if (isNocOAdmin) botonesEstadoHtml += `<button class="btn-action-ui" style="grid-column: span 2; background: rgba(16, 185, 129, 0.1); color: var(--success); border: 1px solid var(--success);" onclick="window.reanudarTrabajo('${t.id}', '${t.estadoPrevioPausa || 'en_proceso'}')"><i class="fa-solid fa-play"></i> Reanudar Orden (Devolver a Técnico)</button>`;
                    else botonesEstadoHtml += `<span style="grid-column: span 2; text-align: center; color: var(--text-muted); font-size: 11px; font-style: italic; background: rgba(0,0,0,0.05); padding: 8px; border-radius: 6px;"><i class="fa-solid fa-lock"></i> Pausada por Soporte NOC</span>`;
                }
                else if ((estActual === "atendido" || estActual === "no_atendido" || estActual === "no_realizado") && isNocOAdmin) {
                    botonesEstadoHtml += `<button class="btn-action-ui" style="grid-column: span 2; background: rgba(148, 163, 184, 0.1); color: var(--text-muted); border: 1px solid var(--border);" onclick="window.revertirAPendiente('${t.id}')"><i class="fa-solid fa-rotate-left"></i> Revertir a Pendiente</button>`;
                }
            }
            if (botonesEstadoHtml !== "") botonesHtml += `<div class="btn-grid-row" ${(estActual === "en_camino" || estActual === "en_proceso") ? `style="grid-template-columns: 1fr 1fr;"` : ""}>${botonesEstadoHtml}</div>`;

            let linkMapaLimpio = t.mapa ? String(t.mapa).trim() : "";
            let linkCajaLimpio = t.linkCaja ? String(t.linkCaja).trim() : "";

            let btnCajaHtml = linkCajaLimpio ? 
                `<a href="${linkCajaLimpio}" target="_blank" rel="noopener noreferrer external" class="btn-action-ui btn-ui-nap" style="text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 5px;" onclick="event.stopPropagation();"><i class="fa-solid fa-box"></i> Ver Caja NAP</a>` : 
                `<button class="btn-action-ui btn-ui-nap" disabled><i class="fa-solid fa-box"></i> Sin Caja</button>`;
            
            let btnMapaHtml = linkMapaLimpio ? 
                `<a href="${linkMapaLimpio}" target="_blank" rel="noopener noreferrer external" class="btn-action-ui btn-ui-mapa" style="text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 5px;" onclick="event.stopPropagation();"><i class="fa-solid fa-location-dot"></i> Mapa</a>` : 
                `<button class="btn-action-ui btn-ui-mapa" disabled><i class="fa-solid fa-location-dot"></i> Mapa</button>`;
            
            botonesHtml += `<div class="btn-grid-row">${btnMapaHtml} ${btnCajaHtml}</div>`;
            
            if (numLimpio.length > 5 && t.tipoTarea !== "otros") {
                botonesHtml += `<div class="btn-grid-row"><a href="${linkWsp}" target="_blank" class="btn-action-ui btn-ui-wsp" style="text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 5px;"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a></div>`;
            }

            let btnSenalHtml = ""; let textoBtnEditar = "<i class='fa-solid fa-pen'></i> Editar"; let permitirEditarTecnico = false;
            if (t.tipoTarea === "alta" || t.tipoTarea === "averia" || (t.tipoTarea === "otros" && t.detalle === "Seguimiento de fibra")) btnSenalHtml = `<button class="btn-action-ui" style="background: rgba(0, 229, 255, 0.1); border: 1px solid var(--accent); color: var(--accent);" onclick="abrirModalSenal('${t.id}', '${t.tipoTarea}', '${t.detalle}')"><i class="fa-solid fa-satellite-dish"></i> Registrar Señal</button>`;
            else if (t.tipoTarea === "otros" && t.detalle === "Limpieza de caja") { permitirEditarTecnico = true; if (isTecnicoCampo) textoBtnEditar = "<i class='fa-solid fa-list-check'></i> Puertos/Señal"; }

            let btnEditGralHtml = (isAdmin || isAdminLurin || isWilton || isCarlos || permitirEditarTecnico || isCobranzas) ? `<button class="btn-action-ui btn-ui-editar" onclick="editarTrabajo('${t.id}')">${textoBtnEditar}</button>` : "";
            if (btnSenalHtml !== "") botonesHtml += `<div class="btn-grid-row">${btnSenalHtml}</div>`;
            if (btnEditGralHtml !== "") botonesHtml += `<div class="btn-grid-row"><button class="btn-action-ui btn-ui-copiar" onclick="copiarDatos(this)"><i class="fa-solid fa-copy"></i> Copiar</button>${btnEditGralHtml}</div>`;

            if ((isAdmin || isAdminLurin || isCarlos) && (t.tipoTarea === "alta" || t.tipoTarea === "venta_equipos") && estActual !== "por_aprobar_carlos" && estActual !== "rechazada" && estActual !== "atendido" && estActual !== "no_atendido" && estActual !== "no_realizado") {
                botonesHtml += `<div class="btn-grid-row"><button class="btn-action-ui" style="background: rgba(168, 85, 247, 0.1); color: var(--purple); border: 1px solid var(--purple); font-weight: bold; width: 100%; transition: 0.2s;" onmouseover="this.style.background='var(--purple)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(168, 85, 247, 0.1)'; this.style.color='var(--purple)';" onclick="window.revertirAPorAprobar('${t.id}')"><i class="fa-solid fa-rotate-left"></i> Devolver a "Por Aprobar"</button></div>`;
            }
            if (isAdmin || isAdminLurin || isCarlos || isWilton) {
                botonesHtml += `<div class="btn-grid-row"><button class="btn-action-ui btn-ui-eliminar" style="background: transparent; color: var(--danger); border: 1px solid var(--danger); opacity: 0.8;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'" onclick="preguntarEliminar('${t.id}')"><i class="fa-solid fa-trash"></i> Eliminar Trabajo</button></div>`;
            }

            if ((isAdmin || isAdminLurin) && !esAprobacion && estActual !== "atendido" && estActual !== "no_atendido" && estActual !== "no_realizado") {
                botonesHtml += `<div class="btn-grid-row"><button class="btn-action-ui" style="background: rgba(16, 185, 129, 0.05); color: var(--success); border: 1px dashed var(--success); font-weight: bold; width: 100%; transition: 0.2s;" onmouseover="this.style.background='var(--success)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(16, 185, 129, 0.05)'; this.style.color='var(--success)';" onclick="window.abrirCierreForzadoAdmin('${t.id}')"><i class="fa-solid fa-bolt"></i> Cierre Express Admin</button></div>`;
            }

            let colorEstadoTxt = clasePunto === "ep-pend" ? "var(--warning)" : clasePunto === "ep-aten" ? "var(--success)" : clasePunto === "ep-noat" ? "var(--danger)" : clasePunto === "ep-cami" ? "var(--accent)" : clasePunto === "ep-proceso" ? "var(--purple)" : clasePunto === "ep-norealizado" ? "#64748b" : clasePunto === "ep-aprobar" ? "var(--purple)" : clasePunto === "ep-aprobada" ? "var(--accent)" : clasePunto === "ep-pausa" ? "#475569" : "var(--danger)";
            let htmlEstado = `<div style="display:inline-flex !important; align-items:center !important; gap:6px !important; background:var(--bg-panel) !important; padding:4px 10px !important; border-radius:12px !important; border:1px solid ${colorEstadoTxt} !important; box-shadow:0 2px 4px rgba(0,0,0,0.1) !important; z-index:10;"><div style="width:9px; height:9px; border-radius:50%; background:${colorEstadoTxt}; box-shadow:0 0 5px ${colorEstadoTxt}; flex-shrink:0;"></div><b style="font-size:10px !important; font-weight:900 !important; color:${colorEstadoTxt} !important; margin:0 !important; letter-spacing:0.5px !important; text-transform:uppercase;">${textEst}</b></div>`;

            let tr = document.createElement("tr");
            tr.className = "fila-trabajo-estatica"; 
            tr.setAttribute("oncontextmenu", `window.abrirMenuContextualTabla(event, '${t.id}')`);
            
            let esNuevo = window.ticketsNuevosFlash && window.ticketsNuevosFlash.has(t.id);
            if (esNuevo) {
                tr.style.animation = "flashNuevoTicket 4s ease-out";
                window.ticketsNuevosFlash.delete(t.id); 
            }

            if ((isAdmin || isAdminLurin || isWilton || isCarlos || permitirEditarTecnico || isCobranzas)) {
                tr.dataset.editId = t.id; tr.setAttribute("title", "💡 Doble clic para editar | Clic derecho para menú rápido"); tr.style.cursor = "pointer";
            }
            tr.innerHTML = `<td>${htmlEstado}</td><td>${infoCli}</td><td>${dirH}</td><td><div class="btn-acciones-grid">${botonesHtml}<textarea style="display:none;" class="texto-secreto">${txtCop}</textarea></div></td>`;
            tbody.appendChild(tr);
        });

        window.paginaActualTabla++;
        
        if (fin < window.datosTablaFiltrados.length) {
            let sentinel = document.createElement("tr");
            sentinel.id = "sentinel-row";
            sentinel.innerHTML = `<td colspan="4" style="text-align:center; padding:30px;"><i class="fa-solid fa-spinner fa-spin text-accent text-3xl"></i></td>`;
            tbody.appendChild(sentinel);
            
            if (window.tablaObserver) window.tablaObserver.disconnect();
            window.tablaObserver = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) { sentinel.remove(); window.dibujarSiguientePagina(); }
            });
            window.tablaObserver.observe(sentinel);
        }
    };

    window.dibujarSiguientePagina();
};

// ============================================================ //
// CAMBIO DE ESTADO Y CIERRE SLA                                //
// ============================================================ //
window.cambiarEstadoEnCamino = async (id) => {
    let isTecnicoCampo = !isAdmin && !isAdminLurin && !isWilton && !isCarlos && !isVendedor && !isCobranzas;
    
    // 🚧 REGLA DE ORO: Si es técnico, verificamos que no tenga otro trabajo activo
    if (isTecnicoCampo) {
        let trabajoActivo = dbTrabajos.find(t => {
            let asig = t.tecnicos || [];
            if (typeof asig === "string") asig = [asig];
            
            let estActual = t.estado || "pendiente";
            let esSuyo = asig.includes(nombreTecnicoLogueado);
            let estaOcupado = (estActual === "en_camino" || estActual === "en_proceso");
            
            return esSuyo && estaOcupado;
        });

        // Si encontramos que ya tiene uno en camino o en proceso, le bloqueamos el pase
        if (trabajoActivo) {
            let clienteNombre = trabajoActivo.cliente ? trabajoActivo.cliente.split(" ")[0] : "un cliente";
            if (typeof window.mostrarAlertaNOC === "function") {
                window.mostrarAlertaNOC(
                    "¡Trabajo en curso!", 
                    `Ya tienes una orden activa (${clienteNombre}).\n\nDebes finalizar tu trabajo actual (Atendido o No Realizado) antes de poder iniciar tu viaje hacia otro punto.`, 
                    "fa-hand", 
                    "#ef4444"
                );
            } else {
                mostrarToast("⚠️ Tienes un trabajo activo. Ciérralo primero.");
            }
            return; // 🛑 Detiene la función aquí, no le deja iniciar el nuevo
        }
    }

    // Si es Admin/NOC o si el técnico está libre, procede con normalidad
    let btnUi = event ? event.target.closest('button') : null;
    if(btnUi) { btnUi.disabled = true; btnUi.innerHTML = "⏳ Iniciando..."; }

    try {
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        await updateDoc(doc(coleccionTrabajos, id), { estado: "en_camino", tsInicio: Date.now() });
        mostrarToast("🚗 Técnico en camino. El reloj SLA ha iniciado.");
    } catch(e) { 
        mostrarToast("❌ Error de conexión al Firebase."); 
        if(btnUi) { btnUi.disabled = false; btnUi.innerHTML = `<i class="fa-solid fa-person-walking"></i> En Camino`; }
    }
};

// ==========================================
// SISTEMA DE PAUSA DE ÓRDENES (ADMIN / NOC)
// ==========================================
window.pausarTrabajo = async (id, estadoActual) => {
    if (!confirm("¿Seguro que deseas PAUSAR esta orden?\n\nAl hacerlo, la orden se bloqueará y el técnico quedará libre para poder tomar otros trabajos (como una Limpieza de Caja) mientras tanto.")) return;
    
    mostrarToast("⏳ Pausando orden...");
    try {
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        await updateDoc(doc(coleccionTrabajos, id), { 
            estado: "pausado",
            estadoPrevioPausa: estadoActual // Guardamos memoria de si estaba en camino o en proceso
        });
        mostrarToast("⏸️ Orden pausada correctamente.");
    } catch (e) {
        console.error(e);
        mostrarToast("❌ Error al pausar la orden.");
    }
};

window.reanudarTrabajo = async (id, estadoAConvertir) => {
    let estadoLimpio = estadoAConvertir.toUpperCase().replace("_", " ");
    if (!confirm(`¿Deseas REANUDAR esta orden?\n\nVolverá al panel del técnico en estado "${estadoLimpio}".`)) return;
    
    mostrarToast("⏳ Reanudando...");
    try {
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        await updateDoc(doc(coleccionTrabajos, id), { 
            estado: estadoAConvertir,
            estadoPrevioPausa: null
        });
        mostrarToast("▶️ Orden reanudada. El técnico vuelve a estar ocupado.");
    } catch (e) {
        console.error(e);
        mostrarToast("❌ Error al reanudar la orden.");
    }
};

// ============================================================ //
// MOTOR ACUMULADOR DE FOTOS Y CIERRE SLA                       //
// ============================================================ //

window.fotosCierreAcumuladas = [];

window.acumularFotos = (input) => {
    if (input.files && input.files.length > 0) {
        for (let file of input.files) {
            window.fotosCierreAcumuladas.push(file); 
        }
        window.dibujarPreviewFotos(); 
    }
    input.value = ""; 
};

window.dibujarPreviewFotos = () => {
    const cont = document.getElementById("previewFotosContenedor");
    if(!cont) return;
    cont.innerHTML = "";
    
    window.fotosCierreAcumuladas.forEach((file, index) => {
        let objUrl = URL.createObjectURL(file);
        cont.innerHTML += `
            <div style="position: relative; width: 65px; height: 65px; border-radius: 6px; overflow: hidden; border: 2px solid var(--warning); box-shadow: 0 4px 6px rgba(0,0,0,0.3); animation: fadeIn 0.3s ease;">
                <img src="${objUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                <button type="button" onclick="window.eliminarFotoAcumulada(${index})" style="position: absolute; top: 0; right: 0; background: rgba(239,68,68,0.9); color: white; border: none; width: 22px; height: 22px; font-size: 11px; cursor: pointer; border-bottom-left-radius: 4px;"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `;
    });
};

window.eliminarFotoAcumulada = (index) => {
    window.fotosCierreAcumuladas.splice(index, 1);
    window.dibujarPreviewFotos();
};

// ============================================================ //
// NUEVAS FUNCIONES LOGÍSTICAS (MODAL DE LLEGADA / FACHADA)     //
// ============================================================ //
window.abrirModalLlegada = (id, objetivo) => {
    document.getElementById("llegadaTrabajoId").value = id;
    document.getElementById("llegadaObjetivo").value = objetivo;
    document.getElementById("formFotoLlegada").value = "";
    document.getElementById("txtNotaLlegada").value = "";
    
    let titulo = document.getElementById("tituloModalLlegada");
    let btnGuardar = document.getElementById("btnConfirmarLlegada");
    let lblNota = document.getElementById("lblNotaLlegada");

    if (objetivo === "en_proceso") {
        titulo.innerHTML = '<i class="fa-solid fa-play"></i> Iniciar Trabajo';
        titulo.style.color = "var(--purple)";
        btnGuardar.innerText = "Comenzar Instalación";
        btnGuardar.style.background = "var(--purple)";
        lblNota.innerText = "Observación (Opcional):";
        if(document.getElementById("txtNotaLlegada")) document.getElementById("txtNotaLlegada").placeholder = "Ej: Llegué a la zona, procedo a instalar...";
    } else {
        titulo.innerHTML = '<i class="fa-solid fa-ban"></i> Marcar como No Realizado';
        titulo.style.color = "var(--danger)";
        btnGuardar.innerText = "Confirmar No Realizado";
        btnGuardar.style.background = "var(--danger)";
        lblNota.innerText = "Motivo de cancelación (Obligatorio):";
        if(document.getElementById("txtNotaLlegada")) document.getElementById("txtNotaLlegada").placeholder = "Ej: Toqué la puerta 15 min y nadie salió...";
    }

    document.getElementById("modalLlegada").style.display = "flex";
};

window.cerrarModalLlegada = () => { document.getElementById("modalLlegada").style.display = "none"; };

// ============================================================ //
// 🗜️ MOTOR DE COMPRESIÓN DE IMÁGENES (Ahorra 95% de Storage)   //
// ============================================================ //
window.comprimirFotografia = (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1000; // Calidad HD, perfecta para evidencias técnicas
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // 🔥 MEJORA DE RENDIMIENTO: Usar WebP en lugar de JPEG
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/webp', 0.75);
            };
        };
    });
};

// ============================================================ //
// NUEVAS FUNCIONES LOGÍSTICAS (MODAL DE LLEGADA / FACHADA)     //
// ============================================================ //
window.ejecutarLlegada = async () => {
    let id = document.getElementById("llegadaTrabajoId").value;
    let objetivo = document.getElementById("llegadaObjetivo").value;
    let nota = document.getElementById("txtNotaLlegada").value.trim();
    let fotoInput = document.getElementById("formFotoLlegada");

    if (fotoInput.files.length === 0) {
        if(typeof window.sacudirModal === 'function') window.sacudirModal('modalLlegada');
        mostrarToast("⚠️ OBLIGATORIO: Debes tomar una foto de la fachada para validar tu llegada.");
        return;
    }

    if (objetivo === "no_realizado" && !nota) {
        if(typeof window.sacudirModal === 'function') window.sacudirModal('modalLlegada');
        mostrarToast("⚠️ OBLIGATORIO: Escribe el motivo por el cual no se realizó el trabajo.");
        document.getElementById("txtNotaLlegada").focus();
        return;
    }

    let btn = document.getElementById("btnConfirmarLlegada");
    btn.disabled = true;
    btn.innerText = "⏳ Comprimiendo foto..."; // Bloqueo visual anti doble-clic
    
    try {
        const fileOriginal = fotoInput.files[0];
        
        // 1. COMPRIMIR ANTES DE SUBIR
        let fotoBlob = await window.comprimirFotografia(fileOriginal);

        // 2. CERRAMOS LA VENTANA PARA QUE EL TÉCNICO SIGA TRABAJANDO
        window.cerrarModalLlegada(); 
        mostrarToast("🚀 Subiendo foto ultraligera...");

        const { getStorage, ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js");
        const storage = getStorage();
        const storageRef = ref(storage, "evidencias_llegada/" + id + "_" + Date.now() + ".jpg");
        
        // 3. SUBIR EL BLOB COMPRIMIDO AL STORAGE
        await uploadBytes(storageRef, fotoBlob);
        const urlFotoLlegada = await getDownloadURL(storageRef);

        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        
        let datosAActualizar = { 
            estado: objetivo, 
            tsLlegada: Date.now(), 
            notaLlegada: nota,
            fotoLlegada: urlFotoLlegada
        };

        if (objetivo === "no_realizado") {
            datosAActualizar.tsFin = Date.now();
        }

        await updateDoc(doc(coleccionTrabajos, id), datosAActualizar);

        mostrarToast("✅ Llegada registrada con éxito en la Nube.");
    } catch (e) {
        mostrarToast("❌ Error al subir la foto. Revisa tu internet.");
        console.error(e);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Confirmar Llegada";
        }
    }
};

window.abrirModalCierreDirecto = (id, objetivo) => {
    idTrabajoCierreSLA = id;
    estadoObjetivoSLA = objetivo; 
    
    // Buscar la tarea para saber de qué tipo es
    let t = dbTrabajos.find(x => x.id === id);
    let esAlta = t && t.tipoTarea === 'alta';
    
    let esTraslado = t && t.tipoTarea === 'averia' && t.detalle && t.detalle.includes("Traslado");
    let esIdentificacion = t && t.tipoTarea === 'otros' && t.detalle === 'Identificación de hilos en CTO';
    let esIdentificacionMufa = t && t.tipoTarea === 'otros' && t.detalle === 'Identificación de hilos en mufa';
    
    let lblEstado = document.getElementById("lblEstadoCierre");
    if(lblEstado) {
        lblEstado.innerText = objetivo === "atendido" ? "ATENDIDO (EXITOSO)" : "NO ATENDIDO (FALLIDO)";
        lblEstado.style.color = objetivo === "atendido" ? "var(--success)" : "var(--danger)";
    }
    
    let txtNota = document.getElementById("txtNotaCierre");
    if (txtNota) {
        txtNota.placeholder = objetivo === "atendido" ? "Ej: Se dejó el router configurado y fibra fusionada..." : "Ej: El cliente no se encontraba en el domicilio / Falta de postes...";
        txtNota.value = "";
    }
    
    // LÓGICA DE LA SEÑAL Y PUERTO: Aparece solo si es ALTA o TRASLADO y fue ATENDIDO
    let cajaSenal = document.getElementById("cajaSenalCierre");
    let txtSenal = document.getElementById("txtSenalCierre");
    let txtPuerto = document.getElementById("txtPuertoCierre");
    if (cajaSenal && txtSenal && txtPuerto) {
        txtSenal.value = ""; 
        txtPuerto.value = ""; 
        
        if ((esAlta || esTraslado) && objetivo === "atendido") {
            cajaSenal.style.display = "block";
        } else {
            cajaSenal.style.display = "none";
        }
    }

    // LÓGICA DE IDENTIFICACIÓN DE HILOS CTO
    let cajaIden = document.getElementById("cajaIdentificacionCierre");
    let selIngreso = document.getElementById("txtIngresoFibraCierre");
    let selSalida = document.getElementById("txtSalidaFibraCierre");
    
    if (cajaIden && selIngreso && selSalida) {
        selIngreso.value = "";
        selSalida.value = "";
        if (esIdentificacion && objetivo === "atendido") {
            cajaIden.style.display = "block";
        } else {
            cajaIden.style.display = "none";
        }
    }

    // 🔥 LÓGICA DE IDENTIFICACIÓN DE HILOS MUFA (NUEVO)
    let cajaMufa = document.getElementById("cajaIdentificacionMufaCierre");
    if (cajaMufa) {
        // Limpiamos todo al abrir
        document.getElementById("mufaIngresoCierre").value = "";
        document.getElementById("mufaIngresoObsCierre").value = "";
        document.getElementById("mufaSalida1Cierre").value = "";
        document.getElementById("mufaSalida2Cierre").value = "";
        document.getElementById("mufaSalida3Cierre").value = "";
        document.getElementById("mufaSalida4Cierre").value = "";
        document.getElementById("mufaSalidaObs1Cierre").value = "";
        document.getElementById("mufaSalidaObs2Cierre").value = "";
        document.getElementById("mufaSalidaObs3Cierre").value = "";
        document.getElementById("mufaSalidaObs4Cierre").value = "";
        document.getElementById("mufaSplitter1Cierre").value = "";
        document.getElementById("mufaSplitter2Cierre").value = "";
        document.getElementById("mufaSplitterObsCierre").value = "";

        if (esIdentificacionMufa && objetivo === "atendido") {
            cajaMufa.style.display = "block";
        } else {
            cajaMufa.style.display = "none";
        }
    }

    window.fotosCierreAcumuladas = [];
    if(document.getElementById("previewFotosContenedor")) document.getElementById("previewFotosContenedor").innerHTML = "";
    
    document.getElementById("modalCierre").style.display = "flex";
};

window.revertirAPendiente = (id) => {
    let overlay = document.createElement("div");
    overlay.id = "modalRevertirDinamico";
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center; animation: fadeIn 0.2s ease-out;";
    
    overlay.innerHTML = `
        <div style="background:var(--bg-panel); border:1px solid var(--border); padding:25px; border-radius:15px; text-align:center; max-width:350px; width:90%; box-shadow:0 15px 30px rgba(0,0,0,0.5);">
            <i class="fa-solid fa-rotate-left" style="font-size:3.5rem; color:var(--text-muted); margin-bottom:15px; display:block;"></i>
            <h3 style="color:var(--text-main); font-size:1.2rem; font-weight:900; margin-bottom:10px;">¿Revertir a Pendiente?</h3>
            <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:20px; line-height:1.4;">Esto borrará el tiempo de SLA y las fotos registradas. Solo hazlo para reprogramar o corregir un error.</p>
            
            <div style="display:flex; gap:10px;">
                <button id="btnCancelarRevert" style="flex:1; background:transparent; border:1px solid var(--border); color:var(--text-muted); padding:10px; border-radius:8px; font-weight:bold; cursor:pointer; transition: 0.2s;">Cancelar</button>
                <button id="btnConfirmarRevert" style="flex:1; background:var(--warning); color:#000; border:none; padding:10px; border-radius:8px; font-weight:bold; cursor:pointer; transition: 0.2s;">Sí, Revertir</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("btnCancelarRevert").onclick = () => overlay.remove();
    
    document.getElementById("btnConfirmarRevert").onclick = async () => {
        let btn = document.getElementById("btnConfirmarRevert");
        btn.innerText = "⏳ Revirtiendo...";
        btn.disabled = true;
        btn.style.opacity = "0.7";
        
        try {
            const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
            await updateDoc(doc(coleccionTrabajos, id), { 
                estado: "pendiente", tsInicio: null, tsFin: null, notaCierre: null, evidencias: null 
            });
            mostrarToast("🔄 Trabajo reseteado a Pendiente exitosamente.");
        } catch(e) { 
            mostrarToast("❌ Error al revertir en la base de datos."); 
        } finally {
            overlay.remove(); 
        }
    };
};

// ============================================================ //
// DEVOLVER VENTA A "POR APROBAR" (EXCLUSIVO ADMIN / COORD)
// ============================================================ //
window.revertirAPorAprobar = (id) => {
    let overlay = document.createElement("div");
    overlay.id = "modalRevertirAprobarDinamico";
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center; animation: fadeIn 0.2s ease-out;";
    
    overlay.innerHTML = `
        <div style="background:var(--bg-panel); border:1px solid var(--border); padding:25px; border-radius:15px; text-align:center; max-width:350px; width:90%; box-shadow:0 15px 30px rgba(0,0,0,0.5);">
            <i class="fa-solid fa-rotate-left" style="font-size:3.5rem; color:var(--purple); margin-bottom:15px; display:block;"></i>
            <h3 style="color:var(--text-main); font-size:1.2rem; font-weight:900; margin-bottom:10px;">¿Devolver a Ventas?</h3>
            <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:20px; line-height:1.4;">La venta regresará al estado <b style="color:var(--purple);">"Por Aprobar"</b>. Se limpiará al técnico asignado y se reiniciará el reloj de la instalación.</p>
            
            <div style="display:flex; gap:10px;">
                <button id="btnCancelarRevertAp" style="flex:1; background:transparent; border:1px solid var(--border); color:var(--text-muted); padding:10px; border-radius:8px; font-weight:bold; cursor:pointer; transition: 0.2s;" onmouseover="this.style.background='var(--bg-app)'" onmouseout="this.style.background='transparent'">Cancelar</button>
                <button id="btnConfirmarRevertAp" style="flex:1; background:var(--purple); color:#fff; border:none; padding:10px; border-radius:8px; font-weight:bold; cursor:pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(168, 85, 247, 0.3);">Sí, Devolver</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("btnCancelarRevertAp").onclick = () => overlay.remove();
    
    document.getElementById("btnConfirmarRevertAp").onclick = async () => {
        let btn = document.getElementById("btnConfirmarRevertAp");
        btn.innerText = "⏳ Devolviendo...";
        btn.disabled = true;
        btn.style.opacity = "0.7";
        
        try {
            const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
            await updateDoc(doc(coleccionTrabajos, id), { 
                estado: "por_aprobar_carlos", 
                tecnicos: ["Sin Asignar"], // Lo quita de la ruta del técnico
                tsInicio: null, 
                tsLlegada: null, 
                tsFin: null, 
                notaLlegada: null, 
                fotoLlegada: null, 
                notaCierre: null, 
                evidencias: null 
            });
            mostrarToast("🔄 Venta devuelta a 'Por Aprobar' exitosamente.");
        } catch(e) { 
            mostrarToast("❌ Error al revertir en la base de datos."); 
        } finally {
            overlay.remove(); 
        }
    };
};

// ============================================================ //
// CAMBIO DE ESTADO Y CIERRE SLA (FUNCIÓN CORREGIDA + COMPRESIÓN)//
// ============================================================ //
window.ejecutarCierreSLA = async () => {
    if (!idTrabajoCierreSLA) return;
    const nota = document.getElementById("txtNotaCierre").value.trim();
    const files = [...window.fotosCierreAcumuladas]; 
    
    // A) VALIDACIÓN DE FOTO OBLIGATORIA
    if (estadoObjetivoSLA === "atendido" && files.length === 0) {
        window.sacudirModal('modalCierre');
        mostrarToast("⚠️ OBLIGATORIO: Debes adjuntar al menos una foto de evidencia para finalizar el trabajo.");
        return;
    }

    // B) Validación de Caja NAP (Solo para Instalaciones)
    let cajaSenal = document.getElementById("cajaSenalCierre");
    let txtSenal = document.getElementById("txtSenalCierre");
    let valorSenal = "";
    let valorPuerto = "";

    if (cajaSenal && cajaSenal.style.display === "block") {
        valorSenal = txtSenal.value.trim();
        valorPuerto = parseInt(document.getElementById("txtPuertoCierre").value.trim());
        
        if (!valorPuerto || isNaN(valorPuerto)) {
            window.sacudirModal('modalCierre');
            mostrarToast("⚠️ OBLIGATORIO: Ingresa el número de PUERTO en la caja.");
            document.getElementById("txtPuertoCierre").focus();
            return;
        }
        if (!valorSenal) {
            window.sacudirModal('modalCierre');
            mostrarToast("⚠️ OBLIGATORIO: Ingresa la SEÑAL ÓPTICA para cerrar.");
            txtSenal.focus();
            return;
        }

        // 👇🔥 ESCUDO SMART OLT EN CAMPO (TÉCNICOS) 🔥👇
        let tActual = dbTrabajos.find(x => x.id === idTrabajoCierreSLA);
        let cajaActual = String(tActual.caja || "").toUpperCase().trim();
        
        if (cajaActual && valorPuerto > 0) {
            let checkPuerto = window.verificarEstadoPuerto(cajaActual, valorPuerto, idTrabajoCierreSLA);
            if (!checkPuerto.disponible) {
                window.sacudirModal('modalCierre');
                mostrarToast(`❌ <b>PUERTO OCUPADO EN INVENTARIO:</b><br>El puerto ${valorPuerto} de la caja ${cajaActual} no está libre.<br><br>${checkPuerto.motivo}`);
                document.getElementById("txtPuertoCierre").focus();
                return; // 🛑 Bloquea el cierre del técnico en el celular
            }
        }
        // 👆🔥 FIN DEL ESCUDO 🔥👆
    }

    // C) Validación de Identificación de Hilos CTO
    let cajaIden = document.getElementById("cajaIdentificacionCierre");
    let selIngreso = document.getElementById("txtIngresoFibraCierre");
    let selSalida = document.getElementById("txtSalidaFibraCierre");
    let valIngreso = "";
    let valSalida = "";

    if (cajaIden && cajaIden.style.display === "block") {
        valIngreso = selIngreso.value;
        valSalida = selSalida.value;
        
        if (!valIngreso && !valSalida) {
            window.sacudirModal('modalCierre');
            mostrarToast("⚠️ OBLIGATORIO: Debes seleccionar al menos el INGRESO o la SALIDA de fibra.");
            selIngreso.focus();
            return;
        }
    }

    // 🔥 D) Validación de Identificación de MUFA (NUEVO)
    let cajaMufa = document.getElementById("cajaIdentificacionMufaCierre");
    let mIn, mInObs, mOut1, mOut2, mOut3, mOut4, mOutObs1, mOutObs2, mOutObs3, mOutObs4, mSp1, mSp2, mSpObs;

    if (cajaMufa && cajaMufa.style.display === "block") {
        mIn = document.getElementById("mufaIngresoCierre").value;
        mInObs = document.getElementById("mufaIngresoObsCierre").value.trim();
        mOut1 = document.getElementById("mufaSalida1Cierre").value;
        mOut2 = document.getElementById("mufaSalida2Cierre").value;
        mOut3 = document.getElementById("mufaSalida3Cierre").value;
        mOut4 = document.getElementById("mufaSalida4Cierre").value;
        mOutObs1 = document.getElementById("mufaSalidaObs1Cierre").value.trim();
        mOutObs2 = document.getElementById("mufaSalidaObs2Cierre").value.trim();
        mOutObs3 = document.getElementById("mufaSalidaObs3Cierre").value.trim();
        mOutObs4 = document.getElementById("mufaSalidaObs4Cierre").value.trim();
        mSp1 = document.getElementById("mufaSplitter1Cierre").value;
        mSp2 = document.getElementById("mufaSplitter2Cierre").value;
        mSpObs = document.getElementById("mufaSplitterObsCierre").value.trim();

        if (!mIn || !mInObs || !mOut1 || !mOutObs1 || !mSpObs) {
            window.sacudirModal('modalCierre');
            mostrarToast("⚠️ OBLIGATORIO: El Ingreso, la Salida 1 (con su comentario) y los Splitters son obligatorios.");
            if(btn) { btn.disabled = false; btn.innerText = "Confirmar Cierre"; }
            return;
        }
    }

    // ==========================================
    // INICIO DEL PROCESO DE CIERRE Y COMPRESIÓN
    // ==========================================
    let btn = document.querySelector("#modalCierre .btn-guardar");
    btn.disabled = true;
    btn.innerText = "⏳ Comprimiendo..."; 

    try {
        mostrarToast(`🗜️ Comprimiendo ${files.length} foto(s)...`);
        let fotosComprimidas = [];
        for (let i = 0; i < files.length; i++) {
            let comprimida = await window.comprimirFotografia(files[i]);
            fotosComprimidas.push(comprimida);
        }

        window.cerrarModalCierre();
        document.getElementById("txtNotaCierre").value = "";
        window.fotosCierreAcumuladas = []; 
        if(document.getElementById("previewFotosContenedor")) document.getElementById("previewFotosContenedor").innerHTML = "";

        mostrarToast(`🚀 Subiendo evidencias ultraligeras...`);

        let urlsFotos = [];
        const { getStorage, ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js");
        const storage = getStorage();
        
        for (let i = 0; i < fotosComprimidas.length; i++) {
            const storageRef = ref(storage, "evidencias_tecnicas/" + idTrabajoCierreSLA + "_" + Date.now() + "_" + i + ".jpg");
            await uploadBytes(storageRef, fotosComprimidas[i]);
            const url = await getDownloadURL(storageRef);
            urlsFotos.push(url);
        }

        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        
        let datosAActualizar = { 
            estado: estadoObjetivoSLA, 
            tsFin: Date.now(), 
            notaCierre: nota,
            evidencias: urlsFotos 
        };

        // Guardar Datos Señal Router
        if (valorSenal !== "") {
            datosAActualizar.tx = valorSenal;
            datosAActualizar.puerto = valorPuerto;
        }

        // Guardar Datos CTO
        if (valIngreso !== "" || valSalida !== "") {
            datosAActualizar.fibraIngreso = valIngreso || "No aplica";
            datosAActualizar.fibraSalida = valSalida || "No aplica";
            datosAActualizar.notaCierre = `Ingreso: ${valIngreso || "N/A"} | Salida: ${valSalida || "N/A"} | Observación: ${nota}`;
        }

        // 🔥 Guardar Datos MUFA
        if (mIn) {
            datosAActualizar.mufaIngreso = mIn;
            datosAActualizar.mufaIngresoObs = mInObs;
            datosAActualizar.mufaSalida1 = mOut1;
            datosAActualizar.mufaSalida2 = mOut2;
            datosAActualizar.mufaSalida3 = mOut3;
            datosAActualizar.mufaSalida4 = mOut4;
            datosAActualizar.mufaSalidaObs1 = mOutObs1;
            datosAActualizar.mufaSalidaObs2 = mOutObs2;
            datosAActualizar.mufaSalidaObs3 = mOutObs3;
            datosAActualizar.mufaSalidaObs4 = mOutObs4;
            datosAActualizar.mufaSplitter1 = mSp1;
            datosAActualizar.mufaSplitter2 = mSp2;
            datosAActualizar.mufaSplitterObs = mSpObs;
            
            let salidasD = [mOut1, mOut2, mOut3, mOut4].filter(Boolean).join(", ");
            let spD = [mSp1, mSp2].filter(Boolean).join(", ");
            
            let textObsSalidas = [
                mOutObs1 ? `S1: ${mOutObs1}` : "",
                mOutObs2 ? `S2: ${mOutObs2}` : "",
                mOutObs3 ? `S3: ${mOutObs3}` : "",
                mOutObs4 ? `S4: ${mOutObs4}` : ""
            ].filter(Boolean).join(" | ");

            datosAActualizar.notas = `Ingreso: ${mIn} hilos | Salidas: ${salidasD} hilos ${spD ? '| Splitters: '+spD : ''}`;
            datosAActualizar.notaCierre = `${nota} | In: ${mInObs} | Out: ${textObsSalidas} | Sp: ${mSpObs}`;
        }

        await updateDoc(doc(coleccionTrabajos, idTrabajoCierreSLA), datosAActualizar);

        mostrarToast("✅ Trabajo cerrado y evidencias guardadas con éxito."); 
        if (estadoObjetivoSLA === "atendido" && window.lanzarConfeti) window.lanzarConfeti();
    } catch (e) { 
        mostrarToast("❌ Error al subir fotos. Revisa tu conexión."); 
        console.error(e);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Confirmar Cierre";
        }
    }
};

// ============================================================ //
// GRÁFICOS Y CALENDARIO                                        //
// ============================================================ //
function actualizarGraficosGerenciales(trabajosFiltrados) {
    if (!isAdmin && !isAdminLurin && !isWilton && !isCarlos && !isVendedor && !isCobranzas) return;

    setTimeout(() => {
        try {
            // 🔥 Añadimos la variable "rech" para contar los rechazados por separado
            let pend = 0, aten = 0, noAten = 0, noReal = 0, rech = 0;
            let cTech = {};

            trabajosFiltrados.forEach((t) => {
                let est = String(t.estado || "pendiente").toLowerCase();
                
                if (est === "atendido") aten++;
                else if (est === "no_atendido") noAten++;
                else if (est === "no_realizado") noReal++; 
                else if (est === "rechazada") rech++; // 👈 ¡Atrapamos a los rechazados aquí!
                else pend++; // Ahora solo quedan los verdaderos pendientes (por_aprobar_carlos, pendiente, en_camino, etc)

                let asig = t.tecnicos || [];
                if (typeof asig === "string") asig = [asig];

                asig.forEach((tech) => {
                    if (tech !== "Sin Asignar" && tech !== "Todos") cTech[tech] = (cTech[tech] || 0) + 1;
                });
            });

            // Actualizamos los números en pantalla
            if(document.getElementById("kpiTotal")) document.getElementById("kpiTotal").innerText = trabajosFiltrados.length;
            if(document.getElementById("kpiAtendidos")) document.getElementById("kpiAtendidos").innerText = aten;
            if(document.getElementById("kpiPendientes")) document.getElementById("kpiPendientes").innerText = pend;
            if(document.getElementById("kpiNoAtendidos")) document.getElementById("kpiNoAtendidos").innerText = noAten;
            if(document.getElementById("kpiNoRealizados")) document.getElementById("kpiNoRealizados").innerText = noReal; 
            if(document.getElementById("kpiRechazados")) document.getElementById("kpiRechazados").innerText = rech; // 👈 Actualizamos la nueva tarjeta

            if (typeof window.renderizarCalendario === "function") window.renderizarCalendario();

            if (isAdmin || isAdminLurin || isWilton || isCobranzas) {
                const isDark = document.documentElement.getAttribute("data-theme") !== "light";
                const textColor = isDark ? "#94a3b8" : "#64748b";
                const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";

                const canvasT = document.getElementById("graficoTecnicos");
                if (canvasT) {
                    const ctxT = canvasT.getContext("2d");
                    if (chartTecnicos) chartTecnicos.destroy();

                    let gradient = ctxT.createLinearGradient(0, 0, 0, 400);
                    gradient.addColorStop(0, "#00e5ff");
                    gradient.addColorStop(1, "#2979ff");

                    chartTecnicos = new Chart(ctxT, {
                        type: "bar",
                        data: {
                            labels: Object.keys(cTech),
                            datasets: [{ data: Object.values(cTech), backgroundColor: gradient, borderRadius: 6, barThickness: 35 }]
                        },
                        options: {
                            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                            scales: {
                                y: { grid: { color: gridColor }, ticks: { stepSize: 1, color: textColor } },
                                x: { grid: { display: false }, ticks: { color: textColor, font: { size: 10 } } }
                            }
                        }
                    });
                }
            }
        } catch (e) { console.error("Error gráficos:", e); }
    }, 150);
}

// ============================================================ //
// RENDERIZAR CALENDARIO NOC (VERSIÓN PREMIUM SAAS)             //
// ============================================================ //
window.renderizarCalendario = () => {
    const weekStrip = document.getElementById("calWeekStrip");
    const dayHeader = document.getElementById("calDayHeader");
    const timelineMini = document.getElementById("calTimelineMini");
    const lblSemana = document.getElementById("lblSemanaActual");
    if (!weekStrip || !dayHeader || !timelineMini) return;

    const hoy = new Date();
    const lunesBase = new Date(hoy);
    lunesBase.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    lunesBase.setHours(0, 0, 0, 0);
    lunesBase.setDate(lunesBase.getDate() + semanaOffset * 7);

    const domingo = new Date(lunesBase);
    domingo.setDate(lunesBase.getDate() + 6);

    const opciones = { day: "numeric", month: "short" };
    lblSemana.innerHTML = `<i class="fa-regular fa-calendar" style="color: var(--text-muted); margin-right: 5px;"></i> ${lunesBase.toLocaleDateString("es", opciones)} — ${domingo.toLocaleDateString("es", opciones)}`;
    lblSemana.style.color = "var(--text-main)";

    const hoyStr = hoy.toISOString().split("T")[0];
    if (!diaSeleccionado || diaSeleccionado < lunesBase.toISOString().split("T")[0] || diaSeleccionado > domingo.toISOString().split("T")[0]) {
        diaSeleccionado = hoy >= lunesBase && hoy <= domingo ? hoyStr : lunesBase.toISOString().split("T")[0];
    }

    const diasSemana = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
    let htmlStrip = "";

    for (let i = 0; i < 7; i++) {
        const dia = new Date(lunesBase);
        dia.setDate(lunesBase.getDate() + i);
        const diaStr = dia.toISOString().split("T")[0];
        const diaNum = dia.getDate();

        // Filtro estricto: Solo trabajos reales de la zona
        const trabajosDia = dbTrabajos.filter(t => {
            if (t.tipoTarea === "biometrico" || !t.cliente || String(t.cliente).toLowerCase() === "undefined") return false;
            if (t.dir === "En Refrigerio" || t.dir === "Reporte Interno") return false;
            let z = String(t.zona || "Norte").toLowerCase();
            if (z !== String(zonaActual).toLowerCase()) return false;
            if (t.fecha !== diaStr) return false;
            let est = String(t.estado || "pendiente").toLowerCase();
            if (est === "por_aprobar_carlos" || est === "aprobada_wilton" || est === "rechazada") return false;
            return true;
        });

        const isActive = diaStr === diaSeleccionado;
        const isToday = diaStr === hoyStr;

        let bgDia = isActive ? "var(--accent)" : "transparent";
        let colorDia = isActive ? "#fff" : "var(--text-main)";
        let bordeDia = isToday && !isActive ? "1px solid var(--accent)" : "1px solid transparent";
        
        // Mejoramos las burbujitas numéricas para que no se deformen con números de 3 dígitos
        htmlStrip += `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 0; border-radius: 12px; cursor: pointer; background: ${bgDia}; color: ${colorDia}; border: ${bordeDia}; transition: 0.2s; width: 13.5%;" 
                 onclick="window.seleccionarDia('${diaStr}')" 
                 onmouseover="if(!${isActive}) this.style.background='rgba(0,229,255,0.1)'" 
                 onmouseout="if(!${isActive}) this.style.background='transparent'">
                <span style="font-size: 10px; font-weight: 800; opacity: 0.8; margin-bottom: 2px;">${diasSemana[i]}</span>
                <span style="font-size: 18px; font-weight: 900;">${diaNum}</span>
                ${trabajosDia.length > 0 ? 
                    `<div style="background: ${isActive ? '#fff' : 'var(--accent)'}; color: ${isActive ? 'var(--accent)' : '#fff'}; font-size: 10px; font-weight: 900; border-radius: 12px; padding: 2px 8px; margin-top: 5px; box-shadow: 0 3px 6px rgba(0,0,0,0.15); min-width: 22px; text-align: center;">
                        ${trabajosDia.length}
                    </div>` 
                    : `<div style="height: 20px; margin-top: 5px;"></div>`}
            </div>
        `;
    }
    
    weekStrip.style.display = "flex";
    weekStrip.style.justifyContent = "space-between";
    weekStrip.style.background = "var(--bg-app)";
    weekStrip.style.padding = "8px";
    weekStrip.style.borderRadius = "16px";
    weekStrip.style.border = "1px solid var(--border)";
    weekStrip.innerHTML = htmlStrip;

    // --- RENDER DE LA LISTA DE TRABAJOS DEL DÍA (TIMELINE) ---
    const trabajosSel = dbTrabajos.filter(t => {
        if (t.tipoTarea === "biometrico" || !t.cliente || String(t.cliente).toLowerCase() === "undefined") return false;
        if (t.dir === "En Refrigerio" || t.dir === "Reporte Interno") return false;
        let z = String(t.zona || "Norte").toLowerCase();
        if (z !== String(zonaActual).toLowerCase()) return false;
        if (t.fecha !== diaSeleccionado) return false;
        let est = String(t.estado || "pendiente").toLowerCase();
        if (est === "por_aprobar_carlos" || est === "aprobada_wilton" || est === "rechazada") return false;
        return true;
    }).sort((a, b) => (a.horaInicio || "23:59").localeCompare(b.horaInicio || "23:59"));

    // 🔥 MAGIA: CALCULADORA DE PROGRESO DIARIO
    let tareasDelDia = trabajosSel.length;
    let tareasCompletadas = trabajosSel.filter(t => t.estado === 'atendido' || t.estado === 'no_atendido' || t.estado === 'no_realizado').length;
    let porcentaje = tareasDelDia > 0 ? Math.round((tareasCompletadas / tareasDelDia) * 100) : 0;
    let colorBarra = porcentaje === 100 ? "var(--success)" : "var(--accent)";

    const fechaSel = new Date(diaSeleccionado + "T00:00:00");
    
    // Encabezado con la barra de progreso
    dayHeader.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-weight: 900; font-size: 11px; color: var(--text-main);">
                <i class="fa-solid fa-calendar-day" style="color: var(--accent); margin-right: 4px;"></i> ${fechaSel.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "short" }).toUpperCase()}
            </div>
            ${tareasDelDia > 0 ? `<span style="font-size: 10px; background: var(--bg-app); color: var(--text-muted); padding: 3px 8px; border-radius: 12px; font-weight: 900; border: 1px solid var(--border);"><b style="color: ${colorBarra};">${tareasCompletadas}</b> /${tareasDelDia} Cerrados</span>` : ''}
        </div>
        ${tareasDelDia > 0 ? `
        <div style="width: 100%; background: var(--bg-app); height: 6px; border-radius: 3px; overflow: hidden; border: 1px solid var(--border);">
            <div style="height: 100%; background: ${colorBarra}; width: ${porcentaje}\%; transition: width 0.8s cubic-bezier(0.25, 0.8, 0.25, 1); box-shadow: 0 0 8px${colorBarra}80;"></div>
        </div>` : ''}
    `;
    dayHeader.style.marginBottom = "15px";
    dayHeader.style.borderBottom = "none";
    dayHeader.style.paddingBottom = "0";

    if (trabajosSel.length === 0) {
        timelineMini.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 11px; padding: 30px 0; background: var(--bg-app); border-radius: 12px; border: 1px dashed var(--border);"><i class="fa-solid fa-mug-hot text-2xl block mb-2 opacity-40"></i>Agenda libre para este día.</div>';
    } else {
        let htmlPills = "";
        trabajosSel.forEach((t) => {
            let estActual = String(t.estado || "pendiente").toLowerCase();
            let colorPill = "var(--text-main)";
            let iconPill = "fa-clock";
            let bgPill = "var(--bg-panel)"; // Fondo sólido para parecer tarjetas
            
            if (estActual === "atendido") { colorPill = "var(--success)"; iconPill = "fa-check"; bgPill = "rgba(16, 185, 129, 0.05)"; }
            else if (estActual === "no_atendido" || estActual === "no_realizado") { colorPill = "var(--danger)"; iconPill = "fa-xmark"; bgPill = "rgba(239, 68, 68, 0.05)"; }
            else if (estActual === "en_camino" || estActual === "en_proceso") { colorPill = "var(--purple)"; iconPill = "fa-truck-fast"; bgPill = "rgba(168, 85, 247, 0.05)"; }
            else if (estActual === "pendiente") { colorPill = "var(--warning)"; iconPill = "fa-clock"; bgPill = "var(--bg-app)"; } // Pendientes en gris claro

            // 🔥 MAGIA: Extraer iniciales del técnico
            let tecNombre = Array.isArray(t.tecnicos) ? t.tecnicos[0] : (t.tecnicos || "Sin Asignar");
            let iniciales = "??";
            if (tecNombre !== "Sin Asignar" && tecNombre.length >= 2) {
                // Toma las dos primeras letras y las hace mayúsculas
                iniciales = tecNombre.substring(0, 2).toUpperCase();
            }

            htmlPills += `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px; background: ${bgPill}; border: 1px solid var(--border); border-left: 4px solid ${colorPill}; border-radius: 8px; margin-bottom: 10px; cursor: pointer; transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1); box-shadow: 0 2px 4px rgba(0,0,0,0.02);" 
                 onmouseover="this.style.transform='translateX(4px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.05)';" 
                 onmouseout="this.style.transform='none'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.02)';" 
                 onclick="window.filtrarPorCliente('${t.cliente.replace(/'/g, "\\'")}')" 
                 title="Téc: ${t.tecnicos}">
                
                <div style="display: flex; align-items: center; gap: 12px; overflow: hidden; flex: 1;">
                    <!-- AVATAR DEL TÉCNICO -->
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: ${colorPill}20; color: ${colorPill}; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; flex-shrink: 0; border: 1px solid ${colorPill}50;">
                        ${iniciales}
                    </div>
                    
                    <div style="display: flex; flex-direction: column; overflow: hidden; flex: 1;">
                        <span style="font-size: 12px; font-weight: 900; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;">${t.cliente.split('-')[0].trim()}</span>
                        <span style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">
                            <i class="fa-solid fa-clock" style="color: ${colorPill}; margin-right: 3px;"></i> <b>${window.formato12h(t.horaInicio)}</b> <span style="opacity:0.5; margin: 0 4px;">|</span> ${(t.tipoTarea || "OTROS")}
                        </span>
                    </div>
                </div>
                
                <!-- ICONO DE ESTADO A LA DERECHA -->
                <i class="fa-solid ${iconPill}" style="color: ${colorPill}; font-size: 16px; opacity: 0.8; flex-shrink: 0; margin-left: 5px;"></i>
            </div>`;
        });
        
        timelineMini.innerHTML = `<div style="max-height: 260px; overflow-y: auto; padding-right: 5px;">${htmlPills}</div>`;
    }
};

// ============================================================ //
// FUNCIONES DEL CALENDARIO QUE HABÍAN DESAPARECIDO             //
// ============================================================ //

window.navegarSemana = (offset) => { semanaOffset += offset; window.renderizarCalendario(); };
window.irAHoy = () => { semanaOffset = 0; diaSeleccionado = new Date().toISOString().split("T")[0]; window.renderizarCalendario(); };
window.seleccionarDia = (fechaStr) => { diaSeleccionado = fechaStr; window.renderizarCalendario(); };
window.filtrarPorCliente = (nombre) => {
    const buscador = document.getElementById("buscador");
    if (buscador) { buscador.value = nombre; window.renderizarTabla(); mostrarToast(`🔍 Filtrando: ${nombre}`); }
};

const coloresTecnicos = ["#0ea5e9", "#f43f5e", "#10b981", "#f59e0b", "#8b5cf6", "#f97316", "#06b6d4", "#14b8a6"];

window.abrirModalCalendario = () => {
    document.getElementById("modalCalendario").style.display = "flex";
    let listaTecnicos = zonaActual === "Norte" ? tecnicosNorte : tecnicosLurin;
    let htmlFiltro = `<option value="todos">Todos los Técnicos</option>`;
    listaTecnicos.forEach((t) => { htmlFiltro += `<option value="${t}">${t}</option>`; });
    document.getElementById("filtroTecnicoCalendario").innerHTML = htmlFiltro;
    window.actualizarCalendarioGeneral();
};

window.cerrarModalCalendario = () => { document.getElementById("modalCalendario").style.display = "none"; };

// ==========================================
// ABRIR CONFIGURACIÓN DEL SISTEMA
// ==========================================
window.abrirModalConfiguracion = () => {
    // 🛑 ESCUDO DE SEGURIDAD ABSOLUTO: Bloquear acceso a Admins Regionales (Lurín)
    if (typeof isAdminLurin !== 'undefined' && isAdminLurin) {
        mostrarToast("⛔ Acceso denegado. Módulo exclusivo para Administradores Globales.");
        return;
    }

    document.getElementById("modalConfiguracion").style.display = "flex";
    if (typeof window.renderizarTablaPlanesConfig === "function") {
        window.renderizarTablaPlanesConfig();
    }
};

window.actualizarCalendarioGeneral = () => {
    const calendarEl = document.getElementById("calendarioGeneral");
    const tecnicoFiltro = document.getElementById("filtroTecnicoCalendario")?.value || "todos";
    const estadoFiltro = document.getElementById("filtroEstadoCalendario")?.value || "todos";

    if (!calendarEl) return;
    if (window.calendarioInstancia) window.calendarioInstancia.destroy();

    let eventos = [];
    const coloresAsignados = {};
    let idxColor = 0;

    dbTrabajos.forEach((t) => {
        // 🔥 FILTRO: Ignorar "basura" (asistencias, almuerzos) para que no ensucien el calendario
        if (t.tipoTarea === "biometrico" || t.dir === "En Refrigerio" || t.dir === "Reporte Interno") return;
        if ((t.zona || "Norte").toLowerCase() !== String(zonaActual).toLowerCase()) return;
        
        let estActual = String(t.estado || "pendiente").toLowerCase();
        if (estActual === "por_aprobar_carlos" || estActual === "aprobada_wilton" || estActual === "rechazada") return;
        
        let tecnicos = Array.isArray(t.tecnicos) ? t.tecnicos : [t.tecnicos || "Sin Asignar"];
        if (tecnicoFiltro !== "todos" && !tecnicos.includes(tecnicoFiltro)) return;

        // FILTRO DE ESTADO EN EL CALENDARIO
        if (estadoFiltro === "pendientes" && estActual !== "pendiente") return;
        if (estadoFiltro === "ejecucion" && estActual !== "en_camino" && estActual !== "en_proceso") return;
        if (estadoFiltro === "terminados" && estActual !== "atendido" && estActual !== "no_atendido" && estActual !== "no_realizado") return;

        const techPrincipal = tecnicos[0];
        if (!coloresAsignados[techPrincipal]) {
            coloresAsignados[techPrincipal] = coloresTecnicos[idxColor % coloresTecnicos.length];
            idxColor++;
        }

        // ICONOS INTELIGENTES
        let icono = "⚙️";
        if (t.tipoTarea === "alta") icono = "🚀";
        else if (t.tipoTarea === "averia") icono = "🛠️";
        else if (t.tipoTarea === "baja" || (t.tipoTarea === "retencion" && t.estadoLlamada === "Retiro Definitivo")) icono = "🛑";
        else if (t.tipoTarea === "venta_equipos") icono = "🛒";

        // Estilos según el estado (Diferenciar visualmente los terminados)
        let opacidad = (estActual === "atendido" || estActual === "no_atendido" || estActual === "no_realizado") ? "99" : "EE";
        let decoracion = estActual === "atendido" ? "✅ " : estActual === "no_atendido" ? "❌ " : estActual === "no_realizado" ? "🚫 " : "";
        let bordeEstilo = (estActual === "atendido" || estActual === "no_atendido") ? "dashed" : "solid";
        
        // 🧠 MAGIA: REEMPLAZAMOS EL TIEMPO PROGRAMADO POR EL TIEMPO REAL
        let startIso = t.fecha + "T" + (t.horaInicio || "08:00") + ":00";
        let endIso = t.fecha + "T" + (t.horaFin || "09:00") + ":00";

        // Si el técnico ya tocó los botones, usamos el reloj del servidor
        if (t.tsInicio) {
            let dIni = new Date(t.tsInicio);
            startIso = dIni.getFullYear() + "-" + String(dIni.getMonth() + 1).padStart(2, '0') + "-" + String(dIni.getDate()).padStart(2, '0') + "T" + String(dIni.getHours()).padStart(2, '0') + ":" + String(dIni.getMinutes()).padStart(2, '0') + ":00";
        }
        
        if (t.tsFin) {
            let dFin = new Date(t.tsFin);
            endIso = dFin.getFullYear() + "-" + String(dFin.getMonth() + 1).padStart(2, '0') + "-" + String(dFin.getDate()).padStart(2, '0') + "T" + String(dFin.getHours()).padStart(2, '0') + ":" + String(dFin.getMinutes()).padStart(2, '0') + ":00";
        } else if (t.tsInicio && !t.tsFin) {
            // Si está "En curso" actualmente, el bloque se estira hasta la hora actual
            let dAhora = new Date();
            endIso = dAhora.getFullYear() + "-" + String(dAhora.getMonth() + 1).padStart(2, '0') + "-" + String(dAhora.getDate()).padStart(2, '0') + "T" + String(dAhora.getHours()).padStart(2, '0') + ":" + String(dAhora.getMinutes()).padStart(2, '0') + ":00";
        }

        // Validación anti-crasheo por fechas invertidas
        if (endIso < startIso) endIso = startIso;

        let clienteNombreLimpio = t.cliente ? t.cliente.split("-")[0].trim() : "Sin Nombre";

        eventos.push({
            id: t.id, 
            title: `${decoracion}${icono} ${clienteNombreLimpio}`,
            start: startIso, 
            end: endIso,
            backgroundColor: coloresAsignados[techPrincipal] + opacidad, 
            borderColor: 'rgba(255,255,255,0.5)', // Borde sutil blanco
            textColor: "#ffffff",
            extendedProps: { 
                estado: estActual,
                tsInicio: t.tsInicio,
                tsLlegada: t.tsLlegada,
                tsFin: t.tsFin,
                tecnico: techPrincipal,
                bordeEstilo: bordeEstilo
            }
        });
    });

    window.calendarioInstancia = new FullCalendar.Calendar(calendarEl, {
        initialView: "timeGridWeek", 
        locale: "es", 
        height: "100%", 
        expandRows: true,
        editable: true, 
        droppable: true,
        slotEventOverlap: false, // 🔥 MAGIA 1: Esto evita que se apilen como cartas. Se pondrán uno al lado del otro.
        eventMinHeight: 40,      // 🔥 MAGIA 2: Altura mínima para que siempre haya espacio para leer el texto
        buttonText: { today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' },
        headerToolbar: { 
            left: "prev,next today", 
            center: "title", 
            right: "timeGridDay,timeGridWeek,dayGridMonth" 
        },
        slotMinTime: "06:00:00", 
        slotMaxTime: "22:00:00", 
        allDaySlot: false, 
        events: eventos,
        
        // 🎨 INYECTAR DATOS REALES (ADAPTATIVO Y ANTI-DESBORDE)
        eventContent: function(arg) {
            let info = arg.event.extendedProps;
            let vista = arg.view.type; 
            
            let hrIniProg = arg.event.start ? arg.event.start.toLocaleTimeString("es-PE", {hour: "2-digit", minute:"2-digit"}) : "--:--";
            let hrIni = info.tsInicio ? new Date(info.tsInicio).toLocaleTimeString("es-PE", {hour: "2-digit", minute:"2-digit"}) : hrIniProg;
            let hrLleg = info.tsLlegada ? new Date(info.tsLlegada).toLocaleTimeString("es-PE", {hour: "2-digit", minute:"2-digit"}) : "--:--";
            let hrFin = info.tsFin ? new Date(info.tsFin).toLocaleTimeString("es-PE", {hour: "2-digit", minute:"2-digit"}) : "--:--";

            let html = '';
            // Estilo base con sombra en la caja y en las letras
            let estiloBase = `border: 1.5px ${info.bordeEstilo} rgba(255,255,255,0.8); border-radius: 6px; padding: 4px; height: 100%; overflow: hidden; display: flex; flex-direction: column; justify-content: center; box-shadow: inset 0 0 10px rgba(0,0,0,0.1);`;

            if (vista === 'dayGridMonth') {
                // VISTA MES: Minimalista absoluto (Solo hora y nombre corto, con sombra para que resalte)
                html = `<div style="overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 10px; font-weight: bold; text-shadow: 0 1px 3px rgba(0,0,0,0.8); padding: 1px 3px;">
                            ${hrIni} ${arg.event.title}
                        </div>`;
            } else if (vista === 'timeGridWeek') {
                // VISTA SEMANA: Limpio, centrado en el técnico y el cliente
                html = `<div style="${estiloBase}">
                            <div style="font-weight: 900; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">
                                ${arg.event.title}
                            </div>
                            <div style="font-size: 9px; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 900; background: rgba(0,0,0,0.3); border-radius: 4px; padding: 2px 5px; width: fit-content; text-shadow: none;">
                                <i class="fa-solid fa-helmet-safety"></i> ${info.tecnico.split(' ')[0]}
                            </div>
                        </div>`;
            } else {
                // VISTA DÍA: Detalles completos (Ideal para monitoreo preciso)
                html = `<div style="${estiloBase} justify-content: flex-start; padding: 6px;">
                            <div style="font-weight: 900; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 4px; margin-bottom: 4px; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">
                                ${arg.event.title}
                            </div>
                            <div style="font-size: 11px; font-weight: 900; background: rgba(0,0,0,0.3); border-radius: 4px; padding: 2px 6px; margin-bottom: 6px; width: fit-content; text-shadow: none;">
                                <i class="fa-solid fa-helmet-safety"></i> ${info.tecnico}
                            </div>`;
                if (info.tsInicio) {
                    html += `<div style="font-size: 10px; line-height: 1.4; opacity: 0.95; font-weight: bold; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">
                                <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">🚗 Salida: ${hrIni}</div>
                                <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">🏠 Llegó: ${hrLleg}</div>
                                <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${info.tsFin ? `✅ Fin: ${hrFin}` : `<span style="color: #fef08a;">⚡ EN PROCESO...</span>`}</div>
                             </div>`;
                } else {
                    html += `<div style="font-size: 10px; opacity: 0.9; margin-top: 2px; font-weight: bold; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">
                                <i class="fa-solid fa-clock"></i> Prog: ${hrIniProg}
                             </div>`;
                }
                html += `</div>`;
            }
            return { html: html };
        },
        
        // 💬 ETIQUETA FLOTANTE (HOVER): Muestra la info completa sin hacer clic
        eventDidMount: function(info) {
            let props = info.event.extendedProps;
            let tooltipText = info.event.title + "\n";
            
            if (props.tsInicio) {
                tooltipText += `🚗 Salida: ${new Date(props.tsInicio).toLocaleTimeString("es-PE", {hour: "2-digit", minute:"2-digit"})}\n`;
                if (props.tsLlegada) tooltipText += `🏠 Llegó: ${new Date(props.tsLlegada).toLocaleTimeString("es-PE", {hour: "2-digit", minute:"2-digit"})}\n`;
                if (props.tsFin) tooltipText += `✅ Fin: ${new Date(props.tsFin).toLocaleTimeString("es-PE", {hour: "2-digit", minute:"2-digit"})}`;
                else tooltipText += `⚡ EN PROCESO...`;
            } else {
                tooltipText += `⏳ Prog: ${info.event.start ? info.event.start.toLocaleTimeString("es-PE", {hour: "2-digit", minute:"2-digit"}) : '--:--'}`;
            }
            
            info.el.setAttribute("title", tooltipText);
        },
        
        eventClick: function(info) {
            window.cerrarModalCalendario();
            window.editarTrabajo(info.event.id);
        },
        
        eventDrop: async function(info) {
            if(info.event.extendedProps.estado === 'atendido' || info.event.extendedProps.estado === 'no_atendido' || info.event.extendedProps.estado === 'no_realizado') {
                mostrarToast("⚠️ No puedes reprogramar un trabajo que ya fue cerrado por el técnico.");
                info.revert();
                return;
            }
            let start = info.event.start;
            let end = info.event.end || new Date(start.getTime() + 60*60000); 
            
            let nuevoDia = start.getFullYear() + "-" + String(start.getMonth() + 1).padStart(2, '0') + "-" + String(start.getDate()).padStart(2, '0');
            let nuevaHoraInicio = String(start.getHours()).padStart(2, '0') + ":" + String(start.getMinutes()).padStart(2, '0');
            let nuevaHoraFin = String(end.getHours()).padStart(2, '0') + ":" + String(end.getMinutes()).padStart(2, '0');

            mostrarToast("⏳ Guardando nueva programación...");
            try {
                const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
                await updateDoc(doc(coleccionTrabajos, info.event.id), {
                    fecha: nuevoDia,
                    horaInicio: nuevaHoraInicio,
                    horaFin: nuevaHoraFin
                });
                mostrarToast(`✅ Reprogramado al ${nuevoDia} a las ${nuevaHoraInicio}`);
            } catch (e) {
                info.revert(); 
            }
        },
        
        eventResize: async function(info) {
            if(info.event.extendedProps.tsInicio) {
                mostrarToast("⚠️ No puedes estirar manualmente un trabajo que ya inició SLA real.");
                info.revert();
                return;
            }
            let start = info.event.start;
            let end = info.event.end;
            let nuevaHoraInicio = String(start.getHours()).padStart(2, '0') + ":" + String(start.getMinutes()).padStart(2, '0');
            let nuevaHoraFin = String(end.getHours()).padStart(2, '0') + ":" + String(end.getMinutes()).padStart(2, '0');
            
            try {
                const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
                await updateDoc(doc(coleccionTrabajos, info.event.id), {
                    horaInicio: nuevaHoraInicio,
                    horaFin: nuevaHoraFin
                });
                mostrarToast("✅ Duración programada actualizada.");
            } catch (e) {
                info.revert();
            }
        }
    });
    
    setTimeout(() => { window.calendarioInstancia.render(); }, 100);
};

let fechaAutoSeleccionada = false; // Variable global para saber si ya se autoseleccionó hoy

function actualizarOpcionesFechas() {
    const inputFecha = document.getElementById("filtroFecha");
    const inputDesde = document.getElementById("filtroFechaDesde");
    const inputHasta = document.getElementById("filtroFechaHasta");

    // Mágia de Auto-Selección: Solo la primera vez que entras forzamos la fecha de "Hoy" en todos los filtros
    if (!fechaAutoSeleccionada) {
        let hoyObj = new Date();
        let hoyStr = hoyObj.getFullYear() + "-" + String(hoyObj.getMonth() + 1).padStart(2, '0') + "-" + String(hoyObj.getDate()).padStart(2, '0');
        
        if (inputFecha) inputFecha.value = hoyStr;
        if (inputDesde) inputDesde.value = hoyStr;
        if (inputHasta) inputHasta.value = hoyStr;
        
        fechaAutoSeleccionada = true;
    }
}

function formatoFecha(fs) {
    if (!fs) return ""; let p = String(fs).split("-");
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : fs;
}

function mostrarToast(msg) {
    const t = document.getElementById("toast");
    if(t) {
        t.innerHTML = msg; t.className = "show";
        setTimeout(() => { t.className = t.className.replace("show", ""); }, 3000);
    }
}

window.copiarDatos = (btn) => {
    let txt = btn.closest("td").querySelector(".texto-secreto").value;
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => mostrarToast("Copiado al portapapeles")); 
    else mostrarToast("Error al copiar");
};

window.preguntarEliminar = (id) => { idTrabajoAEliminar = id; document.getElementById("modalEliminar").style.display = "flex"; };

window.ejecutarEliminacion = () => {
    if (idTrabajoAEliminar) {
        window.cerrarModalEliminar();
        let tr = document.querySelector(`tr[data-edit-id="${idTrabajoAEliminar}"]`);
        
        // 🔥 NUEVA LÓGICA: Borrado en Cascada (Ticket + Notificaciones)
        const procesarEliminacionCascada = async () => {
            try {
                const { doc, collection, query, where, getDocs, writeBatch } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
                
                // 1. Buscamos todas las menciones vinculadas a este ticket
                const qNotif = query(
                    collection(db, "artifacts", appId, "public", "data", "notificaciones_sistema"), 
                    where("ticketId", "==", idTrabajoAEliminar)
                );
                const snapshotNotif = await getDocs(qNotif);
                
                // 2. Usamos "writeBatch" para borrar TODO de un solo golpe súper rápido
                const batch = writeBatch(db);
                
                // Añadimos el ticket principal al carrito de borrado
                batch.delete(doc(coleccionTrabajos, idTrabajoAEliminar));
                
                // Añadimos todas sus notificaciones huérfanas al carrito de borrado
                snapshotNotif.forEach((docNotif) => {
                    batch.delete(doc(db, "artifacts", appId, "public", "data", "notificaciones_sistema", docNotif.id));
                });
                
                // 3. Ejecutamos la destrucción masiva
                await batch.commit();
                mostrarToast("🗄️ Trabajo y menciones triturados");
                
            } catch (error) {
                console.error("Error al eliminar cascada:", error);
                mostrarToast("❌ Error al eliminar el trabajo");
            }
        };

        if (tr) {
            // 1. Reproducimos el sonido de trituradora
            if (typeof window.playSonidoUX === 'function') window.playSonidoUX('shredder');
            
            // 2. Animación física de caer en la trituradora
            tr.style.transition = "all 0.8s cubic-bezier(0.25, 0.8, 0.25, 1)";
            tr.style.transform = "translateY(50px) scale(0.95)";
            tr.style.opacity = "0";
            tr.style.filter = "blur(4px)";
            
            // 3. Esperamos que termine la animación y ejecutamos la cascada
            setTimeout(() => {
                procesarEliminacionCascada();
            }, 800);
        } else {
            procesarEliminacionCascada();
        }
    }
};

window.exportarAExcel = () => {
    if (!dbTrabajos || dbTrabajos.length === 0) { mostrarToast("⚠️ No hay datos para exportar."); return; }
    
    // Auto-rellenar la lista con los técnicos y vendedores
    let selectUser = document.getElementById("expUsuario");
    if(selectUser) {
        let allUsers = new Set();
        dbTrabajos.forEach(t => {
            if(t.tecnicos && Array.isArray(t.tecnicos)) t.tecnicos.forEach(tech => allUsers.add(tech));
            else if (t.tecnicos) allUsers.add(t.tecnicos);
            if(t.vendedor) allUsers.add(t.vendedor);
        });
        let opts = `<option value="todos">Todos los Usuarios</option>`;
        [...allUsers].sort().forEach(u => {
            if(u && u !== "Sin Asignar") opts += `<option value="${u}">${u}</option>`;
        });
        selectUser.innerHTML = opts;
    }

    // ✨ MAGIA DE PERMISOS: Opciones a la medida según el rol
    let selectTipo = document.getElementById("expTipo");
    if (selectTipo) {
        if (isCarlos) { 
            // Coordinador: Solo ve sus opciones y una combinada para facilitar su reporte
            selectTipo.innerHTML = `
                <option value="comercial">Todas las Ventas (Altas + Equipos)</option>
                <option value="alta">Solo Instalaciones (Altas)</option>
                <option value="venta_equipos">Solo Venta de Equipos</option>
            `;
            selectTipo.disabled = false; 
            selectTipo.style.background = ""; 
            selectTipo.style.cursor = "pointer";
        } else { 
            // Admin / NOC: Ven el menú completo
            selectTipo.innerHTML = `
                <option value="todos">Todos los Tipos</option>
                <option value="alta">Solo Instalaciones (Altas)</option>
                <option value="venta_equipos">Solo Venta de Equipos</option>
                <option value="averia">Solo Averías</option>
                <option value="baja">Solo Retiros (Bajas)</option>
                <option value="otros">Otros (Planta Externa)</option>
            `;
            selectTipo.disabled = false; 
        }
    }

    document.getElementById("modalExportar").style.display = "flex";
};

// ==========================================
// 📊 GENERADOR DE REPORTES EJECUTIVOS (PDF)
// ==========================================
window.abrirModalReportePDF = () => {
    let hoy = new Date();
    let primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    let ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];

    document.getElementById("repDesde").value = primerDia;
    document.getElementById("repHasta").value = ultimoDia;

    let selGestor = document.getElementById("repTecnico");
    if (selGestor) {
        let lista = (zonaActual === "Lurin") ? tecnicosLurin : tecnicosNorte;
        let opts = `<option value="todos">Todos los Técnicos</option>`;
        lista.forEach(t => opts += `<option value="${t}">${t}</option>`);
        selGestor.innerHTML = opts;
    }

    document.getElementById("modalReportePDF").style.display = "flex";
};

let pdfChartEstados = null;
let pdfChartTendencia = null;
let pdfChartTecnicos = null;

window.generarReportePDF = () => {
    let desde = document.getElementById("repDesde").value;
    let hasta = document.getElementById("repHasta").value;
    let tec = document.getElementById("repTecnico").value;
    let tipo = document.getElementById("repTipo").value;

    if (!desde || !hasta) { mostrarToast("⚠️️ Debes seleccionar una fecha Desde y Hasta."); return; }
    if (desde > hasta) { mostrarToast("⚠️ La fecha 'Desde' no puede ser mayor que 'Hasta'."); return; }

    let btn = document.getElementById("btnGenerarPDFReal");
    btn.disabled = true;
    btn.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> Construyendo documento...";

    // 1. FILTRAR TRABAJOS
    let trabajosReporte = dbTrabajos.filter(t => {
        if (t.tipoTarea === "biometrico") return false;
        if ((t.zona || "Norte") !== zonaActual) return false;

        let fechaT = t.fecha || "";
        if (fechaT < desde || fechaT > hasta) return false;
        if (tipo !== "todos" && t.tipoTarea !== tipo) return false;
        if (tec !== "todos") {
            let asig = Array.isArray(t.tecnicos) ? t.tecnicos : [t.tecnicos];
            if (!asig.includes(tec)) return false;
        }
        return true;
    });

    if (trabajosReporte.length === 0) {
        mostrarToast("⚠️ No hay trabajos registrados con esos filtros.");
        btn.disabled = false;
        btn.innerHTML = "<i class='fa-solid fa-print'></i> Construir PDF";
        return;
    }

    // 2. CÁLCULOS
    let stats = { total: trabajosReporte.length, atendidos: 0, noAtendidos: 0, noRealizados: 0, pendientes: 0 };
    let porTecnico = {};
    let porDia = {};

    trabajosReporte.forEach(t => {
        let est = String(t.estado || "pendiente").toLowerCase();

        if (est === "atendido" || est === "aprobada_wilton") stats.atendidos++;
        else if (est === "no_atendido") stats.noAtendidos++;
        else if (est === "no_realizado" || est === "rechazada") stats.noRealizados++;
        else stats.pendientes++;

        if (t.fecha) porDia[t.fecha] = (porDia[t.fecha] || 0) + 1;

        let asig = Array.isArray(t.tecnicos) ? t.tecnicos : [t.tecnicos || "Sin Asignar"];
        asig.forEach(tech => {
            if (!tech || tech === "Sin Asignar") return;
            if (!porTecnico[tech]) porTecnico[tech] = { total: 0, atendidos: 0, fallidos: 0, pendientes: 0 };
            porTecnico[tech].total++;
            if (est === "atendido" || est === "aprobada_wilton") porTecnico[tech].atendidos++;
            else if (est === "no_atendido" || est === "no_realizado" || est === "rechazada") porTecnico[tech].fallidos++;
            else porTecnico[tech].pendientes++;
        });
    });

    let cerrados = stats.atendidos + stats.noAtendidos + stats.noRealizados;
    let efectividad = cerrados > 0 ? Math.round((stats.atendidos / cerrados) * 100) : 0;

    // 3. INYECTAR DATOS
    const formatoLindo = (f) => { let p = f.split("-"); return `${p[2]}/${p[1]}/${p[0]}`; };
    document.getElementById("pdfRangoFechas").innerText = `DEL ${formatoLindo(desde)} AL ${formatoLindo(hasta)}`;
    document.getElementById("pdfZona").innerText = zonaActual.toUpperCase();
    document.getElementById("pdfTecnicoFiltro").innerText = tec === "todos" ? "Todos" : tec;
    let mapaTipos = { alta: "Instalaciones", averia: "Averías", baja: "Bajas", otros: "Otros", venta_equipos: "Venta Equipos", todos: "Todos los tipos" };
    document.getElementById("pdfTipoFiltro").innerText = mapaTipos[tipo] || tipo;

    let d1 = new Date(desde + "T00:00:00");
    let d2 = new Date(hasta + "T00:00:00");
    let diasTotales = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
    document.getElementById("pdfDiasTotales").innerText = `${diasTotales} día${diasTotales > 1 ? 's' : ''}`;

    document.getElementById("pdfKpiTotal").innerText = stats.total;
    document.getElementById("pdfKpiAtendidos").innerText = stats.atendidos;
    document.getElementById("pdfKpiEfectividad").innerText = efectividad + "%";
    document.getElementById("pdfKpiNoAtendidos").innerText = stats.noAtendidos;
    document.getElementById("pdfKpiNoRealizados").innerText = stats.noRealizados;
    document.getElementById("pdfKpiPendientes").innerText = stats.pendientes;

    // Resumen ejecutivo dinámico
    let promedioDiario = (stats.total / diasTotales).toFixed(1);
    let tecTop = Object.entries(porTecnico).sort((a,b) => b[1].atendidos - a[1].atendidos)[0];
    let textoResumen = `En el período de <b>${diasTotales} día${diasTotales > 1 ? 's' : ''}</b> se registraron <b>${stats.total} órdenes</b> (promedio <b>${promedioDiario}/día</b>). `;
    textoResumen += `Se atendieron <b style="color:#10b981;">${stats.atendidos}</b> exitosamente (efectividad <b>${efectividad}%</b> sobre cerradas). `;
    if (stats.noAtendidos > 0) textoResumen += `Hubo <b style="color:#ef4444;">${stats.noAtendidos}</b> no atendidos. `;
    if (stats.noRealizados > 0) textoResumen += `<b>${stats.noRealizados}</b> no realizados. `;
    if (stats.pendientes > 0) textoResumen += `Quedan <b style="color:#f59e0b;">${stats.pendientes}</b> pendientes/en curso. `;
    if (tecTop && tecTop[1].atendidos > 0) textoResumen += `El técnico más productivo fue <b>${tecTop[0]}</b> con <b>${tecTop[1].atendidos}</b> trabajo${tecTop[1].atendidos !== 1 ? 's' : ''} atendidos.`;
    document.getElementById("pdfResumenTexto").innerHTML = textoResumen;

    let dHoy = new Date();
    document.getElementById("pdfFechaGeneracion").innerText = `${dHoy.toLocaleDateString('es-PE')} a las ${dHoy.toLocaleTimeString('es-PE')}`;
    document.getElementById("pdfGeneradoPor").innerText = `Generado por: ${window.nombreUsuarioGlobal || "Admin"}`;

    // 4. LIMPIAR GRÁFICOS ANTERIORES
    if (pdfChartEstados) { pdfChartEstados.destroy(); pdfChartEstados = null; }
    if (pdfChartTendencia) { pdfChartTendencia.destroy(); pdfChartTendencia = null; }
    if (pdfChartTecnicos) { pdfChartTecnicos.destroy(); pdfChartTecnicos = null; }

    // 5. GRÁFICO DOUGHNUT (Estados)
    let ctxEst = document.getElementById("pdfChartEstados").getContext('2d');
    pdfChartEstados = new Chart(ctxEst, {
        type: 'doughnut',
        data: {
            labels: ['Atendidos', 'No Atendidos', 'No Realizados', 'Pendientes'],
            datasets: [{
                data: [stats.atendidos, stats.noAtendidos, stats.noRealizados, stats.pendientes],
                backgroundColor: ['#10b981', '#ef4444', '#64748b', '#f59e0b'],
                borderColor: '#ffffff',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            cutout: '65%',
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 10, padding: 8, font: { size: 9, weight: 'bold' }, color: '#475569' } },
                tooltip: { enabled: false }
            }
        },
        plugins: [{
            id: 'centerText',
            afterDraw: (chart) => {
                let { ctx, chartArea } = chart;
                if (!chartArea) return;
                let cx = (chartArea.left + chartArea.right) / 2;
                let cy = (chartArea.top + chartArea.bottom) / 2;
                ctx.save();
                ctx.font = 'bold 22px Segoe UI';
                ctx.fillStyle = '#0f172a';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(stats.total.toString(), cx, cy - 5);
                ctx.font = 'bold 9px Segoe UI';
                ctx.fillStyle = '#64748b';
                ctx.fillText('ÓRDENES', cx, cy + 14);
                ctx.restore();
            }
        }]
    });

    // 6. GRÁFICO TENDENCIA POR DÍA/SEMANA
    let diasArr = [];
    let cursor = new Date(desde + "T00:00:00");
    let finCur = new Date(hasta + "T00:00:00");
    while (cursor <= finCur) {
        let iso = cursor.getFullYear() + "-" + String(cursor.getMonth()+1).padStart(2,'0') + "-" + String(cursor.getDate()).padStart(2,'0');
        diasArr.push(iso);
        cursor.setDate(cursor.getDate() + 1);
    }

    let etiquetas = [];
    let valores = [];
    if (diasArr.length > 31) {
        // Agrupar por semana si el rango es muy largo
        let semanas = {};
        diasArr.forEach(d => {
            let dt = new Date(d + "T00:00:00");
            let primeroEnero = new Date(dt.getFullYear(), 0, 1);
            let diaAnio = Math.floor((dt - primeroEnero) / 86400000);
            let semana = Math.ceil((diaAnio + primeroEnero.getDay() + 1) / 7);
            let key = `Sem ${semana}`;
            if (!semanas[key]) semanas[key] = 0;
            semanas[key] += porDia[d] || 0;
        });
        Object.keys(semanas).forEach(k => { etiquetas.push(k); valores.push(semanas[k]); });
    } else {
        diasArr.forEach(d => {
            let p = d.split("-");
            etiquetas.push(`${p[2]}/${p[1]}`);
            valores.push(porDia[d] || 0);
        });
    }

    let ctxTend = document.getElementById("pdfChartTendencia").getContext('2d');
    let gradienteTend = ctxTend.createLinearGradient(0, 0, 0, 190);
    gradienteTend.addColorStop(0, 'rgba(14, 165, 233, 0.35)');
    gradienteTend.addColorStop(1, 'rgba(14, 165, 233, 0.02)');

    pdfChartTendencia = new Chart(ctxTend, {
        type: 'line',
        data: {
            labels: etiquetas,
            datasets: [{
                label: 'Trabajos',
                data: valores,
                borderColor: '#0ea5e9',
                backgroundColor: gradienteTend,
                borderWidth: 2.5,
                tension: 0.35,
                fill: true,
                pointBackgroundColor: '#0ea5e9',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 9 }, color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { ticks: { font: { size: 9, weight: 'bold' }, color: '#64748b', maxRotation: 0, autoSkip: true, autoSkipPadding: 10 }, grid: { display: false } }
            }
        }
    });

    // 7. GRÁFICO PRODUCTIVIDAD POR TÉCNICO
    let tecOrdenados = Object.entries(porTecnico).sort((a,b) => b[1].total - a[1].total);
    let tecNombres = tecOrdenados.map(x => x[0]);
    let tecTotalArr = tecOrdenados.map(x => x[1].total);
    let tecAtendArr = tecOrdenados.map(x => x[1].atendidos);
    let tecFallArr = tecOrdenados.map(x => x[1].fallidos);

    let ctxTecs = document.getElementById("pdfChartTecnicos").getContext('2d');
    pdfChartTecnicos = new Chart(ctxTecs, {
        type: 'bar',
        data: {
            labels: tecNombres,
            datasets: [
                { label: 'Asignados', data: tecTotalArr, backgroundColor: 'rgba(14, 165, 233, 0.85)', borderRadius: 5 },
                { label: 'Atendidos ✅', data: tecAtendArr, backgroundColor: 'rgba(16, 185, 129, 0.9)', borderRadius: 5 },
                { label: 'Fallidos ❌', data: tecFallArr, backgroundColor: 'rgba(239, 68, 68, 0.85)', borderRadius: 5 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 12, padding: 10, font: { size: 10, weight: 'bold' }, color: '#475569' } },
                tooltip: { enabled: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 9 }, color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { ticks: { font: { size: 9, weight: 'bold' }, color: '#475569' }, grid: { display: false } }
            }
        }
    });

    // 8. TABLA RESUMEN POR TÉCNICO
    let tablaBody = document.getElementById("pdfTablaTecnicos");
    let htmlTabla = "";
    tecOrdenados.forEach(([nombreTec, s]) => {
        let ef = (s.atendidos + s.fallidos) > 0 ? Math.round((s.atendidos / (s.atendidos + s.fallidos)) * 100) : 0;
        let efColor = ef >= 80 ? '#10b981' : (ef >= 50 ? '#f59e0b' : '#ef4444');
        htmlTabla += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 7px 8px; font-weight: 800; color: #0f172a;">${nombreTec}</td>
                <td style="padding: 7px 8px; text-align: center; font-weight: 700; color: #334155;">${s.total}</td>
                <td style="padding: 7px 8px; text-align: center; font-weight: 900; color: #10b981;">${s.atendidos}</td>
                <td style="padding: 7px 8px; text-align: center; font-weight: 900; color: #ef4444;">${s.fallidos}</td>
                <td style="padding: 7px 8px; text-align: center; font-weight: 700; color: #64748b;">${s.pendientes}</td>
                <td style="padding: 7px 8px; text-align: center; font-weight: 900; color: ${efColor};">${ef}%</td>
            </tr>
        `;
    });
    htmlTabla += `
        <tr style="background: #f1f5f9; border-top: 2px solid #cbd5e1;">
            <td style="padding: 8px; font-weight: 900; color: #0f172a; text-transform: uppercase; font-size: 9px;">TOTAL GENERAL</td>
            <td style="padding: 8px; text-align: center; font-weight: 900; color: #0f172a;">${stats.total}</td>
            <td style="padding: 8px; text-align: center; font-weight: 900; color: #10b981;">${stats.atendidos}</td>
            <td style="padding: 8px; text-align: center; font-weight: 900; color: #ef4444;">${stats.noAtendidos + stats.noRealizados}</td>
            <td style="padding: 8px; text-align: center; font-weight: 900; color: #f59e0b;">${stats.pendientes}</td>
            <td style="padding: 8px; text-align: center; font-weight: 900; color: #0ea5e9;">${efectividad}%</td>
        </tr>
    `;
    tablaBody.innerHTML = htmlTabla;

        // 9. CAPTURAR Y EXPORTAR (MODO FANTASMA - CENTRADO PERFECTO)
    setTimeout(() => {
        const elemento = document.getElementById("zonaImpresionPDF");
        const btn = document.getElementById("btnGenerarPDFReal");

        // Bloqueamos el botón visualmente
        btn.disabled = true;
        btn.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> Construyendo documento...";

        // 1. Convertimos los gráficos a imágenes estáticas
        const canvasIds = ["pdfChartEstados", "pdfChartTendencia", "pdfChartTecnicos"];
        const reemplazos = [];

        canvasIds.forEach((id) => {
            let canvasEl = document.getElementById(id);
            if (!canvasEl) return;
            try {
                let dataURL = canvasEl.toDataURL("image/png", 1.0);
                let imgTemp = document.createElement("img");
                imgTemp.src = dataURL;
                imgTemp.style.width = canvasEl.offsetWidth + "px";
                imgTemp.style.height = canvasEl.offsetHeight + "px";
                imgTemp.style.display = "block";
                imgTemp.id = id + "_tempimg";

                reemplazos.push({ canvas: canvasEl, img: imgTemp });
                canvasEl.parentElement.replaceChild(imgTemp, canvasEl);
            } catch (e) {
                console.warn("No se pudo convertir canvas:", id, e);
            }
        });

        // 2. Configuramos la cámara (Anclaje absoluto y 0 márgenes extra)
        const opciones = {
            margin:       0, // 🎯 FIX: 0 márgenes externos. Tu HTML ya tiene un padding interno de 40px que hace el borde.
            filename:     `TEN_Reporte_${desde}_al_${hasta}.pdf`,
            image:        { type: 'jpeg', quality: 1.0 },
            html2canvas:  {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                scrollX: 0, // 🎯 FIX: Evitamos que el scroll del navegador lo empuje hacia la derecha
                scrollY: 0,
                onclone: (clonedDoc) => {
                    const clonContenedor = clonedDoc.getElementById("contenedorExportPDF");
                    if (clonContenedor) {
                        // 🎯 FIX: Anclaje estricto. Obligamos a la cámara a tomar la foto desde el pixel (0,0) exacto.
                        clonContenedor.style.position = "fixed"; 
                        clonContenedor.style.left = "0px";
                        clonContenedor.style.top = "0px";
                    }
                }
            },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // 3. Ejecutamos la captura directamente
        html2pdf().set(opciones).from(elemento).save().then(() => {
            // Restauramos los gráficos en la pantalla real
            reemplazos.forEach(({ canvas, img }) => {
                if (img && img.parentElement && canvas) {
                    img.parentElement.replaceChild(canvas, img);
                }
            });
            
            window.cerrarModalGeneral("modalReportePDF");
            btn.disabled = false;
            btn.innerHTML = "<i class='fa-solid fa-print'></i> Construir PDF";
            mostrarToast("✅ Reporte PDF generado exitosamente.");

        }).catch(err => {
            // Si hay error, también restauramos los gráficos para no romper nada
            reemplazos.forEach(({ canvas, img }) => {
                if (img && img.parentElement && canvas) {
                    img.parentElement.replaceChild(canvas, img);
                }
            });
            
            btn.disabled = false;
            btn.innerHTML = "<i class='fa-solid fa-print'></i> Construir PDF";
            mostrarToast("❌ Error al generar PDF.");
            console.error(err);
        });
    }, 150);
};

window.ejecutarExportacionAvanzada = () => {
    let tipo = document.getElementById("expTipo").value;
    let usu = document.getElementById("expUsuario").value;
    let mes = document.getElementById("expMes").value;
    let desde = document.getElementById("expDesde").value;
    let hasta = document.getElementById("expHasta").value;
    
    // Filtrar los datos con los 4 criterios
    let dataFiltrada = dbTrabajos.filter(t => {
        // 1. Filtro de Tipo (Agregamos la opción combinada 'comercial')
        let matchTipo = false;
        if (tipo === "todos") {
            matchTipo = true;
        } else if (tipo === "comercial") {
            matchTipo = (t.tipoTarea === "alta" || t.tipoTarea === "venta_equipos");
        } else {
            matchTipo = (t.tipoTarea === tipo);
        }
        
        // 2. Filtro de Usuario
        let matchUsu = true;
        if(usu !== "todos") {
            let esTecnico = t.tecnicos && t.tecnicos.includes(usu);
            let esVendedor = t.vendedor === usu;
            matchUsu = esTecnico || esVendedor;
        }

        let fechaTrabajo = t.fecha || "";

        // 3. Filtro de Mes
        let matchMes = true;
        if (mes !== "todos") {
            let mesTrabajo = fechaTrabajo.split("-")[1] || "";
            matchMes = (mesTrabajo === mes);
        }

        // 4. Filtro de Rango de Fechas (Desde - Hasta)
        let matchDesde = true;
        let matchHasta = true;
        if (fechaTrabajo) {
            if (desde) matchDesde = (fechaTrabajo >= desde);
            if (hasta) matchHasta = (fechaTrabajo <= hasta);
        } else if (desde || hasta) {
            // Si piden filtrar por fecha y el trabajo no tiene fecha, lo descartamos
            return false;
        }
        
        return matchTipo && matchUsu && matchMes && matchDesde && matchHasta;
    });
    
    if(dataFiltrada.length === 0) {
        mostrarToast("⚠️ No hay trabajos que coincidan con esos filtros.");
        return;
    }

    mostrarToast("⏳ Generando Excel Limpio...");

    const formatoHora = (ts) => {
        if (!ts) return "-";
        let d = new Date(ts);
        return d.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit', hour12: true}); 
    };
    
    const formatoFechaHora = (ts, strFecha) => {
        if (strFecha && typeof strFecha === 'string' && strFecha.includes('/')) return strFecha; 
        if (!ts) return "-";
        let d = new Date(ts);
        return d.toLocaleDateString('es-PE', {day:'2-digit', month:'2-digit', year:'numeric'}) + " " + d.toLocaleTimeString('es-PE', {hour: '2-digit', minute:'2-digit'});
    };

    const calcularDuracion = (llegada, fin) => {
        if (!llegada || !fin) return "-";
        let diffMs = fin - llegada;
        if (diffMs < 0) return "-"; 
        
        let diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 60) return `${diffMins} min`;
        
        let hrs = Math.floor(diffMins / 60);
        let mins = diffMins % 60;
        return `${hrs}h ${mins}m`;
    };

    let dataExportar = dataFiltrada.map(t => ({
        "N° TICKET": t.ticket || "-",
        "FECHA REGISTRO": t.fechaCreacionExacta ? formatoFechaHora(t.ts, t.fechaCreacionExacta) : "No registrado",
        "REGISTRADO POR": t.creadoPor || t.vendedor || "Sistema", // 👈 NUEVA COLUMNA EN EL EXCEL
        "ESTADO": (t.estado || "pendiente").toUpperCase().replace(/_/g, " "),
        "TIPO TAREA": (t.tipoTarea || "OTROS").toUpperCase(),
        "TIPO DE SERVICIO": (t.tipoServicio || "-").toUpperCase(),
        "CLIENTE": t.cliente || "Sin Nombre",
        "DNI / ID": t.dni || t.idCliente || t.ruc || "-",
        "TELÉFONO": t.tel || t.telefono || "-",
        "ZONA GENERAL": t.zona || "No especificada",
        "ZONA EXACTA (SUB-ZONA)": t.subZona || "OTRO",
        "DIRECCIÓN": t.dir || t.direccion || "-",
        "TÉCNICOS ASIGNADOS": Array.isArray(t.tecnicos) ? t.tecnicos.join(" y ") : (t.tecnicos || "Sin asignar"),
        "FECHA PROGRAMADA": t.fecha || "-",
        "HORA PROGRAMADA": (t.horaInicio ? window.formato12h(t.horaInicio) + (t.horaFin ? ' a ' + window.formato12h(t.horaFin) : '') : "-"),
        "HORA EN CAMINO": formatoHora(t.tsInicio),
        "HORA LLEGADA (EN PROCESO)": formatoHora(t.tsLlegada),
        "HORA TERMINADO": formatoHora(t.tsFin),
        "DURACIÓN (TRABAJO)": calcularDuracion(t.tsLlegada, t.tsFin),
        "DETALLE / PLAN": t.detalle || "-",
        "SOLUCIÓN TECNICA (CIERRE)": t.notaCierre || t.solucion || "-",
        "NOTAS Y OBSERVACIONES": t.notas || t.notasBase || "-",
        "VENDEDOR": t.vendedor || "Sin vendedor"
    }));

    const ws = XLSX.utils.json_to_sheet(dataExportar);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte_NOC");
    
    let hoy = new Date().toLocaleDateString('es-PE').replace(/\//g, '-');
    XLSX.writeFile(wb, `Reporte_Inteligente_TEN_${hoy}.xlsx`);
    
    mostrarToast("✅ Excel descargado correctamente.");
    document.getElementById("modalExportar").style.display = "none";
};

window.toggleCheckbox = (el) => {
    let chk = el.querySelector("input"); chk.checked = !chk.checked;
    let chks = document.querySelectorAll("#techDropdown input:checked");
    document.getElementById("techDisplay").innerText = chks.length === 0 ? "Sin Asignar" : Array.from(chks).map((c) => c.value).join(", ");
};

window.toggleTechDropdown = (e) => { if (e) e.stopPropagation(); document.getElementById("techDropdown").classList.toggle("show"); };

window.toggleEstadoDropdown = (e) => { 
    if (e) e.stopPropagation(); 
    document.getElementById("estadoDropdown").classList.toggle("show"); 
};

window.toggleEstadoCheckbox = (e, el, val) => {
    // 1. Evitamos que el clic se escape y cierre el menú
    if (e) e.stopPropagation(); 
    
    let chk = el.querySelector("input");
    chk.checked = !chk.checked; // Invertimos la casilla manualmente
    
    // 2. Lógica inteligente de selección
    if (val === "todos" && chk.checked) {
        // Si marcan "Todos", desmarcamos el resto
        document.querySelectorAll("#estadoDropdown input:not([value='todos'])").forEach(c => c.checked = false);
    } else if (val !== "todos" && chk.checked) {
        // Si marcan uno específico, quitamos la marca de "Todos"
        document.querySelector("#estadoDropdown input[value='todos']").checked = false;
    }
    
    // 3. Revisamos cómo quedó para actualizar el texto del botón
    let chks = Array.from(document.querySelectorAll("#estadoDropdown input:checked"));
    
    if (chks.length === 0) {
        // Si desmarcan todo, vuelve a "Todos" por seguridad
        document.querySelector("#estadoDropdown input[value='todos']").checked = true;
        document.getElementById("estadoDisplay").innerText = "Todos los Estados";
    } else if (chks.length === 1 && chks[0].value !== "todos") {
        // Si hay uno solo, mostramos su nombre
        document.getElementById("estadoDisplay").innerText = chks[0].nextElementSibling.innerText;
    } else if (chks[0].value === "todos") {
        document.getElementById("estadoDisplay").innerText = "Todos los Estados";
    } else {
        // Si hay varios, decimos cuántos hay
        document.getElementById("estadoDisplay").innerText = chks.length + " estados selec.";
    }
    
    // 4. Refrescamos la tabla al instante
    window.renderizarTabla();
};

document.addEventListener('click', (e) => {
    let dropE = document.getElementById("estadoDropdown");
    if (dropE && dropE.classList.contains("show") && !dropE.contains(e.target)) {
        dropE.classList.remove("show");
    }
});

// ==========================================
// CONFIGURACIÓN DINÁMICA DE PLANES
// ==========================================
const planesPorDefecto = [
    { precio: 50, nombre: "PLAN S/. 50 BASICO 2" },
    { precio: 55, nombre: "PLAN S/. 55 BASICO" },
    { precio: 69, nombre: "PLAN S/. 69 PROMO" },
    { precio: 100, nombre: "PLAN S/. 100 MEDIO" },
    { precio: 120, nombre: "PLAN S/. 120 INTER" }
];

window.obtenerPlanesGlobales = () => {
    let guardados = localStorage.getItem("ten_config_planes");
    if (guardados) {
        try {
            let parsed = JSON.parse(guardados);
            if (parsed && parsed.length > 0) return parsed;
        } catch (e) {
            console.warn("Error al parsear planes guardados, usando por defecto");
        }
    }
    return planesPorDefecto;
};

window.renderizarTablaPlanesConfig = () => {
    let planes = window.obtenerPlanesGlobales();
    let tbody = document.getElementById("tablaConfigPlanes");
    if (!tbody) return;
    
    tbody.innerHTML = "";
    planes.forEach((p, index) => {
        tbody.innerHTML += `
            <tr>
                <td style="font-weight:900; color:var(--accent);">S/ ${p.precio}</td>
                <td style="font-weight:700;">${p.nombre}</td>
                <td style="text-align: center;">
                    <button class="btn-danger-outline" onclick="window.eliminarPlanConfig(${index})" style="padding: 4px 8px; font-size: 11px;"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
    window.actualizarSelectPlanesFormulario(planes);
};

window.actualizarSelectPlanesFormulario = (planes) => {
    let select = document.getElementById("formPlanVenta");
    let selectCp = document.getElementById("formCpPlan");
    let html = "";
    planes.forEach(p => { html += `<option value="${p.precio}|${p.nombre}">${p.nombre}</option>`; });
    if(select) select.innerHTML = html;
    if(selectCp) selectCp.innerHTML = html;
};

window.agregarPlanConfig = () => {
    let precio = document.getElementById("txtNuevoPlanPrecio").value.trim();
    let nombre = document.getElementById("txtNuevoPlanNombre").value.trim().toUpperCase();
    if (!precio || !nombre) { mostrarToast("⚠️ Debes ingresar un precio y un nombre."); return; }
    let planes = window.obtenerPlanesGlobales();
    planes.push({ precio: parseInt(precio), nombre: nombre });
    localStorage.setItem("ten_config_planes", JSON.stringify(planes));
    document.getElementById("txtNuevoPlanPrecio").value = "";
    document.getElementById("txtNuevoPlanNombre").value = "";
    window.renderizarTablaPlanesConfig();
    mostrarToast("✅ Plan agregado con éxito.");
};

window.eliminarPlanConfig = (index) => {
    let planes = window.obtenerPlanesGlobales();
    planes.splice(index, 1);
    localStorage.setItem("ten_config_planes", JSON.stringify(planes));
    window.renderizarTablaPlanesConfig();
    mostrarToast("🗑️ Plan eliminado.");
};

// ==========================================
// BUSCADOR AVANZADO Y ENVIO MASIVO
// ==========================================
window.abrirModalFiltroBD = () => {
    if (window.bdClientesGlobal.length === 0) { mostrarToast("⚠️ Primero Sincroniza desde la Nube."); return; }
    let zonas = new Set(); let planes = new Set(); let meses = new Set(); let anios = new Set();
    
    window.bdClientesGlobal.forEach(c => { 
        if (c.zona) zonas.add(c.zona); 
        if (c.plan) planes.add(c.plan);
        if (c.mes) meses.add(c.mes);
        if (c.anio) anios.add(c.anio);
    });
    
    let htmlZonas = '<option value="Todas">Todas las Zonas</option>'; [...zonas].sort().forEach(z => htmlZonas += `<option value="${z}">${z}</option>`); if(document.getElementById('filtroBdZona')) document.getElementById('filtroBdZona').innerHTML = htmlZonas;
    let htmlPlanes = '<option value="Todos">Todos los Planes</option>'; [...planes].sort().forEach(p => htmlPlanes += `<option value="${p}">${p}</option>`); if(document.getElementById('filtroBdPlan')) document.getElementById('filtroBdPlan').innerHTML = htmlPlanes;
    let htmlMeses = '<option value="Todos">Todos</option>'; [...meses].sort().forEach(m => { if(m) htmlMeses += `<option value="${m}">${m}</option>`; }); if (document.getElementById('filtroBdMes')) document.getElementById('filtroBdMes').innerHTML = htmlMeses;
    let htmlAnios = '<option value="Todos">Todos</option>'; [...anios].sort().forEach(a => { if(a) htmlAnios += `<option value="${a}">${a}</option>`; }); if (document.getElementById('filtroBdAnio')) document.getElementById('filtroBdAnio').innerHTML = htmlAnios;
    
    document.getElementById('modalFiltroBD').style.display = 'flex'; window.ejecutarFiltroBD();
};

window.ejecutarFiltroBD = () => {
    let tbody = document.getElementById("tablaResultadosBD");
    if (!tbody) return;

    let estadoF = document.getElementById("filtroBdEstado")?.value.toLowerCase() || "todos";
    let zonaF = document.getElementById("filtroBdZona")?.value || "Todas";
    let planF = document.getElementById("filtroBdPlan")?.value || "Todos";
    let mesF = document.getElementById("filtroBdMes")?.value || "Todos";
    let anioF = document.getElementById("filtroBdAnio")?.value || "Todos";
    let searchT = document.getElementById("filtroBdTexto")?.value.toLowerCase().trim() || "";

    let html = "";
    let count = 0;
    let totalMatches = 0;

    for (let i = 0; i < window.bdClientesGlobal.length; i++) {
        let c = window.bdClientesGlobal[i];

        let filaLimpia = {};
        for(let key in c) {
            let cleanKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
            filaLimpia[cleanKey] = c[key];
        }

        let nom = filaLimpia["apellidosynombres"] || filaLimpia["nombre"] || "Sin Nombre";
        let numDni = filaLimpia["ndocumento"] || filaLimpia["dni"] || filaLimpia["idcliente"] || "";
        let tipoDoc = filaLimpia["tipodedocumento"] ? filaLimpia["tipodedocumento"] + " " : "DNI ";
        let dniMostrar = tipoDoc + numDni;

        let estadoReal = filaLimpia["estadocliente"] || filaLimpia["estado"] || filaLimpia["contactos"] || "NO DEFINIDO";
        if (String(estadoReal).toLowerCase().trim() === "registrado") estadoReal = "ACTIVO";

        let est = String(estadoReal).toLowerCase().trim();

        let zon = filaLimpia["zona"] || filaLimpia["distrito"] || "";
        let dir = filaLimpia["direccion"] || filaLimpia["domicilio"] || "";
        let pla = filaLimpia["tarifadeinternet"] || filaLimpia["plan"] || "";
        let mesC = filaLimpia["mes"] || "";
        let anioC = filaLimpia["ano"] || filaLimpia["anio"] || "";

        let listaTels = [];
        if (filaLimpia["telefono1"]) listaTels.push(filaLimpia["telefono1"]);
        if (filaLimpia["telefono2"]) listaTels.push(filaLimpia["telefono2"]);
        if (filaLimpia["telefono3"]) listaTels.push(filaLimpia["telefono3"]);
        let tels = listaTels.length > 0 ? listaTels.join(" / ") : (Array.isArray(c.telefonos) ? c.telefonos.join(" / ") : (c.telefonos || ""));

        if (estadoF !== "todos" && est !== estadoF) continue;
        if (zonaF !== "Todas" && zon !== zonaF) continue;
        if (planF !== "Todos" && pla !== planF) continue;
        if (mesF !== "Todos" && String(mesC) !== mesF) continue;
        if (anioF !== "Todos" && String(anioC) !== anioF) continue;
        
        if (searchT !== "") {
            let textoFila = `${nom} ${numDni} ${tels} ${dir}`.toLowerCase();
            if (!textoFila.includes(searchT)) continue;
        }

        totalMatches++;

        if (count < 100) {
            let colorE = est.includes('activo') ? 'var(--success)' : est.includes('suspendido') ? 'var(--warning)' : est.includes('retirado') || est.includes('baja') ? 'var(--danger)' : '#94a3b8';
            html += `
            <tr>
                <td style="text-align: center;"><input type="checkbox" class="chk-bd-item" value="${numDni}"></td>
                <td><span style="background: rgba(0,0,0,0.1); padding: 4px 8px; border-radius: 4px; border: 1px solid ${colorE}; color: ${colorE}; font-weight: 900; text-transform: uppercase; font-size: 11px;">${estadoReal.toUpperCase()}</span></td>
                <td><span style="font-weight: 800; font-size: 13px; display: block;">${nom}</span><span style="font-family: monospace; font-size: 11px; color: var(--text-muted)">${dniMostrar}</span></td>
                <td style="max-width: 150px; font-size: 12px;">${tels}</td>
                <td style="font-size: 12px;"><span style="color: #3b82f6; font-weight: bold;">${zon || 'Sin Zona'}</span><br><small>${dir}</small></td>
                <td><strong style="color:#a855f7; font-size: 12px;">${pla}</strong></td>
                <td>
                    <button class="btn-primary" onclick="window.crearRetencionDirecta('${numDni}')" style="padding: 4px 8px; font-size: 10px; width: 100%;"><i class="fa-solid fa-paper-plane"></i> A Bandeja</button>
                </td>
            </tr>`;
            count++;
        }
    }

    if (totalMatches === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4 font-bold">No se encontraron clientes con esos filtros.</td></tr>`;
    } else {
        if (totalMatches > 100) {
            html += `<tr><td colspan="7" class="text-center py-4 text-muted" style="font-weight: bold; background: rgba(0,0,0,0.02);">Mostrando 100 de ${totalMatches} resultados. Usa el buscador para refinar.</td></tr>`;
        }
        tbody.innerHTML = html;
    }

    let countEl = document.getElementById("contadorResultadosBD") || document.getElementById("contadorBD");
    if(countEl) {
        countEl.innerText = `${totalMatches} clientes encontrados`;
        countEl.removeAttribute("style"); 
        countEl.style.fontWeight = "900";
        countEl.style.color = "var(--accent)";
        countEl.style.fontSize = "1.1rem";
    }
};

window.toggleAllBD = (el) => { document.querySelectorAll('.chk-bd-item').forEach(chk => chk.checked = el.checked); };

window.prepararEnvioBandeja = (dni = null) => {
    let seleccionados = dni ? [dni] : Array.from(document.querySelectorAll('.chk-bd-item:checked')).map(chk => chk.value);
    if(seleccionados.length === 0) { mostrarToast("⚠️ Selecciona al menos un cliente."); return; }
    document.getElementById("preEnvioDni").value = dni ? dni : "masivo";
    document.getElementById("preEnvioFecha").value = new Date().toISOString().split('T')[0];
    document.getElementById("preEnvioHora").value = "";
    document.getElementById("preEnvioNota").value = "";
    document.getElementById("modalPreEnvioBandeja").style.display = "flex";
};

window.confirmarEnvioBandeja = async () => {
    let tipoDni = document.getElementById("preEnvioDni").value;
    let seleccionados = tipoDni !== "masivo" ? [tipoDni] : Array.from(document.querySelectorAll('.chk-bd-item:checked')).map(chk => chk.value);
    
    let estado = document.getElementById("preEnvioEstado").value;
    let fecha = document.getElementById("preEnvioFecha").value;
    let hora = document.getElementById("preEnvioHora").value;
    let nota = document.getElementById("preEnvioNota").value;
    let zonaAGuardar = document.getElementById("selectorZona")?.value || "Norte";
    
    let asignado = document.getElementById("preEnvioAsignado") ? document.getElementById("preEnvioAsignado").value : "JRODRIGUEZ";

    mostrarToast("⏳ Enviando a bandeja...");

    for(let dni of seleccionados) {
        let cliente = window.bdClientesGlobal.find(c => {
            let nDni = c["n° documento"] || c["ndocumento"] || c.dni || c.id_cliente;
            return String(nDni).trim() === String(dni).trim();
        });
        
        if(cliente) {
            let esRetiro = estado === "Retiro Definitivo";
            let telefonosSeguros = Array.isArray(cliente.telefonos) ? cliente.telefonos.join(" / ") : (cliente.telefonos || "");

            let data = {
                tipoTarea: "retencion",
                cliente: cliente["apellidos y nombres"] || cliente["nombre"] || "Sin nombre", 
                dni: dni, 
                tel: telefonosSeguros,
                dir: cliente["dirección"] || cliente["direccion"] || "", 
                zona: zonaAGuardar, 
                fecha: fecha, 
                horaInicio: hora, 
                horaFin: "",
                estado: 'pendiente', 
                tecnicos: ["Sin Asignar"],
                estadoLlamada: estado,
                detalle: esRetiro ? "Solicitud de Retiro" : "Llamada - " + estado,
                notas: esRetiro ? `[Generado Masivo] Motivo: ${nota}` : nota,
                asignadoRetencion: asignado
            };
            await addDoc(coleccionTrabajos, data);
        }

        // Disparamos la notificación al celular
        window.dispararAlertaCelular("¡NUEVO TRABAJO ASIGNADO!", `Revisa tu bandeja, tienes una nueva orden pendiente.`);

    }
    mostrarToast(`✅ ${seleccionados.length} cliente(s) enviados.`);
    if(document.getElementById("chkAllBD")) document.getElementById("chkAllBD").checked = false; 
    document.querySelectorAll('.chk-bd-item').forEach(chk => chk.checked = false);
    window.cerrarModalGeneral('modalPreEnvioBandeja');
    if(window.cerrarModalGeneral) window.cerrarModalGeneral('modalFiltroBD');
};

// ==========================================
// MÓDULO DE COBRANZAS (MODALES Y NOTIFICACIONES)
// ==========================================
window.alertasCobranzaGlobal = [];

window.abrirModalGestionarCobranza = (dni) => {
    let cliente = window.bdClientesGlobal.find(c => {
        let nDni = c["n° documento"] || c["ndocumento"] || c.dni || c.id_cliente;
        return String(nDni).trim() === String(dni).trim();
    });
    if(!cliente) { mostrarToast("Error: No se encontró al cliente"); return; }
    
    document.getElementById('cobDni').value = dni;
    document.getElementById('cobNombre').value = cliente.nombre || cliente["apellidos y nombres"];
    document.getElementById('lblCobCliente').innerText = cliente.nombre || cliente["apellidos y nombres"];
    document.getElementById('lblCobDni').innerText = "DNI/ID: " + dni;
    
    document.getElementById('cobEstado').value = 'Promesa de Pago';
    document.getElementById('cobFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('cobNota').value = '';
    
    document.getElementById('modalGestionarCobranza').style.display = 'flex';
};

window.guardarCobranza = async () => {
    let dni = document.getElementById('cobDni').value;
    let nombre = document.getElementById('cobNombre').value;
    let estado = document.getElementById('cobEstado').value;
    let fecha = document.getElementById('cobFecha').value; 
    let nota = document.getElementById('cobNota').value.trim();
    
    if(!nota) { mostrarToast("⚠️ Por favor, escribe un detalle en las Notas."); return; }
    
    let data = {
        dni: dni, cliente: nombre, estadoLlamada: estado, fechaPromesa: fecha,
        nota: nota, agente: nombreTecnicoLogueado, tsRegistro: Date.now(), resuelto: false
    };
    
    try {
        await addDoc(coleccionCobranzas, data);
        mostrarToast("✅ Gestión guardada en la Nube");
        window.cerrarModalGeneral('modalGestionarCobranza');
    } catch(e) { console.error(e); mostrarToast("❌ Error al guardar en Firebase"); }
};

window.iniciarEscuchaCobranzas = () => {
    if (unsubscribeCobranzas) unsubscribeCobranzas();
    unsubscribeCobranzas = onSnapshot(coleccionCobranzas, (snapshot) => {
        let hoy = new Date().toISOString().split('T')[0];
        window.alertasCobranzaGlobal = [];
        
        snapshot.forEach(doc => {
            let d = { id: doc.id, ...doc.data() };
            if (!d.resuelto && d.fechaPromesa <= hoy) window.alertasCobranzaGlobal.push(d);
        });
        
        let badge = document.getElementById('badgeNotificaciones');
        if (badge) {
            let mencionesSinLeer = window.dbMencionesReales ? window.dbMencionesReales.filter(m => !m.leidoPor || !m.leidoPor.includes(localStorage.getItem('ten_email'))).length : 0;
            let totalCobranzas = window.alertasCobranzaGlobal.length + mencionesSinLeer;

            if (totalCobranzas > 0) {
                badge.innerText = totalCobranzas;
                badge.style.display = 'flex';
                badge.style.background = 'var(--danger)'; // Forzamos rojo para que destaque
                
                let iconBell = badge.parentElement.querySelector('i');
                if(iconBell) iconBell.style.color = 'var(--danger)';
            } else { 
                badge.style.display = 'none'; 
                let iconBell = badge.parentElement.querySelector('i');
                if(iconBell) iconBell.style.color = '';
            }
        }
        
        let modalNotif = document.getElementById('modalNotificaciones');
        if(modalNotif && modalNotif.style.display === 'flex') window.renderizarNotificaciones();
    });
};

window.abrirModalNotificaciones = () => {
    window.renderizarNotificaciones();
    document.getElementById('modalNotificaciones').style.display = 'flex';
};

window.renderizarNotificaciones = () => {
    let tbody = document.getElementById('tablaNotificaciones'); 
    if(!tbody) return;
    tbody.innerHTML = '';
    if (window.alertasCobranzaGlobal.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4"><i class="fa-solid fa-mug-hot"></i> No hay recordatorios pendientes para hoy.</td></tr>`;
        return;
    }
    window.alertasCobranzaGlobal.forEach(a => {
        let color = a.estadoLlamada === "Promesa de Pago" ? "var(--success)" : a.estadoLlamada === "Retiro Definitivo" ? "var(--danger)" : "var(--warning)";
        tbody.innerHTML += `
            <tr>
                <td><b style="font-size:12px; display:block;">${a.cliente}</b><span style="font-size:10px; color:var(--text-muted);">${a.nota}</span></td>
                <td><span style="background:rgba(0,0,0,0.05); border:1px solid ${color}; color:${color}; font-size:10px; padding:2px 6px; border-radius:4px; font-weight:bold;">${a.estadoLlamada}</span></td>
                <td style="font-size:11px; font-weight:bold; color:var(--danger);">${a.fechaPromesa}</td>
                <td style="text-align:center;"><button class="btn-success" onclick="window.marcarCobranzaResuelta('${a.id}')" style="padding:4px 8px; font-size:11px; border:none; border-radius:4px; cursor:pointer; background:var(--success); color:white;"><i class="fa-solid fa-check"></i> Listo</button></td>
            </tr>
        `;
    });
};

window.marcarCobranzaResuelta = async (id) => {
    try { await updateDoc(doc(coleccionCobranzas, id), { resuelto: true }); mostrarToast("✅ Tarea completada"); } 
    catch(e) { mostrarToast("❌ Error al actualizar"); }
};

// ==========================================
// FUNCIONES DE INTERFAZ Y SELECCIÓN DE TIPO
// ==========================================
window.seleccionarTipoTarea = (tipo) => {
    try {
        let tipoInput = document.getElementById("formTipoTareaValue");
        if (tipoInput) tipoInput.value = tipo;

        document.querySelectorAll(".tab-btn").forEach((b) => {
            b.classList.remove("active-alta", "active-averia", "active-baja", "active-otros", "active-venta_equipos");
            if (b.id === "tabAveria") { b.style.color = "#8b9bb4"; b.style.borderColor = "var(--panel-border)"; }
            if (b.id === "tabOtros") { b.style.color = "#8b9bb4"; b.style.borderColor = "var(--panel-border)"; }
            if (b.id === "tabVentaEquipos") { b.style.color = "#8b9bb4"; b.style.borderColor = "var(--panel-border)"; }
        });

        let tabActiva = document.getElementById("tab" + tipo.charAt(0).toUpperCase() + tipo.slice(1).replace("_equipos", "Equipos"));
        if (tabActiva) {
            tabActiva.classList.add("active-" + tipo);
            if (tipo === "averia") { tabActiva.style.color = "#2979ff"; tabActiva.style.borderColor = "#2979ff"; }
            if (tipo === "otros") { tabActiva.style.color = "#f59e0b"; tabActiva.style.borderColor = "#f59e0b"; }
            if (tipo === "venta_equipos") { tabActiva.style.color = "var(--success)"; tabActiva.style.borderColor = "var(--success)"; }
        }

        let comunes = document.getElementById("camposClienteComunes");
        let cajaComunes = document.getElementById("camposCajaComunes");
        let buscador = document.getElementById("cajaBuscador");

        // Verificamos si el usuario es de Ventas o Coordinación Comercial
        let esAreaVentas = (typeof isVendedor !== 'undefined' && isVendedor) || (typeof isCarlos !== 'undefined' && isCarlos);

        if (tipo === "otros") {
            if (comunes) comunes.style.display = "none";
            if (cajaComunes) cajaComunes.style.display = "none";
            if (buscador) buscador.style.display = "none";
        } else {
            if (comunes) comunes.style.display = "block";
            // 🔥 REGLA: Ocultar Caja y Puerto a Ventas y Coordinadores
            if (cajaComunes) {
                cajaComunes.style.display = esAreaVentas ? "none" : "block";
            }
            if (buscador) buscador.style.display = "block";
        }

        let grupoAlta = document.querySelector(".grupo-alta");
        let grupoAveria = document.querySelector(".grupo-averia");
        let grupoBaja = document.querySelector(".grupo-baja");
        let grupoOtros = document.querySelector(".grupo-otros");
        let grupoVentaEq = document.querySelector(".grupo-venta-equipos");

        if (grupoAlta) grupoAlta.style.display = tipo === "alta" ? "contents" : "none";
        if (grupoAveria) grupoAveria.style.display = tipo === "averia" ? "block" : "none";
        if (grupoBaja) grupoBaja.style.display = tipo === "baja" ? "block" : "none";
        if (grupoOtros) grupoOtros.style.display = tipo === "otros" ? "block" : "none";
        if (grupoVentaEq) grupoVentaEq.style.display = tipo === "venta_equipos" ? "block" : "none";

    } catch (e) {
        console.error("Error en seleccionarTipoTarea:", e);
    }
};

window.cambiarSubtipoOtros = () => {
    let tipoSelect = document.getElementById("formTipoOtros");
    if (!tipoSelect) return;
    let tipo = tipoSelect.value;
    
    // Apagamos todas las secciones primero
    let secciones = ["seccionLimpiezaCaja", "seccionSeguimientoFibra", "seccionTendido", "seccionMufa", "seccionActNap", "seccionReparacion", "seccionSupervision", "seccionEspecificar", "seccionIdentificacionHilos"];
    secciones.forEach(sec => {
        let el = document.getElementById(sec);
        if(el) el.style.display = "none";
    });

    // Encendemos la elegida
    if (tipo === "Limpieza de caja") {
        document.getElementById("seccionLimpiezaCaja").style.display = "block";
        // 🔥 LIMPIEZA FORZADA AL CAMBIAR: Para que no herede la caja anterior
        if (document.getElementById("formCantPuertos")) {
            document.getElementById("formCantPuertos").value = "0";
        }
        if (document.getElementById("puertosContainer")) {
            document.getElementById("puertosContainer").innerHTML = "";
        }
        if (document.getElementById("formCajaOtros")) {
            document.getElementById("formCajaOtros").value = "";
            document.getElementById("formLinkCajaOtros").value = "";
            document.getElementById("formSenalCajaOtros").value = "";
        }
    }
    else if (tipo === "Seguimiento de fibra") document.getElementById("seccionSeguimientoFibra").style.display = "block";
    else if (tipo === "Tendido de fibra") document.getElementById("seccionTendido").style.display = "block";
    else if (tipo === "Activación de mufa") document.getElementById("seccionMufa").style.display = "block";
    else if (tipo === "Activación de caja NAP") document.getElementById("seccionActNap").style.display = "block";
    else if (tipo === "Reparación de fibra") document.getElementById("seccionReparacion").style.display = "block";
    else if (tipo === "Supervisión de zona") document.getElementById("seccionSupervision").style.display = "block";
    else if (tipo === "Identificación de hilos en CTO") {
        document.getElementById("seccionIdentificacionHilos").style.display = "block";
        // Forzamos que se recupere el texto por defecto para que no se borre al abrir
        if (document.getElementById("formIdenObs")) {
            document.getElementById("formIdenObs").value = "Requiero foto/registro de fibra de ingreso, fibra de salida e hilo fusionado en caja.";
        }
    }
    else if (tipo === "Especificar Otros") document.getElementById("seccionEspecificar").style.display = "block";
    else if (tipo === "Identificación de hilos en mufa") document.getElementById("seccionIdentificacionMufa").style.display = "block";
};

window.buscarClienteFibra = async () => {
    const queryVal = document.getElementById("formBusquedaFibra").value.trim();
    const inputNombre = document.getElementById("formClienteFibra");
    if (!queryVal) { mostrarToast("⚠️ Escribe un ID o DNI para buscar"); return; }
    inputNombre.value = "Buscando...";
    try {
        let docSnap = await getDocs(query(coleccionClientes, where("id_cliente", "==", queryVal)));
        if (docSnap.empty) docSnap = await getDocs(query(coleccionClientes, where("dni", "==", queryVal)));
        if (!docSnap.empty) {
            const data = docSnap.docs[0].data();
            inputNombre.value = data.nombre;
            document.getElementById("formDniFibra").value = data.dni || data.id_cliente;
            document.getElementById("formPlanFibra").value = data.plan || "";
            document.getElementById("formEquiposFibra").value = data.info_tv || ""; 
            mostrarToast(`✅ Datos del cliente cargados`);
        } else {
            inputNombre.value = "";
            mostrarToast(`❌ No se encontró cliente.`);
        }
    } catch (err) {
        inputNombre.value = "";
        mostrarToast("⚠️ Error en búsqueda.");
        console.error(err);
    }
};

// ==========================================
// CREADOR DE PUERTOS (DISEÑO MÓVIL OPTIMIZADO + ANTI AUTO-RELLENO)
// ==========================================
window.generarPuertos = () => {
    let cant = parseInt(document.getElementById('formCantPuertos').value);
    let container = document.getElementById('puertosContainer');
    if (cant === 0) { container.innerHTML = ""; return; }
    let html = '';
    for(let i = 1; i <= cant; i++) {
        html += `
        <div class="puerto-row" style="display:flex; flex-wrap: wrap; gap:8px; align-items:center; background:rgba(0,0,0,0.1); padding:10px; border-radius:8px; border:1px solid var(--panel-border); margin-bottom: 8px;">
            <span style="font-weight:900; color:var(--brand-orange); width: 30px; text-align:center; font-size:14px;">P${i}</span>
            <div style="display:flex; flex: 1; gap: 5px; min-width: 140px;">
                <!-- ✨ AHORA EL PLACEHOLDER INDICA QUE ACEPTA AMBOS -->
                <input type="text" id="puertoId_${i}" autocomplete="new-password" class="form-control" placeholder="DNI o ID..." style="flex:1; padding:8px; font-size:12px;">
                <button type="button" onclick="window.buscarClientePuerto(${i})" style="padding:8px 15px; background:var(--accent); color:#000; border:none; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;" title="Buscar por DNI o ID"><i class="fa-solid fa-magnifying-glass"></i></button>
            </div>
            <input type="text" id="puertoNombre_${i}" autocomplete="new-password" class="form-control" placeholder="Nombre aparecerá aquí..." style="flex:100%; min-width: 100%; padding:8px; font-size:12px; margin-top: 4px;">
        </div>`;
    }
    container.innerHTML = html;
};

// ==========================================
// BUSCADOR EN LA NUBE PARA TÉCNICOS
// ==========================================
window.buscarClientePuerto = async (index) => {
    const queryVal = document.getElementById(`puertoId_${index}`).value.trim();
    const inputNombre = document.getElementById(`puertoNombre_${index}`);
    
    if (!queryVal) { 
        mostrarToast("⚠️ Escribe un DNI o ID en la casilla del Puerto " + index); 
        return; 
    }
    
    inputNombre.value = "Buscando en la nube...";

    try {
        const { getDocs, query, where } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        
        // ✨ CORRECCIÓN EXACTA PARA TU EXCEL: Agregamos "nid" que es "N° ID" limpio
        let docSnap = await getDocs(query(coleccionClientes, where("nid", "==", queryVal))); 
        if (docSnap.empty) docSnap = await getDocs(query(coleccionClientes, where("idcliente", "==", queryVal))); 
        if (docSnap.empty) docSnap = await getDocs(query(coleccionClientes, where("id_cliente", "==", queryVal)));
        if (docSnap.empty) docSnap = await getDocs(query(coleccionClientes, where("ndocumento", "==", queryVal)));
        if (docSnap.empty) docSnap = await getDocs(query(coleccionClientes, where("dni", "==", queryVal)));

        if (!docSnap.empty) {
            const data = docSnap.docs[0].data();
            inputNombre.value = data.nombre || data.apellidosynombres || data.apellidos_y_nombres || "Sin Nombre";
            mostrarToast(`✅ Cliente encontrado`);
        } else {
            inputNombre.value = "";
            mostrarToast("❌ No se encontró cliente con ese DNI o ID.");
        }
    } catch (error) {
        console.error(error);
        inputNombre.value = "";
        mostrarToast("⚠️ Error de conexión.");
    }
};

window.abrirModalSenal = (id, tipo, detalle) => {
    let t = dbTrabajos.find(x => x.id === id);
    if (!t) return;
    document.getElementById("formSenalId").value = id;
    document.getElementById("modalFormTx").value = t.tx || "";
    document.getElementById("modalFormRx").value = t.rx || "";
    document.getElementById("modalFormSenalCaja").value = t.senalCaja || "";
    if (tipo === "otros" && detalle === "Limpieza de caja") {
        document.getElementById("camposModalSenalRouter").style.display = "none";
        document.getElementById("camposModalSenalCaja").style.display = "block";
    } else {
        document.getElementById("camposModalSenalRouter").style.display = "flex";
        document.getElementById("camposModalSenalCaja").style.display = "none";
    }
    document.getElementById("modalSenal").style.display = "flex";
};

window.cerrarModalSenal = () => { document.getElementById("modalSenal").style.display = "none"; };

window.guardarModalSenal = async () => {
    let id = document.getElementById("formSenalId").value;
    let dataUpdate = {};
    if (document.getElementById("camposModalSenalRouter").style.display !== "none") {
        dataUpdate.tx = document.getElementById("modalFormTx").value.trim();
        dataUpdate.rx = document.getElementById("modalFormRx").value.trim();
    } else {
        dataUpdate.senalCaja = document.getElementById("modalFormSenalCaja").value.trim();
    }
    try {
        await updateDoc(doc(coleccionTrabajos, id), dataUpdate);
        window.cerrarModalSenal();
        mostrarToast("✅ Señal guardada exitosamente");
    } catch (e) {
        mostrarToast("❌ Error al guardar la señal");
        console.error(e);
    }
};

window.crearRetencionDirecta = async (dni) => {
    mostrarToast("⚠️ Dirígete al Módulo de Retención en el Menú para gestionar cobros.");
};

// ============================================================ //
// CONTROL UNIVERSAL DE MODALES (CERRAR CON CLICK AFUERA O ESC) //
// ============================================================ //
window.cerrarModal = () => { document.getElementById("modalAgregar").style.display = "none"; };
window.cerrarModalCobertura = () => { document.getElementById("modalCobertura").style.display = "none"; };
window.cerrarModalEliminar = () => { document.getElementById("modalEliminar").style.display = "none"; };
window.cerrarModalCierre = () => { document.getElementById("modalCierre").style.display = "none"; };
window.cerrarModalFiltroBD = () => { document.getElementById("modalFiltroBD").style.display = "none"; };
window.cerrarModalRechazoRapido = () => { document.getElementById("modalRechazoRapido").style.display = "none"; };
window.cerrarModalGeneral = (id) => { 
    let m = document.getElementById(id); 
    if(m) m.style.display = "none"; 
};

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { 
        document.querySelectorAll('.modal-overlay').forEach(m => {
            if(m.style.display === 'flex' || m.style.display === 'block') {
                m.style.display = 'none';
            }
        });
    }
});

// ==========================================
// 🚨 SISTEMA DE ALERTAS INTELIGENTE (ADMIN Y TÉCNICOS)
// ==========================================
setTimeout(() => {
    let rolUsuario = localStorage.getItem('ten_rol');
    let emailUsuario = localStorage.getItem('ten_email') || '';
    let nombreTecnicoNOC = localStorage.getItem('ten_nombre_tecnico') || '';

    // 1. CREADOR DE VENTANAS MODERNAS
    window.mostrarAlertaNOC = (titulo, mensaje, icono, color) => {
        let overlay = document.createElement("div");
        overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center;";
        overlay.innerHTML = `
            <div style="background:var(--bg-panel, #1e293b); border:1px solid var(--border, #334155); padding:25px; border-radius:15px; text-align:center; max-width:320px; width:90%; box-shadow:0 15px 30px rgba(0,0,0,0.5); animation: fadeIn 0.3s ease-out;">
                <i class="fa-solid ${icono}" style="font-size:3.5rem; color:${color}; margin-bottom:15px; display:block;"></i>
                <h3 style="color:var(--text-main, white); font-size:1.2rem; font-weight:900; margin-bottom:10px;">${titulo}</h3>
                <p style="color:var(--text-muted, #94a3b8); font-size:0.9rem; margin-bottom:20px; white-space:pre-wrap; line-height:1.4;">${mensaje}</p>
                <button onclick="this.parentElement.parentElement.remove()" style="background:${color}; color:white; border:none; padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer; width:100%; transition:0.2s;">Entendido</button>
            </div>
        `;
        document.body.appendChild(overlay);
    };

    let campana = document.getElementById("btn-notificaciones");
    if (!campana) return; // Si no existe, no hace nada

    // Reproductor de Sonido
    if (!document.getElementById("audioNotificacion")) {
        let audio = document.createElement("audio");
        audio.id = "audioNotificacion";
        audio.src = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";
        audio.preload = "auto";
        document.body.appendChild(audio);
    }

    // 🚀 DESBLOQUEO DE AUDIO POR INTERACCIÓN
    // Al primer clic/tecla del usuario, reproducimos el audio en silencio para "desbloquearlo".
    if (!window.__audioDesbloqueado) {
        const desbloquearAudio = () => {
            let audio = document.getElementById("audioNotificacion");
            if (audio) {
                audio.volume = 0; // Silencio total durante el desbloqueo
                audio.play().then(() => {
                    audio.pause();
                    audio.currentTime = 0;
                    audio.volume = 1; // Restauramos volumen normal
                    window.__audioDesbloqueado = true;
                    console.log("🔊 Audio desbloqueado. Ya sonará sin problema.");
                }).catch(err => {
                    console.log("⚠️ Aún no se puede desbloquear:", err);
                });
            }
            document.removeEventListener('click', desbloquearAudio);
            document.removeEventListener('keydown', desbloquearAudio);
            document.removeEventListener('touchstart', desbloquearAudio);
        };
        document.addEventListener('click', desbloquearAudio);
        document.addEventListener('keydown', desbloquearAudio);
        document.addEventListener('touchstart', desbloquearAudio);
    }

    // =====================================
    // 🧠 LÓGICA PARA ADMINISTRADORES Y NOC (SOPORTE)
    // =====================================
    if (rolUsuario === 'admin') {
        let cantidadTerminadosAnterior = -1; // El parche antibug
        if (!window.alertasEmitidasNOC) window.alertasEmitidasNOC = {};
        if (!window.alertasSLARegistradas) window.alertasSLARegistradas = new Set(); // 👈 Memoria para SLA
        
        setInterval(() => {
            let campana = document.getElementById("btn-notificaciones");
            if (!campana) return;
            
            let hoyStr = new Date().toISOString().split("T")[0];
            let ahora = Date.now(); // 👈 Tiempo actual para cálculos de SLA
            
            // 1. FILTRAR LOS TERMINADOS DE HOY
            let terminadosHoy = dbTrabajos.filter(t => 
                t.tipoTarea !== "biometrico" && 
                (t.estado === "atendido" || t.estado === "no_atendido" || t.estado === "no_realizado") &&
                t.tsFin && 
                new Date(t.tsFin).toISOString().split("T")[0] === hoyStr
            );
            terminadosHoy.sort((a, b) => b.tsFin - a.tsFin); 

            // 🧠 DICCIONARIO DE PRONUNCIACIÓN PARA LA VOZ (Unificado para todas las alertas)
            const diccionarioTecnicos = {
                "CALARCON": "Clever", "JCORDOVA": "Juan", "RRONDON": "Renzo",
                "RLEON": "Ricardo", "MPACOTAIPE": "Márce", "JPATRICIO": "Patricio",
                "JLOLI": "Loli", "JFERNANDEZ": "Jesús", "BILLS": "Bills", "CIELO": "Cielo"
            };

            // 🚨 2. MOTOR VIGILANTE DE SLA Y ALMUERZOS (Revisa cada 2 segundos)
            dbTrabajos.forEach(t => {
                let techAsignadoStr = Array.isArray(t.tecnicos) ? t.tecnicos[0] : (t.tecnicos || "Sin Asignar");
                let techLimpio = String(techAsignadoStr).trim();
                let techHablado = diccionarioTecnicos[techLimpio] || techLimpio.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

                // A) ALERTA DE ALMUERZO EXCEDIDO (60 MIN)
                if (t.detalle === "Hora de Almuerzo" && t.estado === "en_proceso" && t.tsInicio) {
                    let minutos = Math.floor((ahora - t.tsInicio) / 60000);
                    if (minutos >= 60 && !window.alertasEmitidasNOC[t.id]) {
                        window.alertasEmitidasNOC[t.id] = true; 
                        if ('speechSynthesis' in window) {
                            window.speechSynthesis.cancel();
                            let vozAlerta = new SpeechSynthesisUtterance(`Alerta en el sistema. El técnico ${techHablado} ha excedido su hora de almuerzo. Lleva ${minutos} minutos.`);
                            vozAlerta.lang = 'es-ES'; vozAlerta.rate = 1.05;
                            window.speechSynthesis.speak(vozAlerta);
                        }
                        mostrarToast(`🚨 ¡ALERTA! El técnico ${techLimpio} excedió los 60 min de almuerzo.`);
                        window.mostrarAlertaNOC("¡Almuerzo Excedido!", `El técnico ${techLimpio} lleva ${minutos} minutos de refrigerio. Por favor, verificar su estado.`, "fa-burger", "#ef4444");
                    }
                }

                // B) ALERTA SLA 30 MINUTOS (EN CAMINO)
                if (t.estado === "en_camino" && t.tsInicio) {
                    let minEnCamino = Math.floor((ahora - t.tsInicio) / 60000);
                    let idAlerta = t.id + "_alerta_30m";
                    if (minEnCamino >= 30 && !window.alertasSLARegistradas.has(idAlerta)) {
                        window.alertasSLARegistradas.add(idAlerta);
                        if ('speechSynthesis' in window) {
                            window.speechSynthesis.cancel(); // 👈 El escudo Anti-Silencio de Chrome
                            let vozSLA = new SpeechSynthesisUtterance(`Atención NOC. El técnico ${techHablado} ya pasó los 30 minutos en camino. Comunícate con él para consultar su estado.`);
                            vozSLA.lang = 'es-ES'; vozSLA.rate = 1.05;
                            window.speechSynthesis.speak(vozSLA);
                        }
                        mostrarToast(`🚨 ¡SLA VENCIDO! ${techLimpio} lleva 30 min en ruta.`);
                    }
                }

                // C) ALERTA SLA 60 MINUTOS (EN PROCESO)
                if (t.estado === "en_proceso" && t.tsLlegada && t.detalle !== "Hora de Almuerzo") {
                    let minTrabajando = Math.floor((ahora - t.tsLlegada) / 60000);
                    let idAlerta = t.id + "_alerta_60m";
                    if (minTrabajando >= 60 && !window.alertasSLARegistradas.has(idAlerta)) {
                        window.alertasSLARegistradas.add(idAlerta);
                        if ('speechSynthesis' in window) {
                            window.speechSynthesis.cancel();
                            let vozSLA2 = new SpeechSynthesisUtterance(`Alerta de tiempo. El técnico ${techHablado} lleva más de una hora de trabajo en proceso. Verifica si requiere apoyo.`);
                            vozSLA2.lang = 'es-ES'; vozSLA2.rate = 1.05;
                            window.speechSynthesis.speak(vozSLA2);
                        }
                        mostrarToast(`🚨 ¡SLA VENCIDO! ${techLimpio} lleva 60 min en proceso.`);
                    }
                }
            });

            // 3. MAGIA DE TRABAJOS TERMINADOS (Se mantiene intacto)
            if (cantidadTerminadosAnterior === -1) {
                cantidadTerminadosAnterior = terminadosHoy.length;
            } 
            else if (terminadosHoy.length > cantidadTerminadosAnterior) {
                let ultimo = terminadosHoy[0];
                let techArray = Array.isArray(ultimo.tecnicos) ? ultimo.tecnicos : [ultimo.tecnicos || "Un técnico"];
                let techOriginal = techArray.join(", ");
                
                let nombresTraducidos = techArray.map(t => {
                    let tLimpio = String(t).trim();
                    return diccionarioTecnicos[tLimpio] || tLimpio.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                });

                let techHablado = "";
                if (nombresTraducidos.length === 1) {
                    techHablado = nombresTraducidos[0];
                } else if (nombresTraducidos.length > 1) {
                    let ultimoNombre = nombresTraducidos.pop();
                    techHablado = nombresTraducidos.join(", ") + " y " + ultimoNombre;
                }

                let esPlural = techArray.length > 1;
                let palabraSujeto = esPlural ? "Los técnicos" : "El técnico";
                let palabraVerbo = esPlural ? "terminaron" : "terminó";

                let cli = ultimo.cliente ? ultimo.cliente.split(" ")[0] : "un cliente";
                let estText = ultimo.estado === "atendido" ? "exitosamente" : "como fallido";
                
                if (ultimo.detalle && ultimo.detalle.includes("Incidente")) {
                    estText = esPlural ? "y han reportado un incidente" : "y ha reportado un incidente";
                }
                
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel(); 
                    let textoVoz = `${palabraSujeto} ${techHablado} ${palabraVerbo} el trabajo de ${cli} ${estText}`;
                    let utterance = new SpeechSynthesisUtterance(textoVoz);
                    utterance.lang = 'es-ES'; 
                    utterance.rate = 1.05;    
                    utterance.pitch = 1.0;    
                    window.speechSynthesis.speak(utterance);
                } else {
                    let audio = document.getElementById("audioNotificacion");
                    if (audio) {
                        audio.play().catch(e => console.log("Sonido bloqueado temporalmente"));
                    }
                }
                
                mostrarToast(`🔔 ¡${techOriginal} acaba de terminar la tarea de ${cli}!`);
                cantidadTerminadosAnterior = terminadosHoy.length;
            }
            else {
                cantidadTerminadosAnterior = terminadosHoy.length;
            }
        }, 2000);
    }
    // =====================================
    // 🧠 LÓGICA PARA VENTAS (COORDINADORES)
    // =====================================
    else if (rolUsuario === 'ventas') {
        // La campanita ahora la controla el sistema de Menciones general.
        // Solo mantenemos la alerta emergente (toast) si hay pendientes al iniciar.
        onSnapshot(query(coleccionTrabajos, where("estado", "==", "pendiente")), (snapshot) => {
            let pendientesTotales = snapshot.size;
            if (pendientesTotales > 0 && primeraCargaTrabajos) {
               mostrarToast(`Tienes ${pendientesTotales} trabajo(s) en estado PENDIENTE.`);
            }
        });
    }
    // =====================================
    // 🧠 LÓGICA PARA TÉCNICOS
    // =====================================
    else if (rolUsuario === 'tecnico' && nombreTecnicoNOC) {
        
        // 🛠️ AJUSTE PARA TÉCNICOS: Su campanita no abre Menciones, solo muestra su estado al día
        if (campana) {
            campana.removeAttribute("onclick"); // Desvinculamos el panel de menciones
            campana.onclick = () => { 
                window.mostrarAlertaNOC("Todo al día", "☕ No tienes novedades en RRHH ni guardias pendientes para hoy o mañana.", "fa-circle-check", "#10b981"); 
            };
        }

        let primeraCarga = true; 
        onSnapshot(query(coleccionTrabajos), (snapshot) => {
            if (!primeraCarga) {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added") {
                        let d = change.doc.data();
                        if (d.tecnicos && d.tecnicos.includes(nombreTecnicoNOC) && d.estado === "pendiente") {
                            let audio = document.getElementById("audioNotificacion");
                            if(audio) audio.play().catch(e => console.log("Sonido bloqueado"));
                            let tipoMsg = (d.tipoTarea || "TRABAJO").toUpperCase();
                            window.mostrarAlertaNOC(`¡NUEVO ${tipoMsg}!`, `Cliente: ${d.cliente}\nZona: ${d.zona || "N/A"}\n\nRevisa tu bandeja.`, "fa-clipboard-list", "#3b82f6");
                        }
                    }
                });
            }
            primeraCarga = false;
        });

        const verificarRRHH = async () => {
            try {
                // Traductor de nombres para que Firebase entienda a Supabase
                const diccionarioTecnicos = {
                    'MPACOTAIPE': 'Marcelino', 'RPACOTAIPE': 'Rodrigo', 'CALARCON': 'Clever',
                    'JPATRICIO': 'patricio', 'JCORDOVA': 'Juan', 'RRONDON': 'Renzo',
                    'RLEON': 'Ricardo', 'JLOLI': 'Josue', 'JFERNANDEZ': 'Jesus',
                    'EOLORTEGUI': 'Eber', 'JPALOMINO': 'Javier', 'DPACOTAIPE': 'Diego'
                };
                
                let prefix = emailUsuario.split('@')[0].toUpperCase();
                let nombreBusqueda = diccionarioTecnicos[prefix] || nombreTecnicoNOC.split(" ")[0];

                let hoyObj = new Date();
                let hoyStr = hoyObj.getFullYear() + "-" + String(hoyObj.getMonth() + 1).padStart(2, '0') + "-" + String(hoyObj.getDate()).padStart(2, '0');
                let mananaObj = new Date(); mananaObj.setDate(mananaObj.getDate() + 1);
                let mananaStr = mananaObj.getFullYear() + "-" + String(mananaObj.getMonth() + 1).padStart(2, '0') + "-" + String(mananaObj.getDate()).padStart(2, '0');
                
                const SUPABASE_URL = 'https://wtmmwcawkokceefkqiqf.supabase.co';
                const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0bW13Y2F3a29rY2VlZmtxaXFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzOTk0MDgsImV4cCI6MjEwMTk3NTQwOH0.HUd6Vymh4NI_dmT20acpV7k3fTK0Ob91-uqwYpAAdp4';
                
                // 🧠 Búsqueda Inteligente (Campanita): Traemos todos y filtramos flexiblemente
                const resTec = await fetch(`${SUPABASE_URL}/rest/v1/tecnicos?select=id,nombre`, {
                    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
                });
                const todosTecnicos = await resTec.json();
                
                const dTec = todosTecnicos.filter(tec => {
                    let nomLower = tec.nombre.toLowerCase();
                    return nomLower.includes(nombreBusqueda.toLowerCase()) || 
                           nomLower.includes(prefix.toLowerCase()) || 
                           (prefix === 'JPATRICIO' && nomLower.includes('patricio'));
                });
                
                if (dTec && dTec.length > 0) {
                    let idTecnico = dTec[0].id;
                    const resTurno = await fetch(`${SUPABASE_URL}/rest/v1/registros_soporte?tecnico_id=eq.${idTecnico}&fecha=in.(${hoyStr},${mananaStr})&select=*`, {
                        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
                    });
                    const dTurno = await resTurno.json();
                    
                    if (dTurno && dTurno.length > 0) {
                        // Construimos el mensaje de RRHH
                        let mensaje = `Hola ${nombreBusqueda}, tienes novedades en RRHH:\n\n`;
                        dTurno.forEach(t => {
                            let diaTxt = (t.fecha === hoyStr) ? "HOY" : "MAÑANA";
                            mensaje += `📌 ${diaTxt} (${t.fecha}): ${t.tipo}\n`;
                        });
                        mensaje += `\nPor favor, tómalo en cuenta.`;

                        // Lanzamos la alerta emergente directamente a la cara del técnico una sola vez
                        if (!window.alertaRRHHMostrada) {
                            window.mostrarAlertaNOC("Aviso de RRHH", mensaje, "fa-calendar-day", "#ef4444");
                            window.alertaRRHHMostrada = true; // Guardamos memoria para no fastidiar a cada rato
                        }
                    }
                }
            } catch (error) { console.error("Error al verificar RRHH:", error); }
        };
        setTimeout(verificarRRHH, 2000);
    }
}, 2000);

// ==========================================
// AUTO-CALCULAR HORA FIN (+1 HORA) CON AM/PM
// ==========================================
let inputHoraInicio = document.getElementById("formHoraInicio");
if(inputHoraInicio) {
    inputHoraInicio.addEventListener("change", function() {
        let horaSeleccionada = this.value; 
        if (horaSeleccionada && horaSeleccionada.includes(":")) {
            let partes = horaSeleccionada.split(":");
            let horas = parseInt(partes[0]);
            let minutos = partes[1];
            horas = horas + 1;
            if (horas === 24) horas = 0;
            let horasStr = horas < 10 ? "0" + horas : horas;
            let nuevaHoraFin = `${horasStr}:${minutos}`;
            
            let inputFin = document.getElementById("formHoraFin");
            if (inputFin) {
                inputFin.value = nuevaHoraFin;
                if (inputFin._flatpickr) {
                    inputFin._flatpickr.setDate(nuevaHoraFin);
                }
            }
        }
    });
}

// ==========================================
// TABS DE CONFIGURACIÓN Y USUARIOS (PASO 1)
// ==========================================
window.cambiarTabConfig = (tab) => {
    // 1. Apagamos el diseño activo de ambos botones
    const btnPlanes = document.getElementById("tabConfigPlanes");
    const btnUsuarios = document.getElementById("tabConfigUsuarios");
    
    btnPlanes.classList.remove("active-alta");
    btnPlanes.style.color = "var(--text-muted)";
    btnPlanes.style.borderColor = "transparent";

    btnUsuarios.classList.remove("active-alta");
    btnUsuarios.style.color = "var(--text-muted)";
    btnUsuarios.style.borderColor = "transparent";

    // 2. Ocultamos ambos contenidos
    document.getElementById("contentConfigPlanes").style.display = "none";
    document.getElementById("contentConfigUsuarios").style.display = "none";

    // 3. Encendemos solo el seleccionado
    if (tab === 'planes') {
        btnPlanes.classList.add("active-alta");
        // Restauramos su color nativo (acento) que le quita el remove de arriba
        btnPlanes.style.color = "var(--accent)"; 
        btnPlanes.style.borderColor = "var(--accent)";
        document.getElementById("contentConfigPlanes").style.display = "block";
    } else if (tab === 'usuarios') {
        btnUsuarios.classList.add("active-alta");
        btnUsuarios.style.color = "var(--accent)";
        btnUsuarios.style.borderColor = "var(--accent)";
        document.getElementById("contentConfigUsuarios").style.display = "block";
        
        // Llamamos a la función que pinta la tabla
        window.cargarUsuariosConfig();
    }
};

let unsubscribeUsuarios = null;

// 1. DIBUJAR LA TABLA EN TIEMPO REAL DESDE FIREBASE
window.cargarUsuariosConfig = () => {
    const tbody = document.getElementById("tablaConfigUsuarios");
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4"><i class="fa-solid fa-spinner fa-spin"></i> Cargando usuarios de la nube...</td></tr>`;

    if (unsubscribeUsuarios) unsubscribeUsuarios();

    unsubscribeUsuarios = onSnapshot(coleccionUsuarios, (snapshot) => {
        tbody.innerHTML = "";
        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">No hay usuarios registrados. Haz clic en "Nuevo Usuario".</td></tr>`;
            return;
        }

        snapshot.forEach(docSnap => {
            let u = docSnap.data();
            let id = docSnap.id;
            let isBloqueado = u.bloqueado === true;

            // 🔥 EXTRAEMOS LA FOTO DE PERFIL O GENERAMOS LAS INICIALES
            let nombreParaAvatar = u.nombre || u.email.split("@")[0];
            let urlImg = u.fotoPerfil ? u.fotoPerfil : `https://ui-avatars.com/api/?name=${nombreParaAvatar}&background=0ea5e9&color=fff&rounded=true&bold=true`;

            // Insignias y Botones dinámicos según el estado
            let badgeEstado = isBloqueado 
                ? `<span style="background: rgba(239, 68, 68, 0.1); color: var(--danger); padding: 3px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold;">BLOQUEADO</span>` 
                : `<span style="background: rgba(16, 185, 129, 0.1); color: var(--success); padding: 3px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold;">ACTIVO</span>`;

            let btnBloqueo = isBloqueado 
                ? `<button class="btn-action-ui" onclick="window.toggleBloqueoUsuario('${id}', false)" style="background: var(--success); color: white; border: none; padding: 4px 8px;" title="Desbloquear Cuenta"><i class="fa-solid fa-check"></i></button>`
                : `<button class="btn-action-ui" onclick="window.toggleBloqueoUsuario('${id}', true)" style="background: transparent; color: var(--danger); border: 1px solid var(--danger); padding: 4px 8px;" title="Bloquear Cuenta"><i class="fa-solid fa-ban"></i></button>`;

            tbody.innerHTML += `
                <tr style="${isBloqueado ? 'opacity: 0.6; background: rgba(239, 68, 68, 0.02);' : ''}">
                    <td>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <img src="${urlImg}" style="width: 45px; height: 45px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border); box-shadow: 0 2px 5px rgba(0,0,0,0.1); flex-shrink: 0; cursor: pointer; transition: 0.2s;" alt="Avatar" title="Opciones de perfil" onmouseover="this.style.filter='brightness(0.7)'" onmouseout="this.style.filter='none'" onclick="window.opcionesFotoAdmin(event, '${id}', '${u.email}', '${urlImg}')">
                            <div style="overflow: hidden;">
                                <b style="color:var(--text-main); display:block; margin-bottom: 8px;">${u.email}</b>
                                <span class="btn-edit-nombre" style="font-size: 10px; color: var(--accent); cursor: pointer; border: 1px solid var(--accent); padding: 4px 8px; border-radius: 4px; display: inline-block; font-weight: bold;" onclick="window.editarNombreUsuario('${id}', '${u.nombre || ''}', '${u.email}')" title="Modificar nombre">
                                    <i class="fa-solid fa-pen"></i> ${u.nombre || 'Cambiar Nombre'}
                                </span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <select class="form-control" style="padding: 8px; font-size: 0.85rem; height: auto; width: 100%; margin-top: 10px;" onchange="window.cambiarRolUsuario('${id}', this.value)" ${isBloqueado ? 'disabled' : ''}>
                            <option value="tecnico_norte" ${u.rol === 'tecnico_norte' ? 'selected' : ''}>👷 Técnico Norte</option>
                            <option value="tecnico_lurin" ${u.rol === 'tecnico_lurin' ? 'selected' : ''}>👷 Técnico Lurín</option>
                            <option value="noc" ${u.rol === 'noc' ? 'selected' : ''}>🛠️ Soporte NOC</option>
                            <option value="ventas" ${u.rol === 'ventas' ? 'selected' : ''}>💼 Ventas / Coord.</option>
                            <option value="vendedor_norte" ${(u.rol === 'vendedor_norte' || u.rol === 'vendedor') ? 'selected' : ''}>🤝 Asesor Norte</option>
                            <option value="vendedor_lurin" ${u.rol === 'vendedor_lurin' ? 'selected' : ''}>🤝 Asesor Lurín</option>
                            <option value="cobranzas" ${u.rol === 'cobranzas' ? 'selected' : ''}>💰 Cobranzas</option>
                            <option value="admin_lurin" ${u.rol === 'admin_lurin' ? 'selected' : ''}>👑 Admin Lurín</option>
                            <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>👑 Admin Global</option>
                        </select>
                    </td>
                    <td style="text-align: center;">${badgeEstado}</td>
                    <td style="text-align: center; display: flex; gap: 5px; justify-content: center;">
                        ${btnBloqueo}
                        <button class="btn-action-ui" onclick="window.forzarReseteoClave('${u.email}')" style="background: transparent; color: var(--warning); border: 1px solid var(--warning); padding: 4px 8px;" title="Enviar Reseteo de Contraseña"><i class="fa-solid fa-key"></i></button>
                        <button class="btn-action-ui" onclick="window.eliminarUsuarioBD('${id}', '${u.email}')" style="background: transparent; color: var(--text-muted); border: 1px solid var(--border); padding: 4px 8px;" title="Eliminar del Sistema"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    });
};

// =====================================
// CAMBIAR NOMBRE DE USUARIO (NUEVO)
// =====================================
window.editarNombreUsuario = async (id, nombreActual, email) => {
    let nuevoNombre = prompt(`✏️ Escribe el nuevo nombre para ${email}:\n(Ejemplo: CRIVERA)`, nombreActual);
    if (nuevoNombre !== null && nuevoNombre.trim() !== "") {
        try {
            const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
            await updateDoc(doc(coleccionUsuarios, id), { nombre: nuevoNombre.trim().toUpperCase() });
            mostrarToast("✅ Nombre actualizado. Los cambios se aplicarán en su próximo inicio de sesión.");
        } catch (e) {
            mostrarToast("❌ Error al actualizar el nombre.");
        }
    }
};

// VARIABLES GLOBALES TEMPORALES PARA LOS MODALES DE USUARIO
let idUsuarioAccion = null;
let emailUsuarioAccion = null;

// =====================================
// CREACIÓN DE USUARIO (MODAL DISEÑADO)
// =====================================
window.crearUsuarioSistema = () => {
    document.getElementById("txtNuevoEmailUsuario").value = "";
    document.getElementById("selNuevoRolUsuario").value = "tecnico_norte"; // Limpia el menú
    document.getElementById("modalNuevoUsuario").style.display = "flex";
    document.getElementById("txtNuevoEmailUsuario").focus();
};

window.confirmarCreacionUsuario = async () => {
    let nombrePersonal = document.getElementById("txtNuevoNombrePersonal").value.trim();
    let emailNuevo = document.getElementById("txtNuevoEmailUsuario").value.trim().toLowerCase();
    let rolSeleccionado = document.getElementById("selNuevoRolUsuario").value; 
    
    if (!nombrePersonal || !emailNuevo.includes("@")) {
        mostrarToast("⚠️ Ingresa un nombre y un correo electrónico válido.");
        return;
    }
    
    document.getElementById("modalNuevoUsuario").style.display = "none";
    mostrarToast("⏳ Registrando usuario...");
    
    try {
        const { addDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        await addDoc(coleccionUsuarios, {
            nombre: nombrePersonal.toUpperCase(), // GUARDAMOS EL NOMBRE REAL
            email: emailNuevo,
            rol: rolSeleccionado, 
            bloqueado: false,
            fechaCreacion: new Date().toISOString().split('T')[0]
        });
        mostrarToast("✅ Usuario creado con éxito.");
    } catch(e) {
        mostrarToast("❌ Error al agregar usuario.");
    }
};

window.cambiarRolUsuario = async (id, nuevoRol) => {
    mostrarToast("⏳ Guardando nuevo rol...");
    try {
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        // Forzamos la ruta completa a la base de datos para garantizar que se guarde sin errores
        const refDoc = doc(db, "artifacts", appId, "public", "data", "usuarios_sistema", id);
        await updateDoc(refDoc, { rol: nuevoRol });
        mostrarToast("✅ Rol actualizado en la base de datos.");
    } catch(e) { 
        console.error(e);
        mostrarToast("❌ Error al cambiar el rol. Revisa tu conexión."); 
    }
};

// =====================================
// ELIMINACIÓN DE USUARIO (MODAL DISEÑADO)
// =====================================
window.eliminarUsuarioBD = (id, email) => {
    idUsuarioAccion = id;
    document.getElementById("textoConfirmarUsuario").innerHTML = `¿Estás seguro de eliminar a <b>${email}</b> del panel de configuración? Perderá su nivel de acceso.`;
    
    let btnGuardar = document.getElementById("btnConfirmarUsuarioAccion");
    btnGuardar.style.background = "var(--danger)";
    btnGuardar.innerText = "Sí, eliminar";
    
    btnGuardar.onclick = async () => {
        document.getElementById("modalConfirmarUsuario").style.display = "none";
        try {
            const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
            await deleteDoc(doc(coleccionUsuarios, idUsuarioAccion));
            mostrarToast("🗑️ Usuario eliminado de la lista.");
        } catch(e) { mostrarToast("❌ Error al eliminar."); }
    };
    
    document.getElementById("modalConfirmarUsuario").style.display = "flex";
};

// =====================================
// RESETEO DE CONTRASEÑA (MODAL DISEÑADO)
// =====================================
window.forzarReseteoClave = (email) => {
    emailUsuarioAccion = email;
    document.getElementById("textoConfirmarUsuario").innerHTML = `¿Deseas enviar un enlace de recuperación de contraseña a <b>${email}</b>?`;
    
    let btnGuardar = document.getElementById("btnConfirmarUsuarioAccion");
    btnGuardar.style.background = "var(--warning)";
    btnGuardar.innerText = "Sí, enviar llave";
    
    btnGuardar.onclick = () => {
        document.getElementById("modalConfirmarUsuario").style.display = "none";
        sendPasswordResetEmail(auth, emailUsuarioAccion).then(() => {
            mostrarToast(`📧 ¡Enlace seguro enviado a ${emailUsuarioAccion}!`);
        }).catch((error) => {
            mostrarToast("❌ Error. Asegúrate de que el correo esté bien escrito.");
        });
    };
    
    document.getElementById("modalConfirmarUsuario").style.display = "flex";
};

// ==========================================
// ROBOT: AUTO-RELLENAR LISTAS DESPLEGABLES (100% DINÁMICO)
// ==========================================
window.cargarListasDesplegables = async () => {
    const { onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
    
    onSnapshot(coleccionUsuarios, (snapshot) => {
        let asesoresCobranza = [];
        let listaVendedoresMixta = new Set(); // Evita nombres duplicados
        
        // Creamos las variables globales dinámicas vacías
        window.tecnicosNorteDinamico = [];
        window.tecnicosLurinDinamico = [];
        
        snapshot.forEach(doc => {
            let u = doc.data();
            if(u.bloqueado) return; 
            
            let nombreReal = u.nombre || u.email.split("@")[0].toUpperCase();
            
            // 1. Clasificamos a los técnicos por su Rol de Zona
            if(u.rol === "tecnico_norte") {
                window.tecnicosNorteDinamico.push(nombreReal);
            } else if(u.rol === "tecnico_lurin") {
                window.tecnicosLurinDinamico.push(nombreReal);
            }
            
            // 2. Clasificamos a los comerciales y vendedores
            if(u.rol === "ventas" || u.rol === "vendedor" || u.rol === "vendedor_norte" || u.rol === "vendedor_lurin" || u.rol === "cobranzas") {
                asesoresCobranza.push(nombreReal);
                listaVendedoresMixta.add(nombreReal); // Todos los comerciales venden
            }
        });

        // Ordenamos alfabéticamente
        window.tecnicosNorteDinamico.sort();
        window.tecnicosLurinDinamico.sort();
        asesoresCobranza.sort();

        // 1 y 2. Rellenamos el filtro del Dashboard y el Modal de Nuevo Trabajo
        if (typeof actualizarFiltroTecnicos === "function") actualizarFiltroTecnicos();
        if (typeof actualizarSelectTecnicosModal === "function") actualizarSelectTecnicosModal();

        // 3. Rellenar Filtro del Calendario (Admin)
        const filtroCal = document.getElementById("filtroTecnicoCalendario");
        if (filtroCal) {
            let tecnicosDeMiZona = (zonaActual === "Lurin") ? window.tecnicosLurinDinamico : window.tecnicosNorteDinamico;
            let valPrev = filtroCal.value;
            filtroCal.innerHTML = '<option value="todos">Todos los Técnicos</option>';
            tecnicosDeMiZona.forEach(t => filtroCal.innerHTML += `<option value="${t}">${t}</option>`);
            if (tecnicosDeMiZona.includes(valPrev)) filtroCal.value = valPrev;
        }

        // 4. Rellenar Modal de Bandeja Cobranzas
        const preEnvio = document.getElementById("preEnvioAsignado");
        if (preEnvio) {
            let valPrev = preEnvio.value;
            preEnvio.innerHTML = '';
            asesoresCobranza.forEach(a => preEnvio.innerHTML += `<option value="${a}">Derivar a: ${a}</option>`);
            if (asesoresCobranza.includes(valPrev)) preEnvio.value = valPrev;
        }

        // 5. Rellenar Vendedor en Modal de Ventas (100% Automático)
        const selVendedor = document.getElementById("formVendedorAlta");
        if (selVendedor) {
            let valPrev = selVendedor.value;
            selVendedor.innerHTML = '<option value="">-- Autodetectar (Mi usuario) --</option>';
            [...listaVendedoresMixta].sort().forEach(v => {
                selVendedor.innerHTML += `<option value="${v}">${v}</option>`;
            });
            if (valPrev) selVendedor.value = valPrev;
        }
    });
};

// ============================================================ //
// 📦 MÓDULO DE INVENTARIO Y LOGÍSTICA (CONEXIÓN FIREBASE)      //
// ============================================================ //

// 1. Nuevas Colecciones en la nube
const coleccionAlmacenItems = collection(db, "artifacts", appId, "public", "data", "almacen_items");
const coleccionAlmacenMovimientos = collection(db, "artifacts", appId, "public", "data", "almacen_movimientos");

let dbAlmacenItems = [];
let dbAlmacenMovimientos = [];
let idItemActualMov = null;
let tipoMovActual = null;

// 2. Encender la escucha solo si estamos en la página de almacén
if (window.location.pathname.includes("modulo_almacen.html")) {
    setTimeout(() => {
        mostrarToast("⏳ Sincronizando catálogo con la nube...");
        
        onSnapshot(coleccionAlmacenItems, (snapshot) => {
            dbAlmacenItems = [];
            snapshot.forEach(doc => dbAlmacenItems.push({id: doc.id, ...doc.data()}));
            if(typeof window.renderizarCatalogoAlmacen === "function") window.renderizarCatalogoAlmacen();
        });

        onSnapshot(coleccionAlmacenMovimientos, (snapshot) => {
            dbAlmacenMovimientos = [];
            snapshot.forEach(doc => dbAlmacenMovimientos.push({id: doc.id, ...doc.data()}));
            if(typeof window.renderizarKardexAlmacen === "function") window.renderizarKardexAlmacen();
        });
        
        // Auto-rellenar técnicos en el modal de movimientos usando tu Panel de Usuarios
        onSnapshot(coleccionUsuarios, (snap) => {
            const movDestino = document.getElementById("movAlmacenDestino");
            if (movDestino) {
                movDestino.innerHTML = '<option value="Mantenimiento General">Mantenimiento General</option>';
                snap.forEach(doc => {
                    let u = doc.data();
                    if(!u.bloqueado && (u.rol === "tecnico_norte" || u.rol === "tecnico_lurin")) {
                        let nombreReal = u.nombre || u.email.split("@")[0].toUpperCase();
                        movDestino.innerHTML += `<option value="${nombreReal}">Técnico: ${nombreReal}</option>`;
                    }
                });
            }
        });
        
    }, 1000);
}

// 3. Crear Nuevo Producto en Catálogo
window.guardarProductoAlmacen = async () => {
    let codigo = document.getElementById("formAlmacenCodigo").value.trim().toUpperCase();
    let categoria = document.getElementById("formAlmacenCategoria").value;
    let nombre = document.getElementById("formAlmacenNombre").value.trim();
    let marca = document.getElementById("formAlmacenMarca").value.trim();
    let modelo = document.getElementById("formAlmacenModelo").value.trim();
    let costo = parseFloat(document.getElementById("formAlmacenCosto").value) || 0;
    let minimo = parseInt(document.getElementById("formAlmacenMinimo").value) || 5;
    let trazabilidad = document.getElementById("formAlmacenTrazabilidad").checked;

    if(!codigo || !nombre) {
        mostrarToast("⚠️ Código SKU y Nombre son obligatorios.");
        return;
    }

    let existe = dbAlmacenItems.find(x => x.codigo === codigo);
    if(existe) {
        mostrarToast("❌ El código SKU ya existe en el catálogo.");
        return;
    }

    mostrarToast("⏳ Guardando en la nube...");
    try {
        await addDoc(coleccionAlmacenItems, {
            codigo, categoria, nombre, marca, modelo, costo, minimo, trazabilidad,
            stockCentral: 0, stockTecnicos: 0, fechaCreacion: new Date().toISOString()
        });
        
        document.querySelectorAll("#modalProducto input[type=text], #modalProducto input[type=number]").forEach(i => i.value = "");
        window.cerrarModal('modalProducto');
        mostrarToast("✅ Ítem agregado al catálogo exitosamente.");
    } catch (e) {
        console.error(e);
        mostrarToast("❌ Error al guardar producto.");
    }
};

// 4. Abrir Modal de Movimiento
window.abrirModalMovimiento = (id, tipoMovimiento, nombreProducto) => {
    idItemActualMov = id;
    tipoMovActual = tipoMovimiento;
    
    document.getElementById('movProductoNombre').innerText = nombreProducto;
    let titulo = document.getElementById('movTitulo');
    let btn = document.getElementById('btnGuardarMovimiento');
    let cajaDestino = document.getElementById('cajaDestino');

    document.getElementById("movAlmacenCantidad").value = 1;
    document.getElementById("movAlmacenMac").value = "";
    document.getElementById("movAlmacenReferencia").value = "";

    if(tipoMovimiento === 'entrada') {
        titulo.innerHTML = '<i class="fa-solid fa-arrow-down text-success"></i> Ingresar Compra de Stock';
        btn.style.background = 'var(--success)';
        btn.innerText = 'Confirmar Ingreso a Central';
        cajaDestino.style.display = 'none';
        document.getElementById('cajaEscaneoMac').style.display = 'none'; // Al comprar masivo, no se escanea de a 1
    } else {
        titulo.innerHTML = '<i class="fa-solid fa-arrow-up text-warning"></i> Despacho / Transferencia';
        btn.style.background = 'var(--warning)';
        btn.innerText = 'Confirmar Despacho a Técnico';
        cajaDestino.style.display = 'block';
        
        let item = dbAlmacenItems.find(x => x.id === id);
        document.getElementById('cajaEscaneoMac').style.display = (item && item.trazabilidad) ? 'block' : 'none';
    }
    
    window.abrirModalBase('modalMovimiento');
};

// 5. Procesar Entrada / Salida (El Kardex)
window.procesarMovimientoAlmacen = async () => {
    let btnGuardar = document.getElementById('btnGuardarMovimiento');
    let cant = parseInt(document.getElementById("movAlmacenCantidad").value) || 0;
    let destino = document.getElementById("movAlmacenDestino").value;
    let mac = document.getElementById("movAlmacenMac").value.trim().toUpperCase();
    let referencia = document.getElementById("movAlmacenReferencia").value.trim();

    if (cant <= 0) { mostrarToast("⚠️ Ingresa una cantidad válida mayor a 0."); return; }

    let item = dbAlmacenItems.find(x => x.id === idItemActualMov);
    if(!item) return;

    if (tipoMovActual === 'salida' && item.stockCentral < cant) {
        mostrarToast(`❌ Stock insuficiente. Solo hay ${item.stockCentral} en Central.`);
        return;
    }

    if (tipoMovActual === 'salida' && item.trazabilidad && !mac) {
        mostrarToast("⚠️ Este equipo exige escanear MAC o Número de Serie.");
        return;
    }

    btnGuardar.disabled = true;
    btnGuardar.innerText = "⏳ Procesando...";
    mostrarToast("⏳ Registrando movimiento inmutable...");

    try {
        // A. Registrar en el historial de Movimientos
        await addDoc(coleccionAlmacenMovimientos, {
            idItem: idItemActualMov,
            producto: item.nombre,
            codigo: item.codigo,
            tipo: tipoMovActual,
            cantidad: cant,
            destino: tipoMovActual === 'entrada' ? 'Almacén Central' : destino,
            mac: mac,
            referencia: referencia,
            usuario: window.nombreUsuarioGlobal || "SISTEMA",
            fechaRegistro: new Date().toISOString()
        });

        // B. Sumar o Restar el Stock del Catálogo
        const refDoc = doc(db, "artifacts", appId, "public", "data", "almacen_items", idItemActualMov);
        let nuevoCentral = item.stockCentral || 0;
        let nuevoTecnicos = item.stockTecnicos || 0;

        if (tipoMovActual === 'entrada') {
            nuevoCentral += cant;
        } else if (tipoMovActual === 'salida') {
            nuevoCentral -= cant;
            nuevoTecnicos += cant; // El stock pasa de la central al vehículo del técnico
        }

        await updateDoc(refDoc, { stockCentral: nuevoCentral, stockTecnicos: nuevoTecnicos });

        window.cerrarModal('modalMovimiento');
        mostrarToast("✅ Movimiento procesado y guardado en Kardex.");
    } catch(e) {
        console.error(e);
        mostrarToast("❌ Error al procesar el movimiento.");
    } finally {
        btnGuardar.disabled = false;
    }
};

// 6. Dibujar la Tabla del Catálogo
window.renderizarCatalogoAlmacen = () => {
    const tbody = document.getElementById("tablaCatalogoAlmacen");
    if(!tbody) return;
    tbody.innerHTML = "";
    let totalSoles = 0;

    dbAlmacenItems.forEach(item => {
        let stockCentral = item.stockCentral || 0;
        let stockTecnicos = item.stockTecnicos || 0;
        let totalStock = stockCentral + stockTecnicos;
        totalSoles += (totalStock * (item.costo || 0));

        let alertaCss = stockCentral <= (item.minimo || 5) ? "color: var(--danger);" : "color: var(--success);";
        let esEquipo = item.categoria.includes("Equipo");
        let badgeClase = esEquipo ? "abc-a" : item.categoria.includes("Cable") ? "abc-b" : "abc-c";
        let badgeTxt = esEquipo ? "Clase A" : item.categoria.includes("Cable") ? "Clase B" : "Clase C";

        tbody.innerHTML += `
            <tr>
                <td style="font-family: monospace; font-weight: bold; color: var(--accent);">${item.codigo}</td>
                <td>
                    <b style="display: block; font-size: 14px;">${item.nombre}</b>
                    <span style="font-size: 11px; color: var(--text-muted); display: block;">Marca: ${item.marca} | Mod: ${item.modelo}</span>
                    ${item.trazabilidad ? `<span style="font-size: 10px; background: rgba(0,0,0,0.1); padding: 2px 5px; border-radius: 3px;"><i class="fa-solid fa-barcode text-purple"></i> Exige Escaneo MAC</span>` : ''}
                </td>
                <td><span class="badge-abc ${badgeClase}">${badgeTxt}</span></td>
                <td style="font-weight: bold; color: var(--text-muted);">S/ ${(item.costo || 0).toFixed(2)}</td>
                <td>
                    <div style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
                        <div style="display: flex; justify-content: space-between;"><span>Central:</span> <b style="${alertaCss} font-size: 13px;">${stockCentral}</b></div>
                        <div style="display: flex; justify-content: space-between;"><span>Técnicos (Ruta):</span> <b style="color: var(--warning); font-size: 13px;">${stockTecnicos}</b></div>
                    </div>
                </td>
                <td>
                    <div class="btn-grid-row" style="grid-template-columns: 1fr 1fr;">
                        <button class="btn-action-ui" style="background: rgba(16, 185, 129, 0.1); color: var(--success); border: 1px solid var(--success);" onclick="window.abrirModalMovimiento('${item.id}', 'entrada', '${item.nombre.replace(/'/g, "\\'")}')" title="Registrar Compra">IN (Comprar)</button>
                        <button class="btn-action-ui" style="background: rgba(245, 158, 11, 0.1); color: var(--warning); border: 1px solid var(--warning);" onclick="window.abrirModalMovimiento('${item.id}', 'salida', '${item.nombre.replace(/'/g, "\\'")}')" title="Asignar a Técnico">OUT (Despacho)</button>
                    </div>
                </td>
            </tr>
        `;
    });

    if(dbAlmacenItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-muted"><i class="fa-solid fa-box-open text-3xl block mb-2"></i> El catálogo está vacío. Haz clic en "Nuevo Ítem" arriba a la derecha.</td></tr>`;
    }

    let kpiValor = document.getElementById("kpiGlobalValorizacion");
    if(kpiValor) kpiValor.innerText = "S/ " + totalSoles.toFixed(2);
    let kpiItems = document.getElementById("kpiGlobalItems");
    if(kpiItems) kpiItems.innerHTML = `${dbAlmacenItems.length} <span style="font-size: 1rem; color: var(--text-muted);">SKUs</span>`;
};

// 8. Dibujar Tabla del Kardex
window.renderizarKardexAlmacen = () => {
    const tbody = document.getElementById("tablaKardexAlmacen");
    if(!tbody) return;
    tbody.innerHTML = "";

    // Ordenar de lo más reciente a lo más antiguo
    let movs = [...dbAlmacenMovimientos].sort((a,b) => b.fechaRegistro.localeCompare(a.fechaRegistro));

    movs.forEach(m => {
        let esEntrada = m.tipo === 'entrada';
        let colorVal = esEntrada ? "var(--success)" : "var(--danger)";
        let signo = esEntrada ? "+" : "-";
        let txtTipo = esEntrada ? "INGRESO COMPRA" : "DESPACHO A CAMPO";
        let claseBadge = esEntrada ? "alta" : "baja";
        
        let f = new Date(m.fechaRegistro);
        let diaMes = f.toLocaleDateString("es-PE", {day:'2-digit', month:'short', year:'numeric'});
        let hora = f.toLocaleTimeString("es-PE", {hour:'2-digit', minute:'2-digit'});

        tbody.innerHTML += `
            <tr>
                <td><b style="color: var(--text-main); font-size:12px;">${diaMes}</b><br><span style="font-size: 11px; color: var(--text-muted);">${hora}</span></td>
                <td><span class="badge-tipo ${claseBadge}"><i class="fa-solid fa-arrow-${esEntrada ? 'down' : 'up'}"></i> ${txtTipo}</span></td>
                <td><b>${m.producto}</b><br>${m.mac ? `<span style="font-size:11px; font-family:monospace; background:rgba(0,0,0,0.1); padding:2px 4px; border:1px solid var(--accent); color:var(--accent);">MAC: ${m.mac}</span>` : ''}</td>
                <td style="text-align:center;"><b style="color:${colorVal}; font-size: 16px;">${signo}${m.cantidad}</b></td>
                <td>${esEntrada ? 'Hacia:' : 'Destino:'}<br><b style="color:var(--accent);">${m.destino}</b></td>
                <td><i class="fa-solid fa-user-shield"></i> ${m.usuario}<br><span style="font-size: 10px; color: var(--text-muted);">Ref: ${m.referencia || "N/A"}</span></td>
            </tr>
        `;
    });
    
    if(movs.length === 0) tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-muted">Aún no hay movimientos. Todo lo que saques o ingreses quedará grabado aquí.</td></tr>`;
};

// ============================================================ //
// NUEVAS FUNCIONES LOGÍSTICAS (MODAL DE LLEGADA / FACHADA)     //
// ============================================================ //
window.abrirModalLlegada = (id, objetivo) => {
    document.getElementById("llegadaTrabajoId").value = id;
    document.getElementById("llegadaObjetivo").value = objetivo;
    document.getElementById("formFotoLlegada").value = "";
    document.getElementById("txtNotaLlegada").value = "";
    
    let titulo = document.getElementById("tituloModalLlegada");
    let btnGuardar = document.getElementById("btnConfirmarLlegada");
    let lblNota = document.getElementById("lblNotaLlegada");

    if (objetivo === "en_proceso") {
        titulo.innerHTML = '<i class="fa-solid fa-play"></i> Iniciar Trabajo';
        titulo.style.color = "var(--purple)";
        btnGuardar.innerText = "Comenzar Instalación";
        btnGuardar.style.background = "var(--purple)";
        lblNota.innerText = "Observación (Opcional):";
        document.getElementById("txtNotaLlegada").placeholder = "Ej: Llegué a la zona, procedo a instalar...";
    } else {
        titulo.innerHTML = '<i class="fa-solid fa-ban"></i> Marcar como No Realizado';
        titulo.style.color = "var(--danger)";
        btnGuardar.innerText = "Confirmar No Realizado";
        btnGuardar.style.background = "var(--danger)";
        lblNota.innerText = "Motivo de cancelación (Obligatorio):";
        document.getElementById("txtNotaLlegada").placeholder = "Ej: Toqué la puerta 15 min y nadie salió...";
    }

    document.getElementById("modalLlegada").style.display = "flex";
};

window.cerrarModalLlegada = () => { document.getElementById("modalLlegada").style.display = "none"; };

// ============================================================ //
// ACTUALIZACIÓN DE FUNCIÓN REVERTIR PARA LIMPIAR TODO EL RELOJ
// ============================================================ //
window.revertirAPendiente = (id) => {
    let overlay = document.createElement("div");
    overlay.id = "modalRevertirDinamico";
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center; animation: fadeIn 0.2s ease-out;";
    
    overlay.innerHTML = `
        <div style="background:var(--bg-panel); border:1px solid var(--border); padding:25px; border-radius:15px; text-align:center; max-width:350px; width:90%; box-shadow:0 15px 30px rgba(0,0,0,0.5);">
            <i class="fa-solid fa-rotate-left" style="font-size:3.5rem; color:var(--text-muted); margin-bottom:15px; display:block;"></i>
            <h3 style="color:var(--text-main); font-size:1.2rem; font-weight:900; margin-bottom:10px;">¿Revertir a Pendiente?</h3>
            <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:20px; line-height:1.4;">Esto borrará el tiempo de SLA completo, incluyendo la hora de llegada y las fotos. Solo hazlo para reprogramar o corregir un error grave.</p>
            
            <div style="display:flex; gap:10px;">
                <button id="btnCancelarRevert" style="flex:1; background:transparent; border:1px solid var(--border); color:var(--text-muted); padding:10px; border-radius:8px; font-weight:bold; cursor:pointer; transition: 0.2s;">Cancelar</button>
                <button id="btnConfirmarRevert" style="flex:1; background:var(--warning); color:#000; border:none; padding:10px; border-radius:8px; font-weight:bold; cursor:pointer; transition: 0.2s;">Sí, Revertir</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("btnCancelarRevert").onclick = () => overlay.remove();
    
    document.getElementById("btnConfirmarRevert").onclick = async () => {
        let btn = document.getElementById("btnConfirmarRevert");
        btn.innerText = "⏳ Revirtiendo...";
        btn.disabled = true;
        btn.style.opacity = "0.7";
        
        try {
            const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
            await updateDoc(doc(coleccionTrabajos, id), { 
                estado: "pendiente", 
                tsInicio: null, 
                tsLlegada: null, 
                tsFin: null, 
                notaLlegada: null, 
                fotoLlegada: null, 
                notaCierre: null, 
                evidencias: null 
            });
            mostrarToast("🔄 Trabajo reseteado a Pendiente exitosamente.");
        } catch(e) { 
            mostrarToast("❌ Error al revertir en la base de datos."); 
        } finally {
            overlay.remove(); 
        }
    };
};

// ============================================================ //
// LÓGICA DEL DROPDOWN DE EQUIPOS Y PROMOCIONES                 //
// ============================================================ //
window.toggleEquiposDropdown = (e) => { 
    if (e) e.stopPropagation(); 
    let drop = document.getElementById("equiposDropdown");
    if (drop.style.display === "none" || drop.style.display === "") {
        drop.style.display = "block";
    } else {
        drop.style.display = "none";
    }
};

window.toggleEquipoCheckbox = (e, el) => {
    if (e) e.stopPropagation(); 
    let chk = el.querySelector("input");
    chk.checked = !chk.checked; 
    window.actualizarTextoEquipos();
    
    // Disparador mágico: recalcula el precio si marcan/desmarcan el Deco
    if(typeof window.calcularPrecioTotal === 'function') window.calcularPrecioTotal();
};

window.actualizarTextoEquipos = () => {
    let chks = Array.from(document.querySelectorAll("#equiposDropdown input.chk-extra:checked"));
    let display = document.getElementById("equiposDisplay");
    if (!display) return;
    
    if (chks.length === 0) {
        display.innerText = "Ninguno";
    } else {
        display.innerText = chks.map(c => c.value).join(", ");
    }
};

// Hace que el menú se cierre si das clic afuera de él
document.addEventListener('click', (e) => {
    let dropEq = document.getElementById("equiposDropdown");
    if (dropEq && dropEq.style.display === "block" && !dropEq.contains(e.target) && e.target.id !== "equiposDisplay") {
        dropEq.style.display = "none";
    }
});

// ============================================================ //
// CALCULADORA DE VENTA DE EQUIPOS EXTERNOS Y SERVICIOS MENSUALES //
// ============================================================ //
window.calcularVentaEquipos = () => {
    // 1. Calculamos el Pago Único (Venta Directa)
    let totalUnico = 0;
    document.querySelectorAll(".chk-venta-eq:checked").forEach(chk => {
        if (chk.value === "Cableado Coaxial") {
            let m = parseFloat(document.getElementById("metrosCoaxial").value) || 0;
            totalUnico += m * 1.5;
        } else if (chk.value === "Cableado Ethernet") {
            let m = parseFloat(document.getElementById("metrosEthernet").value) || 0;
            totalUnico += m * 1.5;
        } else {
            totalUnico += parseFloat(chk.dataset.precio) || 0;
        }
    });
    document.getElementById("formVentaEqTotal").innerText = `S/ ${totalUnico.toFixed(2)}`;

    // 2. Calculamos el Aumento Mensual (Servicios Adicionales)
    let totalMensual = 0;
    document.querySelectorAll(".chk-servicio-mensual:checked").forEach(chk => {
        totalMensual += parseFloat(chk.dataset.precio) || 0;
    });
    
    let spanMensual = document.getElementById("formServicioMensualTotal");
    if (spanMensual) spanMensual.innerText = `+ S/ ${totalMensual.toFixed(2)}`;
};

window.toggleMetros = (chk) => {
    let id = chk.value === "Cableado Coaxial" ? "metrosCoaxial" : "metrosEthernet";
    let input = document.getElementById(id);
    if (chk.checked) {
        input.style.display = "block";
        input.focus();
    } else {
        input.style.display = "none";
        input.value = "";
    }
    window.calcularVentaEquipos();
};

// ============================================================ //
// LÓGICA DEL DROPDOWN DE VENTAS DE PRODUCTOS EN ALTA (NUEVO)   //
// ============================================================ //
window.toggleVentasEqDropdown = (e) => { 
    if (e) e.stopPropagation(); 
    let drop = document.getElementById("ventasEqDropdown");
    if (drop.style.display === "none" || drop.style.display === "") {
        drop.style.display = "block";
    } else {
        drop.style.display = "none";
    }
};

window.toggleVentaEqCheckbox = (e, el) => {
    if (e) e.stopPropagation(); 
    let chk = el.querySelector("input");
    chk.checked = !chk.checked; 
    window.actualizarTextoVentasEq();
    if(typeof window.calcularPrecioTotal === 'function') window.calcularPrecioTotal();
};

window.actualizarTextoVentasEq = () => {
    let chks = Array.from(document.querySelectorAll("#ventasEqDropdown input.chk-venta-alta:checked"));
    let display = document.getElementById("ventasEqDisplay");
    let cajaPago = document.getElementById("cajaPagoVentaEq");
    if (!display) return;
    
    if (chks.length === 0) {
        display.innerText = "Ninguna venta";
        if(cajaPago) cajaPago.style.display = "none";
    } else {
        display.innerText = chks.map(c => c.value).join(", ");
        if(cajaPago) cajaPago.style.display = "block";
    }
};

// Cierra el menú nuevo si haces clic afuera
document.addEventListener('click', (e) => {
    let dropVentas = document.getElementById("ventasEqDropdown");
    if (dropVentas && dropVentas.style.display === "block" && !dropVentas.contains(e.target) && e.target.id !== "ventasEqDisplay") {
        dropVentas.style.display = "none";
    }
});

// ============================================================ //
// LÓGICA DEL PANEL CAMBIO DE PLAN                              //
// ============================================================ //
window.toggleCambioPlan = () => {
    let isChecked = document.getElementById("chkCambioPlan").checked;
    document.getElementById("cajaCambioPlan").style.display = isChecked ? "block" : "none";
    if(isChecked) window.calcularCambioPlan();
};

window.toggleCpEquiposDropdown = (e) => {
    if (e) e.stopPropagation();
    let drop = document.getElementById("cpEquiposDropdown");
    drop.style.display = (drop.style.display === "none" || drop.style.display === "") ? "block" : "none";
};

window.toggleCpEquipoCheckbox = (e, el) => {
    if (e) e.stopPropagation();
    let chk = el.querySelector("input");
    chk.checked = !chk.checked;
    window.actualizarTextoCpEquipos();
    window.calcularCambioPlan();
};

window.actualizarTextoCpEquipos = () => {
    let chks = Array.from(document.querySelectorAll("#cpEquiposDropdown input.chk-cp-extra:checked"));
    let display = document.getElementById("cpEquiposDisplay");
    if (!display) return;
    display.innerText = chks.length === 0 ? "Ninguno" : chks.map(c => c.value).join(", ");
};

window.calcularCambioPlan = () => {
    let tipoServicio = document.getElementById("formCpServicio").value;
    let planSelect = document.getElementById("formCpPlan");

    if (tipoServicio === "Solo Cable") {
        if (planSelect.options.length !== 1 || !planSelect.options[0].value.includes("SERVICIO DE CABLE")) {
            planSelect.innerHTML = `<option value="50|PLAN S/. 50 SERVICIO DE CABLE">PLAN S/. 50 SERVICIO DE CABLE</option>`;
        }
    } else {
        if (planSelect.options.length === 1 && planSelect.options[0].value.includes("SERVICIO DE CABLE")) {
            window.actualizarSelectPlanesFormulario(window.obtenerPlanesGlobales());
        }
    }

    let planVal = planSelect.value;
    if (!planVal) return;
    let parts = planVal.split("|");
    let precioBase = parseInt(parts[0]) || 0;
    let precioFinal = precioBase;

    let esBasico = (precioBase === 50 || precioBase === 55 || precioBase === 69);

    document.querySelectorAll("#cpEquiposDropdown .multi-option").forEach(el => {
        let chk = el.querySelector("input");
        if (!chk) return;
        let val = chk.value;
        
        let isAvanzado = val.includes("Cámara") || val.includes("Mesh") || val.includes("TV Box");
        let isDeco = val.includes("Deco");
        let show = true;

        if (tipoServicio === "Solo Cable") {
            if (isAvanzado) show = false; 
        } else if (tipoServicio === "Internet Solo") {
            if (esBasico && (isAvanzado || isDeco)) show = false; 
        } else if (tipoServicio === "Internet + Cable") {
            if (esBasico && isAvanzado) show = false; 
        }
        
        if (show) el.style.display = "flex";
        else { el.style.display = "none"; if(chk.checked) chk.checked = false; }
    });
    
    window.actualizarTextoCpEquipos();

    if (tipoServicio === "Internet + Cable" && esBasico) precioFinal += 20;

    let chksEquipos = Array.from(document.querySelectorAll("#cpEquiposDropdown input.chk-cp-extra:checked")).map(c => c.value);
    chksEquipos.forEach(eq => {
        if (!eq.includes("Incluid") && !eq.includes("Otros")) precioFinal += 10; 
    });
    
    document.getElementById("formCpTotal").innerText = isNaN(precioFinal) ? "S/ 0" : `S/ ${precioFinal}`;
};

document.addEventListener('click', (e) => {
    let dropCp = document.getElementById("cpEquiposDropdown");
    if (dropCp && dropCp.style.display === "block" && !dropCp.contains(e.target) && e.target.id !== "cpEquiposDisplay") {
        dropCp.style.display = "none";
    }
});

// ============================================================ //
// MÓDULO: AUDITORÍA Y MONITOR DE CAJAS NAP                     //
// ============================================================ //
window.abrirModalCajasNAP = () => {
    document.getElementById("txtBuscarCajaNAP").value = "";
    document.getElementById("resumenCajaNAP").style.display = "none";
    document.getElementById("tablaPuertosNAP").innerHTML = '<tr><td colspan="3" class="text-center text-muted py-8"><i class="fa-solid fa-satellite-dish text-3xl mb-3 block opacity-50"></i>Busca una caja para analizar sus puertos.</td></tr>';
    
    // Reseteamos el filtro a la zona del admin
    if (document.getElementById("filtroZonaNAP")) {
        document.getElementById("filtroZonaNAP").value = zonaActual === "Lurin" ? "Lurin" : "Norte";
    }

    // Dibujamos los botones
    window.filtrarChipsNAP();

    document.getElementById("modalCajasNAP").style.display = "flex";
    setTimeout(() => document.getElementById("txtBuscarCajaNAP").focus(), 100);
};

window.filtrarChipsNAP = () => {
    let cajasLimpiadas = new Map(); 
    let zonaActiva = localStorage.getItem("ten_zona_activa") || "norte"; 
    
    dbTrabajos.forEach(t => {
        if ((t.zona || "norte").toLowerCase() !== zonaActiva.toLowerCase()) return;
        
        let nombreCaja = String(t.caja || "").toUpperCase().trim();
        if (!nombreCaja || nombreCaja === "-" || nombreCaja === "N/A" || nombreCaja === "00" || nombreCaja === "0") return;

        let esLimpieza = (t.tipoTarea === "otros" && t.detalle === "Limpieza de caja" && t.estado === "atendido");

        // 🔥 REGLA MAESTRA: Solo las auditorías oficiales crean los chips morados
        if (esLimpieza) {
            cajasLimpiadas.set(nombreCaja, true);
        }
    });

    let contenedorChips = document.getElementById("cajasLimpiadasContainer");
    let listaChips = document.getElementById("listaCajasChips");
    let htmlChips = "";

    [...cajasLimpiadas.keys()].sort().forEach(caja => {
        htmlChips += `<button type="button" style="background: rgba(168, 85, 247, 0.1); color: var(--purple); border: 1px solid var(--purple); padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; cursor: pointer; transition: 0.2s; white-space: nowrap; display: inline-flex; align-items: center; gap: 8px; flex: 0 0 auto; box-shadow: 0 2px 4px rgba(0,0,0,0.02);" onmouseover="this.style.background='var(--purple)'; this.style.color='white';" onmouseout="this.style.background='rgba(168, 85, 247, 0.1)'; this.style.color='var(--purple)';" onclick="document.getElementById('txtBuscarCajaNAP').value='${caja}'; window.abrirModalGeneral('modalCajasNAP'); window.buscarStatusCajaNAP();"><i class="fa-solid fa-box"></i> ${caja}</button>`;
    });

    if (htmlChips !== "") {
        listaChips.innerHTML = htmlChips;
        if(contenedorChips) contenedorChips.style.display = "block";
    } else {
        listaChips.innerHTML = `<span style="font-size: 12px; color: var(--text-muted); font-style: italic;">No hay cajas registradas en esta zona.</span>`;
        if(contenedorChips) contenedorChips.style.display = "block";
    }
};

window.buscarStatusCajaNAP = () => {
    let cajaQuery = document.getElementById("txtBuscarCajaNAP").value.trim().toUpperCase();
    if (!cajaQuery) { mostrarToast("⚠️ Escribe el nombre de una caja"); return; }
    
    let zonaActiva = localStorage.getItem("ten_zona_activa") || "norte"; 

    let tbody = document.getElementById("tablaPuertosNAP");
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-8"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2 block"></i> Analizando puertos...</td></tr>';
    
    setTimeout(() => {
        let cantPuertos = 16; 
        let mapPuertos = {};
        let botonFotoHtml = ""; 
        let urlFotoActual = "";
        let urlMapaActual = ""; // 🔥 Preparando el terreno para editar mapa
        let tsUltimaAuditoria = 0; 
        
        // 1. BASE DE LA AUDITORÍA
        let limpiezas = dbTrabajos.filter(t => 
            t.tipoTarea === "otros" && t.detalle === "Limpieza de caja" && 
            String(t.caja).toUpperCase().trim() === cajaQuery && 
            t.estado === "atendido" && (t.zona || "norte").toLowerCase() === zonaActiva.toLowerCase()
        );
        limpiezas.sort((a, b) => (b.tsFin || 0) - (a.tsFin || 0));
        
        if (limpiezas.length > 0) {
            let reciente = limpiezas[0];
            tsUltimaAuditoria = reciente.tsFin || 0;
            cantPuertos = parseInt(reciente.cantPuertos) || 16;
            
            // Extraer mapa sin fotos
            let mapLimp = reciente.linkCaja || reciente.mapa || "";
            if (mapLimp && !mapLimp.includes("firebasestorage")) urlMapaActual = mapLimp;

            if (reciente.evidencias && reciente.evidencias.length > 0) {
                urlFotoActual = reciente.evidencias[0];
                botonFotoHtml = `<a href="${urlFotoActual}" target="_blank" style="display: inline-flex; align-items: center; gap: 5px; margin-top: 8px; background: var(--purple); color: white; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: bold; text-decoration: none; box-shadow: 0 4px 6px rgba(139, 92, 246, 0.3); transition: 0.2s;"><i class="fa-solid fa-camera"></i> Ver Foto de la Caja</a>`;
            }
            if (reciente.puertosData && Array.isArray(reciente.puertosData)) {
                reciente.puertosData.forEach(p => {
                    if (p.nombre || p.idDni) {
                        mapPuertos[p.puerto] = { estado: `<span style="color:var(--text-muted); font-weight:bold;">Ocupado</span>`, cliente: p.nombre || "Sin Nombre", dni: p.idDni, origen: "Auditoría / Edición Manual" };
                    }
                });
            }
        }

        // 2. EXTRAER ALTAS (Solo cuenta si están Atendidas)
        dbTrabajos.forEach(t => {
            if ((t.zona || "norte").toLowerCase() !== zonaActiva.toLowerCase()) return; 

            let tipo = String(t.tipoTarea || "").toLowerCase();
            let detalle = String(t.detalle || "");
            let estado = String(t.estado || "").toLowerCase();
            let cajaBD = String(t.caja || "").toUpperCase().trim();

            if (cajaBD === cajaQuery) {
                let esAlta = (tipo === "alta");
                let esTraslado = (tipo === "averia" && detalle.includes("Traslado"));
                
                // 🔥 SOLO MUESTRA PUERTOS OCUPADOS SI LA ORDEN ESTÁ TERMINADA
                if ((esAlta || esTraslado) && estado === "atendido") {
                    let tsTicket = t.tsFin || t.tsCreacion || 0;
                    if (tsTicket > tsUltimaAuditoria) {
                        let p = parseInt(t.puerto);
                        if (!isNaN(p) && p > 0) {
                            if (p > cantPuertos) cantPuertos = p; 

                            // También actualizamos el link del mapa si el alta trae uno bueno
                            let mapLimp2 = t.linkCaja || t.mapa || "";
                            if (mapLimp2 && !mapLimp2.includes("firebasestorage")) urlMapaActual = mapLimp2;

                            mapPuertos[p] = { 
                                estado: `<span style="color:var(--success); font-weight:bold;">Instalado</span>`, 
                                cliente: t.cliente || "Desconocido", 
                                dni: t.dni || t.idCliente || "-", 
                                origen: `<a href="#" onclick="window.editarTrabajo('${t.id}')" style="color:var(--accent); text-decoration:underline;">Ver Ticket</a>` 
                            };
                        }
                    }
                }
            }
        });

        // 3. DIBUJAR TABLA Y BOTÓN (Pasándole el Mapa)
        let htmlPuertos = "";
        let ocupadosCount = 0;

        for (let i = 1; i <= cantPuertos; i++) {
            let info = mapPuertos[i];
            if (info) {
                ocupadosCount++;
                htmlPuertos += `
                    <tr style="background: var(--bg-panel); border-bottom: 1px solid var(--border); transition: 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.02)'" onmouseout="this.style.background='var(--bg-panel)'">
                        <td style="text-align: center; width: 60px; padding: 12px 10px;">
                            <div style="background: rgba(239, 68, 68, 0.1); width: 38px; height: 38px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid rgba(239,68,68,0.3); box-shadow: 0 2px 4px rgba(239,68,68,0.1);">
                                <b style="font-size: 15px; color: var(--danger);">P${i}</b>
                            </div>
                        </td>
                        <td style="text-align: center; padding: 12px 10px; font-size: 11px;">
                            ${info.estado}<br>
                            <span style="font-size: 9px; color: var(--text-muted); display: block; margin-top: 4px;">${info.origen}</span>
                        </td>
                        <td style="padding: 12px 10px;">
                            <b style="display: block; font-size: 13px; color: var(--text-main);">${info.cliente}</b>
                        </td>
                        <td style="padding: 12px 10px;">
                            <span style="font-size: 11px; color: var(--text-muted); font-family: monospace; background: rgba(0,0,0,0.05); padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border); display: inline-block;">DNI: ${info.dni}</span>
                        </td>
                    </tr>
                `;
            } else {
                htmlPuertos += `
                    <tr style="background: var(--bg-panel); border-bottom: 1px solid var(--border); transition: 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.02)'" onmouseout="this.style.background='var(--bg-panel)'">
                        <td style="text-align: center; width: 60px; padding: 12px 10px;">
                            <div style="background: rgba(16, 185, 129, 0.1); width: 38px; height: 38px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid rgba(16,185,129,0.3); box-shadow: 0 2px 4px rgba(16,185,129,0.1);">
                                <b style="font-size: 15px; color: var(--success);">P${i}</b>
                            </div>
                        </td>
                        <td style="text-align: center; padding: 12px 10px;">
                            <span style="color: var(--success); font-weight: bold; font-size: 12px;"><i class="fa-solid fa-check-circle text-success" style="margin-right: 4px;"></i> Libre</span>
                        </td>
                        <td style="padding: 12px 10px; color: var(--text-muted); font-style: italic; font-size: 12px;">Sin cliente</td>
                        <td style="padding: 12px 10px; color: var(--text-muted); font-style: italic; font-size: 12px;">-</td>
                    </tr>
                `;
            }
        }

        let botonEditarHtml = "";
        if (typeof isAdmin !== 'undefined' && (isAdmin || isAdminLurin || isWilton)) {
            let datosEdicion = encodeURIComponent(JSON.stringify(mapPuertos));
            let mapaEnviado = encodeURIComponent(urlMapaActual); // 🔥 Empaquetamos el link del GPS
            
            botonEditarHtml = `<button onclick="window.abrirModalEditarCajaNAP('${cajaQuery}', ${cantPuertos}, '${datosEdicion}', '${urlFotoActual}', '${mapaEnviado}')" style="display: inline-flex; align-items: center; gap: 5px; margin-top: 8px; margin-left: 10px; background: var(--accent); color: white; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: bold; border: none; cursor: pointer; box-shadow: 0 4px 6px rgba(0,229,255,0.3); transition: 0.2s;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='none'"><i class="fa-solid fa-pen"></i> Editar Caja y Foto</button>`;
        }

        let encabezadoResultados = document.getElementById("resumenCajaNAP");
        if(encabezadoResultados) {
            encabezadoResultados.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <h3 style="margin: 0; color: var(--text-main); font-size: 1.2rem;"><i class="fa-solid fa-box text-accent"></i> CAJA: ${cajaQuery}</h3>
                        <span style="font-size: 12px; color: var(--text-muted);"><b>${ocupadosCount}</b> ocupados | <b>${cantPuertos - ocupadosCount}</b> libres (Total: ${cantPuertos})</span>
                    </div>
                    <div>
                        ${botonFotoHtml}
                        ${botonEditarHtml}
                    </div>
                </div>
            `;
            encabezadoResultados.style.display = "block";
        }
        tbody.innerHTML = htmlPuertos;
    }, 500);
};

// ==========================================
// MÓDULO DE ASISTENCIA Y EVENTOS (TÉCNICOS)
// ==========================================
window.intervaloAlmuerzo = null;

window.abrirModalAsistencia = () => {
    // Revisamos si el técnico actual ya tiene un "Almuerzo" en proceso
    let almuerzoActivo = dbTrabajos.find(t => 
        t.detalle === "Hora de Almuerzo" && 
        t.estado === "en_proceso" && 
        t.tecnicos && t.tecnicos.includes(nombreTecnicoLogueado)
    );

    let panelLibre = document.getElementById("panelAlmuerzoLibre");
    let panelOcupado = document.getElementById("panelAlmuerzoOcupado");

    if (almuerzoActivo) {
        panelLibre.style.display = "none";
        panelOcupado.style.display = "block";
        document.getElementById("formTrabajoId").value = almuerzoActivo.id; // Guardamos el ID secreto
        
        // Cronómetro en vivo
        if (window.intervaloAlmuerzo) clearInterval(window.intervaloAlmuerzo);
        window.intervaloAlmuerzo = setInterval(() => {
            let minutos = Math.floor((Date.now() - almuerzoActivo.tsInicio) / 60000);
            let lbl = document.getElementById("cronometroAlmuerzo");
            if(lbl) {
                lbl.innerText = `${minutos} minutos`;
                lbl.style.color = minutos >= 60 ? "var(--danger)" : "var(--warning)";
            }
        }, 1000);
    } else {
        panelLibre.style.display = "block";
        panelOcupado.style.display = "none";
        if (window.intervaloAlmuerzo) clearInterval(window.intervaloAlmuerzo);
    }
    document.getElementById("modalAsistencia").style.display = "flex";
};

window.registrarEventoAsistencia = async (tipoPrincipal, accion) => {
    let zonaActiva = zonaActual; 
    const { addDoc, updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
    const { getStorage, ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js");

    mostrarToast("⏳ Registrando evento en el sistema...");

    if (tipoPrincipal === "Hora de Almuerzo" && accion === "inicio") {
        try {
            let data = {
                tipoTarea: "biometrico", // 👈 Magia: Ya no gasta tickets
                detalle: "Hora de Almuerzo",
                cliente: nombreTecnicoLogueado,
                dir: "En Refrigerio",
                zona: zonaActiva,
                fecha: new Date().toLocaleDateString('en-CA'),
                horaInicio: new Date().toLocaleTimeString("es-PE", {hour: '2-digit', minute:'2-digit'}),
                tecnicos: [nombreTecnicoLogueado],
                estado: "en_proceso", 
                tsInicio: Date.now(),
                notas: "Técnico salió a almorzar."
            };
            
            await addDoc(coleccionTrabajos, data); // Guardado silencioso
            window.cerrarModalGeneral("modalAsistencia");
            mostrarToast("🍔 ¡Provecho! Tu hora de almuerzo ha iniciado.");
        } catch (e) { mostrarToast("❌ Error al registrar."); console.error(e); }

    } else if (tipoPrincipal === "Hora de Almuerzo" && accion === "fin") {
        let fileInput = document.getElementById("fotoRegresoAlmuerzo");
        if (fileInput.files.length === 0) { mostrarToast("⚠️ Tómate una foto o sube evidencia para registrar tu regreso."); return; }
        
        let idAlmuerzo = document.getElementById("formTrabajoId").value;
        try {
            let storageRef = ref(getStorage(), "evidencias_tecnicas/almuerzo_" + Date.now());
            await uploadBytes(storageRef, fileInput.files[0]);
            let urlFoto = await getDownloadURL(storageRef);

            await updateDoc(doc(coleccionTrabajos, idAlmuerzo), {
                estado: "atendido",
                tsFin: Date.now(),
                notaCierre: "Regresó de almorzar.",
                evidencias: [urlFoto]
            });
            window.cerrarModalGeneral("modalAsistencia");
            mostrarToast("✅ Almuerzo finalizado. ¡A seguir trabajando!");
        } catch (e) { mostrarToast("❌ Error al subir foto."); }
        
    } else if (tipoPrincipal === "Otro") {
        let subtipo = document.getElementById("tipoEventoAsistencia").value;
        let nota = document.getElementById("notaEventoAsistencia").value;
        let fileInput = document.getElementById("fotoEventoAsistencia");
        
        if (subtipo.includes("Incidente") && fileInput.files.length === 0) {
            mostrarToast("⚠️ Sube una foto de evidencia para el incidente."); return;
        }

        try {
            let urlsFotos = [];
            if (fileInput.files.length > 0) {
                let storageRef = ref(getStorage(), "evidencias_tecnicas/evento_" + Date.now());
                await uploadBytes(storageRef, fileInput.files[0]);
                urlsFotos.push(await getDownloadURL(storageRef));
            }

            let data = {
                tipoTarea: "biometrico", // 👈 Magia: Ya no gasta tickets
                detalle: subtipo,
                cliente: nombreTecnicoLogueado,
                dir: "Reporte Interno",
                zona: zonaActiva,
                fecha: new Date().toLocaleDateString('en-CA'),
                tecnicos: [nombreTecnicoLogueado],
                estado: "atendido", 
                tsFin: Date.now(),
                notaCierre: nota || "Sin notas",
                evidencias: urlsFotos
            };
            
            await addDoc(coleccionTrabajos, data); // Guardado silencioso
            window.cerrarModalGeneral("modalAsistencia");
            mostrarToast("✅ Reporte enviado al Control de Asistencia.");
        } catch (e) { mostrarToast("❌ Error."); }
    }
};

// ============================================================ //
// LÓGICA DEL MENÚ ACORDEÓN LATERAL                             //
// ============================================================ //
window.toggleSubMenu = (header) => {
    // Si la barra está encogida a 75px (modo iconos), ignoramos el clic
    const sidebar = document.querySelector('.app-sidebar');
    if (sidebar && sidebar.classList.contains('collapsed')) return;

    // Alternamos el estado del título (esto hace girar la flecha en CSS)
    header.classList.toggle('is-closed');

    // Buscamos el elemento que sigue abajo del título
    let next = header.nextElementSibling;
    
    // Mientras haya un elemento abajo y NO sea otro título de sección...
    while (next && !next.classList.contains('nav-section')) {
        if (header.classList.contains('is-closed')) {
            next.classList.add('hide-by-accordion');
        } else {
            next.classList.remove('hide-by-accordion');
        }
        next = next.nextElementSibling; // Pasamos al siguiente botón
    }
};

// ============================================================ //
// 🆕 SUPERPODERES UX (MAGIA VISUAL Y SONORA)                   //
// ============================================================ //

// 1. SISTEMA DE MICRO-SONIDOS (Sin descargar archivos, sonido sintetizado puro)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
window.playSonidoUX = (tipo) => {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    
    if (tipo === 'pop') { // Sonido de burbuja al copiar texto
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (tipo === 'error') { // Zumbido suave si se va el internet
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    }
};

// 2. SMART COPY (Clic para copiar con animación)
document.addEventListener('click', (e) => {
    let el = e.target.closest('.smart-copy');
    if (el) {
        navigator.clipboard.writeText(el.innerText.trim());
        window.playSonidoUX('pop'); // Reproduce el sonido de burbuja
        
        let tooltip = document.createElement('div');
        tooltip.className = 'copy-tooltip';
        tooltip.innerText = '¡Copiado!';
        tooltip.style.left = (e.clientX - 20) + 'px';
        tooltip.style.top = (e.clientY - 20) + 'px';
        document.body.appendChild(tooltip);
        
        setTimeout(() => tooltip.remove(), 800);
    }
});

// 3. SALUDO CONTEXTUAL INTELIGENTE
const actualizarSaludo = () => {
    let hora = new Date().getHours();
    let lbl = document.getElementById("lblSaludoInteligente");
    if (!lbl) return;
    if (hora >= 5 && hora < 12) lbl.innerText = "🌤️ Buenos días";
    else if (hora >= 12 && hora < 19) lbl.innerText = "☕ Buenas tardes";
    else lbl.innerText = "🌙 Turno nocturno";
};
actualizarSaludo(); // Se ejecuta al cargar la página

// 4. DETECTOR DE LATIDO (Conexión a Internet en vivo)
window.addEventListener('online', () => {
    let dot = document.getElementById('pulseDot');
    let txt = document.getElementById('txtStatusRed');
    if(dot) dot.className = 'status-pulse';
    if(txt) { txt.innerText = 'ONLINE'; txt.style.color = 'var(--text-muted)'; }
    window.playSonidoUX('pop');
});
window.addEventListener('offline', () => {
    let dot = document.getElementById('pulseDot');
    let txt = document.getElementById('txtStatusRed');
    if(dot) dot.className = 'status-pulse offline';
    if(txt) { txt.innerText = 'OFFLINE'; txt.style.color = 'var(--danger)'; }
    window.playSonidoUX('error');
});

// 5. EFECTO CARGA FANTASMA (Skeleton Loading)
window.mostrarSkeleton = (tablaId, columnas) => {
    let tbody = document.getElementById(tablaId);
    if (!tbody) return;
    let html = '';
    for(let i=0; i<5; i++) {
        html += `<tr>`;
        for(let c=0; c<columnas; c++) { html += `<td style="padding:15px;"><div class="skeleton-box"></div><div class="skeleton-box" style="width:60%;"></div></td>`; }
        html += `</tr>`;
    }
    tbody.innerHTML = html;
};

// 6. CONFETI (GAMIFICACIÓN)
window.lanzarConfeti = () => {
    if (window.confetti) {
        window.confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#0ea5e9', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899'], zIndex: 99999 });
        if(window.playSonidoUX) window.playSonidoUX('pop');
    } else {
        console.warn("La librería de confeti aún no ha cargado.");
    }
};

// ============================================================ //
// 🖱️ DOBLE CLIC MAESTRO (NINJA + MODO FOCUS CINE)              //
// ============================================================ //
document.addEventListener('dblclick', (e) => {
    // 1. Verificamos si hizo clic en una NOTA para el MODO CINE
    let notaEl = e.target.closest('.lbl-nota-focus');
    if (notaEl) {
        if (typeof window.playSonidoUX === 'function') window.playSonidoUX('pop');
        
        let overlay = document.getElementById('focusOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'focusOverlay';
            overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.95); backdrop-filter:blur(10px); z-index:999999; display:flex; align-items:center; justify-content:center; opacity:0; transition:all 0.4s ease; cursor:pointer;";
            overlay.innerHTML = `
                <div style="max-width:800px; color:#fff; font-size:2.5rem; text-align:center; padding:40px; font-weight:900; line-height:1.4; transform:scale(0.8); transition:all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); text-shadow: 0 10px 30px rgba(0,0,0,0.5);" id="focusText"></div>
                <div style="position:absolute; bottom:40px; color:var(--accent); font-size:1rem; font-weight:bold; animation: pulse 2s infinite;"><i class="fa-solid fa-expand"></i> Haz clic en cualquier lugar para salir</div>
            `;
            document.body.appendChild(overlay);
            overlay.addEventListener('click', () => {
                overlay.style.opacity = '0';
                document.getElementById('focusText').style.transform = 'scale(0.8)';
                setTimeout(() => overlay.style.display = 'none', 400);
            });
        }
        
        let textoLimpio = notaEl.innerText.replace('NOTA VENTA/NOC:', '').trim();
        document.getElementById('focusText').innerText = textoLimpio;
        overlay.style.display = 'flex';
        setTimeout(() => {
            overlay.style.opacity = '1';
            document.getElementById('focusText').style.transform = 'scale(1)';
        }, 10);
        
        return; // Detenemos la ejecución aquí para que NO abra la ventana de edición Ninja
    }

    // 2. Si NO fue en la nota, aplicamos el DOBLE CLIC NINJA (Editar Trabajo)
    if (e.target.closest('button, a, input, select, textarea, .btn-acciones-grid')) return;
    
    let tr = e.target.closest('tr[data-edit-id]');
    if (tr && tr.dataset.editId) {
        window.editarTrabajo(tr.dataset.editId);
    }
});

// ============================================================ //
// 😻 MICHI SUPERVISOR Y TRITURADORA (MAGIA UX)                 //
// ============================================================ //

// 2. El Cerebro del Michi Supervisor (Con Victoria Inbox Zero)
window.michiMemoriaPendientes = -1; // Memoria del gato

setInterval(() => {
    let michi = document.getElementById("michi-supervisor");
    let zzz = document.getElementById("michi-zzz");
    if (!michi || !zzz || !dbTrabajos) return;

    let pendientes = dbTrabajos.filter(t => t.estado === "pendiente" && (t.zona || "Norte") === zonaActual).length;
    
    // 🏆 MAGIA: Si había pendientes y ahora hay 0, ¡CANTAMOS VICTORIA!
    if (window.michiMemoriaPendientes > 0 && pendientes === 0) {
        if (typeof window.lanzarConfeti === 'function') window.lanzarConfeti();
        
        // Arpegio celestial de victoria (Acorde de Re Mayor) sintetizado puro
        if (window.AudioContext || window.webkitAudioContext) {
            let tempCtx = new (window.AudioContext || window.webkitAudioContext)();
            const notas = [293.66, 369.99, 440.00, 587.33]; // Notas ascendentes
            notas.forEach((freq, i) => {
                let o = tempCtx.createOscillator(); let g = tempCtx.createGain();
                o.connect(g); g.connect(tempCtx.destination);
                o.type = 'sine'; o.frequency.value = freq;
                g.gain.setValueAtTime(0, tempCtx.currentTime + (i * 0.1));
                g.gain.linearRampToValueAtTime(0.1, tempCtx.currentTime + (i * 0.1) + 0.05);
                g.gain.exponentialRampToValueAtTime(0.01, tempCtx.currentTime + (i * 0.1) + 0.4);
                o.start(tempCtx.currentTime + (i * 0.1)); o.stop(tempCtx.currentTime + (i * 0.1) + 0.4);
            });
        }
        mostrarToast("🏆 ¡BANDEJA LIMPIA! Excelente trabajo equipo.");
    }
    
    window.michiMemoriaPendientes = pendientes; // El gato actualiza su memoria

    if (pendientes === 0) {
        michi.innerText = "🐱";
        michi.style.filter = "grayscale(80%)";
        michi.title = "Michi Supervisor (Todo limpio, descansando)";
        if(zzz) zzz.style.opacity = "1";
    } else {
        michi.innerText = "🙀";
        michi.style.filter = "grayscale(0%) drop-shadow(0 0 8px var(--warning))";
        michi.style.transform = "scale(1.2)";
        setTimeout(() => michi.style.transform = "scale(1)", 300);
        michi.title = `Michi Supervisor (¡Despierta, hay ${pendientes} pendientes!)`;
        if(zzz) zzz.style.opacity = "0";
    }
}, 3000);

// 3. Sonido Sintetizado de la Trituradora de Papel
const oldPlaySonidoUX = window.playSonidoUX;
window.playSonidoUX = (tipo) => {
    if(tipo === 'shredder' && window.AudioContext) {
        if(audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start(); osc.stop(audioCtx.currentTime + 0.4);
    } else {
        if(oldPlaySonidoUX) oldPlaySonidoUX(tipo);
    }
};

// ============================================================ //
// 🪄 SUPERPODERES: VOZ, CLIC CENTRAL Y MENÚ CONTEXTUAL         //
// ============================================================ //

// ============================================================ //
// 🤖 MOTOR DE LENGUAJE NATURAL Y RESUMEN (TIPO JARVIS)
// ============================================================ //

// 1. Traductor técnico para que el robot no lea como máquina
window.limpiarTextoParaVoz = (texto) => {
    if (!texto) return "";
    return texto
        .replace(/Mz/gi, "Manzana")
        .replace(/Lt/gi, "Lote")
        .replace(/AA\.HH\./gi, "Asentamiento Humano")
        .replace(/Av\./gi, "Avenida")
        .replace(/Urb\./gi, "Urbanización")
        .replace(/CTO/gi, "Caja terminal óptica")
        .replace(/NAP/gi, "Caja de distribución")
        .replace(/LOS/gi, "Fallo de luz roja")
        .replace(/TX/gi, "Transmisión")
        .replace(/RX/gi, "Recepción")
        .replace(/\//g, " con ") // Lee "Mz A / Lt 2" como "Mz A con Lt 2"
        .replace(/-/g, " guion "); 
};

// 2. Reporte General de la Operación en vivo
window.leerResumenNOC = (btnElement) => {
    if ('speechSynthesis' in window) {
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            if (btnElement) btnElement.style.color = "";
            return;
        }
        if (btnElement) btnElement.style.color = "var(--danger)";
        
        let pendientes = document.getElementById("kpiPendientes") ? document.getElementById("kpiPendientes").innerText : "0";
        let atendidos = document.getElementById("kpiAtendidos") ? document.getElementById("kpiAtendidos").innerText : "0";
        let enCurso = dbTrabajos.filter(t => t.estado === "en_camino" || t.estado === "en_proceso").length;
        
        let saludo = new Date().getHours() < 12 ? "Buenos días" : new Date().getHours() < 19 ? "Buenas tardes" : "Buenas noches";
        
        let texto = `${saludo}. Reporte de operaciones para la zona ${zonaActual}. Tenemos ${pendientes} trabajos pendientes, ${enCurso} en curso, y ${atendidos} finalizados. `;
        
        if (parseInt(pendientes) > 10) {
            texto += "La carga de pendientes es alta, recomiendo reasignar cuadrillas.";
        } else if (parseInt(pendientes) === 0) {
            texto += "La bandeja está limpia. Excelente trabajo.";
        }
        
        let u = new SpeechSynthesisUtterance(texto);
        u.lang = 'es-ES';
        u.rate = 1.1; // Velocidad cómoda
        
        u.onend = () => { if (btnElement) btnElement.style.color = ""; };
        window.speechSynthesis.speak(u);
    }
};

// ============================================================ //
// 🤖 MOTOR DE INTELIGENCIA DE VOZ (ASISTENTE VIRTUAL GRATUITO) //
// ============================================================ //

// 1. Traductor Técnico (Mejora la naturalidad de la voz)
window.limpiarTextoParaVoz = (texto) => {
    if (!texto) return "";
    return texto
        .replace(/Mz/gi, "Manzana")
        .replace(/Lt/gi, "Lote")
        .replace(/AA\.HH\./gi, "Asentamiento Humano")
        .replace(/Av\./gi, "Avenida")
        .replace(/Urb\./gi, "Urbanización")
        .replace(/CTO/gi, "Caja terminal óptica")
        .replace(/NAP/gi, "Caja de distribución")
        .replace(/LOS/gi, "Fallo de luz roja")
        .replace(/TX/gi, "Transmisión")
        .replace(/RX/gi, "Recepción")
        .replace(/ALT-/gi, "Alta nueva número ")
        .replace(/AVE-/gi, "Avería número ")
        .replace(/OTR-/gi, "Trabajo externo número ")
        .replace(/\//g, " con ") 
        .replace(/-/g, " guion "); 
};

// 2. Dictado por Voz (Speech-to-Text) para el Buscador
window.escucharVozBuscador = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        mostrarToast("⚠️ Tu navegador no soporta búsqueda por voz (Usa Chrome).");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-PE'; // Español de Perú
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let btnMicro = document.getElementById("btnMicrofonoBuscar");
    let inputBuscar = document.getElementById("buscador");

    recognition.onstart = function() {
        btnMicro.style.color = "var(--danger)";
        btnMicro.style.borderColor = "var(--danger)";
        btnMicro.innerHTML = '<i class="fa-solid fa-microphone-lines fa-fade"></i>';
        mostrarToast("🎙️ Escuchando... Habla ahora.");
    };

    recognition.onresult = function(event) {
        let textoEscuchado = event.results[0][0].transcript;
        // Limpiamos el texto por si dice un número de DNI con espacios
        textoEscuchado = textoEscuchado.replace(/\s+/g, ' ').replace(/\./g, '').trim();
        
        inputBuscar.value = textoEscuchado;
        window.renderizarTabla(); // Ejecutamos la búsqueda
        mostrarToast(`✅ Búsqueda aplicada: "${textoEscuchado}"`);
    };

    recognition.onspeechend = function() {
        recognition.stop();
    };

    recognition.onerror = function(event) {
        mostrarToast("❌ No se entendió el audio.");
        restaurarBoton();
    };

    recognition.onend = function() {
        restaurarBoton();
    };

    function restaurarBoton() {
        btnMicro.style.color = "var(--text-muted)";
        btnMicro.style.borderColor = "var(--border)";
        btnMicro.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    }

    recognition.start();
};

// 2.5 Dictado por Voz Genérico para Textareas (Notas de técnicos)
window.escucharVozGenerico = (inputId, btnId) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        mostrarToast("⚠️ Tu celular/navegador no soporta dictado por voz.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-PE'; // Español de Perú
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let btnMicro = document.getElementById(btnId);
    let inputTexto = document.getElementById(inputId);

    recognition.onstart = function() {
        btnMicro.style.color = "var(--danger)";
        btnMicro.style.borderColor = "var(--danger)";
        btnMicro.innerHTML = '<i class="fa-solid fa-microphone-lines fa-fade"></i>';
        mostrarToast("🎙️ Escuchando... Habla ahora.");
    };

    recognition.onresult = function(event) {
        let textoEscuchado = event.results[0][0].transcript;
        
        // Magia: Si el técnico ya había escrito algo, el audio nuevo se suma al final con un espacio
        if (inputTexto.value.trim() !== "") {
            inputTexto.value += " " + textoEscuchado;
        } else {
            inputTexto.value = textoEscuchado;
        }
        
        mostrarToast(`✅ Texto dictado con éxito.`);
    };

    recognition.onspeechend = function() {
        recognition.stop();
    };

    recognition.onerror = function(event) {
        mostrarToast("❌ No se entendió el audio.");
        restaurarBoton();
    };

    recognition.onend = function() {
        restaurarBoton();
    };

    function restaurarBoton() {
        btnMicro.style.color = "var(--text-muted)";
        btnMicro.style.borderColor = "var(--border)";
        btnMicro.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    }

    recognition.start();
};

// 3. Reporte Ejecutivo Hablado (Resumen de la Tabla Actual)
// Para invocarlo, puedes asignarle esta función a un botón, o usar el atajo de la letra "R" (lo programamos más abajo)
window.leerResumenNOC = () => {
    if ('speechSynthesis' in window) {
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            return;
        }
        
        // Recolectamos los KPIs directamente de las tarjetas
        let total = document.getElementById("kpiTotal") ? document.getElementById("kpiTotal").innerText : "0";
        let pendientes = document.getElementById("kpiPendientes") ? document.getElementById("kpiPendientes").innerText : "0";
        let atendidos = document.getElementById("kpiAtendidos") ? document.getElementById("kpiAtendidos").innerText : "0";
        let noAtendidos = document.getElementById("kpiNoAtendidos") ? document.getElementById("kpiNoAtendidos").innerText : "0";
        let noRealizados = document.getElementById("kpiNoRealizados") ? document.getElementById("kpiNoRealizados").innerText : "0";
        
        // Contamos cuántos están en tránsito (En Camino + En Proceso)
        let enCurso = dbTrabajos.filter(t => t.estado === "en_camino" || t.estado === "en_proceso").length;
        
        let hora = new Date().getHours();
        let saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
        
        let texto = `${saludo}. Reporte de operaciones del Centro de Control. En pantalla tenemos ${total} órdenes activas. `;
        texto += `Hay ${pendientes} trabajos pendientes, ${enCurso} en ejecución por las cuadrillas, y ${atendidos} finalizados con éxito. `;
        
        let fallidosTotales = parseInt(noAtendidos) + parseInt(noRealizados);
        if (fallidosTotales > 0) {
            texto += `Cuidado, se registran ${fallidosTotales} tareas fallidas o canceladas que requieren revisión. `;
        }
        
        if (parseInt(pendientes) === 0 && parseInt(enCurso) === 0) {
            texto += "La bandeja de despachos está limpia. Excelente trabajo.";
        } else if (parseInt(pendientes) > 15) {
            texto += "Alerta. La carga de órdenes pendientes es elevada. Se recomienda asignar nuevos recursos.";
        }
        
        let u = new SpeechSynthesisUtterance(texto);
        u.lang = 'es-ES';
        u.rate = 1.1; // Un poco más rápido para que no aburra
        u.pitch = 1.0;
        window.speechSynthesis.speak(u);
        mostrarToast("🔊 Reproduciendo Reporte Ejecutivo...");
    }
};

// 🔊 Lector de Voz a la Carta (Mejorado con Traductor Técnico)
window.leerOrdenVoz = (id, btnElement) => {
    if ('speechSynthesis' in window) {
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            document.querySelectorAll('.btn-voz').forEach(b => b.classList.remove('hablando'));
            return; // Si ya hablaba, se calla al instante
        }
        
        let t = dbTrabajos.find(x => x.id === id);
        if (!t) return;
        
        btnElement.classList.add('hablando');
        
        let tipo = t.tipoTarea === "alta" ? "Instalación" : t.tipoTarea === "averia" ? "Avería" : t.tipoTarea === "baja" ? "Retiro de equipos" : "Trabajo";
        let tecs = Array.isArray(t.tecnicos) ? t.tecnicos.join(" y ") : (t.tecnicos || "sin asignar");
        let clienteNombreLimpio = t.cliente.split("-")[0].split("(")[0].trim(); 
        
        // 🧠 Pasamos la dirección y el detalle por el filtro limpia-texto
        let direccionLimpia = window.limpiarTextoParaVoz(t.dir || "no especificada");
        let problemaLimpio = window.limpiarTextoParaVoz(t.detalle ? t.detalle : "");
        let notaLimpia = window.limpiarTextoParaVoz(t.notas ? t.notas : "");

        let prob = problemaLimpio ? `Detalle: ${problemaLimpio}.` : "";
        let notasAdicionales = notaLimpia ? `Observación adicional: ${notaLimpia}.` : "";
        
        let texto = `${tipo} para ${clienteNombreLimpio}. Ubicación en: ${direccionLimpia}. ${prob} Técnico a cargo: ${tecs}. ${notasAdicionales}`;
        
        let u = new SpeechSynthesisUtterance(texto);
        u.lang = 'es-ES';
        u.rate = 1.15; 
        u.pitch = 1.0;
        u.onend = () => { btnElement.classList.remove('hablando'); };
        
        let voices = window.speechSynthesis.getVoices();
        let googleVoice = voices.find(v => v.name.includes('Google') && v.lang.includes('es'));
        if (googleVoice) u.voice = googleVoice;
        
        window.speechSynthesis.speak(u);
    } else {
        mostrarToast("⚠️ Tu navegador no soporta el asistente de voz.");
    }
};

// ⌨️ ATAJO DE TECLADO: Presiona "Alt + R" para escuchar el Reporte Ejecutivo sin tocar el mouse
document.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        window.leerResumenNOC();
    }
});

// 🖱️ Atajo: Clic Central (Rueda) para abrir Módulos y Mapas en otra Pestaña
document.addEventListener('auxclick', (e) => {
    if (e.button === 1) { // 1 = Botón de la ruedita del mouse
        // 1. Menú lateral
        let btnNav = e.target.closest('.nav-btn');
        if (btnNav) {
            let onclickVal = btnNav.getAttribute('onclick');
            if (onclickVal && onclickVal.includes('.html')) {
                e.preventDefault();
                let urlMatch = onclickVal.match(/'([^']+)'/);
                if (urlMatch) window.open(urlMatch[1], '_blank'); 
            }
            return;
        }

        // 2. Botones de la tabla (Mapa y WhatsApp)
        let btnTabla = e.target.closest('.btn-ui-mapa, .btn-ui-wsp');
        if (btnTabla) {
            e.preventDefault();
            // Si es un <a> (como WhatsApp o Mapas de Técnicos), abrimos su enlace
            if (btnTabla.tagName === 'A' && btnTabla.href) {
                window.open(btnTabla.href, '_blank');
                return;
            }
            // Si es un <button> (Mapas para la Oficina), sacamos la URL de Firebase
            let tr = e.target.closest('tr[data-edit-id]');
            if (tr && tr.dataset.editId) {
                let t = dbTrabajos.find(x => x.id === tr.dataset.editId);
                if (t && t.mapa) window.open(t.mapa, '_blank');
            }
        }
    }
});

// ⚡ Menú Contextual Inteligente (Clic Derecho)
window.abrirMenuContextualTabla = (e, id) => {
    let isTecnico = !isAdmin && !isAdminLurin && !isWilton && !isCarlos && !isVendedor && !isCobranzas;
    if (isTecnico) return; 
    
    e.preventDefault(); 
    let t = dbTrabajos.find(x => x.id === id);
    if (!t) return;
    
    window.ctxTablaIdActual = id;
    
    let menu = document.getElementById("contextMenuTabla");
    if (!menu) {
        menu = document.createElement("div");
        menu.id = "contextMenuTabla";
        document.body.appendChild(menu);
    }
    
    let estActual = t.estado || 'pendiente';
    let html = `<div style="padding: 8px 14px; background: rgba(0,0,0,0.15); border-bottom: 1px solid var(--border); font-size: 10px; font-weight: 900; color: var(--text-muted); text-transform: uppercase;">⚡ Acciones Rápidas</div>`;
    
    if (estActual === 'pendiente') {
        html += `<button class="ctx-item-t" onclick="window.accionCtxTabla('camino')"><i class="fa-solid fa-person-walking text-accent"></i> Marcar En Camino</button>`;
    } else if (estActual === 'en_camino' || estActual === 'en_proceso') {
        html += `<button class="ctx-item-t" onclick="window.accionCtxTabla('atendido')"><i class="fa-solid fa-check-double text-success"></i> Cerrar (Atendido)</button>`;
        html += `<button class="ctx-item-t" onclick="window.accionCtxTabla('pausar')"><i class="fa-solid fa-pause" style="color: #475569;"></i> Pausar Orden</button>`;
    } else if (estActual === 'pausado') {
        html += `<button class="ctx-item-t" onclick="window.accionCtxTabla('reanudar')"><i class="fa-solid fa-play text-success"></i> Reanudar Orden</button>`;
    }

    // Listado Dinámico de Técnicos para Asignación Rápida (CORREGIDO PARA MÚLTIPLE SELECCIÓN)
    let listaTecnicos = zonaActual === "Norte" ? tecnicosNorte : tecnicosLurin;
    let techsHtml = listaTecnicos.map(tec => 
        // 1. Añadimos stopPropagation aquí también para que el clic no suba al contenedor padre y cierre el menú
        `<label class="ctx-item-t" style="padding-left: 25px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 6px; user-select: none;" onclick="event.stopPropagation();">
            <input type="checkbox" value="${tec}" class="chk-tecnico-ctx" style="margin: 0; transform: scale(1.1); cursor: pointer;" onclick="event.stopPropagation();">
            <span style="color: var(--text-main);">${tec}</span>
        </label>`
    ).join('');
    
    html += `
        <div style="position: relative;">
            <button class="ctx-item-t" onclick="event.stopPropagation(); this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'"><i class="fa-solid fa-users text-info"></i> Asignar Técnico <i class="fa-solid fa-chevron-down" style="margin-left:auto; font-size:9px;"></i></button>
            <div style="display:none; background: rgba(0,0,0,0.2); border-radius: 4px; margin: 2px 6px; padding: 4px 0;" id="ctxSubMenuTecnicos" onclick="event.stopPropagation();">
                ${techsHtml}
                <div style="padding: 6px; border-top: 1px solid var(--border); margin-top: 4px;">
                    <button class="btn-primary" style="width: 100%; font-size: 10px; padding: 6px;" onclick="event.stopPropagation(); window.accionCtxTabla('confirmar_asignacion')">Guardar Técnicos</button>
                </div>
            </div>
        </div>
        <button class="ctx-item-t" onclick="window.accionCtxTabla('wsp')"><i class="fa-brands fa-whatsapp text-success"></i> Copiar Formato Cuadrilla</button>
        <button class="ctx-item-t" onclick="window.accionCtxTabla('retencion')"><i class="fa-solid fa-paper-plane text-warning"></i> Derivar a Retención</button>
        <div style="height: 1px; background: var(--border); margin: 4px 6px;"></div>
        <button class="ctx-item-t" onclick="window.accionCtxTabla('editar')"><i class="fa-solid fa-pen text-purple"></i> Abrir Editor Completo</button>
    `;
    
    menu.innerHTML = html;
    menu.style.display = "block";
    
    let x = e.clientX; let y = e.clientY;
    if (x + 230 > window.innerWidth) x = window.innerWidth - 230;
    if (y + 350 > window.innerHeight) y = window.innerHeight - 350; // Margen ampliado para el submenú
    
    menu.style.left = x + "px";
    menu.style.top = y + "px";
};

document.addEventListener('click', () => {
    let m = document.getElementById("contextMenuTabla");
    if(m) m.style.display = "none";
});

window.accionCtxTabla = async (accion, extraParam, elementoHTML) => {
    let id = window.ctxTablaIdActual;
    if (!id) return;
    let t = dbTrabajos.find(x => x.id === id);
    
    if (accion === 'editar') { window.editarTrabajo(id); } 
    else if (accion === 'camino') { window.cambiarEstadoEnCamino(id); } 
    else if (accion === 'atendido') { window.abrirModalCierreDirecto(id, 'atendido'); } 
    else if (accion === 'pausar') { window.pausarTrabajo(id, t.estado); }
    else if (accion === 'reanudar') { window.reanudarTrabajo(id, t.estadoPrevioPausa || 'en_proceso'); }
    else if (accion === 'retencion') { window.prepararEnvioBandeja(t.dni); }
    else if (accion === 'confirmar_asignacion') {
        // Recolectamos todos los técnicos marcados en el menú usando la clase específica
        let menuTecnicos = document.getElementById("ctxSubMenuTecnicos");
        if (!menuTecnicos) return;
        
        let seleccionados = Array.from(menuTecnicos.querySelectorAll('.chk-tecnico-ctx:checked')).map(c => c.value);
        
        if (seleccionados.length === 0) seleccionados = ["Sin Asignar"];
        
        mostrarToast("⏳ Asignando técnico(s)...");
        try {
            const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
            await updateDoc(doc(coleccionTrabajos, id), { tecnicos: seleccionados, estado: "pendiente" });
            mostrarToast(`✅ Trabajo asignado a: ${seleccionados.join(", ")}`);
            document.getElementById("contextMenuTabla").style.display = "none"; // Cerramos el menú
        } catch (e) { mostrarToast("❌ Error al asignar técnico"); }
    }
    else if (accion === 'wsp') {
        let telPrincipal = (t.tel || "").split("/")[0].trim();
        let tipoIcono = t.tipoTarea === "alta" ? "🚀" : t.tipoTarea === "averia" ? "🛠️" : "📍";
        let txtWsp = `*NUEVO TRABAJO: ${t.cliente}*\n\n${tipoIcono} *TRABAJO:* ${(t.tipoTarea || "OTROS").toUpperCase()}\n📝 *DETALLE:* ${t.detalle}\n📞 *TELÉFONO:* ${telPrincipal}\n\n📍 *DIRECCIÓN:* ${t.dir}`;
        if(t.mapa) txtWsp += `\n🗺️ *GPS MAPA:* ${t.mapa}`;
        if(t.linkCaja) txtWsp += `\n📦 *CAJA NAP:* ${t.linkCaja}`;
        
        navigator.clipboard.writeText(txtWsp).then(() => mostrarToast("✅ Formato copiado. Pégalo en WhatsApp."));
    }
};

// ============================================================ //
// 🚀 MOTOR GRÁFICO UX (LÁSER, ONDAS, CASCADA Y TEMBLOR)        //
// ============================================================ //

// 1. Inyectar Estilos Visuales sin tocar archivos externos
const estiloUX = document.createElement('style');
estiloUX.innerHTML = `
    /* Láser de Carga */
    #top-laser { position:fixed; top:0; left:0; height:3px; background:var(--accent, #00e5ff); z-index:9999999; box-shadow:0 0 15px var(--accent); transition:width 0.2s ease-out, opacity 0.3s ease; width:0; opacity:0; pointer-events:none; }
    /* Ondas de Agua en Botones */
    button { position:relative; overflow:hidden; }
    .ripple-span { position:absolute; border-radius:50%; transform:scale(0); animation:ripple-anim 0.6s linear; background:rgba(255,255,255,0.4); pointer-events:none; }
    @keyframes ripple-anim { to { transform:scale(4); opacity:0; } }
    /* Cascada en Tabla */
    .fila-cascada { opacity:0; transform:translateX(-30px); animation:cascada-anim 0.4s cubic-bezier(0.25, 0.8, 0.25, 1) forwards; }
    @keyframes cascada-anim { to { opacity:1; transform:translateX(0); } }
    /* Temblor de Error */
    .shake-anim { animation:shake-key 0.4s cubic-bezier(.36,.07,.19,.97) both; border: 2px solid var(--danger) !important; box-shadow: 0 0 20px rgba(239, 68, 68, 0.4) !important; }
    @keyframes shake-key { 10%,90%{transform:translate3d(-3px,0,0)} 20%,80%{transform:translate3d(5px,0,0)} 30%,50%,70%{transform:translate3d(-10px,0,0)} 40%,60%{transform:translate3d(10px,0,0)} }
    
    /* 🪄 NUEVO: Menú Contextual Rápido */
    #contextMenuTabla { position: fixed; display: none; background: var(--bg-panel); border: 1px solid var(--border); border-radius: 10px; padding: 6px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); z-index: 999999; min-width: 230px; backdrop-filter: blur(5px); }
    .ctx-item-t { width: 100%; text-align: left; padding: 10px 14px; background: transparent; border: none; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 12px; color: var(--text-main); display: flex; align-items: center; gap: 10px; transition: 0.15s; }
    .ctx-item-t:hover { background: rgba(0, 229, 255, 0.1); color: var(--accent); padding-left: 18px; }
    
    /* 🔊 NUEVO: Botón de Voz */
    .btn-voz { background: transparent; border: none; color: var(--accent); cursor: pointer; padding: 4px; border-radius: 6px; font-size: 15px; transition: 0.2s; vertical-align: middle; margin-right: 5px; }
    .btn-voz:hover { background: rgba(14, 165, 233, 0.15); transform: scale(1.15); }
    .btn-voz.hablando { color: var(--danger); animation: pulse-voz 1s infinite; }
    @keyframes pulse-voz { 0% { opacity: 1; filter: drop-shadow(0 0 5px var(--danger)); } 50% { opacity: 0.4; } 100% { opacity: 1; filter: drop-shadow(0 0 5px var(--danger)); } }
`;
document.head.appendChild(estiloUX);

// 2. Función del Láser de Velocidad
document.body.insertAdjacentHTML('afterbegin', '<div id="top-laser"></div>');
window.dispararLaser = () => {
    let laser = document.getElementById('top-laser');
    laser.style.opacity = '1'; laser.style.width = '30%';
    setTimeout(() => laser.style.width = '70%', 100);
    setTimeout(() => laser.style.width = '100%', 300);
    setTimeout(() => { laser.style.opacity = '0'; setTimeout(() => laser.style.width = '0', 300); }, 500);
};

// 3. Listener Global para Ondas de Agua (Material Ripple)
document.addEventListener('mousedown', (e) => {
    let btn = e.target.closest('button');
    if (btn) {
        let rect = btn.getBoundingClientRect();
        let x = e.clientX - rect.left; let y = e.clientY - rect.top;
        let ripple = document.createElement('span');
        ripple.className = 'ripple-span';
        let size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (x - size/2) + 'px'; ripple.style.top = (y - size/2) + 'px';
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    }
});

// 4. Función de Castigo Físico (Temblor)
window.sacudirModal = (idModal) => {
    let modal = document.getElementById(idModal);
    if (modal) {
        // Busca la caja blanca interna del modal para sacudirla
        let contenido = modal.querySelector('div[style*="background:var(--bg-panel)"]') || modal.children[0];
        if (contenido) {
            contenido.classList.remove('shake-anim');
            void contenido.offsetWidth; // Magia para reiniciar la animación CSS
            contenido.classList.add('shake-anim');
            if (typeof window.playSonidoUX === 'function') window.playSonidoUX('error');
            setTimeout(() => contenido.classList.remove('shake-anim'), 400); // Le quitamos el borde rojo después
        }
    }
};

// ============================================================ //
// ✨ UX PREMIUM LOGIN (Canvas, Remember Me, Caps Lock)         //
// ============================================================ //
document.addEventListener('DOMContentLoaded', () => {
    // 💾 RECORDAR USUARIO
    let emailGuardado = localStorage.getItem('ten_email_recordado');
    if (emailGuardado) {
        let inp = document.getElementById('txtEmail');
        let chk = document.querySelector('.custom-checkbox input[type="checkbox"]');
        if (inp) inp.value = emailGuardado;
        if (chk) chk.checked = true;
    }

    // 🔔 AVISO DE MAYÚSCULAS
    let passInput = document.getElementById('txtPassword');
    if (passInput) {
        passInput.addEventListener('keyup', (e) => {
            let capsOn = e.getModifierState && e.getModifierState('CapsLock');
            let tooltip = document.getElementById('capsWarning');
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.id = 'capsWarning';
                tooltip.style.cssText = 'position:absolute; right:40px; top:50%; transform:translateY(-50%); font-size:10px; color:var(--warning); font-weight:900; pointer-events:none; background:var(--bg-panel); padding:0 4px;';
                tooltip.innerText = 'MAYÚS';
                passInput.parentElement.appendChild(tooltip);
            }
            tooltip.style.display = capsOn ? 'block' : 'none';
        });
    }

    // 🌐 CANVAS DE RED NOC (Animación de constelación)
    const canvas = document.getElementById('nocCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let w, h, points = [];

        function resize() {
            w = canvas.width = canvas.parentElement.offsetWidth;
            h = canvas.height = canvas.parentElement.offsetHeight;
            points = [];
            const total = Math.min(50, Math.floor(w * h / 12000));
            for (let i = 0; i < total; i++) {
                points.push({
                    x: Math.random() * w, y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5
                });
            }
        }

        function draw() {
            ctx.clearRect(0, 0, w, h);
            for (let i = 0; i < points.length; i++) {
                for (let j = i + 1; j < points.length; j++) {
                    const dx = points[i].x - points[j].x;
                    const dy = points[i].y - points[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        ctx.strokeStyle = `rgba(249, 115, 22, ${0.2 * (1 - dist / 120)})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(points[i].x, points[i].y);
                        ctx.lineTo(points[j].x, points[j].y);
                        ctx.stroke();
                    }
                }
            }
            points.forEach(p => {
                ctx.fillStyle = 'rgba(249, 115, 22, 0.4)';
                ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2); ctx.fill();
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0 || p.x > w) p.vx *= -1;
                if (p.y < 0 || p.y > h) p.vy *= -1;
            });
            requestAnimationFrame(draw);
        }
        resize(); draw(); window.addEventListener('resize', resize);
    }
});

// ============================================================ //
// MOTOR DE INGRESO (CHECK-IN DE TÉCNICOS - FOTO OPCIONAL)      //
// ============================================================ //
window.ejecutarEntradaObligatoria = async () => {
    let fotoInput = document.getElementById("fotoEntradaObligatoria");
    
    // 🛡️ Fallback triple para atrapar el nombre real
    let nombreSeguro = window.nombreUsuarioGlobal || localStorage.getItem('ten_nombre_tecnico') || "";
    
    if (!nombreSeguro) {
        mostrarToast("⚠️ No se pudo identificar tu usuario. Recarga la página.");
        return;
    }

    let btn = document.getElementById("btnMarcarEntrada");
    btn.disabled = true;
    btn.innerText = "⏳ Registrando entrada...";

    try {
        const { addDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        const { getStorage, ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js");
        
        let urlFoto = null;

        if (fotoInput.files.length > 0) {
            btn.innerText = "⏳ Subiendo foto...";
            const archivo = fotoInput.files[0];
            const comprimirFoto = (file) => {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = (event) => {
                        const img = new Image();
                        img.src = event.target.result;
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            let width = img.width; let height = img.height;
                            if (width > 800) { height = Math.round((height * 800) / width); width = 800; }
                            canvas.width = width; canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);
                            canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.6);
                        };
                    };
                });
            };

            let fotoBlob = await comprimirFoto(archivo);
            let storageRef = ref(getStorage(), "evidencias_tecnicas/entrada_" + nombreSeguro + "_" + Date.now() + ".jpg");
            await uploadBytes(storageRef, fotoBlob);
            urlFoto = await getDownloadURL(storageRef);
        }

        btn.innerText = "⏳ Guardando datos...";
        let hoyObj = new Date();
        
        let data = {
            tipoTarea: "biometrico", 
            detalle: "Inicio de Turno",
            cliente: nombreSeguro,
            dir: "Reporte Interno",
            zona: zonaActual || "Norte",
            fecha: hoyObj.getFullYear() + "-" + String(hoyObj.getMonth() + 1).padStart(2, '0') + "-" + String(hoyObj.getDate()).padStart(2, '0'),
            horaInicio: hoyObj.toLocaleTimeString("es-PE", {hour: '2-digit', minute:'2-digit'}),
            tecnicos: [nombreSeguro],
            estado: "atendido", 
            tsFin: Date.now(),
            notaCierre: urlFoto ? "Ingreso de turno validado con foto." : "Ingreso de turno validado en sistema."
        };

        if (urlFoto) {
            data.evidencias = [urlFoto];
        }
        
        await addDoc(coleccionTrabajos, data);

        mostrarToast("✅ ¡Bienvenido! Entrada registrada con éxito.");
        if (window.lanzarConfeti) window.lanzarConfeti();

        // 🔓 CERRAR EL MODAL INMEDIATAMENTE AL REGISTRAR
        let bloqueoModal = document.getElementById("bloqueoAsistencia");
        if (bloqueoModal) {
            bloqueoModal.style.display = "none";
            document.body.style.overflow = "auto";
        }

    } catch (e) {
        console.error(e);
        mostrarToast("❌ Error al registrar entrada. Revisa tu internet.");
        btn.disabled = false;
        btn.innerHTML = "<i class='fa-solid fa-fingerprint'></i> Marcar Entrada Ahora";
    }
};

// ============================================================ //
// 📬 MÓDULO DE BUZÓN INTERNO Y ENVÍO DE DOCUMENTOS             //
// ============================================================ //

// 1. INICIAR EL RADAR DEL BUZÓN (Se activa cuando el usuario entra)
let unsubscribeBuzon = null;
window.iniciarBuzonInterno = async () => {
    const { onSnapshot, query, where } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
    if (unsubscribeBuzon) unsubscribeBuzon();
    
    // El radar solo busca archivos que tengan tu nombre exacto
    let q = query(coleccionBuzon, where("destinatario", "==", window.nombreUsuarioGlobal));
    let primeraCarga = true;

    unsubscribeBuzon = onSnapshot(q, (snapshot) => {
        window.misDocumentosNuevos = [];
        let noLeidos = 0;

        snapshot.forEach(doc => {
            let d = { id: doc.id, ...doc.data() };
            window.misDocumentosNuevos.push(d);
            if (!d.leido) noLeidos++;
        });

        // Ordenamos de más reciente a más antiguo
        window.misDocumentosNuevos.sort((a,b) => b.fechaTs - a.fechaTs);

        // Actualizamos el sobrecito de la barra superior
        let btnBuzon = document.getElementById("btnBuzon");
        if (btnBuzon) {
            if (noLeidos > 0) {
                btnBuzon.innerHTML = `<i class="fa-solid fa-envelope"></i><span style="position:absolute; top:-2px; right:-2px; background:var(--danger); color:white; font-size:9px; border-radius:50%; padding:2px 5px; font-weight:bold; border:2px solid var(--bg-panel); animation: pulse 2s infinite;">${noLeidos}</span>`;
                btnBuzon.style.color = "var(--accent)";
            } else {
                btnBuzon.innerHTML = `<i class="fa-solid fa-envelope"></i>`;
                btnBuzon.style.color = "";
            }
        }

        // ALERTA VISUAL Y VIBRACIÓN (Si llega algo nuevo)
        if (!primeraCarga) {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    // Vibración del celular (2 toques rápidos)
                    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                    if (typeof window.playSonidoUX === 'function') window.playSonidoUX('pop');
                    
                    // Cartel en pantalla sin voz robótica
                    if (typeof window.mostrarAlertaNOC === 'function') {
                        window.mostrarAlertaNOC(
                            "¡Nuevo Documento Oficial!", 
                            `${change.doc.data().remitente} te ha enviado el siguiente archivo:\n\n📄 ${change.doc.data().titulo}\n\nRevisa tu Buzón (Ícono del sobre).`, 
                            "fa-file-invoice", 
                            "#0ea5e9"
                        );
                    }
                }
            });
        }
        primeraCarga = false;
        
        // Si tiene el buzón abierto, se refresca solo
        if (document.getElementById("modalBuzon") && document.getElementById("modalBuzon").style.display === "flex") {
            window.renderizarBuzon();
        }
    });
};

// Se enciende 3 segundos después de entrar para no laggear el login
setTimeout(() => { if(window.nombreUsuarioGlobal) window.iniciarBuzonInterno(); }, 3000);

// 2. FUNCIÓN PARA ABRIR Y PINTAR EL BUZÓN
window.abrirBuzon = () => {
    window.cambiarVistaBuzon('recibidos'); // Siempre abre en la bandeja de entrada por defecto
    
    // 🔥 LÓGICA ESTRICTA: Mostrar las pestañas SÓLO a los Administradores
    let tabsAdmin = document.getElementById("tabsBuzonAdmin");
    if (tabsAdmin) {
        if (isAdmin || isAdminLurin) {
            tabsAdmin.style.display = "flex"; // Se muestra al Jefe
        } else {
            tabsAdmin.style.display = "none"; // Se oculta al Técnico/Ventas
        }
    }

    document.getElementById("modalBuzon").style.display = "flex";
};

window.cambiarVistaBuzon = async (vista) => {
    const btnRecibidos = document.getElementById("tabBuzonRecibidos");
    const btnEnviados = document.getElementById("tabBuzonEnviados");
    const colPersona = document.getElementById("colBuzonPersona");

    if (vista === 'recibidos') {
        if(btnRecibidos) { btnRecibidos.classList.add("active-alta"); btnRecibidos.style.color = "var(--accent)"; btnRecibidos.style.borderColor = "var(--accent)"; }
        if(btnEnviados) { btnEnviados.classList.remove("active-alta"); btnEnviados.style.color = "var(--text-muted)"; btnEnviados.style.borderColor = "transparent"; }
        colPersona.innerText = "De (Remitente)";
        window.renderizarBuzon(); // Llama a la original
    } else {
        if(btnEnviados) { btnEnviados.classList.add("active-alta"); btnEnviados.style.color = "var(--accent)"; btnEnviados.style.borderColor = "var(--accent)"; }
        if(btnRecibidos) { btnRecibidos.classList.remove("active-alta"); btnRecibidos.style.color = "var(--text-muted)"; btnRecibidos.style.borderColor = "transparent"; }
        colPersona.innerText = "Para (Destinatario)";
        
        // Pone la tabla a cargar
        document.getElementById("tablaBuzon").innerHTML = `<tr><td colspan="4" class="text-center py-8"><i class="fa-solid fa-spinner fa-spin text-2xl text-muted"></i><br>Buscando envíos...</td></tr>`;
        
        // Consulta a Firebase buscando lo que TÚ enviaste
        try {
            const { getDocs, query, where } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
            let q = query(coleccionBuzon, where("remitente", "==", window.nombreUsuarioGlobal));
            let snap = await getDocs(q);
            window.misDocumentosEnviados = [];
            snap.forEach(doc => {
                window.misDocumentosEnviados.push({ id: doc.id, ...doc.data() });
            });
            // Ordenamos por fecha internamente para evitar que Firebase pida índices
            window.misDocumentosEnviados.sort((a,b) => b.fechaTs - a.fechaTs);
            window.renderizarBuzonEnviados();
        } catch (e) {
            console.error(e);
            document.getElementById("tablaBuzon").innerHTML = `<tr><td colspan="4" class="text-center text-danger py-8">Error al cargar historial.</td></tr>`;
        }
    }
};

window.renderizarBuzon = () => {
    let tbody = document.getElementById("tablaBuzon");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    if (!window.misDocumentosNuevos || window.misDocumentosNuevos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-8"><i class="fa-solid fa-inbox text-4xl block mb-2 opacity-30"></i> Tu buzón está vacío.</td></tr>`;
        return;
    }

    window.misDocumentosNuevos.forEach(d => {
        let fDate = new Date(d.fechaTs);
        let diaStr = fDate.toLocaleDateString("es-PE", { day: '2-digit', month: 'short' });
        let horaStr = fDate.toLocaleTimeString("es-PE", { hour: '2-digit', minute:'2-digit' });
        
        let bgFila = d.leido ? "" : "background: rgba(0, 229, 255, 0.05); font-weight: bold;";
        let badgeNuevo = d.leido ? "" : `<span style="background: var(--danger); color: white; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 900; margin-left: 5px;">NUEVO</span>`;

        tbody.innerHTML += `
            <tr style="${bgFila} border-bottom: 1px solid var(--border);">
                <td style="padding: 15px 12px; font-size: 11px; color: var(--text-muted);">${diaStr}<br><b style="color: var(--text-main); font-size: 13px;">${horaStr}</b></td>
                <td style="padding: 15px 12px;"><i class="fa-solid fa-user-shield text-accent"></i> ${d.remitente}</td>
                <td style="padding: 15px 12px;"><b style="color: var(--text-main); font-size: 13px; display: block;">${d.titulo}</b>${badgeNuevo}</td>
                <td style="padding: 15px 12px; text-align: center;">
                    <button class="btn-action-ui" style="background: var(--accent); color: white; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: bold; width: 100%; box-shadow: 0 4px 6px rgba(0,229,255,0.2);" onclick="window.descargarDocumento('${d.id}', '${d.url}')">
                        <i class="fa-solid fa-download"></i> Abrir
                    </button>
                </td>
            </tr>
        `;
    });
};

window.renderizarBuzonEnviados = () => {
    let tbody = document.getElementById("tablaBuzon");
    tbody.innerHTML = "";
    
    if (!window.misDocumentosEnviados || window.misDocumentosEnviados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-8"><i class="fa-solid fa-paper-plane text-4xl block mb-2 opacity-30"></i> No has enviado ningún documento aún.</td></tr>`;
        return;
    }

    window.misDocumentosEnviados.forEach(d => {
        let fDate = new Date(d.fechaTs);
        let diaStr = fDate.toLocaleDateString("es-PE", { day: '2-digit', month: 'short' });
        let horaStr = fDate.toLocaleTimeString("es-PE", { hour: '2-digit', minute:'2-digit' });
        
        let statusBadge = d.leido ? `<span style="background: rgba(16, 185, 129, 0.1); color: var(--success); padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold;"><i class="fa-solid fa-check-double"></i> Visto</span>` : `<span style="background: rgba(245, 158, 11, 0.1); color: var(--warning); padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold;"><i class="fa-solid fa-clock"></i> Sin leer</span>`;

        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 15px 12px; font-size: 11px; color: var(--text-muted);">${diaStr}<br><b style="color: var(--text-main); font-size: 13px;">${horaStr}</b></td>
                <td style="padding: 15px 12px;"><i class="fa-solid fa-user text-muted"></i> <b>${d.destinatario}</b><br>${statusBadge}</td>
                <td style="padding: 15px 12px;"><b style="color: var(--text-main); font-size: 13px; display: block;">${d.titulo}</b><span style="font-size: 10px; color: var(--accent);"><i class="fa-solid fa-file"></i> ${d.nombreArchivo || "Archivo"}</span></td>
                <td style="padding: 15px 12px; text-align: center;">
                    <div style="display: flex; gap: 5px; justify-content: center;">
                        <button class="btn-action-ui" style="background: rgba(0, 229, 255, 0.1); color: var(--accent); border: 1px solid var(--accent); cursor: pointer;" onclick="window.open('${d.url}', '_blank')" title="Ver archivo">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        <button class="btn-action-ui" style="background: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid var(--danger); cursor: pointer;" onclick="window.eliminarDocumentoEnviado('${d.id}')" title="Eliminar envío para todos">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
};

window.descargarDocumento = async (id, url) => {
    window.open(url, "_blank"); 
    try {
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        await updateDoc(doc(coleccionBuzon, id), { leido: true }); 
    } catch(e) { console.error(e); }
};

// Abre la ventana bonita en lugar del popup del navegador
window.eliminarDocumentoEnviado = (id) => {
    document.getElementById("idEnvioEliminarOculto").value = id;
    document.getElementById("modalEliminarEnvioBuzon").style.display = "flex";
};

// Ejecuta el borrado cuando el Admin le da a "Sí, Eliminar"
window.ejecutarEliminacionEnvio = async () => {
    let id = document.getElementById("idEnvioEliminarOculto").value;
    if (!id) return;

    let btn = document.getElementById("btnConfirmarEliminarEnvio");
    btn.disabled = true;
    btn.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> Eliminando...";

    try {
        const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        await deleteDoc(doc(coleccionBuzon, id));
        mostrarToast("🗑️ Envío eliminado correctamente.");
        window.cerrarModalGeneral('modalEliminarEnvioBuzon');
        window.cambiarVistaBuzon('enviados'); // Recarga la tabla al instante
    } catch (e) {
        console.error(e);
        mostrarToast("❌ Error al eliminar el documento.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = "<i class='fa-solid fa-trash'></i> Sí, Eliminar";
    }
};

// 3. FUNCIÓN PARA EL ADMIN (ENVIAR)
window.abrirModalEnviarDoc = async () => {
    let select = document.getElementById("docDestinatario");
    select.innerHTML = '<option value="">Cargando usuarios...</option>';
    
    try {
        const { getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        const snap = await getDocs(coleccionUsuarios);
        let options = '<option value="">-- Selecciona a quién enviarlo --</option>';
        let users = [];
        
        // 🔥 FIX: Inyectamos a los Admins manualmente por si no existen como empleados normales
        let adminsFijos = ["RPACOTAIPE", "ADMIN"]; // <- Puedes agregar otros nombres aquí separados por comas
        
        // Traemos a los técnicos y vendedores de Firebase
        snap.forEach(d => {
            let u = d.data();
            if (!u.bloqueado) {
                let nombreUser = u.nombre || u.email.split('@')[0].toUpperCase();
                users.push(nombreUser);
            }
        });

        // Sumamos los admins fijos a la lista si es que no estaban ya incluidos
        adminsFijos.forEach(admin => {
            if (!users.includes(admin)) users.push(admin);
        });

        // Ordenamos todos alfabéticamente
        users.sort().forEach(u => options += `<option value="${u}">${u}</option>`);
        select.innerHTML = options;
    } catch (e) {
        select.innerHTML = '<option value="">Error al cargar usuarios</option>';
    }

    document.getElementById("docTitulo").value = "";
    document.getElementById("docArchivo").value = "";
    document.getElementById("modalEnviarDoc").style.display = "flex";
};
window.ejecutarEnviarDoc = async () => {
    let destinatario = document.getElementById("docDestinatario").value;
    let titulo = document.getElementById("docTitulo").value.trim();
    let fileInput = document.getElementById("docArchivo");

    if (!destinatario) { mostrarToast("⚠️ Selecciona un destinatario."); return; }
    if (!titulo) { mostrarToast("⚠️ Ponle un título al documento."); return; }
    if (fileInput.files.length === 0) { mostrarToast("⚠️ Tienes que adjuntar el archivo."); return; }

    let btn = document.getElementById("btnEnviarDocConfirmar");
    btn.disabled = true;
    btn.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> Subiendo...";

    try {
        const { getStorage, ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js");
        const { addDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        
        let file = fileInput.files[0];
        let storageRef = ref(getStorage(), "documentos_internos/" + Date.now() + "_" + file.name.replace(/[^a-zA-Z0-9.]/g, "_"));
        await uploadBytes(storageRef, file);
        let urlArchivo = await getDownloadURL(storageRef);

        await addDoc(coleccionBuzon, {
            destinatario: destinatario,
            remitente: window.nombreUsuarioGlobal,
            titulo: titulo,
            url: urlArchivo,
            nombreArchivo: file.name,
            fechaTs: Date.now(),
            leido: false
        });

        mostrarToast("✅ Documento enviado con éxito.");
        if(window.lanzarConfeti) window.lanzarConfeti();
        window.cerrarModalGeneral("modalEnviarDoc");
    } catch (e) {
        console.error(e);
        mostrarToast("❌ Error al enviar. Revisa tu conexión a internet.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = "<i class='fa-solid fa-paper-plane'></i> Enviar Archivo";
    }
};

// ============================================================
// 📡 MÓDULO: INVENTARIO DE RED (ESTILO SMART OLT)
// ============================================================

// Interceptar el cambio de vistas original para incluir el OLT
const oldCambiarVistaNOC = window.cambiarVistaNOC;
window.cambiarVistaNOC = (vista) => {
    let vistaPrincipal = document.querySelector(".app-content");
    let vistaOlt = document.getElementById("vistaOlt");
    
    // Reiniciamos colores de botones
    let bOps = document.getElementById("btnTabOperaciones"); if(bOps) bOps.style.background = "transparent";
    let bBajas = document.getElementById("btnTabBajas"); if(bBajas) bBajas.style.background = "transparent";
    let btnOlt = document.getElementById("btnTabOlt"); if(btnOlt) btnOlt.style.background = "transparent";

    if (vista === 'olt') {
        if(vistaPrincipal) vistaPrincipal.style.display = "none";
        if(vistaOlt) vistaOlt.style.display = "block";
        if(btnOlt) btnOlt.style.background = "rgba(139, 92, 246, 0.1)";
        
        window.renderizarInventarioOLT(true); 
    } else {
        if(vistaPrincipal) vistaPrincipal.style.display = "block";
        if(vistaOlt) vistaOlt.style.display = "none";
        if(oldCambiarVistaNOC) oldCambiarVistaNOC(vista); 
    }
};

window.renderizarInventarioOLT = (actualizarFiltros = false) => {
    let searchTxt = document.getElementById("buscadorOlt") ? document.getElementById("buscadorOlt").value.toLowerCase().trim() : "";
    let zonaFilter = document.getElementById("filtroZonaOlt") ? document.getElementById("filtroZonaOlt").value : "todos";
    let totalCajas = 0; let totalPuertos = 0; let totalUsados = 0;

    // Reiniciamos la memoria para que siempre calcule en vivo la realidad de los técnicos
    window.cajasNapProcesadas = {};
    window.zonasSetOLT = new Set();

    if (typeof dbTrabajos !== 'undefined') {
        // 1. Filtramos ESTRICTAMENTE las "Limpiezas de caja" que ya fueron ATENDIDAS
        let limpiezas = dbTrabajos.filter(t => t.tipoTarea === "otros" && t.detalle === "Limpieza de caja" && t.estado === "atendido");
        
        // 2. Ordenamos de más antigua a más reciente para que el último reporte sobrescriba los anteriores
        limpiezas.sort((a, b) => (a.tsFin || 0) - (b.tsFin || 0));

        limpiezas.forEach(t => {
            let nombreCaja = String(t.caja || "").toUpperCase().trim();
            let zonaCli = String(t.zona || "Desconocida").toUpperCase().trim();
            
            if (nombreCaja && nombreCaja !== "UNDEFINED" && nombreCaja !== "" && nombreCaja !== "NULL" && nombreCaja !== "0") {
                window.zonasSetOLT.add(zonaCli);
                
                let cap = parseInt(t.cantPuertos) || 8;
                let ocupados = 0;
                
                // Contar cuántos puertos marcó el técnico con nombre o DNI en su reporte
                if (t.puertosData && Array.isArray(t.puertosData)) {
                    t.puertosData.forEach(p => { 
                        if (p.nombre || p.idDni) ocupados++; 
                    });
                }

                // Guardamos la caja en el inventario con los datos puros del técnico
                window.cajasNapProcesadas[nombreCaja] = { 
                    onus: ocupados, 
                    capacidad: cap, 
                    zona: zonaCli, 
                    mapa: t.mapa || t.linkCaja || "" 
                };
            }
        });
    }

    // Actualizar el filtro de Zonas
    if (actualizarFiltros) {
        let selZona = document.getElementById("filtroZonaOlt");
        if (selZona) {
            selZona.innerHTML = '<option value="todos">Any</option>';
            [...window.zonasSetOLT].sort().forEach(z => selZona.innerHTML += `<option value="${z}">${z}</option>`);
        }
    }

    let tbody = document.getElementById("tablaOlt");
    if (!tbody) return;
    let html = "";

    let sortedCajas = Object.keys(window.cajasNapProcesadas).sort();
    
    // Si no hay ninguna caja auditada por los técnicos
    if (sortedCajas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-8"><i class="fa-solid fa-broom text-3xl mb-2 opacity-50 block"></i> Aún no hay Cajas NAP auditadas y finalizadas por los técnicos.</td></tr>`;
        if(document.getElementById("kpiOltCajas")) document.getElementById("kpiOltCajas").innerText = "0";
        if(document.getElementById("kpiOltPuertos")) document.getElementById("kpiOltPuertos").innerText = "0";
        if(document.getElementById("kpiOltUsados")) document.getElementById("kpiOltUsados").innerText = "0";
        if(document.getElementById("kpiOltLibres")) document.getElementById("kpiOltLibres").innerText = "0";
        if(document.getElementById("kpiOltPctUsado")) document.getElementById("kpiOltPctUsado").innerText = "0%";
        if(document.getElementById("kpiOltPctLibre")) document.getElementById("kpiOltPctLibre").innerText = "0%";
        return;
    }

    // Dibujar la tabla
    sortedCajas.forEach(nombre => {
        let data = window.cajasNapProcesadas[nombre];
        
        if (zonaFilter !== "todos" && data.zona !== zonaFilter) return;
        if (searchTxt !== "" && !nombre.toLowerCase().includes(searchTxt)) return;

        totalCajas++;
        let capacity = data.capacidad; 
        totalPuertos += capacity;
        totalUsados += data.onus;

        let pct = Math.round((data.onus / capacity) * 100);
        let barColor = pct < 75 ? "olt-bar-green" : (pct <= 100 ? "olt-bar-orange" : "olt-bar-red");
        let textAlert = pct > 100 ? `<span class="olt-alert-text"><i class="fa-solid fa-triangle-exclamation"></i> Excedida</span>` : "";
        let pctWidth = pct > 100 ? 100 : pct;
        
        let linkMapa = data.mapa && data.mapa.includes("http") ? `<a href="${data.mapa}" target="_blank" style="color: #3b82f6; font-size: 1.4rem;"><i class="fa-solid fa-location-dot"></i></a>` : `<i class="fa-solid fa-location-dot" style="color: var(--border); font-size: 1.4rem;"></i>`;

        html += `
        <tr style="border-bottom: 1px solid var(--border); background: var(--bg-app); transition: background 0.2s;" onmouseover="this.style.background='var(--bg-panel)'" onmouseout="this.style.background='var(--bg-app)'">
            <td style="padding: 18px 15px;"><i class="fa-solid fa-share-nodes text-info" style="margin-right: 10px; font-size: 1.2rem;"></i> <b style="color: var(--text-main); font-size: 15px;">${nombre}</b></td>
            <td style="text-align:center; padding: 18px 15px;">${linkMapa}</td>
            <td style="text-align:center; padding: 18px 15px;"><b style="color: #3b82f6; font-size: 18px;">${data.onus}</b></td>
            <td style="text-align:center; font-size: 14px; color: var(--text-muted); font-weight: bold; padding: 18px 15px;">1:${capacity}</td>
            <td style="padding: 18px 25px 18px 15px;">
                <div style="font-size: 13px; font-weight: bold; color: var(--text-main); display:flex; justify-content:space-between; margin-bottom: 8px;">
                    <span>${data.onus} / ${capacity} <span style="font-weight:normal; margin-left:5px; color: var(--text-muted);">${pct}%</span></span>
                    ${textAlert}
                </div>
                <div class="olt-progress-bg" style="height: 8px; background: rgba(0,0,0,0.1);">
                    <div class="olt-progress-bar ${barColor}" style="width: ${pctWidth}%; box-shadow: 0 0 6px ${barColor.includes('green') ? '#10b981' : barColor.includes('orange') ? '#f59e0b' : '#ef4444'};"></div>
                </div>
            </td>
            <td style="font-size: 13px; color: var(--text-muted); font-weight: bold; padding: 18px 15px; text-transform: uppercase;">${data.zona}</td>
            <td style="text-align:center; padding: 18px 15px;">
                <button class="btn-action-ui" style="background: rgba(139, 92, 246, 0.1); color: var(--purple); border: 1px solid var(--purple); padding: 8px 15px; font-size: 13px; font-weight: bold; width: 100%; box-shadow: 0 2px 4px rgba(139, 92, 246, 0.2);" title="Ver Auditoría y Foto" onclick="document.getElementById('txtBuscarCajaNAP').value='${nombre.replace(/'/g, "\\'")}'; window.buscarStatusCajaNAP(); document.getElementById('modalCajasNAP').style.display='flex';"><i class="fa-solid fa-camera"></i> Ver Foto</button>
            </td>
        </tr>`;
    });

    tbody.innerHTML = html !== "" ? html : `<tr><td colspan="7" class="text-center text-muted py-4">No match found.</td></tr>`;

    // Actualizar KPIs matemáticos
    if(document.getElementById("kpiOltCajas")) document.getElementById("kpiOltCajas").innerText = totalCajas;
    if(document.getElementById("kpiOltPuertos")) document.getElementById("kpiOltPuertos").innerText = totalPuertos.toLocaleString();
    if(document.getElementById("kpiOltUsados")) document.getElementById("kpiOltUsados").innerText = totalUsados.toLocaleString();
    
    let totalLibres = totalPuertos - totalUsados;
    if(document.getElementById("kpiOltLibres")) document.getElementById("kpiOltLibres").innerText = totalLibres < 0 ? 0 : totalLibres.toLocaleString();

    let pctUso = totalPuertos > 0 ? Math.round((totalUsados / totalPuertos) * 100) : 0;
    let pctLibre = totalPuertos > 0 ? Math.round((totalLibres / totalPuertos) * 100) : 0;
    
    if(document.getElementById("kpiOltPctUsado")) document.getElementById("kpiOltPctUsado").innerText = pctUso + "%";
    if(document.getElementById("kpiOltPctLibre")) document.getElementById("kpiOltPctLibre").innerText = (pctLibre < 0 ? 0 : pctLibre) + "%";
};

// ==========================================
// EXPORTAR INVENTARIO OLT A EXCEL (ACTUALIZADO)
// ==========================================
window.exportarOLTAExcel = () => {
    let tbody = document.getElementById("tablaOlt");
    if (!tbody || tbody.innerHTML.includes("Calculando") || tbody.innerHTML.includes("No se encontraron")) {
        mostrarToast("⚠️ No hay datos en la tabla para exportar.");
        return;
    }

    mostrarToast("⏳ Generando reporte Excel del Inventario...");

    let dataExportar = [];
    let filas = tbody.querySelectorAll("tr");

    filas.forEach(tr => {
        let tds = tr.querySelectorAll("td");
        if(tds.length >= 7) {
            // Limpiamos los textos (quitamos basura HTML y saltos de línea)
            let mufaRaw = tds[0].innerText.trim();
            let mufaLimpia = mufaRaw.includes("Asignar") ? "NO ASIGNADA" : mufaRaw;
            let caja = tds[1].innerText.trim();
            let ocupados = tds[3].innerText.trim();
            let capacidad = tds[4].innerText.trim().replace("1:", "");
            let zona = tds[6].innerText.trim();
            
            // Calculamos el porcentaje limpio
            let numOcupados = parseInt(ocupados) || 0;
            let numCapacidad = parseInt(capacidad) || 16;
            let porcentaje = numCapacidad > 0 ? Math.round((numOcupados / numCapacidad) * 100) : 0;

            dataExportar.push({
                "MUFA MATRIZ": mufaLimpia,
                "CAJA NAP": caja,
                "ZONA": zona,
                "PUERTOS OCUPADOS": numOcupados,
                "CAPACIDAD TOTAL": numCapacidad,
                "PUERTOS LIBRES": numCapacidad - numOcupados,
                "% SATURACIÓN": `${porcentaje}%`
            });
        }
    });

    if (dataExportar.length === 0) return;

    // Generamos el archivo usando la librería XLSX
    const ws = XLSX.utils.json_to_sheet(dataExportar);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario_Red_FTTH");
    
    let hoy = new Date().toLocaleDateString('es-PE').replace(/\//g, '-');
    XLSX.writeFile(wb, `Reporte_Inventario_OLT_${hoy}.xlsx`);
    
    mostrarToast("✅ Excel descargado correctamente.");
};

// ==========================================
// 📸 LÓGICA DE FOTO DE FACHADA (LIMPIEZA Y VISUALIZACIÓN)
// ==========================================
window.limpiarFotoFachada = () => {
    let input = document.getElementById("formFotosFachada");
    if (input) input.value = ""; 
    
    // Le avisamos al sistema que queremos borrar la foto vieja
    let hideInput = document.getElementById("formFotoFachadaExistente");
    if (hideInput) hideInput.value = "BORRAR"; 
    
    let contenedor = document.getElementById("lblFachadaContenedor");
    if (contenedor) contenedor.style.display = "none"; 
};

window.mostrarNombreArchivoFachada = (input) => {
    let contenedor = document.getElementById("lblFachadaContenedor");
    let texto = document.getElementById("lblFachadaTxt");
    if (input.files && input.files.length > 0) {
        if (contenedor) contenedor.style.display = "flex";
        // Mostramos el nombre real de la foto que subió
        if (texto) texto.innerText = "✅ " + input.files[0].name;
    } else {
        if (contenedor) contenedor.style.display = "none";
    }
};

// ============================================================ //
// 📍 RADAR WEB: RASTREO GPS EN SEGUNDO PLANO (MODO TÉCNICO)    //
// ============================================================ //
window.iniciarRastreoGPS = async (email, nombre) => {
    // Verificamos que el celular/navegador tenga soporte para GPS
    if (!navigator.geolocation) {
        console.warn("Geolocalización no soportada por este dispositivo.");
        return;
    }

    const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
    
    const enviarUbicacionSilenciosa = () => {
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    let dataGPS = {
                        nombre: nombre,
                        email: email,
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        ultima_actualizacion: new Date().toLocaleString("es-PE"), // Fecha y hora exactas locales
                        timestamp: Date.now()
                    };
                    
                    // Guardamos/Sobrescribimos su ubicación en una nueva colección del radar
                    const refRadar = doc(db, "artifacts", appId, "public", "data", "radar_tecnicos", email);
                    await setDoc(refRadar, dataGPS);
                    
                    console.log(`📍 Radar: Ubicación de ${nombre} enviada en silencio a Firebase.`);
                } catch (e) {
                    console.error("Error en el radar GPS al guardar en Firebase:", e);
                }
            },
            (err) => { 
                console.warn("Radar pausado: El técnico denegó el GPS o la pantalla se apagó.", err); 
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 } // Máxima precisión
        );
    };

    // 1. Enviamos el primer chispazo 5 segundos después de iniciar sesión para no saturar la carga inicial
    setTimeout(enviarUbicacionSilenciosa, 5000);

    // 2. Dejamos un bucle programado para que dispare cada 3 minutos (180,000 milisegundos)
    setInterval(enviarUbicacionSilenciosa, 180000);
};

// ==========================================
// RENDERIZAR TABLA OLT (KARDEX DE CAJAS NAP)
// ==========================================
window.renderizarInventarioOLT = (esPrimeraCarga = false) => {
    let tbody = document.getElementById("tablaOlt");
    if (!tbody) return;

    let filtroMufa = document.getElementById("filtroMufaOlt")?.value || "todos";
    let filtroZona = document.getElementById("filtroZonaOlt")?.value || "todos";
    let txtBuscar = document.getElementById("buscadorOlt")?.value.toLowerCase().trim() || "";

    let cajasMap = {};
    let mufasList = new Set();
    let zonasList = new Set(); // 🔥 NUEVO: Recolector de Zonas Exactas
    let mapPuertosOcupados = {}; 
    let capCajas = {}; 
    let cajaTsAuditoria = {}; 
    let zonaActiva = localStorage.getItem("ten_zona_activa") || "norte";

    // 1. EL ÚNICO CREADOR DE CAJAS: Las Auditorías Oficiales y Ediciones Manuales
    let auditorias = dbTrabajos.filter(t => t.tipoTarea === "otros" && t.detalle === "Limpieza de caja" && t.estado === "atendido");
    auditorias.sort((a, b) => (a.tsFin || 0) - (b.tsFin || 0));
    
    auditorias.forEach(aud => {
        if ((aud.zona || "norte").toLowerCase() !== zonaActiva.toLowerCase()) return;
        
        let nombreCaja = String(aud.caja).toUpperCase().trim();
        if (!nombreCaja || nombreCaja === "-" || nombreCaja === "N/A" || nombreCaja === "00" || nombreCaja === "0") return; 
        
        capCajas[nombreCaja] = parseInt(aud.cantPuertos) || 16;
        mapPuertosOcupados[nombreCaja] = {}; 
        cajaTsAuditoria[nombreCaja] = aud.tsFin || 0; 
        
        // 🔥 Extraemos la Zona Exacta (subZona) en lugar de la macro-zona
        let zonaExacta = (aud.subZona && aud.subZona !== "OTRO") ? aud.subZona : (aud.zona || "Norte");

        // Creamos la caja oficial
        cajasMap[nombreCaja] = {
            nombre: nombreCaja,
            mapa: aud.linkCaja || aud.mapa || "",
            mufa: aud.mufaMatriz || "-",
            zona: zonaExacta
        };

        if (aud.puertosData && Array.isArray(aud.puertosData)) {
            aud.puertosData.forEach(p => {
                if (p.nombre || p.idDni) mapPuertosOcupados[nombreCaja][p.puerto] = true;
            });
        }
    });

    // 2. LLENADO DE PUERTOS (Solo cuenta instalaciones ATENDIDAS en cajas QUE YA EXISTEN)
    dbTrabajos.forEach(t => {
        if ((t.zona || "norte").toLowerCase() !== zonaActiva.toLowerCase()) return; 

        let nombreCaja = String(t.caja || "").toUpperCase().trim();
        // 🔥 REGLA DE ORO: Si la caja NO ESTÁ en el mapa oficial de auditorías, SE IGNORA LA BASURA.
        if (!cajasMap[nombreCaja]) return; 

        let tipo = String(t.tipoTarea || "").toLowerCase();
        let detalle = String(t.detalle || "");
        let estado = String(t.estado || "").toLowerCase();
        
        let esAlta = (tipo === "alta");
        let esTraslado = (tipo === "averia" && detalle.includes("Traslado"));
        let tsTicket = t.tsFin || t.tsCreacion || 0;

        // 🔥 Solo ocupa puerto si la instalación ESTÁ TERMINADA (Atendida)
        if ((esAlta || esTraslado) && estado === "atendido") {
            if (tsTicket > cajaTsAuditoria[nombreCaja]) {
                let p = parseInt(t.puerto);
                if (!isNaN(p) && p > 0) {
                     if (!mapPuertosOcupados[nombreCaja]) mapPuertosOcupados[nombreCaja] = {};
                     mapPuertosOcupados[nombreCaja][p] = true;
                     if (p > capCajas[nombreCaja]) capCajas[nombreCaja] = p; 
                }
                
                // Actualizamos mapa si hay uno mejor (y validamos que no sea una foto)
                let mapCandidato = t.linkCaja || t.mapa || "";
                if (!cajasMap[nombreCaja].mapa && mapCandidato && !mapCandidato.includes("firebasestorage")) {
                    cajasMap[nombreCaja].mapa = mapCandidato;
                }
                
                if (cajasMap[nombreCaja].mufa === "-" && t.mufaMatriz) cajasMap[nombreCaja].mufa = t.mufaMatriz;
                
                // 🔥 Actualizamos la zona de la caja si el ticket de alta trae una más exacta
                let zonaExactaAlta = (t.subZona && t.subZona !== "OTRO") ? t.subZona : t.zona;
                if (zonaExactaAlta && (cajasMap[nombreCaja].zona === "Norte" || cajasMap[nombreCaja].zona === "Lurin")) {
                    cajasMap[nombreCaja].zona = zonaExactaAlta;
                }
            }
        }
    });
    
    // 3. RECOLECTAR MUFAS Y ZONAS PARA LOS FILTROS
    Object.values(cajasMap).forEach(c => {
        if (c.mufa !== "-") mufasList.add(c.mufa);
        if (c.zona) zonasList.add(c.zona);
    });

    if (esPrimeraCarga) {
        let selectMufa = document.getElementById("filtroMufaOlt");
        if (selectMufa) {
            let options = '<option value="todos">Todas las Mufas</option>';
            [...mufasList].sort().forEach(m => options += `<option value="${m}">${m}</option>`);
            selectMufa.innerHTML = options;
        }
        
        // 🔥 Inyectamos las Zonas Exactas en el selector
        let selectZona = document.getElementById("filtroZonaOlt");
        if (selectZona) {
            let optionsZ = '<option value="todos">Todas las Zonas</option>';
            [...zonasList].sort().forEach(z => optionsZ += `<option value="${z}">${z}</option>`);
            selectZona.innerHTML = optionsZ;
        }
    }

    let arrCajas = Object.values(cajasMap);
    let totalCajas = 0; let totalPuertos = 0; let totalOcupados = 0;
    let html = "";
    
    arrCajas.sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach(c => {
        if (filtroMufa !== "todos" && c.mufa !== filtroMufa) return;
        if (filtroZona !== "todos" && c.zona !== filtroZona) return;
        if (txtBuscar !== "" && !c.nombre.toLowerCase().includes(txtBuscar)) return;
        
        let ocupados = mapPuertosOcupados[c.nombre] ? Object.keys(mapPuertosOcupados[c.nombre]).length : 0;
        let capacidad = capCajas[c.nombre];
        let saturacion = capacidad > 0 ? Math.round((ocupados / capacidad) * 100) : 0;

        totalCajas++; totalPuertos += capacidad; totalOcupados += ocupados;

        let colorBarra = saturacion >= 80 ? "var(--danger)" : saturacion >= 50 ? "var(--warning)" : "var(--success)";
        let alertaSaturacion = saturacion >= 90 ? `<i class="fa-solid fa-triangle-exclamation" style="color: var(--danger); margin-left:5px;" title="Caja Saturada"></i>` : "";
        let mufaDisplay = c.mufa !== "-" ? `<b style="color:var(--purple);"><i class="fa-solid fa-code-merge"></i> ${c.mufa}</b>` : `<button class="btn-action-ui" style="background: rgba(0,0,0,0.05); color: var(--text-muted); border: 1px solid var(--border); padding: 4px 8px; font-size: 10px;" onclick="window.asignarMufa('${c.nombre}')"><i class="fa-solid fa-plus"></i> Asignar</button>`;

        // 🔥 ESCUDO ANTI-FOTOS: Si el enlace parece una foto de Firebase, lo ignoramos
        let mapLinkSeguro = c.mapa;
        if (mapLinkSeguro && mapLinkSeguro.includes("firebasestorage")) mapLinkSeguro = "";

        html += `
            <tr style="border-bottom: 1px solid var(--border); transition: 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.02)'" onmouseout="this.style.background='transparent'">
                <td style="padding: 16px;">${mufaDisplay}</td>
                <td style="padding: 16px;"><b style="font-size: 13px; color: var(--text-main);"><i class="fa-solid fa-share-nodes"></i> ${c.nombre}</b>${alertaSaturacion}</td>
                <td style="padding: 16px; text-align: center;">${mapLinkSeguro ? `<a href="${mapLinkSeguro}" target="_blank" style="color: var(--accent); font-size: 16px;" title="Ver Mapa"><i class="fa-solid fa-location-dot"></i></a>` : '-'}</td>
                <td style="padding: 16px; text-align: center;"><span style="font-weight: 900; color: ${colorBarra}; border: 1px solid ${colorBarra}; padding: 2px 8px; border-radius: 4px;">${ocupados}</span></td>
                <td style="padding: 16px; text-align: center; color: var(--text-muted);">1:${capacidad}</td>
                <td style="padding: 16px;">
                    <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin-bottom: 4px;">
                        <span style="color: var(--text-main);">${ocupados} / ${capacidad}</span>
                        <span style="color: ${colorBarra};">${saturacion}%</span>
                    </div>
                    <div style="width: 100%; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden;">
                        <div style="width: ${saturacion}%; height: 100%; background: ${colorBarra}; transition: width 0.5s;"></div>
                    </div>
                </td>
                <td style="padding: 16px; font-size: 12px; font-weight: bold; color: var(--text-muted); text-transform: uppercase;">${c.zona}</td>
                <td style="padding: 16px; text-align: center;">
                    <button class="btn-action-ui" style="background: rgba(0, 229, 255, 0.1); color: var(--accent); border: 1px solid var(--accent); padding: 4px 10px; font-size: 11px;" onclick="document.getElementById('txtBuscarCajaNAP').value='${c.nombre}'; window.abrirModalGeneral('modalCajasNAP'); window.filtrarChipsNAP(); window.buscarStatusCajaNAP();">
                        <i class="fa-solid fa-magnifying-glass"></i> Auditoría
                    </button>
                </td>
            </tr>
        `;
    });

    if (totalCajas === 0) {
        html = `<tr><td colspan="8" class="text-center text-muted py-8"><i class="fa-solid fa-network-wired text-3xl mb-2 block opacity-50"></i>No se encontraron cajas.</td></tr>`;
    }
    tbody.innerHTML = html;

    let totalLibres = totalPuertos - totalOcupados;
    let pctUsado = totalPuertos > 0 ? Math.round((totalOcupados / totalPuertos) * 100) : 0;
    let pctLibre = totalPuertos > 0 ? 100 - pctUsado : 0;

    let elCajas = document.getElementById("kpiOltCajas"); if(elCajas) elCajas.innerText = totalCajas;
    let elPuertos = document.getElementById("kpiOltPuertos"); if(elPuertos) elPuertos.innerText = totalPuertos;
    let elUsados = document.getElementById("kpiOltUsados"); if(elUsados) elUsados.innerText = totalOcupados;
    let elLibres = document.getElementById("kpiOltLibres"); if(elLibres) elLibres.innerText = totalLibres;
    let elPctUsado = document.getElementById("kpiOltPctUsado"); if(elPctUsado) elPctUsado.innerText = pctUsado + "%";
    let elPctLibre = document.getElementById("kpiOltPctLibre"); if(elPctLibre) elPctLibre.innerText = pctLibre + "%";
};

// ============================================================ //
// MOTOR DE CIERRE EXPRESS ADMIN (SIN SLA NI FOTOS)             //
// ============================================================ //

window.abrirCierreForzadoAdmin = (id) => {
    document.getElementById("idCierreRapidoAdmin").value = id;
    document.getElementById("txtNotaCierreAdmin").value = "";
    document.getElementById("modalCierreRapidoAdmin").style.display = "flex";
    setTimeout(() => document.getElementById("txtNotaCierreAdmin").focus(), 100);
};

window.confirmarCierreRapidoAdmin = async () => {
    let id = document.getElementById("idCierreRapidoAdmin").value;
    let nota = document.getElementById("txtNotaCierreAdmin").value.trim();
    
    if (!nota) {
        if(typeof window.sacudirModal === 'function') window.sacudirModal('modalCierreRapidoAdmin');
        mostrarToast("⚠️ OBLIGATORIO: Debes escribir una observación para justificar este cierre forzado.");
        document.getElementById("txtNotaCierreAdmin").focus();
        return;
    }

    let btn = document.querySelector("#modalCierreRapidoAdmin .btn-guardar");
    btn.disabled = true;
    btn.innerHTML = "⏳ Cerrando...";

    try {
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        
        // Cerramos el ticket inyectando el estado final y un texto especial para auditoría
        await updateDoc(doc(coleccionTrabajos, id), {
            estado: "atendido",
            tsFin: Date.now(),
            notaCierre: `[CIERRE EXPRESS ADMIN] ${nota}`,
            // Llenamos el arreglo de evidencias con algo vacío para que no tire error en otras pantallas
            evidencias: [] 
        });

        window.cerrarModalGeneral('modalCierreRapidoAdmin');
        mostrarToast("✅ Orden cerrada forzosamente con éxito.");
        if (typeof window.lanzarConfeti === 'function') window.lanzarConfeti();
        
    } catch (e) {
        console.error(e);
        mostrarToast("❌ Error al forzar el cierre. Revisa tu internet.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-check-double"></i> Forzar Cierre`;
        }
    }
};
// ==========================================
// TOPOLOGÍA: MAPEO DE CAJAS NAP A MUFAS
// ==========================================
const nombreDocMufas = zonaSede === "lurin" ? "mapeo_mufas_lurin" : "mapeo_cajas_mufas";
const docMapeoMufas = doc(db, "artifacts", appId, "public", "data", "sistema", nombreDocMufas);

window.diccionarioMufas = {};

onSnapshot(docMapeoMufas, (docSnap) => {
    if (docSnap.exists()) {
        window.diccionarioMufas = docSnap.data();
    } else {
        import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js").then(({ setDoc }) => {
            setDoc(docMapeoMufas, {});
        });
    }
    if (window.vistaActivaNOC === 'olt' && typeof window.renderizarInventarioOLT === 'function') {
        window.renderizarInventarioOLT();
    }
});

window.abrirModalAsignarMufa = (nombreCaja) => {
    document.getElementById("hiddenNombreCajaParaMufa").value = nombreCaja;
    document.getElementById("lblCajaAsignarMufa").innerText = nombreCaja;
    document.getElementById("txtNombreMufaMatriz").value = window.diccionarioMufas[nombreCaja] || "";
    document.getElementById("modalAsignarMufa").style.display = "flex";
    setTimeout(() => document.getElementById("txtNombreMufaMatriz").focus(), 100);
};

window.guardarMapeoMufa = async () => {
    let caja = document.getElementById("hiddenNombreCajaParaMufa").value;
    let mufa = document.getElementById("txtNombreMufaMatriz").value.trim().toUpperCase();
    let btn = document.querySelector("#modalAsignarMufa .btn-guardar");
    
    btn.disabled = true;
    btn.innerHTML = "⏳ Guardando...";
    
    try {
        const { setDoc, deleteField } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        
        let dataUpdate = {};
        
        if (mufa === "") {
            dataUpdate[caja] = deleteField();
            delete window.diccionarioMufas[caja]; 
        } else {
            dataUpdate[caja] = mufa;
            window.diccionarioMufas[caja] = mufa; 
        }

        await setDoc(docMapeoMufas, dataUpdate, { merge: true });
        
        if (typeof window.renderizarInventarioOLT === 'function') {
            window.renderizarInventarioOLT();
        }
        
        mostrarToast("✅ Registro actualizado exitosamente.");
        window.cerrarModalGeneral("modalAsignarMufa");
    } catch (e) {
        console.error(e);
        mostrarToast("❌ Error al guardar.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-link"></i> Vincular Caja`;
    }
};

// ============================================================ //
// ⏱️ MOTOR SLA EN VIVO (ACTUALIZA LOS TIEMPOS CADA SEGUNDO)    //
// ============================================================ //
if (window.intervaloRelojSLA) clearInterval(window.intervaloRelojSLA);

window.intervaloRelojSLA = setInterval(() => {
    document.querySelectorAll('.sla-live-timer').forEach(el => {
        let estado = el.getAttribute('data-estado');
        let tIni = parseInt(el.getAttribute('data-ts-inicio'));
        let tLleg = parseInt(el.getAttribute('data-ts-llegada'));
        let ahora = Date.now();
        
        let formatoSLA = (ms) => {
            let totalSeg = Math.floor(ms / 1000);
            let hrs = Math.floor(totalSeg / 3600);
            let min = Math.floor((totalSeg % 3600) / 60);
            let seg = totalSeg % 60;
            let segStr = seg < 10 ? '0' + seg : seg;
            return hrs > 0 ? `${hrs}h ${min}m ${segStr}s` : `${min}m ${segStr}s`;
        };

        // 🌡️ MÚDULO NUEVO: Dibuja la barra de progreso
        let dibujarBarra = (ms, limite) => {
            let porcentaje = Math.min((ms / limite) * 100, 100);
            let colorBarra = porcentaje < 50 ? "var(--success)" : (porcentaje < 85 ? "var(--warning)" : "var(--danger)");
            let sombra = porcentaje >= 100 ? `box-shadow: 0 0 8px var(--danger);` : ``;
            
            return `<div style="width: 100%; height: 4px; background: rgba(0,0,0,0.08); border-radius: 2px; margin-top: 6px; overflow: hidden;">
                        <div style="width: ${porcentaje}%; height: 100%; background: ${colorBarra}; transition: width 1s linear; ${sombra}"></div>
                    </div>`;
        };

        if (estado === "en_camino" && tIni) {
            let msViaje = ahora - tIni;
            let color = msViaje >= 1800000 ? "var(--danger)" : "var(--warning)";
            let icono = msViaje >= 1800000 ? "fa-triangle-exclamation fa-beat" : "fa-person-walking-arrow-right";
            
            // Límite de viaje: 30 minutos (1800000 milisegundos)
            let htmlBarra = dibujarBarra(msViaje, 1800000);
            
            el.innerHTML = `<div style="display:flex; flex-direction:column;"><b style="color: ${color};"><i class="fa-solid ${icono}"></i> Viajando: ${formatoSLA(msViaje)}</b>${htmlBarra}</div>`;
        
        } else if (estado === "en_proceso" && tLleg) {
            let msViajeCongelado = tLleg - tIni;
            let hrsV = Math.floor(msViajeCongelado / 3600000);
            let minV = Math.floor((msViajeCongelado % 3600000) / 60000);
            let textoViaje = hrsV > 0 ? `${hrsV}h ${minV}m` : `${minV}m`;

            let msTrabajo = ahora - tLleg;
            let color = msTrabajo >= 3600000 ? "var(--danger)" : "var(--purple)";
            let icono = msTrabajo >= 3600000 ? "fa-triangle-exclamation fa-beat" : "fa-screwdriver-wrench fa-fade";
            
            // Límite de trabajo: 60 minutos (3600000 milisegundos)
            let htmlBarra = dibujarBarra(msTrabajo, 3600000);
            
            el.innerHTML = `<div style="display:flex; flex-direction:column;"><b>🚗 Viaje: ${textoViaje} | <span style="color: ${color};"><i class="fa-solid ${icono}"></i> Trabajando: ${formatoSLA(msTrabajo)}</span></b>${htmlBarra}</div>`;
        }
    });
}, 1000);

// ============================================================ //
// 🔔 ALERTA DE PESTAÑA EN SEGUNDO PLANO (NUEVOS TICKETS)       //
// ============================================================ //
window.isTabHidden = false;
window.alertaPestanaInterval = null;
window.originalTitle = document.title || "TEN NOC";

// Detecta si el operador minimizó o cambió de pestaña
document.addEventListener("visibilitychange", () => {
    window.isTabHidden = document.hidden;
    if (!document.hidden) {
        // El usuario volvió al sistema, detenemos la alerta y restauramos el nombre
        if (window.alertaPestanaInterval) {
            clearInterval(window.alertaPestanaInterval);
            window.alertaPestanaInterval = null;
        }
        document.title = window.originalTitle;
    }
});

// Función que dispara el parpadeo de texto en la pestaña superior
window.activarAlertaPestana = () => {
    if (window.isTabHidden && !window.alertaPestanaInterval) {
        let showAlert = true;
        window.alertaPestanaInterval = setInterval(() => {
            document.title = showAlert ? "(1) 🚨 NUEVO TICKET" : window.originalTitle;
            showAlert = !showAlert;
        }, 1000); // Cambia el texto cada 1 segundo
    }
};

// ============================================================ //
// 🌊 EFECTO ONDA DE AGUA (MATERIAL RIPPLE) PARA LOS BOTONES    //
// ============================================================ //
if (!document.getElementById("styleRippleEffect")) {
    const style = document.createElement("style");
    style.id = "styleRippleEffect";
    style.innerHTML = `
    .btn-ripple-ready {
        position: relative;
        overflow: hidden !important;
    }
    .ripple-span {
        position: absolute;
        border-radius: 50%;
        transform: scale(0);
        animation: ripple-anim 0.6s ease-out;
        pointer-events: none;
        z-index: 9999;
    }
    @keyframes ripple-anim {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }`;
    document.head.appendChild(style);
}

document.addEventListener("mousedown", function(e) {
    // Seleccionamos inteligentemente los botones de acción sin afectar íconos sueltos
    let btn = e.target.closest(".btn-action-ui, .btn-guardar, .btn-primary, .btn-danger, .btn-success, .btn-warning, .tab-btn");
    
    // Si no hizo clic en un botón válido, o si es la campanita (para que no se corte el globo rojo), ignoramos
    if (!btn || btn.id === "btn-notificaciones") return;

    if (!btn.classList.contains("btn-ripple-ready")) {
        btn.classList.add("btn-ripple-ready");
    }
    
    let rect = btn.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    
    let ripple = document.createElement("span");
    ripple.className = "ripple-span";
    
    let diameter = Math.max(btn.clientWidth, btn.clientHeight);
    ripple.style.width = ripple.style.height = diameter + "px";
    ripple.style.left = (x - diameter / 2) + "px";
    ripple.style.top = (y - diameter / 2) + "px";
    
    // Color inteligente: Onda blanca para botones de color, onda gris oscura para botones transparentes
    let bg = window.getComputedStyle(btn).backgroundColor;
    if (bg === "rgba(0, 0, 0, 0)" || bg === "transparent" || bg === "rgb(255, 255, 255)") {
        ripple.style.backgroundColor = "rgba(0, 0, 0, 0.15)";
    } else {
        ripple.style.backgroundColor = "rgba(255, 255, 255, 0.4)";
    }
    
    btn.appendChild(ripple);
    
    // La onda desaparece sola cuando termina la animación
    setTimeout(() => {
        ripple.remove();
    }, 600);
});

// ============================================================ //
// 📷 MOTOR PARA CAMBIAR FOTO DE PERFIL (ANTI-ERRORES)          //
// ============================================================ //
window.cambiarFotoPerfil = async () => {
    let emailActivo = localStorage.getItem('ten_email');
    if (!emailActivo) {
        mostrarToast("⚠️ No hay sesión activa. Recarga la página.");
        return;
    }
    
    let inputF = document.getElementById("inputFotoPerfilOculto");
    if (!inputF) {
        inputF = document.createElement("input");
        inputF.type = "file";
        inputF.id = "inputFotoPerfilOculto";
        inputF.accept = "image/*"; 
        inputF.style.display = "none";
        document.body.appendChild(inputF);
        
        inputF.onchange = async (e) => {
            let file = e.target.files[0];
            if (!file) return;
            
            let btnAvatar = document.getElementById("imgFotoPerfilTEN");
            let originalSrc = btnAvatar.src;
            btnAvatar.src = "https://i.gifer.com/ZKZg.gif"; // Rueda de carga girando
            mostrarToast("⏳ Comprimiendo y subiendo foto...");
            
            try {
                // 1. Buscamos tu ID exacto en la BD usando tu correo activo (¡Imposible fallar!)
                const { getDocs, query, where, doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
                const q = query(coleccionUsuarios, where("email", "==", emailActivo));
                const snap = await getDocs(q);
                
                if (snap.empty) {
                    mostrarToast("❌ Tu usuario no está en la tabla de configuración.");
                    btnAvatar.src = originalSrc;
                    return;
                }
                let idUsuarioReal = snap.docs[0].id;
                
                // 2. Comprimimos la foto
                let fotoBlob = await window.comprimirFotografia(file);
                
                // 3. Subimos a Firebase Storage
                const { getStorage, ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js");
                const storageRef = ref(getStorage(), "perfiles_usuarios/" + idUsuarioReal + "_" + Date.now() + ".webp");
                await uploadBytes(storageRef, fotoBlob);
                const urlFoto = await getDownloadURL(storageRef);
                
                // 4. Guardamos en Firebase Database
                await updateDoc(doc(db, "artifacts", appId, "public", "data", "usuarios_sistema", idUsuarioReal), { fotoPerfil: urlFoto });
                
                // 5. Actualizamos la pantalla
                btnAvatar.src = urlFoto;
                mostrarToast("✅ ¡Foto de perfil actualizada con éxito!");
                if (window.lanzarConfeti) window.lanzarConfeti();
                
            } catch (err) {
                console.error(err);
                mostrarToast("❌ Error al procesar la foto.");
                btnAvatar.src = originalSrc;
            }
        };
    }
    inputF.click(); 
};

// ============================================================ //
// 🛠️ MENÚ DE OPCIONES DE PERFIL Y ELIMINACIÓN                  //
// ============================================================ //
window.abrirMenuPerfil = (e, urlActual) => {
    e.stopPropagation(); // Evita que un clic accidental cierre todo
    
    // Si el menú ya estaba abierto, lo cerramos
    let menuViejo = document.getElementById("menuOpcionesPerfil");
    if (menuViejo) { menuViejo.remove(); return; }

    // Creamos el menú flotante
    let menu = document.createElement("div");
    menu.id = "menuOpcionesPerfil";
    menu.style.cssText = "position: absolute; background: var(--bg-panel); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); z-index: 10000; width: 160px; overflow: hidden; animation: fadeIn 0.2s ease-out;";

    let html = "";
    // Detectamos si es una foto real o las iniciales por defecto
    let esFotoReal = !urlActual.includes("ui-avatars.com");

    if (esFotoReal) {
        // ✨ AHORA LLAMA A window.verFotoGrande() EN LUGAR DE window.open()
        html += `<div onclick="window.verFotoGrande('${urlActual}'); document.getElementById('menuOpcionesPerfil').remove();" style="padding: 10px 15px; cursor: pointer; border-bottom: 1px solid var(--border); font-size: 12px; font-weight: bold; color: var(--text-main); display: flex; align-items: center; gap: 8px;" onmouseover="this.style.background='rgba(0,0,0,0.05)'" onmouseout="this.style.background='transparent'"><i class="fa-solid fa-expand text-accent"></i> Ver foto grande</div>`;
    }
    
    html += `<div onclick="window.cambiarFotoPerfil(); document.getElementById('menuOpcionesPerfil').remove();" style="padding: 10px 15px; cursor: pointer; border-bottom: 1px solid var(--border); font-size: 12px; font-weight: bold; color: var(--text-main); display: flex; align-items: center; gap: 8px;" onmouseover="this.style.background='rgba(0,0,0,0.05)'" onmouseout="this.style.background='transparent'"><i class="fa-solid fa-camera text-success"></i> ${esFotoReal ? 'Cambiar foto' : 'Subir foto'}</div>`;
    
    if (esFotoReal) {
        html += `<div onclick="window.eliminarFotoPerfil(); document.getElementById('menuOpcionesPerfil').remove();" style="padding: 10px 15px; cursor: pointer; font-size: 12px; font-weight: bold; color: var(--danger); display: flex; align-items: center; gap: 8px;" onmouseover="this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.background='transparent'"><i class="fa-solid fa-trash"></i> Eliminar foto</div>`;
    }

    menu.innerHTML = html;
    document.body.appendChild(menu);
    
    // Lo ubicamos dinámicamente justo al lado del clic
    let rect = e.target.getBoundingClientRect();
    menu.style.left = (rect.left + 50) + "px";
    menu.style.top = (rect.top + 5) + "px";

    // Si hace clic en cualquier otro lado de la pantalla, el menú se cierra
    document.addEventListener('click', function cerrarMenuPerfil(evento) {
        if (!menu.contains(evento.target)) {
            menu.remove();
            document.removeEventListener('click', cerrarMenuPerfil);
        }
    });
};

window.eliminarFotoPerfil = () => {
    // 1. Creamos un modal hermoso con el diseño de TEN NOC
    let overlay = document.createElement("div");
    overlay.id = "modalConfirmarEliminarFoto";
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); z-index:999999; display:flex; align-items:center; justify-content:center; animation: fadeIn 0.2s ease-out;";
    
    overlay.innerHTML = `
        <div style="background:var(--bg-panel); border:1px solid var(--border); padding:25px; border-radius:15px; text-align:center; max-width:350px; width:90%; box-shadow:0 15px 30px rgba(0,0,0,0.5);">
            <i class="fa-solid fa-trash-can" style="font-size:3.5rem; color:var(--danger); margin-bottom:15px; display:block;"></i>
            <h3 style="color:var(--text-main); font-size:1.2rem; font-weight:900; margin-bottom:10px;">¿Eliminar Foto?</h3>
            <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:20px; line-height:1.4;">Se borrará tu foto actual y volverán a aparecer tus iniciales. ¿Estás seguro?</p>
            
            <div style="display:flex; gap:10px;">
                <button id="btnCancelarFoto" style="flex:1; background:transparent; border:1px solid var(--border); color:var(--text-muted); padding:10px; border-radius:8px; font-weight:bold; cursor:pointer; transition: 0.2s;" onmouseover="this.style.background='var(--bg-app)'" onmouseout="this.style.background='transparent'">Cancelar</button>
                <button id="btnConfirmarFoto" style="flex:1; background:var(--danger); color:#fff; border:none; padding:10px; border-radius:8px; font-weight:bold; cursor:pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3);">Sí, Eliminar</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // 2. Si le da a Cancelar, solo borramos el modal
    document.getElementById("btnCancelarFoto").onclick = () => overlay.remove();
    
    // 3. Si confirma, ejecutamos el motor de borrado de Firebase
    document.getElementById("btnConfirmarFoto").onclick = async () => {
        let btn = document.getElementById("btnConfirmarFoto");
        btn.innerText = "⏳ Eliminando...";
        btn.disabled = true;
        btn.style.opacity = "0.7";
        
        let emailActivo = localStorage.getItem('ten_email');
        if (!emailActivo) { overlay.remove(); return; }

        let btnAvatar = document.getElementById("imgFotoPerfilTEN");
        let originalSrc = btnAvatar.src;
        btnAvatar.src = "https://i.gifer.com/ZKZg.gif"; // Rueda de carga
        
        try {
            const { getDocs, query, where, doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
            const q = query(coleccionUsuarios, where("email", "==", emailActivo));
            const snap = await getDocs(q);
            
            if (!snap.empty) {
                let idUsuarioReal = snap.docs[0].id;
                
                // Borramos la foto de la BD
                await updateDoc(doc(db, "artifacts", appId, "public", "data", "usuarios_sistema", idUsuarioReal), { fotoPerfil: null });
                
                // Regeneramos las iniciales mágicas
                let nombrePantalla = window.nombreUsuarioGlobal || "User";
                let nuevaUrl = "https://ui-avatars.com/api/?name=" + nombrePantalla + "&background=0ea5e9&color=fff&rounded=true&bold=true";
                btnAvatar.src = nuevaUrl;
                
                // Reconectamos el menú al nuevo avatar
                btnAvatar.setAttribute('onclick', `window.abrirMenuPerfil(event, '${nuevaUrl}')`);
                
                mostrarToast("✅ Foto eliminada. Se restauraron tus iniciales.");
            }
        } catch (err) {
            console.error(err);
            mostrarToast("❌ Error al eliminar la foto.");
            btnAvatar.src = originalSrc;
        } finally {
            overlay.remove(); // Destruimos el modal al terminar
        }
    };
};

// ============================================================ //
// 🖼️ VISOR FLOTANTE PARA FOTOS DE PERFIL (LIGHTBOX)            //
// ============================================================ //
window.verFotoGrande = (url) => {
    // 1. Creamos la capa oscura que cubrirá toda la pantalla
    let overlay = document.createElement("div");
    overlay.id = "visorFotoFlotante";
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); backdrop-filter: blur(5px); z-index: 999999; display: flex; align-items: center; justify-content: center; cursor: zoom-out; opacity: 0; transition: opacity 0.3s ease;";
    
    // 2. Insertamos la imagen centrada y la "X" para cerrar
    overlay.innerHTML = `
        <img src="${url}" style="max-width: 90%; max-height: 90%; border-radius: 12px; box-shadow: 0 15px 35px rgba(0,0,0,0.5); transform: scale(0.9); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
        <div style="position: absolute; top: 20px; right: 30px; color: white; font-size: 35px; font-weight: bold; cursor: pointer;">&times;</div>
    `;
    
    document.body.appendChild(overlay);
    
    // 3. Activamos la animación de entrada suave (Pop-up)
    requestAnimationFrame(() => {
        overlay.style.opacity = "1";
        overlay.querySelector("img").style.transform = "scale(1)";
    });

    // 4. Si el usuario hace clic en cualquier lado, se cierra con animación
    overlay.onclick = () => {
        overlay.style.opacity = "0";
        overlay.querySelector("img").style.transform = "scale(0.9)";
        setTimeout(() => overlay.remove(), 300); // Espera que acabe la animación para borrarlo
    };
};

// ============================================================ //
// 💬 MOTOR DE LA BITÁCORA (HILO DE COMENTARIOS)                //
// ============================================================ //
window.renderizarBitacora = (bitacoraArray) => {
    let caja = document.getElementById("contenedorBitacoraChat");
    if(!caja) return;
    
    if (!bitacoraArray || bitacoraArray.length === 0) {
        caja.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 11px; margin-top: 20px;">No hay comentarios aún en este ticket.</div>';
        return;
    }

    let html = "";
    bitacoraArray.forEach(b => {
        let esSistema = b.usuario === 'SISTEMA';
        let colorUsu = esSistema ? 'var(--warning)' : 'var(--accent)';
        let iconUsu = esSistema ? 'fa-robot' : 'fa-user-tie';
        let bgMsg = esSistema ? 'rgba(245, 158, 11, 0.05)' : 'var(--bg-panel)';
        
        html += `
            <div style="background: ${bgMsg}; padding: 8px 12px; border-radius: 8px; border-left: 3px solid ${colorUsu}; font-size: 11px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); animation: fadeIn 0.3s ease-out;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px solid var(--border); padding-bottom: 4px;">
                    <b style="color: ${colorUsu}; font-size: 10px; text-transform: uppercase;"><i class="fa-solid ${iconUsu}"></i> ${b.usuario}</b>
                    <span style="color: var(--text-muted); font-size: 10.5px; font-weight: 500;">${b.fechaStr}</span>
                </div>
                <div style="color: var(--text-main); font-size: 11.5px; line-height: 1.4;">${b.msj}</div>
            </div>
        `;
    });
    caja.innerHTML = html;
    
    // Autoscroll para ir al último comentario siempre
    setTimeout(() => { caja.scrollTop = caja.scrollHeight; }, 100);
};

window.enviarComentarioBitacora = async () => {
    let id = document.getElementById("formTrabajoId").value;
    let txt = document.getElementById("txtNuevoComentario").value.trim();
    
    if(!id) { mostrarToast("⚠️ Primero debes Guardar el ticket para poder comentar."); return; }
    if(!txt) return; // Si está vacío no hace nada

    let btn = event.currentTarget || document.querySelector("#seccionBitacora button");
    if(btn) btn.disabled = true;

    try {
        const { doc, updateDoc, arrayUnion } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        
        let d = new Date();
        let fechaLimpia = d.toLocaleDateString("es-PE") + " " + d.toLocaleTimeString("es-PE", {hour: '2-digit', minute:'2-digit'});
        
        let nuevoComentario = {
            usuario: window.nombreUsuarioGlobal || "Usuario",
            msj: txt,
            fechaStr: fechaLimpia,
            ts: Date.now()
        };

        // Lo inyectamos directo a Firebase de forma silenciosa
        await updateDoc(doc(coleccionTrabajos, id), {
            bitacora: arrayUnion(nuevoComentario)
        });

        document.getElementById("txtNuevoComentario").value = "";
        mostrarToast("💬 Comentario guardado.");
        
        // ✨ CORRECCIÓN DE DUPLICADO: 
        let t = dbTrabajos.find(x => x.id === id);
        if (t) {
            if(!t.bitacora) t.bitacora = [];
            
            // Verificamos si Firebase ya inyectó el comentario a la velocidad de la luz
            let yaExiste = t.bitacora.some(b => b.ts === nuevoComentario.ts);
            
            if (!yaExiste) {
                t.bitacora.push(nuevoComentario); // Si Firebase tardó, lo metemos manualmente
            }
            
            if (typeof window.renderizarBitacoraVisual === "function") {
    window.renderizarBitacoraVisual(t.historialBitacora || t.bitacora);
} else {
    window.renderizarBitacora(t.bitacora);
}
        }

    } catch (e) {
        console.error(e);
        mostrarToast("❌ Error al enviar el comentario.");
    } finally {
        if(btn) btn.disabled = false;
        document.getElementById("txtNuevoComentario").focus();
    }
};

// ============================================================ //
// GESTIÓN DE FOTOS DE PERFIL (ADMINISTRADOR DE USUARIOS)       //
// ============================================================ //
window.opcionesFotoAdmin = (e, userId, userEmail, currentUrl) => {
    e.stopPropagation();
    
    // 1. Eliminar menús previos si ya había uno abierto
    let menuPrevio = document.getElementById("menuOpcionesFotoAdmin");
    if (menuPrevio) menuPrevio.remove();

    // 2. Crear el cajón del menú flotante
    let menu = document.createElement("div");
    menu.id = "menuOpcionesFotoAdmin";
    menu.style.cssText = `position: absolute; top: ${e.pageY}px; left: ${e.pageX}px; background: var(--bg-panel); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 100000; overflow: hidden; display: flex; flex-direction: column; min-width: 160px; font-family: 'Segoe UI', sans-serif;`;

    // Opción A: Ver foto grande (visor en la misma pestaña)
    let optVer = document.createElement("div");
    optVer.innerHTML = `<i class="fa-solid fa-expand" style="margin-right: 8px;"></i> Ver foto grande`;
    optVer.style.cssText = `padding: 10px 15px; cursor: pointer; font-size: 12px; font-weight: bold; color: var(--text-main); border-bottom: 1px solid var(--border);`;
    optVer.onmouseover = () => optVer.style.background = 'rgba(0,0,0,0.05)';
    optVer.onmouseout = () => optVer.style.background = 'transparent';
    optVer.onclick = () => { 
        menu.remove(); 
        
        // Creamos el visor modal oscuro
        let visor = document.createElement("div");
        visor.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); backdrop-filter: blur(5px); z-index: 999999; display: flex; align-items: center; justify-content: center; cursor: zoom-out; animation: fadeIn 0.2s ease-out;";
        
        // Creamos la imagen en el centro
        let imgGrande = document.createElement("img");
        imgGrande.src = currentUrl;
        imgGrande.style.cssText = "max-width: 90%; max-height: 90vh; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); object-fit: contain; border: 3px solid rgba(255,255,255,0.1);";
        
        visor.appendChild(imgGrande);
        document.body.appendChild(visor);
        
        // Si hace clic en cualquier lado del visor, se cierra y se destruye
        visor.onclick = () => visor.remove();
    };

    // Opción B: Cambiar Foto
    let optCambiar = document.createElement("div");
    optCambiar.innerHTML = `<i class="fa-solid fa-camera" style="margin-right: 8px;"></i> Cambiar foto`;
    optCambiar.style.cssText = `padding: 10px 15px; cursor: pointer; font-size: 12px; font-weight: bold; color: var(--accent); border-bottom: 1px solid var(--border);`;
    optCambiar.onmouseover = () => optCambiar.style.background = 'rgba(0, 229, 255, 0.1)';
    optCambiar.onmouseout = () => optCambiar.style.background = 'transparent';
    optCambiar.onclick = () => { 
        menu.remove();
        // Creamos un input invisible para abrir la galería
        let inputF = document.createElement("input");
        inputF.type = "file";
        inputF.accept = "image/*";
        inputF.onchange = async (evento) => {
            let file = evento.target.files[0];
            if (!file) return;
            
            mostrarToast(`⏳ Procesando nueva foto para ${userEmail.split('@')[0]}...`);
            try {
                // 1. Comprimir la imagen para que sea ultraligera
                let fotoBlob = await window.comprimirFotografia(file);
                
                // 2. Subir al Storage
                const { getStorage, ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js");
                const storage = getStorage();
                const storageRef = ref(storage, "perfiles_usuarios/" + userId + "_" + Date.now() + ".jpg");
                await uploadBytes(storageRef, fotoBlob);
                const urlDescarga = await getDownloadURL(storageRef);
                
                // 3. Actualizar la Base de Datos
                const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
                await updateDoc(doc(coleccionUsuarios, userId), { fotoPerfil: urlDescarga });
                
                mostrarToast("✅ Foto de perfil actualizada con éxito.");
            } catch (err) {
                console.error(err);
                mostrarToast("❌ Error al subir la foto.");
            }
        };
        inputF.click(); // Disparamos la ventana de archivos
    };

    // Opción C: Eliminar Foto
    let optEliminar = document.createElement("div");
    optEliminar.innerHTML = `<i class="fa-solid fa-trash" style="margin-right: 8px;"></i> Eliminar foto`;
    optEliminar.style.cssText = `padding: 10px 15px; cursor: pointer; font-size: 12px; font-weight: bold; color: var(--danger);`;
    optEliminar.onmouseover = () => optEliminar.style.background = 'rgba(239, 68, 68, 0.1)';
    optEliminar.onmouseout = () => optEliminar.style.background = 'transparent';
    optEliminar.onclick = async () => {
        menu.remove();
        if (confirm(`¿Seguro que deseas eliminar la foto de perfil de ${userEmail}? Volverá a tener sus iniciales por defecto.`)) {
            try {
                const { doc, updateDoc, deleteField } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
                // Eliminamos el campo fotoPerfil de la base de datos
                await updateDoc(doc(coleccionUsuarios, userId), { fotoPerfil: deleteField() });
                mostrarToast("🗑️ Foto de perfil eliminada.");
            } catch (err) {
                console.error(err);
                mostrarToast("❌ Error al eliminar la foto.");
            }
        }
    };

    // Ensamblamos el menú
    menu.appendChild(optVer);
    menu.appendChild(optCambiar);
    menu.appendChild(optEliminar);
    document.body.appendChild(menu);

    // Si el usuario hace clic en cualquier otra parte de la pantalla, cerramos el menú
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(ev) {
            if (!menu.contains(ev.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 100);
};

// ============================================================ //
// 🎇 UX PREMIUM: PARTÍCULAS, VIBRACIÓN HÁPTICA Y BOTÓN COPIAR  //
// ============================================================ //

// 1. Motor Global de Vibración (Soporte nativo en celulares)
window.vibrarCelular = (tipo = 'click') => {
    if (!navigator.vibrate) return;
    try {
        if (tipo === 'click') navigator.vibrate(30); // Toque sutil
        if (tipo === 'exito') navigator.vibrate([100, 50, 100]); // Doble vibración feliz
        if (tipo === 'error') navigator.vibrate([200]); // Vibración larga de error
    } catch(e) {}
};

// 2. Efecto Visual de Partículas (Micro-explosiones) en clics
document.addEventListener("click", function(e) {
    // Solo explotar si hacen clic en un botón de acción, pestaña o menú
    let esBoton = e.target.closest("button") || e.target.closest(".nav-btn") || e.target.closest(".tab-btn");
    if (!esBoton) return;

    window.vibrarCelular('click');

    // Generar 8 partículas dinámicas
    for (let i = 0; i < 8; i++) {
        let particle = document.createElement("div");
        particle.style.position = "fixed";
        particle.style.left = e.clientX + "px";
        particle.style.top = e.clientY + "px";
        particle.style.width = "6px";
        particle.style.height = "6px";
        // Colores aleatorios de tu paleta TEN NOC
        particle.style.background = ["#f97316", "#0ea5e9", "#10b981", "#8b5cf6", "#ec4899"][Math.floor(Math.random() * 5)];
        particle.style.borderRadius = "50%";
        particle.style.pointerEvents = "none";
        particle.style.zIndex = "999999";
        // Animación física de explosión hacia afuera
        particle.style.transition = "transform 0.5s cubic-bezier(0.1, 0.9, 0.5, 1), opacity 0.5s ease-out";
        
        let angle = Math.random() * Math.PI * 2;
        let distance = 20 + Math.random() * 30; // Distancia de explosión
        let tx = Math.cos(angle) * distance;
        let ty = Math.sin(angle) * distance;
        
        document.body.appendChild(particle);
        
        // Disparar animación
        requestAnimationFrame(() => {
            particle.style.transform = `translate(${tx}px, ${ty}px) scale(0)`;
            particle.style.opacity = "0";
        });
        
        // Limpiar del DOM al terminar
        setTimeout(() => particle.remove(), 500);
    }
});

// 3. Botón de Copiar Animado (Sobrescribe al instante tu función original)
window.copiarDatos = (btn) => {
    window.vibrarCelular('click');
    let txtArea = btn.closest("td") ? btn.closest("td").querySelector(".texto-secreto") : null;
    // Fallback por si lo usan desde el nuevo tablero Kanban en el futuro
    if (!txtArea) txtArea = btn.parentElement.querySelector(".texto-secreto"); 
    if (!txtArea) return;
    
    let txt = txtArea.value;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(txt).then(() => {
            // Guardar estado original
            let originalHtml = btn.innerHTML;
            let originalBg = btn.style.background;
            let originalColor = btn.style.color;
            
            // Animación de éxito verde
            btn.innerHTML = '<i class="fa-solid fa-check"></i> ¡Copiado!';
            btn.style.background = 'var(--success)';
            btn.style.color = '#fff';
            btn.style.borderColor = 'var(--success)';
            
            window.vibrarCelular('exito');
            
            // Regresar a la normalidad después de 1.5 segundos
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.style.background = originalBg;
                btn.style.color = originalColor;
                btn.style.borderColor = '';
            }, 1500);
        }).catch(() => {
            mostrarToast("❌ Error al copiar");
            window.vibrarCelular('error');
        });
    }
};

// ============================================================ //
// VISTA KANBAN (TRELLO) - LÓGICA DE DIBUJADO Y ALTERNANCIA     //
// ============================================================ //

// 1. Variable global para saber qué vista está activa
window.vistaActualSistema = 'tabla'; // 'tabla' o 'kanban'

// 2. Función para alternar entre la Tabla aburrida y el Tablero Kanban
window.toggleVistaKanban = () => {
    let btn = document.getElementById("btnToggleKanban");
    window.vibrarCelular('click');

    if (window.vistaActualSistema === 'tabla') {
        window.vistaActualSistema = 'kanban';
        document.querySelector(".table-wrapper").style.display = "none";
        document.getElementById("vistaKanban").style.display = "flex";
        btn.innerHTML = '<i class="fa-solid fa-table-list"></i>';
        btn.title = "Volver a Vista de Lista";
        window.dibujarKanban(); 
    } else {
        window.vistaActualSistema = 'tabla';
        document.querySelector(".table-wrapper").style.display = "block";
        document.getElementById("vistaKanban").style.display = "none";
        btn.innerHTML = '<i class="fa-solid fa-table-columns"></i>';
        btn.title = "Cambiar a Vista Tablero (Kanban)";
    }
};

// 3. Función maestra que dibuja el Kanban basándose en los datos YA FILTRADOS de la tabla
window.dibujarKanban = () => {
    // Si la vista Kanban no está activa, no perdemos recursos dibujándola
    if (window.vistaActualSistema !== 'kanban') return;

    let colPend = document.getElementById("kb-col-pend");
    let colCurso = document.getElementById("kb-col-curso");
    let colFin = document.getElementById("kb-col-fin");

    if (!colPend || !colCurso || !colFin) return;

    colPend.innerHTML = "";
    colCurso.innerHTML = "";
    colFin.innerHTML = "";

    let contPend = 0, contCurso = 0, contFin = 0;

    // 💡 TRUCO: Usamos 'window.datosTablaFiltrados' para que el Kanban obedezca a los filtros del buscador, mes, estado, etc.
    window.datosTablaFiltrados.forEach(t => {
        let estActual = String(t.estado || "pendiente").toLowerCase();
        let clasePunto = "ep-pend";
        let textEst = estActual.toUpperCase().replace(/_/g, " ");

        // Ajuste de colores y textos para el Kanban
        if (estActual === "atendido") { textEst = "ATENDIDO"; clasePunto = "ep-aten"; } 
        else if (estActual === "no_atendido") { textEst = "NO ATENDIDO"; clasePunto = "ep-noat"; } 
        else if (estActual === "en_camino") { textEst = "EN CAMINO"; clasePunto = "ep-cami"; } 
        else if (estActual === "en_proceso") { textEst = "EN PROCESO"; clasePunto = "ep-proceso"; } 
        else if (estActual === "no_realizado") { textEst = "NO REALIZADO"; clasePunto = "ep-norealizado"; } 
        else if (estActual === "por_aprobar_carlos") { textEst = "POR APROBAR"; clasePunto = "ep-aprobar"; } 
        else if (estActual === "aprobada_wilton") { textEst = "VENTA APROBADA"; clasePunto = "ep-aprobada"; } 
        else if (estActual === "rechazada") { textEst = "RECHAZADA"; clasePunto = "ep-rechazada"; }
        else if (estActual === "pausado") { textEst = "PAUSADO"; clasePunto = "ep-pausa"; }

        let colorEstadoTxt = clasePunto === "ep-pend" ? "var(--warning)" : clasePunto === "ep-aten" ? "var(--success)" : clasePunto === "ep-noat" ? "var(--danger)" : clasePunto === "ep-cami" ? "var(--accent)" : clasePunto === "ep-proceso" ? "var(--purple)" : clasePunto === "ep-norealizado" ? "#64748b" : clasePunto === "ep-aprobar" ? "var(--purple)" : clasePunto === "ep-aprobada" ? "var(--accent)" : clasePunto === "ep-pausa" ? "#475569" : "var(--danger)";

        let iconTipo = t.tipoTarea === "alta" ? "🚀" : t.tipoTarea === "averia" ? "🛠️" : t.tipoTarea === "baja" ? "🛑" : t.tipoTarea === "venta_equipos" ? "🛒" : "⚙️";
        let asig = Array.isArray(t.tecnicos) ? t.tecnicos : [t.tecnicos || "Sin Asignar"];

        // Botones de acción dinámicos según el estado (Igual que en la tabla pero en pequeño)
        let htmlBotones = "";
        let isNocOAdmin = isAdmin || isAdminLurin || isWilton;
        let isTecnicoCampo = !isAdmin && !isAdminLurin && !isWilton && !isCarlos && !isVendedor && !isCobranzas;
        let esAprobacion = (estActual === "por_aprobar_carlos" || estActual === "aprobada_wilton" || estActual === "rechazada");

        if ((isTecnicoCampo || isNocOAdmin) && !esAprobacion) {
            if (estActual === "pendiente") htmlBotones += `<button onclick="window.cambiarEstadoEnCamino('${t.id}')" style="flex:1; padding:6px; background:var(--accent); color:#000; border:none; border-radius:6px; font-weight:bold; font-size:11px; cursor:pointer;"><i class="fa-solid fa-person-walking"></i> En Camino</button>`;
            else if (estActual === "en_camino") {
                htmlBotones += `<button onclick="window.abrirModalLlegada('${t.id}', 'en_proceso')" style="flex:1; padding:6px; background:rgba(168,85,247,0.1); color:var(--purple); border:1px solid var(--purple); border-radius:6px; font-weight:bold; font-size:11px; cursor:pointer;"><i class="fa-solid fa-play"></i> En Proceso</button>`;
                htmlBotones += `<button onclick="window.abrirModalLlegada('${t.id}', 'no_realizado')" style="flex:1; padding:6px; background:rgba(100,116,139,0.1); color:#64748b; border:1px solid #64748b; border-radius:6px; font-weight:bold; font-size:11px; cursor:pointer;"><i class="fa-solid fa-ban"></i> Cancelar</button>`;
            }
            else if (estActual === "en_proceso") {
                htmlBotones += `<button onclick="window.abrirModalCierreDirecto('${t.id}', 'atendido')" style="flex:1; padding:6px; background:rgba(16,185,129,0.1); color:var(--success); border:1px solid var(--success); border-radius:6px; font-weight:bold; font-size:11px; cursor:pointer;"><i class="fa-solid fa-check-double"></i> Atendido</button>`;
                htmlBotones += `<button onclick="window.abrirModalCierreDirecto('${t.id}', 'no_atendido')" style="flex:1; padding:6px; background:rgba(239,68,68,0.1); color:var(--danger); border:1px solid var(--danger); border-radius:6px; font-weight:bold; font-size:11px; cursor:pointer;"><i class="fa-solid fa-user-xmark"></i> Fallido</button>`;
            }
        }

        // Diseño de la Tarjeta Trello
        let tarjetaHtml = `
            <div style="background: var(--bg-app); border: 1px solid var(--border); border-left: 4px solid ${colorEstadoTxt}; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); transition: 0.2s; cursor: pointer;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.05)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.02)';" ondblclick="window.editarTrabajo('${t.id}')">
                
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <span style="font-size: 10px; font-weight: 900; background: ${colorEstadoTxt}20; color: ${colorEstadoTxt}; padding: 2px 6px; border-radius: 4px;">${textEst}</span>
                    <span style="font-size: 10px; color: var(--text-muted); font-weight: bold;"><i class="fa-solid fa-helmet-safety"></i> ${asig[0].split(' ')[0]}</span>
                </div>
                
                <div>
                    <strong style="font-size: 13px; color: var(--text-main); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${iconTipo} ${t.cliente}</strong>
                    <span style="font-size: 11px; color: var(--text-muted); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;"><i class="fa-solid fa-location-dot"></i> ${t.dir}</span>
                </div>
                
                <div style="font-size: 10px; color: var(--text-muted); display: flex; justify-content: space-between; border-top: 1px dashed var(--border); padding-top: 6px;">
                    <span><i class="fa-regular fa-clock"></i> ${t.horaInicio ? window.formato12h(t.horaInicio) : "--:--"}</span>
                    <span><i class="fa-solid fa-ticket"></i> ${t.ticket || "S/T"}</span>
                </div>

                ${htmlBotones ? `<div style="display: flex; gap: 6px; margin-top: 4px;">${htmlBotones}</div>` : ''}
            </div>
        `;

        // Repartir a las columnas según el estado
        if (estActual === "en_camino" || estActual === "en_proceso" || estActual === "pausado") {
            colCurso.innerHTML += tarjetaHtml;
            contCurso++;
        } else if (estActual === "atendido" || estActual === "no_atendido" || estActual === "no_realizado" || estActual === "rechazada") {
            colFin.innerHTML += tarjetaHtml;
            contFin++;
        } else {
            // Pendientes, Por Aprobar, etc.
            colPend.innerHTML += tarjetaHtml;
            contPend++;
        }
    });

    // Actualizar los numeritos de las columnas
    document.getElementById("kb-count-pend").innerText = contPend;
    document.getElementById("kb-count-curso").innerText = contCurso;
    document.getElementById("kb-count-fin").innerText = contFin;
};

// 4. Modificar el final de la función renderizarTabla original para que también actualice el Kanban automáticamente
const originalRenderizarTabla = window.renderizarTabla;
window.renderizarTabla = () => {
    originalRenderizarTabla();
    if (window.vistaActualSistema === 'kanban') {
        window.dibujarKanban();
    }
};

// ============================================================ //
// SISTEMA DE MENCIONES INTELIGENTES POR ROLES (@ETIQUETAS)     //
// ============================================================ //

// 1. Diccionario de áreas oficiales
const DEPARTAMENTOS_MENCIONES = [
    { tag: "@ventas", rolDestino: "ventas", desc: "Coordinadores de Ventas", color: "var(--accent)" },
    { tag: "@soporte", rolDestino: "noc", desc: "Soporte NOC y Calidad", color: "var(--info)" },
    { tag: "@cobranzas", rolDestino: "cobranzas", desc: "Retención y Pagos", color: "var(--purple)" },
    { tag: "@admins", rolDestino: "admin", desc: "Gerencia General", color: "var(--danger)" }
];

let tagDetectadoActual = null;

// 2. Escuchar lo que escribe el usuario para abrir el menú
window.manejarInputMencion = (e) => {
    let input = e.target;
    let texto = input.value;
    let menu = document.getElementById("menuMenciones");
    
    // Si presiona ENTER, enviamos el comentario normal
    if (e.key === 'Enter') {
        window.enviarComentarioBitacora();
        menu.style.display = "none";
        return;
    }

    // Buscar si la última palabra empieza con "@"
    let palabras = texto.split(" ");
    let ultimaPalabra = palabras[palabras.length - 1];

    if (ultimaPalabra.startsWith("@")) {
        let busqueda = ultimaPalabra.toLowerCase();
        let opcionesHtml = "";
        tagDetectadoActual = null;

        DEPARTAMENTOS_MENCIONES.forEach(dep => {
            if (dep.tag.startsWith(busqueda)) {
                opcionesHtml += `
                    <div onclick="window.insertarMencion('${dep.tag}')" style="padding: 10px 15px; cursor: pointer; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 2px;" onmouseover="this.style.background='rgba(0,0,0,0.05)'" onmouseout="this.style.background='transparent'">
                        <span style="font-weight: 900; color: ${dep.color}; font-size: 13px;">${dep.tag}</span>
                        <span style="font-size: 10px; color: var(--text-muted); font-weight: bold;">${dep.desc}</span>
                    </div>
                `;
            }
        });

        if (opcionesHtml !== "") {
            menu.innerHTML = opcionesHtml;
            menu.style.display = "flex";
        } else {
            menu.style.display = "none";
        }
    } else {
        menu.style.display = "none";
    }
};

// 3. Insertar el TAG al hacer clic en el menú
window.insertarMencion = (tagExacto) => {
    let input = document.getElementById("txtNuevoComentario");
    let palabras = input.value.split(" ");
    palabras.pop(); // Quitamos lo que estaba escribiendo (ej: "@ven")
    palabras.push(tagExacto + " "); // Metemos la etiqueta limpia
    input.value = palabras.join(" ");
    input.focus();
    document.getElementById("menuMenciones").style.display = "none";
};

// 4. FUNCIÓN MAESTRA PARA PINTAR EL CHAT (Única y centralizada)
window.renderizarBitacoraVisual = (historial) => {
    let chatContainer = document.getElementById("contenedorBitacoraChat");
    if (!chatContainer) return;
    
    chatContainer.innerHTML = "";
    if (!historial || historial.length === 0) {
        chatContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 11px; margin-top: 20px;">No hay comentarios aún.</div>';
        return;
    }

    historial.forEach(c => {
        let isSistema = c.usuario === "SISTEMA";
        let bgFila = isSistema ? "rgba(245, 158, 11, 0.1)" : "var(--bg-app)";
        let bordeLeft = isSistema ? "4px solid var(--warning)" : "4px solid var(--accent)";
        let iconUser = isSistema ? `<i class="fa-solid fa-robot text-warning"></i> SISTEMA` : `<i class="fa-solid fa-user"></i> ${c.usuario}`;
        
        let msgLimpio = c.msj || c.texto || ""; // Soporte para tickets viejos (.msj) y nuevos (.texto)
        let fechaLimpia = c.fechaStr || `${c.fecha} ${c.hora}`;

        // 🔥 MAGIA VISUAL: Usar las clases CSS para los tags (A PRUEBA DE MAYÚSCULAS)
        let textoFormateado = msgLimpio;
        textoFormateado = textoFormateado.replace(/@ventas/gi, '<span class="mencion-tag mencion-ventas">$&</span>');
        textoFormateado = textoFormateado.replace(/@soporte/gi, '<span class="mencion-tag mencion-soporte">$&</span>');
        textoFormateado = textoFormateado.replace(/@cobranzas/gi, '<span class="mencion-tag mencion-cobranzas">$&</span>');
        textoFormateado = textoFormateado.replace(/@admins/gi, '<span class="mencion-tag mencion-admins">$&</span>');

        chatContainer.innerHTML += `
            <div style="background: ${bgFila}; border-left: ${bordeLeft}; padding: 10px; border-radius: 6px; font-size: 11px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: var(--text-muted); font-weight: bold; font-size: 9px;">
                    <span style="color: ${isSistema ? 'var(--warning)' : 'var(--accent)'};">${iconUser}</span>
                    <span>${fechaLimpia}</span>
                </div>
                <div style="color: var(--text-main); font-size: 12px; line-height: 1.4;">
                    ${textoFormateado}
                </div>
            </div>
        `;
    });
    
    // Auto-scroll al último mensaje
    setTimeout(() => { chatContainer.scrollTop = chatContainer.scrollHeight; }, 100);
};

// Y para que no hayan conflictos al abrir un ticket, sobreescribimos la función vieja
window.renderizarBitacora = window.renderizarBitacoraVisual;

// 5. MODIFICACIÓN A LA FUNCIÓN ENVIAR COMENTARIO ORIGINAL
window.enviarComentarioBitacora = async () => {
    let input = document.getElementById("txtNuevoComentario");
    let txt = input.value.trim();
    if (!txt) return;

    let idTrabajo = document.getElementById("formTrabajoId").value;
    if (!idTrabajo) {
        mostrarToast("❌ Guarda la tarea primero antes de comentar");
        return;
    }

    let trabajoActual = window.datosTablaFiltrados.find(x => x.id === idTrabajo);
    if (!trabajoActual) {
         mostrarToast("❌ No se encontró el ticket actual");
         return;
    }

    let rolesAvisar = [];
    DEPARTAMENTOS_MENCIONES.forEach(dep => {
        if (txt.toLowerCase().includes(dep.tag)) rolesAvisar.push(dep.rolDestino);
    });

    try {
        const { doc, updateDoc, arrayUnion, addDoc, collection } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        
        let d = new Date();
        let fechaEdit = d.toLocaleDateString("es-PE") + " " + d.toLocaleTimeString("es-PE", {hour: '2-digit', minute:'2-digit'});

        let nuevoComentario = {
            usuario: window.nombreUsuarioGlobal || "Usuario",
            msj: txt, // Usamos 'msj' para compatibilidad retroactiva
            fechaStr: fechaEdit,
            ts: Date.now()
        };

        const docRef = doc(db, "artifacts", appId, "public", "data", "trabajos_v4", idTrabajo);
        
        // Guardamos el comentario en el array "bitacora" oficial (no en historialBitacora)
        await updateDoc(docRef, {
            bitacora: arrayUnion(nuevoComentario)
        });

        if (rolesAvisar.length > 0) {
            let colNotif = collection(db, "artifacts", appId, "public", "data", "notificaciones_sistema");
            for (let rol of rolesAvisar) {
                await addDoc(colNotif, {
                    ticketId: idTrabajo,
                    ticketNumero: trabajoActual.ticket || "S/T",
                    cliente: trabajoActual.cliente || "Cliente",
                    deUsuario: window.nombreUsuarioGlobal || "Usuario",
                    rolDestino: rol,
                    mensaje: txt,
                    fechaTs: Date.now(),
                    leidoPor: []
                });
            }
            // Disparar Alerta a Celulares del área mencionada (Opcional, pero potente)
            window.dispararAlertaCelular("¡Te han mencionado!", `Tienes un nuevo mensaje en el ticket ${trabajoActual.ticket || 'N/A'}`);
        }

        input.value = "";
        window.vibrarCelular('exito');
        mostrarToast("✅ Comentario agregado");
        
        // Actualizamos la variable global para que se vea en vivo
        if (!trabajoActual.bitacora) trabajoActual.bitacora = [];
        trabajoActual.bitacora.push(nuevoComentario);
        
        window.renderizarBitacoraVisual(trabajoActual.bitacora);
        
    } catch(e) {
        console.error("Error detallado al comentar:", e);
        mostrarToast("❌ Error al guardar comentario");
    }
};

// 5. ESCUCHADOR GLOBAL DE NOTIFICACIONES (VERSIÓN ESTRICTA Y PRIVADA)
window.dbMencionesReales = [];
window.iniciarEscuchaMenciones = async () => {
    const { collection, query, where, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
    
    let miNombreMail = window.nombreUsuarioGlobal || localStorage.getItem("ten_email") || "User";
    let miRolPuro = (localStorage.getItem("ten_rol") || "invitado").toLowerCase();
    let emailActual = (localStorage.getItem("ten_email") || "").toLowerCase();
    
    let rolesEscucha = [miRolPuro];
    
    if (miRolPuro.includes("vendedor") || miRolPuro.includes("ventas") || emailActual.includes("carlos") || emailActual.includes("ventas")) {
        rolesEscucha.push("ventas");
    }
    if (miRolPuro.includes("cobranzas") || emailActual.includes("crivera") || emailActual.includes("oalvino")) {
        rolesEscucha.push("cobranzas");
    }
    if (miRolPuro.includes("noc") || emailActual.includes("wherrera")) {
        rolesEscucha.push("noc");
        rolesEscucha.push("soporte");
    }
    if (miRolPuro.includes("admin") || emailActual.includes("admin") || emailActual.includes("rpacotaipe")) {
        // 🔥 FIX: Le quitamos el Modo Dios. El Admin solo recibe si alguien usa @admins
        rolesEscucha.push("admin"); 
    }

    const qNotif = query(
        collection(db, "artifacts", appId, "public", "data", "notificaciones_sistema"), 
        where("rolDestino", "in", rolesEscucha)
    );
    
    onSnapshot(qNotif, (snapshot) => {
        window.dbMencionesReales = [];
        let mencionesSinLeer = 0;

        snapshot.forEach(doc => {
            let n = doc.data();
            n.id = doc.id;
            
            // 🔥 REGLA DE PRIVACIDAD EXTREMA: 
            // Ignoramos la notificación si FUI YO MISMO quien la envió.
            if (n.deUsuario !== miNombreMail) {
                window.dbMencionesReales.push(n);
                
                // Contamos si aún no la he leído
                if (!n.leidoPor || !n.leidoPor.includes(miNombreMail)) {
                    mencionesSinLeer++;
                }
            }
        });

        // ACTUALIZAR CAMPANITA EN PANTALLA
        let badge = document.getElementById("badgeNotificaciones");
        if (badge) {
            if (mencionesSinLeer > 0) {
                badge.innerText = mencionesSinLeer;
                badge.style.display = "flex";
                badge.style.background = "var(--danger)"; // Rojo intenso
            } else {
                badge.style.display = "none";
            }
        }
        
        // SI EL MODAL ESTÁ ABIERTO, ACTUALIZAMOS LA TABLA EN VIVO
        let modalElement = document.getElementById("modalNotificaciones");
        if (modalElement && modalElement.style.display === "flex") {
            window.renderizarTablaMenciones();
        }
    });
};

// Quitamos el setTimeout y la llamamos directamente cuando el sistema verifica el auth
// (La llamaremos más adelante)

// Ejecutamos el escuchador de menciones a los 3 segundos de entrar al sistema para asegurar que ya cargó el rol
setTimeout(iniciarEscuchaMenciones, 3000);

// 6. Lógica del Modal del Centro de Notificaciones
window.cambiarTabNotificaciones = (tab) => {
    document.getElementById("tabNotifMenciones").className = (tab === 'menciones') ? "tab-btn active-alta" : "tab-btn";
    document.getElementById("tabNotifRecordatorios").className = (tab === 'recordatorios') ? "tab-btn active-alta" : "tab-btn";
    
    document.getElementById("panelNotifMenciones").style.display = (tab === 'menciones') ? "block" : "none";
    document.getElementById("panelNotifRecordatorios").style.display = (tab === 'recordatorios') ? "block" : "none";
    
    if(tab === 'menciones') window.renderizarTablaMenciones();
};

window.abrirModalNotificacionesGeneral = () => {
    window.cambiarTabNotificaciones('menciones');
    document.getElementById("modalNotificaciones").style.display = "flex";
};

window.renderizarTablaMenciones = () => {
    let tbody = document.getElementById("tablaNotificacionesMenciones");
    if(!tbody) return;
    tbody.innerHTML = "";
    
    let miNombreMail = window.nombreUsuarioGlobal || localStorage.getItem("ten_email") || "User";
    
    // Ordenar de más reciente a más antigua
    let ordenadas = [...window.dbMencionesReales].sort((a,b) => b.fechaTs - a.fechaTs);

    ordenadas.forEach(n => {
        let yaLeido = n.leidoPor && n.leidoPor.includes(miNombreMail);
        let fondoFila = yaLeido ? "transparent" : "rgba(14, 165, 233, 0.05)";
        let boldFila = yaLeido ? "normal" : "900";
        let dateStr = new Date(n.fechaTs).toLocaleString("es-PE", {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});

        tbody.innerHTML += `
            <tr style="background: ${fondoFila}; border-bottom: 1px solid var(--border);">
                <td>
                    <b style="color: var(--text-main); font-size: 13px; font-weight: ${boldFila};"><i class="fa-solid fa-ticket text-accent"></i> ${n.ticketNumero}</b><br>
                    <span style="font-size: 11px; color: var(--text-muted);">${n.cliente}</span>
                </td>
                <td>
                    <span style="font-size: 11px; font-weight: bold; background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px;"><i class="fa-solid fa-user"></i> ${n.deUsuario}</span><br>
                    <span style="font-size: 9px; color: var(--text-muted);">${dateStr}</span>
                </td>
                <td style="font-size: 11px; color: var(--text-main); font-style: italic; max-width: 200px; white-space: normal;">
                    "${n.mensaje}"
                </td>
                <td style="text-align: center; display: flex; gap: 5px; justify-content: center; align-items: center; padding-top: 15px; border: none;">
                    <button onclick="window.irATicketMencionado('${n.ticketId}', '${n.id}')" style="background: var(--accent); color: white; border: none; border-radius: 6px; padding: 6px 10px; font-weight: bold; cursor: pointer; font-size: 11px; box-shadow: 0 2px 4px rgba(0,229,255,0.3);" title="Ver Ticket"><i class="fa-solid fa-arrow-right"></i> Ver</button>
                    
                    <button onclick="window.eliminarMencionIndividual('${n.id}')" style="background: transparent; color: var(--danger); border: 1px solid var(--danger); border-radius: 6px; padding: 5px 8px; font-weight: bold; cursor: pointer; font-size: 11px; transition: 0.2s;" onmouseover="this.style.background='var(--danger)'; this.style.color='white';" onmouseout="this.style.background='transparent'; this.style.color='var(--danger)';" title="Eliminar Notificación"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });

    if (ordenadas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-8"><i class="fa-solid fa-inbox text-3xl mb-2 block"></i>Tu equipo no tiene menciones nuevas.</td></tr>`;
    }
};

window.irATicketMencionado = async (idTrabajo, idNotif) => {
    // 1. Intentamos abrir el ticket (puede que ya no exista)
    let t = window.datosTablaFiltrados ? window.datosTablaFiltrados.find(x => x.id === idTrabajo) : null;
    
    if (t) {
        window.editarTrabajo(idTrabajo);
        window.cerrarModalGeneral('modalNotificaciones');
    } else {
        mostrarToast("⚠️ El ticket original ya fue eliminado o cerrado.");
    }
    
    // 2. Marcamos la notificación como leída EN LA NUBE
    try {
        const { doc, updateDoc, arrayUnion } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        await updateDoc(doc(db, "artifacts", appId, "public", "data", "notificaciones_sistema", idNotif), {
            leidoPor: arrayUnion(window.nombreUsuarioGlobal || localStorage.getItem("ten_email") || "User")
        });
    } catch(e) { console.error("Error marcando leído:", e); }
};

// 🔥 NUEVA FUNCIÓN: ELIMINAR MENCIÓN INDIVIDUAL
window.eliminarMencionIndividual = async (idNotif) => {
    try {
        const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        await deleteDoc(doc(db, "artifacts", appId, "public", "data", "notificaciones_sistema", idNotif));
        mostrarToast("🗑️ Notificación eliminada de tu bandeja");
    } catch(e) {
        console.error("Error al eliminar mención:", e);
        mostrarToast("❌ Error al eliminar");
    }
};

// ============================================================ //
// 🛠️ EDICIÓN MAESTRA DE CAJAS OLT (INYECCIÓN SILENCIOSA)      //
// ============================================================ //
window.abrirModalEditarCajaNAP = (cajaNombre, cantActual, mapPuertosURI, urlFotoActual, urlMapaCodificado) => {
    let mapPuertos = JSON.parse(decodeURIComponent(mapPuertosURI));
    let urlMapaActual = urlMapaCodificado ? decodeURIComponent(urlMapaCodificado) : ""; // 🔥 Desempaquetamos el mapa
    
    let overlay = document.getElementById("modalEdicionNAPDinamico");
    if(overlay) overlay.remove(); 
    
    overlay = document.createElement("div");
    overlay.id = "modalEdicionNAPDinamico";
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); backdrop-filter:blur(5px); z-index:99999; display:flex; align-items:center; justify-content:center; animation: fadeIn 0.2s ease-out;";
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    
    let htmlPuertos = "";
    for(let i = 1; i <= cantActual; i++) {
        let info = mapPuertos[i] || { cliente: "", dni: "" };
        let cliLimpio = String(info.cliente).includes("Desconocido") ? "" : info.cliente;
        htmlPuertos += `
            <div style="display:flex; gap:10px; margin-bottom: 8px; align-items: center; background: rgba(0,0,0,0.1); padding: 8px; border-radius: 6px; border: 1px solid var(--border);">
                <b style="color: var(--accent); width: 30px;">P${i}</b>
                <input type="text" id="edNapDni_${i}" placeholder="DNI..." value="${info.dni === '-' ? '' : (info.dni || '')}" style="width: 90px; padding: 6px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-app); color: var(--text-main); font-size: 11px;">
                <input type="text" id="edNapNom_${i}" placeholder="Nombre del cliente o dejar vacío para liberar" value="${cliLimpio}" style="flex: 1; padding: 6px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-app); color: var(--text-main); font-size: 11px;">
            </div>
        `;
    }

    overlay.innerHTML = `
        <div style="background:var(--bg-panel); border:1px solid var(--border); padding:20px; border-radius:12px; max-width:550px; width:95%; max-height: 90vh; display: flex; flex-direction: column; box-shadow:0 15px 30px rgba(0,0,0,0.5);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="color:var(--text-main); font-size:1.2rem; font-weight:900; margin:0;"><i class="fa-solid fa-pen-to-square text-accent"></i> Editar Caja: ${cajaNombre}</h3>
                <button onclick="this.closest('#modalEdicionNAPDinamico').remove()" style="background: transparent; border: none; color: var(--danger); font-size: 1.5rem; cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            
            <p style="font-size: 11px; color: var(--text-muted); margin-bottom: 15px;">⚠️ Si borras el nombre de un cliente aquí, el puerto quedará libre instantáneamente para el sistema.</p>
            
            <div style="display: flex; gap: 10px; margin-bottom: 15px; align-items: flex-end;">
                <!-- 🔥 LA CAJITA PARA EDITAR EL MAPA -->
                <div style="flex: 1;">
                    <label style="font-size: 12px; font-weight: bold; color: var(--text-main);"><i class="fa-solid fa-location-dot text-accent"></i> Enlace Google Maps de la Caja:</label>
                    <input type="text" id="edNapMapa" value="${urlMapaActual}" placeholder="https://maps.app.goo.gl/..." style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-app); color: var(--text-main); font-size: 12px; margin-top: 4px;">
                </div>
                
                <div style="width: 100px;">
                    <label style="font-size: 12px; font-weight: bold; color: var(--text-main);">Capacidad:</label>
                    <input type="number" id="edNapCant" value="${cantActual}" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-app); color: var(--accent); font-weight: 900; text-align: center; margin-top: 4px;">
                </div>
            </div>

            <div style="margin-bottom: 15px; background: rgba(139, 92, 246, 0.05); padding: 12px; border-radius: 6px; border: 1px dashed var(--purple);">
                <label style="font-size: 12px; font-weight: bold; color: var(--purple);"><i class="fa-solid fa-camera"></i> Subir Nueva Foto Actualizada (Opcional):</label>
                <input type="file" id="edNapFoto" accept="image/*" style="width: 100%; margin-top: 8px; font-size: 12px;">
                ${urlFotoActual ? `<span style="font-size: 10px; color: var(--text-muted); display: block; margin-top: 6px;">*Si no subes nada, se mantendrá la foto actual.</span>` : ``}
            </div>

            <div id="edNapPuertosContainer" style="flex: 1; overflow-y: auto; padding-right: 5px; margin-bottom: 15px;">
                ${htmlPuertos}
            </div>

            <button id="btnGuardarEdicionNAP" style="background: var(--success); color: white; border: none; padding: 14px; border-radius: 8px; font-weight: 900; cursor: pointer; transition: 0.2s; font-size: 14px;"><i class="fa-solid fa-floppy-disk"></i> Guardar Cambios Definitivos</button>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("edNapCant").addEventListener("change", function() {
        let nuevaCant = parseInt(this.value) || 0;
        if(nuevaCant < 1) return;
        let container = document.getElementById("edNapPuertosContainer");
        
        let actuales = {};
        container.querySelectorAll("div").forEach((div, idx) => {
            let dni = div.querySelector(`input[id^='edNapDni_']`).value;
            let nom = div.querySelector(`input[id^='edNapNom_']`).value;
            actuales[idx + 1] = { dni, nom };
        });

        let nuevoHtml = "";
        for(let i=1; i<=nuevaCant; i++) {
            let d = actuales[i] ? actuales[i].dni : "";
            let n = actuales[i] ? actuales[i].nom : "";
            nuevoHtml += `
                <div style="display:flex; gap:10px; margin-bottom: 8px; align-items: center; background: rgba(0,0,0,0.1); padding: 8px; border-radius: 6px; border: 1px solid var(--border);">
                    <b style="color: var(--accent); width: 30px;">P${i}</b>
                    <input type="text" id="edNapDni_${i}" placeholder="DNI..." value="${d}" style="width: 90px; padding: 6px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-app); color: var(--text-main); font-size: 11px;">
                    <input type="text" id="edNapNom_${i}" placeholder="Nombre del cliente o LIBRE" value="${n}" style="flex: 1; padding: 6px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-app); color: var(--text-main); font-size: 11px;">
                </div>
            `;
        }
        container.innerHTML = nuevoHtml;
    });

    document.getElementById("btnGuardarEdicionNAP").onclick = async function() {
        let btn = this;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando Estado Actual...';

        try {
            let cantFinal = parseInt(document.getElementById("edNapCant").value) || 0;
            let mapValGuardar = document.getElementById("edNapMapa").value.trim(); // 🔥 Extraemos el mapa
            
            let puertosData = [];
            for(let i=1; i<=cantFinal; i++) {
                let d = document.getElementById(`edNapDni_${i}`).value.trim();
                let n = document.getElementById(`edNapNom_${i}`).value.trim();
                if(n !== "") {
                    puertosData.push({ puerto: i, idDni: d, nombre: n });
                }
            }

            let finalUrlFoto = urlFotoActual;
            let inputFoto = document.getElementById("edNapFoto");
            
            if (inputFoto.files && inputFoto.files.length > 0) {
                mostrarToast("🗜️ Comprimiendo nueva foto de la caja...");
                let file = inputFoto.files[0];
                let blob = await window.comprimirFotografia(file); 
                
                mostrarToast("🚀 Subiendo foto...");
                const { getStorage, ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js");
                const storage = getStorage();
                const storageRef = ref(storage, "evidencias_tecnicas/caja_manual_" + Date.now() + ".jpg");
                await uploadBytes(storageRef, blob);
                finalUrlFoto = await getDownloadURL(storageRef);
            }

            const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
            let zonaAGuardar = localStorage.getItem("ten_zona_activa") || "norte";

            let datosAuditoria = {
                tipoTarea: "otros",
                detalle: "Limpieza de caja",
                caja: cajaNombre,
                cantPuertos: cantFinal,
                puertosData: puertosData,
                estado: "atendido",
                zona: zonaAGuardar,
                fecha: new Date().toISOString().split("T")[0],
                tsFin: Date.now(), 
                creadoPor: window.nombreUsuarioGlobal || "ADMIN (Manual)",
                notas: "Actualización manual desde Panel OLT por " + (window.nombreUsuarioGlobal || "Admin"),
                cliente: "MANT. CAJA: " + cajaNombre,
                linkCaja: mapValGuardar, // 🔥 Guardamos el nuevo mapa!
                mapa: mapValGuardar      // Doble seguro
            };

            if (finalUrlFoto) datosAuditoria.evidencias = [finalUrlFoto];

            await addDoc(coleccionTrabajos, datosAuditoria);

            mostrarToast("✅ Inventario de caja actualizado y guardado.");
            overlay.remove();
            
            window.buscarStatusCajaNAP();
            window.renderizarInventarioOLT(); // Refrescamos el grid trasero

        } catch (e) {
            console.error(e);
            mostrarToast("❌ Error al guardar en la nube.");
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios Definitivos';
        }
    };
};

// ============================================================ //
// 🐱 SUPERPODERES DEL MICHI SUPERVISOR (EASTER EGGS OFICINA)   //
// ============================================================ //
window.michiEstado = 0;

window.interactuarMichi = () => {
    let michi = document.getElementById("michi-supervisor");
    let zzz = document.getElementById("michi-zzz");
    
    if (!michi) return;
    
    // Quitarle el sueño y ponerle color
    michi.style.filter = "grayscale(0%)";
    if (zzz) zzz.style.display = "none";
    
    window.michiEstado++;
    
    if (window.michiEstado === 1) {
        // 🤸‍♂️ 1. EL MICHI ACROBÁTICO (Travesura Visual)
        michi.innerHTML = "😸"; 
        mostrarToast("🤸‍♂️ ¡Michi Acrobático!");
        
        // Magia CSS: Hacemos girar toda la aplicación 360 grados
        let appBody = document.querySelector(".app-layout") || document.body;
        appBody.style.transition = "transform 1s ease-in-out";
        appBody.style.transform = "rotate(360deg)";
        
        // Lo regresamos a la normalidad sin que se note para que pueda volver a girar después
        setTimeout(() => {
            appBody.style.transition = "none";
            appBody.style.transform = "rotate(0deg)";
        }, 1000);

    } else if (window.michiEstado === 2) {
        // 💬 2. EL MICHI DE OFICINA (Frases universales)
        michi.innerHTML = "😼";
        michi.style.transform = "scale(1.2)";
        setTimeout(() => michi.style.transform = "scale(1)", 300);
        
        const frases = [
            // Las clásicas
            "Miaaau. Sigo esperando mi aumento en croquetas.",
            "Humano, deja de darme clics y ponte a trabajar.",
            "Miaaau. Recuerda parpadear y tomar agüita.",
            "Este sistema está purrr-fecto.",
            "Miaaau. ¿A qué hora nos vamos a almorzar?",
            "Miaaau. No me mires así, yo no borré la base de datos.",
            
            // Las de oficina e ISP
            "Si el internet está lento, seguro es porque no me has dado de comer.",
            "No, apagar y prender el router no va a solucionar mi hambre.",
            "He visto cables de fibra más ordenados que tu escritorio. Miaaau.",
            "Atiende ese ticket rápido, me está dando ansiedad felina.",
            "No fui yo, te juro que el servidor se cayó solo. Miaaau.",
            "Miaaau. Ponme en planilla, trabajo más que el router principal.",
            "Si el cliente dice que no hay internet, pregúntale si enchufó el router.",
            "Ronroneo... Sigue trabajando, yo te vigilo desde aquí arriba.",
            "Miaaau. Estoy en mi descanso de 15 horas, vuelve más tarde.",
            "Ese ticket de avería está en rojo, igual que el láser que no puedo atrapar.",

            // 🔥 NUEVAS: El Michi Fan del Creador 🔥
            "Miaaau. Deberían darle un aumento al genio que programó este sistema.",
            "Este ERP es tan rápido que casi se me cae el pelo. Buen trabajo del creador.",
            "Ronroneo... Si el que hizo este sistema fuera gato, sería el jefe de la manada."
        ];
        let fraseAleatoria = frases[Math.floor(Math.random() * frases.length)];
        
        mostrarToast("💬 El Michi dice: " + fraseAleatoria);
        
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            let utterance = new SpeechSynthesisUtterance(fraseAleatoria);
            utterance.lang = 'es-ES';
            utterance.pitch = 1.6; // Voz de gatito (más aguda)
            utterance.rate = 1.1;
            window.speechSynthesis.speak(utterance);
        }

    } else if (window.michiEstado >= 3) {
        // 🏃‍♂️ 3. EL GATO ESCURRIDIZO (Juego Anti-estrés)
        michi.innerHTML = "🙀";
        mostrarToast("🏃‍♂️ ¡El Michi se asustó!");
        
        let saltos = 0;
        let anchoMax = window.innerWidth - 80;
        let altoMax = window.innerHeight - 80;
        
        michi.style.position = "fixed";
        michi.style.zIndex = "999999";
        
        // El michi salta aleatoriamente por la pantalla
        let intervalo = setInterval(() => {
            let rX = Math.floor(Math.random() * anchoMax);
            let rY = Math.floor(Math.random() * altoMax);
            michi.style.left = rX + "px";
            michi.style.top = rY + "px";
            saltos++;
            
            if (saltos > 5) { 
                // Se cansa después de 5 saltos y vuelve a su lugar
                clearInterval(intervalo);
                michi.style.position = "absolute";
                michi.style.top = "15px";
                michi.style.right = "15px";
                michi.style.left = "auto";
                michi.innerHTML = "😺";
                
                if (window.lanzarConfeti) window.lanzarConfeti();
                mostrarToast("🎉 ¡Michi atrapado! Volviendo a la normalidad.");
                window.michiEstado = 0; // Reinicia el ciclo
            }
        }, 500);
    }
};

// Enganchar la función al botón del gato de forma automática
setTimeout(() => {
    let elMichi = document.getElementById("michi-supervisor");
    if (elMichi) {
        elMichi.onclick = window.interactuarMichi;
    }
}, 1500);
