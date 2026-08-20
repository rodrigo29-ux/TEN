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
const appId = typeof __app_id !== "undefined" ? __app_id : "ten-noc-app";

const coleccionTrabajos = collection(db, "artifacts", appId, "public", "data", "trabajos_v4");
const coleccionClientes = collection(db, "artifacts", appId, "public", "data", "clientes_base");
const coleccionCobranzas = collection(db, "artifacts", appId, "public", "data", "cobranzas_v1");

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

const MAPA_NOC = "https://www.google.com/maps/d/embed?mid=1EKIxuTIGSM9GJ8YTbP_HCxhh-l5DOFw&ehbc=2E312F";
const MAPA_VENTAS = "https://www.google.com/maps/d/embed?mid=1fMA7B2CSQKbdMlNO6lxVvh9pF_JnY-s&ehbc=2E312F";

function obtenerUrlMapa() {
    return (isAdmin || isAdminLurin || isWilton) ? MAPA_NOC : MAPA_VENTAS;
}

// ============================================================ //
// FUNCIÓN GLOBAL DEL MENÚ LATERAL (HAMBURGUESA)                //
// ============================================================ //
window.toggleSidebar = () => {
    const sidebar = document.querySelector('.app-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('show');
        overlay.classList.toggle('show');
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
    signInWithEmailAndPassword(auth, email, pass).catch(() => {
        let errLabel = document.getElementById("login-error");
        let errContainer = document.getElementById("login-error-container");
        errLabel.innerHTML = "<i class='fa-solid fa-circle-exclamation'></i> Error: Verifica tus credenciales.";
        errContainer.style.display = "block";
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
        toggleIcon.classList.add("fa-eye-slash"); // Cambia al ícono de ojito tachado
    } else {
        passInput.type = "password";
        toggleIcon.classList.remove("fa-eye-slash");
        toggleIcon.classList.add("fa-eye"); // Vuelve al ojito normal
    }
};

window.cambiarZona = (z) => {
    zonaActual = z;
    actualizarFiltroTecnicos();
    window.renderizarTabla();
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById("login-view").style.display = "none";
        document.getElementById("dashboard-view").style.display = "block";

        const email = user.email.toLowerCase();

        // 1. LOS NUEVOS USUARIOS Y ROLES
        const correosAdminGlobal = ["admin@ten.com", "rpacotaipe@ten.com", "eolortegui@ten.com", "jpalomino@ten.com", "dpacotaipe@ten.com"];
        const correosAdminLurin = ["ecuta@ten.com", "strujillo@ten.com"];
        const coordinadoresVentas = ["carlos@ten.com", "jrodriguez@ten.com", "mventocilla@ten.com", "cpacotaipe@ten.com"];
        const areaCobranzas = ["calvino@ten.com", "oalvino@ten.com"];

        isAdmin = correosAdminGlobal.includes(email);
        isAdminLurin = correosAdminLurin.includes(email);
        isWilton = email === "wherrera@ten.com"; 
        isCarlos = coordinadoresVentas.includes(email); 
        isVendedor = email.includes("ventas");
        isCobranzas = areaCobranzas.includes(email); 

        // Diccionario para normalizar los nombres internos
        const mapaGestores = {
            "carlos@ten.com": "JRODRIGUEZ",
            "jrodriguez@ten.com": "JRODRIGUEZ",
            "mventocilla@ten.com": "MVENTOCILLA",
            "cpacotaipe@ten.com": "CPACOTAIPE",
            "calvino@ten.com": "CALVINO",
            "oalvino@ten.com": "OALVINO"
        };

        let nombreUsuarioAdmin = email.split("@")[0].toUpperCase();

        document.querySelectorAll(".admin-only, .admin-wilton-only, .admin-carlos-only, .btn-cobranzas").forEach((el) => {
            el.classList.remove("show-admin", "show-admin-flex", "show-admin-grid");
        });

        document.querySelectorAll(".btn-ocultar-tecnico").forEach(el => el.style.display = "flex");

        if (isAdmin || isAdminLurin) {
            nombreTecnicoLogueado = isAdminLurin ? "ADMIN_LURIN" : "ADMIN";
            
            document.getElementById("lblUsuarioActivo").innerHTML = isAdminLurin ? 
                `👑 ADMIN LURÍN <br><span style="font-size:10px; color:var(--text-muted); font-weight:900;">${nombreUsuarioAdmin}</span>` : 
                `👑 ADMINISTRADOR <br><span style="font-size:10px; color:var(--accent); font-weight:900;">${nombreUsuarioAdmin}</span>`;
            
            localStorage.setItem('ten_rol', 'admin');
            localStorage.setItem('ten_email', email);

            document.querySelectorAll(".admin-only, .admin-wilton-only, .admin-carlos-only").forEach((el) => {
                if(el.tagName === 'DIV' && el.id === 'panelGraficosAdmin') el.classList.add("show-admin-grid");
                else el.classList.add("show-admin-flex");
            });

            if (isAdminLurin) {
                document.getElementById("contenedorSelectorZona").classList.remove("show-admin-flex");
                document.getElementById("contenedorSelectorZona").style.display = "none";
                zonaActual = "Lurin"; 
            } else {
                document.getElementById("contenedorSelectorZona").style.display = "flex";
                zonaActual = document.getElementById("selectorZona").value;
            }
            configurarGraficosBase("TOTALES", "Total", "Atendidos", "Pendientes");
            
        } else if (isWilton || isCobranzas) {
            nombreTecnicoLogueado = mapaGestores[email] || email.split("@")[0].toUpperCase();
            
            document.getElementById("lblUsuarioActivo").innerHTML = isCobranzas ? 
                `💰 COBRANZAS <br><span style="font-size:10px; color:var(--text-muted); font-weight:900;">${nombreTecnicoLogueado}</span>` : 
                `🛠️ WILTON SOPORTE`;
            
            localStorage.setItem('ten_rol', 'admin');
            localStorage.setItem('ten_email', email);

            document.getElementById("contenedorSelectorZona").classList.add("show-admin-flex");
            document.getElementById("contenedorSelectorZona").style.display = "flex";
            
            document.querySelectorAll(".admin-wilton-only").forEach((el) => el.classList.add("show-admin-flex"));
            
            if (isCobranzas) {
                document.querySelectorAll(".admin-carlos-only, .btn-cobranzas").forEach((el) => el.classList.add("show-admin-flex"));
            }
            
            document.getElementById("panelGraficosAdmin").classList.add("show-admin-grid");
            configurarGraficosBase(isCobranzas ? "COBRANZAS Y NOC" : "TOTALES", "Total", "Atendidos", "Pendientes");
            zonaActual = document.getElementById("selectorZona").value;
            
        } else if (isCarlos || isVendedor) {
            nombreTecnicoLogueado = mapaGestores[email] || email.split("@")[0].split(".")[0].toUpperCase();
            document.getElementById("lblUsuarioActivo").innerHTML = isCarlos ? `📋 COORD. ${nombreTecnicoLogueado}` : `💼 ${nombreTecnicoLogueado}`;
            
            localStorage.setItem('ten_rol', 'ventas');
            localStorage.setItem('ten_email', email);

            const panelGraficos = document.getElementById("panelGraficosAdmin");
            panelGraficos.classList.add("show-admin-grid");

            if (document.getElementById("cardCalendarioNoc")) document.getElementById("cardCalendarioNoc").style.display = "none";
            if (document.getElementById("cardGraficoTecnicos")) document.getElementById("cardGraficoTecnicos").style.display = "none";
            if (document.getElementById("cardKpisClientes")) document.getElementById("cardKpisClientes").style.display = "none";

            // Ocultar selector de zona (Forzar Cono Norte)
            const contZona = document.getElementById("contenedorSelectorZona");
            if (contZona) contZona.style.display = "none";
            zonaActual = "Norte";

            // Ocultar el botón de Recursos Humanos (Programación/Turnos)
            const navBtnHr = document.querySelector(".btn-hr");
            if (navBtnHr) {
                navBtnHr.style.display = "none";
                const navSecHr = navBtnHr.previousElementSibling; // Oculta el título "RECURSOS HUMANOS"
                if(navSecHr && navSecHr.tagName === 'P') navSecHr.style.display = "none";
            }

            if (isCarlos) {
                // LOS COORDINADORES SÍ VEN LA BASE DE DATOS Y RETENCIÓN
                document.querySelectorAll(".admin-carlos-only, .btn-cobranzas").forEach((el) => el.classList.add("show-admin-flex"));
                configurarGraficosBase("REPORTE DE VENTAS", "Total Registradas", "Instaladas", "Por Instalar");
            } else if (isVendedor) {
                // LOS VENDEDORES ESTRICTOS NO VEN NADA DE ESO
                document.querySelectorAll(".admin-carlos-only, .btn-cobranzas").forEach((el) => {
                    el.classList.remove("show-admin-flex");
                    el.style.display = "none";
                });
                
                // Ocultamos los subtítulos del menú izquierdo que quedan vacíos
                document.querySelectorAll(".nav-section").forEach(sec => {
                    if (sec.innerText.includes("BASE DE DATOS") || sec.innerText.includes("ÁREA COMERCIAL")) {
                        sec.style.display = "none";
                    }
                });
                configurarGraficosBase("MIS VENTAS", "Total Registradas", "Instaladas", "Por Instalar");
            }

        } else {
            nombreTecnicoLogueado = email.split("@")[0].toUpperCase();
            document.getElementById("lblUsuarioActivo").innerHTML = `🛠️ ${nombreTecnicoLogueado}`;
            
            const tecnicosLurin = ["BILLS", "CIELO"];
            zonaActual = tecnicosLurin.includes(nombreTecnicoLogueado) ? "Lurin" : "Norte";
            
            localStorage.setItem('ten_rol', 'tecnico');
            localStorage.setItem('ten_email', email);
            localStorage.setItem('ten_nombre_tecnico', nombreTecnicoLogueado);

            document.querySelectorAll(".btn-ocultar-tecnico").forEach(el => el.style.display = "none");
        }

        const iframeMapa = document.getElementById("iframeCobertura");
        if (iframeMapa) iframeMapa.src = obtenerUrlMapa();

        setTimeout(() => {
            if (typeof window.renderizarCalendario === "function") window.renderizarCalendario();
        }, 800);

        actualizarFiltroTecnicos();
        cargarTrabajosEnVivo();

        if (isAdmin || isWilton || isCarlos || isCobranzas) {
            if (typeof window.iniciarEscuchaCobranzas === 'function') window.iniciarEscuchaCobranzas();
            
            // VERIFICACIÓN INTELIGENTE DE BASE DE DATOS (PROMESA)
            window.cargarBDLocalYActualizarUI().then((hayDatos) => {
                if (!hayDatos) {
                    console.log("Sin BD local. Descargando desde Firebase...");
                    mostrarToast("📥 Dispositivo nuevo: Sincronizando clientes...");
                    if (typeof window.descargarExcelDeFirebase === 'function') {
                        window.descargarExcelDeFirebase();
                    }
                }
            });
        }

    } else {
        if (unsubscribeTrabajos) unsubscribeTrabajos();
        if (unsubscribeCobranzas) unsubscribeCobranzas(); // APAGAR COBRANZAS AL SALIR
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
        const request = indexedDB.open("TEN_DB_CLIENTES", 2);
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
                        resolve(false);
                    }
                };
                getReq.onerror = () => resolve(false);
            } else {
                resolve(false);
            }
        };
        request.onerror = () => resolve(false);
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
    
    // Actualiza los KPIs visuales si la pantalla de NOC los tiene
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
// MOTOR DE EXCEL (PROCESAMIENTO Y ACTUALIZACIÓN UI)            //
// ============================================================ //
window.procesarExcelClientes = (event) => {
    let file = event.target.files[0];
    if (!file) {
        window.actualizarEstadoBD();
        return; 
    }
    
    mostrarToast("⏳ Leyendo Excel y calculando datos...");
    
    let reader = new FileReader();
    reader.onload = function(e) {
        try {
            let data = new Uint8Array(e.target.result);
            let workbook = XLSX.read(data, {type: 'array'});
            let worksheet = workbook.Sheets[workbook.SheetNames[0]];
            
            window.bdClientesGlobal = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            
            let activos = 0, suspendidos = 0, retirados = 0;
            window.bdClientesGlobal.forEach(c => {
                let fila = {};
                for (let llave in c) {
                    let cleanKey = llave.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
                    fila[cleanKey] = c[llave];
                }
                let estMinus = String(fila["estadocliente"] || fila["estado"] || "").toLowerCase().trim();
                if (estMinus.includes("activo")) activos++;
                else if (estMinus.includes("suspendido") || estMinus.includes("cortado")) suspendidos++;
                else if (estMinus.includes("retirado") || estMinus.includes("baja")) retirados++;
            });

            let total = activos + suspendidos + retirados;
            if(total === 0) total = window.bdClientesGlobal.length;

            let opcionesFecha = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
            let fechaHoy = new Date().toLocaleDateString('es-PE', opcionesFecha);

            localStorage.setItem("kpi_activos", activos);
            localStorage.setItem("kpi_suspendidos", suspendidos);
            localStorage.setItem("kpi_retirados", retirados);
            localStorage.setItem("kpi_total", total); 
            localStorage.setItem("kpi_fecha", fechaHoy);

            const request = indexedDB.open("TEN_DB_CLIENTES", 2);
            request.onupgradeneeded = (ev) => {
                if (!ev.target.result.objectStoreNames.contains("clientesStore")) {
                    ev.target.result.createObjectStore("clientesStore", { keyPath: "id" });
                }
            };
            request.onsuccess = (ev) => {
                const db = ev.target.result;
                const tx = db.transaction("clientesStore", "readwrite");
                tx.objectStore("clientesStore").put({ id: "bd_completa", data: window.bdClientesGlobal });
                tx.oncomplete = () => {
                    event.target.value = ''; 
                    window.actualizarEstadoBD();
                    mostrarToast("✅ Excel Local guardado. Sube a la nube si deseas compartirlo.");
                    if(typeof window.ejecutarFiltroBD === "function") window.ejecutarFiltroBD();
                };
            };
        } catch(error) {
            console.error(error);
            mostrarToast("❌ Error al leer el Excel.");
            window.actualizarEstadoBD();
        }
    };
    reader.readAsArrayBuffer(file);
};

