/* STREAMING_CHUNK: Importaciones y Configuración Inicial */
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

/* STREAMING_CHUNK: Variables Globales y Roles */
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

// NUEVA LISTA DE TÉCNICOS NORTE (Basada en correos)
const tecnicosNorte = ["MPACOTAIPE", "CALARCON", "JPATRICIO", "JCORDOVA", "RRONDON", "RLEON", "JLOLI", "JFERNANDEZ"];
const tecnicosLurin = ["BILLS", "CIELO"];

let chartTecnicos = null;
let unsubscribeTrabajos = null;
let idTrabajoAEliminar = null;

// Variables SLA
let idTrabajoCierreSLA = null;
let estadoObjetivoSLA = null;

// Variables Validación Mapa
let ventaAValidarId = null;
let idVentaARechazarRapido = null;

// Variables Calendario
let semanaOffset = 0;
let diaSeleccionado = null;

// Variables Mapa Dinámico
const MAPA_NOC = "https://www.google.com/maps/d/embed?mid=1EKIxuTIGSM9GJ8YTbP_HCxhh-l5DOFw&ehbc=2E312F";
const MAPA_VENTAS = "https://www.google.com/maps/d/embed?mid=1fMA7B2CSQKbdMlNO6lxVvh9pF_JnY-s&ehbc=2E312F";

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

/* STREAMING_CHUNK: Autenticación y Asignación de Permisos */
// ============================================================ //
// AUTH                                                         //
// ============================================================ //
window.iniciarSesion = () => {
    const email = document.getElementById("txtEmail").value.trim();
    const pass = document.getElementById("txtPassword").value;
    signInWithEmailAndPassword(auth, email, pass).catch(() => {
        let errLabel = document.getElementById("login-error");
        errLabel.innerText = "Error: Verifica tus credenciales.";
        errLabel.style.color = "var(--btn-sin-atender)";
        errLabel.style.display = "block";
    });
};

// NUEVA FUNCIÓN: Enviar correo de restablecimiento
window.recuperarContrasena = () => {
    const email = document.getElementById("txtEmail").value.trim();
    const errLabel = document.getElementById("login-error");

    if (!email) {
        errLabel.innerText = "⚠️ Por favor, ingresa tu correo electrónico arriba primero.";
        errLabel.style.color = "var(--neon-yellow)";
        errLabel.style.display = "block";
        return;
    }

    errLabel.innerText = "⏳ Enviando solicitud...";
    errLabel.style.color = "var(--text-muted)";
    errLabel.style.display = "block";

    sendPasswordResetEmail(auth, email)
        .then(() => {
            errLabel.innerText = "✅ Correo enviado. Revisa tu bandeja de entrada o spam para cambiar tu clave.";
            errLabel.style.color = "var(--neon-green)";
        })
        .catch((error) => {
            errLabel.innerText = "❌ Error: Verifica que el correo esté bien escrito o exista.";
            errLabel.style.color = "var(--neon-red)";
            console.error(error);
        });
};

window.cerrarSesion = () => {
    localStorage.clear(); // Limpia la sesión del calendario
    signOut(auth);
};

window.cambiarZona = (z) => {
    zonaActual = z;
    actualizarFiltroTecnicos();
    renderizarTabla();
};

// ============================================================ //
// ON AUTH STATE CHANGED (CORREGIDO)                            //
// ============================================================ //
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById("login-view").style.display = "none";
        document.getElementById("dashboard-view").style.display = "block";
        document.getElementById("contenedorBotonesAccion").style.display = "flex";

        const email = user.email.toLowerCase();

        // LISTAS DE CORREOS OFICIALES
        const correosAdminGlobal = ["admin@ten.com", "rpacotaipe@ten.com", "eolortegui@ten.com", "jpalomino@ten.com", "dpacotaipe@ten.com"];
        const correosAdminLurin = ["ecuta@ten.com", "strujillo@ten.com"];
        const coordinadoresVentas = ["carlos@ten.com", "jrodriguez@ten.com", "mventocilla@ten.com"];

        isAdmin = correosAdminGlobal.includes(email);
        isAdminLurin = correosAdminLurin.includes(email);
        isWilton = email === "wilton@ten.com";
        isCarlos = coordinadoresVentas.includes(email);
        isVendedor = email.includes("ventas");

        // Resetear clases de roles visuales
        document.querySelectorAll(".admin-only, .admin-wilton-only, .admin-carlos-only").forEach((el) => {
            el.classList.remove("show-admin", "show-admin-flex", "show-admin-grid");
        });

        // Volver a mostrar los botones por defecto (se ocultan para técnicos luego)
        document.querySelectorAll(".btn-ocultar-tecnico").forEach(el => el.style.display = "flex");

        if (isAdmin || isAdminLurin) {
            nombreTecnicoLogueado = isAdminLurin ? "ADMIN_LURIN" : "ADMIN";
            document.getElementById("lblUsuarioActivo").innerHTML = isAdminLurin ? `👑 ADMIN LURÍN` : `👑 ADMINISTRADOR`;
            
            // --- PUENTE CALENDARIO ---
            localStorage.setItem('ten_rol', 'admin');
            localStorage.setItem('ten_email', email);

            // Primero activamos todos los permisos de Admin
            document.querySelectorAll(".admin-only, .admin-wilton-only, .admin-carlos-only").forEach((el) =>
                el.classList.add("show-admin-flex")
            );

            // LUEGO VALIDAMOS SI ES LURÍN PARA QUITARLE LO QUE NO DEBE VER
            if (isAdminLurin) {
                // 1. Quitar selector de zona
                document.getElementById("contenedorSelectorZona").classList.remove("show-admin-flex");
                document.getElementById("contenedorSelectorZona").style.display = "none";
                zonaActual = "Lurin"; // Lo anclamos permanentemente a Lurin

                // 2. Quitar el Mapa de Cobertura General
                let btnMapaGeneral = document.getElementById("btnMapaCoberturaGeneral");
                if (btnMapaGeneral) {
                    btnMapaGeneral.classList.remove("show-admin-flex");
                    btnMapaGeneral.style.display = "none";
                }
            } else {
                // Admin Normal (Global)
                document.getElementById("contenedorSelectorZona").style.display = "";
                zonaActual = document.getElementById("selectorZona").value;

                let btnMapaGeneral = document.getElementById("btnMapaCoberturaGeneral");
                if (btnMapaGeneral) btnMapaGeneral.style.display = "";
            }

            configurarGraficosBase("TOTALES", "Total", "Atendidos", "Pendientes");
        } else if (isWilton) {
            nombreTecnicoLogueado = "WILTON";
            document.getElementById("lblUsuarioActivo").innerHTML = `🛠️ WILTON SOPORTE`;
            
            // --- PUENTE CALENDARIO ---
            localStorage.setItem('ten_rol', 'admin');
            localStorage.setItem('ten_email', email);

            document.getElementById("contenedorSelectorZona").classList.add("show-admin-flex");
            document.getElementById("contenedorSelectorZona").style.display = "";
            document.querySelectorAll(".admin-wilton-only").forEach((el) => el.classList.add("show-admin-flex"));
            configurarGraficosBase("TOTALES", "Total", "Atendidos", "Pendientes");
            zonaActual = document.getElementById("selectorZona").value;
        } else if (isCarlos || isVendedor) {
            let nombreLimpio = email.split("@")[0].split(".")[0].toUpperCase();
            nombreTecnicoLogueado = isCarlos ? nombreLimpio : nombreLimpio;

            document.getElementById("lblUsuarioActivo").innerHTML = isCarlos ? `📋 COORD. ${nombreLimpio}` : `💼 ${nombreLimpio}`;
            
            // --- PUENTE CALENDARIO ---
            localStorage.setItem('ten_rol', 'ventas');
            localStorage.setItem('ten_email', email);

            document.querySelectorAll(".admin-carlos-only").forEach((el) => el.classList.add("show-admin-flex"));

            const panelGraficos = document.getElementById("panelGraficosAdmin");
            panelGraficos.classList.add("show-admin-grid");

            if (document.getElementById("cardCalendarioNoc")) document.getElementById("cardCalendarioNoc").style.display = "none";
            if (document.getElementById("cardGraficoTecnicos")) document.getElementById("cardGraficoTecnicos").style.display = "none";

            configurarGraficosBase("REPORTE DE VENTAS", "Total Registradas", "Instaladas", "Por Instalar");
            zonaActual = "Norte";
        } else {
            // Lógica Exclusiva para Técnicos (Campo)
            nombreTecnicoLogueado = email.split("@")[0].toUpperCase();
            document.getElementById("lblUsuarioActivo").innerHTML = `🛠️ ${nombreTecnicoLogueado}`;
            zonaActual = tecnicosLurin.includes(nombreTecnicoLogueado) ? "Lurin" : "Norte";
            
            // --- PUENTE CALENDARIO ---
            localStorage.setItem('ten_rol', 'tecnico');
            localStorage.setItem('ten_email', email);
            localStorage.setItem('ten_nombre_tecnico', nombreTecnicoLogueado);

            // Ocultamos los botones de arriba para los técnicos
            document.querySelectorAll(".btn-ocultar-tecnico").forEach(el => el.style.display = "none");
        }

        const iframeMapa = document.getElementById("iframeCobertura");
        if (iframeMapa) iframeMapa.src = obtenerUrlMapa();

        setTimeout(() => {
            if (typeof window.renderizarCalendario === "function") window.renderizarCalendario();
        }, 800);

        actualizarFiltroTecnicos();
        cargarTrabajosEnVivo();
    } else {
        if (unsubscribeTrabajos) unsubscribeTrabajos();
        dbTrabajos = [];
        document.getElementById("login-view").style.display = "flex";
        document.getElementById("dashboard-view").style.display = "none";
        document.getElementById("contenedorBotonesAccion").style.display = "none";
    }
});

