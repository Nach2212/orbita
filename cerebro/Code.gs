/**
 * ÓRBITA · Cerebro (Google Apps Script)
 * ------------------------------------------------------------
 * Puente entre la app, tus aparatos (vía ThingSpeak) y tu Google.
 * - Verifica en CADA pedido que el login sea tuyo.
 * - Junta datos: aire en vivo, 24 h, reporte de la noche, clima, agenda.
 * - Pasa órdenes a los aparatos (con vencimiento de 2 min).
 * - Cada 10 min: guarda historial, manda la agenda a K-PLER y revisa alertas.
 *
 * Las claves NO van aquí: van en Config.gs (que no se sube a GitHub).
 */

const TZ = 'America/Santiago';
const TS = 'https://api.thingspeak.com';
const NIVEL = { warn: 800, bad: 1200, crit: 2000 };

// ============================================================
// Entrada
// ============================================================
function doGet() {
  return json_({ ok: true, app: 'Órbita cerebro', version: 1 });
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents || '{}');
    const yo = verificar_(req.token);
    if (!yo) return json_({ ok: false, error: 'sin_acceso' });

    switch (req.accion) {
      case 'yo':    return json_({ ok: true, email: yo });
      case 'todo':  return json_({ ok: true, ahora: Date.now(), ...todo_() });
      case 'orden': return json_(orden_(req.aparato, req.orden));
      default:      return json_({ ok: false, error: 'accion_desconocida' });
    }
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'error_interno', detalle: String(err && err.message || err) });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// Seguridad: solo tu cuenta de Google pasa
// ============================================================
function verificar_(token) {
  if (!token || typeof token !== 'string' || token.length > 4096) return null;
  const cache = CacheService.getScriptCache();
  const llave = 'tok_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).slice(0, 40);
  const guardado = cache.get(llave);
  if (guardado) return guardado;

  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token),
                              { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return null;
  const t = JSON.parse(r.getContentText());
  const ok = t.aud === CONFIG.CLIENT_ID &&
             String(t.email_verified) === 'true' &&
             String(t.email).toLowerCase() === CONFIG.DUENO.toLowerCase() &&
             Number(t.exp) * 1000 > Date.now();
  if (!ok) return null;
  const seg = Math.min(21600, Math.max(60, Number(t.exp) - Math.floor(Date.now() / 1000) - 30));
  cache.put(llave, t.email, seg);
  return t.email;
}

// ============================================================
// Todo lo que la app necesita, en un solo viaje
// ============================================================
function todo_() {
  const aparatos = aparatos_();
  const casa = aparatos.filter(a => a.mide.length).map(a => {
    const feed = feed24h_(a);
    return {
      id: a.id, nombre: a.nombre, lugar: a.lugar, mide: a.mide,
      acciones: a.acciones,
      ultimo: feed.ultimo,
      serie: feed.serie,
      noche: a.mide.indexOf('co2') >= 0 ? noche_(feed.crudo) : null,
      calibrar: a.mide.indexOf('co2') >= 0 ? necesitaCalibrar_(a) : false,
    };
  });
  const soloAcciones = aparatos.filter(a => !a.mide.length).map(a => ({
    id: a.id, nombre: a.nombre, lugar: a.lugar, mide: [], acciones: a.acciones, ultimo: null, serie: [], noche: null,
  }));
  return { aparatos: casa.concat(soloAcciones), clima: clima_(), eventos: eventos_() };
}

// ---------- registro de aparatos (hoja "Aparatos") ----------
// Columnas: id | nombre | lugar | mide | acciones | canal | clave_lectura | talkback | clave_talkback
function aparatos_() {
  const t = leerTabla_(planilla_(), 'Aparatos', ['id', 'nombre', 'acciones']);
  if (!t.ok) throw new Error('Hoja Aparatos: falta ' + t.faltan.join(', '));
  return t.filas.filter(f => f.id).map(f => ({
    id: String(f.id).trim(),
    nombre: String(f.nombre || f.id),
    lugar: String(f.lugar || ''),
    mide: String(f.mide || '').split(',').map(s => s.trim()).filter(String),
    // "fiesta:Fiesta, parar:Parar" -> [{id:'fiesta', nombre:'Fiesta'}]
    acciones: String(f.acciones || '').split(',').map(s => s.trim()).filter(String).map(s => {
      const [id, nombre] = s.split(':');
      return { id: id.trim(), nombre: (nombre || id).trim() };
    }),
    canal: String(f.canal || ''), lectura: String(f.clave_lectura || ''),
    talkback: String(f.talkback || ''), claveTalkback: String(f.clave_talkback || ''),
  }));
}