window.subirExcelAFirebase = async () => {
    if(!window.bdClientesGlobal || window.bdClientesGlobal.length === 0) {
        mostrarToast("⚠️ Primero debes Actualizar la BD (Subir Excel Local)."); 
        return;
    }
    mostrarToast("⏳ Subiendo a la Nube... Esto tomará unos segundos. No cierres la página.");
    
    try {
        let batches = [];
        let batch = writeBatch(db);
        let count = 0;

        for (let i = 0; i < window.bdClientesGlobal.length; i++) {
            let c = window.bdClientesGlobal[i];
            
            let fila = {};
            for(let key in c) {
                let cleanKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
                fila[cleanKey] = c[key];
            }
            let dniSeguro = fila["ndocumento"] || fila["dni"] || fila["idcliente"];
            
            if (!dniSeguro) continue;
            
            let docRef = doc(coleccionClientes, String(dniSeguro));
            batch.set(docRef, {
                nombre: fila["apellidosynombres"] || fila["nombre"] || "Sin Nombre", 
                dni: String(dniSeguro), 
                id_cliente: String(dniSeguro),
                telefonos: c.telefonos ? (Array.isArray(c.telefonos) ? c.telefonos.join(" / ") : c.telefonos) : "",
                zona: fila["zona"] || fila["distrito"] || "", 
                direccion: fila["direccion"] || fila["domicilio"] || "",
                plan: fila["tarifadeinternet"] || fila["plan"] || "", 
                estado: fila["estadocliente"] || fila["estado"] || "Activo"
            }, { merge: true });

            count++;
            if (count === 400) {
                batches.push(batch.commit());
                batch = writeBatch(db);
                count = 0;
            }
        }
        if (count > 0) batches.push(batch.commit());

        await Promise.all(batches);
        mostrarToast("✅ Excel guardado en la Nube. Ya está disponible para todos.");
    } catch (e) {
        console.error(e);
        mostrarToast("❌ Error al subir a la Nube.");
    }
};

// ============================================================ //
// FUNCIÓN CORREGIDA: window.descargarExcelDeFirebase            //
// ============================================================ //
window.descargarExcelDeFirebase = async () => {
    mostrarToast("⏳ Descargando base de datos desde la Nube... Por favor espera.");
    try {
        const querySnapshot = await getDocs(coleccionClientes);
        let clientesDescargados = [];
        let activos = 0, suspendidos = 0, retirados = 0;

        querySnapshot.forEach((doc) => {
            let c = doc.data();
            if (typeof c.telefonos === "string") {
                c.telefonos = c.telefonos.split(" / ").filter(t => t.trim() !== "");
            } else if (!c.telefonos) {
                c.telefonos = [];
            }
            clientesDescargados.push(c);
            
            let estMinus = (c.estado || "").toLowerCase();
            if (estMinus.includes("activo")) activos++;
            else if (estMinus.includes("suspendido") || estMinus.includes("cortado")) suspendidos++;
            else if (estMinus.includes("retirado") || estMinus.includes("baja")) retirados++;
        });

        if (clientesDescargados.length === 0) {
            mostrarToast("⚠️ La Nube está vacía. Un administrador debe subir el Excel primero.");
            window.actualizarEstadoBD();
            return;
        }

        window.bdClientesGlobal = clientesDescargados;

        let total = activos + suspendidos + retirados;
        let opcionesFecha = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
        let fechaHoy = new Date().toLocaleDateString('es-PE', opcionesFecha);

        localStorage.setItem("kpi_activos", activos);
        localStorage.setItem("kpi_suspendidos", suspendidos);
        localStorage.setItem("kpi_retirados", retirados);
        localStorage.setItem("kpi_total", total > 0 ? total : clientesDescargados.length);
        localStorage.setItem("kpi_fecha", fechaHoy);

        const request = indexedDB.open("TEN_DB_CLIENTES", 2);
        
        request.onupgradeneeded = (ev) => {
            if (!ev.target.result.objectStoreNames.contains("clientesStore")) {
                ev.target.result.createObjectStore("clientesStore", { keyPath: "id" });
            }
        };

        request.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction("clientesStore", "readwrite");
            tx.objectStore("clientesStore").put({ id: "bd_completa", data: window.bdClientesGlobal });
            tx.oncomplete = () => {
                window.actualizarEstadoBD();
                mostrarToast(`✅ ¡Listo! ${clientesDescargados.length} clientes guardados.`);
            };
        };
        
        request.onerror = () => {
            mostrarToast("❌ Error al guardar en el navegador.");
            window.actualizarEstadoBD();
        };

    } catch (e) {
        console.error(e);
        mostrarToast("❌ Error al descargar. Revisa tu conexión a internet.");
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
    let lista = zonaActual === "Norte" ? tecnicosNorte : tecnicosLurin;
    let html = `<option value="todos">Todos</option>`;
    lista.forEach((t) => { html += `<option value="${t}">${t}</option>`; });
    if(document.getElementById("filtroTecnico")) document.getElementById("filtroTecnico").innerHTML = html;
}