/* STREAMING_CHUNK: Utilidades de Interfaz y Gráficos */
function configurarGraficosBase(titulo, lTotal, lSuccess, lWarning) {
    const panelGraficos = document.getElementById("panelGraficosAdmin");
    panelGraficos.classList.add("show-admin-grid");

    if (isAdmin || isAdminLurin || isWilton) {
        panelGraficos.style.gridTemplateColumns = "1fr 2fr 1fr";
        if (document.getElementById("cardGraficoTecnicos")) document.getElementById("cardGraficoTecnicos").style.display = "flex";
        if (document.getElementById("cardCalendarioNoc")) document.getElementById("cardCalendarioNoc").style.display = "block";
    } else {
        panelGraficos.style.gridTemplateColumns = "1fr";
    }

    if (document.getElementById("tituloKpi")) {
        document.getElementById("tituloKpi").innerText = titulo;
        document.getElementById("lblKpiTotal").innerText = lTotal;
        document.getElementById("lblKpiAtendidos").innerText = lSuccess;
        document.getElementById("lblKpiPendientes").innerText = lWarning;
    }
}

function actualizarFiltroTecnicos() {
    let lista = zonaActual === "Norte" ? tecnicosNorte : tecnicosLurin;
    let html = `<option value="todos">Todos</option>`;
    lista.forEach((t) => {
        html += `<option value="${t}">${t}</option>`;
    });
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
        snapshot.forEach((doc) => {
            dbTrabajos.push({ id: doc.id, ...doc.data() });
        });
        actualizarOpcionesFechas();
        renderizarTabla();
        if (typeof window.renderizarCalendario === "function") window.renderizarCalendario();
    });
}

