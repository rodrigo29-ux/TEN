import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, where, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCVqV5j0B-J96PwyHc0jmkdpNb5bBFAfOg",
  authDomain: "ten-soporte.firebaseapp.com",
  projectId: "ten-soporte",
  storageBucket: "ten-soporte.firebasestorage.app",
  messagingSenderId: "498950424371",
  appId: "1:498950424371:web:fce299a98cf8e57f822046"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ten-noc-app';

const coleccionTrabajos = collection(db, 'artifacts', appId, 'public', 'data', 'trabajos_v4');
const coleccionClientes = collection(db, 'artifacts', appId, 'public', 'data', 'clientes_base');

let dbTrabajos = [];
let isAdmin = false;
let nombreTecnicoLogueado = ""; 
let zonaActual = "Norte"; 

const tecnicosNorte = ["PATRICIO", "RENZO", "JUAN", "JESUS", "LOLI", "MARCELINO", "RICARDO", "CLEBER"];
const tecnicosLurin = ["BILLS", "CIELO"];

let chartAvance = null; 
let chartTecnicos = null;
let unsubscribeTrabajos = null;
let idTrabajoAEliminar = null;

const savedTheme = localStorage.getItem("temaTen") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);

window.toggleTema = () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("temaTen", newTheme);
    if (isAdmin) renderizarTabla();
};

/* MODALES Y CLICS AFUERA */
window.cerrarModal = () => { document.getElementById("modalAgregar").style.display = "none"; document.getElementById('techDropdown').classList.remove('show'); };
window.cerrarModalEliminar = () => { document.getElementById("modalEliminar").style.display = "none"; idTrabajoAEliminar = null; };

document.addEventListener('keydown', (e) => { 
    if (e.key === "Escape") { window.cerrarModal(); window.cerrarModalEliminar(); }
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { 
        if (e.target === overlay) { window.cerrarModal(); window.cerrarModalEliminar(); } 
    });
});

window.toggleTechDropdown = (e) => { 
    if(e) e.stopPropagation();
    document.getElementById('techDropdown').classList.toggle('show'); 
};

document.addEventListener('click', (e) => {
    let dropdown = document.getElementById('techDropdown');
    let container = document.getElementById('techSelectContainer');
    if (dropdown && dropdown.classList.contains('show')) {
        if (container && !container.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    }
});

window.toggleCheckbox = (el) => {
    let chk = el.querySelector('input');
    chk.checked = !chk.checked;
    let chks = document.querySelectorAll('#techDropdown input:checked');
    document.getElementById('techDisplay').innerText = chks.length === 0 ? "Sin Asignar" : Array.from(chks).map(c=>c.value).join(', ');
};

window.seleccionarTipoTarea = (tipo) => {
    document.getElementById('formTipoTareaValue').value = tipo;
    
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active-alta', 'active-averia', 'active-baja');
        // Reseteamos bordes especiales si es que los tienen
        if(b.id === 'tabAveria') { b.style.color = '#8b9bb4'; b.style.borderColor = 'var(--panel-border)'; }
    });
    
    let tabActiva = document.getElementById('tab' + tipo.charAt(0).toUpperCase() + tipo.slice(1));
    tabActiva.classList.add('active-' + tipo);

    if(tipo === 'averia') {
        tabActiva.style.color = '#2979ff';
        tabActiva.style.borderColor = '#2979ff';
    }

    document.getElementById('cajaBuscador').style.display = tipo === 'alta' ? 'none' : 'block';
    document.querySelector('.grupo-alta').style.display = tipo === 'alta' ? 'contents' : 'none';
    document.querySelector('.grupo-averia').style.display = tipo === 'averia' ? 'block' : 'none';
    document.querySelector('.grupo-baja').style.display = tipo === 'baja' ? 'block' : 'none';
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById("login-view").style.display = "none";
        document.getElementById("dashboard-view").style.display = "block";
        isAdmin = (user.email === "admin@ten.com");
        
        if(!isAdmin) {
            nombreTecnicoLogueado = user.email.split('@')[0].toUpperCase();
            document.getElementById("lblUsuarioActivo").innerHTML = nombreTecnicoLogueado;
            
            document.querySelectorAll(".admin-only").forEach(el => el.classList.remove('show-admin', 'show-admin-flex', 'show-admin-grid'));
            zonaActual = tecnicosLurin.includes(nombreTecnicoLogueado) ? "Lurin" : "Norte";
        } else {
            nombreTecnicoLogueado = "ADMIN";
            document.getElementById("lblUsuarioActivo").innerHTML = `👑 ADMINISTRADOR`;
            
            document.getElementById("contenedorSelectorZona").classList.add('show-admin-flex');
            document.getElementById("contenedorBotonesAccion").classList.add('show-admin-flex');
            document.getElementById("panelGraficosAdmin").classList.add('show-admin-grid');
            document.getElementById("filtroTecnicoContainer").classList.add('show-admin-flex');
            
            zonaActual = document.getElementById("selectorZona").value;
        }
        
        actualizarFiltroTecnicos();
        cargarTrabajosEnVivo(); 
    } else {
        if(unsubscribeTrabajos) unsubscribeTrabajos();
        dbTrabajos = [];
        document.getElementById("login-view").style.display = "flex";
        document.getElementById("dashboard-view").style.display = "none";
    }
});