function actualizarSelectTecnicosModal() {
    let lista = zonaActual === "Norte" ? tecnicosNorte : tecnicosLurin;
    let html = ``;
    lista.forEach((t) => {
        html += `<div class="multi-option" onclick="window.toggleCheckbox(this)"><input type="checkbox" value="${t}"><label>${t}</label></div>`;
    });
    if(document.getElementById("techDropdown")) document.getElementById("techDropdown").innerHTML = html;
    if(document.getElementById("techDisplay")) document.getElementById("techDisplay").innerText = "Sin Asignar";
}

function cargarTrabajosEnVivo() {
    if (unsubscribeTrabajos) unsubscribeTrabajos();
    unsubscribeTrabajos = onSnapshot(coleccionTrabajos, (snapshot) => {
        dbTrabajos = [];
        snapshot.forEach((doc) => { dbTrabajos.push({ id: doc.id, ...doc.data() }); });
        actualizarOpcionesFechas();
        window.renderizarTabla();
        if (typeof window.renderizarCalendario === "function") window.renderizarCalendario();
    });
}

// ============================================================ //
// BÚSQUEDA DUAL (EXCEL LOCAL + NUBE)                          //
// ============================================================ //
window.buscarCliente = async () => {
    const queryVal = document.getElementById("formIdCliente").value.trim();
    const msg = document.getElementById("searchResult");
    if (!queryVal) { msg.innerText = "Escribe un ID o DNI primero"; return; }
    msg.innerText = "Buscando..."; msg.style.color = "var(--text-muted)";

    let clienteLocal = null;
    if (window.bdClientesGlobal && window.bdClientesGlobal.length > 0) {
        clienteLocal = window.bdClientesGlobal.find(c => {
            let filaTemporal = {};
            for(let key in c) {
                let cleanKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
                filaTemporal[cleanKey] = c[key];
            }
            let nDni = filaTemporal["ndocumento"] || filaTemporal["dni"] || filaTemporal["idcliente"] || "";
            return String(nDni).trim() === String(queryVal).trim();
        });
    }

    if (clienteLocal) {
        let filaLimpia = {};
        for(let key in clienteLocal) {
            let cleanKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
            filaLimpia[cleanKey] = clienteLocal[key];
        }

        document.getElementById("formNombre").value = filaLimpia["apellidosynombres"] || filaLimpia["nombre"] || "";
        document.getElementById("formDni").value = filaLimpia["ndocumento"] || filaLimpia["dni"] || filaLimpia["idcliente"] || "";
        
        let tels = [];
        if (filaLimpia["telefono1"]) tels.push(filaLimpia["telefono1"]);
        if (filaLimpia["telefono2"]) tels.push(filaLimpia["telefono2"]);
        document.getElementById("formTelefonoPrincipal").value = tels[0] || "";
        document.getElementById("formTelefonoSecundario").value = tels[1] || "";
        
        let zon = filaLimpia["zona"] || filaLimpia["distrito"] || "";
        let dir = filaLimpia["direccion"] || filaLimpia["domicilio"] || "";
        document.getElementById("formDireccion").value = zon ? `${zon} - ${dir}` : dir;
        
        document.getElementById("formInfoRedAveria").value = `Plan: ${filaLimpia["tarifadeinternet"] || filaLimpia["plan"] || "Sin Plan"}`;
        
        msg.innerText = "✅ Autocompletado desde BD Excel";
        msg.style.color = "var(--success)";
        return;
    }

    try {
        let docSnap = await getDocs(query(coleccionClientes, where("id_cliente", "==", queryVal)));
        if (docSnap.empty) docSnap = await getDocs(query(coleccionClientes, where("dni", "==", queryVal)));
        if (!docSnap.empty) {
            const data = docSnap.docs[0].data();
            document.getElementById("formNombre").value = data.nombre; 
            document.getElementById("formDni").value = data.dni;
            let tels = typeof data.telefonos === "string" ? data.telefonos.split(" / ") : (Array.isArray(data.telefonos) ? data.telefonos : []);
            document.getElementById("formTelefonoPrincipal").value = tels[0] || ""; 
            document.getElementById("formTelefonoSecundario").value = tels.slice(1).join(" / ") || "";
            document.getElementById("formDireccion").value = data.zona ? `${data.zona} - ${data.direccion}` : data.direccion;
            document.getElementById("formInfoRedAveria").value = `Plan: ${data.plan}`;
            msg.innerText = "✅ Cliente Autocompletado (Nube)"; msg.style.color = "var(--success)";
        } else { msg.innerText = "❌ Cliente no encontrado."; msg.style.color = "var(--danger)"; }
    } catch (err) { msg.innerText = "⚠️ Error de red."; msg.style.color = "var(--warning)"; }
};

window.calcularPrecioTotal = () => {
    let planVal = document.getElementById("formPlanVenta").value;
    let parts = planVal.split("|");
    let precioBase = parseInt(parts[0]) || 0;
    let tipoServicio = document.getElementById("formTipoServicio").value;
    let precioFinal = precioBase;

    if (tipoServicio === "Internet + Cable" && (precioBase === 50 || precioBase === 55 || precioBase === 69)) {
        precioFinal += 20;
    }
    
    document.getElementById("formPrecioTotal").innerText = isNaN(precioFinal) ? "S/ 0" : `S/ ${precioFinal}`;
};

// ============================================================ //
// MODALES TAREAS                                               //
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

        document.getElementById("formFecha").value = new Date().toISOString().split("T")[0];
        document.getElementById("searchResult").innerText = "";

        document.getElementById("formTipoDoc").value = "DNI";
        document.getElementById("formSedeVenta").value = "Norte";
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
        document.querySelectorAll(".chk-extra").forEach((c) => (c.checked = false));
        
        document.getElementById("formTipoOtros").value = "Limpieza de caja";
        document.getElementById("formCantPuertos").value = "0";
        document.getElementById("puertosContainer").innerHTML = "";
        document.getElementById("formSenalCajaOtros").value = "";

        window.calcularPrecioTotal();
        actualizarSelectTecnicosModal();
        
        try { window.seleccionarTipoTarea("alta"); } catch (e) {}

        let isTecnicoCampo = !isAdmin && !isAdminLurin && !isWilton && !isCarlos && !isVendedor && !isCobranzas;

        if (isTecnicoCampo) {
            let tabs = document.querySelector(".modal-tabs");
            if (tabs) tabs.style.display = "none";
            let asignacion = document.getElementById("grupoAsignacionTecnico");
            if (asignacion) asignacion.style.display = "none";
            let sede = document.getElementById("grupoSedeVenta");
            if (sede) sede.style.display = "none";
            let otros = document.getElementById("formTipoOtros");
            if (otros) otros.disabled = true; 
            document.getElementById("modalTitulo").innerHTML = "⚙️ Completar Datos";
        } else if (isVendedor) {
            // REGLAS ESTRICTAS PARA VENDEDORES
            let tabs = document.querySelector(".modal-tabs");
            if (tabs) tabs.style.display = "none";
            let asignacion = document.getElementById("grupoAsignacionTecnico");
            if (asignacion) asignacion.style.display = "none";
            let sede = document.getElementById("grupoSedeVenta");
            if (sede) sede.style.display = "none";
            let otrosInput = document.getElementById("formTipoOtros");
            if (otrosInput) otrosInput.disabled = true;
            document.getElementById("modalTitulo").innerHTML = "<i class='fa-solid fa-rocket'></i> Registrar Nueva Venta";
        } else if (isCarlos) {
            // REGLAS PARA COORDINADORES
            let tabs = document.querySelector(".modal-tabs");
            if (tabs) tabs.style.display = "flex";
            let asignacion = document.getElementById("grupoAsignacionTecnico");
            if (asignacion) asignacion.style.display = "none";
            let averia = document.getElementById("tabAveria");
            if (averia) averia.style.display = "none";
            let baja = document.getElementById("tabBaja");
            if (baja) baja.style.display = "none";
            let otros = document.getElementById("tabOtros");
            if (otros) otros.style.display = "none";
            let sede = document.getElementById("grupoSedeVenta");
            if (sede) sede.style.display = "block";
            let otrosInput = document.getElementById("formTipoOtros");
            if (otrosInput) otrosInput.disabled = false;
        } else {
            let tabs = document.querySelector(".modal-tabs");
            if (tabs) tabs.style.display = "flex";
            let asignacion = document.getElementById("grupoAsignacionTecnico");
            if (asignacion) asignacion.style.display = "block";
            let averia = document.getElementById("tabAveria");
            if (averia) averia.style.display = "block";
            let baja = document.getElementById("tabBaja");
            if (baja) baja.style.display = "block";
            let otros = document.getElementById("tabOtros");
            if (otros) otros.style.display = "block";
            let sede = document.getElementById("grupoSedeVenta");
            if (sede) sede.style.display = "none";
            let otrosInput = document.getElementById("formTipoOtros");
            if (otrosInput) otrosInput.disabled = false;
        }

        let modal = document.getElementById("modalAgregar");
        if (modal) modal.style.display = "flex";
    } catch (error) { console.error("❌ Error al abrir modal:", error); }
};