// ============================================================ //
// BÚSQUEDA DUAL (ID o DNI)                                    //
// ============================================================ //
window.buscarCliente = async () => {
    const queryVal = document.getElementById("formIdCliente").value.trim();
    const msg = document.getElementById("searchResult");

    if (!queryVal) {
        msg.innerText = "Escribe un ID o DNI primero";
        return;
    }

    msg.innerText = "Buscando...";
    msg.style.color = "var(--text-muted)";

    try {
        let docSnap = await getDocs(query(coleccionClientes, where("id_cliente", "==", queryVal)));
        if (docSnap.empty) docSnap = await getDocs(query(coleccionClientes, where("dni", "==", queryVal)));

        if (!docSnap.empty) {
            const data = docSnap.docs[0].data();

            document.getElementById("formNombre").value = data.nombre;
            document.getElementById("formDni").value = data.dni;

            let tels = data.telefonos ? data.telefonos.split(" / ") : [];
            document.getElementById("formTelefonoPrincipal").value = tels[0] || "";
            document.getElementById("formTelefonoSecundario").value = tels.slice(1).join(" / ") || "";

            document.getElementById("formDireccion").value = data.zona ? `${data.zona} - ${data.direccion}` : data.direccion;
            document.getElementById("formMapa").value = data.ubicacion;
            document.getElementById("formInfoRedAveria").value = `Plan: ${data.plan} | TV: ${data.info_tv}`;

            msg.innerText = "✅ Cliente Encontrado y Autocompletado";
            msg.style.color = "var(--neon-green)";
        } else {
            msg.innerText = "❌ Cliente no encontrado en la base de datos.";
            msg.style.color = "var(--neon-red)";
        }
    } catch (err) {
        msg.innerText = "⚠️ Error en la búsqueda.";
        msg.style.color = "var(--neon-yellow)";
        console.error(err);
    }
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

/* STREAMING_CHUNK: Lógica Formulario y Modales Base */
// ============================================================ //
// ABRIR MODAL                                                  //
// ============================================================ //
window.abrirModal = () => {
    if (isAdmin || isWilton) zonaActual = document.getElementById("selectorZona").value;

    document.getElementById("formTrabajoId").value = "";
    document.getElementById("formEstadoActual").value = "";
    document.getElementById("modalTitulo").innerText = "Registro de Tarea";

    document.querySelectorAll(
        "#modalAgregar input[type=text]:not(.multi-select-display), #modalAgregar input[type=number], #modalAgregar input[type=email], #modalAgregar textarea"
    ).forEach((i) => (i.value = ""));

    document.getElementById("formFecha").value = new Date().toISOString().split("T")[0];
    document.getElementById("searchResult").innerText = "";

    document.getElementById("formTipoDoc").value = "DNI";
    document.getElementById("formSedeVenta").value = "Norte";
    document.getElementById("formTipoServicio").value = "Internet Solo";
    document.getElementById("formPlanVenta").value = "50|PLAN S/. 50 BASICO 2";
    document.getElementById("formPeriodo").value = "Quincenal";
    document.getElementById("formComprobante").value = "Boleta";
    document.querySelectorAll(".chk-extra").forEach((c) => (c.checked = false));
    
    // Reset para OTROS
    document.getElementById("formTipoOtros").value = "Limpieza de caja";
    document.getElementById("formCantPuertos").value = "0";
    document.getElementById("puertosContainer").innerHTML = "";
    document.getElementById("formSenalCajaOtros").value = "";

    window.calcularPrecioTotal();
    actualizarSelectTecnicosModal();
    window.seleccionarTipoTarea("alta");

    // LÓGICA INTELIGENTE DE VISIBILIDAD POR ROLES
    let isTecnicoCampo = !isAdmin && !isAdminLurin && !isWilton && !isCarlos && !isVendedor;

    if (isTecnicoCampo) {
        // VISTA MINIMALISTA PARA EL TÉCNICO EN CAMPO
        document.querySelector(".modal-tabs").style.display = "none";
        document.getElementById("grupoAsignacionTecnico").style.display = "none";
        document.getElementById("grupoSedeVenta").style.display = "none";
        document.getElementById("formTipoOtros").disabled = true; 
        document.getElementById("modalTitulo").innerText = "⚙️ Completar Datos";
    } else if (isVendedor || isCarlos) {
        // VISTA PARA VENTAS
        document.querySelector(".modal-tabs").style.display = "flex";
        document.getElementById("grupoAsignacionTecnico").style.display = "none";
        document.getElementById("tabAveria").style.display = "none";
        document.getElementById("tabBaja").style.display = "none";
        document.getElementById("tabOtros").style.display = "none"; 
        document.getElementById("grupoSedeVenta").style.display = "block";
        document.getElementById("formTipoOtros").disabled = false;
    } else {
        // VISTA PARA ADMINISTRADOR / WILTON / ADMIN LURIN
        document.querySelector(".modal-tabs").style.display = "flex";
        document.getElementById("grupoAsignacionTecnico").style.display = "block";
        document.getElementById("tabAveria").style.display = "block";
        document.getElementById("tabBaja").style.display = "block";
        document.getElementById("tabOtros").style.display = "block"; 
        document.getElementById("grupoSedeVenta").style.display = "none";
        document.getElementById("formTipoOtros").disabled = false;
    }

    document.getElementById("modalAgregar").style.display = "flex";
};

// ============================================================ //
// EDITAR TRABAJO                                               //
// ============================================================ //
window.editarTrabajo = (id) => {
    let t = dbTrabajos.find((x) => x.id === id);
    if (!t) return;

    window.abrirModal();

    document.getElementById("modalTitulo").innerText = "✏️ Editar Tarea";
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
            // Limpieza de caja
            document.getElementById("formCajaOtros").value = t.caja || "";
            document.getElementById("formLinkCajaOtros").value = t.linkCaja || "";
            document.getElementById("formCantPuertos").value = t.cantPuertos || "0";
            
            // NUEVO: Cargar señal de caja
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
        // Datos Comunes
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

/* STREAMING_CHUNK: Funciones de Guardado en DB */
// ============================================================ //
// GUARDAR TRABAJO                                              //
// ============================================================ //
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
        tipoTarea: tipo,
        fecha: document.getElementById("formFecha").value,
        horaInicio: document.getElementById("formHoraInicio").value,
        horaFin: document.getElementById("formHoraFin").value,
        tecnicos: techSelec,
        zona: zonaAGuardar,
    };

    if (tipo === "otros") {
        let subtipo = document.getElementById("formTipoOtros").value;
        data.detalle = subtipo;
        
        if (subtipo === "Limpieza de caja") {
            data.caja = document.getElementById("formCajaOtros").value;
            data.linkCaja = document.getElementById("formLinkCajaOtros").value;
            data.mapa = data.linkCaja; 
            
            // NUEVO: Guardar señal de caja
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
            
            data.linkCaja = document.getElementById("formLinkInicioFibra").value; // Inicio
            data.mapa = document.getElementById("formLinkFinFibra").value; // Fin
            
            data.notas = `Seguimiento de Fibra. Plan: ${data.plan}`;
            data.dir = "Revisar tendido de fibra óptica.";
        }
        
    } else {
        // Data común de Clientes
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

            data.rawServ = planCompleto;
            data.rawExtras = extrasArray;
            data.precio = precio;
            data.tipoServicio = tipoServicio;
            data.periodo = document.getElementById("formPeriodo").value;
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
        if (idTrabajo) {
            await updateDoc(doc(coleccionTrabajos, idTrabajo), data);
        } else {
            await addDoc(coleccionTrabajos, data);
        }
        window.cerrarModal();
        mostrarToast("Tarea guardada exitosamente");
    } catch (e) {
        mostrarToast("Error al guardar");
        console.error(e);
    }
};

/* STREAMING_CHUNK: Integración Mapa, Geolocalización y SLA */
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
        linkBtn.href = t.mapa;
        linkBtn.style.display = "inline-block";
        linkBtn.innerText = "📍 Ver GPS del Cliente";
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
        linkBtn.href = t.mapa;
        linkBtn.style.display = "inline-block";
        linkBtn.innerText = "📍 Abrir en Google Maps Externo";
    } else {
        linkBtn.style.display = "none";
    }

    document.getElementById("infoClienteCobertura").style.display = "flex";
    document.getElementById("botonesCoberturaValidacion").style.display = "none";
    document.getElementById("cajaRechazo").style.display = "none";
    document.getElementById("modalCobertura").style.display = "flex";

    document.getElementById("txtBuscarMapa").value = t.mapa || "";
    if (t.mapa) {
        await window.buscarEnMapa();
    }
};

window.buscarEnMapa = async () => {
    const input = document.getElementById("txtBuscarMapa").value.trim();

    if (!input) {
        mostrarToast("⚠️ Ingresa coordenadas, dirección o un link largo.");
        return;
    }

    const iframe = document.getElementById("iframeCobertura");
    const baseUrl = obtenerUrlMapa();

    mostrarToast("🔍 Buscando ubicación...");

    try {
        let lat, lon;

        const coordMatch = input.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
        const linkMatch = input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);

        if (coordMatch) {
            lat = coordMatch[1];
            lon = coordMatch[2];
        } else if (linkMatch) {
            lat = linkMatch[1];
            lon = linkMatch[2];
        } else if (input.includes("goo.gl/") || input.includes("maps.app")) {
            mostrarToast("❌ Los links cortos de Google bloquean la extracción. Pega la dirección en texto o coordenadas.");
            return;
        } else {
            const query = encodeURIComponent(input + ", Lima, Peru");
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
            const data = await response.json();

            if (data && data.length > 0) {
                lat = data[0].lat;
                lon = data[0].lon;
            } else {
                mostrarToast("❌ No se encontró la dirección. Intenta con coordenadas numéricas.");
                return;
            }
        }

        iframe.src = `${baseUrl}&ll=${lat},${lon}&z=17`;
        document.getElementById("mapCenterPin").style.display = "block";
        mostrarToast("✅ Mapa centrado en la ubicación indicada.");
    } catch (error) {
        console.error(error);
        mostrarToast("⚠️ Error de red al buscar la ubicación.");
    }
};

window.centrarEnMiUbicacion = () => {
    const btnIcon = document.getElementById("iconoUbicacion");
    const iframe = document.getElementById("iframeCobertura");
    const baseUrl = obtenerUrlMapa();

    if (!navigator.geolocation) {
        mostrarToast("Tu navegador no soporta geolocalización 😔");
        return;
    }

    btnIcon.innerText = "⏳";
    mostrarToast("Buscando tu señal GPS...");

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            iframe.src = `${baseUrl}&ll=${lat},${lon}&z=17`;
            btnIcon.innerText = "📍";
            document.getElementById("mapCenterPin").style.display = "block";
            mostrarToast("Mapa centrado en tu ubicación ✅");
        },
        (error) => {
            btnIcon.innerText = "📍";
            mostrarToast("Error al obtener ubicación. Activa tu GPS.");
            console.error(error);
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
};

