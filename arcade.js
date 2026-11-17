
// ============================================================ //
// 🎮 SALA DE ARCADE SECRETA (CLOUD LEADERBOARD - FIREBASE)     //
// ============================================================ //

let globalAudioCtx = null;
const obtenerAudioCtx = () => {
    if (!globalAudioCtx) globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (globalAudioCtx.state === 'suspended') globalAudioCtx.resume();
    return globalAudioCtx;
};
const playSonido = (frecuencia, tipo, duracion, volumen = 0.1) => {
    try {
        const ctx = obtenerAudioCtx();
        let osc = ctx.createOscillator(); let gain = ctx.createGain();
        osc.type = tipo; osc.frequency.setValueAtTime(frecuencia, ctx.currentTime);
        gain.gain.setValueAtTime(volumen, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duracion);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + duracion);
    } catch(e) {}
};

window.playSonidoLogro = () => {
    playSonido(523.25, 'square', 0.1, 0.15); setTimeout(() => playSonido(659.25, 'square', 0.1, 0.15), 100); 
    setTimeout(() => playSonido(783.99, 'square', 0.2, 0.15), 200); setTimeout(() => playSonido(1046.50, 'square', 0.3, 0.15), 300); 
};
window.playSonidoRecord = () => {
    playSonido(1046.50, 'square', 0.1, 0.2); setTimeout(() => playSonido(1318.51, 'square', 0.3, 0.2), 100);
};

window.loopArcade = null; window.musicaArcade = null; window.accionArcadeActual = null; 

window.playMusicaJuego = (tipo) => {
    clearInterval(window.musicaArcade);
    let melodia = []; let velocidad = 250;
    if (tipo === 'snake') { melodia = [261.63, 329.63, 392.00, 523.25]; velocidad = 250; }
    else if (tipo === 'flappy') { melodia = [392.00, 0, 329.63, 0, 261.63, 0]; velocidad = 180; } 
    else if (tipo === 'dino') { melodia = [130.81, 130.81, 0, 164.81, 0]; velocidad = 200; } 
    if (melodia.length > 0) {
        let nota = 0;
        window.musicaArcade = setInterval(() => {
            if (melodia[nota] > 0) playSonido(melodia[nota], 'square', velocidad/1000, 0.03);
            nota = (nota + 1) % melodia.length;
        }, velocidad);
    }
};

window.limpiarEventosArcade = () => {
    if(window.accionArcadeActual) {
        document.removeEventListener("keydown", window.accionArcadeActual);
        let cvs = document.getElementById("canvasArcade");
        if(cvs) { cvs.removeEventListener("touchstart", window.accionArcadeActual); cvs.removeEventListener("touchend", window.accionArcadeActual); cvs.removeEventListener("mousedown", window.accionArcadeActual); }
    }
};

// 🔥 VARIABLES GLOBALES DEL ARCADE (NUBE)
window.arcadeScoresGlobal = { snake: [], flappy: [], dino: [] };
window.arcadeListener = null;
window.juegoArcadeActivo = null;

// 🔥 1. ESCUCHADOR EN TIEMPO REAL (FIREBASE)
window.iniciarEscuchaArcade = async () => {
    if (window.arcadeListener) return; // Ya está escuchando
    try {
        const { collection, onSnapshot, query } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        // Usamos las variables 'db' y 'appId' que ya tienes configuradas al inicio de app.js
        const colArcade = collection(db, "artifacts", appId, "public", "data", "arcade_scores");
        
        window.arcadeListener = onSnapshot(query(colArcade), (snapshot) => {
            let scores = { snake: [], flappy: [], dino: [] };
            
            snapshot.forEach(docSnap => {
                let d = docSnap.data();
                // Bloqueo de seguridad por si hay algún dato fantasma antiguo
                if (d.nombre !== "Técnico" && d.nombre !== "Invitado" && scores[d.juego]) {
                    scores[d.juego].push(d);
                }
            });
            
            // Ordenar de mayor a menor puntaje
            for (let k in scores) scores[k].sort((a, b) => b.score - a.score);
            
            window.arcadeScoresGlobal = scores;
            
            // Si hay un juego abierto, refrescamos el Top 3 en vivo
            if (window.juegoArcadeActivo) {
                window.renderizarMiniLeaderboard(window.juegoArcadeActivo);
                
                // Actualizar BEST SCORE del jugador en vivo si alguien más jugó en otro dispositivo
                let jugador = window.obtenerJugadorActual();
                let miRecordDoc = scores[window.juegoArcadeActivo].find(u => u.nombre === jugador.nombre);
                if (miRecordDoc) {
                    let spanBest = document.getElementById("arcadeBest");
                    if (spanBest) {
                        let currentBestOnScreen = parseInt(spanBest.innerText) || 0;
                        if (miRecordDoc.score > currentBestOnScreen) {
                            spanBest.innerText = miRecordDoc.score;
                        }
                    }
                }
            }
        });
    } catch(e) {
        console.error("Error conectando Arcade a Firebase:", e);
    }
};