// ---------- ThingSpeak: últimas 24 h ----------
// Campos del canal: 1 co2 · 2 temp · 3 hum · 4 nivel
function feed24h_(a) {
  if (!a.canal) return { ultimo: null, serie: [], crudo: [] };
  const url = `${TS}/channels/${a.canal}/feeds.json?api_key=${a.lectura}&minutes=1440&results=8000`;
  const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return { ultimo: null, serie: [], crudo: [] };
  const crudo = (JSON.parse(r.getContentText()).feeds || []).map(f => ({
    t: Date.parse(f.created_at),            // ThingSpeak guarda en UTC; la app muestra en hora de Chile
    co2: num_(f.field1), temp: num_(f.field2), hum: num_(f.field3), nivel: num_(f.field4),
  })).filter(p => !isNaN(p.t));

  // promedios cada 5 min (máx 288 puntos); un tramo sin datos = hueco en el gráfico
  const cubetas = {};
  crudo.forEach(p => {
    const k = Math.floor(p.t / 300000);
    (cubetas[k] = cubetas[k] || []).push(p);
  });
  const serie = Object.keys(cubetas).sort().map(k => {
    const ps = cubetas[k];
    return { t: Number(k) * 300000, co2: prom_(ps, 'co2'), temp: prom_(ps, 'temp'), hum: prom_(ps, 'hum') };
  });
  return { ultimo: crudo.length ? crudo[crudo.length - 1] : null, serie, crudo };
}