window.iniciarSesion = () => {
    const email = document.getElementById("txtEmail").value.trim();
    const pass = document.getElementById("txtPassword").value;
    signInWithEmailAndPassword(auth, email, pass).catch(() => { document.getElementById("login-error").style.display = "block"; });
};
window.cerrarSesion = () => { signOut(auth); };

window.cambiarZona = (z) => { 
    zonaActual = z; 
    actualizarFiltroTecnicos(); 
    renderizarTabla(); 
};

function actualizarFiltroTecnicos() {
    let lista = zonaActual === "Norte" ? tecnicosNorte : tecnicosLurin;
    let html = `<option value="todos">Todos</option>`;
    lista.forEach(t => { html += `<option value="${t}">${t}</option>`; });
    document.getElementById("filtroTecnico").innerHTML = html;
}

function actualizarSelectTecnicosModal() {
    let lista = zonaActual === "Norte" ? tecnicosNorte : tecnicosLurin;
    let html = ``;
    lista.forEach(t => { 
        html += `<div class="multi-option" onclick="window.toggleCheckbox(this)"><input type="checkbox" value="${t}"><label>${t}</label></div>`; 
    });
    document.getElementById("techDropdown").innerHTML = html;
    document.getElementById("techDisplay").innerText = "Sin Asignar";
}

function cargarTrabajosEnVivo() {
    if(unsubscribeTrabajos) unsubscribeTrabajos();
    unsubscribeTrabajos = onSnapshot(coleccionTrabajos, (snapshot) => {
        dbTrabajos = []; 
        snapshot.forEach((doc) => { dbTrabajos.push({ id: doc.id, ...doc.data() }); });
        actualizarOpcionesFechas(); 
        renderizarTabla();
    });
}

window.procesarExcelClientes = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    document.getElementById('loaderUpload').style.display = 'block';
    mostrarToast("Analizando Excel...");

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
            const dataJSON = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
            
            let batch = writeBatch(db);
            let contador = 0; let subidos = 0;

            for (let row of dataJSON) {
                const idString = row["N° ID"] ? String(row["N° ID"]).trim() : null;
                if(!idString) continue; 

                let tels = [
                    row["Telefono PRINCIPAL"] ? String(row["Telefono PRINCIPAL"]) : "", 
                    row["Telefono 2"] ? String(row["Telefono 2"]) : "", 
                    row["Telefono 3"] ? String(row["Telefono 3"]) : "", 
                    row["Telefono 4"] ? String(row["Telefono 4"]) : "", 
                    row["Telefono 5"] ? String(row["Telefono 5"]) : ""
                ].filter(Boolean).join(" / ");
                
                let infoTv = "No TV";
                if(row["CABLE / IPTV"] && String(row["CABLE / IPTV"]).trim() !== "") infoTv = row["CABLE / IPTV"] + " (+20 S/)";
                else if (row["CABLE INCL / IPTV INCL"] && String(row["CABLE INCL / IPTV INCL"]).trim() !== "") infoTv = row["CABLE INCL / IPTV INCL"] + " (Costo 0)";
                
                let mapUbicacion = row["UBICACIÓN"] || row["UBICACION"] || row["ubicacion"] || row["Ubicacion"] || "";

                batch.set(doc(coleccionClientes, idString), {
                    id_cliente: idString, dni: row["N° Documento"] || "", nombre: row["Apellidos y Nombres"] || "",
                    telefonos: tels, direccion: row["Dirección"] || "", ubicacion: mapUbicacion,
                    zona: row["Zona"] || "", plan: row["PLAN"] || "", info_tv: infoTv
                });
                
                if (++contador === 400) { await batch.commit(); batch = writeBatch(db); contador = 0; }
                subidos++;
            }
            if (contador > 0) await batch.commit();
            document.getElementById('loaderUpload').style.display = 'none';
            mostrarToast(`¡Éxito! ${subidos} clientes actualizados.`);
            event.target.value = "";
        } catch (err) { console.error(err); mostrarToast("Error al leer Excel."); }
    };
    reader.readAsArrayBuffer(file);
};