window.cerrarArcade = () => {
    clearInterval(window.loopArcade); clearInterval(window.musicaArcade);
    window.juegoArcadeActivo = null;
    window.limpiarEventosArcade();
    let modal = document.getElementById("modalArcade"); if(modal) modal.remove();
};

window.obtenerJugadorActual = () => {
    let nombre = window.nombreUsuarioGlobal || window.nombreTecnicoLogueado || localStorage.getItem('ten_email') || "Usuario Desconocido";
    if (nombre.includes("@")) nombre = nombre.split("@")[0].toUpperCase();

    let foto = window.fotoTecnicoLogueado;
    if (!foto) {
        let elFoto = document.getElementById('imgFotoPerfilTEN');
        if (elFoto && elFoto.src && !elFoto.src.includes('logo')) foto = elFoto.src;
        else foto = `https://api.dicebear.com/7.x/avataaars/svg?seed=${nombre}`;
    }
    return { nombre, foto };
};

// 🔥 2. GUARDAR RÉCORD EN LA NUBE (FIREBASE)
window.guardarEnRankingGlobal = async (tipoJuego, puntos) => {
    if (puntos === 0) return; 
    let jugador = window.obtenerJugadorActual();
    
    let rankingActual = window.arcadeScoresGlobal[tipoJuego] || [];
    let miRecordAnterior = rankingActual.find(u => u.nombre === jugador.nombre);
    
    // Evitamos enviar peticiones a Firebase si no ha superado su propio récord en la nube
    if (miRecordAnterior && puntos <= miRecordAnterior.score) return;
    
    // 1. Actualización visual instantánea (para que no haya lag en pantalla)
    if (miRecordAnterior) {
        miRecordAnterior.score = puntos;
        miRecordAnterior.foto = jugador.foto;
    } else {
        rankingActual.push({ nombre: jugador.nombre, foto: jugador.foto, score: puntos, juego: tipoJuego });
    }
    rankingActual.sort((a, b) => b.score - a.score);
    window.arcadeScoresGlobal[tipoJuego] = rankingActual;
    window.renderizarMiniLeaderboard(tipoJuego);
    
    // 2. Disparo asíncrono a Firebase
    try {
        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        // Usamos un ID de documento único combinando nombre y juego (ej: RPACOTAIPE_snake)
        const docId = `${jugador.nombre}_${tipoJuego}`;
        const docRef = doc(db, "artifacts", appId, "public", "data", "arcade_scores", docId);
        
        await setDoc(docRef, {
            nombre: jugador.nombre,
            foto: jugador.foto,
            score: puntos,
            juego: tipoJuego,
            tsActualizacion: Date.now()
        });
    } catch (e) {
        console.error("Error al guardar récord en la nube:", e);
    }
};