function num_(v) { const n = parseFloat(v); return isNaN(n) ? null : n; }
function prom_(ps, k) {
  const v = ps.map(p => p[k]).filter(x => x !== null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null;
}
function horaLocal_(ms) { return Number(Utilities.formatDate(new Date(ms), TZ, 'H')); }
function diaLocal_(ms) { return Utilities.formatDate(new Date(ms), TZ, 'yyyy-MM-dd'); }

// ---------- Reporte de la noche (00:00 a 08:00 de hoy) ----------
function noche_(crudo) {
  const hoy = diaLocal_(Date.now());
  const ps = crudo.filter(p => p.co2 !== null && diaLocal_(p.t) === hoy && horaLocal_(p.t) < 8);
  if (ps.length < 10) return null;
  const co2 = ps.map(p => p.co2);
  const prom = Math.round(co2.reduce((a, b) => a + b, 0) / co2.length);
  const max = Math.max.apply(null, co2);
  const minutosSobre1000 = Math.round(ps.filter(p => p.co2 > 1000).length * minutosPorMuestra_(ps));
  const nota = prom < 800 ? 7 : prom < 900 ? 6 : prom < 1000 ? 5 : prom < 1200 ? 4 : prom < 1500 ? 3 : prom < 2000 ? 2 : 1;
  const enCurso = horaLocal_(Date.now()) < 8;
  return { prom, max, minutosSobre1000, nota, enCurso };
}
function minutosPorMuestra_(ps) {
  if (ps.length < 2) return 1;
  return (ps[ps.length - 1].t - ps[0].t) / 60000 / (ps.length - 1);
}

// ---------- ¿Hay que calibrar el CO2? ----------
// El SCD41 se autocalibra suponiendo aire fresco (~400 ppm) al menos una vez por semana.
// Si en 7 días nunca bajó de 550 ppm (promedio por hora), conviene ventilar fuerte o calibrar.
function necesitaCalibrar_(a) {
  const cache = CacheService.getScriptCache();
  const k = 'calib_' + a.id;
  const c = cache.get(k);
  if (c !== null) return c === '1';
  const url = `${TS}/channels/${a.canal}/fields/1.json?api_key=${a.lectura}&days=7&average=60`;
  const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  let necesita = false;
  if (r.getResponseCode() === 200) {
    const v = (JSON.parse(r.getContentText()).feeds || []).map(f => num_(f.field1)).filter(x => x !== null);
    necesita = v.length >= 48 && Math.min.apply(null, v) > 550;   // al menos 2 días de datos
  }
  cache.put(k, necesita ? '1' : '0', 3600);
  return necesita;
}

// ---------- Clima (Open-Meteo, gratis) ----------
function clima_() {
  const cache = CacheService.getScriptCache();
  const c = cache.get('clima');
  if (c) return JSON.parse(c);
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + CONFIG.LAT + '&longitude=' + CONFIG.LON +
    '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    '&timezone=America%2FSantiago&forecast_days=1';
  const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return null;
  const j = JSON.parse(r.getContentText());
  const out = {
    temp: j.current.temperature_2m, sensacion: j.current.apparent_temperature,
    codigo: j.current.weather_code, viento: j.current.wind_speed_10m,
    max: j.daily.temperature_2m_max[0], min: j.daily.temperature_2m_min[0],
    lluvia: j.daily.precipitation_probability_max[0], t: Date.now(),
  };
  cache.put('clima', JSON.stringify(out), 1200);
  return out;
}

// ---------- Agenda: próximos eventos (48 h) de tus calendarios visibles ----------
function eventos_() {
  const ahora = new Date(), hasta = new Date(Date.now() + 48 * 3600 * 1000);
  let evs = [];
  CalendarApp.getAllCalendars().filter(c => c.isSelected() && !c.isHidden()).forEach(c => {
    c.getEvents(ahora, hasta).forEach(e => evs.push({
      titulo: e.getTitle() || '(sin título)',
      inicio: e.getStartTime().getTime(), fin: e.getEndTime().getTime(),
      todoElDia: e.isAllDayEvent(), calendario: c.getName(),
    }));
  });
  evs.sort((a, b) => a.inicio - b.inicio);
  return evs.slice(0, 8);
}

// ============================================================
// Órdenes a los aparatos (cola TalkBack, vencen a los 2 min)
// ============================================================
function orden_(idAparato, idOrden) {
  const a = aparatos_().find(x => x.id === idAparato);
  if (!a) return { ok: false, error: 'aparato_desconocido' };
  if (!a.acciones.some(x => x.id === idOrden)) return { ok: false, error: 'orden_no_permitida' };
  if (!a.talkback) return { ok: false, error: 'aparato_sin_cola' };
  const cmd = idOrden + '|' + Math.floor(Date.now() / 1000);   // el aparato ignora órdenes de más de 120 s
  const r = UrlFetchApp.fetch(`${TS}/talkbacks/${a.talkback}/commands.json`, {
    method: 'post', muteHttpExceptions: true,
    payload: { api_key: a.claveTalkback, command_string: cmd },
  });
  const ok = r.getResponseCode() === 200;
  return ok ? { ok: true, enviada: Date.now() } : { ok: false, error: 'thingspeak_' + r.getResponseCode() };
}

// ============================================================
// Cada 10 minutos (activador): historial + agenda para K-PLER + alertas
// ============================================================
function cadaDiezMinutos() {
  const aparatos = aparatos_();
  aparatos.filter(a => a.canal && a.mide.length).forEach(a => {
    try { archivar_(a); } catch (e) { console.error('archivar', a.id, e); }
    if (a.mide.indexOf('co2') >= 0) {
      try { alertaAire_(a); } catch (e) { console.error('alerta', a.id, e); }
    }
  });
  try { agendaAKpler_(); } catch (e) { console.error('agenda', e); }
}

// ---------- historial: detalle 7 días en "Historial", promedio por hora para siempre en "Horas" ----------
function archivar_(a) {
  const props = PropertiesService.getScriptProperties();
  const k = 'ultimo_' + a.id;
  const desde = Number(props.getProperty(k) || 0);
  const crudo = feed24h_(a).crudo.filter(p => p.t > desde);
  if (!crudo.length) return;
  const hoja = planilla_().getSheetByName('Historial');
  const filas = crudo.map(p => [new Date(p.t), a.id, p.co2, p.temp, p.hum]);
  hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, 5).setValues(filas);
  props.setProperty(k, String(crudo[crudo.length - 1].t));
}