window.confirmarAprobacionVenta = async () => {
    if (!ventaAValidarId) return;

    try {
        await updateDoc(doc(coleccionTrabajos, ventaAValidarId), { estado: "aprobada_wilton" });
        mostrarToast("✅ Cobertura Aprobada. Enviada a Soporte.");
        window.cerrarModalCobertura();
    } catch (e) {
        mostrarToast("Error al aprobar");
    }
};

window.confirmarRechazoVenta = async () => {
    if (!ventaAValidarId) return;

    const motivo = document.getElementById("txtMotivoRechazo").value.trim();

    if (!motivo) {
        mostrarToast("❌ Debes ingresar el motivo de rechazo.");
        return;
    }

    try {
        await updateDoc(doc(coleccionTrabajos, ventaAValidarId), {
            estado: "rechazada",
            notas: `[RECHAZADA] Motivo: ${motivo}`,
        });
        mostrarToast("🚫 Venta Rechazada por falta de cobertura.");
        window.cerrarModalCobertura();
    } catch (e) {
        mostrarToast("Error al rechazar");
    }
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
        if (ventaAValidarId) {
            document.getElementById("botonesCoberturaValidacion").style.display = "flex";
        }
    }
};

window.aprobarDirecto = async (id) => {
    try {
        await updateDoc(doc(coleccionTrabajos, id), { estado: "aprobada_wilton" });
        mostrarToast("✅ Venta Aprobada y enviada a Soporte.");
    } catch (e) {
        mostrarToast("Error al aprobar");
        console.error(e);
    }
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

    if (!motivo) {
        mostrarToast("❌ Debes ingresar un motivo de rechazo.");
        return;
    }

    try {
        await updateDoc(doc(coleccionTrabajos, idVentaARechazarRapido), {
            estado: "rechazada",
            notas: `[RECHAZADA] Motivo: ${motivo}`,
        });
        mostrarToast("🚫 Venta Rechazada.");
        window.cerrarModalRechazoRapido();
    } catch (e) {
        mostrarToast("Error al rechazar");
        console.error(e);
    }
};

