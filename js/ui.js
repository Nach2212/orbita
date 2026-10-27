// ÓRBITA · piezas de interfaz: formatos, K-PLER, íconos, gráfico, avisos
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  // ---------- formatos (siempre en hora de Chile, la del celular) ----------
  const hora = (ms) => { const d = new Date(ms); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const fechaLarga = (d = new Date()) => DIAS[d.getDay()][0].toUpperCase() + DIAS[d.getDay()].slice(1) + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()];
  function hace(ms) {
    const s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 90) return 'recién';
    if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'hace ' + Math.round(s / 3600) + ' h';
    return 'hace ' + Math.round(s / 86400) + ' d';
  }
  function dentroDe(ms) {
    const m = Math.round((ms - Date.now()) / 60000);
    if (m <= 0) return 'ahora';
    if (m < 60) return 'en ' + m + ' min';
    const h = Math.floor(m / 60), r = m % 60;
    if (h < 24) return 'en ' + h + ' h' + (r ? ' ' + r + ' min' : '');
    return mismoDia(ms, Date.now() + 864e5) ? 'mañana a las ' + hora(ms) : DIAS[new Date(ms).getDay()] + ' ' + hora(ms);
  }
  const mismoDia = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

  // ---------- niveles de aire (mismos umbrales que K-PLER) ----------
  const NIVELES = [
    { id: 'ok', hasta: 800, nombre: 'Aire bueno', consejo: 'Todo bien. Sigue así.' },
    { id: 'warn', hasta: 1200, nombre: 'Aceptable', consejo: 'Normal en una pieza cerrada. Abre un rato cuando puedas.' },
    { id: 'bad', hasta: 2000, nombre: 'Pesado', consejo: 'Abre la ventana unos minutos: el aire se renueva rápido.' },
    { id: 'crit', hasta: Infinity, nombre: 'Muy malo', consejo: 'Ventila ya. Sobre 2000 ppm cuesta concentrarse.' },
  ];
  const nivelDe = (co2) => co2 == null ? { id: 'off', nombre: 'Sin datos', consejo: '' } : NIVELES.find((n) => co2 < n.hasta);
  const DESCONECTADO_MS = 5 * 60e3;

  // ---------- K-PLER: el mismo robot de la pantalla del ESP32 (render.cpp), pasado a SVG ----------
  // Coordenadas idénticas a drawKpler() del firmware (lienzo de 240 px). La cara cambia con el aire.
  function kpler(nivel) {
    const OUT = '#1E3A8A', WHITE = '#EEF4FF', SHADE = '#DBE8FF', EYE = '#67F0FF', BLUE = '#3B82F6', NAVY = '#0B1E5B', VB = '#1D4ED8';
    const CORE = { ok: '#00E5FF', warn: '#FACC15', bad: '#FB923C', crit: '#F43F5E', off: '#475569' }[nivel];
    const mixHex = (a, b, t) => '#' + [0, 2, 4].map((i) => Math.round(parseInt(a.substr(1 + i, 2), 16) * (1 - t) + parseInt(b.substr(1 + i, 2), 16) * t).toString(16).padStart(2, '0')).join('');
    const E = [[107, 92], [133, 92]], rx = 6, ry = 8.5;
    const bob = { ok: 2.6, warn: 2.2, bad: 1.6, crit: 1.2, off: 3.6 }[nivel];
    const pulso = { ok: 1.7, warn: 1, bad: 0.6, crit: 0.3, off: 3 }[nivel];

    // brazo: hombro (x0,y0), dirección, ángulo
    const brazo = (x0, y0, dir, an) => {
      const dx = dir * Math.sin(an), dy = Math.cos(an), ex = x0 + dx * 18, ey = y0 + dy * 18;
      return `<line x1="${x0}" y1="${y0}" x2="${ex}" y2="${ey}" stroke="${OUT}" stroke-width="13" stroke-linecap="round"/>
        <line x1="${x0}" y1="${y0}" x2="${ex}" y2="${ey}" stroke="${WHITE}" stroke-width="7.5" stroke-linecap="round"/>
        <circle cx="${ex + dx * 3}" cy="${ey + dy * 3}" r="6.8" fill="${WHITE}" stroke="${OUT}" stroke-width="2.8"/>
        <line x1="${ex + dx * 3}" y1="${ey + dy * 3}" x2="${ex + dx * 8.5}" y2="${ey + dy * 8.5}" stroke="${OUT}" stroke-width="2" stroke-linecap="round"/>`;
    };
    const estrella = (x, y, r) => {
      let d = ''; for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; d += (i ? 'L' : 'M') + (x + Math.cos(a) * rr).toFixed(1) + ' ' + (y + Math.sin(a) * rr).toFixed(1); }
      return `<path d="${d}Z" fill="#FACC15"/>`;
    };
    const espiral = ([cx, cy], sentido) => {
      let d = `M${cx} ${cy}`; for (let th = 0.25; th < 4 * Math.PI; th += 0.25) d += `L${(cx + Math.cos(th) * th * 0.75).toFixed(1)} ${(cy + Math.sin(th) * th * 0.75).toFixed(1)}`;
      return `<g><path d="${d}" fill="none" stroke="${EYE}" stroke-width="2" stroke-linecap="round"/><animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="${sentido * 360} ${cx} ${cy}" dur="1.4s" repeatCount="indefinite"/></g>`;
    };

    let ojos = '', extra = '';
    if (nivel === 'bad') {                                   // espirales (mareado)
      ojos = espiral(E[0], 1) + espiral(E[1], -1);
      extra = `<g>${estrella(82, 50, 3.6)}${estrella(158, 46, 3.6)}${estrella(120, 42, 3.6)}<animate attributeName="opacity" values="1;.35;1" dur="1s" repeatCount="indefinite"/></g>`;
    } else if (nivel === 'crit') {                           // > <
      ojos = `<path d="M100 86L110 92L100 98M140 86L130 92L140 98" fill="none" stroke="#FFB3C1" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
      extra = `<text x="160" y="56" fill="#F43F5E" font-size="22" font-weight="700" font-family="Space Grotesk, sans-serif" text-anchor="middle">!<animate attributeName="opacity" values="1;0;1" dur=".5s" repeatCount="indefinite"/></text>`;
    } else if (nivel === 'off') {                            // dormido
      ojos = E.map(([x, y]) => { const a0 = 0.15 * Math.PI, a1 = 0.85 * Math.PI, yy = y - 2;
        return `<path d="M${x + Math.cos(a0) * 6} ${yy + Math.sin(a0) * 6}A6 6 0 0 1 ${x + Math.cos(a1) * 6} ${yy + Math.sin(a1) * 6}" fill="none" stroke="${EYE}" stroke-width="2.6" stroke-linecap="round"/>`; }).join('');
      extra = [0, 1, 2].map((i) => `<text x="160" y="60" fill="#A5B4FC" font-size="12" font-family="Space Grotesk, sans-serif" opacity="0">z<animate attributeName="opacity" values="0;1;0" dur="3s" begin="${i}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;10 -14" dur="3s" begin="${i}s" repeatCount="indefinite"/></text>`).join('');
    } else {                                                 // óvalos de siempre (+ parpadeo)
      const parp = 'dur="4.2s" keyTimes="0;.94;.97;1" repeatCount="indefinite"';
      ojos = E.map(([x, y]) => `<rect x="${x - rx}" y="${y - ry}" width="${rx * 2}" height="${ry * 2}" rx="${rx}" fill="${EYE}">
          <animate attributeName="height" values="${ry * 2};${ry * 2};2;${ry * 2}" ${parp}/><animate attributeName="y" values="${y - ry};${y - ry};${y - 1};${y - ry}" ${parp}/></rect>
        <circle cx="${x - rx * 0.32}" cy="${y - ry * 0.38}" r="2" fill="#fff"><animate attributeName="opacity" values="1;1;0;1" ${parp}/></circle>`).join('');
      if (nivel === 'warn') {                                // párpados caídos: preocupado
        const L = 0.38;
        ojos += E.map(([x, y], i) => { const sl = 1.3 * (i ? 1 : -1), ly = y - ry - 3 + L * (ry * 2 + 4), x0 = x - rx - 4, x1 = x + rx + 4;
          return `<path d="M${x0} 76L${x1} 76L${x1} ${ly + sl}L${x0} ${ly - sl}Z" fill="${NAVY}"/><line x1="${x0 + 3}" y1="${ly - sl}" x2="${x1 - 3}" y2="${ly + sl}" stroke="${EYE}" stroke-width="2" stroke-linecap="round"/>`; }).join('');
      }
    }
    const visor = nivel === 'crit'
      ? `<rect x="87" y="72" width="66" height="42" rx="21" fill="${NAVY}" stroke="${VB}" stroke-width="2.4"><animate attributeName="fill" values="${NAVY};#4C0519;${NAVY}" dur=".5s" repeatCount="indefinite"/></rect>`
      : `<rect x="87" y="72" width="66" height="42" rx="21" fill="${NAVY}" stroke="${VB}" stroke-width="2.4"/>`;
    const brillo = (() => { const a0 = 1.1 * Math.PI, a1 = 1.45 * Math.PI; return `<path d="M${102 + Math.cos(a0) * 11} ${84 + Math.sin(a0) * 11}A11 11 0 0 1 ${102 + Math.cos(a1) * 11} ${84 + Math.sin(a1) * 11}" fill="none" stroke="#8590AD" stroke-width="2.3" stroke-linecap="round"/>`; })();
    const rayos = Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4, r = i % 2 ? 5 : 8.5; return `<line x1="120" y1="152" x2="${120 + Math.cos(a) * r}" y2="${152 + Math.sin(a) * r}" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>`; }).join('');

    return `<svg class="kpler" viewBox="58 30 124 180" role="img" aria-label="K-PLER">
      <g><animateTransform attributeName="transform" type="translate" values="0 0;0 ${-bob};0 0" dur="2.6s" repeatCount="indefinite"/>
        <g><path d="M112 180L128 180L120 204Z" fill="#38BDF8"/><path d="M115 180L125 180L120 193Z" fill="#E0FBFF"/>
          <animateTransform attributeName="transform" type="scale" additive="sum" values="1 1;1 1.08;1 .94;1 1" dur=".4s" repeatCount="indefinite"/></g>
        <rect x="109" y="170" width="22" height="11" rx="5" fill="${BLUE}" stroke="${OUT}" stroke-width="2.4"/>
        ${brazo(101, 140, -1, 0.35)}${brazo(139, 140, 1, 0.35)}
        <rect x="98" y="130" width="44" height="44" rx="20" fill="${WHITE}" stroke="${OUT}" stroke-width="3"/>
        <rect x="103" y="157" width="34" height="12" rx="6" fill="${SHADE}"/>
        <circle cx="120" cy="152" r="18" fill="${mixHex(WHITE, CORE, 0.2)}"><animate attributeName="r" values="16;18;16" dur="${pulso * 2}s" repeatCount="indefinite"/></circle>
        <circle cx="120" cy="152" r="12" fill="${NAVY}" stroke="${VB}" stroke-width="2.8"/>
        <circle cx="120" cy="152" r="9.5" fill="${CORE}"/>
        <circle cx="120" cy="152" r="5" fill="${mixHex(CORE, '#FFFFFF', 0.6)}"/>
        <g>${rayos}<animateTransform attributeName="transform" type="rotate" from="0 120 152" to="360 120 152" dur="${pulso * 12}s" repeatCount="indefinite"/></g>
        <circle cx="120" cy="152" r="2.6" fill="#fff"/>
        <line x1="120" y1="53" x2="120" y2="43" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="120" cy="39" r="5" fill="${CORE}" stroke="${OUT}" stroke-width="2.4">${nivel === 'crit' ? '<animate attributeName="fill" values="#F43F5E;#1E293B;#F43F5E" dur=".5s" repeatCount="indefinite"/>' : ''}</circle>
        <rect x="65" y="78" width="12" height="28" rx="6" fill="${BLUE}" stroke="${OUT}" stroke-width="2.4"/>
        <rect x="163" y="78" width="12" height="28" rx="6" fill="${BLUE}" stroke="${OUT}" stroke-width="2.4"/>
        <rect x="72" y="52" width="96" height="80" rx="40" fill="${WHITE}" stroke="${OUT}" stroke-width="3"/>
        ${visor}${ojos}${brillo}
      </g>${extra}
    </svg>`;
  }

  // ---------- íconos de clima (códigos WMO) ----------
  function iconoClima(c) {
    const sol = '<circle cx="32" cy="32" r="11" fill="#FACC15"/><g stroke="#FACC15" stroke-width="3" stroke-linecap="round"><path d="M32 10v6M32 48v6M10 32h6M48 32h6M16.4 16.4l4.3 4.3M43.3 43.3l4.3 4.3M16.4 47.6l4.3-4.3M43.3 20.7l4.3-4.3"/></g>';
    const nube = (x = 0, y = 0, f = '#CBD5E1') => `<path transform="translate(${x} ${y})" d="M20 46h26a10 10 0 0 0 0-20 14 14 0 0 0-27-2 11 11 0 0 0 1 22z" fill="${f}"/>`;
    const gotas = '<g stroke="#22D3EE" stroke-width="3" stroke-linecap="round"><path d="M24 52l-3 7M34 52l-3 7M44 52l-3 7"/></g>';
    let s;
    if (c === 0) s = sol;
    else if (c <= 2) s = '<g transform="translate(8 -6) scale(.8)">' + sol + '</g>' + nube(0, 4);
    else if (c === 3) s = nube(0, 0, '#94A3B8');
    else if (c === 45 || c === 48) s = '<g stroke="#94A3B8" stroke-width="4" stroke-linecap="round"><path d="M12 24h40M8 34h48M14 44h36"/></g>';
    else if (c >= 95) s = nube(0, -4, '#64748B') + '<path d="M34 42l-8 12h8l-4 10 12-15h-8l4-7z" fill="#FACC15"/>';
    else if (c >= 71 && c <= 77) s = nube(0, -4) + '<g fill="#F8FAFC"><circle cx="24" cy="54" r="3"/><circle cx="34" cy="58" r="3"/><circle cx="44" cy="54" r="3"/></g>';
    else s = nube(0, -4, '#94A3B8') + gotas;
    return `<svg viewBox="0 0 64 64" aria-hidden="true">${s}</svg>`;
  }
  function textoClima(c) {
    if (c === 0) return 'Despejado'; if (c <= 2) return 'Poco nublado'; if (c === 3) return 'Nublado';
    if (c === 45 || c === 48) return 'Neblina'; if (c >= 51 && c <= 57) return 'Llovizna'; if (c >= 61 && c <= 67) return 'Lluvia';
    if (c >= 71 && c <= 77) return 'Nieve'; if (c >= 80 && c <= 82) return 'Chubascos'; if (c >= 95) return 'Tormenta'; return '';
  }
  function consejoRopa(cl) {
    const f = cl.sensacion;
    const ropa = f < 8 ? 'Mucho abrigo' : f < 13 ? 'Lleva chaqueta' : f < 18 ? 'Lleva un polar' : 'Ropa liviana';
    return cl.lluvia >= 50 ? ropa + ' y paraguas' : ropa;
  }

  // ---------- gráfico de 24 h (SVG propio, sin librerías) ----------
  const CAMPOS = {
    co2: { nombre: 'CO₂', unidad: 'ppm', dec: 0, min: 400, umbrales: [[800, '#FACC15'], [1200, '#FB923C'], [2000, '#F43F5E']] },
    temp: { nombre: 'Temperatura', unidad: '°C', dec: 1, umbrales: [] },
    hum: { nombre: 'Humedad', unidad: '%', dec: 0, umbrales: [] },
  };
  function grafico(contenedor, info, serie, campo) {
    const cfg = CAMPOS[campo];
    const W = 340, H = 170, L = 34, R = 8, T = 10, B = 22;
    const fin = Date.now(), ini = fin - 24 * 3600e3;
    const pts = serie.filter((p) => p[campo] != null && p.t >= ini);
    if (pts.length < 2) { contenedor.innerHTML = '<p class="vacio">Todavía no hay suficientes datos para el gráfico.</p>'; info.textContent = ''; return; }
    const vals = pts.map((p) => p[campo]);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (cfg.min != null) lo = Math.min(lo, cfg.min);
    if (campo === 'co2') hi = Math.max(hi, 1300);
    const pad = (hi - lo) * 0.08 || 1; lo -= campo === 'co2' ? 0 : pad; hi += pad;
    const X = (t) => L + (t - ini) / (fin - ini) * (W - L - R);
    const Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);

    // tramos: un hueco de más de 12 min corta la línea (sin internet = sin datos, no se inventa)
    const tramos = []; let tr = [];
    pts.forEach((p, i) => { if (i && p.t - pts[i - 1].t > 12 * 60e3) { tramos.push(tr); tr = []; } tr.push(p); });
    tramos.push(tr);
    const linea = tramos.filter((t) => t.length).map((t) => 'M' + t.map((p) => X(p.t).toFixed(1) + ' ' + Y(p[campo]).toFixed(1)).join('L')).join('');
    const area = tramos.filter((t) => t.length > 1).map((t) => `M${X(t[0].t).toFixed(1)} ${H - B}` + t.map((p) => `L${X(p.t).toFixed(1)} ${Y(p[campo]).toFixed(1)}`).join('') + `L${X(t[t.length - 1].t).toFixed(1)} ${H - B}Z`).join('');

    // marcas de hora cada 6 h
    const marcas = []; const d0 = new Date(ini); d0.setMinutes(0, 0, 0);
    for (let t = d0.getTime() + 3600e3; t < fin; t += 3600e3) if (new Date(t).getHours() % 6 === 0) marcas.push(t);
    // marcas redondas: 100, 200, 250, 500… según el rango
    const bruto = (hi - lo) / 4, mag = Math.pow(10, Math.floor(Math.log10(bruto)));
    const paso = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= bruto);
    const yTicks = []; for (let v = Math.ceil(lo / paso) * paso; v <= hi; v += paso) yTicks.push(v);

    contenedor.innerHTML = `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="${cfg.nombre} en las últimas 24 horas">
      <defs><linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22D3EE" stop-opacity=".28"/><stop offset="1" stop-color="#22D3EE" stop-opacity="0"/></linearGradient></defs>
      ${yTicks.map((v) => `<line class="rejilla" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="eje" x="${L - 6}" y="${Y(v) + 3}" text-anchor="end">${Number.isInteger(+v.toFixed(6)) ? Math.round(v) : v.toFixed(1)}</text>`).join('')}
      ${cfg.umbrales.filter(([v]) => v > lo && v < hi).map(([v, c]) => `<line class="umbral" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${c}"/>`).join('')}
      ${marcas.map((t) => `<text class="eje" x="${X(t)}" y="${H - 6}" text-anchor="middle">${new Date(t).getHours()}:00</text>`).join('')}
      <path class="area" d="${area}"/><path class="linea" d="${linea}"/>
      <g class="cursor-g" visibility="hidden"><line class="cursor" y1="${T}" y2="${H - B}"/><circle class="punto" r="4"/></g>
      <rect x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent" class="zona"/>
    </svg>`;
    const svg = contenedor.querySelector('svg'), g = svg.querySelector('.cursor-g'), zona = svg.querySelector('.zona');
    const resumen = () => { info.textContent = `Máx ${Math.max(...vals).toFixed(cfg.dec)} ${cfg.unidad} · mín ${Math.min(...vals).toFixed(cfg.dec)} ${cfg.unidad}`; };
    resumen();
    const mover = (ev) => {
      const r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * W;
      const t = ini + (x - L) / (W - L - R) * (fin - ini);
      let p = pts[0]; for (const q of pts) if (Math.abs(q.t - t) < Math.abs(p.t - t)) p = q;
      g.setAttribute('visibility', 'visible');
      g.querySelector('line').setAttribute('x1', X(p.t)); g.querySelector('line').setAttribute('x2', X(p.t));
      g.querySelector('circle').setAttribute('cx', X(p.t)); g.querySelector('circle').setAttribute('cy', Y(p[campo]));
      info.textContent = `${hora(p.t)} · ${p[campo].toFixed(cfg.dec)} ${cfg.unidad}`;
    };
    zona.addEventListener('pointermove', mover);
    zona.addEventListener('pointerdown', mover);
    zona.addEventListener('pointerleave', () => { g.setAttribute('visibility', 'hidden'); resumen(); });
  }

  // ---------- avisos ----------
  let tt;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg; el.classList.add('visible');
    clearTimeout(tt); tt = setTimeout(() => el.classList.remove('visible'), 3200);
  }
  function confirmar(titulo, html, si = 'Sí', no = 'Cancelar') {
    const d = document.getElementById('dialogo');
    d.innerHTML = `<h2>${esc(titulo)}</h2>${html}<div class="botones"><button class="btn" value="no">${esc(no)}</button><button class="btn primario" value="si">${esc(si)}</button></div>`;
    return new Promise((ok) => {
      d.querySelectorAll('button').forEach((b) => b.onclick = () => { d.close(); ok(b.value === 'si'); });
      d.showModal();
    });
  }

  window.OrbitaUI = { esc, hora, fechaLarga, hace, dentroDe, mismoDia, nivelDe, DESCONECTADO_MS, kpler, iconoClima, textoClima, consejoRopa, grafico, toast, confirmar };
})();