window.editarTrabajo = (id) => {
    let t = dbTrabajos.find((x) => x.id === id);
    if (!t) return;

    window.abrirModal();

    document.getElementById("modalTitulo").innerHTML = "✏️ Editar Tarea";
    document.getElementById("formTrabajoId").value = t.id;
    document.getElementById("formEstadoActual").value = t.estado || "";
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
        document.getElementById("formTipoOtros").value = t.detalle || "Limpieza de caja";
        window.cambiarSubtipoOtros();

        if (t.detalle === "Seguimiento de fibra") {
            document.getElementById("formClienteFibra").value = t.cliente || "";
            document.getElementById("formDniFibra").value = t.dni || "";
            document.getElementById("formPlanFibra").value = t.plan || "";
            document.getElementById("formEquiposFibra").value = t.equipos || "";
            document.getElementById("formLinkInicioFibra").value = t.linkCaja || ""; 
            document.getElementById("formLinkFinFibra").value = t.mapa || ""; 
        } else {
            document.getElementById("formCajaOtros").value = t.caja || "";
            document.getElementById("formLinkCajaOtros").value = t.linkCaja || "";
            document.getElementById("formCantPuertos").value = t.cantPuertos || "0";
            document.getElementById("formSenalCajaOtros").value = t.senalCaja || ""; 
            window.generarPuertos();
            if (t.puertosData && Array.isArray(t.puertosData)) {
                t.puertosData.forEach(p => {
                    let inputId = document.getElementById(`puertoId_${p.puerto}`);
                    let inputNom = document.getElementById(`puertoNombre_${p.puerto}`);
                    if (inputId) inputId.value = p.idDni || "";
                    if (inputNom) inputNom.value = p.nombre || "";
                });
            }
        }
    } else {
        document.getElementById("formTipoDoc").value = t.tipoDoc || "DNI";
        document.getElementById("formNombre").value = t.cliente || "";
        document.getElementById("formDni").value = t.dni || "";
        document.getElementById("formCorreo").value = t.correo || "";
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

        if (t.tipoTarea === "alta") {
            document.getElementById("formTipoServicio").value = t.tipoServicio || "Internet Solo";
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

            document.getElementById("formObsAlta").value = t.notasBase || t.notas || "";
            window.calcularPrecioTotal();
        } else if (t.tipoTarea === "averia") {
            document.getElementById("formProblemaAveria").value = t.detalle || "";
            document.getElementById("formNotasAveria").value = t.notas || "";
            document.getElementById("formInfoRedAveria").value = t.infoRed || "";
        } else if (t.tipoTarea === "baja") {
            document.getElementById("formMotivoBaja").value = t.notas || "";
            document.getElementById("formEquiposBaja").value = t.equipos || "";
        }
    }
};

window.guardarTrabajo = async () => {
    let btnGuardar = document.querySelector("#modalAgregar .btn-guardar");
    if(btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '⏳ Guardando...';
    }

    let techSelec = Array.from(document.querySelectorAll("#techDropdown input:checked")).map((c) => c.value);
    if (techSelec.length === 0) techSelec = ["Sin Asignar"];

    let telPrin = document.getElementById("formTelefonoPrincipal").value.trim();
    let telSec = document.getElementById("formTelefonoSecundario").value.trim();
    let telFinal = telPrin;
    if (telSec) telFinal += " / " + telSec;

    let tipo = document.getElementById("formTipoTareaValue").value;

    let zonaAGuardar = isVendedor || isCarlos ?
        (document.getElementById("formSedeVenta").value === "Los Olivos" ? "Norte" : document.getElementById("formSedeVenta").value) :
        zonaActual;

    let data = {
        tipoTarea: tipo, fecha: document.getElementById("formFecha").value,
        horaInicio: document.getElementById("formHoraInicio").value, horaFin: document.getElementById("formHoraFin").value,
        tecnicos: techSelec, zona: zonaAGuardar,
    };

    if (tipo === "otros") {
        let subtipo = document.getElementById("formTipoOtros").value;
        data.detalle = subtipo;
        if (subtipo === "Limpieza de caja") {
            data.caja = document.getElementById("formCajaOtros").value;
            data.linkCaja = document.getElementById("formLinkCajaOtros").value;
            data.mapa = data.linkCaja; 
            data.senalCaja = document.getElementById("formSenalCajaOtros").value.trim(); 
            let nomFalso = data.caja ? `MANTENIMIENTO: ${data.caja}` : "MANTENIMIENTO DE RED";
            data.cliente = nomFalso.toUpperCase();
            data.dir = "Ubicación de Trabajo Externo";
            let cant = parseInt(document.getElementById('formCantPuertos').value) || 0;
            data.cantPuertos = cant;
            let puertosArr = [];
            for(let i=1; i<=cant; i++) {
                let pId = document.getElementById(`puertoId_${i}`) ? document.getElementById(`puertoId_${i}`).value : "";
                let pNom = document.getElementById(`puertoNombre_${i}`) ? document.getElementById(`puertoNombre_${i}`).value : "";
                puertosArr.push({ puerto: i, idDni: pId, nombre: pNom });
            }
            data.puertosData = puertosArr;
            data.notas = cant > 0 ? `Limpieza/Verificación de ${cant} Puertos en Caja.` : "Trabajo de infraestructura.";
        } else if (subtipo === "Seguimiento de fibra") {
            data.cliente = document.getElementById("formClienteFibra").value || "Cliente Desconocido";
            data.dni = document.getElementById("formDniFibra").value;
            data.plan = document.getElementById("formPlanFibra").value;
            data.equipos = document.getElementById("formEquiposFibra").value;
            data.linkCaja = document.getElementById("formLinkInicioFibra").value; 
            data.mapa = document.getElementById("formLinkFinFibra").value; 
            data.notas = `Seguimiento de Fibra. Plan: ${data.plan}`;
            data.dir = "Revisar tendido de fibra óptica.";
        }
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

            let obsBase = document.getElementById("formObsAlta").value;
            data.notasBase = obsBase;
            let extraTxt = extrasStr ? `📦 Equipos: ${extrasStr} | ` : "";
            data.notas = `💰 Cobrar: ${precio} | ${extraTxt}${obsBase}`;
        } else if (tipo === "averia") {
            data.idCliente = document.getElementById("formIdCliente").value;
            data.detalle = document.getElementById("formProblemaAveria").value;
            data.notas = document.getElementById("formNotasAveria").value;
            data.infoRed = document.getElementById("formInfoRedAveria").value;
        } else if (tipo === "baja") {
            data.idCliente = document.getElementById("formIdCliente").value;
            data.detalle = "Retiro de Equipos";
            data.notas = document.getElementById("formMotivoBaja").value;
            data.equipos = document.getElementById("formEquiposBaja").value;
        }
    }

    let idTrabajo = document.getElementById("formTrabajoId").value;
    let estadoPrevio = document.getElementById("formEstadoActual").value;

    if (!idTrabajo) data.vendedor = nombreTecnicoLogueado;

    if (!idTrabajo) {
        if (isVendedor || isCarlos) {
            data.estado = "por_aprobar_carlos";
            data.tecnicos = ["Sin Asignar"];
        } else {
            data.estado = "pendiente";
        }
    } else {
        if ((isWilton || isAdmin || isAdminLurin) && estadoPrevio === "aprobada_wilton" && techSelec[0] !== "Sin Asignar") {
            data.estado = "pendiente";
        }
    }

    try {
        if (idTrabajo) await updateDoc(doc(coleccionTrabajos, idTrabajo), data);
        else await addDoc(coleccionTrabajos, data);
        window.cerrarModal();
        mostrarToast("Tarea guardada exitosamente");
    } catch (e) {
        mostrarToast("Error al guardar"); console.error(e);
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

window.buscarEnMapa = async () => {
    const input = document.getElementById("txtBuscarMapa").value.trim();
    if (!input) { mostrarToast("⚠️ Ingresa coordenadas, dirección o link."); return; }

    const iframe = document.getElementById("iframeCobertura");
    const baseUrl = obtenerUrlMapa();
    mostrarToast("🔍 Buscando ubicación...");

    try {
        let lat, lon;
        const coordMatch = input.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
        const linkMatch = input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);

        if (coordMatch) { lat = coordMatch[1]; lon = coordMatch[2]; } 
        else if (linkMatch) { lat = linkMatch[1]; lon = linkMatch[2]; } 
        else if (input.includes("goo.gl/") || input.includes("maps.app")) {
            mostrarToast("❌ Links cortos bloqueados. Pega texto o coordenadas."); return;
        } else {
            const query = encodeURIComponent(input + ", Lima, Peru");
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (!response.ok) throw new Error("Error en servidor");
                const data = await response.json();
                
                if (data && data.length > 0) { lat = data[0].lat; lon = data[0].lon; } 
                else { mostrarToast("❌ Dirección no encontrada en el mapa."); return; }
            } catch (fetchErr) {
                mostrarToast("⚠️ El servidor de mapas no responde. Intenta con un link.");
                return;
            }
        }

        iframe.src = `${baseUrl}&ll=${lat},${lon}&z=17`;
        document.getElementById("mapCenterPin").style.display = "block";
        mostrarToast("✅ Mapa centrado.");
    } catch (error) { mostrarToast("⚠️ Error de red al buscar."); }
};