// Se llama una vez al día (3 AM): pasa lo de más de 7 días a promedios por hora y lo borra del detalle
function resumirDiario() {
  const ss = planilla_();
  const hist = ss.getSheetByName('Historial'), horas = ss.getSheetByName('Horas');
  const n = hist.getLastRow() - 1;
  if (n < 1) return;
  const datos = hist.getRange(2, 1, n, 5).getValues();
  const corte = Date.now() - 7 * 86400000;
  const viejos = datos.filter(f => f[0] instanceof Date && f[0].getTime() < corte);
  if (!viejos.length) return;
  const grupos = {};
  viejos.forEach(f => {
    const h = Utilities.formatDate(f[0], TZ, 'yyyy-MM-dd HH:00');
    const k = h + '|' + f[1];
    (grupos[k] = grupos[k] || []).push(f);
  });
  const filas = Object.keys(grupos).sort().map(k => {
    const [h, id] = k.split('|'), g = grupos[k];
    const p = i => { const v = g.map(f => f[i]).filter(x => x !== '' && x !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : ''; };
    return [h, id, p(2), p(3), p(4), g.length];
  });
  horas.getRange(horas.getLastRow() + 1, 1, filas.length, 6).setValues(filas);
  hist.deleteRows(2, viejos.length);   // el detalle está en orden, los viejos van primero
}

// ---------- alertas de aire, sin spam ----------
// Estados: ok -> malo (15 min seguidos > 1200) -> critico (> 2000). Aviso solo al cambiar.
// Entre 0 y 8 h no se manda nada: eso va al reporte de la noche.
function alertaAire_(a) {
  const props = PropertiesService.getScriptProperties();
  const k = 'aire_' + a.id, kAvisado = 'avisado_' + a.id;
  const antes = props.getProperty(k) || 'ok';
  const ps = feed24h_(a).crudo.filter(p => p.co2 !== null && p.t > Date.now() - 15 * 60000);
  if (ps.length < 5) return;                              // sin datos suficientes: no adivina
  const co2 = ps.map(p => p.co2), ultimo = co2[co2.length - 1];
  let ahora = antes;
  if (co2.slice(-5).every(v => v > NIVEL.crit)) ahora = 'critico';
  else if (co2.every(v => v > NIVEL.bad)) ahora = (antes === 'critico' && ultimo > NIVEL.bad) ? 'critico' : 'malo';
  else if (co2.every(v => v < 1000)) ahora = 'ok';
  if (ahora === antes) return;
  props.setProperty(k, ahora);

  const noche = horaLocal_(Date.now()) < 8;
  const avisado = props.getProperty(kAvisado) === '1';
  if (ahora === 'malo' && !noche) {
    avisar_('Aire pesado en ' + (a.lugar || a.nombre).toLowerCase(), ultimo + ' ppm hace 15 min. Abre la ventana un rato.', 'warning');
    props.setProperty(kAvisado, '1');
  } else if (ahora === 'critico' && !noche) {
    avisar_('Aire muy malo en ' + (a.lugar || a.nombre).toLowerCase(), ultimo + ' ppm. Ventila ahora.', 'rotating_light');
    props.setProperty(kAvisado, '1');
  } else if (ahora === 'ok' && avisado) {
    if (!noche) avisar_('Aire bien de nuevo', ultimo + ' ppm. Buena ventilada.', 'white_check_mark');
    props.setProperty(kAvisado, '0');
  }
}

function avisar_(titulo, mensaje, tag) {
  if (!CONFIG.NTFY_TEMA) return;
  UrlFetchApp.fetch('https://ntfy.sh/', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ topic: CONFIG.NTFY_TEMA, title: titulo, message: mensaje, tags: [tag], click: CONFIG.APP_URL }),
  });
}

// ---------- agenda para K-PLER (por un canal de ThingSpeak, HTTP simple) ----------
// Formato (máx 255 letras): "2026-10-27~9:00|Certamen~-|Cumple~#En 3 dias: Entrega"
function agendaAKpler_() {
  if (!CONFIG.TS_AGENDA_CANAL || !CONFIG.TS_AGENDA_CLAVE_ESCRITURA) return;
  const hoy = diaLocal_(Date.now());
  const evs = eventos_().filter(e => diaLocal_(e.inicio) === hoy || e.todoElDia && e.inicio <= Date.now());
  let txt = hoy;
  evs.forEach(e => {
    const h = e.todoElDia ? '-' : Utilities.formatDate(new Date(e.inicio), TZ, 'H:mm');
    const pieza = '~' + h + '|' + limpiar_(e.titulo).slice(0, 28);
    if ((txt + pieza).length <= 250) txt += pieza;
  });
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('agenda_kpler') === txt) return;   // no gastar mensajes si no cambió
  const r = UrlFetchApp.fetch(TS + '/update', {
    method: 'post', muteHttpExceptions: true,
    payload: { api_key: CONFIG.TS_AGENDA_CLAVE_ESCRITURA, field1: txt },
  });
  if (r.getResponseCode() === 200 && r.getContentText() !== '0') props.setProperty('agenda_kpler', txt);
}
function limpiar_(s) { return String(s).replace(/[~|\n\r]/g, ' ').trim(); }

