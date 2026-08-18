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

// ============================================================ //
// CONFIGURACIÓN FIREBASE                                       //
// ============================================================ //
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

let isAdmin = false;
let isAdminLurin = false;
let isWilton = false;
let isCarlos = false;
let isVendedor = false;

let nombreTecnicoLogueado = "";
let zonaActual = "Norte";

const tecnicosNorte = ["MPACOTAIPE", "CALARCON", "JPATRICIO", "JCORDOVA", "RRONDON", "RLEON", "JLOLI", "JFERNANDEZ"];
const tecnicosLurin = ["BILLS", "CIELO"];

let chartTecnicos = null;
let unsubscribeTrabajos = null;
let unsubscribeCobranzas = null; // Nueva variable para cancelar escucha de cobranzas
let idTrabajoAEliminar = null;

let idTrabajoCierreSLA = null;
let estadoObjetivoSLA = null;

let ventaAValidarId = null;
let idVentaARechazarRapido = null;

let semanaOffset = 0;
let diaSeleccionado = null;

const MAPA_NOC = "https://www.google.com/maps/d/embed?mid=1EKIxuTIGSM9GJ8YTbP_HCxhh-l5DOFw&ehbc=2E312F";
const MAPA_VENTAS = "https://www.google.com/maps/d/embed?mid=1fMA7B2CSQKbdMlNO6lxVvh9pF_JnY-s&ehbc=2E312F";

window.bdClientesGlobal = [];

function obtenerUrlMapa() {
    return (isAdmin || isAdminLurin || isWilton) ? MAPA_NOC : MAPA_VENTAS;
}

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
    if (isAdmin || isAdminLurin || isWilton || isCarlos || isVendedor) renderizarTabla();
};

