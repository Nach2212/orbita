// ÓRBITA · conexión con el cerebro + login con Google
(function () {
  const C = window.ORBITA_CONFIG;
  const params = new URLSearchParams(location.search);
  const DEMO = params.has('demo') || C.CEREBRO_URL.startsWith('PEGA_');
  const K_TOKEN = 'orbita.token', K_CACHE = 'orbita.cache.';

  // ---------- almacenamiento seguro (puede fallar en modo incógnito) ----------
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const leer = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const borrar = (k) => { try { localStorage.removeItem(k); } catch (e) {} };

  // ---------- token de Google ----------
  function expDe(jwt) {
    try { return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000; }
    catch (e) { return 0; }
  }
  function tokenVigente() {
    const t = leer(K_TOKEN);
    return t && expDe(t) > Date.now() + 60000 ? t : null;
  }

  let esperandoToken = [];
  function pedirToken() {
    // pide un token nuevo en silencio (auto_select); si no se puede, la app muestra el botón
    return new Promise((resolve) => {
      esperandoToken.push(resolve);
      if (esperandoToken.length > 1) return;
      if (!window.google || !google.accounts) { entregar(null); return; }
      google.accounts.id.prompt((n) => {
        if (n.isNotDisplayed && n.isNotDisplayed() || n.isSkippedMoment && n.isSkippedMoment()) entregar(null);
      });
    });
  }
  function entregar(token) { const e = esperandoToken; esperandoToken = []; e.forEach((r) => r(token)); }

  function iniciarGoogle(alEntrar) {
    google.accounts.id.initialize({
      client_id: C.CLIENT_ID,
      auto_select: true,
      use_fedcm_for_prompt: true,
      cancel_on_tap_outside: false,
      callback: (r) => { guardar(K_TOKEN, r.credential); entregar(r.credential); alEntrar(r.credential); },
    });
  }

  function cargarScriptGoogle() {
    return new Promise((ok, mal) => {
      if (window.google && google.accounts) return ok();
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar el login de Google'));
      document.head.appendChild(s);
    });
  }

  // ---------- llamada al cerebro ----------
  async function llamar(accion, extra) {
    if (DEMO) return window.OrbitaDemo.responder(accion, extra);
    let token = tokenVigente() || await pedirToken();
    if (!token) throw Object.assign(new Error('Necesitas entrar'), { codigo: 'sin_login' });
    // text/plain = pedido "simple": Apps Script lo acepta sin bloqueo CORS
    const r = await fetch(C.CEREBRO_URL, { method: 'POST', body: JSON.stringify({ token, accion, ...extra }), redirect: 'follow' });
    if (!r.ok) throw new Error('El cerebro respondió ' + r.status);
    const j = await r.json();
    if (!j.ok && j.error === 'sin_acceso') {
      borrar(K_TOKEN);
      throw Object.assign(new Error('Esta cuenta no tiene acceso a Órbita'), { codigo: 'sin_acceso' });
    }
    if (!j.ok) throw Object.assign(new Error(j.detalle || j.error), { codigo: j.error });
    return j;
  }

  // ---------- datos con memoria: abre al tiro con lo último guardado ----------
  async function todo(alLlegar) {
    const guardado = leer(K_CACHE + 'todo');
    if (guardado) alLlegar(guardado, { desdeMemoria: true });
    const nuevo = await llamar('todo');
    guardar(K_CACHE + 'todo', nuevo);
    alLlegar(nuevo, { desdeMemoria: false });
    return nuevo;
  }

  window.OrbitaAPI = {
    DEMO,
    tokenVigente,
    iniciarGoogle,
    cargarScriptGoogle,
    llamar,
    todo,
    salir() { borrar(K_TOKEN); Object.keys(localStorage).filter((k) => k.startsWith(K_CACHE)).forEach(borrar); if (window.google) google.accounts.id.disableAutoSelect(); },
    orden: (aparato, orden) => llamar('orden', { aparato, orden }),
  };
})();