// ============================================================
// Contrato de planillas: pestañas y columnas por NOMBRE, nunca por posición
// ============================================================
// Devuelve {ok, filas:[{columna: valor}], faltan:[...]}. Si falta algo, la app lo muestra en vez de caerse.
function leerTabla_(ss, nombrePestana, requeridas) {
  const hoja = ss.getSheetByName(nombrePestana);
  if (!hoja) return { ok: false, filas: [], faltan: ['pestaña "' + nombrePestana + '"'] };
  const v = hoja.getDataRange().getValues();
  const cab = (v[0] || []).map(c => normalizar_(c));
  const faltan = (requeridas || []).filter(r => cab.indexOf(normalizar_(r)) < 0);
  const filas = v.slice(1).map(f => { const o = {}; cab.forEach((c, i) => { if (c) o[c] = f[i]; }); return o; });
  return { ok: faltan.length === 0, filas, faltan };
}
function normalizar_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, '_');
}
// Para Finanzas (Etapa 2): encuentra la pestaña del mes, ej. "Octubre 2026"
function pestanaDelMes_(ss, fecha) {
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const d = fecha || new Date();
  const buscado = meses[Number(Utilities.formatDate(d, TZ, 'M')) - 1] + ' ' + Utilities.formatDate(d, TZ, 'yyyy');
  return ss.getSheets().find(h => normalizar_(h.getName()).replace(/_/g, ' ') === buscado) || null;
}

// ============================================================
// Instalación (correr UNA vez desde el editor: función "instalar")
// ============================================================
function planilla_() {
  const id = PropertiesService.getScriptProperties().getProperty('PLANILLA_ID');
  if (!id) throw new Error('Corre "instalar" primero');
  return SpreadsheetApp.openById(id);
}

function instalar() {
  const props = PropertiesService.getScriptProperties();
  let ss;
  if (props.getProperty('PLANILLA_ID')) ss = SpreadsheetApp.openById(props.getProperty('PLANILLA_ID'));
  else {
    ss = SpreadsheetApp.create('Órbita · datos');
    ss.setSpreadsheetTimeZone(TZ);
    props.setProperty('PLANILLA_ID', ss.getId());
  }
  const hoja = (nombre, cab) => {
    let h = ss.getSheetByName(nombre);
    if (!h) h = ss.insertSheet(nombre);
    if (h.getLastRow() === 0) { h.appendRow(cab); h.setFrozenRows(1); h.getRange(1, 1, 1, cab.length).setFontWeight('bold'); }
    return h;
  };
  const ap = hoja('Aparatos', ['id', 'nombre', 'lugar', 'mide', 'acciones', 'canal', 'clave_lectura', 'talkback', 'clave_talkback']);
  hoja('Historial', ['fecha', 'aparato', 'co2', 'temp', 'hum']);
  hoja('Horas', ['hora', 'aparato', 'co2', 'temp', 'hum', 'muestras']);
  const sobra = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (sobra && ss.getSheets().length > 1) ss.deleteSheet(sobra);

  if (ap.getLastRow() < 2) {
    ap.appendRow(['kpler', 'K-PLER', 'Pieza', 'co2, temp, hum',
      'fiesta:Fiesta, parar:Parar, clima:Mostrar clima, calibrar_co2:Calibrar CO2',
      CONFIG.TS_KPLER_CANAL, CONFIG.TS_KPLER_CLAVE_LECTURA, CONFIG.TS_KPLER_TALKBACK, CONFIG.TS_KPLER_CLAVE_TALKBACK]);
  }

  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('cadaDiezMinutos').timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger('resumirDiario').timeBased().atHour(3).everyDays(1).inTimezone(TZ).create();

  console.log('Listo. Planilla: ' + ss.getUrl());
  return ss.getUrl();
}

// Para probar sin la app: corre esto y mira el registro
function probar() {
  console.log(JSON.stringify(todo_(), null, 1).slice(0, 3000));
  agendaAKpler_();
}

// Manda una notificación de prueba al celular
function probarAlerta() { avisar_('Órbita conectada', 'Si ves esto, las alertas funcionan.', 'rocket'); }
