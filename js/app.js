// ÓRBITA · la app: módulos, navegación y pantallas
(function () {
  const C = window.ORBITA_CONFIG, API = window.OrbitaAPI, U = window.OrbitaUI;
  const $ = (s, el = document) => el.querySelector(s);
  const params = new URLSearchParams(location.search);
  const desdeNfc = params.get('nfc');

  // ---------- módulos: para sumar uno nuevo, se agrega aquí y se activa ----------
  const ICONOS = {
    hoy: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    casa: '<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    finanzas: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M7 15h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    deporte: '<svg viewBox="0 0 24 24"><path d="M13 4a2 2 0 1 0 0 .1M9 21l2-6 3 2v4M7 12l3-4 4 1 2 3 3 1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    proyectos: '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const MODULOS = [
    { id: 'hoy', nombre: 'Hoy', activo: true, pintar: pintarHoy },
    { id: 'casa', nombre: 'Casa', activo: true, pintar: pintarCasa },
    { id: 'finanzas', nombre: 'Finanzas', activo: false, etapa: 2 },
    { id: 'deporte', nombre: 'Deporte', activo: false, etapa: 3 },
    { id: 'proyectos', nombre: 'Proyectos', activo: false, etapa: 4 },
  ];
  const activos = () => MODULOS.filter((m) => m.activo);

  let datos = null, ultimaOk = 0, cargando = false, campoGrafico = {}, ultimoError = '';

  // ---------- arranque ----------
  async function iniciar() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    if (API.DEMO) return entrarApp();
    try { await API.cargarScriptGoogle(); } catch (e) { return mostrarLogin('Sin internet: no se pudo cargar el login de Google.'); }
    API.iniciarGoogle(() => entrarApp());
    if (API.tokenVigente()) entrarApp();
    else mostrarLogin();
  }

  function mostrarLogin(error) {
    $('#app').hidden = true; $('#login').hidden = false;
    $('#login-error').textContent = error || '';
    if (window.google && google.accounts) {
      google.accounts.id.renderButton($('#google-btn'), { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', locale: 'es' });
      google.accounts.id.prompt();
    }
  }

  let yaDentro = false;
  function entrarApp() {
    $('#login').hidden = true; $('#app').hidden = false;
    if (yaDentro) { refrescar(); return; }
    yaDentro = true;
    pintarNav();
    window.addEventListener('hashchange', () => { pintarNav(); pintar(); $('#vista').focus({ preventScroll: true }); window.scrollTo(0, 0); });
    $('#refrescar').onclick = () => refrescar(true);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - ultimaOk > 30e3) refrescar(); });
    setInterval(() => { if (!document.hidden) refrescar(); }, C.REFRESCO_SEG * 1000);
    setInterval(pintarSync, 30e3);
    pintar();
    refrescar();
  }

  const moduloActual = () => activos().find((m) => '#' + m.id === location.hash) || activos()[0];

  function pintarNav() {
    const actual = moduloActual();
    $('#nav').innerHTML = activos().map((m) =>
      `<a href="#${m.id}" ${m === actual ? 'aria-current="page"' : ''}>${ICONOS[m.id]}<span>${m.nombre}</span></a>`).join('');
  }

  function pintar() {
    const v = $('#vista');
    if (!datos) { v.innerHTML = '<div class="grid"><div class="esqueleto ancha"></div><div class="esqueleto"></div><div class="esqueleto"></div></div>'; return; }
    moduloActual().pintar(v, datos);
  }

  async function refrescar(manual) {
    if (cargando) return;
    cargando = true; $('#refrescar').classList.add('girando');
    try {
      await API.todo((d) => { datos = d; pintar(); });
      ultimaOk = Date.now(); ultimoError = '';
      if (manual) U.toast('Actualizado');
    } catch (e) {
      if (e.codigo === 'sin_login' || e.codigo === 'sin_acceso') { yaDentro = false; return mostrarLogin(e.codigo === 'sin_acceso' ? e.message : ''); }
      U.toast(!navigator.onLine ? 'Sin internet. Muestro lo último guardado.' : 'Cerebro: ' + (e.message || 'no responde'));
      ultimoError = e.message || String(e);
      console.error(e);
    } finally {
      cargando = false; $('#refrescar').classList.remove('girando'); pintarSync();
    }
  }

  function pintarSync() {
    const el = $('#sync');
    if (API.DEMO) { el.innerHTML = '<span class="demo-tag">DEMO</span>'; return; }
    const viejo = !ultimaOk || Date.now() - ultimaOk > 3 * 60e3;
    el.classList.toggle('offline', viejo);
    el.textContent = !ultimaOk ? (datos || ultimoError ? 'sin conexión' : '') : viejo ? 'sin conexión · ' + U.hace(ultimaOk) : '';
    el.title = ultimoError; el.onclick = ultimoError ? () => U.toast('Cerebro: ' + ultimoError) : null;
  }

  // ---------- piezas comunes ----------
  function estadoAparato(a) {
    const u = a.ultimo;
    const off = !u || Date.now() - u.t > U.DESCONECTADO_MS;
    const nivel = off ? U.nivelDe(null) : U.nivelDe(u.co2);
    return { u, off, nivel };
  }

  function tarjetaAire(a, grande) {
    const { u, off, nivel } = estadoAparato(a);
    const cifra = u && u.co2 != null ? Math.round(u.co2) : '—';
    return `<article class="card ${grande ? 'ancha' : 'tocable ancha'}" ${grande ? '' : 'data-ir="casa"'} aria-label="Aire en ${U.esc(a.lugar || a.nombre)}">
      <div class="card-cab"><h2 class="card-titulo">${U.esc(a.lugar || a.nombre)} · ${U.esc(a.nombre)}</h2>
        <span class="card-meta">${u ? (off ? 'desconectado · ' : '') + U.hace(u.t) : 'esperando datos'}</span></div>
      <div class="aire">
        ${U.kpler(nivel.id)}
        <div>
          <div class="cifra">${cifra}<small>ppm CO₂</small></div>
          <div class="estado lv-${nivel.id}">${off && u ? 'Último dato: ' + U.nivelDe(u.co2).nombre.toLowerCase() : nivel.nombre}</div>
        </div>
      </div>
      ${u ? `<div class="mini"><span><b>${u.temp != null ? u.temp.toFixed(1) : '—'}°</b> temp</span><span><b>${u.hum != null ? Math.round(u.hum) : '—'}%</b> humedad</span></div>` : ''}
      ${off ? `<p class="consejo">${u ? 'K-PLER no manda datos hace rato. ¿Está enchufado y con WiFi?' : 'Cuando K-PLER mande su primer dato, aparece aquí.'}</p>`
            : `<p class="consejo">${U.esc(nivel.consejo)}</p>`}
    </article>`;
  }

  function avisoCalibrar(a) {
    return a.calibrar ? `<article class="card aviso ancha"><h3>Ventila fuerte una vez esta semana</h3>
      <p>En 7 días el aire de ${U.esc((a.lugar || 'la pieza').toLowerCase())} nunca bajó de 550 ppm. El sensor se autocalibra con aire fresco; sin eso, con las semanas empieza a medir mal. Abre la ventana 10 minutos, o usa "Calibrar CO2" en Casa.</p></article>` : '';
  }

  // ---------- HOY ----------
  function pintarHoy(v, d) {
    const conSensor = d.aparatos.filter((a) => a.mide && a.mide.length);
    const evs = (d.eventos || []).filter((e) => e.fin > Date.now());
    const prox = evs.find((e) => !e.todoElDia) || evs[0];
    const hora = new Date().getHours();
    const saludo = hora < 12 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';
    v.innerHTML = `
      ${desdeNfc === 'buenosdias' && !sessionStorage.getItem('nfcVisto') ? `<div class="banner">☀️ ¡Buenos días, ${U.esc(C.NOMBRE)}! Aquí va tu día.</div>` : ''}
      <div class="saludo"><h1>${saludo}, ${U.esc(C.NOMBRE)}</h1><p>${U.fechaLarga()}</p></div>
      <div class="grid">
        ${conSensor.map((a) => tarjetaAire(a, false)).join('')}
        ${conSensor.map(avisoCalibrar).join('')}
        ${tarjetaClima(d.clima)}
        ${tarjetaEvento(prox, evs)}
        ${MODULOS.filter((m) => !m.activo && m.id !== 'deporte').map((m) => `<article class="card pronto"><div class="card-cab"><h2 class="card-titulo">${m.id === 'finanzas' ? 'Plata del mes' : 'Pendientes'}</h2></div><p>Llega en la etapa ${m.etapa}.</p></article>`).join('')}
      </div>`;
    try { if (desdeNfc) sessionStorage.setItem('nfcVisto', '1'); } catch (e) {}
    v.querySelectorAll('[data-ir]').forEach((el) => el.onclick = () => { location.hash = el.dataset.ir; });
  }

  function tarjetaClima(cl) {
    if (!cl) return '<article class="card"><h2 class="card-titulo">Clima</h2><p class="vacio">No pude traer el clima.</p></article>';
    return `<article class="card"><div class="card-cab"><h2 class="card-titulo">Concepción</h2><span class="card-meta">${U.textoClima(cl.codigo)}</span></div>
      <div class="clima">${U.iconoClima(cl.codigo)}<div><div class="cifra">${Math.round(cl.temp)}°</div>
      <p>Mín ${Math.round(cl.min)}° · máx ${Math.round(cl.max)}° · lluvia ${cl.lluvia}%</p></div></div>
      <p class="consejo">${U.esc(U.consejoRopa(cl))}${cl.viento >= 30 ? ' · viento fuerte' : ''}</p></article>`;
  }

  function tarjetaEvento(prox, evs) {
    if (!prox) return '<article class="card"><h2 class="card-titulo">Agenda</h2><p class="vacio">Nada en las próximas 48 horas.</p></article>';
    const minutos = (prox.inicio - Date.now()) / 60000;
    const cuando = prox.todoElDia ? 'Todo el día' : prox.inicio <= Date.now() ? 'Ahora · hasta las ' + U.hora(prox.fin) : U.dentroDe(prox.inicio) + (U.mismoDia(prox.inicio, Date.now()) ? ' · ' + U.hora(prox.inicio) : '');
    const resto = evs.filter((e) => e !== prox).slice(0, 3);
    return `<article class="card evento-prox"><div class="card-cab"><h2 class="card-titulo">Próximo</h2><span class="card-meta">${U.esc(prox.calendario || '')}</span></div>
      <h3>${U.esc(prox.titulo)}</h3><div class="cuando ${minutos > 0 && minutos <= 30 ? 'pronto-ya' : ''}">${cuando}</div>
      ${resto.length ? `<ul class="lista">${resto.map((e) => `<li><span class="hora">${e.todoElDia ? 'día' : U.mismoDia(e.inicio, Date.now()) ? U.hora(e.inicio) : 'mañ ' + U.hora(e.inicio)}</span><span>${U.esc(e.titulo)}</span></li>`).join('')}</ul>` : ''}
    </article>`;
  }

  // ---------- CASA ----------
  function pintarCasa(v, d) {
    v.innerHTML = `<div class="saludo"><h1>Casa</h1><p>${d.aparatos.length} ${d.aparatos.length === 1 ? 'aparato' : 'aparatos'}</p></div>` +
      d.aparatos.map((a) => `<section class="grid" style="margin-bottom:24px" data-aparato="${U.esc(a.id)}">
        ${a.mide && a.mide.length ? tarjetaAire(a, true) : `<article class="card ancha"><h2 class="card-titulo">${U.esc(a.nombre)}</h2></article>`}
        ${avisoCalibrar(a)}
        ${a.mide && a.mide.length ? `<article class="card ancha"><div class="card-cab"><h2 class="card-titulo">Últimas 24 h</h2>
          <div class="segmentado" role="group" aria-label="Qué mostrar">
            <button data-campo="co2">CO₂</button><button data-campo="temp">Temp</button><button data-campo="hum">Humedad</button></div></div>
          <div class="g"></div><div class="grafico-info"></div></article>` : ''}
        ${a.noche ? tarjetaNoche(a.noche) : ''}
        ${a.acciones && a.acciones.length ? `<article class="card ${a.noche ? '' : 'ancha'}"><div class="card-cab"><h2 class="card-titulo">Controlar ${U.esc(a.nombre)}</h2></div>
          <div class="acciones">${a.acciones.map((x) => `<button class="btn" data-orden="${U.esc(x.id)}">${U.esc(x.nombre)}</button>`).join('')}</div>
          <p class="consejo">Funciona desde cualquier lugar. ${U.esc(a.nombre)} lo hace en unos 20 segundos.</p></article>` : ''}
      </section>`).join('');

    v.querySelectorAll('[data-aparato]').forEach((sec) => {
      const a = d.aparatos.find((x) => x.id === sec.dataset.aparato);
      const g = sec.querySelector('.g');
      if (g) {
        const elegir = (campo) => {
          campoGrafico[a.id] = campo;
          sec.querySelectorAll('[data-campo]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.campo === campo));
          U.grafico(g, sec.querySelector('.grafico-info'), a.serie, campo);
        };
        sec.querySelectorAll('[data-campo]').forEach((b) => b.onclick = () => elegir(b.dataset.campo));
        elegir(campoGrafico[a.id] || 'co2');
      }
      sec.querySelectorAll('[data-orden]').forEach((b) => b.onclick = () => mandarOrden(a, b));
    });
  }

  function tarjetaNoche(n) {
    const color = n.nota >= 6 ? 'lv-ok' : n.nota >= 4 ? 'lv-warn' : n.nota >= 3 ? 'lv-bad' : 'lv-crit';
    const frase = n.nota >= 6 ? 'Dormiste con buen aire.' : n.nota >= 4 ? 'Aire cargado en la noche: deja la puerta o la ventana un poco abierta.' : 'Dormiste con aire pesado: eso afecta cómo descansas. Ventila antes de dormir.';
    const h = Math.floor(n.minutosSobre1000 / 60), m = n.minutosSobre1000 % 60;
    return `<article class="card"><div class="card-cab"><h2 class="card-titulo">Tu noche</h2><span class="card-meta">${n.enCurso ? 'en curso' : '0 a 8 h'}</span></div>
      <div class="noche"><div class="nota ${color}" aria-label="Nota ${n.nota} de 7">${n.nota}</div>
      <dl><dt>Promedio</dt><dd>${n.prom} ppm</dd><dt>Peak</dt><dd>${Math.round(n.max)} ppm</dd><dt>Sobre 1000</dt><dd>${h ? h + ' h ' : ''}${m} min</dd></dl></div>
      <p class="consejo">${frase}</p></article>`;
  }

  async function mandarOrden(a, boton) {
    const orden = boton.dataset.orden;
    if (orden === 'calibrar_co2') {
      const ok = await U.confirmar('Calibrar el CO₂', `<p>Esto le dice al sensor que el aire actual es aire de afuera (~420 ppm). Hazlo solo así:</p>
        <ol><li>Pon a ${U.esc(a.nombre)} en la ventana abierta, o afuera.</li><li>Espera 3 minutos sin respirarle encima.</li><li>Recién ahí aprieta Calibrar.</li></ol>`, 'Calibrar', 'Todavía no');
      if (!ok) return;
    }
    boton.disabled = true; boton.classList.add('enviando');
    const texto = boton.textContent; boton.textContent = 'Enviando…';
    try {
      await API.orden(a.id, orden);
      U.toast(`Listo. ${a.nombre} lo hace en unos 20 s.`);
    } catch (e) {
      U.toast(e.codigo === 'aparato_sin_cola' ? `${a.nombre} todavía no tiene cola de órdenes configurada.` : 'No se pudo enviar. Revisa tu internet.');
    } finally {
      boton.disabled = false; boton.classList.remove('enviando'); boton.textContent = texto;
    }
  }

  iniciar();
})();