window.buscarCliente = async () => {
    const id = document.getElementById('formIdCliente').value.trim();
    const msg = document.getElementById('searchResult');
    if(!id) return msg.innerText = "Escribe un ID primero";
    msg.innerText = "Buscando..."; msg.style.color = "var(--text-muted)";

    const docSnap = await getDocs(query(coleccionClientes, where("id_cliente", "==", id)));
    if (!docSnap.empty) {
        const data = docSnap.docs[0].data();
        document.getElementById('formNombre').value = data.nombre;
        document.getElementById('formDni').value = data.dni;
        document.getElementById('formTelefono').value = data.telefonos;
        document.getElementById('formDireccion').value = data.zona ? `${data.zona} - ${data.direccion}` : data.direccion;
        document.getElementById('formMapa').value = data.ubicacion;
        document.getElementById('formInfoRedAveria').value = `Plan: ${data.plan} | TV: ${data.info_tv}`;
        msg.innerText = "✅ Cliente Encontrado y Autocompletado"; msg.style.color = "var(--neon-green)";
    } else {
        msg.innerText = "❌ ID no encontrado en la base de datos."; msg.style.color = "var(--neon-red)";
    }
};

window.abrirModal = () => {
    if(isAdmin) zonaActual = document.getElementById("selectorZona").value;
    
    document.getElementById('formTrabajoId').value = "";
    document.querySelectorAll("#modalAgregar input[type=text]:not(.multi-select-display), #modalAgregar input[type=number], #modalAgregar textarea").forEach(i => i.value = "");
    document.getElementById('formFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('searchResult').innerText = "";
    
    actualizarSelectTecnicosModal();
    window.seleccionarTipoTarea('alta'); // Por defecto abre en Alta
    document.getElementById('modalAgregar').style.display = 'flex';
};

window.guardarTrabajo = async () => {
    let techSelec = Array.from(document.querySelectorAll('#techDropdown input:checked')).map(c => c.value);
    if(techSelec.length === 0) techSelec = ["Sin Asignar"];

    let tipo = document.getElementById('formTipoTareaValue').value;
    let data = {
        tipoTarea: tipo,
        fecha: document.getElementById('formFecha').value,
        horaInicio: document.getElementById('formHoraInicio').value,
        horaFin: document.getElementById('formHoraFin').value,
        tecnicos: techSelec,
        cliente: document.getElementById('formNombre').value || "Desconocido",
        dni: document.getElementById('formDni').value,
        tel: document.getElementById('formTelefono').value,
        dir: document.getElementById('formDireccion').value,
        mapa: document.getElementById('formMapa').value,
        zona: zonaActual
    };

    if (tipo === 'alta') {
        data.detalle = document.getElementById('formPlanAlta').value;
        data.caja = document.getElementById('formCajaAlta').value;
        data.puerto = document.getElementById('formPuertoAlta').value;
        data.notas = document.getElementById('formObsAlta').value;
    } else if (tipo === 'averia') {
        data.idCliente = document.getElementById('formIdCliente').value;
        data.detalle = document.getElementById('formProblemaAveria').value;
        data.notas = document.getElementById('formNotasAveria').value;
        data.infoRed = document.getElementById('formInfoRedAveria').value;
    } else if (tipo === 'baja') {
        data.idCliente = document.getElementById('formIdCliente').value;
        data.detalle = "Retiro de Equipos";
        data.notas = document.getElementById('formMotivoBaja').value;
        data.equipos = document.getElementById('formEquiposBaja').value;
    }

    let idTrabajo = document.getElementById('formTrabajoId').value;
    if(!idTrabajo) data.estado = "pendiente";

    try {
        if (idTrabajo) await updateDoc(doc(coleccionTrabajos, idTrabajo), data);
        else await addDoc(coleccionTrabajos, data);
        window.cerrarModal(); mostrarToast("Tarea guardada exitosamente");
    } catch (e) { mostrarToast("Error al guardar"); console.error(e); }
};

window.renderizarTabla = () => {
    const tbody = document.getElementById("tablaTrabajos");
    const filtroFecha = document.getElementById("filtroFecha").value;
    const filtroEstado = document.getElementById("filtroEstado").value;
    const txtBuscar = document.getElementById("buscador").value.toLowerCase();
    
    tbody.innerHTML = ""; 
    let pGrafico = [];
    
    let tZona = [...dbTrabajos].filter(t => (t.zona || "Norte") === zonaActual).sort((a,b) => {
        let res = (b.fecha||"").localeCompare(a.fecha||"");
        if (res === 0) return (a.horaInicio || "23:59").localeCompare(b.horaInicio || "23:59"); 
        return res;
    });

    tZona.forEach(t => {
        try {
            let asig = t.tecnicos || ["Sin Asignar"];
            if (typeof asig === 'string') asig = [asig];

            if (!isAdmin && !asig.includes(nombreTecnicoLogueado) && !asig.includes("Todos")) return;
            if (isAdmin && document.getElementById("filtroTecnico").value !== "todos" && !asig.includes(document.getElementById("filtroTecnico").value)) return;
            if (filtroFecha !== "todas" && t.fecha !== filtroFecha) return;
            
            let estActual = String(t.estado || "pendiente").toLowerCase();
            if (filtroEstado !== "todos" && estActual !== filtroEstado) return; 
            
            if (txtBuscar && !`${t.cliente} ${t.dni} ${t.dir} ${t.detalle}`.toLowerCase().includes(txtBuscar)) return;

            pGrafico.push(t);
            
            let esAten = (estActual === "atendido"); 
            let esSin = (estActual === "no_atendido"); 
            let esCamino = (estActual === "en_camino");

            let iconEst = esAten ? "ep-aten" : (esSin ? "ep-noat" : (esCamino ? "ep-cami" : "ep-pend"));
            let textEst = esAten ? "ATENDIDO" : (esSin ? "NO ATENDIDO" : (esCamino ? "EN CAMINO" : "PENDIENTE"));
            
            let colorBadge = t.tipoTarea === 'alta' ? 'alta' : (t.tipoTarea === 'averia' ? 'averia' : 'baja');
            let nombreTipo = t.tipoTarea === 'alta' ? '🚀 ALTA' : (t.tipoTarea === 'averia' ? '🛠️ AVERÍA' : '🛑 BAJA');

            let infoCli = `<span class="cliente-nombre">${t.cliente}</span>
                           <span class="cliente-info"><span class="lbl-info">DNI/RUC:</span> ${t.dni||'-'}</span>
                           <span class="cliente-info"><span class="lbl-info">TEL:</span> ${t.tel||'-'}</span>`;

            let extrasHtml = "";
            if(t.tipoTarea === 'alta' && (t.caja || t.puerto)) extrasHtml = `<br><span class="cliente-info" style="color:var(--neon-purple)"><span class="lbl-info">CAJA:</span> ${t.caja||'--'} | <span class="lbl-info">P:</span> ${t.puerto||'--'}</span>`;
            if(t.tipoTarea === 'averia' && t.infoRed) extrasHtml = `<br><span class="cliente-info" style="color:var(--neon-cyan)"><span class="lbl-info">RED:</span> ${t.infoRed}</span>`;
            if(t.tipoTarea === 'baja' && t.equipos) extrasHtml = `<br><span class="cliente-info" style="color:var(--neon-red)"><span class="lbl-info">RECOGER:</span> ${t.equipos}</span>`;

            let dirH = `<span class="badge-tipo ${colorBadge}">${nombreTipo} - ${t.detalle}</span>
                        <span class="cliente-info" style="margin-top:6px;"><span class="lbl-info">DIR:</span> ${t.dir}</span>
                        <span class="cliente-info"><span class="lbl-info">FECHA:</span> ${formatoFecha(t.fecha)} | ${t.horaInicio||'--:--'} a ${t.horaFin||'--:--'}</span>
                        <span class="cliente-info"><span class="lbl-info">TEC:</span> <span style="color:var(--btn-en-camino); font-weight:800">${asig.join(", ")}</span></span>
                        ${extrasHtml}
                        ${t.notas ? `<span class="cliente-info" style="color:var(--btn-pendiente); margin-top:5px;"><span class="lbl-info">NOTA:</span> ${t.notas}</span>` : ''}`;

            let numTelSeguro = String(t.tel || '');
            let numLimpio = numTelSeguro.replace(/\D/g, '');
            let linkWsp = numLimpio.length > 5 ? `https://wa.me/51${numLimpio}` : '#';
            
            let txtCop = `*FECHA:* ${formatoFecha(t.fecha)}\n*CLIENTE:* ${t.cliente}\n*DIR:* ${t.dir}\n*TAREA:* ${t.detalle}`;

            let tr = document.createElement("tr"); 
            tr.innerHTML = `
                <td><span class="estado-punto ${iconEst}"></span><span style="font-size:11px; font-weight:900; color:var(--text-muted);">${textEst}</span></td>
                <td>${infoCli}</td>
                <td>${dirH}</td>
                <td>
                    <div class="acciones-wrapper">
                        <button type="button" class="btn-estado-principal" onclick="cambiarEstado('${t.id}', '${estActual}')">⟳ ESTADO</button>
                        <div class="btn-grid-row">
                            ${t.mapa ? `<a href="${t.mapa}" target="_blank" class="btn-accion" style="color:var(--neon-pink)">📍 Map</a>` : ''}
                            ${numLimpio.length > 5 ? `<a href="${linkWsp}" target="_blank" class="btn-accion" style="color:var(--wsp-green)">💬 Wsp</a>` : ''}
                            <button type="button" class="btn-accion" onclick="copiarDatos(this)">📋 Info</button>
                        </div>
                        ${isAdmin ? `<div class="btn-grid-row"><button type="button" class="btn-accion" style="color:var(--neon-red)" onclick="preguntarEliminar('${t.id}')">🗑️ Eliminar</button></div>` : ''}
                        <textarea style="display:none;" class="texto-secreto">${txtCop}</textarea>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        } catch (err) {
            console.error("Error dibujando fila", err);
        }
    });

    // La función de gráficos se encarga de llenar las cajas KPIs
    actualizarGraficosGerenciales(pGrafico);
};

function actualizarGraficosGerenciales(trabajosFiltrados) {
    if(!isAdmin) return;
    
    setTimeout(() => {
        try {
            let pend = 0, aten = 0, noAten = 0; 
            let cTech = {};
            
            trabajosFiltrados.forEach(t => {
                let est = String(t.estado || "pendiente").toLowerCase();
                if (est === "atendido") aten++; 
                else if (est === "no_atendido") noAten++; 
                else pend++; // 'en_camino' y 'pendiente' suman aquí

                let asig = t.tecnicos || [];
                if(typeof asig === 'string') asig = [asig];
                asig.forEach(tech => { 
                    if (tech !== "Sin Asignar" && tech !== "Todos") { cTech[tech] = (cTech[tech] || 0) + 1; }
                });
            });

            // ACTUALIZAMOS LAS 4 CAJAS DE KPIs
            document.getElementById('kpiTotal').innerText = trabajosFiltrados.length;
            document.getElementById('kpiAtendidos').innerText = aten; 
            document.getElementById('kpiPendientes').innerText = pend; 
            document.getElementById('kpiNoAtendidos').innerText = noAten;

            const isDark = document.documentElement.getAttribute("data-theme") !== "light";
            const textColor = isDark ? '#8b9bb4' : '#64748b';
            const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

            // DIBUJAR GRÁFICO DE ANILLO (ESTADOS)
            const canvasA = document.getElementById('graficoAvance');
            if(canvasA) {
                const ctxA = canvasA.getContext('2d');
                if (chartAvance) chartAvance.destroy();
                
                let dataG = (aten === 0 && noAten === 0 && pend === 0) ? [1] : [aten, noAten, pend];
                let colorsG = (aten === 0 && noAten === 0 && pend === 0) ? ['#232838'] : ['#00e5ff', '#ff1744', '#ffea00'];
                let labelsG = (aten === 0 && noAten === 0 && pend === 0) ? ['Sin Tareas'] : ['Atendidos', 'No Atendidos', 'Pendientes'];

                chartAvance = new Chart(ctxA, { 
                    type: 'doughnut', 
                    data: { labels: labelsG, datasets: [{ data: dataG, backgroundColor: colorsG, borderWidth: 0, hoverOffset: 4, cutout: '75%' }] }, 
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: textColor, font: {size: 11} } } } } 
                });
            }

            // DIBUJAR GRÁFICO DE BARRAS (TÉCNICOS)
            const canvasT = document.getElementById('graficoTecnicos');
            if(canvasT) {
                const ctxT = canvasT.getContext('2d');
                if (chartTecnicos) chartTecnicos.destroy();
                
                let gradient = ctxT.createLinearGradient(0, 0, 0, 400);
                gradient.addColorStop(0, '#00e5ff');
                gradient.addColorStop(1, '#d500f9');

                chartTecnicos = new Chart(ctxT, { 
                    type: 'bar', 
                    data: { labels: Object.keys(cTech), datasets: [{ data: Object.values(cTech), backgroundColor: gradient, borderRadius: 6, barThickness: 40 }] }, 
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid:{color: gridColor}, ticks: { stepSize: 1, color: textColor } }, x: { grid:{display:false}, ticks: { color: textColor, font:{size:10} } } } } 
                });
            }
        } catch(e) {
            console.error("Error dibujando los gráficos:", e);
        }
    }, 150);
}

function actualizarOpcionesFechas() {
    const sel = document.getElementById("filtroFecha");
    const tZona = dbTrabajos.filter(t => (t.zona || "Norte") === zonaActual);
    const fechas = [...new Set(tZona.map(t => String(t.fecha)))].sort((a,b) => b.localeCompare(a));
    let h = `<option value="todas">Todas las Fechas</option>`;
    fechas.forEach(f => { h += `<option value="${f}">${formatoFecha(f)}</option>`; });
    let v = sel.value; sel.innerHTML = h; if(fechas.includes(v)) sel.value = v;
}

window.exportarAExcel = () => {
    try {
        if (!isAdmin) return;
        const filtroFecha = document.getElementById("filtroFecha").value;
        let datosExportar = dbTrabajos.filter(t => (t.zona || "Norte") === zonaActual);
        if (filtroFecha !== "todas") datosExportar = datosExportar.filter(t => t.fecha === filtroFecha);
        
        let dataClean = datosExportar.map(t => {
            let tecnicos = t.tecnicos || [];
            if (typeof tecnicos === 'string') tecnicos = [tecnicos];
            
            return {
                "Fecha": String(t.fecha || ""),
                "Hora": `${t.horaInicio||''} - ${t.horaFin||''}`,
                "Categoría": String(t.tipoTarea || t.tipo || "").toUpperCase(),
                "Detalle": String(t.detalle || ""),
                "Estado": String(t.estado || "").toUpperCase(),
                "Cliente": String(t.cliente || ""),
                "DNI/RUC": String(t.dni || t.doc || ""),
                "Teléfono": String(t.tel || ""),
                "Dirección": String(t.dir || ""),
                "Técnicos": tecnicos.join(", "),
                "Notas": String(t.notas || ""),
                "Caja NAP": String(t.caja || ""),
                "Puerto": String(t.puerto || "")
            };
        });

        if (dataClean.length === 0) return mostrarToast("No hay datos para exportar");
        const hojaExcel = XLSX.utils.json_to_sheet(dataClean);
        const libroExcel = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libroExcel, hojaExcel, `Reporte TEN`);
        XLSX.writeFile(libroExcel, `Reporte_TEN_${new Date().toLocaleDateString('es-PE').replace(/\//g, '-')}.xlsx`);
        mostrarToast("Excel descargado correctamente");
    } catch (error) {
        console.error(error);
        mostrarToast("Error al exportar el Excel");
    }
};

window.cambiarEstado = async (id, estadoActual) => {
    let nE = "pendiente";
    if(estadoActual === "pendiente") nE = "en_camino";
    else if (estadoActual === "en_camino") nE = "atendido";
    else if (estadoActual === "atendido") nE = "no_atendido";
    
    await updateDoc(doc(coleccionTrabajos, id), { estado: nE });
    mostrarToast("Estado actualizado");
};

window.preguntarEliminar = (id) => {
    idTrabajoAEliminar = id;
    document.getElementById('modalEliminar').style.display = 'flex';
};

window.ejecutarEliminacion = async () => {
    if(idTrabajoAEliminar) {
        await deleteDoc(doc(coleccionTrabajos, idTrabajoAEliminar)); 
        mostrarToast("Trabajo Eliminado");
        window.cerrarModalEliminar();
    }
};

function formatoFecha(fs) { if(!fs) return ""; let p = String(fs).split("-"); return p.length===3 ? `${p[2]}/${p[1]}/${p[0]}` : fs; }
function mostrarToast(msg) { const t = document.getElementById("toast"); t.innerText = msg; t.className = "show"; setTimeout(() => { t.className = t.className.replace("show", ""); }, 3000); }
window.copiarDatos = (btn) => { 
    let txt = btn.closest("td").querySelector(".texto-secreto").value; 
    navigator.clipboard ? navigator.clipboard.writeText(txt).then(()=>mostrarToast("Copiado")) : mostrarToast("Error al copiar"); 
};