/* STREAMING_CHUNK: Core de la Tabla, Renderizado Visual y Permisos (El Cerebro) */
// ============================================================ //
// RENDERIZAR TABLA                                             //
// ============================================================ //
window.renderizarTabla = () => {
    const tbody = document.getElementById("tablaTrabajos");
    const filtroFecha = document.getElementById("filtroFecha").value;
    const filtroEstado = document.getElementById("filtroEstado").value;
    const txtBuscar = document.getElementById("buscador").value.toLowerCase();

    tbody.innerHTML = "";
    let pGrafico = [];

    let listData = [...dbTrabajos];

    // Permite que Admin Global y Admin Lurin filtren por la zona que les corresponde
    if (isAdmin || isAdminLurin || isWilton) {
        listData = listData.filter((t) => (t.zona || "Norte") === zonaActual);
    }

    let tOrdenado = listData.sort((a, b) => {
        let res = (b.fecha || "").localeCompare(a.fecha || "");
        if (res === 0) return (a.horaInicio || "23:59").localeCompare(b.horaInicio || "23:59");
        return res;
    });

    tOrdenado.forEach((t) => {
        try {
            let asig = t.tecnicos || ["Sin Asignar"];
            if (typeof asig === "string") asig = [asig];

            let estActual = String(t.estado || "pendiente").toLowerCase();

            if ((isVendedor || isCarlos) && t.tipoTarea !== "alta") return;
            if (isVendedor && t.vendedor !== nombreTecnicoLogueado) return;

            let esAprobacion = estActual === "por_aprobar_carlos" || estActual === "aprobada_wilton" || estActual === "rechazada";
            if (!isAdmin && !isAdminLurin && !isWilton && !isCarlos && !isVendedor && esAprobacion) return;

            if (!isAdmin && !isAdminLurin && !isWilton && !isCarlos && !isVendedor && !asig.includes(nombreTecnicoLogueado) && !asig.includes("Todos")) return;

            if ((isAdmin || isAdminLurin || isWilton) && document.getElementById("filtroTecnico").value !== "todos" && !asig.includes(document.getElementById("filtroTecnico").value)) return;

            if (filtroFecha !== "todas" && t.fecha !== filtroFecha) return;
            if (filtroEstado !== "todos" && estActual !== filtroEstado) return;

            if (txtBuscar && !`${t.cliente} ${t.dni} ${t.dir} ${t.detalle}`.toLowerCase().includes(txtBuscar)) return;

            pGrafico.push(t);

            let textEst = estActual.toUpperCase().replace(/_/g, " ");
            let iconEst = "⏳";
            let colorEstadoTxt = "#f59e0b";
            let clasePunto = "ep-pend";

            if (estActual === "atendido") { textEst = "ATENDIDO"; iconEst = "✅"; colorEstadoTxt = "#10b981"; clasePunto = "ep-aten"; } 
            else if (estActual === "no_atendido") { textEst = "NO ATENDIDO"; iconEst = "❌"; colorEstadoTxt = "#ef4444"; clasePunto = "ep-noat"; } 
            else if (estActual === "en_camino") { textEst = "EN CAMINO"; iconEst = "🚶"; colorEstadoTxt = "#3b82f6"; clasePunto = "ep-cami"; } 
            else if (estActual === "por_aprobar_carlos") { textEst = "POR APROBAR"; iconEst = "🟡"; colorEstadoTxt = "var(--neon-purple)"; clasePunto = "ep-aprobar"; } 
            else if (estActual === "aprobada_wilton") { textEst = "VENTA APROBADA"; iconEst = "🔵"; colorEstadoTxt = "var(--neon-cyan)"; clasePunto = "ep-aprobada"; } 
            else if (estActual === "rechazada") { textEst = "RECHAZADA"; iconEst = "🚫"; colorEstadoTxt = "var(--neon-red)"; clasePunto = "ep-rechazada"; }

            let colorBadge = t.tipoTarea === "alta" ? "alta" : t.tipoTarea === "averia" ? "averia" : t.tipoTarea === "baja" ? "baja" : "otros";
            let nombreTipo = t.tipoTarea === "alta" ? "🚀 ALTA" : t.tipoTarea === "averia" ? "🛠️ AVERÍA" : t.tipoTarea === "baja" ? "🛑 BAJA" : "⚙️ OTROS TRABAJOS";
            let docLabel = t.tipoDoc || "DNI";

            let infoCli = `<span class="cliente-nombre">${t.cliente}</span>`;
            
            if (t.tipoTarea === "otros") {
                if (t.detalle === "Limpieza de caja") {
                    infoCli += `<span class="cliente-info"><span class="lbl-info" style="color:var(--brand-orange)">PUERTOS A REVISAR:</span> <b style="font-size:15px; color:var(--text-main);">${t.cantPuertos || 0}</b></span>`;
                    if(t.caja) infoCli += `<span class="cliente-info"><span class="lbl-info" style="color:var(--neon-cyan)">CAJA NAP:</span> ${t.caja}</span>`;
                } else if (t.detalle === "Seguimiento de fibra") {
                    infoCli += `<span class="cliente-info"><span class="lbl-info" style="color:var(--brand-orange)">DNI/ID:</span> ${t.dni || "-"}</span>`;
                    infoCli += `<span class="cliente-info"><span class="lbl-info" style="color:var(--neon-cyan)">PLAN:</span> ${t.plan || "-"}</span>`;
                    if(t.equipos) infoCli += `<span class="cliente-info"><span class="lbl-info" style="color:var(--neon-purple)">EQUIPOS:</span> ${t.equipos}</span>`;
                }
            } else {
                infoCli += `<span class="cliente-info"><span class="lbl-info">${docLabel}:</span> ${t.dni || "-"}</span>
                           <span class="cliente-info"><span class="lbl-info">TEL:</span> ${t.tel || "-"}</span>
                           ${t.correo ? `<span class="cliente-info"><span class="lbl-info">EMAIL:</span> ${t.correo}</span>` : ""}
                           ${(t.vendedor && t.tipoTarea === "alta") ? `<span class="cliente-info" style="margin-top:8px;"><span class="lbl-info" style="color:var(--neon-pink)">VENDEDOR:</span> <b style="color:var(--text-main); background:var(--neon-pink); padding:2px 6px; border-radius:4px; font-size:11px;">${t.vendedor}</b></span>` : ""}`;
            }

            let extrasHtml = "";
            if (t.tipoTarea === "alta") {
                if (t.caja || t.puerto) extrasHtml += `<br><span class="cliente-info" style="color:var(--neon-purple)"><span class="lbl-info">CAJA:</span> ${t.caja || "--"} | <span class="lbl-info">P:</span> ${t.puerto || "--"}</span>`;
                if (t.periodo || t.comprobante) extrasHtml += `<span class="cliente-info" style="color:var(--text-muted)"><span class="lbl-info">PAGO:</span> ${t.periodo || ""} | ${t.comprobante || ""}</span>`;
            }
            if (t.tipoTarea === "averia" && t.infoRed) extrasHtml = `<br><span class="cliente-info" style="color:var(--neon-cyan)"><span class="lbl-info">RED:</span> ${t.infoRed}</span>`;
            if (t.tipoTarea === "baja" && t.equipos) extrasHtml = `<br><span class="cliente-info" style="color:var(--neon-red)"><span class="lbl-info">RECOGER:</span> ${t.equipos}</span>`;

            if (t.tx || t.rx) {
                extrasHtml += `<div style="background: rgba(0,229,255,0.08); border: 1px solid rgba(0,229,255,0.3); padding: 4px 8px; border-radius: 4px; margin-top: 6px; display: inline-block;">
                    <span class="cliente-info" style="color:var(--neon-cyan); margin:0; font-size:11px;"><span class="lbl-info">📡 SEÑAL ROUTER:</span> TX: <b style="color:#fff">${t.tx || "--"}</b> | RX: <b style="color:#fff">${t.rx || "--"}</b></span>
                </div>`;
            }
            if (t.senalCaja) {
                extrasHtml += `<div style="background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.3); padding: 4px 8px; border-radius: 4px; margin-top: 6px; display: inline-block;">
                    <span class="cliente-info" style="color:var(--brand-orange); margin:0; font-size:11px;"><span class="lbl-info">📡 SEÑAL CAJA:</span> <b style="color:#fff">${t.senalCaja}</b></span>
                </div>`;
            }

            let slaHtml = "";
            if (t.tsInicio) {
                let hrInicio = new Date(t.tsInicio).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
                let hrFin = t.tsFin ? new Date(t.tsFin).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "--:--";
                let duracion = t.tsInicio && t.tsFin ? `(${Math.floor(Math.floor((t.tsFin - t.tsInicio) / 60000) / 60)}h ${Math.floor((t.tsFin - t.tsInicio) / 60000) % 60}m)` : "(En curso...)";
                slaHtml = `<div style="background: rgba(0,229,255,0.05); border: 1px dashed var(--neon-cyan); padding: 8px; border-radius: 6px; margin-top: 8px;">
                    <span class="cliente-info" style="margin-bottom:0; color:var(--neon-cyan)"><span class="lbl-info">⏱️ SLA:</span> Inicio: ${hrInicio} | Fin: ${hrFin} <b style="color:var(--text-main)">${duracion}</b></span>
                    ${t.notaCierre ? `<span class="cliente-info" style="margin-top:4px; margin-bottom:0; color:var(--neon-green)"><span class="lbl-info">📝 NOTA TEC:</span> ${t.notaCierre}</span>` : ""}
                </div>`;
            }

            let refHtml = t.referencia ? `<span class="cliente-info"><span class="lbl-info" style="color:var(--brand-orange)">REF:</span> ${t.referencia}</span>` : "";
            let notaEstilo = estActual === "rechazada" ? "color: var(--neon-red); font-weight: bold; background: rgba(239, 68, 68, 0.1); padding: 4px; border-radius: 4px;" : "color: var(--btn-pendiente);";

            let dirH = `<span class="badge-tipo ${colorBadge}">${nombreTipo} - ${t.detalle}</span>
                    <span class="cliente-info" style="margin-top:6px;"><span class="lbl-info">DIR:</span> ${t.dir}</span>
                    ${refHtml}
                    <span class="cliente-info"><span class="lbl-info">FECHA:</span> ${formatoFecha(t.fecha)} | ${t.horaInicio || "--:--"} a ${t.horaFin || "--:--"}</span>
                    <span class="cliente-info"><span class="lbl-info">TEC:</span> <span style="color:var(--btn-en-camino); font-weight:800">${asig.join(", ")}</span></span>
                    ${extrasHtml}
                    ${t.notas ? `<span class="cliente-info" style="${notaEstilo} margin-top:5px;"><span class="lbl-info">NOTA:</span> ${t.notas}</span>` : ""}
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
                            <button type="button" class="btn-action-ui" style="background: var(--neon-cyan); color: #000; flex: 1;" onclick="aprobarDirecto('${t.id}')">👍 Aprobar</button>
                            <button type="button" class="btn-action-ui" style="background: transparent; border: 1px solid var(--neon-red); color: var(--neon-red); flex: 1;" onclick="rechazarDirecto('${t.id}')">❌ Rechazar</button>
                        </div>`;
            }

            if ((isWilton || isAdmin || isAdminLurin) && estActual === "aprobada_wilton") {
                botonesHtml += `<div class="btn-grid-row"><button type="button" class="btn-action-ui btn-ui-wilton" onclick="editarTrabajo('${t.id}')">📅 Programar Técnico</button></div>`;
            }

            let textoAccion = "";
            let iconAccion = "";
            if (estActual === "pendiente") { textoAccion = "Ir en Camino"; iconAccion = "🚶"; } 
            else if (estActual === "en_camino") { textoAccion = "Finalizar Tarea"; iconAccion = "✅"; } 
            else if (estActual === "atendido") { textoAccion = "Marcar No Atendido"; iconAccion = "❌"; } 
            else if (estActual === "no_atendido") { textoAccion = "Volver a Pendiente"; iconAccion = "⏪"; }

            if (!isVendedor && !isCarlos && !isWilton && !isAdmin && !isAdminLurin && !esAprobacion) {
                botonesHtml += `<div class="btn-grid-row"><button type="button" class="btn-action-ui btn-ui-estado" onclick="cambiarEstado('${t.id}', '${estActual}')">${iconAccion} ${textoAccion}</button></div>`;
            }

            let btnCajaHtml = '';
            if (t.tipoTarea === "alta" || t.tipoTarea === "otros" || t.linkCaja) {
                if (t.linkCaja) {
                    btnCajaHtml = `<a href="${t.linkCaja}" target="_blank" class="btn-action-ui btn-ui-nap" style="text-decoration:none;">📦 Ver Caja NAP</a>`;
                } else {
                    btnCajaHtml = `<button type="button" class="btn-action-ui btn-ui-nap" disabled style="opacity:0.6;">📦 Sin Link Caja</button>`;
                }
            } else {
                btnCajaHtml = `<button type="button" class="btn-action-ui btn-ui-nap" style="visibility:hidden;">📦 Caja NAP</button>`;
            }

            let btnMapaHtml = '';
            if (t.mapa) {
                let isTecnico = !isVendedor && !isCarlos && !isWilton && !isAdmin && !isAdminLurin;
                let isLurinUser = zonaActual === "Lurin" || isAdminLurin;
                
                if (isTecnico || isLurinUser) {
                    btnMapaHtml = `<a href="${t.mapa}" target="_blank" class="btn-action-ui btn-ui-mapa" style="text-decoration:none;">📍 Rutear GPS</a>`;
                } else {
                    btnMapaHtml = `<button type="button" class="btn-action-ui btn-ui-mapa" onclick="verMapaCliente('${t.id}')">📍 Mapa</button>`;
                }
            } else {
                btnMapaHtml = `<button type="button" class="btn-action-ui btn-ui-mapa" disabled>📍 Mapa</button>`;
            }

            botonesHtml += `<div class="btn-grid-row">
                        ${btnMapaHtml}
                        ${btnCajaHtml}
                    </div>`;

            if (numLimpio.length > 5 && t.tipoTarea !== "otros") botonesHtml += `<div class="btn-grid-row"><a href="${linkWsp}" target="_blank" class="btn-action-ui btn-ui-wsp">💬 WhatsApp</a></div>`;

            let isTecnico = !isVendedor && !isCarlos && !isWilton && !isAdmin && !isAdminLurin;
            let btnSenalHtml = "";
            let textoBtnEditar = "✏️ Editar";
            let permitirEditarTecnico = false;

            if (t.tipoTarea === "alta" || t.tipoTarea === "averia") {
                btnSenalHtml = `<button type="button" class="btn-action-ui btn-ui-senal" style="background: rgba(0, 229, 255, 0.1); border: 1px solid var(--neon-cyan); color: var(--neon-cyan);" onclick="abrirModalSenal('${t.id}', '${t.tipoTarea}', '${t.detalle}')">📡 Registrar Señal</button>`;
            } else if (t.tipoTarea === "otros") {
                if (t.detalle === "Seguimiento de fibra") {
                    btnSenalHtml = `<button type="button" class="btn-action-ui btn-ui-senal" style="background: rgba(0, 229, 255, 0.1); border: 1px solid var(--neon-cyan); color: var(--neon-cyan);" onclick="abrirModalSenal('${t.id}', '${t.tipoTarea}', '${t.detalle}')">📡 Registrar Señal</button>`;
                } else if (t.detalle === "Limpieza de caja") {
                    permitirEditarTecnico = true; 
                    if (isTecnico) textoBtnEditar = "📋 Llenar Puertos y Señal";
                }
            }

            let btnEditGralHtml = "";
            if (isAdmin || isAdminLurin || isWilton || isCarlos || isVendedor || permitirEditarTecnico) {
                btnEditGralHtml = `<button type="button" class="btn-action-ui btn-ui-editar" onclick="editarTrabajo('${t.id}')">${textoBtnEditar}</button>`;
            }

            if (btnSenalHtml !== "") {
                botonesHtml += `<div class="btn-grid-row">${btnSenalHtml}</div>`;
            }
            
            botonesHtml += `<div class="btn-grid-row">
                        <button type="button" class="btn-action-ui btn-ui-copiar" onclick="copiarDatos(this)">📋 Copiar Datos</button>
                        ${btnEditGralHtml}
                    </div>`;

            if (isAdmin || isAdminLurin) {
                botonesHtml += `<div class="btn-grid-row"><button type="button" class="btn-action-ui btn-ui-eliminar" onclick="preguntarEliminar('${t.id}')">🗑️ Eliminar</button></div>`;
            }

            let tr = document.createElement("tr");
            tr.innerHTML = `
                <td><span class="estado-punto ${clasePunto}"></span><span style="font-size:11px; font-weight:900; color:${colorEstadoTxt};">${textEst}</span></td>
                <td>${infoCli}</td>
                <td>${dirH}</td>
                <td><div class="btn-acciones-grid">${botonesHtml}<textarea style="display:none;" class="texto-secreto">${txtCop}</textarea></div></td>
            `;
            tbody.appendChild(tr);
        } catch (err) {
            console.error("Error fila", err);
        }
    });

    actualizarGraficosGerenciales(pGrafico);
};