// ============================================================ //
// AUTH                                                         //
// ============================================================ //
window.iniciarSesion = () => {
    const email = document.getElementById("txtEmail").value.trim();
    const pass = document.getElementById("txtPassword").value;
    signInWithEmailAndPassword(auth, email, pass).catch(() => {
        let errLabel = document.getElementById("login-error");
        errLabel.innerText = "Error: Verifica tus credenciales.";
        errLabel.style.display = "block";
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

// ============================================================ //
// CERRAR SESIÓN (CORREGIDO)                                    //
// ============================================================ //
window.cerrarSesion = () => { 
    localStorage.removeItem('ten_rol'); 
    localStorage.removeItem('ten_email'); 
    localStorage.removeItem('ten_nombre_tecnico'); 
    signOut(auth); 
};

window.cambiarZona = (z) => {
    zonaActual = z;
    actualizarFiltroTecnicos();
    renderizarTabla();
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById("login-view").style.display = "none";
        document.getElementById("dashboard-view").style.display = "block";

        const email = user.email.toLowerCase();

        // 1. Listas de correos actualizadas
        const correosAdminGlobal = ["admin@ten.com", "rpacotaipe@ten.com", "eolortegui@ten.com", "jpalomino@ten.com", "dpacotaipe@ten.com"];
        const correosAdminLurin = ["ecuta@ten.com", "strujillo@ten.com"];
        const coordinadoresVentas = ["carlos@ten.com", "jrodriguez@ten.com", "mventocilla@ten.com", "cpacotaipe@ten.com"];
        const areaCobranzas = ["calvino@ten.com", "oalvino@ten.com"];

        isAdmin = correosAdminGlobal.includes(email);
        isAdminLurin = correosAdminLurin.includes(email);
        isWilton = email === "wherrera@ten.com";
        isCarlos = coordinadoresVentas.includes(email);
        isVendedor = email.includes("ventas");
        
        let isCobranzas = areaCobranzas.includes(email);

        let nombreUsuarioAdmin = email.split("@")[0].toUpperCase();

        document.querySelectorAll(".admin-only, .admin-wilton-only, .admin-carlos-only").forEach((el) => {
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
            // WILTON Y COBRANZAS ESTÁN JUNTOS AQUÍ
            nombreTecnicoLogueado = email.split("@")[0].toUpperCase();
            
            document.getElementById("lblUsuarioActivo").innerHTML = isCobranzas ? 
                `💰 COBRANZAS <br><span style="font-size:10px; color:var(--text-muted); font-weight:900;">${nombreTecnicoLogueado}</span>` : 
                `🛠️ WILTON SOPORTE`;
            
            localStorage.setItem('ten_rol', 'admin');
            localStorage.setItem('ten_email', email);

            document.getElementById("contenedorSelectorZona").classList.add("show-admin-flex");
            document.getElementById("contenedorSelectorZona").style.display = "flex";
            
            document.querySelectorAll(".admin-wilton-only").forEach((el) => el.classList.add("show-admin-flex"));
            
            if (isCobranzas) {
                document.querySelectorAll(".admin-carlos-only").forEach((el) => el.classList.add("show-admin-flex"));
            }
            
            document.getElementById("panelGraficosAdmin").classList.add("show-admin-grid");
            
            configurarGraficosBase(isCobranzas ? "COBRANZAS Y NOC" : "TOTALES", "Total", "Atendidos", "Pendientes");
            zonaActual = document.getElementById("selectorZona").value;
            
        } else if (isCarlos || isVendedor) {
            // VENTAS Y COORDINADORES (MILI, CARLOS, CPACOTAIPE)
            let nombreLimpio = email.split("@")[0].split(".")[0].toUpperCase();
            nombreTecnicoLogueado = nombreLimpio;

            document.getElementById("lblUsuarioActivo").innerHTML = isCarlos ? `📋 COORD. ${nombreLimpio}` : `💼 ${nombreLimpio}`;
            
            localStorage.setItem('ten_rol', 'ventas');
            localStorage.setItem('ten_email', email);

            document.querySelectorAll(".admin-carlos-only").forEach((el) => el.classList.add("show-admin-flex"));

            const panelGraficos = document.getElementById("panelGraficosAdmin");
            panelGraficos.classList.add("show-admin-grid");

            if (document.getElementById("cardCalendarioNoc")) document.getElementById("cardCalendarioNoc").style.display = "none";
            if (document.getElementById("cardGraficoTecnicos")) document.getElementById("cardGraficoTecnicos").style.display = "none";
            if (document.getElementById("cardKpisClientes")) document.getElementById("cardKpisClientes").style.display = "none";

            configurarGraficosBase("REPORTE DE VENTAS", "Total Registradas", "Instaladas", "Por Instalar");
            zonaActual = "Norte";

        } else {
            // TÉCNICOS NORMALES
            nombreTecnicoLogueado = email.split("@")[0].toUpperCase();
            document.getElementById("lblUsuarioActivo").innerHTML = `🛠️ ${nombreTecnicoLogueado}`;
            
            // Usamos la variable global tecnicosLurin ya declarada arriba (sin redeclarar)
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

        // CONFIGURAMOS EL SELECTOR DE MÓDULO (NOC vs RETENCIÓN)
        let fMod = document.getElementById("filtroModuloContainer");
        let isCobranzasFlag = typeof nombreTecnicoLogueado !== "undefined" && (nombreTecnicoLogueado === "CALVINO" || nombreTecnicoLogueado === "OALVINO");
        
        if (fMod) {
            let selectMod = document.getElementById("filtroModulo");
            if (isAdmin || isAdminLurin || isCarlos || isCobranzasFlag) {
                fMod.style.display = "flex";
                if (isCarlos) {
                    selectMod.innerHTML = `<option value="alta">🚀 Instalaciones</option><option value="retencion">📞 Retención</option>`;
                    selectMod.value = "retencion";
                } else if (isCobranzasFlag) {
                    selectMod.innerHTML = `<option value="noc">🌍 Operaciones NOC</option><option value="retencion">📞 Retención</option><option value="todos">👁️ Ver Todo</option>`;
                    selectMod.value = "retencion";
                } else {
                    selectMod.innerHTML = `<option value="noc">🌍 Operaciones NOC</option><option value="retencion">📞 Retención</option><option value="todos">👁️ Ver Todo</option>`;
                    selectMod.value = "noc";
                }
                if(typeof window.cambiarModuloVentas === 'function') window.cambiarModuloVentas();
            } else {
                fMod.style.display = "none";
            }
        }

        actualizarFiltroTecnicos();
        cargarTrabajosEnVivo();

        if (isAdmin || isWilton || isCarlos || isCobranzasFlag) {
            if (typeof window.iniciarEscuchaCobranzas === 'function') window.iniciarEscuchaCobranzas();
        }

        if (!localStorage.getItem("kpi_total")) {
            console.log("Dispositivo nuevo detectado. Descargando BD de Firebase...");
            mostrarToast("📥 Dispositivo nuevo: Sincronizando clientes por primera vez...");
            if (typeof window.descargarExcelDeFirebase === 'function') {
                window.descargarExcelDeFirebase();
            }
        }

    } else {
        // SI NO ESTÁ LOGUEADO, LO REGRESA A LA PANTALLA NEGRA
        if (unsubscribeTrabajos) unsubscribeTrabajos();
        if (unsubscribeCobranzas) unsubscribeCobranzas();
        dbTrabajos = [];
        document.getElementById("login-view").style.display = "flex";
        document.getElementById("dashboard-view").style.display = "none";
    }
});

// ============================================================ //
// FUNCIONES AUXILIARES Y DE INTERFAZ                           //
// ============================================================ //
function configurarGraficosBase(titulo, lTotal, lSuccess, lWarning) {
    const panelGraficos = document.getElementById("panelGraficosAdmin");
    
    if (isAdmin || isAdminLurin || isWilton) {
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
    document.getElementById("filtroTecnico").innerHTML = html;
}

function actualizarSelectTecnicosModal() {
    let lista = zonaActual === "Norte" ? tecnicosNorte : tecnicosLurin;
    let html = ``;
    lista.forEach((t) => {
        html += `<div class="multi-option" onclick="window.toggleCheckbox(this)"><input type="checkbox" value="${t}"><label>${t}</label></div>`;
    });
    document.getElementById("techDropdown").innerHTML = html;
    document.getElementById("techDisplay").innerText = "Sin Asignar";
}

function cargarTrabajosEnVivo() {
    if (unsubscribeTrabajos) unsubscribeTrabajos();

    unsubscribeTrabajos = onSnapshot(coleccionTrabajos, (snapshot) => {
        dbTrabajos = [];
        snapshot.forEach((doc) => { dbTrabajos.push({ id: doc.id, ...doc.data() }); });
        actualizarOpcionesFechas();
        renderizarTabla();
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
        clienteLocal = window.bdClientesGlobal.find(c => c.dni === queryVal);
    }

    if (clienteLocal) {
        document.getElementById("formNombre").value = clienteLocal.nombre || "";
        document.getElementById("formDni").value = clienteLocal.dni || "";
        let tels = clienteLocal.telefonos && clienteLocal.telefonos.length > 0 ? clienteLocal.telefonos : [];
        document.getElementById("formTelefonoPrincipal").value = tels[0] || "";
        document.getElementById("formTelefonoSecundario").value = tels.slice(1).join(" / ") || "";
        document.getElementById("formDireccion").value = clienteLocal.zona ? `${clienteLocal.zona} - ${clienteLocal.direccion}` : clienteLocal.direccion;
        document.getElementById("formMapa").value = clienteLocal.linkMapa || "";
        document.getElementById("formInfoRedAveria").value = `Plan: ${clienteLocal.plan || "Sin Plan"}`;
        
        msg.innerText = "✅ Autocompletado desde tu Base de Datos Excel";
        msg.style.color = "var(--success)";
        return;
    }

    try {
        let docSnap = await getDocs(query(coleccionClientes, where("id_cliente", "==", queryVal)));
        if (docSnap.empty) docSnap = await getDocs(query(coleccionClientes, where("dni", "==", queryVal)));
        if (!docSnap.empty) {
            const data = docSnap.docs[0].data();
            document.getElementById("formNombre").value = data.nombre; document.getElementById("formDni").value = data.dni;
            let tels = data.telefonos ? data.telefonos.split(" / ") : [];
            document.getElementById("formTelefonoPrincipal").value = tels[0] || ""; document.getElementById("formTelefonoSecundario").value = tels.slice(1).join(" / ") || "";
            document.getElementById("formDireccion").value = data.zona ? `${data.zona} - ${data.direccion}` : data.direccion;
            document.getElementById("formMapa").value = data.ubicacion; document.getElementById("formInfoRedAveria").value = `Plan: ${data.plan} | TV: ${data.info_tv}`;
            msg.innerText = "✅ Cliente Autocompletado (Nube)"; msg.style.color = "var(--success)";
        } else { msg.innerText = "❌ Cliente no encontrado en ningún registro."; msg.style.color = "var(--danger)"; }
    } catch (err) { msg.innerText = "⚠️ Error de red en la búsqueda."; msg.style.color = "var(--warning)"; }
};

window.calcularPrecioTotal = () => {
    let planVal = document.getElementById("formPlanVenta").value;
    let precioBase = parseInt(planVal.split("|")[0]);
    let tipoServicio = document.getElementById("formTipoServicio").value;
    let precioFinal = precioBase;

    if (tipoServicio === "Internet + Cable" && (precioBase === 50 || precioBase === 55 || precioBase === 69)) {
        precioFinal += 20;
    }
    document.getElementById("formPrecioTotal").innerText = `S/ ${precioFinal}`;
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
        
        try {
            window.seleccionarTipoTarea("alta");
        } catch (e) {
            console.error("Error en seleccionarTipoTarea:", e);
            let grupoAlta = document.querySelector(".grupo-alta");
            let grupoAveria = document.querySelector(".grupo-averia");
            let grupoBaja = document.querySelector(".grupo-baja");
            let grupoOtros = document.querySelector(".grupo-otros");
            let grupoRetencion = document.querySelector(".grupo-retencion");
            if (grupoAlta) grupoAlta.style.display = "contents";
            if (grupoAveria) grupoAveria.style.display = "none";
            if (grupoBaja) grupoBaja.style.display = "none";
            if (grupoOtros) grupoOtros.style.display = "none";
            if (grupoRetencion) grupoRetencion.style.display = "none";
        }

        let isTecnicoCampo = !isAdmin && !isAdminLurin && !isWilton && !isCarlos && !isVendedor;

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
        } else if (isVendedor || isCarlos) {
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
            let retencion = document.getElementById("tabRetencion");
            if (retencion) retencion.style.display = isCarlos ? "block" : "none"; 
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
            let retencion = document.getElementById("tabRetencion");
            if (retencion) retencion.style.display = "none";
            let sede = document.getElementById("grupoSedeVenta");
            if (sede) sede.style.display = "none";
            let otrosInput = document.getElementById("formTipoOtros");
            if (otrosInput) otrosInput.disabled = false;
        }

        let modal = document.getElementById("modalAgregar");
        if (modal) modal.style.display = "flex";
        console.log("✅ Modal abierto correctamente");
    } catch (error) {
        console.error("❌ Error al abrir modal:", error);
        try {
            let modal = document.getElementById("modalAgregar");
            if (modal) modal.style.display = "flex";
        } catch (e) {
            console.error("❌ No se pudo mostrar el modal:", e);
        }
        mostrarToast("⚠️ Error al abrir el modal. Revisa la consola.");
    }
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
    } else if (t.tipoTarea === "retencion") {
        document.getElementById("formEstadoLlamada").value = t.estadoLlamada || "En Seguimiento";
        document.getElementById("formNotasRetencion").value = t.notas || "";
        // Campos comunes
        document.getElementById("formNombre").value = t.cliente || "";
        document.getElementById("formDni").value = t.dni || "";
        let telsArray = (t.tel || "").split(" / ");
        document.getElementById("formTelefonoPrincipal").value = telsArray[0] || "";
        document.getElementById("formTelefonoSecundario").value = telsArray.slice(1).join(" / ") || "";
        document.getElementById("formDireccion").value = t.dir || "";
        // Cargar el select de asignación si existe
        let selectAsig = document.getElementById("formAsignadoRetencion");
        if (selectAsig && t.asignadoRetencion) {
            selectAsig.value = t.asignadoRetencion;
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
        
    } else if (tipo === "retencion") {
        let estadoLl = document.getElementById("formEstadoLlamada").value;
        if (estadoLl === "Retiro Definitivo") {
            // MAGIA: Carlos solicita retiro. Se transforma a BAJA y pasa a la bandeja de Wilton.
            tipo = "baja"; 
            data.tipoTarea = "baja";
            data.detalle = "Retiro de Equipos";
            data.notas = document.getElementById("formNotasRetencion").value;
            data.estado = "pendiente"; 
            data.tecnicos = ["Sin Asignar"]; 
        } else {
            // Sigue siendo Retención
            data.estadoLlamada = estadoLl;
            data.detalle = "Llamada - " + estadoLl;
            data.notas = document.getElementById("formNotasRetencion").value;
            data.tecnicos = ["Sin Asignar"]; // Se queda en la bandeja de ventas
            
            // NUEVO: Guardar si es de Carlos o Mili (Forzamos MAYÚSCULAS para evitar bugs)
            let selectAsignado = document.getElementById("formAsignadoRetencion");
            if (selectAsignado) {
                data.asignadoRetencion = selectAsignado.value.toUpperCase();
            }
        }
        
        data.cliente = document.getElementById("formNombre").value || "Cliente en Retención";
        data.dni = document.getElementById("formDni").value || "";
        data.tel = telFinal;
        data.dir = document.getElementById("formDireccion").value;
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
            const precioVal = parts[0];
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
// RENDERIZAR TABLA (CON REGLAS ESTRICTAS Y MENSAJE VACÍO)     //
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
        // 1. Primero ordena por fecha
        let res = (b.fecha || "").localeCompare(a.fecha || "");
        if (res !== 0) return res;
        
        // 2. Si es la misma fecha, ordena de mañana a noche (8 AM a 9 AM)
        let horaA = a.horaInicio || "23:59";
        let horaB = b.horaInicio || "23:59";
        
        // Convertimos las horas (ej. "08:30") a minutos totales para evitar bugs
        let minA = (parseInt(horaA.split(':')[0] || 23) * 60) + parseInt(horaA.split(':')[1] || 59);
        let minB = (parseInt(horaB.split(':')[0] || 23) * 60) + parseInt(horaB.split(':')[1] || 59);
        
        return minA - minB; // Ascendente: El más bajo (ej. 8am = 480min) va arriba.
    });

    const moduloSeleccionado = document.getElementById("filtroModulo")?.value || "todos";
    const tecnicoFiltro = document.getElementById("filtroTecnico")?.value || "todos";

    tOrdenado.forEach((t) => {
        try {
            let asig = t.tecnicos || ["Sin Asignar"];
            if (typeof asig === "string") asig = [asig];
            
            let estActual = String(t.estado || "pendiente").toLowerCase();
            
            let esRetencion = (t.tipoTarea === "retencion") || (t.tipoTarea === "otros" && t.detalle === "Llamada");
            let esAprobacion = (estActual === "por_aprobar_carlos" || estActual === "aprobada_wilton" || estActual === "rechazada");

            let isCobranzas = (nombreTecnicoLogueado === "CALVINO" || nombreTecnicoLogueado === "OALVINO");

            // 🛡️ REGLAS ESTRICTAS DE VISIBILIDAD:
            if (isCarlos) { // Esto incluye a JRODRIGUEZ, MVENTOCILLA, CPACOTAIPE
                if (moduloSeleccionado === "alta" && t.tipoTarea !== "alta") return;
                if (moduloSeleccionado === "retencion" && !esRetencion) return;
                
                // MÁGIA: Se aísla la retención para que cada quien vea la suya.
                if (esRetencion && t.asignadoRetencion && t.asignadoRetencion.toUpperCase() !== nombreTecnicoLogueado) return;
            } else if (isVendedor) {
                if (t.tipoTarea !== "alta" || t.vendedor !== nombreTecnicoLogueado) return;
            } else if (isWilton) {
                if (esRetencion) return; // Wilton normal no ve retención
            } else if (isCobranzas) {
                // Cobranzas es un Dios como el Admin, ve Retención (todos) y NOC (todos)
                if (moduloSeleccionado === "noc" && esRetencion) return;
                if (moduloSeleccionado === "retencion" && !esRetencion) return;
            } else if (isAdmin || isAdminLurin) {
                if (moduloSeleccionado === "noc" && esRetencion) return;
                if (moduloSeleccionado === "retencion" && !esRetencion) return;
            } else {
                // Técnicos normales...
                if (esRetencion) return;
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

            let colorBadge = t.tipoTarea === "alta" ? "alta" : t.tipoTarea === "averia" ? "averia" : t.tipoTarea === "baja" ? "baja" : "otros";
            let nombreTipo = t.tipoTarea === "alta" ? "🚀 ALTA" : t.tipoTarea === "averia" ? "🛠️ AVERÍA" : t.tipoTarea === "baja" ? "🛑 BAJA" : "⚙️ OTROS TRABAJOS";
            let docLabel = t.tipoDoc || "DNI";

            let infoCli = `<span class="cliente-nombre">${t.cliente}</span>`;
            
            if (t.tipoTarea === "otros") {
                if (t.detalle === "Limpieza de caja") {
                    infoCli += `<span class="cliente-info"><span class="lbl-info">PUERTOS:</span> <b style="color:var(--text-main);">${t.cantPuertos || 0}</b></span>`;
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
                           ${(t.vendedor && t.tipoTarea === "alta") ? `<span class="cliente-info mt-1"><span class="lbl-info" style="color:var(--danger)">VENDEDOR:</span> <b style="color:var(--danger);">${t.vendedor}</b></span>` : ""}`;
            }

            let extrasHtml = "";
            if (t.tipoTarea === "alta") {
                if (t.caja || t.puerto) extrasHtml += `<span class="cliente-info mt-1" style="color:var(--purple)"><span class="lbl-info">CAJA:</span> ${t.caja || "--"} | <span class="lbl-info">P:</span> ${t.puerto || "--"}</span>`;
                if (t.periodo || t.comprobante) extrasHtml += `<span class="cliente-info"><span class="lbl-info">PAGO:</span> ${t.periodo || ""} | ${t.comprobante || ""}</span>`;
            }
            if (t.tipoTarea === "averia" && t.infoRed) extrasHtml = `<span class="cliente-info mt-1"><span class="lbl-info">RED:</span> ${t.infoRed}</span>`;
            if (t.tipoTarea === "baja" && t.equipos) extrasHtml = `<span class="cliente-info mt-1" style="color:var(--danger)"><span class="lbl-info">RECOGER:</span> ${t.equipos}</span>`;

            if (t.tx || t.rx) {
                extrasHtml += `<div style="background: rgba(0,229,255,0.05); border: 1px dashed var(--accent); padding: 4px 8px; border-radius: 4px; margin-top: 6px; display: inline-block;">
                    <span class="cliente-info m-0" style="color:var(--accent); font-size:11px;"><span class="lbl-info">📡 SEÑAL ROUTER:</span> TX: <b>${t.tx || "--"}</b> | RX: <b>${t.rx || "--"}</b></span>
                </div>`;
            }
            if (t.senalCaja) {
                extrasHtml += `<div style="background: rgba(245,158,11,0.05); border: 1px dashed var(--warning); padding: 4px 8px; border-radius: 4px; margin-top: 6px; display: inline-block;">
                    <span class="cliente-info m-0" style="color:var(--warning); font-size:11px;"><span class="lbl-info">📡 SEÑAL CAJA:</span> <b>${t.senalCaja}</b></span>
                </div>`;
            }

            let slaHtml = "";
            if (t.tsInicio) {
                let hrInicio = new Date(t.tsInicio).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
                let hrFin = t.tsFin ? new Date(t.tsFin).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "--:--";
                let duracion = t.tsInicio && t.tsFin ? `(${Math.floor(Math.floor((t.tsFin - t.tsInicio) / 60000) / 60)}h ${Math.floor((t.tsFin - t.tsInicio) / 60000) % 60}m)` : "(En curso...)";
                slaHtml = `<div style="background: rgba(0,229,255,0.05); border: 1px dashed var(--accent); padding: 8px; border-radius: 6px; margin-top: 8px;">
                    <span class="cliente-info m-0" style="color:var(--accent)"><span class="lbl-info">⏱️ SLA:</span> Inicio: ${hrInicio} | Fin: ${hrFin} <b>${duracion}</b></span>
                    ${t.notaCierre ? `<span class="cliente-info mt-1 m-0" style="color:var(--success)"><span class="lbl-info">📝 NOTA TEC:</span> ${t.notaCierre}</span>` : ""}
                </div>`;
            }

            let refHtml = t.referencia ? `<span class="cliente-info"><span class="lbl-info">REF:</span> ${t.referencia}</span>` : "";
            let notaEstilo = estActual === "rechazada" ? "color: var(--danger); font-weight: bold; background: rgba(239, 68, 68, 0.1); padding: 4px; border-radius: 4px;" : "color: var(--warning); font-weight:bold;";

            let dirH = `<span class="badge-tipo ${colorBadge}">${nombreTipo} - ${t.detalle}</span>
                    <span class="cliente-info mt-1"><span class="lbl-info">DIR:</span> ${t.dir}</span>
                    ${refHtml}
                    <span class="cliente-info"><span class="lbl-info">FECHA:</span> ${formatoFecha(t.fecha)} | ${t.horaInicio || "--:--"} a ${t.horaFin || "--:--"}</span>
                    <span class="cliente-info"><span class="lbl-info">TEC:</span> <b>${asig.join(", ")}</b></span>
                    ${extrasHtml}
                    ${t.notas ? `<span class="cliente-info mt-1" style="${notaEstilo}"><span class="lbl-info">NOTA:</span> ${t.notas}</span>` : ""}
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
                botonesHtml += `<div class="btn-grid-row">
                            <button type="button" class="btn-action-ui btn-ui-estado" onclick="aprobarDirecto('${t.id}')"><i class="fa-solid fa-thumbs-up"></i> Aprobar</button>
                            <button type="button" class="btn-action-ui btn-ui-eliminar" onclick="rechazarDirecto('${t.id}')"><i class="fa-solid fa-xmark"></i> Rechazar</button>
                        </div>`;
            }

            if ((isWilton || isAdmin || isAdminLurin) && estActual === "aprobada_wilton") {
                botonesHtml += `<div class="btn-grid-row"><button type="button" class="btn-action-ui btn-ui-estado" onclick="editarTrabajo('${t.id}')"><i class="fa-solid fa-calendar"></i> Programar</button></div>`;
            }

            // ============================================================ //
            // BOTONES DE ESTADO DUALES (RETENCIÓN vs NOC)                   //
            // ============================================================ //
            let textoAccion = ""; let iconAccion = "";
            let mostrarBtnEstado = false;

            if (esRetencion) {
                if (estActual === "pendiente") { textoAccion = "Marcar Atendido"; iconAccion = "fa-check"; } 
                else if (estActual === "atendido") { textoAccion = "No Atendido"; iconAccion = "fa-xmark"; } 
                else if (estActual === "no_atendido") { textoAccion = "A Pendiente"; iconAccion = "fa-backward"; }
                
                if (isCarlos || isAdmin || isAdminLurin || isCobranzas) mostrarBtnEstado = true;
            } else {
                if (estActual === "pendiente") { textoAccion = "En Camino"; iconAccion = "fa-person-walking"; } 
                else if (estActual === "en_camino") { textoAccion = "Finalizar"; iconAccion = "fa-check"; } 
                else if (estActual === "atendido") { textoAccion = "No Atendido"; iconAccion = "fa-xmark"; } 
                else if (estActual === "no_atendido") { textoAccion = "A Pendiente"; iconAccion = "fa-backward"; }

                if (!isVendedor && !isCarlos && !isWilton && !isAdmin && !isAdminLurin && !esAprobacion) mostrarBtnEstado = true;
            }

            if (mostrarBtnEstado && textoAccion !== "") {
                botonesHtml += `<div class="btn-grid-row"><button type="button" class="btn-action-ui btn-ui-estado" onclick="cambiarEstado('${t.id}', '${estActual}', ${esRetencion})"><i class="fa-solid ${iconAccion}"></i> ${textoAccion}</button></div>`;
            }

            let btnCajaHtml = '';
            if (t.tipoTarea === "alta" || t.tipoTarea === "otros" || t.linkCaja) {
                if (t.linkCaja) btnCajaHtml = `<a href="${t.linkCaja}" target="_blank" class="btn-action-ui btn-ui-nap"><i class="fa-solid fa-box"></i> Ver Caja NAP</a>`;
                else btnCajaHtml = `<button type="button" class="btn-action-ui btn-ui-nap" disabled><i class="fa-solid fa-box"></i> Sin Caja</button>`;
            }

            let btnMapaHtml = '';
            if (t.mapa) {
                let isTecnico = !isVendedor && !isCarlos && !isWilton && !isAdmin && !isAdminLurin;
                let isLurinUser = zonaActual === "Lurin" || isAdminLurin;
                if (isTecnico || isLurinUser) btnMapaHtml = `<a href="${t.mapa}" target="_blank" class="btn-action-ui btn-ui-mapa"><i class="fa-solid fa-location-dot"></i> Mapa</a>`;
                else btnMapaHtml = `<button type="button" class="btn-action-ui btn-ui-mapa" onclick="verMapaCliente('${t.id}')"><i class="fa-solid fa-location-dot"></i> Mapa</button>`;
            } else {
                btnMapaHtml = `<button type="button" class="btn-action-ui btn-ui-mapa" disabled><i class="fa-solid fa-location-dot"></i> Mapa</button>`;
            }

            botonesHtml += `<div class="btn-grid-row">${btnMapaHtml} ${btnCajaHtml}</div>`;

            if (numLimpio.length > 5 && t.tipoTarea !== "otros") botonesHtml += `<div class="btn-grid-row"><a href="${linkWsp}" target="_blank" class="btn-action-ui btn-ui-wsp"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a></div>`;

            let isTecnico = !isVendedor && !isCarlos && !isWilton && !isAdmin && !isAdminLurin;
            let btnSenalHtml = "";
            let textoBtnEditar = "<i class='fa-solid fa-pen'></i> Editar";
            let permitirEditarTecnico = false;

            if (t.tipoTarea === "alta" || t.tipoTarea === "averia" || (t.tipoTarea === "otros" && t.detalle === "Seguimiento de fibra")) {
                btnSenalHtml = `<button type="button" class="btn-action-ui" style="background: rgba(0, 229, 255, 0.1); border: 1px solid var(--accent); color: var(--accent);" onclick="abrirModalSenal('${t.id}', '${t.tipoTarea}', '${t.detalle}')"><i class="fa-solid fa-satellite-dish"></i> Registrar Señal</button>`;
            } else if (t.tipoTarea === "otros" && t.detalle === "Limpieza de caja") {
                permitirEditarTecnico = true; 
                if (isTecnico) textoBtnEditar = "<i class='fa-solid fa-list-check'></i> Puertos/Señal";
            }

            let btnEditGralHtml = "";
            if (isAdmin || isAdminLurin || isWilton || isCarlos || isVendedor || permitirEditarTecnico || isCobranzas) {
                btnEditGralHtml = `<button type="button" class="btn-action-ui btn-ui-editar" onclick="editarTrabajo('${t.id}')">${textoBtnEditar}</button>`;
            }

            if (btnSenalHtml !== "") botonesHtml += `<div class="btn-grid-row">${btnSenalHtml}</div>`;
            
            botonesHtml += `<div class="btn-grid-row">
                        <button type="button" class="btn-action-ui btn-ui-copiar" onclick="copiarDatos(this)"><i class="fa-solid fa-copy"></i> Copiar</button>
                        ${btnEditGralHtml}
                    </div>`;

            if (isAdmin || isAdminLurin) {
                botonesHtml += `<div class="btn-grid-row"><button type="button" class="btn-action-ui btn-ui-eliminar" onclick="preguntarEliminar('${t.id}')"><i class="fa-solid fa-trash"></i> Eliminar</button></div>`;
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
    if (!isAdmin && !isAdminLurin && !isWilton && !isCarlos && !isVendedor) return;

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

            document.getElementById("kpiTotal").innerText = trabajosFiltrados.length;
            document.getElementById("kpiAtendidos").innerText = aten;
            document.getElementById("kpiPendientes").innerText = pend;
            document.getElementById("kpiNoAtendidos").innerText = noAten;

            if (typeof window.renderizarCalendario === "function") window.renderizarCalendario();

            if (isAdmin || isAdminLurin || isWilton) {
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

        htmlStrip += `<div class="cal-week-day ${isActive ? "active" : ""} ${isToday && !isActive ? "today" : ""}" onclick="seleccionarDia('${diaStr}')">
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
            htmlPills += `<div class="cal-event-pill ${t.tipoTarea || "alta"}" onclick="filtrarPorCliente('${t.cliente.replace(/'/g, "\\'")}')" title="${t.cliente} | ${t.horaInicio || "--:--"} | ${t.tecnicos}">
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
    if (buscador) { buscador.value = nombre; renderizarTabla(); mostrarToast(`🔍 Filtrando: ${nombre}`); }
};

const coloresTecnicos = ["#0ea5e9", "#f43f5e", "#10b981", "#f59e0b", "#8b5cf6", "#f97316", "#06b6d4", "#14b8a6"];

window.abrirModalCalendario = () => {
    document.getElementById("modalCalendario").style.display = "flex";
    let listaTecnicos = zonaActual === "Norte" ? tecnicosNorte : tecnicosLurin;
    let htmlFiltro = `<option value="todos">Todos los Técnicos</option>`;
    listaTecnicos.forEach((t) => { htmlFiltro += `<option value="${t}">${t}</option>`; });
    document.getElementById("filtroTecnicoCalendario").innerHTML = htmlFiltro;
    actualizarCalendarioGeneral();
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
        initialView: "timeGridWeek", locale: "es",
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
    t.innerHTML = msg; t.className = "show";
    setTimeout(() => { t.className = t.className.replace("show", ""); }, 3000);
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
                    <button class="btn-danger-outline" onclick="eliminarPlanConfig(${index})" style="padding: 4px 8px; font-size: 11px;"><i class="fa-solid fa-trash"></i></button>
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
// MÓDULO: CRM DE COBRANZAS Y EXCEL
// ==========================================

// ==========================================
// NUEVO MOTOR DE LECTURA DE EXCEL (Lee todo sin borrar nada)
// ==========================================
window.procesarExcelClientes = (event) => {
    let file = event.target.files[0];
    if (!file) return;
    
    mostrarToast("⏳ Leyendo Excel y calculando datos...");
    
    let reader = new FileReader();
    reader.onload = function(e) {
        try {
            let data = new Uint8Array(e.target.result);
            let workbook = XLSX.read(data, {type: 'array'});
            let worksheet = workbook.Sheets[workbook.SheetNames[0]];
            
            window.bdClientesGlobal = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            
            // 1. CÁLCULO NUCLEAR
            let activos = 0, suspendidos = 0, retirados = 0;
            window.bdClientesGlobal.forEach(c => {
                let fila = {};
                for (let llave in c) {
                    let llaveMilitar = llave.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
                    fila[llaveMilitar] = c[llave];
                }
                let estMinus = String(fila["estadocliente"] || fila["estado"] || "").toLowerCase().trim();
                if (estMinus.includes("activo")) activos++;
                else if (estMinus.includes("suspendido") || estMinus.includes("cortado")) suspendidos++;
                else if (estMinus.includes("retirado") || estMinus.includes("baja")) retirados++;
            });

            let total = activos + suspendidos + retirados;
            if(total === 0) total = window.bdClientesGlobal.length;

            // 2. ACTUALIZACIÓN VISUAL AL INSTANTE (Magia sin F5)
            let opcionesFecha = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
            let fechaHoy = new Date().toLocaleDateString('es-PE', opcionesFecha);

            document.getElementById("kpiCliActivos").innerText = activos;
            document.getElementById("kpiCliSuspendidos").innerText = suspendidos;
            document.getElementById("kpiCliRetirados").innerText = retirados;
            document.getElementById("kpiCliTotal").innerText = total;
            
            let lblFecha = document.getElementById("lblFechaBD");
            if(lblFecha) lblFecha.innerText = `Act: ${fechaHoy}`;
            
            let pctAct = Math.round((activos / total) * 100) || 0;
            let pctSus = Math.round((suspendidos / total) * 100) || 0;
            let pctRet = Math.round((retirados / total) * 100) || 0;
            
            document.getElementById("pctActivos").innerText = `(${pctAct}%)`;
            document.getElementById("pctSuspendidos").innerText = `(${pctSus}%)`;
            document.getElementById("pctRetirados").innerText = `(${pctRet}%)`;

            // Guardar en memoria local
            localStorage.setItem("kpi_activos", activos);
            localStorage.setItem("kpi_suspendidos", suspendidos);
            localStorage.setItem("kpi_retirados", retirados);
            localStorage.setItem("kpi_total", total); 
            localStorage.setItem("kpi_fecha", fechaHoy);

            // 3. GUARDAR EN EL DISCO DURO DEL NAVEGADOR
            const request = indexedDB.open("TEN_DB_CLIENTES", 1);
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
                    
                    // Nota: La subida a Firebase ahora es manual
                    mostrarToast("✅ Excel Local guardado correctamente.");
                };
            };
        } catch(error) {
            console.error(error);
            mostrarToast("❌ Error al leer el Excel.");
        }
    };
    reader.readAsArrayBuffer(file);
};

// ==========================================
// BUSCADOR AVANZADO Y ENVIO MASIVO (CON PRE-ENVÍO)
// ==========================================
window.abrirModalFiltroBD = () => {
    if (window.bdClientesGlobal.length === 0) { mostrarToast("⚠️ Debes Cargar el Excel primero."); return; }
    let zonas = new Set(); let planes = new Set(); let meses = new Set(); let anios = new Set();
    
    window.bdClientesGlobal.forEach(c => { 
        if (c.zona) zonas.add(c.zona); 
        if (c.plan) planes.add(c.plan);
        if (c.mes) meses.add(c.mes);
        if (c.anio) anios.add(c.anio);
    });
    
    let htmlZonas = '<option value="Todas">Todas las Zonas</option>'; [...zonas].sort().forEach(z => htmlZonas += `<option value="${z}">${z}</option>`); document.getElementById('filtroBdZona').innerHTML = htmlZonas;
    let htmlPlanes = '<option value="Todos">Todos los Planes</option>'; [...planes].sort().forEach(p => htmlPlanes += `<option value="${p}">${p}</option>`); document.getElementById('filtroBdPlan').innerHTML = htmlPlanes;
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

    (window.bdClientesGlobal || []).forEach(c => {
        if (!c) return;

        // 🧹 ASPIRADORA: Convierte los títulos del Excel a minúsculas y les quita espacios fantasma
        let filaLimpia = {};
        for(let key in c) {
            filaLimpia[key.toLowerCase().trim()] = c[key];
        }

        // 🛡️ LECTURA PERFECTA Y BLINDADA
        let nom = filaLimpia["apellidos y nombres"] || filaLimpia["nombre"] || "Sin Nombre";
        let numDni = filaLimpia["n° documento"] || filaLimpia["dni"] || filaLimpia["id_cliente"] || "";
        let tipoDoc = filaLimpia["tipo de documento"] ? filaLimpia["tipo de documento"] + " " : "DNI ";
        let dniMostrar = tipoDoc + numDni;

        // ESTADO GARANTIZADO
        let estadoReal = filaLimpia["estado cliente"] || filaLimpia["estado"] || "NO DEFINIDO";
        let est = String(estadoReal).toLowerCase().trim();

        let zon = filaLimpia["zona"] || filaLimpia["distrito"] || "";
        let dir = filaLimpia["dirección"] || filaLimpia["direccion"] || "";
        let pla = filaLimpia["tarifa de internet"] || filaLimpia["plan"] || "";
        let mesC = filaLimpia["mes"] || "";
        let anioC = filaLimpia["año"] || filaLimpia["anio"] || "";

        // TELÉFONOS (Atrapa hasta 3 si existen)
        let listaTels = [];
        if (filaLimpia["telefono 1"]) listaTels.push(filaLimpia["telefono 1"]);
        if (filaLimpia["telefono 2"]) listaTels.push(filaLimpia["telefono 2"]);
        if (filaLimpia["telefono 3"]) listaTels.push(filaLimpia["telefono 3"]);
        
        let tels = listaTels.length > 0 ? listaTels.join(" / ") : (c.telefonos || "");

        // Aplicar Filtros 
        if (estadoF !== "todos" && est !== estadoF) return;
        if (zonaF !== "Todas" && zon !== zonaF) return;
        if (planF !== "Todos" && pla !== planF) return;
        if (mesF !== "Todos" && String(mesC) !== mesF) return;
        if (anioF !== "Todos" && String(anioC) !== anioF) return;
        
        if (searchT !== "") {
            let textoFila = `${nom} ${numDni} ${tels} ${dir}`.toLowerCase();
            if (!textoFila.includes(searchT)) return;
        }

        // COLORES 
        let colorE = est.includes('activo') ? 'var(--success)' : est.includes('suspendido') ? 'var(--warning)' : est.includes('retirado') || est.includes('baja') ? 'var(--danger)' : '#94a3b8';

        // --- GENERAR FILA ---
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
    });

    if (count === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4 font-bold">No se encontraron clientes con esos filtros.</td></tr>`;
    } else {
        tbody.innerHTML = html;
    }

    // 🔨 LIMPIEZA FINAL DEL CONTADOR
    let countEl = document.getElementById("contadorResultadosBD") || document.getElementById("contadorBD");
    if(countEl) {
        countEl.innerText = `${count} clientes encontrados`;
        countEl.removeAttribute("style"); 
        countEl.style.fontWeight = "900";
        countEl.style.color = "var(--accent)";
        countEl.style.fontSize = "1.1rem";
    }
};

window.toggleAllBD = (el) => { document.querySelectorAll('.chk-bd-item').forEach(chk => chk.checked = el.checked); };

// ============================================================ //
// MOTOR PRE-ENVÍO Y CONFIRMACIÓN (PARA ENVÍOS MASIVOS)        //
// ============================================================ //
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
    
    // Agregamos esto:
    let asignado = document.getElementById("preEnvioAsignado") ? document.getElementById("preEnvioAsignado").value : "JRODRIGUEZ";

    mostrarToast("⏳ Enviando a bandeja...");

    for(let dni of seleccionados) {
        let cliente = window.bdClientesGlobal.find(c => c.dni === dni);
        if(cliente) {
            let esRetiro = estado === "Retiro Definitivo";
            let data = {
                tipoTarea: esRetiro ? "baja" : "retencion", 
                cliente: cliente.nombre, dni: cliente.dni, 
                tel: cliente.telefonos.join(" / "), dir: cliente.direccion, 
                zona: zonaAGuardar, fecha: fecha, horaInicio: hora, horaFin: "",
                estado: 'pendiente', tecnicos: ["Sin Asignar"]
            };

            if (esRetiro) {
                data.detalle = "Retiro de Equipos"; 
                data.notas = `[Generado desde BD] Motivo: ${nota}`;
            } else {
                data.estadoLlamada = estado;
                data.detalle = "Llamada - " + estado;
                data.notas = nota;
                data.asignadoRetencion = asignado; // <-- AHORA SE GUARDA A QUIEN VA
            }
            await addDoc(coleccionTrabajos, data);
        }
    }
    mostrarToast(`✅ ${seleccionados.length} cliente(s) enviados.`);
    document.getElementById("chkAllBD").checked = false; document.querySelectorAll('.chk-bd-item').forEach(chk => chk.checked = false);
    cerrarModalGeneral('modalPreEnvioBandeja');
    if(window.cerrarModalGeneral) window.cerrarModalGeneral('modalFiltroBD');
};

// ==========================================
// MÓDULO DE COBRANZAS (MODALES Y NOTIFICACIONES)
// ==========================================
window.alertasCobranzaGlobal = [];

window.abrirModalGestionarCobranza = (dni) => {
    let cliente = window.bdClientesGlobal.find(c => c.dni === dni);
    if(!cliente) { mostrarToast("Error: No se encontró al cliente"); return; }
    
    document.getElementById('cobDni').value = cliente.dni;
    document.getElementById('cobNombre').value = cliente.nombre;
    document.getElementById('lblCobCliente').innerText = cliente.nombre;
    document.getElementById('lblCobDni').innerText = "DNI/ID: " + cliente.dni;
    
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
        cerrarModalGeneral('modalGestionarCobranza');
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
        if (window.alertasCobranzaGlobal.length > 0) {
            badge.innerText = window.alertasCobranzaGlobal.length;
            badge.style.display = 'flex';
        } else { badge.style.display = 'none'; }
        
        if(document.getElementById('modalNotificaciones').style.display === 'flex') window.renderizarNotificaciones();
    });
};

window.abrirModalNotificaciones = () => {
    window.renderizarNotificaciones();
    document.getElementById('modalNotificaciones').style.display = 'flex';
};

window.renderizarNotificaciones = () => {
    let tbody = document.getElementById('tablaNotificaciones'); tbody.innerHTML = '';
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
                <td style="text-align:center;"><button class="btn-success" onclick="marcarCobranzaResuelta('${a.id}')" style="padding:4px 8px; font-size:11px; border:none; border-radius:4px; cursor:pointer; background:var(--success); color:white;"><i class="fa-solid fa-check"></i> Listo</button></td>
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
            b.classList.remove("active-alta", "active-averia", "active-baja", "active-otros", "active-retencion");
            if (b.id === "tabAveria") { b.style.color = "#8b9bb4"; b.style.borderColor = "var(--panel-border)"; }
            if (b.id === "tabOtros") { b.style.color = "#8b9bb4"; b.style.borderColor = "var(--panel-border)"; }
            if (b.id === "tabRetencion") { b.style.color = "#8b9bb4"; b.style.borderColor = "var(--panel-border)"; }
        });

        let tabActiva = document.getElementById("tab" + tipo.charAt(0).toUpperCase() + tipo.slice(1));
        if (tabActiva) {
            tabActiva.classList.add("active-" + tipo);
            if (tipo === "averia") { tabActiva.style.color = "#2979ff"; tabActiva.style.borderColor = "#2979ff"; }
            if (tipo === "otros") { tabActiva.style.color = "#f59e0b"; tabActiva.style.borderColor = "#f59e0b"; }
            if (tipo === "retencion") { tabActiva.style.color = "#ec4899"; tabActiva.style.borderColor = "#ec4899"; }
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
        let grupoRetencion = document.querySelector(".grupo-retencion");

        if (grupoAlta) grupoAlta.style.display = tipo === "alta" ? "contents" : "none";
        if (grupoAveria) grupoAveria.style.display = tipo === "averia" ? "block" : "none";
        if (grupoBaja) grupoBaja.style.display = tipo === "baja" ? "block" : "none";
        if (grupoOtros) grupoOtros.style.display = tipo === "otros" ? "block" : "none";
        if (grupoRetencion) grupoRetencion.style.display = tipo === "retencion" ? "block" : "none";

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

// ==========================================
// FLUJOS DE RETENCIÓN E INTERFAZ
// ==========================================

// 1. Mostrar/Ocultar el filtro de módulo al iniciar sesión
setTimeout(() => {
    let fMod = document.getElementById("filtroModuloContainer");
    let isCobranzas = (typeof nombreTecnicoLogueado !== "undefined" && (nombreTecnicoLogueado === "CALVINO" || nombreTecnicoLogueado === "OALVINO"));

    if (fMod) {
        let selectMod = document.getElementById("filtroModulo");
        if (isAdmin || isAdminLurin || isCarlos || isCobranzas) {
            fMod.style.display = "flex";
            if (isCarlos) {
                selectMod.innerHTML = `<option value="alta">🚀 Instalaciones</option><option value="retencion">📞 Retención</option>`;
                selectMod.value = "retencion";
            } else if (isCobranzas) {
                selectMod.innerHTML = `<option value="noc">🌍 Operaciones NOC</option><option value="retencion">📞 Retención</option><option value="todos">👁️ Ver Todo</option>`;
                selectMod.value = "retencion";
            } else {
                selectMod.innerHTML = `<option value="noc">🌍 Operaciones NOC</option><option value="retencion">📞 Retención</option><option value="todos">👁️ Ver Todo</option>`;
                selectMod.value = "noc";
            }
            if(typeof window.cambiarModuloVentas === 'function') window.cambiarModuloVentas();
        } else {
            fMod.style.display = "none";
        }
    }
}, 1500);

// 2. Cambiar títulos según la selección
window.cambiarModuloVentas = () => {
    let mod = document.getElementById("filtroModulo") ? document.getElementById("filtroModulo").value : "noc";
    if (mod === "alta") {
        document.getElementById("tituloKpi").innerHTML = `<i class="fa-solid fa-chart-pie text-orange"></i> REPORTE DE VENTAS`;
        document.getElementById("lblKpiTotal").innerText = "Registradas";
        document.getElementById("lblKpiAtendidos").innerText = "Instaladas";
        document.getElementById("lblKpiPendientes").innerText = "Por Instalar";
    } else if (mod === "retencion") {
        document.getElementById("tituloKpi").innerHTML = `<i class="fa-solid fa-headset text-pink"></i> REPORTE RETENCIÓN`;
        document.getElementById("lblKpiTotal").innerText = "Total Casos";
        document.getElementById("lblKpiAtendidos").innerText = "Completados";
        document.getElementById("lblKpiPendientes").innerText = "Seguimiento";
    } else {
        document.getElementById("tituloKpi").innerHTML = `<i class="fa-solid fa-server text-accent"></i> OPERACIONES NOC`;
        document.getElementById("lblKpiTotal").innerText = "Total Tareas";
        document.getElementById("lblKpiAtendidos").innerText = "Atendidos";
        document.getElementById("lblKpiPendientes").innerText = "Pendientes";
    }
    window.renderizarTabla();
};

// 3. Crear retención directamente desde la Base de Datos
window.crearRetencionDirecta = async (dni) => {
    window.cerrarModalGeneral('modalFiltroBD');
    window.abrirModal();
    document.getElementById("formIdCliente").value = dni;
    await window.buscarCliente(); // Autocompleta los datos
    window.seleccionarTipoTarea("retencion");
    mostrarToast("✏️ Registra los detalles y dale a Guardar");
};

// ==========================================
// SINCRONIZACIÓN DE EXCEL A LA NUBE (FIREBASE)
// ==========================================
window.subirExcelAFirebase = async () => {
    if(!window.bdClientesGlobal || window.bdClientesGlobal.length === 0) {
        mostrarToast("⚠️ Primero dale a '1. Cargar Excel Local' para leer el archivo."); 
        return;
    }
    mostrarToast("⏳ Subiendo a la Nube... Esto tomará unos segundos. No cierres la página.");
    
    try {
        let batches = [];
        let batch = writeBatch(db);
        let count = 0;

        for (let i = 0; i < window.bdClientesGlobal.length; i++) {
            let c = window.bdClientesGlobal[i];
            if (!c.dni) continue; // Saltar si no tiene DNI
            
            let docRef = doc(coleccionClientes, c.dni);
            batch.set(docRef, {
                nombre: c.nombre, dni: c.dni, id_cliente: c.dni,
                telefonos: c.telefonos ? c.telefonos.join(" / ") : "",
                zona: c.zona || "", direccion: c.direccion || "",
                plan: c.plan || "", mes: c.mes || "", anio: c.anio || "",
                ubicacion: c.linkMapa || "", estado: c.estado || "Activo"
            }, { merge: true });

            count++;
            if (count === 400) { // Firebase permite subir de 400 en 400
                batches.push(batch.commit());
                batch = writeBatch(db);
                count = 0;
            }
        }
        if (count > 0) batches.push(batch.commit());

        await Promise.all(batches);
        mostrarToast("✅ Excel guardado en la Nube. Ya está disponible en todos los celulares.");
    } catch (e) {
        console.error(e);
        mostrarToast("❌ Error al subir a la Nube.");
    }
};

// ==========================================
// DESCARGAR EXCEL DESDE LA NUBE AL DISPOSITIVO
// ==========================================
window.descargarExcelDeFirebase = async () => {
    mostrarToast("⏳ Descargando base de datos desde la Nube... Por favor espera.");
    try {
        const querySnapshot = await getDocs(coleccionClientes);
        let clientesDescargados = [];
        let activos = 0, suspendidos = 0, retirados = 0;

        querySnapshot.forEach((doc) => {
            let c = doc.data();
            
            // MAGIA ANTICHOQUES: Traducir los teléfonos de texto a lista para que no se rompa el buscador
            if (typeof c.telefonos === "string") {
                c.telefonos = c.telefonos.split(" / ").filter(t => t.trim() !== "");
            } else if (!c.telefonos) {
                c.telefonos = [];
            }

            clientesDescargados.push(c);
            
            let estMinus = (c.estado || "").toLowerCase();
            if (estMinus === "activo") activos++;
            else if (estMinus === "suspendido" || estMinus === "cortado") suspendidos++;
            else if (estMinus === "retirado" || estMinus === "baja") retirados++;
        });

        if (clientesDescargados.length === 0) {
            mostrarToast("⚠️ La Nube está vacía. Un administrador debe subir el Excel primero.");
            return;
        }

        // 1. Guardar en la variable global
        window.bdClientesGlobal = clientesDescargados;

        // 2. Actualizar los contadores (KPIs) locales
        let total = activos + suspendidos + retirados;
        let opcionesFecha = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
        let fechaHoy = new Date().toLocaleDateString('es-PE', opcionesFecha);

        localStorage.setItem("kpi_activos", activos);
        localStorage.setItem("kpi_suspendidos", suspendidos);
        localStorage.setItem("kpi_retirados", retirados);
        localStorage.setItem("kpi_total", total);
        localStorage.setItem("kpi_fecha", fechaHoy);

        // 3. Guardar en la memoria profunda (IndexedDB) del nuevo dispositivo
        const request = indexedDB.open("TEN_DB_CLIENTES", 1);
        request.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction("clientesStore", "readwrite");
            tx.objectStore("clientesStore").put({ id: "bd_completa", data: window.bdClientesGlobal });
            tx.oncomplete = () => {
                window.cargarKpisGuardados(); // Refrescar los gráficos
                mostrarToast(`✅ ¡Listo! ${clientesDescargados.length} clientes guardados en este dispositivo.`);
            };
        };
    } catch (e) {
        console.error(e);
        mostrarToast("❌ Error al descargar. Revisa tu conexión a internet.");
    }
};
window.descargarExcelDeFirebase = descargarExcelDeFirebase;

// ==========================================
// CONTROLADORES DE CIERRE INTELIGENTE
// ==========================================
window.cerrarModalGeneral = (modalId) => { 
    let m = document.getElementById(modalId); 
    if(m) m.style.display = 'none'; 
};

window.cerrarModal = () => window.cerrarModalGeneral('modalAgregar');
window.cerrarModalEliminar = () => window.cerrarModalGeneral('modalEliminar');
window.cerrarModalCierre = () => window.cerrarModalGeneral('modalCierre');
window.cerrarModalCobertura = () => window.cerrarModalGeneral('modalCobertura');
window.cerrarModalRechazoRapido = () => window.cerrarModalGeneral('modalRechazoRapido');
window.cerrarModalSenal = () => window.cerrarModalGeneral('modalSenal');
window.cerrarModalFiltroBD = () => window.cerrarModalGeneral('modalFiltroBD');
window.cerrarModalCalendario = () => window.cerrarModalGeneral('modalCalendario');
window.abrirModalConfiguracion = () => { let m = document.getElementById('modalConfiguracion'); if(m) m.style.display = 'flex'; };

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { 
        const modalesAbiertos = Array.from(document.querySelectorAll('.modal-overlay')).filter(m => m.style.display === 'flex');
        if (modalesAbiertos.length > 0) modalesAbiertos[modalesAbiertos.length - 1].style.display = 'none';
    }
});

document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.onclick = function(e) {
        if (e.target === overlay) {
            overlay.style.display = 'none';
        }
    };
});