window.renderizarMiniLeaderboard = (tipoJuego) => {
    let ranking = window.arcadeScoresGlobal[tipoJuego] || [];
    let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h3 style="color:var(--accent); font-size:1rem; margin:0; text-transform:uppercase; text-shadow:0 0 5px var(--accent);">🏆 TOP 3 GLOBAL</h3>
                    <i class="fa-solid fa-cloud" style="color:var(--success); font-size:12px; opacity:0.8;" title="Conectado a la Nube"></i>
                </div>`;
    
    if (ranking.length === 0) {
        html += `<p style="color:#94a3b8; font-size:0.85rem; font-style:italic;">Nadie ha jugado aún. ¡Sé el primero en dejar tu marca!</p>`;
    } else {
        for (let i = 0; i < 3 && i < ranking.length; i++) {
            let medalla = i === 0 ? "🥇" : (i === 1 ? "🥈" : "🥉");
            let colorTexto = i === 0 ? "#facc15" : (i === 1 ? "#e2e8f0" : "#cd7f32");
            
            html += `
                <div style="display:flex; align-items:center; background:rgba(255,255,255,0.05); padding:6px 12px; border-radius:8px; margin-bottom:6px; border-left:3px solid ${colorTexto}; box-shadow:0 2px 5px rgba(0,0,0,0.2);">
                    <span style="font-size:16px; width:25px; text-align:center;">${medalla}</span>
                    <img src="${ranking[i].foto}" style="width:24px; height:24px; border-radius:50%; background:#fff; margin:0 10px; border:1px solid ${colorTexto}; object-fit:cover;">
                    <div style="flex-grow:1; text-align:left; font-weight:bold; color:#f8fafc; font-size:0.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${ranking[i].nombre}
                    </div>
                    <div style="font-weight:900; color:${colorTexto}; font-size:1rem;">
                        ${ranking[i].score}
                    </div>
                </div>
            `;
        }
    }
    
    let cont = document.getElementById("miniLeaderboardContenido");
    if(cont) cont.innerHTML = html;
};

window.abrirMenuArcade = () => {
    if(document.getElementById("modalArcade")) return;
    
    // Encendemos el motor en la nube al abrir el Arcade
    window.iniciarEscuchaArcade();

    let overlay = document.createElement("div"); overlay.id = "modalArcade";
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.98); z-index:999999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; font-family:monospace; animation: fadeIn 0.3s ease-out; overflow-y:auto;";
    
    overlay.innerHTML = `
        <div style="max-width: 400px; width: 90%; text-align: center;">
            <h1 style="color:var(--accent); text-shadow: 0 0 15px var(--accent); font-size: 2.2rem; margin-bottom: 25px; font-weight:900;">🕹️ TEN ARCADE</h1>
            
            <div id="pantallaJuego" style="display:none; flex-direction:column; align-items:center;">
                <div style="display:flex; justify-content:space-between; width:100%; max-width:300px; margin-bottom:10px; align-items:center;">
                    <span style="font-size:1.2rem; font-weight:bold; color:var(--warning);">SCORE: <span id="arcadeScore">0</span> <span style="font-size:0.8rem; color:#94a3b8; margin-left:10px;">| BEST: <span id="arcadeBest" style="color:var(--success);">0</span></span></span>
                    <button onclick="window.volverMenuArcade()" style="background:var(--danger); border:none; color:white; padding:4px 10px; border-radius:4px; font-weight:bold; cursor:pointer;">Menu 🔙</button>
                </div>
                
                <canvas id="canvasArcade" width="300" height="300" style="background:#000; border:4px solid var(--accent); border-radius:8px; box-shadow:0 0 30px rgba(0, 229, 255, 0.3); cursor:pointer; touch-action:none; margin-bottom:10px;"></canvas>
                <div id="miniLeaderboardContenido" style="width:100%; max-width:300px; margin-bottom:10px; background:rgba(15,23,42,0.5); padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.1);"></div>
                
                <div id="controlesSnake" style="display:none; grid-template-columns: 60px 60px 60px; gap:10px;">
                    <div></div><button onclick="window.dirSnake(0,-1)" style="height:45px; font-size:18px; border-radius:8px; background:rgba(255,255,255,0.1); border:1px solid #fff;">⬆️</button><div></div>
                    <button onclick="window.dirSnake(-1,0)" style="height:45px; font-size:18px; border-radius:8px; background:rgba(255,255,255,0.1); border:1px solid #fff;">⬅️</button>
                    <button onclick="window.dirSnake(0,1)" style="height:45px; font-size:18px; border-radius:8px; background:rgba(255,255,255,0.1); border:1px solid #fff;">⬇️</button>
                    <button onclick="window.dirSnake(1,0)" style="height:45px; font-size:18px; border-radius:8px; background:rgba(255,255,255,0.1); border:1px solid #fff;">➡️</button>
                </div>
                <div id="tipTextoArcade" style="width:300px; color:var(--text-muted); font-size:12px; font-weight:bold;"></div>
            </div>

            <div id="listaJuegos" style="display:flex; flex-direction:column; gap: 15px;">
                <button onclick="window.iniciarJuego('snake')" style="padding: 15px; background: rgba(0, 229, 255, 0.1); border: 2px solid var(--accent); color: white; font-size: 1.1rem; border-radius: 8px; cursor:pointer; font-weight:bold; transition:0.2s;">🐍 EL GUSANITO (Snake)</button>
                <button onclick="window.iniciarJuego('flappy')" style="padding: 15px; background: rgba(168, 85, 247, 0.1); border: 2px solid var(--purple); color: white; font-size: 1.1rem; border-radius: 8px; cursor:pointer; font-weight:bold; transition:0.2s;">🦅 FLAPPY MICHI</button>
                <button onclick="window.iniciarJuego('dino')" style="padding: 15px; background: rgba(245, 158, 11, 0.1); border: 2px solid var(--warning); color: white; font-size: 1.1rem; border-radius: 8px; cursor:pointer; font-weight:bold; transition:0.2s;">🦖 TÉCNICO EN APUROS</button>
                <button onclick="window.cerrarArcade()" style="margin-top:20px; padding: 10px; background:transparent; border:none; color:var(--text-muted); text-decoration:underline; font-size: 1rem; cursor:pointer;">Salir del Arcade</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
};