window.cambiarEstado = async (id, estadoActual) => {
    let nE = "pendiente";

    if (estadoActual === "pendiente") nE = "en_camino";
    else if (estadoActual === "en_camino") nE = "atendido";
    else if (estadoActual === "atendido") nE = "no_atendido";

    let dataUpdate = { estado: nE };

    if (nE === "en_camino") {
        dataUpdate.tsInicio = Date.now();
        await updateDoc(doc(coleccionTrabajos, id), dataUpdate);
        mostrarToast("Técnico en camino. Tiempo iniciado ⏱️");
    } else if (nE === "atendido" || nE === "no_atendido") {
        idTrabajoCierreSLA = id;
        estadoObjetivoSLA = nE;
        document.getElementById("lblEstadoCierre").innerText = nE.replace("_", " ").toUpperCase();
        document.getElementById("lblEstadoCierre").style.color = nE === "atendido" ? "var(--neon-green)" : "var(--neon-red)";
        document.getElementById("modalCierre").style.display = "flex";
    } else {
        dataUpdate.tsInicio = null;
        dataUpdate.tsFin = null;
        dataUpdate.notaCierre = null;
        await updateDoc(doc(coleccionTrabajos, id), dataUpdate);
        mostrarToast("Estado reseteado a Pendiente.");
    }
};

window.ejecutarCierreSLA = async () => {
    if (!idTrabajoCierreSLA) return;

    const nota = document.getElementById("txtNotaCierre").value.trim();

    if (!nota) {
        mostrarToast("❌ Debes ingresar una nota de cierre técnica.");
        return;
    }

    try {
        await updateDoc(doc(coleccionTrabajos, idTrabajoCierreSLA), {
            estado: estadoObjetivoSLA,
            tsFin: Date.now(),
            notaCierre: nota,
        });

        window.cerrarModalCierre();
        mostrarToast("Trabajo cerrado correctamente ✅");
    } catch (e) {
        mostrarToast("Error al cerrar tarea");
    }
};