window.centrarEnMiUbicacion = () => {
    const btnIcon = document.getElementById("iconoUbicacion");
    const iframe = document.getElementById("iframeCobertura");
    const baseUrl = obtenerUrlMapa();

    if (!navigator.geolocation) { mostrarToast("Sin soporte GPS 😔"); return; }
    btnIcon.innerText = "⏳"; mostrarToast("Buscando señal...");

    navigator.geolocation.getCurrentPosition(
        (position) => {
            iframe.src = `${baseUrl}&ll=${position.coords.latitude},${position.coords.longitude}&z=17`;
            btnIcon.innerText = "📍";
            document.getElementById("mapCenterPin").style.display = "block";
            mostrarToast("Mapa centrado en tu ubicación ✅");
        },
        (error) => { btnIcon.innerText = "📍"; mostrarToast("Error GPS."); }, 
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
// RENDERIZAR TABLA (SIN RETENCIÓN)                             //
// ============================================================ //
window.renderizarTabla = () => {
    const tbody = document.getElementById("tablaTrabajos");
    const filtroFecha = document.getElementById("filtroFecha").value;
    const filtroEstado = document.getElementById("filtroEstado").value;
    const txtBuscar = document.getElementById("buscador").value.toLowerCase();

    tbody.innerHTML = "";
    let pGrafico = [];
    let listData = [...dbTrabajos];

    if (isAdmin || isAdminLurin || isWilton) listData = listData.filter((t) => (t.zona || "Norte") === zonaActual);

    let tOrdenado = listData.sort((a, b) => {
        let res = (b.fecha || "").localeCompare(a.fecha || "");
        if (res !== 0) return res;
        
        let horaA = a.horaInicio || "23:59";
        let horaB = b.horaInicio || "23:59";
        let minA = (parseInt(horaA.split(':')[0] || 23) * 60) + parseInt(horaA.split(':')[1] || 59);
        let minB = (parseInt(horaB.split(':')[0] || 23) * 60) + parseInt(horaB.split(':')[1] || 59);
        
        return minA - minB; 
    });

    const tecnicoFiltro = document.getElementById("filtroTecnico")?.value || "todos";

    tOrdenado.forEach((t) => {
        try {
            let asig = t.tecnicos || ["Sin Asignar"];
            if (typeof asig === "string") asig = [asig];
            
            let estActual = String(t.estado || "pendiente").toLowerCase();
            let esAprobacion = (estActual === "por_aprobar_carlos" || estActual === "aprobada_wilton" || estActual === "rechazada");

            let esRetencion = (t.tipoTarea === "retencion");
            let esRetiroNOC = esRetencion && t.estadoLlamada === "Retiro Definitivo";

            if (esRetencion && !esRetiroNOC) return;

            if (isCarlos) {
                if (t.tipoTarea !== "alta") return;
            } else if (isVendedor) {
                if (t.tipoTarea !== "alta" || t.vendedor !== nombreTecnicoLogueado) return;
            } else if (isWilton || isAdmin || isAdminLurin || isCobranzas) {
                // Ellos ven el panorama completo NOC
            } else {
                if (esAprobacion) return; 
                if (!asig.includes(nombreTecnicoLogueado) && !asig.includes("Todos")) return; 
            }

            if ((isAdmin || isAdminLurin || isWilton) && tecnicoFiltro !== "todos" && !asig.includes(tecnicoFiltro)) return;

            if (filtroFecha !== "todas" && t.fecha !== filtroFecha) return;
            if (filtroEstado !== "todos" && estActual !== filtroEstado) return;
            if (txtBuscar && !`${t.cliente} ${t.dni} ${t.dir} ${t.detalle}`.toLowerCase().includes(txtBuscar)) return;

            pGrafico.push(t);

            let textEst = estActual.toUpperCase().replace(/_/g, " ");
            let clasePunto = "ep-pend";
            if (estActual === "atendido") { textEst = "ATENDIDO"; clasePunto = "ep-aten"; } 
            else if (estActual === "no_atendido") { textEst = "NO ATENDIDO"; clasePunto = "ep-noat"; } 
            else if (estActual === "en_camino") { textEst = "EN CAMINO"; clasePunto = "ep-cami"; } 
            else if (estActual === "por_aprobar_carlos") { textEst = "POR APROBAR"; clasePunto = "ep-aprobar"; } 
            else if (estActual === "aprobada_wilton") { textEst = "VENTA APROBADA"; clasePunto = "ep-aprobada"; } 
            else if (estActual === "rechazada") { textEst = "RECHAZADA"; clasePunto = "ep-rechazada"; }

            let colorBadge = t.tipoTarea === "alta" ? "alta" : t.tipoTarea === "averia" ? "averia" : t.tipoTarea === "baja" || esRetiroNOC ? "baja" : "otros";
            let nombreTipo = t.tipoTarea === "alta" ? "🚀 ALTA" : t.tipoTarea === "averia" ? "🛠️ AVERÍA" : t.tipoTarea === "baja" || esRetiroNOC ? "🛑 BAJA" : "⚙️ OTROS";
            let docLabel = t.tipoDoc || "DNI";

            let infoCli = `<span class="cliente-nombre">${t.cliente}</span>`;
            if (t.tipoTarea === "otros") {
                if (t.detalle === "Limpieza de caja") {
                    infoCli += `<span class="cliente-info"><span class="lbl-info">PUERTOS:</span> <b>${t.cantPuertos || 0}</b></span>`;
                    if(t.caja) infoCli += `<span class="cliente-info"><span class="lbl-info">CAJA NAP:</span> ${t.caja}</span>`;
                } else if (t.detalle === "Seguimiento de fibra") {
                    infoCli += `<span class="cliente-info"><span class="lbl-info">DNI/ID:</span> ${t.dni || "-"}</span>`;
                    infoCli += `<span class="cliente-info"><span class="lbl-info">PLAN:</span> ${t.plan || "-"}</span>`;
                    if(t.equipos) infoCli += `<span class="cliente-info"><span class="lbl-info">EQUIPOS:</span> ${t.equipos}</span>`;
                }
            } else {
                infoCli += `<span class="cliente-info"><span class="lbl-info">${docLabel}:</span> ${t.dni || "-"}</span>
                           <span class="cliente-info"><span class="lbl-info">TEL:</span> ${t.tel || "-"}</span>
                           ${t.correo ? `<span class="cliente-info"><span class="lbl-info">EMAIL:</span> ${t.correo}</span>` : ""}
                           ${(t.vendedor && t.tipoTarea === "alta") ? `<span class="cliente-info"><span class="lbl-info" style="color:var(--danger)">VENDEDOR:</span> <b style="color:var(--danger);">${t.vendedor}</b></span>` : ""}`;
            }

            let extrasHtml = "";
            if (t.tipoTarea === "alta") {
                if (t.caja || t.puerto) extrasHtml += `<span class="cliente-info" style="color:var(--purple)"><span class="lbl-info">CAJA:</span> ${t.caja || "--"} | <span class="lbl-info">P:</span> ${t.puerto || "--"}</span>`;
                if (t.periodo || t.comprobante) extrasHtml += `<span class="cliente-info"><span class="lbl-info">PAGO:</span> ${t.periodo || ""} | ${t.comprobante || ""}</span>`;
            }
            if (t.tipoTarea === "averia" && t.infoRed) extrasHtml = `<span class="cliente-info"><span class="lbl-info">RED:</span> ${t.infoRed}</span>`;
            if ((t.tipoTarea === "baja" || esRetiroNOC) && t.equipos) extrasHtml = `<span class="cliente-info" style="color:var(--danger)"><span class="lbl-info">RECOGER:</span> ${t.equipos}</span>`;

            if (t.tx || t.rx) {
                extrasHtml += `<div style="background: rgba(0,229,255,0.05); border: 1px dashed var(--accent); padding: 4px 8px; border-radius: 4px; margin-top: 6px;"><span class="cliente-info" style="color:var(--accent)"><span class="lbl-info">📡 SEÑAL ROUTER:</span> TX: <b>${t.tx || "--"}</b> | RX: <b>${t.rx || "--"}</b></span></div>`;
            }
            if (t.senalCaja) {
                extrasHtml += `<div style="background: rgba(245,158,11,0.05); border: 1px dashed var(--warning); padding: 4px 8px; border-radius: 4px; margin-top: 6px;"><span class="cliente-info" style="color:var(--warning)"><span class="lbl-info">📡 SEÑAL CAJA:</span> <b>${t.senalCaja}</b></span></div>`;
            }

            let slaHtml = "";
            if (t.tsInicio) {
                let hrInicio = new Date(t.tsInicio).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
                let hrFin = t.tsFin ? new Date(t.tsFin).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "--:--";
                let duracion = t.tsInicio && t.tsFin ? `(${Math.floor(Math.floor((t.tsFin - t.tsInicio) / 60000) / 60)}h ${Math.floor((t.tsFin - t.tsInicio) / 60000) % 60}m)` : "(En curso...)";
                slaHtml = `<div style="background: rgba(0,229,255,0.05); border: 1px dashed var(--accent); padding: 8px; border-radius: 6px; margin-top: 8px;"><span class="cliente-info" style="color:var(--accent)"><span class="lbl-info">⏱️ SLA:</span> Inicio: ${hrInicio} | Fin: ${hrFin} <b>${duracion}</b></span>${t.notaCierre ? `<span class="cliente-info" style="color:var(--success)"><span class="lbl-info">📝 NOTA TEC:</span> ${t.notaCierre}</span>` : ""}</div>`;
            }

            let refHtml = t.referencia ? `<span class="cliente-info"><span class="lbl-info">REF:</span> ${t.referencia}</span>` : "";
            let notaEstilo = estActual === "rechazada" ? "color: var(--danger); font-weight: bold; background: rgba(239, 68, 68, 0.1); padding: 4px; border-radius: 4px;" : "color: var(--warning); font-weight:bold;";

            let dirH = `<span class="badge-tipo ${colorBadge}">${nombreTipo} - ${t.detalle}</span>
                    <span class="cliente-info"><span class="lbl-info">DIR:</span> ${t.dir}</span>
                    ${refHtml}
                    <span class="cliente-info"><span class="lbl-info">FECHA:</span> ${formatoFecha(t.fecha)} | ${t.horaInicio || "--:--"} a ${t.horaFin || "--:--"}</span>
                    <span class="cliente-info"><span class="lbl-info">TEC:</span> <b>${asig.join(", ")}</b></span>
                    ${extrasHtml}
                    ${t.notas ? `<span class="cliente-info" style="${notaEstilo}"><span class="lbl-info">NOTA:</span> ${t.notas}</span>` : ""}
                    ${slaHtml}`;

            let telArray = String(t.tel || "").split("/");
            let telPrincipalRaw = telArray[0] ? telArray[0].trim() : "";
            let numLimpio = telPrincipalRaw.replace(/\D/g, "");
            let linkWsp = numLimpio.length > 5 ? `https://wa.me/51${numLimpio}` : "#";
            
            let txtCop = `*CLIENTE:* ${t.cliente}\n*DIR:* ${t.dir}\n*TELÉFONO:* ${telPrincipalRaw}`;
            if (t.mapa) txtCop += `\n*UBICACIÓN MAPA:* ${t.mapa}`;
            if (t.linkCaja) txtCop += `\n*UBICACIÓN CAJA:* ${t.linkCaja}`;

            let botonesHtml = ``;

            if (isCarlos && estActual === "por_aprobar_carlos") {
                botonesHtml += `<div class="btn-grid-row"><button class="btn-action-ui btn-ui-estado" onclick="aprobarDirecto('${t.id}')"><i class="fa-solid fa-thumbs-up"></i> Aprobar</button><button class="btn-action-ui btn-ui-eliminar" onclick="rechazarDirecto('${t.id}')"><i class="fa-solid fa-xmark"></i> Rechazar</button></div>`;
            }

            if ((isWilton || isAdmin || isAdminLurin) && estActual === "aprobada_wilton") {
                botonesHtml += `<div class="btn-grid-row"><button class="btn-action-ui btn-ui-estado" onclick="editarTrabajo('${t.id}')"><i class="fa-solid fa-calendar"></i> Programar</button></div>`;
            }

            let textoAccion = ""; let iconAccion = "";
            let mostrarBtnEstado = false;

            if (estActual === "pendiente") { textoAccion = "En Camino"; iconAccion = "fa-person-walking"; } 
            else if (estActual === "en_camino") { textoAccion = "Finalizar"; iconAccion = "fa-check"; } 
            else if (estActual === "atendido") { textoAccion = "No Atendido"; iconAccion = "fa-xmark"; } 
            else if (estActual === "no_atendido") { textoAccion = "A Pendiente"; iconAccion = "fa-backward"; }
            
            if (!isVendedor && !isCarlos && !isWilton && !isAdmin && !isAdminLurin && !isCobranzas && !esAprobacion) mostrarBtnEstado = true;
            if (esRetiroNOC && isWilton) mostrarBtnEstado = true;

            if (mostrarBtnEstado && textoAccion !== "") {
                botonesHtml += `<div class="btn-grid-row"><button class="btn-action-ui btn-ui-estado" onclick="cambiarEstado('${t.id}', '${estActual}', ${esRetiroNOC})"><i class="fa-solid ${iconAccion}"></i> ${textoAccion}</button></div>`;
            }

            let btnCajaHtml = '';
            if (t.tipoTarea === "alta" || t.tipoTarea === "otros" || t.linkCaja) {
                if (t.linkCaja) btnCajaHtml = `<a href="${t.linkCaja}" target="_blank" class="btn-action-ui btn-ui-nap"><i class="fa-solid fa-box"></i> Ver Caja NAP</a>`;
                else btnCajaHtml = `<button class="btn-action-ui btn-ui-nap" disabled><i class="fa-solid fa-box"></i> Sin Caja</button>`;
            }

            let btnMapaHtml = '';
            if (t.mapa) {
                let isTecnico = !isVendedor && !isCarlos && !isWilton && !isAdmin && !isAdminLurin && !isCobranzas;
                let isLurinUser = zonaActual === "Lurin" || isAdminLurin;
                if (isTecnico || isLurinUser) btnMapaHtml = `<a href="${t.mapa}" target="_blank" class="btn-action-ui btn-ui-mapa"><i class="fa-solid fa-location-dot"></i> Mapa</a>`;
                else btnMapaHtml = `<button class="btn-action-ui btn-ui-mapa" onclick="verMapaCliente('${t.id}')"><i class="fa-solid fa-location-dot"></i> Mapa</button>`;
            } else {
                btnMapaHtml = `<button class="btn-action-ui btn-ui-mapa" disabled><i class="fa-solid fa-location-dot"></i> Mapa</button>`;
            }

            botonesHtml += `<div class="btn-grid-row">${btnMapaHtml} ${btnCajaHtml}</div>`;

            if (numLimpio.length > 5 && t.tipoTarea !== "otros") botonesHtml += `<div class="btn-grid-row"><a href="${linkWsp}" target="_blank" class="btn-action-ui btn-ui-wsp"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a></div>`;

            let isTecnico = !isVendedor && !isCarlos && !isWilton && !isAdmin && !isAdminLurin && !isCobranzas;
            let btnSenalHtml = "";
            let textoBtnEditar = "<i class='fa-solid fa-pen'></i> Editar";
            let permitirEditarTecnico = false;

            if (t.tipoTarea === "alta" || t.tipoTarea === "averia" || (t.tipoTarea === "otros" && t.detalle === "Seguimiento de fibra")) {
                btnSenalHtml = `<button class="btn-action-ui" style="background: rgba(0, 229, 255, 0.1); border: 1px solid var(--accent); color: var(--accent);" onclick="abrirModalSenal('${t.id}', '${t.tipoTarea}', '${t.detalle}')"><i class="fa-solid fa-satellite-dish"></i> Registrar Señal</button>`;
            } else if (t.tipoTarea === "otros" && t.detalle === "Limpieza de caja") {
                permitirEditarTecnico = true; 
                if (isTecnico) textoBtnEditar = "<i class='fa-solid fa-list-check'></i> Puertos/Señal";
            }

            let btnEditGralHtml = "";
            if (isAdmin || isAdminLurin || isWilton || isCarlos || isVendedor || permitirEditarTecnico || isCobranzas) {
                btnEditGralHtml = `<button class="btn-action-ui btn-ui-editar" onclick="editarTrabajo('${t.id}')">${textoBtnEditar}</button>`;
            }

            if (btnSenalHtml !== "") botonesHtml += `<div class="btn-grid-row">${btnSenalHtml}</div>`;
            
            botonesHtml += `<div class="btn-grid-row"><button class="btn-action-ui btn-ui-copiar" onclick="copiarDatos(this)"><i class="fa-solid fa-copy"></i> Copiar</button>${btnEditGralHtml}</div>`;

            if (isAdmin || isAdminLurin) {
                botonesHtml += `<div class="btn-grid-row"><button class="btn-action-ui btn-ui-eliminar" onclick="preguntarEliminar('${t.id}')"><i class="fa-solid fa-trash"></i> Eliminar</button></div>`;
            }

            let colorEstadoTxt = clasePunto === "ep-pend" ? "var(--warning)" : clasePunto === "ep-aten" ? "var(--success)" : clasePunto === "ep-noat" ? "var(--danger)" : clasePunto === "ep-cami" ? "var(--accent)" : clasePunto === "ep-aprobar" ? "var(--purple)" : clasePunto === "ep-aprobada" ? "var(--accent)" : "var(--danger)";

            let tr = document.createElement("tr");
            tr.innerHTML = `
                <td><span class="estado-punto ${clasePunto}"></span><span style="font-size:11px; font-weight:900; color:${colorEstadoTxt};">${textEst}</span></td>
                <td>${infoCli}</td>
                <td>${dirH}</td>
                <td><div class="btn-acciones-grid">${botonesHtml}<textarea style="display:none;" class="texto-secreto">${txtCop}</textarea></div></td>
            `;
            tbody.appendChild(tr);
        } catch (err) { console.error("Error fila", err); }
    });

    if (tbody.innerHTML === "") {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-8"><i class="fa-solid fa-mug-hot text-2xl mb-2 block"></i><br>No hay tareas para mostrar en esta vista.</td></tr>`;
    }
    
    actualizarGraficosGerenciales(pGrafico);
};

// ============================================================ //
// CAMBIO DE ESTADO Y CIERRE SLA                                //
// ============================================================ //
window.cambiarEstado = async (id, estadoActual, esRetencion = false) => {
    let nE = "pendiente";
    
    if (esRetencion) {
        if (estadoActual === "pendiente") nE = "atendido";
        else if (estadoActual === "atendido") nE = "no_atendido";
    } else {
        if (estadoActual === "pendiente") nE = "en_camino";
        else if (estadoActual === "en_camino") nE = "atendido";
        else if (estadoActual === "atendido") nE = "no_atendido";
    }

    let dataUpdate = { estado: nE };

    if (nE === "en_camino") {
        dataUpdate.tsInicio = Date.now();
        await updateDoc(doc(coleccionTrabajos, id), dataUpdate);
        mostrarToast("Técnico en camino ⏱️");
    } else if (nE === "atendido" || nE === "no_atendido") {
        idTrabajoCierreSLA = id;
        estadoObjetivoSLA = nE;
        document.getElementById("lblEstadoCierre").innerText = nE.replace("_", " ").toUpperCase();
        let txtNota = document.getElementById("txtNotaCierre");
        if (txtNota) {
            txtNota.placeholder = esRetencion ? "Ej: Cliente confirma pago / No contesta la llamada..." : "Ej: Se cambió el conector rápido de fibra...";
        }
        document.getElementById("modalCierre").style.display = "flex";
    } else {
        dataUpdate.tsInicio = null; dataUpdate.tsFin = null; dataUpdate.notaCierre = null;
        await updateDoc(doc(coleccionTrabajos, id), dataUpdate);
        mostrarToast("Estado reseteado a Pendiente.");
    }
};

window.ejecutarCierreSLA = async () => {
    if (!idTrabajoCierreSLA) return;
    const nota = document.getElementById("txtNotaCierre").value.trim();
    if (!nota) { mostrarToast("❌ Ingresa la nota técnica."); return; }

    try {
        await updateDoc(doc(coleccionTrabajos, idTrabajoCierreSLA), { estado: estadoObjetivoSLA, tsFin: Date.now(), notaCierre: nota });
        window.cerrarModalCierre(); mostrarToast("Trabajo cerrado ✅");
    } catch (e) { mostrarToast("Error al cerrar"); }
};

// ============================================================ //
// GRÁFICOS Y CALENDARIO                                        //
// ============================================================ //
function actualizarGraficosGerenciales(trabajosFiltrados) {
    if (!isAdmin && !isAdminLurin && !isWilton && !isCarlos && !isVendedor && !isCobranzas) return;

    setTimeout(() => {
        try {
            let pend = 0, aten = 0, noAten = 0;
            let cTech = {};

            trabajosFiltrados.forEach((t) => {
                let est = String(t.estado || "pendiente").toLowerCase();
                if (est === "atendido") aten++;
                else if (est === "no_atendido") noAten++;
                else pend++;

                let asig = t.tecnicos || [];
                if (typeof asig === "string") asig = [asig];

                asig.forEach((tech) => {
                    if (tech !== "Sin Asignar" && tech !== "Todos") cTech[tech] = (cTech[tech] || 0) + 1;
                });
            });

            if(document.getElementById("kpiTotal")) document.getElementById("kpiTotal").innerText = trabajosFiltrados.length;
            if(document.getElementById("kpiAtendidos")) document.getElementById("kpiAtendidos").innerText = aten;
            if(document.getElementById("kpiPendientes")) document.getElementById("kpiPendientes").innerText = pend;
            if(document.getElementById("kpiNoAtendidos")) document.getElementById("kpiNoAtendidos").innerText = noAten;

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
    lblSemana.textContent = `${lunesBase.toLocaleDateString("es", opciones)} — ${domingo.toLocaleDateString("es", opciones)}`;

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

        const trabajosDia = dbTrabajos.filter(
            (t) => (t.zona || "Norte") === zonaActual && t.fecha === diaStr && t.estado !== "por_aprobar_carlos" && t.estado !== "aprobada_wilton" && t.estado !== "rechazada"
        );

        const isActive = diaStr === diaSeleccionado;
        const isToday = diaStr === hoyStr;

        htmlStrip += `<div class="cal-week-day ${isActive ? "active" : ""} ${isToday && !isActive ? "today" : ""}" onclick="window.seleccionarDia('${diaStr}')">
                    <div class="cal-week-dayname">${diasSemana[i]}</div>
                    <div class="cal-week-daynum">${diaNum}</div>
                    ${trabajosDia.length > 0 ? `<div class="cal-week-daycount">${trabajosDia.length}</div>` : ""}
                </div>`;
    }
    weekStrip.innerHTML = htmlStrip;

    const fechaSel = new Date(diaSeleccionado + "T00:00:00");
    dayHeader.textContent = fechaSel.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "short" }).toUpperCase();

    const trabajosSel = dbTrabajos
        .filter((t) => (t.zona || "Norte") === zonaActual && t.fecha === diaSeleccionado && t.estado !== "por_aprobar_carlos" && t.estado !== "aprobada_wilton" && t.estado !== "rechazada")
        .sort((a, b) => (a.horaInicio || "23:59").localeCompare(b.horaInicio || "23:59"));

    if (trabajosSel.length === 0) {
        timelineMini.innerHTML = '<span style="color: var(--text-muted); font-size: 11px;"><i class="fa-solid fa-mug-hot"></i> Sin trabajos programados</span>';
    } else {
        let htmlPills = "";
        trabajosSel.forEach((t) => {
            htmlPills += `<div class="cal-event-pill ${t.tipoTarea || "alta"}" onclick="window.filtrarPorCliente('${t.cliente.replace(/'/g, "\\'")}')" title="${t.cliente} | ${t.horaInicio || "--:--"} | ${t.tecnicos}">
                        <span class="cal-event-dot"></span>${t.horaInicio || "--:--"} · ${t.cliente.split(" ")[0]}
                    </div>`;
        });
        timelineMini.innerHTML = htmlPills;
    }
};

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

window.actualizarCalendarioGeneral = () => {
    const calendarEl = document.getElementById("calendarioGeneral");
    const tecnicoFiltro = document.getElementById("filtroTecnicoCalendario")?.value || "todos";

    if (!calendarEl) return;
    if (window.calendarioInstancia) window.calendarioInstancia.destroy();

    let eventos = [];
    const coloresAsignados = {};
    let idxColor = 0;

    dbTrabajos.forEach((t) => {
        if ((t.zona || "Norte") !== zonaActual || t.estado === "por_aprobar_carlos" || t.estado === "aprobada_wilton" || t.estado === "rechazada") return;
        let tecnicos = Array.isArray(t.tecnicos) ? t.tecnicos : [t.tecnicos || "Sin Asignar"];
        if (tecnicoFiltro !== "todos" && !tecnicos.includes(tecnicoFiltro)) return;

        const techPrincipal = tecnicos[0];
        if (!coloresAsignados[techPrincipal]) {
            coloresAsignados[techPrincipal] = coloresTecnicos[idxColor % coloresTecnicos.length];
            idxColor++;
        }

        let claseColor = "cal-event-alta";
        if (t.tipoTarea === "averia") claseColor = "cal-event-averia";
        if (t.tipoTarea === "baja") claseColor = "cal-event-baja";
        if (t.tipoTarea === "otros") claseColor = "cal-event-alta";

        eventos.push({
            id: t.id, title: `${t.horaInicio || ""} ${t.cliente}`,
            start: t.fecha + "T" + (t.horaInicio || "08:00") + ":00", end: t.fecha + "T" + (t.horaFin || "09:00") + ":00",
            backgroundColor: coloresAsignados[techPrincipal] + "CC", borderColor: coloresAsignados[techPrincipal], textColor: "#ffffff",
            extendedProps: { detalle: t.detalle || "", estado: t.estado || "pendiente", tecnicos: tecnicos.join(", "), notas: t.notas || "", claseTipo: claseColor },
        });
    });

    window.calendarioInstancia = new FullCalendar.Calendar(calendarEl, {
        initialView: "timeGridWeek", 
        locale: "es",
        height: "100%",       // OBLIGA AL CALENDARIO A LLENAR EL MODAL
        expandRows: true,     // ESTIRA LAS HORAS PARA QUE NO QUEDE ESPACIO EN BLANCO
        headerToolbar: { left: "prev,next today", center: "title", right: "timeGridDay,timeGridWeek,dayGridMonth" },
        slotMinTime: "06:00:00", slotMaxTime: "22:00:00", allDaySlot: false, events: eventos,
        eventClick: function(info) {
            const props = info.event.extendedProps;
            mostrarToast(`${info.event.title} | ${props.detalle} | Téc: ${props.tecnicos} | Estado: ${props.estado.toUpperCase()}`);
        }
    });
    window.calendarioInstancia.render();
};

function actualizarOpcionesFechas() {
    const sel = document.getElementById("filtroFecha");
    const tZona = dbTrabajos.filter((t) => (t.zona || "Norte") === zonaActual);
    const fechas = [...new Set(tZona.map((t) => String(t.fecha)))].sort((a, b) => b.localeCompare(a));
    let h = `<option value="todas">Todas las Fechas</option>`;
    fechas.forEach((f) => { h += `<option value="${f}">${formatoFecha(f)}</option>`; });
    let v = sel.value; sel.innerHTML = h;
    if (fechas.includes(v)) sel.value = v;
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
window.ejecutarEliminacion = async () => {
    if (idTrabajoAEliminar) {
        await deleteDoc(doc(coleccionTrabajos, idTrabajoAEliminar));
        mostrarToast("Trabajo Eliminado"); window.cerrarModalEliminar();
    }
};

window.exportarAExcel = () => {
    if (!dbTrabajos || dbTrabajos.length === 0) { mostrarToast("⚠️ No hay datos para exportar."); return; }
    mostrarToast("⏳ Generando Excel...");
    const ws = XLSX.utils.json_to_sheet(dbTrabajos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Trabajos_NOC");
    XLSX.writeFile(wb, `Reporte_Operaciones_${new Date().toISOString().split('T')[0]}.xlsx`);
    mostrarToast("✅ Excel descargado correctamente.");
};

window.toggleCheckbox = (el) => {
    let chk = el.querySelector("input"); chk.checked = !chk.checked;
    let chks = document.querySelectorAll("#techDropdown input:checked");
    document.getElementById("techDisplay").innerText = chks.length === 0 ? "Sin Asignar" : Array.from(chks).map((c) => c.value).join(", ");
};

window.toggleTechDropdown = (e) => { if (e) e.stopPropagation(); document.getElementById("techDropdown").classList.toggle("show"); };

// ==========================================
// CONFIGURACIÓN DINÁMICA DE PLANES
// ==========================================
const planesPorDefecto = [
    { precio: 50, nombre: "PLAN S/. 50 BASICO 2" },
    { precio: 55, nombre: "PLAN S/. 55 BASICO" },
    { precio: 69, nombre: "PLAN S/. 69 PROMO" },
    { precio: 100, nombre: "PLAN S/. 100 MEDIO (Cable Incluido)" },
    { precio: 120, nombre: "PLAN S/. 120 INTER (Cable Incluido)" }
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
    if (!select) return;
    let html = "";
    planes.forEach(p => { html += `<option value="${p.precio}|${p.nombre}">${p.nombre}</option>`; });
    select.innerHTML = html;
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

        let estadoReal = filaLimpia["estadocliente"] || filaLimpia["estado"] || "NO DEFINIDO";
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
            if (window.alertasCobranzaGlobal.length > 0) {
                badge.innerText = window.alertasCobranzaGlobal.length;
                badge.style.display = 'flex';
            } else { badge.style.display = 'none'; }
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
            b.classList.remove("active-alta", "active-averia", "active-baja", "active-otros");
            if (b.id === "tabAveria") { b.style.color = "#8b9bb4"; b.style.borderColor = "var(--panel-border)"; }
            if (b.id === "tabOtros") { b.style.color = "#8b9bb4"; b.style.borderColor = "var(--panel-border)"; }
        });

        let tabActiva = document.getElementById("tab" + tipo.charAt(0).toUpperCase() + tipo.slice(1));
        if (tabActiva) {
            tabActiva.classList.add("active-" + tipo);
            if (tipo === "averia") { tabActiva.style.color = "#2979ff"; tabActiva.style.borderColor = "#2979ff"; }
            if (tipo === "otros") { tabActiva.style.color = "#f59e0b"; tabActiva.style.borderColor = "#f59e0b"; }
        }

        let comunes = document.getElementById("camposClienteComunes");
        let cajaComunes = document.getElementById("camposCajaComunes");
        let buscador = document.getElementById("cajaBuscador");

        if (tipo === "otros") {
            if (comunes) comunes.style.display = "none";
            if (cajaComunes) cajaComunes.style.display = "none";
            if (buscador) buscador.style.display = "none";
        } else {
            if (comunes) comunes.style.display = "block";
            if (cajaComunes) cajaComunes.style.display = "block";
            if (buscador) buscador.style.display = "block";
        }

        let grupoAlta = document.querySelector(".grupo-alta");
        let grupoAveria = document.querySelector(".grupo-averia");
        let grupoBaja = document.querySelector(".grupo-baja");
        let grupoOtros = document.querySelector(".grupo-otros");

        if (grupoAlta) grupoAlta.style.display = tipo === "alta" ? "contents" : "none";
        if (grupoAveria) grupoAveria.style.display = tipo === "averia" ? "block" : "none";
        if (grupoBaja) grupoBaja.style.display = tipo === "baja" ? "block" : "none";
        if (grupoOtros) grupoOtros.style.display = tipo === "otros" ? "block" : "none";

    } catch (e) {
        console.error("Error en seleccionarTipoTarea:", e);
    }
};

window.cambiarSubtipoOtros = () => {
    let tipoSelect = document.getElementById("formTipoOtros");
    if (!tipoSelect) return;
    let tipo = tipoSelect.value;
    let seccionLimpieza = document.getElementById("seccionLimpiezaCaja");
    let seccionFibra = document.getElementById("seccionSeguimientoFibra");
    if (tipo === "Limpieza de caja") {
        if (seccionLimpieza) seccionLimpieza.style.display = "block";
        if (seccionFibra) seccionFibra.style.display = "none";
    } else {
        if (seccionLimpieza) seccionLimpieza.style.display = "none";
        if (seccionFibra) seccionFibra.style.display = "block";
    }
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

window.generarPuertos = () => {
    let cant = parseInt(document.getElementById('formCantPuertos').value);
    let container = document.getElementById('puertosContainer');
    if (cant === 0) { container.innerHTML = ""; return; }
    let html = '';
    for(let i = 1; i <= cant; i++) {
        html += `
        <div class="puerto-row" style="display:flex; gap:8px; align-items:center; background:rgba(0,0,0,0.1); padding:10px; border-radius:8px; border:1px solid var(--panel-border);">
            <span style="font-weight:900; color:var(--brand-orange); width: 30px; text-align:center;">P${i}</span>
            <input type="text" id="puertoId_${i}" class="form-control" placeholder="ID/DNI (Opcional)" style="flex:1; padding:10px; font-size:12px;">
            <button type="button" onclick="window.buscarClientePuerto(${i})" class="btn-guardar" style="width:auto; padding:10px 12px; background:var(--neon-cyan); color:#000; font-size:12px;">🔍</button>
            <input type="text" id="puertoNombre_${i}" class="form-control" placeholder="Escribe o busca un nombre..." style="flex:2; padding:10px; font-size:12px;">
        </div>`;
    }
    container.innerHTML = html;
};

window.buscarClientePuerto = async (index) => {
    const queryVal = document.getElementById(`puertoId_${index}`).value.trim();
    const inputNombre = document.getElementById(`puertoNombre_${index}`);
    if (!queryVal) { mostrarToast("⚠️ Escribe un ID o DNI en la casilla del Puerto " + index); return; }
    inputNombre.value = "Buscando...";
    try {
        let docSnap = await getDocs(query(coleccionClientes, where("id_cliente", "==", queryVal)));
        if (docSnap.empty) docSnap = await getDocs(query(coleccionClientes, where("dni", "==", queryVal)));
        if (!docSnap.empty) {
            const data = docSnap.docs[0].data();
            inputNombre.value = data.nombre;
            mostrarToast(`✅ Cliente encontrado para Puerto ${index}`);
        } else {
            inputNombre.value = "";
            mostrarToast(`❌ No se encontró cliente en la base de datos.`);
        }
    } catch (err) {
        inputNombre.value = "";
        mostrarToast("⚠️ Error en búsqueda.");
        console.error(err);
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
    // Función delegada (el módulo de retención la maneja en su pantalla). 
    // Aquí en NOC solo redireccionamos si un admin intenta usarlo.
    mostrarToast("⚠️ Dirígete al Módulo de Retención en el Menú para gestionar cobros.");
};

// ============================================================ //
// CONTROL UNIVERSAL DE MODALES (CERRAR CON CLICK AFUERA O ESC) //
// ============================================================ //

// 1. Definimos las funciones de cierre faltantes para que la 'X' funcione siempre
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

// 2. Cerrar modal al hacer clic en el fondo oscuro (overlay)
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
    }
});

// 3. Cerrar modal al presionar la tecla Escape
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { 
        document.querySelectorAll('.modal-overlay').forEach(m => {
            if(m.style.display === 'flex' || m.style.display === 'block') {
                m.style.display = 'none';
            }
        });
    }
});