// ==========================================
// CONTROL DEL MENÚ MÓVIL
// ==========================================
window.toggleSidebar = () => {
    const sidebar = document.querySelector('.app-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('show');
        overlay.classList.toggle('show');
    }
};

// Cerrar el menú automáticamente si se hace clic en un botón del menú (solo en móvil)
setTimeout(() => {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (window.innerWidth <= 900) {
                document.querySelector('.app-sidebar').classList.remove('show');
                document.querySelector('.sidebar-overlay').classList.remove('show');
            }
        });
    });
}, 1000);

// ==========================================
// CARGAR DATOS EN MEMORIA (INDEXEDDB)
// ==========================================
window.cargarKpisGuardados = async () => {
    if (localStorage.getItem("kpi_total")) {
        let activos = parseInt(localStorage.getItem("kpi_activos")) || 0;
        let suspendidos = parseInt(localStorage.getItem("kpi_suspendidos")) || 0;
        let retirados = parseInt(localStorage.getItem("kpi_retirados")) || 0;
        let total = parseInt(localStorage.getItem("kpi_total")) || 0;
        let fecha = localStorage.getItem("kpi_fecha") || "Desconocida";

        let pctAct = total > 0 ? Math.round((activos / total) * 100) : 0;
        let pctSus = total > 0 ? Math.round((suspendidos / total) * 100) : 0;
        let pctRet = total > 0 ? Math.round((retirados / total) * 100) : 0;

        let elAct = document.getElementById("kpiCliActivos"); if(elAct) elAct.innerText = activos;
        let elSus = document.getElementById("kpiCliSuspendidos"); if(elSus) elSus.innerText = suspendidos;
        let elRet = document.getElementById("kpiCliRetirados"); if(elRet) elRet.innerText = retirados;
        let elTot = document.getElementById("kpiCliTotal"); if(elTot) elTot.innerText = total;
        
        let elPctAct = document.getElementById("pctActivos"); if(elPctAct) elPctAct.innerText = `(${pctAct}%)`;
        let elPctSus = document.getElementById("pctSuspendidos"); if(elPctSus) elPctSus.innerText = `(${pctSus}%)`;
        let elPctRet = document.getElementById("pctRetirados"); if(elPctRet) elPctRet.innerText = `(${pctRet}%)`;
        let elLblFecha = document.getElementById("lblFechaBD"); if(elLblFecha) elLblFecha.innerText = `Act: ${fecha}`;
    }
    
    // ============================================================ //
    // RECUPERAR EXCEL DESDE INDEXEDDB                               //
    // ============================================================ //
    const request = indexedDB.open("TEN_DB_CLIENTES", 1);
    request.onsuccess = (e) => {
        const db = e.target.result;
        if(db.objectStoreNames.contains("clientesStore")) {
            const tx = db.transaction("clientesStore", "readonly");
            const getReq = tx.objectStore("clientesStore").get("bd_completa");
            getReq.onsuccess = () => {
                if(getReq.result) {
                    window.bdClientesGlobal = getReq.result.data;
                }
            };
        }
    };
    
    if(typeof window.renderizarTablaPlanesConfig === 'function') window.renderizarTablaPlanesConfig();
};

window.cargarKpisGuardados();