/* STREAMING_CHUNK: Gráficos Gerenciales, Calendario y Mantenimiento de Puertos */
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
                    if (tech !== "Sin Asignar" && tech !== "Todos") {
                        cTech[tech] = (cTech[tech] || 0) + 1;
                    }
                });
            });

            document.getElementById("kpiTotal").innerText = trabajosFiltrados.length;
            document.getElementById("kpiAtendidos").innerText = aten;
            document.getElementById("kpiPendientes").innerText = pend;
            document.getElementById("kpiNoAtendidos").innerText = noAten;

            if (typeof window.renderizarCalendario === "function") window.renderizarCalendario();

            if (isAdmin || isAdminLurin || isWilton) {
                const isDark = document.documentElement.getAttribute("data-theme") !== "light";
                const textColor = isDark ? "#8b9bb4" : "#64748b";
                const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";

                const canvasT = document.getElementById("graficoTecnicos");

                if (canvasT) {
                    const ctxT = canvasT.getContext("2d");
                    if (chartTecnicos) chartTecnicos.destroy();

                    let gradient = ctxT.createLinearGradient(0, 0, 0, 400);
                    gradient.addColorStop(0, "#00e5ff");
                    gradient.addColorStop(1, "#d500f9");

                    chartTecnicos = new Chart(ctxT, {
                        type: "bar",
                        data: {
                            labels: Object.keys(cTech),
                            datasets: [{
                                data: Object.values(cTech),
                                backgroundColor: gradient,
                                borderRadius: 6,
                                barThickness: 40,
                            }],
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                                y: { grid: { color: gridColor }, ticks: { stepSize: 1, color: textColor } },
                                x: { grid: { display: false }, ticks: { color: textColor, font: { size: 10 } } },
                            },
                        },
                    });
                }
            }
        } catch (e) {
            console.error("Error gráficos:", e);
        }
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
            (t) =>
            (t.zona || "Norte") === zonaActual &&
            t.fecha === diaStr &&
            t.estado !== "por_aprobar_carlos" &&
            t.estado !== "aprobada_wilton" &&
            t.estado !== "rechazada"
        );

        const isActive = diaStr === diaSeleccionado;
        const isToday = diaStr === hoyStr;

        htmlStrip += `<div class="cal-week-day ${isActive ? "active" : ""} ${isToday ? "today" : ""}" onclick="seleccionarDia('${diaStr}')">
                    <div class="cal-week-dayname">${diasSemana[i]}</div>
                    <div class="cal-week-daynum">${diaNum}</div>
                    ${trabajosDia.length > 0 ? `<div class="cal-week-daycount">${trabajosDia.length}</div>` : ""}
                </div>`;
    }

    weekStrip.innerHTML = htmlStrip;

    const fechaSel = new Date(diaSeleccionado + "T00:00:00");
    dayHeader.textContent = fechaSel.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "short" }).toUpperCase();

    const trabajosSel = dbTrabajos
        .filter(
            (t) =>
            (t.zona || "Norte") === zonaActual &&
            t.fecha === diaSeleccionado &&
            t.estado !== "por_aprobar_carlos" &&
            t.estado !== "aprobada_wilton" &&
            t.estado !== "rechazada"
        )
        .sort((a, b) => (a.horaInicio || "23:59").localeCompare(b.horaInicio || "23:59"));

    if (trabajosSel.length === 0) {
        timelineMini.innerHTML = '<span style="color: var(--text-muted); font-size: 11px; opacity: 0.7;">📭 Sin trabajos programados</span>';
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
    if (buscador) { buscador.value = nombre; renderizarTabla(); mostrarToast(`🔍 Filtrando: ${nombre}`); document.querySelector("table")?.scrollIntoView({ behavior: "smooth" }); }
};

const coloresTecnicos = ["#2979ff", "#f50057", "#00e676", "#ffea00", "#d500f9", "#ff6d00", "#00e5ff", "#10b981"];

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
            id: t.id,
            title: `${t.horaInicio || ""} ${t.cliente}`,
            start: t.fecha + "T" + (t.horaInicio || "08:00") + ":00",
            end: t.fecha + "T" + (t.horaFin || "09:00") + ":00",
            backgroundColor: coloresAsignados[techPrincipal] + "CC",
            borderColor: coloresAsignados[techPrincipal],
            textColor: "#ffffff",
            extendedProps: {
                detalle: t.detalle || "", estado: t.estado || "pendiente",
                tecnicos: tecnicos.join(", "), notas: t.notas || "", claseTipo: claseColor,
            },
        });
    });

    window.calendarioInstancia = new FullCalendar.Calendar(calendarEl, {
        initialView: "timeGridWeek", locale: "es",
        headerToolbar: { left: "prev,next today", center: "title", right: "timeGridDay,timeGridWeek,dayGridMonth" },
        slotMinTime: "06:00:00", slotMaxTime: "22:00:00", allDaySlot: false, events: eventos,
        eventClick: function(info) {
            const props = info.event.extendedProps;
            mostrarToast(`${info.event.title} | ${props.detalle} | Téc: ${props.tecnicos} | Estado: ${props.estado.toUpperCase()}`);
        },
        eventDidMount: function(info) {
            const props = info.event.extendedProps;
            info.el.title = `${info.event.title}\nTécnicos: ${props.tecnicos}\nDetalle: ${props.detalle}\nNotas: ${props.notas}`;
        },
    });

    window.calendarioInstancia.render();
};

function actualizarOpcionesFechas() {
    const sel = document.getElementById("filtroFecha");
    const tZona = dbTrabajos.filter((t) => (t.zona || "Norte") === zonaActual);
    const fechas = [...new Set(tZona.map((t) => String(t.fecha)))].sort((a, b) => b.localeCompare(a));
    let h = `<option value="todas">Todas las Fechas</option>`;
    fechas.forEach((f) => { h += `<option value="${f}">${formatoFecha(f)}</option>`; });
    let v = sel.value;
    sel.innerHTML = h;
    if (fechas.includes(v)) sel.value = v;
}

function formatoFecha(fs) {
    if (!fs) return "";
    let p = String(fs).split("-");
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : fs;
}

function mostrarToast(msg) {
    const t = document.getElementById("toast");
    t.innerText = msg; t.className = "show";
    setTimeout(() => { t.className = t.className.replace("show", ""); }, 3000);
}

window.copiarDatos = (btn) => {
    let txt = btn.closest("td").querySelector(".texto-secreto").value;
    if (navigator.clipboard) { navigator.clipboard.writeText(txt).then(() => mostrarToast("Copiado")); } else { mostrarToast("Error al copiar"); }
};

window.preguntarEliminar = (id) => { idTrabajoAEliminar = id; document.getElementById("modalEliminar").style.display = "flex"; };
window.ejecutarEliminacion = async () => {
    if (idTrabajoAEliminar) {
        await deleteDoc(doc(coleccionTrabajos, idTrabajoAEliminar));
        mostrarToast("Trabajo Eliminado"); window.cerrarModalEliminar();
    }
};

window.procesarExcelClientes = async (event) => { /* Implementar según necesidad */ };
window.exportarAExcel = () => { /* Implementar según necesidad */ };

// ============================================================ //
// SELECTOR TIPO TAREA Y GENERADOR DE PUERTOS                  //
// ============================================================ //
window.seleccionarTipoTarea = (tipo) => {
    document.getElementById("formTipoTareaValue").value = tipo;

    document.querySelectorAll(".tab-btn").forEach((b) => {
        b.classList.remove("active-alta", "active-averia", "active-baja", "active-otros");
        if (b.id === "tabAveria") { b.style.color = "#8b9bb4"; b.style.borderColor = "var(--panel-border)"; }
        if (b.id === "tabOtros") { b.style.color = "#8b9bb4"; b.style.borderColor = "var(--panel-border)"; }
    });

    let tabActiva = document.getElementById("tab" + tipo.charAt(0).toUpperCase() + tipo.slice(1));
    tabActiva.classList.add("active-" + tipo);

    if (tipo === "averia") { tabActiva.style.color = "#2979ff"; tabActiva.style.borderColor = "#2979ff"; }
    if (tipo === "otros") { tabActiva.style.color = "#f59e0b"; tabActiva.style.borderColor = "#f59e0b"; }

    // Control Visual de Secciones Base
    if (tipo === "otros") {
        document.getElementById("camposClienteComunes").style.display = "none";
        document.getElementById("camposCajaComunes").style.display = "none";
        document.getElementById("cajaBuscador").style.display = "none";
    } else {
        document.getElementById("camposClienteComunes").style.display = "block";
        document.getElementById("camposCajaComunes").style.display = "block";
        document.getElementById("cajaBuscador").style.display = "block";
    }

    document.querySelector(".grupo-alta").style.display = tipo === "alta" ? "contents" : "none";
    document.querySelector(".grupo-averia").style.display = tipo === "averia" ? "block" : "none";
    document.querySelector(".grupo-baja").style.display = tipo === "baja" ? "block" : "none";
    document.querySelector(".grupo-otros").style.display = tipo === "otros" ? "block" : "none";
};