window.volverMenuArcade = () => {
    clearInterval(window.loopArcade); clearInterval(window.musicaArcade); 
    window.juegoArcadeActivo = null;
    window.limpiarEventosArcade();
    document.getElementById("pantallaJuego").style.display = "none"; document.getElementById("listaJuegos").style.display = "flex";
};

// ======================= LÓGICA DE JUEGOS ======================= //
window.iniciarJuego = (tipo) => {
    window.juegoArcadeActivo = tipo; // Registramos a qué está jugando para la nube
    
    document.getElementById("listaJuegos").style.display = "none"; document.getElementById("pantallaJuego").style.display = "flex";
    let cvs = document.getElementById("canvasArcade"); let ctx = cvs.getContext("2d"); let score = 0;
    
    // Obtener jugador real y su récord de la Nube (o recuperar el de localStorage si acaba de migrar)
    let jugador = window.obtenerJugadorActual();
    let rankingJuego = window.arcadeScoresGlobal[tipo] || [];
    let miRecordNube = rankingJuego.find(u => u.nombre === jugador.nombre);
    
    let bestScore = miRecordNube ? miRecordNube.score : (parseInt(localStorage.getItem(`ten_arcade_best_${tipo}_${jugador.nombre}`)) || 0);
    let nuevoRecordAlcanzado = false;
    
    // Sincronizar el viejo local a la nube de inmediato si existía
    if (!miRecordNube && bestScore > 0) window.guardarEnRankingGlobal(tipo, bestScore);
    
    document.getElementById("arcadeScore").innerText = "0"; document.getElementById("arcadeBest").innerText = bestScore;
    document.getElementById("controlesSnake").style.display = tipo === 'snake' ? "grid" : "none";
    let tip = document.getElementById("tipTextoArcade");
    tip.innerHTML = tipo === 'snake' ? "💡 TIP: Desliza el dedo sobre el cuadro negro para moverte." : "💡 TIP: Toca el cuadro negro para saltar.";
    
    window.renderizarMiniLeaderboard(tipo); window.playMusicaJuego(tipo); window.limpiarEventosArcade();

    const verificarRecord = (puntosActuales) => {
        if (puntosActuales > bestScore) {
            bestScore = puntosActuales; 
            document.getElementById("arcadeBest").innerText = bestScore;
            
            // Envía la petición asíncrona a Firebase
            window.guardarEnRankingGlobal(tipo, bestScore);

            if (!nuevoRecordAlcanzado && bestScore > 0) {
                nuevoRecordAlcanzado = true; window.playSonidoRecord();
                document.getElementById("arcadeBest").style.color = "#00e5ff"; document.getElementById("arcadeBest").style.textShadow = "0 0 10px #00e5ff";
            }
        }
    };

    if (tipo === 'snake') {
        let estado = 0; let px=10, py=10, gs=15, tc=20, ax=15, ay=15, xv=0, yv=0, trail=[], tail=5; let tsX = 0, tsY = 0; 
        window.dirSnake = (x, y) => { if(estado === 0) { estado = 1; obtenerAudioCtx(); } if(x!==0 && xv!==-x){xv=x; yv=0;} if(y!==0 && yv!==-y){xv=0; yv=y;} };
        window.accionArcadeActual = (e) => {
            if(e.type === "keydown") {
                if([37,38,39,40].includes(e.keyCode)) e.preventDefault();
                if(estado === 0) { estado = 1; obtenerAudioCtx(); }
                if(e.keyCode===37 && xv!==1){xv=-1; yv=0;} if(e.keyCode===38 && yv!==1){xv=0; yv=-1;}
                if(e.keyCode===39 && xv!==-1){xv=1; yv=0;} if(e.keyCode===40 && yv!==-1){xv=0; yv=1;}
            } 
            else if (e.type === "touchstart") { tsX = e.touches[0].clientX; tsY = e.touches[0].clientY; } 
            else if (e.type === "touchend") {
                let teX = e.changedTouches[0].clientX; let teY = e.changedTouches[0].clientY; let dX = teX - tsX; let dY = teY - tsY;
                if (Math.abs(dX) < 20 && Math.abs(dY) < 20) { if (estado === 0) { estado = 1; xv = 1; yv = 0; obtenerAudioCtx(); } return; }
                if (estado === 0) { estado = 1; obtenerAudioCtx(); }
                if (Math.abs(dX) > Math.abs(dY)) { if (dX > 0 && xv !== -1) { xv = 1; yv = 0; } else if (dX < 0 && xv !== 1) { xv = -1; yv = 0; } } 
                else { if (dY > 0 && yv !== -1) { xv = 0; yv = 1; } else if (dY < 0 && yv !== 1) { xv = 0; yv = -1; } }
            }
        };
        document.addEventListener("keydown", window.accionArcadeActual); cvs.addEventListener("touchstart", window.accionArcadeActual, {passive: false}); cvs.addEventListener("touchend", window.accionArcadeActual, {passive: false});
        
        window.loopArcade = setInterval(() => {
            ctx.fillStyle="#0f172a"; ctx.fillRect(0,0,cvs.width,cvs.height);
            if (estado === 0) { ctx.fillStyle="white"; ctx.font="16px monospace"; ctx.textAlign="center"; ctx.fillText("DESLIZA EL DEDO PARA INICIAR", cvs.width/2, cvs.height/2); return; }
            px+=xv; py+=yv; if(px<0) px=tc-1; if(px>tc-1) px=0; if(py<0) py=tc-1; if(py>tc-1) py=0;
            ctx.fillStyle="#00e5ff";
            for(let i=0; i<trail.length; i++) {
                ctx.fillRect(trail[i].x*gs, trail[i].y*gs, gs-2, gs-2);
                if(trail[i].x===px && trail[i].y===py && (xv!==0||yv!==0)) { 
                    tail=5; score=0; document.getElementById("arcadeScore").innerText=score;
                    nuevoRecordAlcanzado=false; document.getElementById("arcadeBest").style.color="var(--success)"; document.getElementById("arcadeBest").style.textShadow="none";
                    playSonido(150, 'sawtooth', 0.5, 0.2); xv=0; yv=0; px=10; py=10; estado = 0;
                }
            }
            trail.push({x:px, y:py}); while(trail.length>tail) trail.shift();
            if(ax===px && ay===py) { 
                tail++; score+=10; document.getElementById("arcadeScore").innerText=score; verificarRecord(score);
                if (!nuevoRecordAlcanzado || score % 50 !== 0) playSonido(800, 'square', 0.1, 0.15); 
                ax=Math.floor(Math.random()*tc); ay=Math.floor(Math.random()*tc);
            }
            ctx.fillStyle="#f43f5e"; ctx.fillRect(ax*gs, ay*gs, gs-2, gs-2);
        }, 1000/12); 
    }
    
    else if (tipo === 'flappy') {
        let estado = 0; let bY=150, vY=0, g=2, jump=-12, pipes=[], frame=0;
        window.accionArcadeActual = (e) => {
            if(e && e.type === "keydown" && e.keyCode !== 32) return; 
            if(e) e.preventDefault(); obtenerAudioCtx(); 
            if (estado === 0) {
                bY=150; vY=jump; pipes=[]; score=0; frame=0; estado = 1; document.getElementById("arcadeScore").innerText = score;
                nuevoRecordAlcanzado=false; document.getElementById("arcadeBest").style.color="var(--success)"; document.getElementById("arcadeBest").style.textShadow="none";
                playSonido(400, 'square', 0.1, 0.1);
            } else if (estado === 1) { vY = jump; playSonido(400, 'square', 0.1, 0.1); } else if (estado === 2) { estado = 0; }
        };
        document.addEventListener("keydown", window.accionArcadeActual); cvs.addEventListener("touchstart", window.accionArcadeActual, {passive: false}); cvs.addEventListener("mousedown", window.accionArcadeActual);
        
        window.loopArcade = setInterval(() => {
            ctx.fillStyle="#38bdf8"; ctx.fillRect(0,0,cvs.width,cvs.height); ctx.textAlign = "center";
            if (estado === 0) { ctx.font = "24px Arial"; ctx.fillText("😸", cvs.width/2, 150); ctx.fillStyle="white"; ctx.font="18px monospace"; ctx.fillText("TOCA PARA EMPEZAR", cvs.width/2, 200); return; }
            if (estado === 1) { vY += g; bY += vY; frame++; if(frame % 50 === 0) { let pipeY = Math.random() * (cvs.height - 180) + 60; pipes.push({x: cvs.width, y: pipeY, w: 45, gap: 110, passed:false}); } }
            for(let i=0; i<pipes.length; i++) {
                let p = pipes[i]; if (estado === 1) p.x -= 5; 
                ctx.fillStyle="#22c55e"; ctx.fillRect(p.x, 0, p.w, p.y - p.gap/2); ctx.fillRect(p.x, p.y + p.gap/2, p.w, cvs.height);
                if(estado === 1 && (50+20 > p.x && 50 < p.x+p.w && (bY-15 < p.y-p.gap/2 || bY+15 > p.y+p.gap/2))) { estado=2; playSonido(150, 'sawtooth', 0.5, 0.2); }
                if(estado === 1 && bY > cvs.height) { estado=2; playSonido(100, 'sawtooth', 0.5, 0.2); }
                if(estado === 1 && p.x < 50 && !p.passed) { 
                    p.passed=true; score++; document.getElementById("arcadeScore").innerText=score; verificarRecord(score);
                    if (score % 10 === 0 && score > 0) window.playSonidoLogro(); else playSonido(800, 'square', 0.1, 0.1); 
                }
            }
            ctx.font = "30px Arial"; ctx.fillText(estado===2 ? "🙀" : "😸", 50, bY+10);
            if (estado === 2) { 
                ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillRect(0,0,cvs.width,cvs.height);
                if(nuevoRecordAlcanzado) { ctx.fillStyle="#00e5ff"; ctx.font="20px monospace"; ctx.fillText("🏆 ¡NUEVO RÉCORD! 🏆", cvs.width/2, 110); }
                ctx.fillStyle="white"; ctx.font="22px monospace"; ctx.fillText("¡GAME OVER!", cvs.width/2, 140); ctx.font="14px monospace"; ctx.fillText("TOCA PARA CONTINUAR", cvs.width/2, 180); 
            }
        }, 1000/35); 
    }
    
    else if (tipo === 'dino') {
        let estado = 0; let dY=250, vY=0, g=2.5, jump=-21, ground=250, cactus=[], frame=0, nextCactusFrame=0;
        window.accionArcadeActual = (e) => {
            if(e && e.type === "keydown" && e.keyCode !== 32 && e.keyCode !== 38) return; 
            if(e) e.preventDefault(); obtenerAudioCtx();
            if (estado === 0) {
                dY=ground; vY=0; cactus=[]; score=0; frame=0; nextCactusFrame=30; estado = 1; document.getElementById("arcadeScore").innerText = score;
                nuevoRecordAlcanzado=false; document.getElementById("arcadeBest").style.color="var(--success)"; document.getElementById("arcadeBest").style.textShadow="none";
            } else if (estado === 1) { if(dY >= ground) { vY = jump; playSonido(300, 'square', 0.1, 0.1); } } else if (estado === 2) { estado = 0; }
        };
        document.addEventListener("keydown", window.accionArcadeActual); cvs.addEventListener("touchstart", window.accionArcadeActual, {passive: false}); cvs.addEventListener("mousedown", window.accionArcadeActual);
        
        window.loopArcade = setInterval(() => {
            ctx.fillStyle="#f8fafc"; ctx.fillRect(0,0,cvs.width,cvs.height); ctx.fillStyle="#94a3b8"; ctx.fillRect(0, ground+20, cvs.width, 50); ctx.textAlign = "center";
            if (estado === 0) { ctx.font = "40px Arial"; ctx.fillText("👷", cvs.width/2, ground+10); ctx.fillStyle="#0f172a"; ctx.font="18px monospace"; ctx.fillText("TOCA PARA EMPEZAR", cvs.width/2, 100); return; }
            if (estado === 1) {
                vY += g; dY += vY; if(dY > ground){ dY = ground; vY=0; } frame++;
                if(frame >= nextCactusFrame) { cactus.push({x: cvs.width, w: 20, h: 22}); nextCactusFrame = frame + Math.floor(Math.random() * 30) + 30; }
                score++; let scoreMostrado = Math.floor(score/10); document.getElementById("arcadeScore").innerText = scoreMostrado;
                verificarRecord(scoreMostrado);
                if (score % 1000 === 0 && score > 0) window.playSonidoLogro(); else if (score % 100 === 0 && score > 0) playSonido(600, 'square', 0.1, 0.1); 
            }
            for(let i=0; i<cactus.length; i++) {
                let c = cactus[i]; if (estado === 1) c.x -= (7 + Math.floor(score/400)); 
                ctx.fillStyle="#64748b"; ctx.fillRect(c.x, ground+20-c.h, c.w, c.h);
                if (estado === 1 && (40+15 > c.x && 40-15 < c.x+c.w && dY+20 > ground+20-c.h)) { estado=2; playSonido(150, 'sawtooth', 0.6, 0.2); }
            }
            ctx.font = "40px Arial"; ctx.fillText(estado===2 ? "💥" : "👷", 40, dY+20);
            if (estado === 2) { 
                ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillRect(0,0,cvs.width,cvs.height);
                if(nuevoRecordAlcanzado) { ctx.fillStyle="#00e5ff"; ctx.font="20px monospace"; ctx.fillText("🏆 ¡NUEVO RÉCORD! 🏆", cvs.width/2, 90); }
                ctx.fillStyle="red"; ctx.font="24px monospace"; ctx.fillText("¡TROPEZÓ!", cvs.width/2, 130); ctx.fillStyle="white"; ctx.font="14px monospace"; ctx.fillText("TOCA PARA REINICIAR", cvs.width/2, 170); 
            }
        }, 1000/40); 
    }
};

let bufferTeclasJuego = ""; document.addEventListener("keydown", (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    bufferTeclasJuego += e.key.toLowerCase(); if (bufferTeclasJuego.length > 5) bufferTeclasJuego = bufferTeclasJuego.substring(bufferTeclasJuego.length - 5);
    if (bufferTeclasJuego === "juego") { bufferTeclasJuego = ""; window.abrirMenuArcade(); }
});
setTimeout(() => {
    let clicsLogo = 0; let timerLogo;
    document.querySelectorAll('.sidebar-logo, .mobile-logo-header img').forEach(logo => {
        logo.addEventListener('click', () => {
            clicsLogo++; clearTimeout(timerLogo); timerLogo = setTimeout(() => clicsLogo = 0, 1000); 
            if (clicsLogo === 5) { clicsLogo = 0; window.abrirMenuArcade(); }
        });
    });
}, 1500);