window.cambiarSubtipoOtros = () => {
    let tipo = document.getElementById("formTipoOtros").value;
    if (tipo === "Limpieza de caja") {
        document.getElementById("seccionLimpiezaCaja").style.display = "block";
        document.getElementById("seccionSeguimientoFibra").style.display = "none";
    } else {
        document.getElementById("seccionLimpiezaCaja").style.display = "none";
        document.getElementById("seccionSeguimientoFibra").style.display = "block";
    }
};

window.buscarClienteFibra = async () => {
    const queryVal = document.getElementById("formBusquedaFibra").value.trim();
    const inputNombre = document.getElementById("formClienteFibra");

    if (!queryVal) {
        mostrarToast("⚠️ Escribe un ID o DNI para buscar");
        return;
    }

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
    
    if (cant === 0) {
        container.innerHTML = "";
        return;
    }
    
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

    if (!queryVal) {
        mostrarToast("⚠️ Escribe un ID o DNI en la casilla del Puerto " + index);
        return;
    }

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

/* STREAMING_CHUNK: MODAL SEÑAL ÓPTICA (Exclusivo para Técnicos/NOC) */
// ============================================================ //
// MODAL SEÑAL ÓPTICA                                           //
// ============================================================ //
window.abrirModalSenal = (id, tipo, detalle) => {
    let t = dbTrabajos.find(x => x.id === id);
    if (!t) return;
    
    document.getElementById("formSenalId").value = id;
    
    // Rellenamos si ya tenía datos previos
    document.getElementById("modalFormTx").value = t.tx || "";
    document.getElementById("modalFormRx").value = t.rx || "";
    document.getElementById("modalFormSenalCaja").value = t.senalCaja || "";

    // Lógica Inteligente de Visibilidad
    if (tipo === "otros" && detalle === "Limpieza de caja") {
        document.getElementById("camposModalSenalRouter").style.display = "none";
        document.getElementById("camposModalSenalCaja").style.display = "block";
    } else {
        document.getElementById("camposModalSenalRouter").style.display = "flex";
        document.getElementById("camposModalSenalCaja").style.display = "none";
    }

    document.getElementById("modalSenal").style.display = "flex";
};

window.cerrarModalSenal = () => {
    document.getElementById("modalSenal").style.display = "none";
};

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

window.toggleCheckbox = (el) => {
    let chk = el.querySelector("input"); chk.checked = !chk.checked;
    let chks = document.querySelectorAll("#techDropdown input:checked");
    document.getElementById("techDisplay").innerText = chks.length === 0 ? "Sin Asignar" : Array.from(chks).map((c) => c.value).join(", ");
};

window.toggleTechDropdown = (e) => { if (e) e.stopPropagation(); document.getElementById("techDropdown").classList.toggle("show"); };

window.cerrarModal = () => { document.getElementById("modalAgregar").style.display = "none"; document.getElementById("techDropdown").classList.remove("show"); };
window.cerrarModalEliminar = () => { document.getElementById("modalEliminar").style.display = "none"; idTrabajoAEliminar = null; };
window.cerrarModalCierre = () => { document.getElementById("modalCierre").style.display = "none"; document.getElementById("txtNotaCierre").value = ""; idTrabajoCierreSLA = null; };
window.cerrarModalCobertura = () => { document.getElementById("modalCobertura").style.display = "none"; ventaAValidarId = null; window.cancelarRechazo(); };
window.cerrarModalRechazoRapido = () => { document.getElementById("modalRechazoRapido").style.display = "none"; idVentaARechazarRapido = null; };

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { window.cerrarModal(); window.cerrarModalEliminar(); window.cerrarModalCierre(); window.cerrarModalCobertura(); window.cerrarModalRechazoRapido(); window.cerrarModalSenal(); }
});

document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
            window.cerrarModal(); window.cerrarModalEliminar(); window.cerrarModalCierre(); window.cerrarModalCobertura(); window.cerrarModalRechazoRapido(); window.cerrarModalSenal();
            if (document.getElementById("modalCalendario").style.display === "flex") window.cerrarModalCalendario();
        }
    });
});

document.addEventListener("click", (e) => {
    let dropdown = document.getElementById("techDropdown"); let container = document.getElementById("techSelectContainer");
    if (dropdown && dropdown.classList.contains("show") && container && !container.contains(e.target)) dropdown.classList.remove("show");
});

window.toggleTema = window.toggleTema; window.iniciarSesion = window.iniciarSesion; window.recuperarContrasena = window.recuperarContrasena; window.cerrarSesion = window.cerrarSesion; window.cambiarZona = window.cambiarZona; window.buscarCliente = window.buscarCliente; window.calcularPrecioTotal = window.calcularPrecioTotal; window.abrirModal = window.abrirModal; window.editarTrabajo = window.editarTrabajo; window.guardarTrabajo = window.guardarTrabajo; window.abrirModalCoberturaGeneral = window.abrirModalCoberturaGeneral; window.abrirValidacionCobertura = window.abrirValidacionCobertura; window.verMapaCliente = window.verMapaCliente; window.buscarEnMapa = window.buscarEnMapa; window.centrarEnMiUbicacion = window.centrarEnMiUbicacion; window.confirmarAprobacionVenta = window.confirmarAprobacionVenta; window.confirmarRechazoVenta = window.confirmarRechazoVenta; window.iniciarRechazo = window.iniciarRechazo; window.cancelarRechazo = window.cancelarRechazo; window.aprobarDirecto = window.aprobarDirecto; window.rechazarDirecto = window.rechazarDirecto; window.confirmarRechazoRapido = window.confirmarRechazoRapido; window.renderizarTabla = window.renderizarTabla; window.cambiarEstado = window.cambiarEstado; window.ejecutarCierreSLA = window.ejecutarCierreSLA; window.renderizarCalendario = window.renderizarCalendario; window.navegarSemana = window.navegarSemana; window.irAHoy = window.irAHoy; window.seleccionarDia = window.seleccionarDia; window.filtrarPorCliente = window.filtrarPorCliente; window.abrirModalCalendario = window.abrirModalCalendario; window.cerrarModalCalendario = window.cerrarModalCalendario; window.actualizarCalendarioGeneral = window.actualizarCalendarioGeneral; window.copiarDatos = window.copiarDatos; window.preguntarEliminar = window.preguntarEliminar; window.ejecutarEliminacion = window.ejecutarEliminacion; window.procesarExcelClientes = window.procesarExcelClientes; window.exportarAExcel = window.exportarAExcel; window.seleccionarTipoTarea = window.seleccionarTipoTarea; window.cambiarSubtipoOtros = window.cambiarSubtipoOtros; window.buscarClienteFibra = window.buscarClienteFibra; window.generarPuertos = window.generarPuertos; window.buscarClientePuerto = window.buscarClientePuerto; window.abrirModalSenal = window.abrirModalSenal; window.cerrarModalSenal = window.cerrarModalSenal; window.guardarModalSenal = window.guardarModalSenal; window.toggleCheckbox = window.toggleCheckbox; window.toggleTechDropdown = window.toggleTechDropdown; window.cerrarModal = window.cerrarModal; window.cerrarModalEliminar = window.cerrarModalEliminar; window.cerrarModalCierre = window.cerrarModalCierre; window.cerrarModalCobertura = window.cerrarModalCobertura; window.cerrarModalRechazoRapido = window.cerrarModalRechazoRapido;